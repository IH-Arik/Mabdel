import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  CheckCircle2,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Send,
  Sparkles,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import {
  AI_LANGUAGE_OPTIONS,
  getFieldQuestion,
  getInitialPrompt,
  getStoredAiLanguage,
  inferVoiceWorkflowIntent,
  normalizeVoiceWorkflowTranscript,
  setStoredAiLanguage,
} from '../utils/voiceAgentConfig';
import { useLanguage } from '../context/LanguageContext';

const DESIRED_FIELDS = {
  invoice: ['client_name', 'client_email', 'items', 'due_date'],
  agreement: ['prompt', 'client_name', 'client_email', 'client_phone', 'agreement_type', 'start_date'],
  lease: ['prompt', 'tenant_name', 'tenant_email', 'tenant_phone', 'monthly_rent', 'start_date', 'end_date'],
};

const FALLBACK_VOICE = 'neutral_assistant';
const AI_CONVERSATION_STORAGE_KEY = 'voice_conversation_id';

const getApiData = (response) => response?.data?.data || response?.data || response || {};

const formatValue = (key, value, t) => {
  if (isEmptyValue(value)) return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (key === 'items') {
      return value
        .map((item) => `${item.description || t('vcon_fallback_service')} x${item.quantity || 1} @ $${item.unit_price || 0}`)
        .join(', ');
    }
    return value.join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const toMessageArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
};
const mapThreadMessageToUi = (message) => ({
  id: message?.id || message?._id,
  role: message?.direction === 'outbound' ? 'assistant' : 'user',
  text: message?.content || '',
  source: message?.direction === 'outbound' ? 'assistant' : 'user',
  timestamp: message?.timestamp || message?.created_at || message?.createdAt,
  backendId: message?.id || message?._id,
});

const humanizeField = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
};

const isEmptyValue = (value) =>
  value === undefined
  || value === null
  || value === ''
  || (Array.isArray(value) && value.length === 0);

const mergePrefill = (previous = {}, incoming = {}) => {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === undefined || value === null || value === '') continue;
    merged[key] = value;
  }
  return merged;
};

const getWorkflowLabel = (intent, t) => {
  switch (intent) {
    case 'invoice': return t('vcon_wf_invoice');
    case 'bulk_message': return t('vcon_wf_bulk_message');
    case 'calendar': return t('vcon_wf_meeting');
    case 'lease': return t('vcon_wf_lease');
    case 'agreement': return t('vcon_wf_agreement');
    default: return intent;
  }
};

const getWorkflowQuestion = (intent, fieldKey, t) =>
  getFieldQuestion(getStoredAiLanguage(), intent, fieldKey) || t('vcon_wf_fallback_question').replace('{field}', humanizeField(fieldKey));

const getWorkflowDestination = (intent, prefill = {}, t) => {
  if (intent === 'invoice') {
    return { path: '/invoices', state: { prefill, action: 'new_invoice' }, label: t('vcon_chip_create_invoice') };
  }
  if (intent === 'calendar') {
    return { path: '/calendar', state: { prefill, action: 'new_meeting' }, label: t('vcon_chip_schedule_meeting') };
  }
  if (intent === 'bulk_message') {
    return { path: '/bulk-messaging', state: { prefill, action: 'new_bulk_message' }, label: t('vcon_chip_bulk_message') };
  }
  if (intent === 'agreement') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'agreement' }, action: 'new_agreement', tab: 'agreements' },
      label: t('vcon_chip_new_agreement'),
    };
  }
  if (intent === 'lease') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'lease' }, action: 'new_lease', tab: 'leases' },
      label: t('vcon_chip_new_lease'),
    };
  }
  return null;
};

