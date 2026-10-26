import React from 'react';
import { VoiceContext } from './VoiceContext';
const unsupported = async () => { throw new Error('In-app calling requires the Android or iOS development build. Use the web dashboard for browser calling.'); };
export default function VoiceProvider({ children }) {
  return <VoiceContext.Provider value={{ status: 'UNAVAILABLE', error: 'Native calling is available in the installed mobile build.', call: null, dial: unsupported, answer: unsupported, hangup: unsupported, toggleMute: unsupported, toggleHold: unsupported, reconnect: unsupported }}>{children}</VoiceContext.Provider>;
}
