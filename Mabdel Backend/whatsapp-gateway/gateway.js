const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

const PORT = process.env.PORT || 3001;
const FASTAPI_URL = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');
const GATEWAY_INTERNAL_SECRET = process.env.GATEWAY_INTERNAL_SECRET || '';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, 'sessions');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// One entry per organization: { socket, status, qrDataUrl, linkedNumber, webhookSecret }
// status is one of "pending_qr" | "connected" | "disconnected".
const sessions = new Map();

function sessionDir(orgId) {
  return path.join(SESSIONS_DIR, orgId);
}

async function connectSession(orgId) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(orgId));
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ orgId }),
    printQRInTerminal: false,
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
        await connectSession(orgId).catch((err) => logger.error({ orgId, err }, 'reconnect failed'));
      }
    }
  });

  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      if (message.key.fromMe) continue;
      if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) continue; // direct messaging only

      const content =
        (message.message && (message.message.conversation || (message.message.extendedTextMessage && message.message.extendedTextMessage.text))) || '';

      const payload = {
        event_id: message.key.id,
        contact_external_id: message.key.remoteJid,
        content,
        contact_name: message.pushName || 'WhatsApp Contact',
        external_account_id: entry.linkedNumber,
      };

      try {
        const response = await axios.post(
          `${FASTAPI_URL}/api/v1/smartflow/integrations/whatsapp/webhook`,
          payload,
          { headers: { 'X-Webhook-Secret': entry.webhookSecret, 'Content-Type': 'application/json' } }
        );
        logger.info({ orgId, status: response.status }, 'forwarded inbound WhatsApp message');
      } catch (err) {
        logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp message');
      }
    }
  });

  return socket;
}

async function startSession(orgId, webhookSecret) {
  let entry = sessions.get(orgId);
  if (!entry) {
    entry = { socket: null, status: 'pending_qr', qrDataUrl: null, linkedNumber: null, webhookSecret };
    sessions.set(orgId, entry);
  } else {
    entry.webhookSecret = webhookSecret;
  }

  if (!entry.socket) {
    await connectSession(orgId);
  }
  return entry;
}

const app = express();
app.use(express.json());

app.use('/sessions', (req, res, next) => {
  if (!GATEWAY_INTERNAL_SECRET) return next();
  if (req.header('X-Gateway-Secret') !== GATEWAY_INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Invalid gateway secret' });
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
});
