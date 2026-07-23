import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Mic, X } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import {
  AI_LANGUAGE_OPTIONS,
  getFieldQuestion,
  getInitialPrompt,
  getStoredAiLanguage,
  normalizeVoiceWorkflowTranscript,
} from '../../utils/voiceAgentConfig';

const INPUT_CLS = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';

const DESIRED_FIELDS = {
  agreement: ['prompt', 'client_name', 'client_email', 'client_phone', 'agreement_type', 'start_date'],
  lease: ['prompt', 'tenant_name', 'tenant_email', 'tenant_phone', 'monthly_rent', 'start_date', 'end_date'],
  invoice: ['client_name', 'client_email', 'items', 'due_date'],
};
const NOISY_TRANSCRIPTS = new Set(['you', 'yeah', 'ya', 'yo', 'uh', 'um', 'hmm', 'hm']);
const SPOKEN_DIGITS = {
  zero: '0',
  oh: '0',
  o: '0',
  one: '1',
  two: '2',
  to: '2',
  too: '2',
  three: '3',
  four: '4',
  for: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  ate: '8',
  nine: '9',
};
const normalizeVoiceText = (value) => normalizeVoiceWorkflowTranscript(value);
const isEmptyValue = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
const humanizeField = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const stripFiller = (text) =>
  String(text || '')
    .replace(
      /^(?:the\s+)?(?:client|tenant|landlord|property|agreement|lease|invoice|full|contact|my|his|her|their)?\s*(?:name|email|phone|address|type|date|rent|deposit|amount|start|end|due|number|title|subject|content|items?)\s+(?:is|are|would be|will be|:)\s*/i,
      '',
    )
    .replace(/^(?:it'?s|it is|its|that'?s|that is|this is|mine is|i think|i believe)\s*/i, '')
    .replace(/^(?:is|are|:)\s*/i, '')
    .trim();

const parseItemsFromText = (text) => {
  const cleaned = stripFiller(text).trim();
  if (!cleaned) return [];

  const qtyMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s+/);
  const quantity = qtyMatch ? Number.parseFloat(qtyMatch[1]) : 1;
  const priceMatch = cleaned.match(
    /\$\s*([\d,]+(?:\.\d{1,2})?)|(\b[\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|usd|each|per\b)/i,
  );
  const unitPrice = priceMatch
    ? Number.parseFloat(String(priceMatch[1] || priceMatch[2]).replace(/,/g, ''))
    : 0;

  const description = cleaned
    .replace(/^(\d+(?:\.\d+)?)\s+/, '')
    .replace(/\s*(at|@|for|costing|worth)\s*\$?[\d,]+(?:\.\d{1,2})?\s*(?:each|per\s+\w+)?/i, '')
    .replace(/\$[\d,]+(?:\.\d{1,2})?/g, '')
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:dollars?|usd|each)\b/gi, '')
    .trim() || 'Service';

  return [{ description, quantity, unit_price: unitPrice }];
};

const formatValue = (key, value) => {
  if (isEmptyValue(value)) return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (key === 'items') {
      return value
        .map((item) => `${item.description || 'Service'} x${item.quantity || 1} @ $${item.unit_price || 0}`)
        .join(', ');
    }
    return value.join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const mergePrefill = (previous = {}, incoming = {}) => {
  const merged = { ...previous };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (!isEmptyValue(value)) merged[key] = value;
  });
  return merged;
};

const parseSpokenPhone = (rawValue) => {
  const sanitized = String(rawValue || '')
    .toLowerCase()
    .replace(/[(),]/g, ' ')
    .replace(/\bphone number\b/g, ' ')
    .replace(/\bnumber\b/g, ' ')
    .replace(/\bplus\b/g, ' + ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return '';

  const tokens = sanitized.split(' ');
  let digits = '';
  let prefix = '';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];

    if (token === '+' && !digits && !prefix) {
      prefix = '+';
      continue;
    }

    if ((token === 'double' || token === 'triple') && next) {
      const mapped = SPOKEN_DIGITS[next] || (/^\d$/.test(next) ? next : '');
      if (mapped) {
        digits += mapped.repeat(token === 'double' ? 2 : 3);
        index += 1;
      }
      continue;
    }

    if (SPOKEN_DIGITS[token]) {
      digits += SPOKEN_DIGITS[token];
      continue;
    }

    if (/^\d+$/.test(token)) {
      digits += token;
    }
  }

  if (digits.length < 7) return '';
  return `${prefix}${digits}`;
};

