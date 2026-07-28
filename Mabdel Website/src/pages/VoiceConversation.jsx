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

const ACTION_CHIPS = [
  { id: 'create_invoice', label: 'Create Invoice', path: '/invoices', state: { prefill: {}, action: 'new_invoice' }, icon: FileText },
  { id: 'bulk_message', label: 'Bulk Message', path: '/bulk-messaging', state: { prefill: {}, action: 'new_bulk_message' }, icon: MessageSquare },
  { id: 'schedule_meeting', label: 'Schedule Meeting', path: '/calendar', state: { prefill: {}, action: 'new_meeting' }, icon: Calendar },
  { id: 'new_lease', label: 'New Lease', path: '/documents', state: { tab: 'leases', prefill: { type: 'lease' }, action: 'new_lease' }, icon: FileText },
  { id: 'new_agreement', label: 'New Agreement', path: '/documents', state: { prefill: { type: 'agreement' }, action: 'new_agreement' }, icon: FileText },
  { id: 'history', label: 'History', path: '/profile?tab=voice', state: null, icon: History },
];

const PROMPT_BUTTONS = [
  'Read my latest messages',
  'Create a new invoice',
  "What's on my schedule?",
];

const WORKFLOW_LABELS = {
  invoice: 'invoice',
  bulk_message: 'bulk message',
  calendar: 'meeting',
  lease: 'lease',
  agreement: 'agreement',
};

const WORKFLOW_DESTINATIONS = {
  invoice: 'create_invoice',
  bulk_message: 'bulk_message',
  calendar: 'schedule_meeting',
  lease: 'new_lease',
  agreement: 'new_agreement',
};

const DESIRED_FIELDS = {
  invoice: ['client_name', 'client_email', 'items', 'due_date'],
  agreement: ['prompt', 'client_name', 'client_email', 'client_phone', 'agreement_type', 'start_date'],
  lease: ['prompt', 'tenant_name', 'tenant_email', 'tenant_phone', 'monthly_rent', 'start_date', 'end_date'],
};

const FALLBACK_VOICE = 'neutral_assistant';
const AI_CONVERSATION_STORAGE_KEY = 'voice_conversation_id';

const getApiData = (response) => response?.data?.data || response?.data || response || {};
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

const normalizeDateInput = (value) => {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
};

