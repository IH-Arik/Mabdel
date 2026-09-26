const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, toNumber } = baileys;

const PORT = process.env.PORT || 3001;
const FASTAPI_URL = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');
const GATEWAY_INTERNAL_SECRET = process.env.GATEWAY_INTERNAL_SECRET || '';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, 'sessions');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// One entry per organization: { socket, status, qrDataUrl, linkedNumber, webhookSecret }
// status is one of "pending_qr" | "connected" | "disconnected".
const sessions = new Map();

// orgId becomes a directory name, so only accept the characters real organization ids
// (UUIDs / ObjectIds) use - never path separators or dots.
const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function sessionDir(orgId) {
  if (!ORG_ID_PATTERN.test(orgId)) {
    throw new Error('invalid organization id');
  }
  return path.join(SESSIONS_DIR, orgId);
}

function secretsMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// message.messageTimestamp is a protobuf Long (verified: WhiskeySockets/Baileys'
// own process-message.ts converts it the same way), not a plain number - toNumber()
// is Baileys' own exported helper for this exact field, reused here rather than
// reimplemented, since a naive Number(value) or a raw .low read is silently wrong
// for a Long instance.
function messageTimestampToIso(value) {
  const seconds = toNumber(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

// Plain message text, or a readable placeholder (plus caption) for media - media-only
// messages used to arrive as blank bubbles.
function describeMessage(message) {
  const m = message.message || {};
  const text = m.conversation || (m.extendedTextMessage && m.extendedTextMessage.text);
  if (text) return text;
  const media = [
    ['imageMessage', 'Image'],
    ['videoMessage', 'Video'],
    ['documentMessage', 'Document'],
    ['audioMessage', 'Voice message'],
    ['stickerMessage', 'Sticker'],
    ['locationMessage', 'Location'],
    ['contactMessage', 'Contact'],
  ];
  for (const [key, label] of media) {
    if (m[key]) {
      const caption = m[key].caption;
      return caption ? `[${label}] ${caption}` : `[${label}]`;
    }
  }
  return '';
}

// The webhook secret lives only in memory otherwise, so a container restart
// (every deploy) would leave every already-linked organization deaf until
// someone clicked Connect again. Persist it next to the Baileys auth files.
const META_FILE = 'gateway-meta.json';

async function saveMeta(orgId, webhookSecret) {
  await fs.mkdir(sessionDir(orgId), { recursive: true });
  await fs.writeFile(path.join(sessionDir(orgId), META_FILE), JSON.stringify({ webhookSecret }));
}

async function restoreSessions() {
  let dirs = [];
  try {
    dirs = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    try {
      // Only re-open sessions that were actually paired; an abandoned, never-scanned
      // QR attempt must not spawn a socket on every restart.
      const creds = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, dir.name, 'creds.json'), 'utf8'));
      if (!creds.registered) continue;
      const meta = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, dir.name, META_FILE), 'utf8'));
      await startSession(dir.name, meta.webhookSecret);
      logger.info({ orgId: dir.name }, 'restored WhatsApp session after restart');
    } catch (err) {
      logger.warn({ orgId: dir.name, err: err.message }, 'could not restore WhatsApp session');
    }
  }
}

async function connectSession(orgId) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(orgId));
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ orgId }),
    printQRInTerminal: false,
    // Baileys' own docs recommend browser: Browsers.macOS('Desktop') alongside
    // syncFullHistory for a longer history window - tried it here and it broke
    // pairing outright (WhatsApp repeatedly closed the connection with statusCode
    // 428 immediately after registration, before ever emitting a QR, reproduced
    // several times against real WhatsApp servers). A working connection matters
    // more than a longer history window, so this stays on the default browser
    // profile; syncFullHistory alone still gets whatever history WhatsApp is
    // willing to hand this profile.
    syncFullHistory: true,
  });

  const entry = sessions.get(orgId);
  entry.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qrDataUrl = await qrcode.toDataURL(qr);
      entry.status = 'pending_qr';
    }

    if (connection === 'open') {
      entry.status = 'connected';
      entry.qrDataUrl = null;
      entry.linkedNumber = (socket.user && socket.user.id ? socket.user.id.split(':')[0] : null);
      logger.info({ orgId, linkedNumber: entry.linkedNumber }, 'WhatsApp session connected');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect && lastDisconnect.error instanceof Boom
        ? lastDisconnect.error.output.statusCode
        : null;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        entry.status = 'disconnected';
        entry.qrDataUrl = null;
        entry.socket = null;
        await fs.rm(sessionDir(orgId), { recursive: true, force: true }).catch(() => {});
        logger.info({ orgId }, 'WhatsApp session logged out, session data cleared');
      } else {
        logger.warn({ orgId, statusCode }, 'WhatsApp connection closed, reconnecting');
        entry.socket = null;
        setTimeout(() => reconnectWithRetry(orgId), 3000);
      }
    }
  });

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) continue; // direct messaging only

      // A message sent directly from the linked phone (not through the app) must
      // still show up in Unified - it used to be silently dropped here.
      const payload = {
        event_id: message.key.id,
        contact_external_id: message.key.remoteJid,
        content: describeMessage(message),
        contact_name: message.pushName || 'WhatsApp Contact',
        external_account_id: entry.linkedNumber,
        direction: message.key.fromMe ? 'outbound' : 'inbound',
        timestamp: messageTimestampToIso(message.messageTimestamp),
      };

      try {
        const response = await axios.post(
          `${FASTAPI_URL}/api/v1/smartflow/integrations/whatsapp/webhook`,
          payload,
          { headers: { 'X-Webhook-Secret': entry.webhookSecret, 'Content-Type': 'application/json' } }
        );
        logger.info({ orgId, status: response.status }, 'forwarded WhatsApp message');
      } catch (err) {
        logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp message');
      }
    }
  });

  socket.ev.on('messaging-history.set', async ({ messages }) => {
    const batch = (messages || [])
      .filter((message) => message.key.remoteJid && !message.key.remoteJid.endsWith('@g.us'))
      .map((message) => ({
        event_id: message.key.id,
        contact_external_id: message.key.remoteJid,
        content: describeMessage(message),
        contact_name: message.pushName || 'WhatsApp Contact',
        external_account_id: entry.linkedNumber,
        direction: message.key.fromMe ? 'outbound' : 'inbound',
        timestamp: messageTimestampToIso(message.messageTimestamp),
      }));
    if (batch.length === 0) return;

    try {
      const response = await axios.post(
        `${FASTAPI_URL}/api/v1/smartflow/integrations/whatsapp/webhook/history`,
        { messages: batch },
        { headers: { 'X-Webhook-Secret': entry.webhookSecret, 'Content-Type': 'application/json' } }
      );
      logger.info({ orgId, count: batch.length, result: response.data }, 'forwarded WhatsApp history batch');
    } catch (err) {
      logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp history batch');
    }
  });

  return socket;
}

