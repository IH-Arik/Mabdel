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

const ACTION_CHIPS = [
  { id: 'create_invoice', label: 'Create Invoice', path: '/invoices', state: { prefill: {}, action: 'new_invoice' }, icon: FileText },
  { id: 'bulk_message', label: 'Bulk Message', path: '/bulk-messaging', state: { prefill: {}, action: 'new_bulk_message' }, icon: MessageSquare },
  { id: 'schedule_meeting', label: 'Schedule Meeting', path: '/calendar', state: { prefill: {}, action: 'new_meeting' }, icon: Calendar },
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
  agreement: 'agreement',
};

const WORKFLOW_DESTINATIONS = {
  invoice: 'create_invoice',
  bulk_message: 'bulk_message',
  calendar: 'schedule_meeting',
  agreement: 'new_agreement',
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

  if (missingFields.length) {
    return `I started the ${label} workflow. I still need ${missingFields.map(humanizeField).join(', ')}.`;
  }

  if (previewParts.length) {
    return `I prepared the ${label} workflow for ${previewParts.join(', ')}. Confirm to execute it now.`;
  }

  return `I prepared the ${label} workflow. Confirm to execute it now.`;
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
      window.speechSynthesis.speak(utterance);
    }
  }, []);

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

    const payload = buildWorkflowPayload(activeWorkflow.intent, activeWorkflow.prefill);
    if (!payload) {
      pushMessage({ role: 'assistant', text: 'I could not prepare that workflow payload yet.', tone: 'error' });
      return;
    }

    setWorkflowBusy(true);
    setIsThinking(true);

    try {
      if (activeWorkflow.intent === 'bulk_message' && payload.recipient_emails?.length) {
        await smartflowApi.validateBulkRecipients({
          channel: payload.channel || 'email',
          recipient_emails: payload.recipient_emails,
          contact_ids: payload.contact_ids || [],
          group_ids: payload.group_ids || [],
        });
      }

      let response;
      if (activeWorkflow.intent === 'invoice') response = await smartflowApi.createInvoice(payload);
      if (activeWorkflow.intent === 'calendar') response = await smartflowApi.createCalendarEvent(payload);
      if (activeWorkflow.intent === 'bulk_message') response = await smartflowApi.createBulkMessage(payload);
      if (activeWorkflow.intent === 'agreement') response = await smartflowApi.createAgreement(payload);

      const result = getApiData(response);
      const successText = mapWorkflowResultToMessage(activeWorkflow.intent, result);
      pushMessage({ role: 'assistant', text: successText, tone: 'success', metadata: result });

      const destination = ACTION_CHIPS.find((chip) => chip.id === WORKFLOW_DESTINATIONS[activeWorkflow.intent]);
      if (destination?.path) {
        pushMessage({
          role: 'assistant',
          text: `You can review it now in ${destination.label}.`,
          tone: 'muted',
          action: { label: `Open ${destination.label}`, onClick: () => navigate(destination.path, { state: destination.state || { prefill: activeWorkflow.prefill } }) },
        });
      }

      setActiveWorkflow(null);
    } catch (error) {
      pushMessage({
        role: 'assistant',
        text: error?.response?.data?.message || 'The workflow could not be completed.',
        tone: 'error',
      });
    } finally {
      setWorkflowBusy(false);
      setIsThinking(false);
    }
  }, [activeWorkflow, navigate, pushMessage, workflowBusy]);

  const handleWorkflowPrefill = useCallback(
    async (text) => {
      const response = await smartflowApi.getAIWorkflowPrefill(text, {
        workflow_intent: activeWorkflow?.missingFields?.length ? activeWorkflow.intent : undefined,
        current_values: activeWorkflow?.missingFields?.length ? activeWorkflow.prefill || {} : {},
      });
      const data = getApiData(response);
      const intent = data?.workflow?.intent;

      if (!intent || intent === 'unknown') {
        return null;
      }

      const mergedPrefill = mergePrefill(activeWorkflow?.prefill, data.prefill);
      const missingFields = Array.isArray(data.missing_fields) ? data.missing_fields : [];
      const nextWorkflow = {
        intent,
        prefill: mergedPrefill,
        missingFields,
        readyToCreate: Boolean(data.ready_to_create),
        submitLabel: data.submit_label || 'Confirm and Execute',
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
      const text = rawText.trim();
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
      recognition.lang = 'en-US';

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
          setInterimTranscript(finalText.trim());
          transcriptRef.current = finalText.trim();
        } else {
          transcriptRef.current = partial.trim();
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
  }, [pushMessage, sendPrompt]);

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
            <Sparkles className="text-cyan-400" size={18} />
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
                  className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors text-xs font-semibold flex items-center gap-2"
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
                className="w-full text-left px-4 py-3 bg-[#11C7E5]/5 border border-[#11C7E5]/10 rounded-xl text-xs text-cyan-300 font-semibold hover:bg-[#11C7E5]/10 transition-colors"
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
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!isSessionActive ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-32 h-32 rounded-full bg-cyan-500/10 flex items-center justify-center mb-8 border border-cyan-500/20">
              <Mic size={48} className="text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Start AI Voice Assistant</h2>
            <p className="text-slate-400 text-sm mb-8 text-center max-w-sm">
              Talk to Mabdel AI, switch to text instantly, and execute business workflows from the same thread.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSessionActive(true)}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-[#070a13] font-bold rounded-full transition-all shadow-lg shadow-cyan-500/20 text-lg flex items-center gap-2"
              >
                <Phone size={20} />
                Connect
              </button>
              <button
                onClick={startListening}
                className="px-6 py-4 bg-slate-900 border border-slate-800 text-cyan-300 rounded-full font-bold text-sm flex items-center gap-2"
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
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-cyan-400 animate-pulse' : isThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
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
                        ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-50 rounded-br-none'
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
                  <div className="max-w-[78%] px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-3xl rounded-br-none">
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
                    <Loader2 size={14} className="animate-spin text-cyan-400" />
                    AI is thinking...
                  </div>
                </motion.div>
              ) : null}

              {activeWorkflow?.intent && !activeWorkflow.missingFields?.length ? (
                <div className="flex justify-start">
                  <div className="max-w-[78%] p-4 rounded-3xl rounded-bl-none bg-[#11C7E5]/8 border border-[#11C7E5]/20 text-white">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300 mb-3">
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
                        className="px-4 py-2 rounded-xl bg-cyan-500 text-[#031218] font-bold text-sm disabled:opacity-60"
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
                      ? 'bg-cyan-500 text-[#070a13] shadow-cyan-500/20'
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
                  className="w-14 h-14 rounded-2xl bg-cyan-500 text-[#031218] flex items-center justify-center font-bold disabled:opacity-60"
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
