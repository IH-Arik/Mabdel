const test = require('node:test');
const assert = require('node:assert/strict');

const { describeMessage, toPayload, toContactPayload, rememberLidMappings } = require('./gateway');

const entry = () => ({ linkedNumber: '8801700000000', lidToPn: new Map() });
const msg = (message, key = {}) => ({
  key: { id: 'ID1', remoteJid: '8801711111111@s.whatsapp.net', fromMe: false, ...key },
  message,
  messageTimestamp: 1750000000,
  pushName: 'Karim',
});

test('plain and extended text', () => {
  assert.equal(describeMessage(msg({ conversation: 'hello' })), 'hello');
  assert.equal(describeMessage(msg({ extendedTextMessage: { text: 'link https://x.y' } })), 'link https://x.y');
});

test('disappearing and view-once envelopes are unwrapped', () => {
  assert.equal(describeMessage(msg({ ephemeralMessage: { message: { conversation: 'secret' } } })), 'secret');
  assert.equal(
    describeMessage(msg({ viewOnceMessageV2: { message: { imageMessage: { caption: 'look' } } } })),
    '[Image] look',
  );
  assert.equal(
    describeMessage(msg({ documentWithCaptionMessage: { message: { documentMessage: { fileName: 'quote.pdf', caption: 'price' } } } })),
    '[Document] quote.pdf\nprice',
  );
});

test('media placeholders, voice notes and polls', () => {
  assert.equal(describeMessage(msg({ audioMessage: { ptt: true } })), '[Voice message]');
  assert.equal(describeMessage(msg({ audioMessage: {} })), '[Audio]');
  assert.equal(describeMessage(msg({ stickerMessage: {} })), '[Sticker]');
  assert.equal(describeMessage(msg({ pollCreationMessageV3: { name: 'Lunch?' } })), '[Poll] Lunch?');
});

test('reactions, edits/deletes and key exchange are not chat messages', () => {
  assert.equal(describeMessage(msg({ reactionMessage: { text: '👍' } })), null);
  assert.equal(describeMessage(msg({ protocolMessage: { type: 0 } })), null);
  assert.equal(describeMessage(msg({ senderKeyDistributionMessage: {} })), null);
  assert.equal(describeMessage(msg(undefined)), null);
});

test('groups, Status, broadcast lists and Channels are skipped', () => {
  for (const remoteJid of ['123-456@g.us', 'status@broadcast', '999@broadcast', '120363@newsletter']) {
    assert.equal(toPayload(entry(), msg({ conversation: 'x' }, { remoteJid })), null, remoteJid);
  }
});

test('a message sent from the phone is outbound and never names the customer after us', () => {
  const payload = toPayload(entry(), { ...msg({ conversation: 'on my way' }, { fromMe: true }), pushName: 'Our Shop' });
  assert.equal(payload.direction, 'outbound');
  assert.equal(payload.contact_name, null);
  assert.equal(payload.contact_external_id, '8801711111111@s.whatsapp.net');
  assert.equal(payload.timestamp, new Date(1750000000 * 1000).toISOString());
});

test('@lid chats resolve to the phone number when WhatsApp tells us one', () => {
  const viaKey = toPayload(entry(), msg({ conversation: 'hi' }, { remoteJid: '1234567@lid', senderPn: '8801722222222@s.whatsapp.net' }));
  assert.equal(viaKey.contact_external_id, '8801722222222@s.whatsapp.net');

  const e = entry();
  rememberLidMappings(e, [{ id: '7654321@lid', jid: '8801733333333@s.whatsapp.net' }]);
  assert.equal(toPayload(e, msg({ conversation: 'hi' }, { remoteJid: '7654321@lid' })).contact_external_id, '8801733333333@s.whatsapp.net');

  assert.equal(toPayload(entry(), msg({ conversation: 'hi' }, { remoteJid: '5555@lid' })).contact_external_id, '5555@lid');
});

test('contact names come from the address book or the profile', () => {
  assert.deepEqual(toContactPayload(entry(), { id: '8801744444444@s.whatsapp.net', notify: 'Nadia' }), {
    phone_jid: '8801744444444@s.whatsapp.net',
    lid: null,
    name: 'Nadia',
  });
  assert.equal(toContactPayload(entry(), { id: '8801744444444@s.whatsapp.net' }), null);
  assert.equal(toContactPayload(entry(), { id: '123-456@g.us', name: 'Family' }), null);
});
