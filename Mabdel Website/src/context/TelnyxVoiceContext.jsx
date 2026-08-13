import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';

const TelnyxVoiceContext = createContext(null);

// Telnyx's Call object has no per-call event emitter (unlike Twilio's Call) — every
// state transition, for every call, arrives on the client's single 'telnyx.notification'
// stream instead. call.state is one of these labels (case varies by SDK version, hence
// the .toLowerCase() everywhere below rather than trusting exact casing).
const TERMINAL_STATES = new Set(['hangup', 'destroy', 'purge']);
const CONNECTED_STATES = new Set(['active']);
const RINGING_STATES = new Set(['new', 'requesting', 'trying', 'ringing']);

function normalizeState(call) {
  return String(call?.state || '').toLowerCase();
}

function normalizePhone(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const compact = trimmed.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  if (/^\d{10,15}$/.test(compact)) return `+${compact}`;
  return trimmed;
}

function getCallId(call) {
  return call?.telnyxIDs?.telnyxCallControlId || call?.id || '';
}

function getCallerName(call) {
  return call?.options?.remoteCallerName || call?.options?.callerName || call?.options?.destinationNumber || 'Unknown Caller';
}

function getCallerNumber(call) {
  return call?.options?.remoteCallerNumber || call?.options?.destinationNumber || '';
}

function encodeClientState(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch {
    return '';
  }
}

function emitCallSync(detail) {
  window.dispatchEvent(new CustomEvent('mabdel:calls-sync', { detail }));
}

function setAudioVolume(volume) {
  const audioEls = document.querySelectorAll('audio');
  audioEls.forEach((element) => {
    try {
      element.volume = volume;
    } catch {
      // ignore browser-managed media elements
    }
  });
}

