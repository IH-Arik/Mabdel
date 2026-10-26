import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useNativeVoice } from './VoiceContext';
export default function VoiceStatus() {
  const voice = useNativeVoice();
  return <View style={{ marginVertical: 10, gap: 6 }}>
    <Text style={{ color: voice.status === 'CONNECTED' ? '#34D399' : '#ABB9CA' }}>In-app calling: {voice.status.toLowerCase()}</Text>
    {!!voice.error && <Text style={{ color: '#FCA5A5' }}>{voice.error}</Text>}
    {voice.status !== 'CONNECTED' && <Pressable accessibilityRole="button" onPress={() => voice.reconnect().catch((error) => Alert.alert('Calling', error.message))}><Text style={{ color: '#22D3EE' }}>Reconnect calling</Text></Pressable>}
  </View>;
}
