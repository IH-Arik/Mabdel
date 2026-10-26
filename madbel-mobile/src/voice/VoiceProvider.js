import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useSelector } from 'react-redux';
import { AudioModule } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTelnyxVoipClient, createTokenConfig, TelnyxVoipClient, TelnyxVoiceApp } from '@telnyx/react-voice-commons-sdk';
import { store } from '../redux/store';
import { voiceApi } from './voiceApi';
import { VoiceContext } from './VoiceContext';
const { VoiceController } = require('./VoiceController.cjs');

const client = createTelnyxVoipClient({ enableAppStateManagement: true, debug: false });
const controller = new VoiceController({
  client,
  getToken: async () => {
    const request = store.dispatch(voiceApi.endpoints.mobileVoiceToken.initiate(undefined, { forceRefetch: true, subscribe: false }));
    const response = await request.unwrap();
    return response?.data;
  },
  register: async (body) => {
    const request = store.dispatch(voiceApi.endpoints.mobileVoiceRegistration.initiate(body));
    try { return await request.unwrap(); } finally { request.reset(); }
  },
  permission: async () => (await AudioModule.requestRecordingPermissionsAsync()).granted,
  tokenConfig: (token) => createTokenConfig(token, { debug: false, enableCallReports: false }),
  launchedFromPush: () => TelnyxVoipClient.isLaunchedFromPushNotification(),
  clearStoredConfig: () => AsyncStorage.multiRemove(['@credential_token', '@telnyx_username', '@telnyx_password', '@push_token']),
});

export default function VoiceProvider({ children, navigationRef, navigationReady }) {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.accessToken || state.auth.token);
  const userId = user?._id || user?.id || user?.userId;
  const cleanup = useRef(Promise.resolve());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);

  useEffect(() => {
    let disposed = false;
    const begin = async () => {
      await cleanup.current;
      if (!disposed && token && userId) await controller.start();
    };
    begin();
    return () => { disposed = true; cleanup.current = controller.stop({ clear: true }).catch(() => {}); };
    // Access token refreshes keep the same active SIP session.
  }, [userId, Boolean(token)]);

  useEffect(() => {
    if (!token || !userId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !controller.getSnapshot().call && !controller.pending) {
        if (Date.now() >= controller.expiresAt || client.currentConnectionState === 'ERROR') controller.reconnect().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [userId, Boolean(token)]);

  useEffect(() => {
    if (!snapshot.call || !navigationRef.current?.isReady()) return;
    const incoming = snapshot.call.incoming && snapshot.state === 'RINGING';
    const routeName = incoming ? 'IncomingCall' : 'ActiveCall';
    const current = navigationRef.current.getCurrentRoute();
    if (current?.name === routeName && current?.params?.nativeCallId === snapshot.call.id) return;
    navigationRef.current.navigate(routeName, {
      nativeCallId: snapshot.call.id,
      callerName: snapshot.call.name,
      callerNumber: snapshot.call.number,
      mode: 'native',
    });
  }, [snapshot.call?.id, snapshot.state, navigationRef, navigationReady]);

  const value = { ...snapshot, dial: (number, name) => controller.dial(number, name),
    answer: (id) => controller.control('answer', id), hangup: (id) => controller.control('hangup', id),
    toggleMute: (id) => controller.control('mute', id), toggleHold: (id) => controller.control('hold', id),
    reconnect: () => controller.reconnect() };
  const content = <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
  return token && userId ? <TelnyxVoiceApp voipClient={client} enableAutoReconnect={false} debug={false}>{content}</TelnyxVoiceApp> : content;
}