const normalizeDateTime = (dateValue, timeValue = '10:00') => {
  const date = normalizeDateInput(dateValue);
  if (!date) return undefined;
  const parsed = new Date(`${date}T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

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

const buildWorkflowPayload = (intent, prefill = {}) => {
  if (intent === 'invoice') {
    const today = new Date();
    const defaultIssueDate = today.toISOString().slice(0, 10);
    const issueDate = normalizeDateInput(prefill.issue_date) || defaultIssueDate;
    let dueDate = normalizeDateInput(prefill.due_date);
    if (!dueDate || new Date(`${dueDate}T00:00:00`).getTime() < new Date(`${issueDate}T00:00:00`).getTime()) {
      const fallbackDue = new Date(`${issueDate}T00:00:00`);
      fallbackDue.setDate(fallbackDue.getDate() + 7);
      dueDate = fallbackDue.toISOString().slice(0, 10);
    }

    const rawItems = ensureArray(prefill.items).filter(Boolean);
    const items = rawItems.length
      ? rawItems.map((item) => ({
          description: item.description || item.name || 'Service',
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || item.amount || item.price || 0),
        }))
      : [
          {
            description: prefill.description || prefill.notes || 'Service',
            quantity: Number(prefill.quantity || 1),
            unit_price: Number(prefill.amount || prefill.total_amount || 0),
          },
        ];

    return {
      client_name: prefill.client_name || prefill.client || prefill.name || '',
      client_email: prefill.client_email || undefined,
      billing_address: prefill.billing_address || undefined,
      currency: prefill.currency || 'USD',
      issue_date: issueDate,
      due_date: dueDate,
      tax_rate: Number(prefill.tax_rate || 0),
      notes: prefill.notes || undefined,
      items,
    };
  }

  if (intent === 'calendar') {
    const startsAt = normalizeDateTime(prefill.date || prefill.starts_at || prefill.start_date, prefill.time || prefill.start_time || '10:00');
    let endsAt = normalizeDateTime(
      prefill.date || prefill.ends_at || prefill.end_date,
      prefill.end_time || '11:00',
    );
    const startDate = startsAt ? new Date(startsAt) : null;
    const endDate = endsAt ? new Date(endsAt) : null;
    if (startDate && (!endDate || endDate <= startDate)) {
      endsAt = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();
    }

    return {
      title: prefill.title || prefill.subject || 'Scheduled Meeting',
      description: prefill.description || prefill.notes || undefined,
      starts_at: startsAt,
      ends_at: endsAt,
      meeting_mode: prefill.mode || prefill.meeting_mode || 'online',
      location: prefill.location || undefined,
      meeting_link: prefill.link || prefill.meeting_link || undefined,
      contact_ids: ensureArray(prefill.contact_ids),
      notify_via_push: true,
      notify_via_email: Boolean(prefill.notify_via_email),
      notify_via_sms: Boolean(prefill.notify_via_sms),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminder_minutes: Number(prefill.reminder_minutes || 15),
    };
  }

  if (intent === 'bulk_message') {
    const recipients = ensureArray(prefill.recipient_emails || prefill.recipients || prefill.emails)
      .map((item) => (typeof item === 'string' ? item : item?.email || item?.value))
      .filter(Boolean);

    const attachments = ensureArray(prefill.attachments || prefill.attachment_urls)
      .map((item) =>
        typeof item === 'string'
          ? { label: item.split('/').pop() || 'Attachment', url: item }
          : { label: item.label || item.file_name || 'Attachment', url: item.url },
      )
      .filter((item) => item.url);

    return {
      channel: prefill.channel || 'email',
      recipient_emails: recipients,
      contact_ids: ensureArray(prefill.contact_ids),
      group_ids: ensureArray(prefill.group_ids),
      subject: prefill.subject || undefined,
      content: prefill.message || prefill.content || prefill.body || '',
      attachments,
      scheduled_at: prefill.scheduled_at || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      send_now: !prefill.scheduled_at,
      ai_transcript: prefill.ai_transcript || undefined,
    };
  }

  if (intent === 'agreement') {
    return {
      title: prefill.title || 'New Agreement',
      client_name: prefill.client_name || prefill.client || prefill.name || '',
      client_email: prefill.client_email || undefined,
      client_phone: prefill.client_phone || undefined,
      agreement_type: prefill.agreement_type || 'contract',
      start_date: normalizeDateInput(prefill.start_date) || undefined,
      end_date: normalizeDateInput(prefill.end_date) || undefined,
      content: prefill.content || prefill.body || prefill.prompt || '',
      status: 'pending_signature',
    };
  }

  if (intent === 'lease') {
    return {
      prompt: prefill.prompt || prefill.content || '',
      property_address: prefill.property_address || prefill.address || '',
      property_type: prefill.property_type || 'apartment',
      landlord_name: prefill.landlord_name || prefill.landlord || '',
      tenant_name: prefill.tenant_name || prefill.tenant || prefill.name || '',
      tenant_email: prefill.tenant_email || undefined,
      tenant_phone: prefill.tenant_phone || undefined,
      monthly_rent: prefill.monthly_rent || prefill.rent || '',
      security_deposit: prefill.security_deposit || prefill.deposit || '',
      start_date: normalizeDateInput(prefill.start_date) || undefined,
      end_date: normalizeDateInput(prefill.end_date) || undefined,
      custom_terms: prefill.custom_terms || prefill.terms || '',
    };
  }

  return null;
};

const getWorkflowQuestion = (intent, fieldKey) =>
  getFieldQuestion(getStoredAiLanguage(), intent, fieldKey) || `What is the ${humanizeField(fieldKey)}?`;

const getWorkflowDestination = (intent, prefill = {}) => {
  if (intent === 'invoice') {
    return { path: '/invoices', state: { prefill, action: 'new_invoice' }, label: 'Create Invoice' };
  }
  if (intent === 'calendar') {
    return { path: '/calendar', state: { prefill, action: 'new_meeting' }, label: 'Schedule Meeting' };
  }
  if (intent === 'bulk_message') {
    return { path: '/bulk-messaging', state: { prefill, action: 'new_bulk_message' }, label: 'Bulk Message' };
  }
  if (intent === 'agreement') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'agreement' }, action: 'new_agreement', tab: 'agreements' },
      label: 'New Agreement',
    };
  }
  if (intent === 'lease') {
    return {
      path: '/documents',
      state: { prefill: { ...prefill, type: 'lease' }, action: 'new_lease', tab: 'leases' },
      label: 'New Lease',
    };
  }
  return null;
};

const buildConfirmationText = (intent, prefill = {}, missingFields = []) => {
  const label = WORKFLOW_LABELS[intent] || intent;
  const previewParts = [];

  if (intent === 'invoice') {
    if (prefill.client_name) previewParts.push(`client ${prefill.client_name}`);
    if (prefill.amount || prefill.total_amount) previewParts.push(`amount ${prefill.amount || prefill.total_amount}`);
  }

  if (intent === 'calendar') {
    if (prefill.title) previewParts.push(`title "${prefill.title}"`);
    if (prefill.date || prefill.starts_at) previewParts.push(`date ${prefill.date || prefill.starts_at}`);
  }

  if (intent === 'bulk_message') {
    const recipientCount = ensureArray(prefill.recipient_emails || prefill.recipients).length;
    if (recipientCount) previewParts.push(`${recipientCount} recipients`);
    if (prefill.subject) previewParts.push(`subject "${prefill.subject}"`);
  }

  if (intent === 'agreement') {
    if (prefill.client_name) previewParts.push(`client ${prefill.client_name}`);
    if (prefill.title) previewParts.push(`title "${prefill.title}"`);
  }

  if (intent === 'lease') {
    if (prefill.tenant_name) previewParts.push(`tenant ${prefill.tenant_name}`);
    if (prefill.monthly_rent || prefill.rent) previewParts.push(`rent ${prefill.monthly_rent || prefill.rent}`);
  }

  if (missingFields.length) {
    return getWorkflowQuestion(intent, missingFields[0]);
  }

  if (previewParts.length) {
    return `I prepared the ${label} workflow for ${previewParts.join(', ')}. Confirm and I'll open the form with everything filled in.`;
  }

  return `I prepared the ${label} workflow. Confirm and I'll open the form with everything filled in.`;
};

