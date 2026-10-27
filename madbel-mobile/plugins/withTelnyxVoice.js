const { withAndroidManifest, withMainActivity, withAppDelegate, withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

function patchMainActivity(source) {
  if (source.includes('class MainActivity : TelnyxMainActivity()')) return source;
  if (!source.includes('class MainActivity : ReactActivity()')) throw new Error('Telnyx voice plugin expects the Expo Kotlin MainActivity template.');
  return source.replace('import com.facebook.react.ReactActivity\n', 'import com.telnyx.react_voice_commons.TelnyxMainActivity\n')
    .replace('class MainActivity : ReactActivity()', 'class MainActivity : TelnyxMainActivity()');
}

function patchAppDelegate(source) {
  if (source.includes('// madbel-telnyx-pushkit')) return source;
  if (!source.includes('ExpoAppDelegate') || !source.includes('return super.application(application, didFinishLaunchingWithOptions: launchOptions)')) throw new Error('Telnyx voice plugin expects the Expo Swift AppDelegate template.');
  source = 'import PushKit\nimport TelnyxVoiceCommons\n' + source;
  source = source.replace(': ExpoAppDelegate {', ': ExpoAppDelegate, PKPushRegistryDelegate {');
  source = source.replace('return super.application(application, didFinishLaunchingWithOptions: launchOptions)', 'TelnyxVoipPushHandler.initializeVoipRegistration()\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)');
  return source + `
// madbel-telnyx-pushkit
extension AppDelegate {
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    TelnyxVoipPushHandler.shared.handleVoipTokenUpdate(pushCredentials, type: type)
  }
  public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    TelnyxVoipPushHandler.shared.handleVoipPush(payload, type: type, completion: completion)
  }
}
`;
}

function messagingService(packageName) {
  // One FCM receiver handles Telnyx media pushes. Preserve ordinary Expo
  // notifications through Expo's published native messaging delegate.
  return `package ${packageName}
import com.google.firebase.messaging.RemoteMessage
import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService
import expo.modules.notifications.service.delegates.FirebaseMessagingDelegate

class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {
  private val expoDelegate by lazy { FirebaseMessagingDelegate(this) }
  override fun handleNonTelnyxMessage(remoteMessage: RemoteMessage) {
    expoDelegate.onMessageReceived(remoteMessage)
  }
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    expoDelegate.onNewToken(token)
  }
  override fun onDeletedMessages() {
    super.onDeletedMessages()
    expoDelegate.onDeletedMessages()
  }
}

`;
}

function notificationActionReceiver(packageName) {
  return `package ${packageName}\n\nimport com.telnyx.react_voice_commons.TelnyxNotificationActionReceiver\n\nclass AppTelnyxNotificationActionReceiver : TelnyxNotificationActionReceiver()\n`;
}

function patchAppBuildGradle(source) {
  const dependency = 'implementation "com.google.firebase:firebase-messaging:24.0.1"';
  if (source.includes(dependency)) return source;
  if (!/dependencies\s*\{/.test(source)) throw new Error('Telnyx voice plugin could not find the Android app dependencies block.');
  return source.replace(/dependencies\s*\{/, (block) => `${block}\n    ${dependency}`);
}

function withTelnyxVoice(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];
    const serviceName = '.AppFirebaseMessagingService';
    const expoService = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';
    const services = application.service || [];
    application.service = services.filter((item) => ![serviceName, expoService].includes(item.$['android:name']));
    // Expo's receiver is merged from its library manifest; remove it explicitly
    // so Android cannot choose an arbitrary competing MESSAGING_EVENT service.
    mod.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    application.service.push({ $: { 'android:name': expoService, 'tools:node': 'remove' } });
    application.service.push({ $: { 'android:name': serviceName, 'android:exported': 'false' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }] });
    application.receiver = application.receiver || [];
    application.receiver = application.receiver.filter((item) => item.$['android:name'] !== '.AppTelnyxNotificationActionReceiver');
    application.receiver.push({ $: { 'android:name': '.AppTelnyxNotificationActionReceiver', 'android:exported': 'false' }, 'intent-filter': [{ action: [
      { $: { 'android:name': 'ANSWER_CALL' } },
      { $: { 'android:name': 'REJECT_CALL' } },
    ] }] });
    const activity = application.activity.find((item) => item.$['android:name'] === '.MainActivity');
    if (activity) Object.assign(activity.$, { 'android:showWhenLocked': 'true', 'android:turnScreenOn': 'true' });
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    mod.modResults.contents = patchMainActivity(mod.modResults.contents);
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Telnyx voice plugin expects the Expo Groovy app build file.');
    mod.modResults.contents = patchAppBuildGradle(mod.modResults.contents);
    return mod;
  });
  config = withDangerousMod(config, ['android', async (mod) => {
    const packageName = mod.android.package;
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java', ...packageName.split('.'));
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'AppFirebaseMessagingService.kt'), messagingService(packageName));
    await fs.writeFile(path.join(directory, 'AppTelnyxNotificationActionReceiver.kt'), notificationActionReceiver(packageName));
    return mod;
  }]);
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') throw new Error('Telnyx voice requires a Swift Expo AppDelegate.');
    mod.modResults.contents = patchAppDelegate(mod.modResults.contents);
    return mod;
  });
}

module.exports = withTelnyxVoice;
module.exports.patchMainActivity = patchMainActivity;
module.exports.patchAppDelegate = patchAppDelegate;
module.exports.messagingService = messagingService;
module.exports.notificationActionReceiver = notificationActionReceiver;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