const extractFieldValue = (fieldKey, rawValue) => {
  const value = normalizeVoiceText(rawValue);
  if (!value) return '';

  if (fieldKey.includes('email')) {
    const match = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : value;
  }

  if (fieldKey.includes('phone')) {
    const match = value.match(/[+]?[0-9][0-9\s\-().]{6,}/);
    if (match) return match[0].trim();
    const spokenPhone = parseSpokenPhone(value);
    return spokenPhone || value;
  }

  if (fieldKey === 'monthly_rent') {
    const match = value.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
    return match ? match[1].replace(/,/g, '') : value;
  }

  if (fieldKey === 'items') {
    return parseItemsFromText(value);
  }

  return stripFiller(value);
};

const validateField = (fieldKey, value) => {
  if (isEmptyValue(value)) return false;
  const text = String(value);
  if (fieldKey.includes('email')) return text.includes('@') && text.includes('.');
  if (fieldKey.includes('phone')) return text.replace(/\D/g, '').length >= 7;
  if (fieldKey === 'monthly_rent') return /\d/.test(text);
  if (fieldKey === 'items') return Array.isArray(value) && value.length > 0;
  return true;
};

const buildConfirmationText = (prefill, workflowIntent, label) => {
  if (workflowIntent === 'agreement') {
    const client = prefill.client_name || 'the client';
    const type = String(prefill.agreement_type || 'agreement').toUpperCase();
    const startDate = prefill.start_date ? ` starting ${prefill.start_date}` : '';
    return `I'll create a ${type} for ${client}${startDate}.`;
  }
  if (workflowIntent === 'lease') {
    const tenant = prefill.tenant_name || 'the tenant';
    const rent = prefill.monthly_rent ? ` at $${prefill.monthly_rent}/month` : '';
    return `I'll create a lease for ${tenant}${rent}.`;
  }
  if (workflowIntent === 'invoice') {
    const client = prefill.client_name || 'the client';
    const itemCount = Array.isArray(prefill.items) ? prefill.items.length : 0;
    const due = prefill.due_date ? `, due ${prefill.due_date}` : '';
    return `I'll create an invoice for ${client} with ${itemCount} item${itemCount === 1 ? '' : 's'}${due}.`;
  }
  return `I'll fill the ${label.toLowerCase()} with the collected details.`;
};

