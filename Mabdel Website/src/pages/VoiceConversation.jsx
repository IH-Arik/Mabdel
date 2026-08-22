import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  History,
  Loader2,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Plus,
  Send,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  X,
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
  call: ['phone_number'],
};

const FALLBACK_VOICE = 'neutral_assistant';

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
    case 'invoice': return t('vcon_wf_invoice') || 'Invoice';
    case 'bulk_message': return t('vcon_wf_bulk_message') || 'Bulk Message';
    case 'calendar': return t('vcon_wf_meeting') || 'Meeting';
    case 'lease': return t('vcon_wf_lease') || 'Lease';
    case 'agreement': return t('vcon_wf_agreement') || 'Agreement';
    case 'call': return t('vcon_wf_call') || 'Phone Call';
    default: return intent;
  }
};

const getWorkflowQuestion = (intent, fieldKey, t) =>
  getFieldQuestion(getStoredAiLanguage(), intent, fieldKey) || t('vcon_wf_fallback_question').replace('{field}', humanizeField(fieldKey));

const getWorkflowDestination = (intent, prefill = {}, t) => {
  if (intent === 'invoice') {
    return { path: '/invoices', state: { prefill, action: 'new_invoice' }, label: t('vcon_chip_create_invoice') || 'Create Invoice' };
  }
  if (intent === 'calendar') {
    return { path: '/calendar', state: { prefill, action: 'new_meeting' }, label: t('vcon_chip_schedule_meeting') || 'Schedule Meeting' };
  }
  if (intent === 'bulk_message') {
    return { path: '/bulk-messaging', state: { prefill, action: 'new_bulk_message' }, label: t('vcon_chip_bulk_message') || 'Bulk Message' };
  }
  if (intent === 'agreement') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'agreement' }, action: 'new_agreement', tab: 'agreements' },
      label: t('vcon_chip_new_agreement') || 'New Agreement',
    };
  }
  if (intent === 'lease') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'lease' }, action: 'new_lease', tab: 'leases' },
      label: t('vcon_chip_new_lease') || 'New Lease',
    };
  }
  if (intent === 'call') {
    return {
      path: '/calls',
      state: { prefill, action: 'new_call' },
      label: t('vcon_chip_place_call') || 'Initiate Call',
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

  if (intent === 'call') {
    if (prefill.phone_number || prefill.phone) previewParts.push(`Phone: ${prefill.phone_number || prefill.phone}`);
    if (prefill.purpose) previewParts.push(`Purpose: "${prefill.purpose}"`);
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
  // Deliberately NOT restored from storage on mount — opening the Voice Assistant
  // page always starts on a fresh, empty chat (like visiting chatgpt.com), with past
  // chats reachable from the sidebar instead of silently auto-resuming the last one.
  const [conversationId, setConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [newChatBusy, setNewChatBusy] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isChatHistoryCollapsed, setIsChatHistoryCollapsed] = useState(false);

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
    // explicitConversationId lets callers force which chat this lands in without
    // waiting for a just-set conversationId to actually re-render — React state
    // updates aren't visible to this closure until the next render, so sendPrompt
    // passes the id it just created directly instead of relying on state timing.
    async (text, explicitConversationId) => {
      // Text and audio used to come back together (response_mode: 'both'), which
      // meant sitting through the LLM reply AND TTS synthesis — sequential
      // server-side since audio is generated from the finished text — before
      // showing anything at all. Asking for text only here means the reply
      // appears as soon as the LLM is done; audio is fetched separately right
      // after and starts playing whenever it's ready, instead of blocking the
      // visible reply on it.
      const response = await smartflowApi.aiChat(text, {
        response_mode: 'text',
        voice_id: selectedVoiceId,
        conversation_id: explicitConversationId ?? conversationId,
      });
      const data = getApiData(response);
      const aiText = data?.ai_message?.content || data?.response || t('vcon_processed_request');
      const nextConversationId = data?.conversation_id || explicitConversationId || conversationId;

      pushMessage({
        role: 'assistant',
        text: aiText,
        tone: 'default',
      });

      if (nextConversationId) {
        persistConversationId(nextConversationId);
      }
      smartflowApi.synthesizeAiSpeech(aiText, selectedVoiceId)
        .then((speechResponse) => {
          const speechData = getApiData(speechResponse);
          playVoice(aiText, speechData?.audio);
        })
        .catch(() => {
          // Text reply is already shown; falling back to no audio (or the
          // browser's own speechSynthesis inside playVoice) is fine here.
          playVoice(aiText, null);
        });
      return data;
    },
    [conversationId, persistConversationId, playVoice, pushMessage, selectedVoiceId, t],
  );

  const loadStoredConversation = useCallback(async (preferredConversationId = null) => {
    let targetId = preferredConversationId || conversationId;
    if (!targetId) {
      // type: 'ai' (not platform: 'ai') — group conversations are also stored with
      // platform "ai" internally (see ConversationService.create_group), so filtering
      // by platform alone pulls in every group chat too, not just the AI assistant.
      const response = await smartflowApi.getConversations({ page: 1, page_size: 20, type: 'ai', archived: false });
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

  const loadChatHistory = useCallback(async () => {
    setChatHistoryLoading(true);
    try {
      const response = await smartflowApi.getConversations({ page: 1, page_size: 30, type: 'ai', archived: false });
      const data = getApiData(response);
      setChatHistory(toMessageArray(data));
    } catch {
      setChatHistory([]);
    } finally {
      setChatHistoryLoading(false);
    }
  }, []);

  const handleSelectChat = useCallback(
    async (targetId) => {
      if (!targetId || targetId === conversationId) return;
      setActiveWorkflow(null);
      try {
        await loadStoredConversation(targetId);
      } catch (error) {
        window.alert(error?.response?.data?.message || t('vcon_err_select_chat'));
      }
    },
    [conversationId, loadStoredConversation, t],
  );

  const handleNewChat = useCallback(async () => {
    setNewChatBusy(true);
    try {
      const response = await smartflowApi.createAiConversation();
      const data = getApiData(response);
      persistConversationId(data.id);
      setMessages([]);
      setActiveWorkflow(null);
      setIsSessionActive(false);
      loadChatHistory();
    } catch (error) {
      window.alert(error?.response?.data?.message || t('vcon_err_new_chat'));
    } finally {
      setNewChatBusy(false);
    }
  }, [loadChatHistory, persistConversationId, t]);

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
          // No chat open yet (fresh page load, or right after "New Chat") — mint one
          // now rather than letting the backend fall back to "most recently active
          // chat", which would silently continue an old conversation instead of
          // actually starting the new one the empty screen implied.
          let targetConversationId = conversationId;
          if (!targetConversationId) {
            try {
              const createResponse = await smartflowApi.createAiConversation();
              targetConversationId = getApiData(createResponse).id;
              persistConversationId(targetConversationId);
            } catch {
              // Couldn't mint a fresh chat (e.g. backend temporarily unreachable) —
              // don't block sending the message over it. Falls back to the backend's
              // own default (continues whichever chat was last active there) rather
              // than failing the whole send.
              targetConversationId = null;
            }
          }
          await handleAiChat(text, targetConversationId);
          // The reply is already visible (handleAiChat pushed it into the local
          // thread) — no need to reload the whole thread from the server just to
          // show what's already shown. Refresh the sidebar list in the background
          // (picks up a first-message auto-title / bumps this chat to the top)
          // without blocking or re-showing "AI is thinking...".
          loadChatHistory();
          return;
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
    [conversationId, handleAiChat, handleWorkflowPrefill, isThinking, loadChatHistory, persistConversationId, pushMessage, t, workflowBusy],
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
    // Intentionally does NOT auto-resume the last chat (see conversationId's
    // initializer above) — only load the sidebar list so past chats are reachable.
    loadChatHistory();
  }, [loadChatHistory]);

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

  const renderSidebarContent = () => (
    <>
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
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsChatHistoryCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors cursor-pointer group"
          >
            <ChevronDown
              size={14}
              className={`transform transition-transform duration-200 text-slate-400 group-hover:text-purple-300 ${
                isChatHistoryCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            />
            <span>{t('vcon_lbl_chat_history')}</span>
            {Array.isArray(chatHistory) && chatHistory.length ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-extrabold border border-purple-500/20">
                {chatHistory.length}
              </span>
            ) : null}
          </button>
          <button
            onClick={handleNewChat}
            disabled={newChatBusy}
            title={t('vcon_btn_new_chat')}
            className="p-1.5 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {newChatBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>

        {!isChatHistoryCollapsed && (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar transition-all duration-200">
            {chatHistoryLoading && !chatHistory.length ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 px-2 py-2">
                <Loader2 size={13} className="animate-spin text-purple-400" />
                {t('vcon_loading_history')}
              </div>
            ) : Array.isArray(chatHistory) && chatHistory.length ? (
              chatHistory.filter((item) => item && (item.id || item._id)).map((item) => {
                const itemId = item.id || item._id;
                const isActive = itemId === conversationId;
                return (
                  <button
                    key={itemId}
                    onClick={() => {
                      handleSelectChat(itemId);
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium truncate transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                    }`}
                    title={item.title || item.name || t('vcon_untitled_chat')}
                  >
                    {item.title || item.name || t('vcon_untitled_chat')}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-slate-600 px-2 py-2">{t('vcon_no_chat_history')}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('vcon_lbl_action_chips')}</p>
        <div className="flex flex-wrap gap-2">
          {Array.isArray(actionChips) && actionChips.map((chip) => {
            if (!chip) return null;
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                onClick={() => {
                  handleActionChip(chip);
                  setIsMobileDrawerOpen(false);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:text-purple-300 hover:border-purple-500/40 transition-colors text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                {Icon ? <Icon size={14} /> : null}
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('vcon_lbl_prompt_buttons')}</p>
        <div className="space-y-2">
          {Array.isArray(promptButtons) && promptButtons.map((prompt, idx) => (
            <button
              key={typeof prompt === 'string' ? prompt : idx}
              onClick={() => {
                sendPrompt(prompt, 'prompt');
                setIsMobileDrawerOpen(false);
              }}
              className="w-full text-left px-4 py-3 bg-[#9333ea]/5 border border-[#9333ea]/10 rounded-xl text-xs text-purple-300 font-semibold hover:bg-[#9333ea]/10 transition-colors cursor-pointer"
            >
              "{String(prompt || '')}"
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
            {Array.isArray(voices) && voices.length ? voices.map((voice) => (
              <option key={voice?.id || voice?.voice_id || voice} value={voice?.id || voice?.voice_id || voice}>
                {voice?.label || voice?.name || voice?.id || String(voice)}
              </option>
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
    </>
  );

  return (
    <div className="relative flex flex-col lg:flex-row h-[calc(100vh-5rem)] md:h-[calc(100vh-7rem)] min-h-[500px] bg-[#0c101b] border border-[#243041]/60 rounded-2xl md:rounded-3xl overflow-hidden shadow-xl text-left">
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#243041]/40 bg-slate-950/60 z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-400" size={18} />
          <span className="text-white font-bold text-sm">{t('vcon_title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            disabled={newChatBusy}
            className="p-2 rounded-xl bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">{t('vcon_btn_new_chat')}</span>
          </button>
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={t('vcon_lbl_action_chips')}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="w-80 border-r border-[#243041]/40 bg-slate-950/20 p-6 hidden lg:flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        {renderSidebarContent()}
      </div>

      {/* Mobile Sidebar Overlay / Drawer */}
      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-[#0c101b] border-r border-[#243041] p-5 flex flex-col gap-5 overflow-y-auto z-10 shadow-2xl custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Sparkles className="text-purple-400" size={16} />
                {t('vcon_title')}
              </span>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {!isSessionActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto custom-scrollbar">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-purple-500/10 flex items-center justify-center mb-6 sm:mb-8 border border-purple-500/20">
              <Mic size={40} className="text-purple-400 sm:w-12 sm:h-12" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('vcon_hero_title')}</h2>
            <p className="text-slate-400 text-xs sm:text-sm mb-6 sm:mb-8 max-w-sm">
              {t('vcon_hero_subtitle')}
            </p>
            <p className="text-purple-300 text-xs font-semibold mb-5 px-2">
              {getInitialPrompt(aiLanguage, 'agreement')}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-4 sm:px-0">
              <button
                onClick={() => setIsSessionActive(true)}
                className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-purple-500 hover:bg-purple-400 text-[#070a13] font-bold rounded-full transition-all shadow-lg shadow-purple-500/20 text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone size={20} />
                {t('vcon_btn_connect')}
              </button>
              <button
                onClick={startListening}
                className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-slate-900 border border-slate-800 text-purple-300 rounded-full font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mic size={18} />
                {t('vcon_btn_start_listening')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 sm:p-4 border-b border-[#243041]/40 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-purple-400 animate-pulse' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-white font-bold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">{t('vcon_session_title')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={t('vcon_title_replay_audio')}
                >
                  <Volume2 size={15} />
                </button>
                <button
                  onClick={() => {
                    stopListening();
                    setIsSessionActive(false);
                    setActiveWorkflow(null);
                    setInterimTranscript('');
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 hover:text-white transition-colors cursor-pointer"
                  title={t('vcon_title_end_session')}
                >
                  <Phone size={15} className="rotate-[135deg]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 bg-slate-900/10 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="max-w-xl bg-slate-800 border border-slate-700 text-white rounded-2xl sm:rounded-3xl rounded-bl-none p-4 text-xs sm:text-sm">
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
                    className={`max-w-[88%] sm:max-w-[82%] lg:max-w-[78%] p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl ${
                      message.role === 'user'
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-50 rounded-br-none'
                        : message.tone === 'error'
                          ? 'bg-rose-950/30 border border-rose-500/30 text-rose-100 rounded-bl-none'
                          : message.tone === 'success'
                            ? 'bg-emerald-950/20 border border-emerald-500/25 text-emerald-50 rounded-bl-none'
                            : 'bg-slate-800 border border-slate-700 text-white rounded-bl-none'
                    }`}
                  >
                    <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    {message.source ? <p className="text-[10px] sm:text-[11px] mt-1.5 uppercase tracking-wider text-slate-400">{message.source}</p> : null}
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
                  <div className="max-w-[88%] sm:max-w-[82%] lg:max-w-[78%] px-4 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-2xl sm:rounded-3xl rounded-br-none">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2">
                      <Activity size={14} className="animate-pulse" />
                      {t('vcon_partial_transcript')}
                    </div>
                    <p className="text-xs sm:text-sm">{interimTranscript}</p>
                  </div>
                </motion.div>
              ) : null}

              {isThinking ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-2xl sm:rounded-3xl rounded-bl-none text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    {t('vcon_ai_thinking')}
                  </div>
                </motion.div>
              ) : null}

              {activeWorkflow?.intent && !activeWorkflow.missingFields?.length ? (
                <div className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-[82%] lg:max-w-[78%] p-4 rounded-2xl sm:rounded-3xl rounded-bl-none bg-[#9333ea]/8 border border-[#9333ea]/20 text-white">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                      <CheckCircle2 size={14} />
                      {t('vcon_confirm_required')}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 mb-4">
                      {buildConfirmationText(activeWorkflow.intent, activeWorkflow.prefill, [], t)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={executeWorkflow}
                        disabled={workflowBusy}
                        className="px-4 py-2 rounded-xl bg-purple-500 text-[#031218] font-bold text-xs sm:text-sm disabled:opacity-60 cursor-pointer"
                      >
                        {workflowBusy ? t('vcon_executing') : (activeWorkflow.submitLabel || t('vcon_btn_confirm_execute'))}
                      </button>
                      <button
                        onClick={() => {
                          setActiveWorkflow(null);
                          pushMessage({ role: 'assistant', text: t('vcon_msg_cancelled'), tone: 'muted' });
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-xs sm:text-sm cursor-pointer"
                      >
                        {t('vcon_btn_cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            <div className="p-3 sm:p-4 md:p-6 bg-slate-950/40 border-t border-[#243041]/40 space-y-2.5 sm:space-y-3">
              {permissionState === 'denied' ? (
                <div className="text-xs text-rose-300 flex items-center gap-2">
                  <XCircle size={14} />
                  {t('vcon_mic_denied_bar')}
                </div>
              ) : null}

              <div className="flex items-end gap-2 sm:gap-3">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={voiceLoading || isThinking || workflowBusy}
                  className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 cursor-pointer ${
                    isListening
                      ? 'bg-purple-500 text-[#070a13] shadow-purple-500/20'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  } disabled:opacity-60`}
                  title={isListening ? t('vcon_title_stop_listening') : t('vcon_title_start_listening')}
                >
                  {voiceLoading ? <Loader2 size={18} className="animate-spin sm:w-[22px] sm:h-[22px]" /> : isListening ? <MicOff size={18} className="sm:w-[22px] sm:h-[22px]" /> : <Mic size={18} className="sm:w-[22px] sm:h-[22px]" />}
                </button>

                <div className="flex-1 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/80 px-3 py-2 sm:px-4 sm:py-3">
                  <textarea
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder={t('vcon_ph_type_message')}
                    className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none resize-none min-h-[44px] sm:min-h-[68px] text-xs sm:text-sm"
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
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-purple-500 text-[#031218] flex items-center justify-center font-bold shrink-0 disabled:opacity-60 cursor-pointer"
                  title={t('vcon_title_send_text')}
                >
                  <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
