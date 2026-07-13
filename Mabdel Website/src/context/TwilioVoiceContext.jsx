import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';

const TwilioVoiceContext = createContext(null);

function normalizePhone(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const compact = trimmed.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  if (/^\d{10,15}$/.test(compact)) return `+${compact}`;
  return trimmed;
}

function getCallSid(call) {
  return (
    call?.parameters?.CallSid ||
    call?.customParameters?.get?.('CallSid') ||
    call?.customParameters?.get?.('call_sid') ||
    ''
  );
}

function getCallerName(call) {
  return (
    call?.customParameters?.get?.('display_name') ||
    call?.parameters?.CallerName ||
    call?.parameters?.From ||
    'Unknown Caller'
  );
}

function getCallerNumber(call) {
  return (
    call?.parameters?.From ||
    call?.customParameters?.get?.('phone_number') ||
    call?.customParameters?.get?.('destination') ||
    ''
  );
}

function getSyncDirection(mode) {
  return mode === 'incoming' ? 'incoming' : 'outbound';
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

export function TwilioVoiceProvider({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  const deviceRef = useRef(null);
  const identityRef = useRef('');
  const heartbeatRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const transcriptPollRef = useRef(null);
  const durationSecondsRef = useRef(0);
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
        await smartflowApi.setTwilioVoiceRegistration({ identity: resolvedIdentity, active });
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

  const wireCall = useCallback(
    (call, mode = 'outbound') => {
      if (!call || call.__mabdelWired) return;
      call.__mabdelWired = true;

      call.on('accept', () => {
        setIncomingCall(null);
        setCurrentCall(call);
        setCurrentCallSid(getCallSid(call));
        setCallStatusText('Connected');
        durationSecondsRef.current = 0;
        setDurationSeconds(0);
        smartflowApi.syncTwilioVoiceSession({
          call_sid: getCallSid(call),
          status: 'connected',
          direction: getSyncDirection(mode),
          phone_number: getCallerNumber(call),
          contact_name: getCallerName(call),
        }).catch(() => {});
        emitCallSync({ type: `${mode}_accepted`, callSid: getCallSid(call) });
      });

      call.on('disconnect', () => {
        setIncomingCall(null);
        setCallStatusText('Call ended');
        smartflowApi.syncTwilioVoiceSession({
          call_sid: getCallSid(call),
          status: 'completed',
          direction: getSyncDirection(mode),
          phone_number: getCallerNumber(call),
          contact_name: getCallerName(call),
          duration_seconds: durationSecondsRef.current,
        }).catch(() => {});
        resetActiveCallState();
        emitCallSync({ type: `${mode}_disconnected`, callSid: getCallSid(call) });
      });

      call.on('cancel', () => {
        setIncomingCall(null);
        setCallStatusText('Call canceled');
        smartflowApi.syncTwilioVoiceSession({
          call_sid: getCallSid(call),
          status: 'canceled',
          direction: getSyncDirection(mode),
          phone_number: getCallerNumber(call),
          contact_name: getCallerName(call),
          duration_seconds: durationSecondsRef.current,
        }).catch(() => {});
        resetActiveCallState();
        emitCallSync({ type: `${mode}_canceled`, callSid: getCallSid(call) });
      });

      call.on('reject', () => {
        setIncomingCall(null);
        setCallStatusText('Call rejected');
        smartflowApi.syncTwilioVoiceSession({
          call_sid: getCallSid(call),
          status: 'rejected',
          direction: getSyncDirection(mode),
          phone_number: getCallerNumber(call),
          contact_name: getCallerName(call),
          duration_seconds: durationSecondsRef.current,
        }).catch(() => {});
        resetActiveCallState();
        emitCallSync({ type: `${mode}_rejected`, callSid: getCallSid(call) });
      });

      call.on('error', (callError) => {
        setError(callError?.message || 'Call failed.');
        setCallStatusText('Call failed');
        emitCallSync({ type: `${mode}_error`, callSid: getCallSid(call), message: callError?.message });
      });
    },
    [resetActiveCallState]
  );

  const refreshToken = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await smartflowApi.getTwilioVoiceToken();
      const payload = response?.data?.data || {};
      if (!payload.token || !deviceRef.current) return;
      deviceRef.current.updateToken(payload.token);
      identityRef.current = payload.identity || '';
      setIdentity(payload.identity || '');
      pushRegistration(true, payload.identity || '');
      clearRefreshTimer();
      refreshTimerRef.current = window.setTimeout(refreshToken, 45 * 60 * 1000);
    } catch (refreshError) {
      setError(refreshError?.response?.data?.message || 'Voice token refresh failed.');
    }
  }, [isAuthenticated, pushRegistration]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearHeartbeat();
      clearRefreshTimer();
      clearTranscriptPoll();
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          // ignore teardown issues
        }
        deviceRef.current = null;
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

    async function init() {
      setStatus('connecting');
      setError('');
      try {
        const response = await smartflowApi.getTwilioVoiceToken();
        if (cancelled) return;
        const payload = response?.data?.data || {};
        if (!payload.token) {
          throw new Error('Voice token not returned.');
        }

        const nextDevice = new Device(payload.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'],
          closeProtection: true,
        });

        nextDevice.on('registered', () => {
          setStatus('ready');
          setCallStatusText('Ready');
          setError('');
        });

        nextDevice.on('unregistered', () => {
          setStatus('offline');
        });

        nextDevice.on('incoming', (call) => {
          wireCall(call, 'incoming');
          setIncomingCall(call);
          setCurrentCallSid(getCallSid(call));
          setCallStatusText('Incoming call');
        });

        nextDevice.on('error', (deviceError) => {
          setError(deviceError?.message || 'Twilio device error.');
          setStatus('error');
        });

        nextDevice.on('tokenWillExpire', refreshToken);

        deviceRef.current = nextDevice;
        identityRef.current = payload.identity || '';
        setIdentity(payload.identity || '');
        await nextDevice.register();
        await smartflowApi.setTwilioVoiceRegistration({ identity: payload.identity, active: true });
        heartbeatRef.current = window.setInterval(() => {
          smartflowApi.setTwilioVoiceRegistration({ identity: payload.identity, active: true }).catch(() => {});
        }, 60000);
        refreshTimerRef.current = window.setTimeout(refreshToken, 45 * 60 * 1000);
      } catch (initError) {
        setStatus('error');
        setError(initError?.response?.data?.message || initError?.message || 'Voice runtime could not start.');
      }
    }

    init();

    return () => {
      cancelled = true;
      clearHeartbeat();
      clearRefreshTimer();
      clearTranscriptPoll();
      if (deviceRef.current) {
        try {
          deviceRef.current.unregister();
        } catch {
          // noop
        }
        try {
          deviceRef.current.destroy();
        } catch {
          // noop
        }
        deviceRef.current = null;
      }
      if (identityRef.current) {
        smartflowApi.setTwilioVoiceRegistration({ identity: identityRef.current, active: false }).catch(() => {});
      }
    };
  }, [isAuthenticated, refreshToken, resetActiveCallState, wireCall]);

  const startOutboundCall = useCallback(
    async ({ phoneNumber, displayName }) => {
      const normalized = normalizePhone(phoneNumber);
      if (!normalized || !/^\+\d{10,15}$/.test(normalized)) {
        throw new Error('Enter a valid international phone number.');
      }
      if (!deviceRef.current) {
        throw new Error('Voice device is not ready yet.');
      }
      setStatus('calling');
      setCallStatusText('Connecting call');
      const call = await deviceRef.current.connect({
        params: {
          To: normalized,
          phone_number: normalized,
          destination: normalized,
          user_id: user?._id || user?.id || '',
          display_name: displayName || normalized,
        },
      });
      wireCall(call, 'outbound');
      setCurrentCall(call);
      setCurrentCallSid(getCallSid(call));
      emitCallSync({ type: 'outbound_started', phoneNumber: normalized });
      return call;
    },
    [user, wireCall]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    setCallStatusText('Connecting call');
    setCurrentCall(incomingCall);
    incomingCall.accept();
  }, [incomingCall]);

  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
    setCallStatusText('Call rejected');
    emitCallSync({ type: 'incoming_rejected', callSid: getCallSid(incomingCall) });
  }, [incomingCall]);

  const endCurrentCall = useCallback(async () => {
    if (currentCall) {
      currentCall.disconnect();
      return;
    }
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
    }
  }, [currentCall, incomingCall]);

  const toggleMute = useCallback(() => {
    if (!currentCall) return;
    const nextMuted = !isMuted;
    currentCall.mute(nextMuted);
    setIsMuted(nextMuted);
  }, [currentCall, isMuted]);

  const toggleSpeaker = useCallback(() => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    setAudioVolume(nextState ? 1 : 0);
  }, [isSpeakerOn]);

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

  return <TwilioVoiceContext.Provider value={value}>{children}</TwilioVoiceContext.Provider>;
}

export function useTwilioVoice() {
  const context = useContext(TwilioVoiceContext);
  if (!context) {
    throw new Error('useTwilioVoice must be used within TwilioVoiceProvider.');
  }
  return context;
}