const buildConfirmationText = (intent, prefill = {}, missingFields = [], t) => {
  const label = getWorkflowLabel(intent, t);
  const previewParts = [];

  if (intent === 'invoice') {
    if (prefill.client_name) previewParts.push(`${t('vcon_lbl_client')} ${prefill.client_name}`);
    if (prefill.amount || prefill.total_amount) previewParts.push(`${t('vcon_lbl_amount')} ${prefill.amount || prefill.total_amount}`);
  }

  if (intent === 'calendar') {
    if (prefill.title) previewParts.push(`${t('vcon_lbl_title')} "${prefill.title}"`);
    if (prefill.date || prefill.starts_at) previewParts.push(`${t('vcon_lbl_date')} ${prefill.date || prefill.starts_at}`);
  }

  if (intent === 'bulk_message') {
    const recipientCount = ensureArray(prefill.recipient_emails || prefill.recipients).length;
    if (recipientCount) previewParts.push(`${recipientCount} ${t('vcon_lbl_recipients')}`);
    if (prefill.subject) previewParts.push(`${t('vcon_lbl_subject')} "${prefill.subject}"`);
  }

  if (intent === 'agreement') {
    if (prefill.client_name) previewParts.push(`${t('vcon_lbl_client')} ${prefill.client_name}`);
    if (prefill.title) previewParts.push(`${t('vcon_lbl_title')} "${prefill.title}"`);
  }

  if (intent === 'lease') {
    if (prefill.tenant_name) previewParts.push(`${t('vcon_lbl_tenant')} ${prefill.tenant_name}`);
    if (prefill.monthly_rent || prefill.rent) previewParts.push(`${t('vcon_lbl_rent')} ${prefill.monthly_rent || prefill.rent}`);
  }

  if (missingFields.length) {
    return getWorkflowQuestion(intent, missingFields[0], t);
  }

  if (previewParts.length) {
    return t('vcon_wf_prepared_confirm', { label, preview: previewParts.join(', ') });
  }

  return t('vcon_wf_prepared_simple', { label });
};

const buildAudioSrc = (audioPayload) => {
  if (!audioPayload?.audio_base64) return null;
  return `data:${audioPayload.mime_type || 'audio/wav'};base64,${audioPayload.audio_base64}`;
};

