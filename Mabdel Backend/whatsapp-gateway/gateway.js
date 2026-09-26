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
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  toNumber,
  normalizeMessageContent,
  getContentType,
  jidNormalizedUser,
  isJidGroup,
  isJidBroadcast,
  isJidNewsletter,
  isLidUser,
} = baileys;

// Outbound pacing per linked number. Unofficial WhatsApp bans numbers that blast
// messages; a person-like pace keeps normal inbox replies well clear of that.
const SEND_MIN_GAP_MS = Number(process.env.SEND_MIN_GAP_MS || 1500);
const SEND_MAX_PER_MINUTE = Number(process.env.SEND_MAX_PER_MINUTE || 20);

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

// Protocol traffic that is not a message anyone wrote: reactions, edits/deletes,
// key exchange, poll votes. Forwarding these produced the empty bubbles.
const NON_CHAT_TYPES = new Set([
  'protocolMessage',
  'reactionMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'pollUpdateMessage',
  'keepInChatMessage',
  'pinInChatMessage',
  'encReactionMessage',
  'encEventResponseMessage',
]);

const MEDIA_LABELS = {
  imageMessage: 'Image',
  videoMessage: 'Video',
  ptvMessage: 'Video message',
  documentMessage: 'Document',
  stickerMessage: 'Sticker',
  locationMessage: 'Location',
  liveLocationMessage: 'Live location',
  contactMessage: 'Contact',
  contactsArrayMessage: 'Contacts',
};

// The text a person would read in WhatsApp, or a readable placeholder for media.
// normalizeMessageContent (Baileys' own) unwraps disappearing, view-once and
// document-with-caption envelopes, which used to hide the real content.
// Returns null for anything that is not a chat message, so nothing is forwarded.
function describeMessage(message) {
  const content = normalizeMessageContent(message.message);
  if (!content) return null;
  const type = getContentType(content);
  if (!type || NON_CHAT_TYPES.has(type)) return null;
  const inner = content[type] || {};

  if (type === 'conversation') return content.conversation || null;
  if (type === 'extendedTextMessage') return inner.text || null;
  if (type === 'audioMessage') return inner.ptt ? '[Voice message]' : '[Audio]';
  if (type === 'documentMessage') {
    const name = inner.fileName ? ` ${inner.fileName}` : '';
    return inner.caption ? `[Document]${name}\n${inner.caption}` : `[Document]${name}`;
  }
  if (/^pollCreationMessage/.test(type)) return `[Poll] ${inner.name || ''}`.trim();
  if (type === 'buttonsResponseMessage') return inner.selectedDisplayText || null;
  if (type === 'listResponseMessage') return inner.title || null;
  if (type === 'templateButtonReplyMessage') return inner.selectedDisplayText || null;
  if (MEDIA_LABELS[type]) {
    return inner.caption ? `[${MEDIA_LABELS[type]}] ${inner.caption}` : `[${MEDIA_LABELS[type]}]`;
  }
  return null;
}

// One-to-one chats only: groups, Status updates (status@broadcast), broadcast lists
// and Channels (@newsletter) are not a customer conversation.
function isDirectChat(jid) {
  return Boolean(jid) && !isJidGroup(jid) && !isJidBroadcast(jid) && !isJidNewsletter(jid);
}

// WhatsApp increasingly addresses people by a private @lid instead of their number.
// Prefer the phone-number JID when WhatsApp tells us (senderPn on the key, or a
// mapping learned from contacts/history), so the thread shows a real number.
function chatJid(entry, message) {
  const remote = message.key.remoteJid;
  if (!isLidUser(remote)) return jidNormalizedUser(remote);
  const pn = message.key.senderPn || entry.lidToPn.get(jidNormalizedUser(remote));
  return pn ? jidNormalizedUser(pn) : jidNormalizedUser(remote);
}

function rememberLidMappings(entry, items) {
  for (const item of items || []) {
    const lid = item.lid || item.lidJid || (isLidUser(item.id) ? item.id : null);
    const pn = item.jid || item.pnJid || (item.id && item.id.endsWith('@s.whatsapp.net') ? item.id : null);
    if (lid && pn) entry.lidToPn.set(jidNormalizedUser(lid), jidNormalizedUser(pn));
  }
}

function toPayload(entry, message) {
  const content = describeMessage(message);
  if (!content || !isDirectChat(message.key.remoteJid)) return null;
  return {
    event_id: message.key.id,
    contact_external_id: chatJid(entry, message),
    content,
    // pushName on our own message is OUR profile name, never the customer's.
    contact_name: message.key.fromMe ? null : (message.pushName || null),
    external_account_id: entry.linkedNumber,
    direction: message.key.fromMe ? 'outbound' : 'inbound',
    timestamp: messageTimestampToIso(message.messageTimestamp),
  };
}