export function TelnyxVoiceProvider({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  const clientRef = useRef(null);
  const identityRef = useRef('');
  const heartbeatRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const transcriptPollRef = useRef(null);
  const durationSecondsRef = useRef(0);
  const currentCallRef = useRef(null);
  const finalizedCallIdsRef = useRef(new Set());
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [currentCallSid, setCurrentCallSid] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcriptSegments, setTranscriptSegments] = useState([]);
  const [callStatusText, setCallStatusText] = useState('Ready');

  const clearHeartbeat = () => {
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const clearTranscriptPoll = () => {
    if (transcriptPollRef.current) {
      window.clearInterval(transcriptPollRef.current);
      transcriptPollRef.current = null;
    }
  };

  const resetActiveCallState = useCallback(() => {
    currentCallRef.current = null;
    setCurrentCall(null);
    setCurrentCallSid('');
    setIsMuted(false);
    setDurationSeconds(0);
    durationSecondsRef.current = 0;
    setTranscriptSegments([]);
    clearTranscriptPoll();
  }, []);

  const pushRegistration = useCallback(
    async (active, nextIdentity = '') => {
      const resolvedIdentity = nextIdentity || identityRef.current;
      if (!resolvedIdentity || !isAuthenticated) return;
      try {
        await smartflowApi.setTelnyxVoiceRegistration({ identity: resolvedIdentity, active });
      } catch {
        // best-effort heartbeat
      }
    },
    [isAuthenticated]
  );

  const fetchTranscript = useCallback(async (callSid) => {
    if (!callSid) return;
    try {
      const response = await smartflowApi.getLiveCallTranscriptBySid(callSid);
      const segments = response?.data?.data?.speaker_segments || [];
      setTranscriptSegments(Array.isArray(segments) ? segments : []);
    } catch {
      // keep UI quiet while transcript source catches up
    }
  }, []);

  useEffect(() => {
    if (!currentCallSid) {
      clearTranscriptPoll();
      return undefined;
    }

    fetchTranscript(currentCallSid);
    transcriptPollRef.current = window.setInterval(() => fetchTranscript(currentCallSid), 2000);
    return () => clearTranscriptPoll();
  }, [currentCallSid, fetchTranscript]);

  useEffect(() => {
    if (!currentCall) return undefined;
    const timer = window.setInterval(() => {
      setDurationSeconds((value) => {
        const next = value + 1;
        durationSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentCall]);

  const finalizeCall = useCallback(
    (call, statusText) => {
      const callId = getCallId(call);
      if (callId) finalizedCallIdsRef.current.add(callId);
      setIncomingCall(null);
      setCallStatusText(statusText);
      resetActiveCallState();
      emitCallSync({ type: 'call_ended', callSid: callId });
    },
    [resetActiveCallState]
  );

  const handleNotification = useCallback(
    (notification) => {
      if (notification?.type !== 'callUpdate' || !notification.call) return;
      const call = notification.call;
      const callId = getCallId(call);
      const state = normalizeState(call);
      if (!callId || finalizedCallIdsRef.current.has(callId)) return;

      if (TERMINAL_STATES.has(state)) {
        finalizeCall(call, 'Call ended');
        return;
      }

      if (RINGING_STATES.has(state) && call.direction === 'inbound') {
        if (!currentCallRef.current && getCallId(incomingCall) !== callId) {
          setIncomingCall(call);
          setCurrentCallSid(callId);
          setCallStatusText('Incoming call');
        }
        return;
      }

      if (CONNECTED_STATES.has(state)) {
        currentCallRef.current = call;
        setIncomingCall(null);
        setCurrentCall(call);
        setCurrentCallSid(callId);
        setCallStatusText('Connected');
        durationSecondsRef.current = 0;
        setDurationSeconds(0);
        emitCallSync({ type: 'call_connected', callSid: callId });
      }
    },
    [finalizeCall, incomingCall]
  );

  const scheduleRefresh = useCallback((delaySeconds) => {
    clearRefreshTimer();
    const delayMs = Math.max(60, delaySeconds || 0) * 1000;
    refreshTimerRef.current = window.setTimeout(() => {
      // Never swap the socket out from under a live call — check back shortly instead.
      if (currentCallRef.current) {
        refreshTimerRef.current = window.setTimeout(() => scheduleRefresh(300), 300000);
        return;
      }
      initClient();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, delayMs);
  }, []);

  const initClient = useCallback(async () => {
    if (!isAuthenticated) return;
    setStatus('connecting');
    setError('');
    try {
      const response = await smartflowApi.getTelnyxVoiceToken();
      const payload = response?.data?.data || {};
      if (!payload.token) {
        throw new Error('Voice token not returned.');
      }

      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch {
          // noop
        }
      }

      const client = new TelnyxRTC({ login_token: payload.token });

      client.on('telnyx.ready', () => {
        setStatus('ready');
        setCallStatusText('Ready');
        setError('');
      });

      client.on('telnyx.socket.close', () => {
        setStatus('offline');
      });

      client.on('telnyx.error', (event) => {
        setError(event?.error?.message || event?.message || 'Telnyx voice error.');
        setStatus('error');
      });

      client.on('telnyx.notification', handleNotification);

      clientRef.current = client;
      identityRef.current = payload.identity || '';
      setIdentity(payload.identity || '');

      client.connect();
      await pushRegistration(true, payload.identity || '');
      clearHeartbeat();
      heartbeatRef.current = window.setInterval(() => pushRegistration(true), 60000);
      scheduleRefresh(payload.refresh_after_seconds || 20 * 60 * 60);
    } catch (initError) {
      setStatus('error');
      setError(initError?.response?.data?.message || initError?.message || 'Voice runtime could not start.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, pushRegistration, handleNotification, scheduleRefresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearHeartbeat();
      clearRefreshTimer();
      clearTranscriptPoll();
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch {
          // ignore teardown issues
        }
        clientRef.current = null;
      }
      resetActiveCallState();
      setIncomingCall(null);
      setStatus('idle');
      setError('');
      identityRef.current = '';
      setIdentity('');
      return undefined;
    }

    let cancelled = false;
    if (!cancelled) initClient();

    return () => {
      cancelled = true;
      clearHeartbeat();
      clearRefreshTimer();
      clearTranscriptPoll();
      if (clientRef.current) {
        try {
          clientRef.current.disconnect();
        } catch {
          // noop
        }
        clientRef.current = null;
      }
      if (identityRef.current) {
        smartflowApi.setTelnyxVoiceRegistration({ identity: identityRef.current, active: false }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const startOutboundCall = useCallback(
    async ({ phoneNumber, displayName }) => {
      const normalized = normalizePhone(phoneNumber);
      if (!normalized || !/^\+\d{10,15}$/.test(normalized)) {
        throw new Error('Enter a valid international phone number.');
      }
      if (!clientRef.current) {
        throw new Error('Voice device is not ready yet.');
      }
      setStatus('calling');
      setCallStatusText('Connecting call');
      const call = clientRef.current.newCall({
        destinationNumber: normalized,
        callerName: displayName || normalized,
        clientState: encodeClientState({
          user_id: user?._id || user?.id || '',
          display_name: displayName || normalized,
        }),
      });
      currentCallRef.current = call;
      setCurrentCall(call);
      setCurrentCallSid(getCallId(call));
      emitCallSync({ type: 'outbound_started', phoneNumber: normalized });
      return call;
    },
    [user]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    setCallStatusText('Connecting call');
    currentCallRef.current = incomingCall;
    setCurrentCall(incomingCall);
    incomingCall.answer();
  }, [incomingCall]);

  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const callId = getCallId(incomingCall);
    incomingCall.hangup();
    setIncomingCall(null);
    setCallStatusText('Call rejected');
    emitCallSync({ type: 'incoming_rejected', callSid: callId });
  }, [incomingCall]);

  const endCurrentCall = useCallback(async () => {
    if (currentCall) {
      currentCall.hangup();
      return;
    }
    if (incomingCall) {
      incomingCall.hangup();
      setIncomingCall(null);
    }
  }, [currentCall, incomingCall]);

  const toggleMute = useCallback(() => {
    if (!currentCall) return;
    const nextMuted = !isMuted;
    if (nextMuted) currentCall.muteAudio();
    else currentCall.unmuteAudio();
    setIsMuted(nextMuted);
  }, [currentCall, isMuted]);

  const toggleSpeaker = useCallback(() => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    setAudioVolume(nextState ? 1 : 0);
  }, [isSpeakerOn]);

  const refreshToken = useCallback(() => initClient(), [initClient]);

  const value = useMemo(
    () => ({
      status,
      error,
      identity,
      isReady: status === 'ready' || status === 'calling',
      incomingCall,
      currentCall,
      currentCallSid,
      currentCallerName: getCallerName(currentCall || incomingCall),
      currentCallerNumber: getCallerNumber(currentCall || incomingCall),
      isMuted,
      isSpeakerOn,
      durationSeconds,
      transcriptSegments,
      callStatusText,
      startOutboundCall,
      acceptIncomingCall,
      rejectIncomingCall,
      endCurrentCall,
      toggleMute,
      toggleSpeaker,
      refreshToken,
    }),
    [
      status,
      error,
      identity,
      incomingCall,
      currentCall,
      currentCallSid,
      isMuted,
      isSpeakerOn,
      durationSeconds,
      transcriptSegments,
      callStatusText,
      startOutboundCall,
      acceptIncomingCall,
      rejectIncomingCall,
      endCurrentCall,
      toggleMute,
      toggleSpeaker,
      refreshToken,
    ]
  );

  return <TelnyxVoiceContext.Provider value={value}>{children}</TelnyxVoiceContext.Provider>;
}

export function useTelnyxVoice() {
  const context = useContext(TelnyxVoiceContext);
  if (!context) {
    throw new Error('useTelnyxVoice must be used within TelnyxVoiceProvider.');
  }
  return context;
}