export default function VoiceConversation() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const bottomRef = useRef(null);
  const transcriptRef = useRef('');
  const consumedStateRef = useRef({ initialVoiceResult: null, replayResult: null, autoStart: false });

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [permissionState, setPermissionState] = useState('idle');
  const [micError, setMicError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(FALLBACK_VOICE);
  const [aiLanguage, setAiLanguage] = useState(() => getStoredAiLanguage());
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [workflowBusy] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AI_CONVERSATION_STORAGE_KEY);
  });

  const actionChips = useMemo(() => [
    { id: 'create_invoice', label: t('vcon_chip_create_invoice'), path: '/invoices', state: { prefill: {}, action: 'new_invoice' }, icon: FileText },
    { id: 'bulk_message', label: t('vcon_chip_bulk_message'), path: '/bulk-messaging', state: { prefill: {}, action: 'new_bulk_message' }, icon: MessageSquare },
    { id: 'schedule_meeting', label: t('vcon_chip_schedule_meeting'), path: '/calendar', state: { prefill: {}, action: 'new_meeting' }, icon: Calendar },
    { id: 'new_lease', label: t('vcon_chip_new_lease'), path: '/documents', state: { tab: 'leases', prefill: { type: 'lease' }, action: 'new_lease' }, icon: FileText },
    { id: 'new_agreement', label: t('vcon_chip_new_agreement'), path: '/documents', state: { prefill: { type: 'agreement' }, action: 'new_agreement' }, icon: FileText },
    { id: 'history', label: t('vcon_chip_history'), path: '/profile?tab=voice', state: null, icon: History },
  ], [t]);

  const promptButtons = useMemo(() => [
    t('vcon_prompt_read_messages'),
    t('vcon_prompt_create_invoice'),
    t('vcon_prompt_schedule'),
  ], [t]);

  const pushMessage = useCallback((message) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, ...message }]);
  }, []);

  const persistConversationId = useCallback((value) => {
    setConversationId(value || null);
    if (typeof window === 'undefined') return;
    if (value) window.localStorage.setItem(AI_CONVERSATION_STORAGE_KEY, value);
    else window.localStorage.removeItem(AI_CONVERSATION_STORAGE_KEY);
  }, []);

  const playVoice = useCallback((text, audioPayload) => {
    const audioSrc = buildAudioSrc(audioPayload);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      audio.play().catch(() => {});
      return;
    }

    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = aiLanguage;
      window.speechSynthesis.speak(utterance);
    }
  }, [aiLanguage]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
    transcriptRef.current = '';
  }, []);

  const executeWorkflow = useCallback(async () => {
    if (!activeWorkflow?.intent || workflowBusy) return;

    const destination = getWorkflowDestination(activeWorkflow.intent, activeWorkflow.prefill, t);
    if (!destination) {
      pushMessage({ role: 'assistant', text: t('vcon_err_workflow_prep'), tone: 'error' });
      return;
    }

    pushMessage({
      role: 'assistant',
      text: t('vcon_opening_form', { label: destination.label }),
      tone: 'success',
      action: {
        label: t('vcon_btn_open_form', { label: destination.label }),
        onClick: () => navigate(destination.path, { state: destination.state }),
      },
    });
    setActiveWorkflow(null);
    navigate(destination.path, { state: destination.state });
  }, [activeWorkflow, navigate, pushMessage, t, workflowBusy]);

  const handleWorkflowPrefill = useCallback(
    async (text) => {
      const normalizedText = normalizeVoiceWorkflowTranscript(text);
      const response = await smartflowApi.getAIWorkflowPrefill(normalizedText, {
        workflow_intent: activeWorkflow?.missingFields?.length ? activeWorkflow.intent : undefined,
        current_values: activeWorkflow?.missingFields?.length ? activeWorkflow.prefill || {} : {},
      });
      const data = getApiData(response);
      const intent = data?.workflow?.intent || inferVoiceWorkflowIntent(normalizedText);

      if (!intent || intent === 'unknown') {
        return null;
      }

      const mergedPrefill = mergePrefill(activeWorkflow?.prefill, data.prefill);
      const backendMissing = Array.isArray(data.missing_fields) ? data.missing_fields : [];
      const desiredMissing = (DESIRED_FIELDS[intent] || []).filter((fieldKey) => isEmptyValue(mergedPrefill[fieldKey]));
      const missingFields = [...new Set([...backendMissing, ...desiredMissing])];
      const nextWorkflow = {
        intent,
        prefill: mergedPrefill,
        missingFields,
        readyToCreate: Boolean(data.ready_to_create),
        submitLabel: t('vcon_btn_open_form', { label: getWorkflowLabel(intent, t) }),
      };

      setActiveWorkflow(nextWorkflow);
      pushMessage({
        role: 'assistant',
        text: buildConfirmationText(intent, mergedPrefill, missingFields, t),
        tone: missingFields.length ? 'muted' : 'success',
        workflow: nextWorkflow,
      });

      return nextWorkflow;
    },
    [activeWorkflow, pushMessage, t],
  );

  const handleAiChat = useCallback(
    async (text) => {
      const response = await smartflowApi.aiChat(text, {
        response_mode: 'both',
        voice_id: selectedVoiceId,
      });
      const data = getApiData(response);
      const aiText = data?.ai_message?.content || data?.response || t('vcon_processed_request');
      const nextConversationId = data?.conversation_id || conversationId;

      pushMessage({
        role: 'assistant',
        text: aiText,
        tone: 'default',
      });

      if (nextConversationId) {
        persistConversationId(nextConversationId);
      }
      playVoice(aiText, data.audio);
      return data;
    },
    [conversationId, persistConversationId, playVoice, pushMessage, selectedVoiceId, t],
  );

  const loadStoredConversation = useCallback(async (preferredConversationId = null) => {
    let targetId = preferredConversationId || conversationId;
    if (!targetId) {
      const response = await smartflowApi.getConversations({ page: 1, page_size: 20, platform: 'ai', archived: false });
      const data = getApiData(response);
      const items = Array.isArray(data?.items) ? data.items : [];
      targetId = items[0]?.id || items[0]?._id || null;
    }

    if (!targetId) return null;

    const response = await smartflowApi.getMessages(targetId, { page: 1, page_size: 100 });
    const data = getApiData(response);
    const thread = toMessageArray(data)
      .map(mapThreadMessageToUi)
      .filter((item) => item.text)
      .sort((left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime());

    persistConversationId(targetId);
    setMessages(thread);
    if (thread.length) setIsSessionActive(true);
    return targetId;
  }, [conversationId, persistConversationId]);

  const sendPrompt = useCallback(
    async (rawText, source = 'text') => {
      const text = normalizeVoiceWorkflowTranscript(rawText);
      if (!text || isThinking || workflowBusy) return;

      setIsSessionActive(true);
      setIsThinking(true);
      setMicError('');
      setInputText('');
      setInterimTranscript('');

      pushMessage({
        role: 'user',
        text,
        source,
      });

      try {
        const workflow = await handleWorkflowPrefill(text);
        if (!workflow) {
          setActiveWorkflow(null);
          const result = await handleAiChat(text);
          await loadStoredConversation(result?.conversation_id || conversationId);
        }
      } catch (error) {
        pushMessage({
          role: 'assistant',
          text: error?.response?.data?.message || t('vcon_err_process_request'),
          tone: 'error',
        });
      } finally {
        setIsThinking(false);
      }
    },
    [conversationId, handleAiChat, handleWorkflowPrefill, isThinking, loadStoredConversation, pushMessage, t, workflowBusy],
  );

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPermissionState('unsupported');
      setMicError(t('vcon_err_speech_unsupported'));
      pushMessage({
        role: 'assistant',
        text: t('vcon_err_speech_unsupported_chat'),
        tone: 'error',
      });
      return;
    }

    setVoiceLoading(true);
    setMicError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState('granted');

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = aiLanguage;

      recognition.onstart = () => {
        setIsSessionActive(true);
        setIsListening(true);
        setInterimTranscript('');
        transcriptRef.current = '';
      };

      recognition.onresult = (event) => {
        let partial = '';
        let finalText = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0]?.transcript || '';
          if (event.results[index].isFinal) finalText += transcript;
          else partial += transcript;
        }

        setInterimTranscript(partial || finalText);
        if (finalText.trim()) {
          const normalizedFinal = normalizeVoiceWorkflowTranscript(finalText.trim());
          setInterimTranscript(normalizedFinal);
          transcriptRef.current = normalizedFinal;
        } else {
          transcriptRef.current = normalizeVoiceWorkflowTranscript(partial.trim());
        }
      };

      recognition.onerror = (event) => {
        const errorCode = event.error || 'unknown';
        setPermissionState(errorCode === 'not-allowed' ? 'denied' : 'error');
        setMicError(errorCode === 'not-allowed' ? t('vcon_err_mic_denied') : t('vcon_err_mic_code', { code: errorCode }));
      };

      recognition.onend = () => {
        const finalText = transcriptRef.current.trim();
        setIsListening(false);
        if (finalText) {
          sendPrompt(finalText, 'voice');
        }
        setInterimTranscript('');
        transcriptRef.current = '';
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setPermissionState('denied');
      setMicError(t('vcon_err_mic_denied'));
      pushMessage({
        role: 'assistant',
        text: t('vcon_err_mic_denied_chat'),
        tone: 'error',
      });
    } finally {
      setVoiceLoading(false);
    }
  }, [aiLanguage, pushMessage, sendPrompt, t]);

  useEffect(() => {
    setStoredAiLanguage(aiLanguage);
  }, [aiLanguage]);

  const handleActionChip = useCallback(
    (chip) => {
      if (chip.id === 'history') {
        navigate('/profile?tab=voice');
        return;
      }
      navigate(chip.path, { state: chip.state });
    },
    [navigate],
  );

  useEffect(() => {
    smartflowApi.getAIVoices()
      .then((response) => {
        const data = getApiData(response);
        setVoices(Array.isArray(data) ? data : []);
      })
      .catch(() => setVoices([]));
  }, []);

  useEffect(() => {
    loadStoredConversation().catch(() => {});
  }, [loadStoredConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interimTranscript, messages, activeWorkflow]);

  useEffect(() => {
    const initialVoiceResult = location.state?.initialVoiceResult;
    if (initialVoiceResult && consumedStateRef.current.initialVoiceResult !== initialVoiceResult) {
      consumedStateRef.current.initialVoiceResult = initialVoiceResult;
      sendPrompt(initialVoiceResult, 'prompt');
    }
  }, [location.state, sendPrompt]);

  useEffect(() => {
    const replayResult = location.state?.replayResult;
    if (!replayResult || consumedStateRef.current.replayResult === replayResult?.history_item?.id) return;

    consumedStateRef.current.replayResult = replayResult?.history_item?.id || 'replay';
    const data = getApiData({ data: replayResult });
    const userText = data?.history_item?.command_text;
    const aiText = data?.ai_message?.content || data?.response || data?.history_item?.command_text || t('vcon_replay_completed');
    setIsSessionActive(true);
    if (userText) {
      pushMessage({
        role: 'user',
        text: userText,
        source: 'history',
      });
    }
    pushMessage({
      role: 'assistant',
      text: t('vcon_replay_prefix', { text: aiText }),
      tone: 'success',
    });
    playVoice(aiText, data.audio);
  }, [location.state, playVoice, pushMessage, t]);

  useEffect(() => {
    if (location.state?.autoStart && !consumedStateRef.current.autoStart) {
      consumedStateRef.current.autoStart = true;
      setIsSessionActive(true);
      startListening();
    }
  }, [location.state, startListening]);

  useEffect(() => () => {
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, [stopListening]);

  const assistantStatus = useMemo(() => {
    if (isListening) return t('vcon_status_listening');
    if (isThinking || workflowBusy) return t('vcon_status_thinking');
    if (permissionState === 'denied') return t('vcon_status_perm_denied');
    if (permissionState === 'unsupported') return t('vcon_status_voice_unavailable');
    return t('vcon_status_ready');
  }, [isListening, isThinking, permissionState, t, workflowBusy]);

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-xl text-left">
      <div className="w-80 border-r border-[#243041]/40 bg-slate-950/20 p-6 hidden lg:flex flex-col gap-6">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Sparkles className="text-purple-400" size={18} />
            {t('vcon_title')}
          </h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            {t('vcon_subtitle')}
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('vcon_lbl_action_chips')}</p>
          <div className="flex flex-wrap gap-2">
            {actionChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  onClick={() => handleActionChip(chip)}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:text-purple-300 hover:border-purple-500/40 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Icon size={14} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('vcon_lbl_prompt_buttons')}</p>
          <div className="space-y-2">
            {promptButtons.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendPrompt(prompt, 'prompt')}
                className="w-full text-left px-4 py-3 bg-[#9333ea]/5 border border-[#9333ea]/10 rounded-xl text-xs text-purple-300 font-semibold hover:bg-[#9333ea]/10 transition-colors cursor-pointer"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('vcon_lbl_assistant_status')}</p>
            <p className="text-white font-semibold mt-2">{assistantStatus}</p>
            {micError ? <p className="text-rose-300 text-xs mt-2">{micError}</p> : null}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('vcon_lbl_voice_output')}</label>
            <select
              value={selectedVoiceId}
              onChange={(event) => setSelectedVoiceId(event.target.value)}
              className="mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl text-sm text-white px-3 py-2 outline-none"
            >
              {voices.length ? voices.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.label}</option>
              )) : <option value={FALLBACK_VOICE}>{t('vcon_default_voice')}</option>}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('vcon_lbl_ai_language')}</label>
            <select
              value={aiLanguage}
              onChange={(event) => setAiLanguage(event.target.value)}
              className="mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl text-sm text-white px-3 py-2 outline-none"
            >
              {AI_LANGUAGE_OPTIONS.map((language) => (
                <option key={language.code} value={language.code}>{language.name}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-400">
              {t('vcon_mobile_parity_hint')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!isSessionActive ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-32 h-32 rounded-full bg-purple-500/10 flex items-center justify-center mb-8 border border-purple-500/20">
              <Mic size={48} className="text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('vcon_hero_title')}</h2>
            <p className="text-slate-400 text-sm mb-8 text-center max-w-sm">
              {t('vcon_hero_subtitle')}
            </p>
            <p className="text-purple-300 text-xs font-semibold mb-5">
              {getInitialPrompt(aiLanguage, 'agreement')}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSessionActive(true)}
                className="px-8 py-4 bg-purple-500 hover:bg-purple-400 text-[#070a13] font-bold rounded-full transition-all shadow-lg shadow-purple-500/20 text-lg flex items-center gap-2 cursor-pointer"
              >
                <Phone size={20} />
                {t('vcon_btn_connect')}
              </button>
              <button
                onClick={startListening}
                className="px-6 py-4 bg-slate-900 border border-slate-800 text-purple-300 rounded-full font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Mic size={18} />
                {t('vcon_btn_start_listening')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-[#243041]/40 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-purple-400 animate-pulse' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-white font-bold text-sm">{t('vcon_session_title')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={t('vcon_title_replay_audio')}
                >
                  <Volume2 size={16} />
                </button>
                <button
                  onClick={() => {
                    stopListening();
                    setIsSessionActive(false);
                    setActiveWorkflow(null);
                    setInterimTranscript('');
                  }}
                  className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 hover:text-white transition-colors cursor-pointer"
                  title={t('vcon_title_end_session')}
                >
                  <Phone size={16} className="rotate-[135deg]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 bg-slate-900/10">
              {messages.length === 0 ? (
                <div className="max-w-xl bg-slate-800 border border-slate-700 text-white rounded-3xl rounded-bl-none p-4">
                  {t('vcon_welcome_message')}
                </div>
              ) : null}

              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] p-4 rounded-3xl ${
                      message.role === 'user'
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-50 rounded-br-none'
                        : message.tone === 'error'
                          ? 'bg-rose-950/30 border border-rose-500/30 text-rose-100 rounded-bl-none'
                          : message.tone === 'success'
                            ? 'bg-emerald-950/20 border border-emerald-500/25 text-emerald-50 rounded-bl-none'
                            : 'bg-slate-800 border border-slate-700 text-white rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    {message.source ? <p className="text-[11px] mt-2 uppercase tracking-wider text-slate-400">{message.source}</p> : null}
                    {message.action ? (
                      <button
                        onClick={message.action.onClick}
                        className="mt-3 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold cursor-pointer"
                      >
                        {message.action.label}
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              ))}

              {isListening && interimTranscript ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
                  <div className="max-w-[78%] px-4 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-3xl rounded-br-none">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2">
                      <Activity size={14} className="animate-pulse" />
                      {t('vcon_partial_transcript')}
                    </div>
                    <p className="text-sm">{interimTranscript}</p>
                  </div>
                </motion.div>
              ) : null}

              {isThinking ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-3xl rounded-bl-none text-sm font-medium flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    {t('vcon_ai_thinking')}
                  </div>
                </motion.div>
              ) : null}

              {activeWorkflow?.intent && !activeWorkflow.missingFields?.length ? (
                <div className="flex justify-start">
                  <div className="max-w-[78%] p-4 rounded-3xl rounded-bl-none bg-[#9333ea]/8 border border-[#9333ea]/20 text-white">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                      <CheckCircle2 size={14} />
                      {t('vcon_confirm_required')}
                    </div>
                    <p className="text-sm text-slate-200 mb-4">
                      {buildConfirmationText(activeWorkflow.intent, activeWorkflow.prefill, [], t)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={executeWorkflow}
                        disabled={workflowBusy}
                        className="px-4 py-2 rounded-xl bg-purple-500 text-[#031218] font-bold text-sm disabled:opacity-60 cursor-pointer"
                      >
                        {workflowBusy ? t('vcon_executing') : (activeWorkflow.submitLabel || t('vcon_btn_confirm_execute'))}
                      </button>
                      <button
                        onClick={() => {
                          setActiveWorkflow(null);
                          pushMessage({ role: 'assistant', text: t('vcon_msg_cancelled'), tone: 'muted' });
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm cursor-pointer"
                      >
                        {t('vcon_btn_cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            <div className="p-4 md:p-6 bg-slate-950/40 border-t border-[#243041]/40 space-y-3">
              {permissionState === 'denied' ? (
                <div className="text-xs text-rose-300 flex items-center gap-2">
                  <XCircle size={14} />
                  {t('vcon_mic_denied_bar')}
                </div>
              ) : null}

              <div className="flex items-end gap-3">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={voiceLoading || isThinking || workflowBusy}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                    isListening
                      ? 'bg-purple-500 text-[#070a13] shadow-purple-500/20'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  } disabled:opacity-60`}
                  title={isListening ? t('vcon_title_stop_listening') : t('vcon_title_start_listening')}
                >
                  {voiceLoading ? <Loader2 size={22} className="animate-spin" /> : isListening ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                  <textarea
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder={t('vcon_ph_type_message')}
                    className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none resize-none min-h-[68px] text-sm"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendPrompt(inputText, 'text');
                      }
                    }}
                  />
                </div>

                <button
                  onClick={() => sendPrompt(inputText, 'text')}
                  disabled={!inputText.trim() || isThinking || workflowBusy}
                  className="w-14 h-14 rounded-2xl bg-purple-500 text-[#031218] flex items-center justify-center font-bold disabled:opacity-60 cursor-pointer"
                  title={t('vcon_title_send_text')}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