// Names come from the phone's address book (name) or the person's own profile
// (notify / verifiedName for businesses).
function toContactPayload(entry, contact) {
  const name = contact.name || contact.notify || contact.verifiedName;
  if (!name || !contact.id) return null;
  const lid = contact.lid || (isLidUser(contact.id) ? contact.id : null);
  const pn = contact.jid || (contact.id.endsWith('@s.whatsapp.net') ? contact.id : null) || (lid && entry.lidToPn.get(jidNormalizedUser(lid)));
  if (!isDirectChat(pn || lid)) return null;
  return {
    phone_jid: pn ? jidNormalizedUser(pn) : null,
    lid: lid ? jidNormalizedUser(lid) : null,
    name,
  };
}

async function postToBackend(entry, pathSuffix, body) {
  return axios.post(`${FASTAPI_URL}/api/v1/smartflow/integrations/whatsapp/${pathSuffix}`, body, {
    headers: { 'X-Webhook-Secret': entry.webhookSecret, 'Content-Type': 'application/json' },
  });
}

async function forwardContacts(orgId, entry, contacts, isLive) {
  const batch = (contacts || []).map((contact) => toContactPayload(entry, contact)).filter(Boolean);
  for (let i = 0; i < batch.length; i += 200) {
    if (!isLive()) return;
    try {
      await postToBackend(entry, 'webhook/contacts', { contacts: batch.slice(i, i + 200) });
    } catch (err) {
      logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp contacts');
    }
  }
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

  // Baileys keeps emitting (history chunks, buffered messages) for a while after a
  // logout or a reconnect replaced this socket. Only the org's current socket may
  // forward anything.
  const isLive = () => sessions.get(orgId) === entry && entry.socket === socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    if (!isLive()) return;
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
      if (!isLive()) return;
      // A message sent directly from the linked phone (not through the app) still
      // belongs in Unified, so fromMe messages are forwarded too, as outbound.
      const payload = toPayload(entry, message);
      if (!payload) continue;
      try {
        const response = await postToBackend(entry, 'webhook', payload);
        logger.info({ orgId, status: response.status }, 'forwarded WhatsApp message');
      } catch (err) {
        logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp message');
      }
    }
  });

  socket.ev.on('messaging-history.set', async ({ messages, contacts, chats }) => {
    if (!isLive()) return;
    // Learn @lid -> phone mappings before building payloads, so imported threads get
    // a real number where WhatsApp told us one.
    rememberLidMappings(entry, contacts);
    rememberLidMappings(entry, chats);
    const batch = (messages || []).map((message) => toPayload(entry, message)).filter(Boolean);
    // Newer WhatsApp history often has no pushName, so send the names separately.
    await forwardContacts(orgId, entry, contacts, isLive);
    for (let i = 0; i < batch.length; i += 200) {
      if (!isLive()) return;
      try {
        const response = await postToBackend(entry, 'webhook/history', { messages: batch.slice(i, i + 200) });
        logger.info({ orgId, count: Math.min(200, batch.length - i), result: response.data }, 'forwarded WhatsApp history batch');
      } catch (err) {
        logger.error({ orgId, err: err.response ? err.response.data : err.message }, 'failed to forward WhatsApp history batch');
      }
    }
  });

  socket.ev.on('contacts.upsert', async (contacts) => {
    if (!isLive()) return;
    rememberLidMappings(entry, contacts);
    await forwardContacts(orgId, entry, contacts, isLive);
  });

  socket.ev.on('contacts.update', async (updates) => {
    if (!isLive()) return;
    rememberLidMappings(entry, updates);
    await forwardContacts(orgId, entry, (updates || []).filter((u) => u.name || u.notify || u.verifiedName), isLive);
  });

  socket.ev.on('chats.upsert', (chats) => {
    if (isLive()) rememberLidMappings(entry, chats);
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
    entry = {
      socket: null,
      status: 'pending_qr',
      qrDataUrl: null,
      linkedNumber: null,
      webhookSecret,
      lidToPn: new Map(),
      sendLog: [],
      nextSendAt: 0,
    };
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

  const now = Date.now();
  entry.sendLog = entry.sendLog.filter((sentAt) => now - sentAt < 60000);
  if (entry.sendLog.length >= SEND_MAX_PER_MINUTE) {
    return res.status(429).json({ error: 'Sending too fast on this WhatsApp number' });
  }
  const sendAt = Math.max(now, entry.nextSendAt);
  entry.nextSendAt = sendAt + SEND_MIN_GAP_MS;
  entry.sendLog.push(sendAt);
  if (sendAt > now) await new Promise((resolve) => setTimeout(resolve, sendAt - now));
  if (!entry.socket || entry.status !== 'connected') {
    return res.status(503).json({ error: 'WhatsApp session is not connected' });
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
  // Detach first so events the socket still emits while logging out are dropped.
  sessions.delete(orgId);
  const socket = entry ? entry.socket : null;
  if (entry) {
    entry.socket = null;
    entry.status = 'disconnected';
  }
  if (socket) {
    await socket.logout().catch(() => {});
    socket.end(undefined);
  }
  await fs.rm(sessionDir(orgId), { recursive: true, force: true }).catch(() => {});
  res.json({ status: 'disconnected' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', active_sessions: sessions.size });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`GoCustify WhatsApp gateway listening on port ${PORT}`);
    restoreSessions();
  });
}

module.exports = { describeMessage, isDirectChat, toPayload, toContactPayload, rememberLidMappings };