// Baileys closes the socket once right after a fresh QR pairing (restartRequired)
// and expects the client to reconnect. A single failed attempt used to leave the
// session stuck in "pending_qr" forever, so retry with backoff.
async function reconnectWithRetry(orgId, attempt = 1) {
  const entry = sessions.get(orgId);
  if (!entry || entry.socket) return;
  try {
    await connectSession(orgId);
  } catch (err) {
    logger.error({ orgId, attempt, err: err.message }, 'reconnect failed');
    if (attempt < 6) {
      setTimeout(() => reconnectWithRetry(orgId, attempt + 1), Math.min(30000, 2000 * attempt));
    }
  }
}

async function startSession(orgId, webhookSecret) {
  let entry = sessions.get(orgId);
  if (!entry) {
    entry = { socket: null, status: 'pending_qr', qrDataUrl: null, linkedNumber: null, webhookSecret };
    sessions.set(orgId, entry);
  } else {
    entry.webhookSecret = webhookSecret;
  }
  await saveMeta(orgId, webhookSecret);

  if (!entry.socket) {
    await connectSession(orgId);
  }
  return entry;
}

const app = express();
app.use(express.json());

if (!GATEWAY_INTERNAL_SECRET) {
  logger.warn('GATEWAY_INTERNAL_SECRET is not set: /sessions is unauthenticated. Only safe when the gateway is reachable from the api container alone.');
}

app.use('/sessions', (req, res, next) => {
  if (GATEWAY_INTERNAL_SECRET && !secretsMatch(req.header('X-Gateway-Secret'), GATEWAY_INTERNAL_SECRET)) {
    return res.status(401).json({ error: 'Invalid gateway secret' });
  }
  if (!ORG_ID_PATTERN.test(req.params.orgId || (req.path.split('/')[1] || ''))) {
    return res.status(400).json({ error: 'Invalid organization id' });
  }
  next();
});

app.post('/sessions/:orgId/start', async (req, res) => {
  const { orgId } = req.params;
  const { webhook_secret: webhookSecret } = req.body;
  if (!webhookSecret) return res.status(400).json({ error: 'webhook_secret is required' });

  try {
    const entry = await startSession(orgId, webhookSecret);
    res.json({ status: entry.status, qr_data_url: entry.qrDataUrl, linked_number: entry.linkedNumber });
  } catch (err) {
    logger.error({ orgId, err }, 'failed to start session');
    res.status(500).json({ error: 'Failed to start WhatsApp session' });
  }
});

app.get('/sessions/:orgId/qr', (req, res) => {
  const entry = sessions.get(req.params.orgId);
  if (!entry) return res.json({ status: 'disconnected', qr_data_url: null, linked_number: null });
  res.json({ status: entry.status, qr_data_url: entry.qrDataUrl, linked_number: entry.linkedNumber });
});

app.post('/sessions/:orgId/send-message', async (req, res) => {
  const { orgId } = req.params;
  const { to, message } = req.body;
  const entry = sessions.get(orgId);

  if (!entry || !entry.socket || entry.status !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp session is not connected' });
  }
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message parameter' });
  }

  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const result = await entry.socket.sendMessage(jid, { text: message });
    res.json({ success: true, messageId: result && result.key ? result.key.id : null });
  } catch (err) {
    logger.error({ orgId, err }, 'failed to send WhatsApp message');
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: err.message });
  }
});

app.post('/sessions/:orgId/disconnect', async (req, res) => {
  const { orgId } = req.params;
  const entry = sessions.get(orgId);
  if (entry && entry.socket) {
    await entry.socket.logout().catch(() => {});
  }
  await fs.rm(sessionDir(orgId), { recursive: true, force: true }).catch(() => {});
  sessions.delete(orgId);
  res.json({ status: 'disconnected' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', active_sessions: sessions.size });
});

app.listen(PORT, () => {
  logger.info(`GoCustify WhatsApp gateway listening on port ${PORT}`);
  restoreSessions();
});
