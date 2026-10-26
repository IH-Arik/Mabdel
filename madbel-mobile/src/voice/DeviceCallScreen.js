import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNativeVoice } from './VoiceContext';

export default function DeviceCallScreen({ navigation, route }) {
  const voice = useNativeVoice();
  const [busy, setBusy] = useState(false);
  const id = route.params?.nativeCallId;
  const current = voice.call?.id === id ? voice.call : null;
  const ringing = current?.incoming && voice.state === 'RINGING';
  const active = voice.state === 'ACTIVE' || voice.state === 'HELD';
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (error) { Alert.alert('Call action failed', error.message); }
    finally { setBusy(false); }
  };
  const time = `${Math.floor((voice.duration || 0) / 60).toString().padStart(2, '0')}:${((voice.duration || 0) % 60).toString().padStart(2, '0')}`;
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.heading}>{current?.name || route.params?.callerName || 'Phone call'}</Text>
    <Text style={styles.secondary}>{current?.number || route.params?.callerNumber || ''}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{current ? (ringing ? 'Incoming call' : voice.state === 'ACTIVE' ? 'Connected on this device' : voice.state) : 'Call ended'}</Text>
    {active && current && <Text style={styles.timer}>{time}</Text>}
    {!!voice.error && <Text style={styles.error}>{voice.error}</Text>}
    {current ? <View style={styles.buttons}>
      {ringing && <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, styles.answer]} onPress={() => run(() => voice.answer(id))}><Text style={styles.label}>Answer</Text></Pressable>}
      {active && <>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => run(() => voice.toggleMute(id))}><Text style={styles.label}>{voice.muted ? 'Unmute' : 'Mute'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => run(() => voice.toggleHold(id))}><Text style={styles.label}>{voice.held ? 'Resume' : 'Hold'}</Text></Pressable>
      </>}
      <Pressable accessibilityRole="button" disabled={busy} style={[styles.button, styles.end]} onPress={() => run(() => voice.hangup(id))}><Text style={styles.label}>{ringing ? 'Decline' : 'End call'}</Text></Pressable>
    </View> : <Pressable accessibilityRole="button" style={styles.button} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('BottomNavigator')}><Text style={styles.label}>Close</Text></Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#090D15', padding: 28, alignItems: 'center', justifyContent: 'center', gap: 20 },
  heading: { color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center' },
  secondary: { color: '#B8C6D5', fontSize: 18 }, status: { color: '#29D9EC', fontSize: 18 },
  timer: { color: '#fff', fontSize: 34 }, error: { color: '#FFA5A5', textAlign: 'center' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  button: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 24, backgroundColor: '#27344B' },
  answer: { backgroundColor: '#167A45' }, end: { backgroundColor: '#AF2334' }, label: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
