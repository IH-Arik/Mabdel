const test = require('node:test');
const assert = require('node:assert/strict');
const plugin = require('../plugins/withTelnyxVoice');
const { VoiceController } = require('../src/voice/VoiceController.cjs');

test('native plugin targets Expo Android and registers native call actions', () => {
  const activity = plugin.patchMainActivity('import com.facebook.react.ReactActivity\nclass MainActivity : ReactActivity()');
  assert.match(activity, /TelnyxMainActivity/);
  const service = plugin.messagingService('com.example.app');
  assert.match(service, /TelnyxFirebaseMessagingService/);
  assert.match(service, /FirebaseMessagingDelegate/);
  const receiver = plugin.notificationActionReceiver('com.example.app');
  assert.match(receiver, /TelnyxNotificationActionReceiver/);
  assert.match(receiver, /AppTelnyxNotificationActionReceiver/);
  const appGradle = plugin.patchAppBuildGradle('dependencies {\n    implementation("com.facebook.react:react-android")\n}');
  assert.match(appGradle, /firebase-messaging:24\.0\.1/);
  assert.equal(plugin.patchAppBuildGradle(appGradle), appGradle);
});

test('token refresh reconnect keeps incoming-call push registration enabled', async () => {
  let disabledPush = 0;
  let logins = 0;
  const stream = { subscribe: () => ({ unsubscribe() {} }) };
  const client = {
    connectionState$: stream,
    activeCall$: stream,
    currentConnectionState: 'CONNECTED',
    currentActiveCall: null,
    loginWithToken: async () => { logins += 1; },
    logout: async () => {},
    disablePushNotifications: () => { disabledPush += 1; },
  };
  const controller = new VoiceController({
    client,
    getToken: async () => ({ token: 'short-lived', identity: 'device-1', refresh_after_seconds: 3600 }),
    register: async () => {},
    permission: async () => true,
    tokenConfig: (token) => ({ token }),
    launchedFromPush: async () => false,
    clearStoredConfig: async () => {},
  });
  await controller.start();
  await controller.reconnect();
  assert.equal(logins, 2);
  assert.equal(disabledPush, 0);
  await controller.stop();
  assert.equal(disabledPush, 1);
});

test('outbound dialing validates international number and microphone permission', async () => {
  let permission = false;
  const controller = new VoiceController({
    client: {}, getToken: async () => ({}), register: async () => {},
    permission: async () => permission, tokenConfig: (token) => token,
    launchedFromPush: async () => false, clearStoredConfig: async () => {},
  });
  controller.publish({ status: 'CONNECTED' });
  await assert.rejects(controller.dial('2025550123'), /country code/);
  await assert.rejects(controller.dial('+12025550123'), /Microphone permission/);
});
