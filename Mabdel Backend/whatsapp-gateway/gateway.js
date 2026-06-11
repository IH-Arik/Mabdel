const { create } = require('@open-wa/wa-automate');
const axios = require('axios');
const express = require('express');

const PORT = process.env.PORT || 3001;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const USER_ID = process.env.USER_ID; // The MongoDB User ID to route incoming messages to
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-this-in-production';

if (!USER_ID) {
  console.warn('WARNING: USER_ID environment variable is not set. Incoming messages will rely on backend external_account_id resolving.');
}

const app = express();
app.use(express.json());

let waClient = null;

// Initialize WhatsApp client
create({
  sessionId: "MABDEL_WHATSAPP",
  multiDevice: true,
  authTimeout: 60,
  blockCrashLogs: true,
  disableSpins: true,
  headless: true,
  qrTimeout: 0,
}).then(client => {
  waClient = client;
  console.log('WhatsApp Client is ready!');

  // Listen for incoming messages
  client.onMessage(async (message) => {
    // Avoid processing our own outbound messages or non-chat/group updates
    if (message.fromMe) return;
    if (message.isGroupMsg) return; // Currently direct messaging only

    console.log(`Received message from ${message.from}: ${message.body}`);

    const payload = {
      event_id: message.id,
      contact_external_id: message.from,
      content: message.body || '',
      contact_name: message.sender.pushname || message.sender.name || 'WhatsApp Contact',
      external_account_id: message.to
    };

    // Append user_id as query parameter if configured
    let webhookUrl = `${FASTAPI_URL}/api/v1/smartflow/integrations/whatsapp/webhook`;
    if (USER_ID) {
      webhookUrl += `?user_id=${USER_ID}`;
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json'
        }
      });
      console.log(`Forwarded message to FastAPI webhook: status ${response.status}`);
    } catch (error) {
      console.error('Failed to forward message to FastAPI webhook:', error.response ? error.response.data : error.message);
    }
  });
}).catch(err => {
  console.error('Error starting wa-automate client:', err);
});

// Outbound endpoint to send messages from Mabdel backend to WhatsApp users
app.post('/send-message', async (req, res) => {
  const { to, message } = req.body;

  if (!waClient) {
    return res.status(503).json({ error: 'WhatsApp client is not ready yet' });
  }

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message parameter' });
  }

  try {
    const result = await waClient.sendText(to, message);
    console.log(`Message sent to ${to}: ${message}`);
    return res.json({ success: true, messageId: result });
  } catch (error) {
    console.error(`Failed to send message to ${to}:`, error);
    return res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clientReady: !!waClient
  });
});

app.listen(PORT, () => {
  console.log(`WhatsApp Local Gateway API listening on port ${PORT}`);
});
