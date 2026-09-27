import { useEffect, useRef, useState } from 'react';
import { smartflowApi } from '../../api/services';

// Whisper "hears" these in silence or background noise; never insert them as text.
const NOISE_TRANSCRIPTS = new Set(['you', 'yeah', 'ya', 'yo', 'uh', 'um', 'hmm', 'hm', 'thank you', 'thanks for watching']);

// Record from the mic, transcribe on stop, hand the text to onText. Speech to text only.
export default function useDictation({ onText, onError, t }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const toggle = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError(t('conv_err_audio_unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstart = () => {
        startedAtRef.current = Date.now();
        setRecording(true);
      };
      recorder.onstop = async () => {
        setRecording(false);
        stopStream();
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        if (durationMs < 600) {
          onError(t('conv_err_recording_too_short'));
          return;
        }
        setTranscribing(true);
        try {
          const response = await smartflowApi.transcribeDictation(blob);
          const transcript = String(response?.data?.data?.transcript || '').trim();
          if (!transcript || NOISE_TRANSCRIPTS.has(transcript.toLowerCase().replace(/[.!?]+$/, '')) || (transcript.length < 4 && durationMs < 2500)) {
            onError(t('conv_err_no_speech'));
            return;
          }
          onText(transcript);
        } catch (error) {
          onError(error?.response?.data?.message || t('conv_err_no_speech'));
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch {
      stopStream();
      onError(t('conv_err_mic_denied'));
    }
  };

  return { recording, transcribing, toggle };
}