export default function VoiceFormFillModal({ workflowIntent, label, currentValues, onApply, buttonClassName = '', children }) {
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);
  const questionStartedRef = useRef(-1);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [voiceInput, setVoiceInput] = useState('');
  const [prefill, setPrefill] = useState({});
  const [missingFields, setMissingFields] = useState([]);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiLanguage, setAiLanguage] = useState('en-US');
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [permissionState, setPermissionState] = useState('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [listeningHint, setListeningHint] = useState('');

  const currentField = missingFields[fieldIdx] || null;
  const currentQuestion = currentField
    ? getFieldQuestion(aiLanguage, workflowIntent, currentField)
    : '';
  const currentLanguageName = AI_LANGUAGE_OPTIONS.find((language) => language.code === aiLanguage)?.name || 'English';

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetState = useCallback(() => {
    stopListening();
    setPhase('initial');
    setVoiceInput('');
    setPrefill(currentValues || {});
    setMissingFields([]);
    setFieldIdx(0);
    questionStartedRef.current = -1;
    setError('');
    setLoading(false);
    setAssistantPrompt('');
    setPermissionState('idle');
    setLiveTranscript('');
    setListeningHint('');
  }, [currentValues, stopListening]);

  const handleOpen = useCallback(() => {
    resetState();
    setAiLanguage(getStoredAiLanguage());
    setOpen(true);
  }, [resetState]);

  const handleClose = useCallback(() => {
    stopListening();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    setOpen(false);
    setPhase('idle');
    setAssistantPrompt('');
    setLiveTranscript('');
    setListeningHint('');
  }, [stopListening]);

  const transcribeRecordedAudio = useCallback(async (blob, durationMs = 0) => {
    if (!blob?.size) {
      setError('Recorded audio was empty. Please try again.');
      setListeningHint('No audio captured.');
      return;
    }

    setLoading(true);
    setError('');
    setListeningHint('Transcribing your recording...');
    try {
      const response = await smartflowApi.transcribeAudio(blob);
      const data = response?.data?.data || response?.data || {};
      const transcript = normalizeVoiceText(data?.transcript || '');

      if (!transcript) {
        setError('No speech detected. Please try again and speak a bit louder, or type your answer below.');
        setListeningHint('No speech detected in recording.');
        return;
      }

      if ((transcript.length < 4 || NOISY_TRANSCRIPTS.has(transcript.toLowerCase())) && durationMs < 2500) {
        setError('Could not clearly hear you. Please try again, speak a bit longer, or type your answer below.');
        setListeningHint(`Unclear transcript: "${transcript}"`);
        return;
      }

      setVoiceInput(transcript);
      setLiveTranscript(transcript);
      setListeningHint('Transcript captured. Review it, then submit.');
    } catch (transcribeError) {
      setError(transcribeError?.response?.data?.message || 'Could not transcribe the recording.');
      setListeningHint('Transcription failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setPermissionState('unsupported');
        setError('Audio recording is not supported in this browser.');
        return false;
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstart = () => {
        setError('');
        setPermissionState('granted');
        setIsListening(true);
        setVoiceInput('');
        setLiveTranscript('');
        recordingStartedAtRef.current = Date.now();
        setListeningHint('Recording... click the mic again when you finish speaking.');
      };
      recorder.onstop = async () => {
        setIsListening(false);
        setListeningHint('Processing your recording...');
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        await transcribeRecordedAudio(blob, durationMs);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      return true;
    } catch {
      setError('Could not start microphone listening.');
      return false;
    }
  }, [isListening, stopListening, transcribeRecordedAudio]);

  const handleInitialSubmit = useCallback(async () => {
    const transcript = normalizeVoiceText(voiceInput);
    if (!transcript) {
      setError(`Please describe the ${label.toLowerCase()} first.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await smartflowApi.getAIWorkflowPrefill(transcript, {
        workflow_intent: workflowIntent,
        current_values: currentValues || {},
      });
      const data = response?.data?.data || response?.data || {};
      const merged = mergePrefill(currentValues || {}, data.prefill || {});
      const backendMissing = Array.isArray(data.missing_fields) ? data.missing_fields : [];
      const desiredMissing = (DESIRED_FIELDS[workflowIntent] || []).filter((fieldKey) => isEmptyValue(merged[fieldKey]));
      const allMissing = [...new Set([...backendMissing, ...desiredMissing])];

      setPrefill(merged);
      if (allMissing.length) {
        setMissingFields(allMissing);
        setFieldIdx(0);
        questionStartedRef.current = -1;
        setVoiceInput('');
        setLiveTranscript('');
        setPhase('question');
      } else {
        setPhase('confirm');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not process the voice request.');
    } finally {
      setLoading(false);
    }
  }, [currentValues, label, voiceInput, workflowIntent]);

  const handleAnswerSubmit = useCallback(() => {
    if (!currentField) return;
    const extracted = extractFieldValue(currentField, voiceInput);
    if (!validateField(currentField, extracted)) {
      setError(`Please provide a valid ${humanizeField(currentField).toLowerCase()}.`);
      return;
    }

    const nextPrefill = { ...prefill, [currentField]: extracted };
    setPrefill(nextPrefill);
    setVoiceInput('');
    setLiveTranscript('');
    setError('');
    setListeningHint('');

    if (fieldIdx + 1 >= missingFields.length) {
      setPhase('confirm');
    } else {
      setFieldIdx((prev) => prev + 1);
    }
  }, [currentField, fieldIdx, missingFields.length, prefill, voiceInput]);

  const handleConfirm = useCallback(() => {
    onApply?.(prefill);
    handleClose();
  }, [handleClose, onApply, prefill]);

  const collectedFields = Object.entries(prefill).filter(([, value]) => !isEmptyValue(value));
  const confirmText = buildConfirmationText(prefill, workflowIntent, label);

  useEffect(() => {
    if (!open) return;
    if (phase === 'question' && currentQuestion) {
      setAssistantPrompt(currentQuestion);
      questionStartedRef.current = fieldIdx;
      return;
    }
    if (phase === 'initial') {
      setAssistantPrompt(getInitialPrompt(aiLanguage, workflowIntent));
      return;
    }
    if (phase === 'confirm') {
      setAssistantPrompt(confirmText);
    }
  }, [aiLanguage, confirmText, currentQuestion, fieldIdx, open, phase, workflowIntent]);

  return (
    <>
      <button type="button" onClick={handleOpen} className={buttonClassName} title={`Fill ${label} with voice`}>
        {children || <Mic size={18} />}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#02080B]/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-2xl bg-[#131A24] border border-[#243041] rounded-3xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[#243041]/40 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{label} Voice Fill</h3>
                  <p className="text-[#A4B0B7] text-xs mt-1">
                    {phase === 'confirm'
                      ? `${confirmText} Review the details, then fill the form.`
                      : phase === 'question' && currentQuestion
                      ? currentQuestion
                      : `Describe the ${label.toLowerCase()} and I'll ask for the missing details.`}
                  </p>
                </div>
                <button type="button" onClick={handleClose} className="text-[#A4B0B7] hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {assistantPrompt ? (
                  <div className="rounded-2xl border border-[#11C7E5]/20 bg-[#07131B] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#11C7E5] mb-2">AI prompt</p>
                    <p className="text-sm text-[#D5E3F5]">{assistantPrompt}</p>
                  </div>
                ) : null}

                {collectedFields.length ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                    {collectedFields.map(([key, value]) => (
                      <div key={key} className="flex gap-2 text-sm">
                        <span className="text-emerald-300 font-semibold min-w-32">{humanizeField(key)}:</span>
                        <span className="text-[#D5E3F5] break-words">{formatValue(key, value)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {error ? (
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {error}
                  </div>
                ) : null}

                {phase === 'confirm' ? (
                  <div className="rounded-2xl border border-[#11C7E5]/20 bg-[#07131B] p-4">
                    <p className="text-[#11C7E5] text-sm font-semibold">{confirmText}</p>
                  </div>
                ) : null}

                <div className="relative">
                  <textarea
                    value={voiceInput}
                    onChange={(event) => setVoiceInput(event.target.value)}
                    placeholder={phase === 'question' && currentQuestion ? currentQuestion : `Create ${label.toLowerCase()} draft with voice...`}
                    className={`${INPUT_CLS} min-h-28 resize-none pr-12`}
                  />
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isListening ? 'bg-[#11C7E5] text-[#02080B]' : 'bg-[#0A1019] border border-[#11C7E5]/30 text-[#11C7E5]'}`}
                  >
                    {isListening ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  </button>
                </div>

                {isListening ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        Listening in {currentLanguageName}...
                      </p>
                      <span className="text-cyan-300 text-xs">Live transcript</span>
                    </div>
                    <p className="text-sm text-cyan-50 min-h-[22px]">
                      {liveTranscript || 'Start speaking...'}
                    </p>
                  </div>
                ) : null}

                {listeningHint && !isListening ? (
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                    <p className="text-xs text-slate-300">{listeningHint}</p>
                  </div>
                ) : null}

                {phase === 'question' && missingFields.length ? (
                  <p className="text-xs text-[#A4B0B7]">Question {fieldIdx + 1} of {missingFields.length}</p>
                ) : null}
                {phase === 'initial' ? (
                  <p className="text-xs text-[#A4B0B7]">
                    {isListening ? 'Listening... speak naturally, then click Start Voice Fill.' : loading ? 'Processing your request...' : 'You can speak or type the first description.'}
                  </p>
                ) : null}
                {permissionState === 'denied' ? (
                  <p className="text-xs text-rose-300">Microphone permission was denied. You can still type your answer.</p>
                ) : null}
                {permissionState === 'unsupported' ? (
                  <p className="text-xs text-rose-300">This browser does not support speech recognition. Please type your answer.</p>
                ) : null}
              </div>

              <div className="px-6 py-5 border-t border-[#243041]/40 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 border border-[#243041] text-[#A4B0B7] hover:text-white hover:border-[#11C7E5]/30 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                {phase === 'confirm' ? (
                  <button type="button" onClick={handleConfirm} className="flex-1 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold">
                    Fill Form
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={phase === 'question' ? handleAnswerSubmit : handleInitialSubmit}
                    disabled={loading || (!normalizeVoiceText(voiceInput) && !isListening)}
                    className="flex-1 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {phase === 'question' ? 'Use This Answer' : isListening ? 'Submit Voice Fill' : 'Start Voice Fill'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
