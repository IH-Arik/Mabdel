import { createContext, useContext } from 'react';

export const VoiceContext = createContext(null);
export const useNativeVoice = () => {
  const value = useContext(VoiceContext);
  if (!value) throw new Error('Native voice provider is not mounted.');
  return value;
};