const mapWorkflowResultToMessage = (intent, payload = {}) => {
  if (intent === 'invoice') {
    return `Invoice ${payload.invoice_number || ''} created for ${payload.client_name || 'the client'}.`.trim();
  }
  if (intent === 'calendar') {
    return `Meeting "${payload.title || 'Meeting'}" scheduled successfully.`;
  }
  if (intent === 'bulk_message') {
    return `Bulk message created with status ${payload.status || 'draft'}.`;
  }
  if (intent === 'agreement') {
    return `Agreement ${payload.agreement_number || ''} created for ${payload.client_name || 'the client'}.`.trim();
  }
  if (intent === 'lease') {
    return `Lease drafted for ${payload.tenant_name || 'the tenant'}.`;
  }
  return 'Workflow executed successfully.';
};

const buildAudioSrc = (audioPayload) => {
  if (!audioPayload?.audio_base64) return null;
  return `data:${audioPayload.mime_type || 'audio/wav'};base64,${audioPayload.audio_base64}`;
};

export default function VoiceConversation() {
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
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AI_CONVERSATION_STORAGE_KEY);
  });

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

    const destination = getWorkflowDestination(activeWorkflow.intent, activeWorkflow.prefill);
    if (!destination) {
      pushMessage({ role: 'assistant', text: 'I could not prepare that workflow form yet.', tone: 'error' });
      return;
    }

    pushMessage({
      role: 'assistant',
      text: `Opening the ${destination.label} form now.`,
      tone: 'success',
      action: {
        label: `Open ${destination.label}`,
        onClick: () => navigate(destination.path, { state: destination.state }),
      },
    });
    setActiveWorkflow(null);
    navigate(destination.path, { state: destination.state });
  }, [activeWorkflow, navigate, pushMessage, workflowBusy]);

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
        submitLabel: 'Open Form',
      };

      setActiveWorkflow(nextWorkflow);
      pushMessage({
        role: 'assistant',
        text: buildConfirmationText(intent, mergedPrefill, missingFields),
        tone: missingFields.length ? 'muted' : 'success',
        workflow: nextWorkflow,
      });

      return nextWorkflow;
    },
    [activeWorkflow, pushMessage],
  );

  const handleAiChat = useCallback(
    async (text) => {
      const response = await smartflowApi.aiChat(text, {
        response_mode: 'both',
        voice_id: selectedVoiceId,
      });
      const data = getApiData(response);
      const aiText = data?.ai_message?.content || data?.response || 'I processed that request.';
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
    [conversationId, persistConversationId, playVoice, pushMessage, selectedVoiceId],
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
          text: error?.response?.data?.message || 'Sorry, I could not process that request.',
          tone: 'error',
        });
      } finally {
        setIsThinking(false);
      }
    },
    [conversationId, handleAiChat, handleWorkflowPrefill, isThinking, loadStoredConversation, pushMessage, workflowBusy],
  );

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setPermissionState('unsupported');
      setMicError('Speech recognition is not supported in this browser.');
      pushMessage({
        role: 'assistant',
        text: 'Speech recognition is not supported in this browser. You can keep chatting with text.',
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
        setMicError(errorCode === 'not-allowed' ? 'Microphone access denied.' : `Microphone error: ${errorCode}`);
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
    } catch (error) {
      setPermissionState('denied');
      setMicError('Microphone access denied.');
      pushMessage({
        role: 'assistant',
        text: 'Microphone permission was denied. You can still use text chat.',
        tone: 'error',
      });
    } finally {
      setVoiceLoading(false);
    }
  }, [aiLanguage, pushMessage, sendPrompt]);

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
    const aiText = data?.ai_message?.content || data?.response || data?.history_item?.command_text || 'Replay completed.';
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
      text: `Replay: ${aiText}`,
      tone: 'success',
    });
    playVoice(aiText, data.audio);
  }, [location.state, playVoice, pushMessage]);

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
    if (isListening) return 'Listening';
    if (isThinking || workflowBusy) return 'Thinking';
    if (permissionState === 'denied') return 'Permission denied';
    if (permissionState === 'unsupported') return 'Voice unavailable';
    return 'Ready';
  }, [isListening, isThinking, permissionState, workflowBusy]);

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-xl">
      <div className="w-80 border-r border-[#243041]/40 bg-slate-950/20 p-6 hidden lg:flex flex-col gap-6">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Sparkles className="text-purple-400" size={18} />
            AI Voice Assistant
          </h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            One conversation thread for voice, text, workflow execution, and history replay.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Action Chips</p>
          <div className="flex flex-wrap gap-2">
            {ACTION_CHIPS.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  onClick={() => handleActionChip(chip)}
                  className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:text-purple-300 hover:border-purple-500/40 transition-colors text-xs font-semibold flex items-center gap-2"
                >
                  <Icon size={14} />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Prompt Buttons</p>
          <div className="space-y-2">
            {PROMPT_BUTTONS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendPrompt(prompt, 'prompt')}
                className="w-full text-left px-4 py-3 bg-[#9333ea]/5 border border-[#9333ea]/10 rounded-xl text-xs text-purple-300 font-semibold hover:bg-[#9333ea]/10 transition-colors"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assistant Status</p>
            <p className="text-white font-semibold mt-2">{assistantStatus}</p>
            {micError ? <p className="text-rose-300 text-xs mt-2">{micError}</p> : null}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Voice Output</label>
            <select
              value={selectedVoiceId}
              onChange={(event) => setSelectedVoiceId(event.target.value)}
              className="mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl text-sm text-white px-3 py-2 outline-none"
            >
              {voices.length ? voices.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.label}</option>
              )) : <option value={FALLBACK_VOICE}>Default Voice</option>}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">AI Language</label>
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
              Mobile parity: prompts, follow-up questions, and speech recognition follow the selected AI language.
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
            <h2 className="text-2xl font-bold text-white mb-2">Start AI Voice Assistant</h2>
            <p className="text-slate-400 text-sm mb-8 text-center max-w-sm">
              Talk to GoCustify AI, switch to text instantly, and execute business workflows from the same thread.
            </p>
            <p className="text-purple-300 text-xs font-semibold mb-5">
              {getInitialPrompt(aiLanguage, 'agreement')}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSessionActive(true)}
                className="px-8 py-4 bg-purple-500 hover:bg-purple-400 text-[#070a13] font-bold rounded-full transition-all shadow-lg shadow-purple-500/20 text-lg flex items-center gap-2"
              >
                <Phone size={20} />
                Connect
              </button>
              <button
                onClick={startListening}
                className="px-6 py-4 bg-slate-900 border border-slate-800 text-purple-300 rounded-full font-bold text-sm flex items-center gap-2"
              >
                <Mic size={18} />
                Start Listening
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-[#243041]/40 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-purple-400 animate-pulse' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className="text-white font-bold text-sm">AI Assistant Session</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.play().catch(() => {});
                  }}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                  title="Replay audio"
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
                  className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-300 hover:text-white transition-colors"
                  title="End session"
                >
                  <Phone size={16} className="rotate-[135deg]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 bg-slate-900/10">
              {messages.length === 0 ? (
                <div className="max-w-xl bg-slate-800 border border-slate-700 text-white rounded-3xl rounded-bl-none p-4">
                  Hello, I am ready to help with voice chat, text chat, invoices, meetings, bulk messages, and agreements.
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
                        className="mt-3 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold"
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
                      Partial Transcript
                    </div>
                    <p className="text-sm">{interimTranscript}</p>
                  </div>
                </motion.div>
              ) : null}

              {isThinking ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-3xl rounded-bl-none text-sm font-medium flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    AI is thinking...
                  </div>
                </motion.div>
              ) : null}

              {activeWorkflow?.intent && !activeWorkflow.missingFields?.length ? (
                <div className="flex justify-start">
                  <div className="max-w-[78%] p-4 rounded-3xl rounded-bl-none bg-[#9333ea]/8 border border-[#9333ea]/20 text-white">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300 mb-3">
                      <CheckCircle2 size={14} />
                      Confirmation Required
                    </div>
                    <p className="text-sm text-slate-200 mb-4">
                      {buildConfirmationText(activeWorkflow.intent, activeWorkflow.prefill, [])}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={executeWorkflow}
                        disabled={workflowBusy}
                        className="px-4 py-2 rounded-xl bg-purple-500 text-[#031218] font-bold text-sm disabled:opacity-60"
                      >
                        {workflowBusy ? 'Executing...' : activeWorkflow.submitLabel || 'Confirm and Execute'}
                      </button>
                      <button
                        onClick={() => {
                          setActiveWorkflow(null);
                          pushMessage({ role: 'assistant', text: 'Okay, I cancelled that workflow.', tone: 'muted' });
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm"
                      >
                        Cancel
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
                  Microphone permission is denied. Text chat is still available.
                </div>
              ) : null}

              <div className="flex items-end gap-3">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={voiceLoading || isThinking || workflowBusy}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                    isListening
                      ? 'bg-purple-500 text-[#070a13] shadow-purple-500/20'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  } disabled:opacity-60`}
                  title={isListening ? 'Stop Listening' : 'Start Listening'}
                >
                  {voiceLoading ? <Loader2 size={22} className="animate-spin" /> : isListening ? <MicOff size={22} /> : <Mic size={22} />}
                </button>

                <div className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-3">
                  <textarea
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Type a message or continue a workflow..."
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
                  className="w-14 h-14 rounded-2xl bg-purple-500 text-[#031218] flex items-center justify-center font-bold disabled:opacity-60"
                  title="Send text"
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
