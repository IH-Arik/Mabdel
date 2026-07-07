import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppLanguage } from "../context/LanguageContext";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CheckCircle2, Edit3, Mic, MicOff, X } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useAiLanguage } from "../context/LanguageContext";
let Speech = null;
try {
  Speech = require("expo-speech");
} catch {
  // TTS not available in this build — visual-only mode
}
import { useMadbelAiWorkflowPrefillMutation } from "../redux/slices/madbelApiSlice";

// ─── Phase state machine ──────────────────────────────────────────────────────
const PHASE = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  QUESTIONING: "questioning",
  LISTENING_ANSWER: "listening_answer",
  CONFIRMING: "confirming",
  COMPLETE: "complete",
};

// Fields that should always be asked even if backend thinks we're ready
const DESIRED_FIELDS = {
  agreement: ["prompt", "client_name", "client_email", "client_phone", "agreement_type", "start_date"],
  lease: ["prompt", "tenant_name", "tenant_email", "tenant_phone", "monthly_rent", "start_date", "end_date"],
  invoice: ["client_name", "client_email", "items", "due_date"],
  bulk_message: ["content", "subject", "recipients"],
  calendar: ["title", "starts_at", "ends_at"],
  contact: ["first_name", "last_name", "phone", "email", "date_of_birth", "notes"],
};

const FIELD_LABELS = {
  prompt: "Description", title: "Title", client_name: "Client",
  client_email: "Email", client_phone: "Phone", agreement_type: "Type",
  start_date: "Start date", end_date: "End date", content: "Content",
  tenant_name: "Tenant", tenant_email: "Tenant email", tenant_phone: "Tenant phone",
  landlord_name: "Landlord", property_address: "Address", property_type: "Property type",
  monthly_rent: "Monthly rent", security_deposit: "Deposit", due_date: "Due date",
  items: "Items", notes: "Notes", subject: "Subject", channel: "Channel",
  recipients: "Recipients", starts_at: "Start time", ends_at: "End time",
  description: "Description",
  first_name: "First name", last_name: "Last name", phone: "Phone",
  email: "Email", date_of_birth: "Date of birth",
};

// Retry hints shown when extracted value fails validation
const RETRY_HINTS = {
  client_email: "I didn't catch a valid email. Please say: name, then AT, then gmail, then DOT, then com.",
  tenant_email: "I didn't catch a valid email. Please say: name AT domain DOT com.",
  email: "I didn't catch a valid email. Please say: name AT domain DOT com.",
  client_phone: "I need a phone number with at least 7 digits. Please repeat.",
  tenant_phone: "I need a phone number with at least 7 digits. Please repeat.",
  phone: "I need a phone number with at least 7 digits. Please repeat.",
  monthly_rent: "I need a number. Please say the amount, like: 2500 dollars.",
  security_deposit: "I need a number. Please say the amount, like: 5000 dollars.",
};

// ─── TTS ─────────────────────────────────────────────────────────────────────
const speakText = (text, options = {}) => {
  const { t } = useAppLanguage();

  try {
    if (!Speech) return false;
    Speech.stop();
    Speech.speak(text, { language: "en-US", pitch: 1.0, rate: 0.92, ...options });
    return true;
  } catch {
    return false;
  }
};

const stopSpeech = () => {
  try { Speech?.stop(); } catch { /* ignore */ }
};

// ─── Validation ───────────────────────────────────────────────────────────────
const validateFieldAnswer = (fieldKey, value) => {
  if (typeof value === "object") return true; // arrays (items) are always valid if non-empty
  const v = String(value || "").trim();
  if (!v) return false;
  if (fieldKey.includes("email")) return v.includes("@") && v.includes(".");
  if (fieldKey.includes("phone")) return (v.replace(/\D/g, "").length >= 7);
  if (["monthly_rent", "security_deposit"].includes(fieldKey)) return /\d+/.test(v);
  return true;
};

// ─── Smart extraction ─────────────────────────────────────────────────────────
const stripFiller = (text) =>
  text
    .replace(
      /^(?:the\s+)?(?:client|tenant|landlord|property|agreement|lease|full|contact|my|his|her|their)?\s*(?:name|email|phone|address|type|date|rent|deposit|amount|start|end|due|number|title|subject|content)\s+(?:is|are|would be|will be|:)\s*/i,
      "",
    )
    .replace(/^(?:it'?s|it is|its|that'?s|that is|this is|mine is|i think|i believe)\s*/i, "")
    .replace(/^(?:is|are|:)\s*/i, "")
    .trim();

const parseItemsFromText = (text) => {
  const cleaned = stripFiller(text).trim();
  if (!cleaned) return [];
  const qtyMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s+/);
  const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 1;
  const priceMatch = cleaned.match(
    /\$\s*([\d,]+(?:\.\d{1,2})?)|(\b[\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|usd|each|per\b)/i,
  );
  const price = priceMatch
    ? parseFloat((priceMatch[1] || priceMatch[2]).replace(/,/g, ""))
    : 0;
  const desc = cleaned
    .replace(/^(\d+(?:\.\d+)?)\s+/, "")
    .replace(/\s*(at|@|for|costing|worth)\s*\$?[\d,]+(?:\.\d{1,2})?\s*(?:each|per\s+\w+)?/i, "")
    .replace(/\$[\d,]+(?:\.\d{1,2})?/g, "")
    .replace(/\b[\d,]+(?:\.\d{1,2})?\s*(?:dollars?|usd|each)\b/gi, "")
    .trim() || "Service";
  return [{ description: desc, details: "", quantity: String(qty), unit_price: String(price) }];
};

// Converts spoken email in any language to a valid email string.
// Step 1: direct regex (user said it correctly with @ and .)
// Step 2: replace phonetic "at" and "dot" words in all 10 supported languages,
//         collapse spaces, then retry regex.
const extractEmail = (text) => {
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i;

  const direct = text.match(EMAIL_RE);
  if (direct) return direct[0].toLowerCase();

  let t = text
    // ── "at" symbol phonetics ────────────────────────────────────────────
    .replace(/এট|এ্যাট/g, "@")          // Bengali
    .replace(/एट|ऐट/g, "@")             // Hindi
    .replace(/\bآت\b|\bات\b/g, "@")     // Arabic
    .replace(/эт/gi, "@")               // Russian
    .replace(/ایٹ/g, "@")              // Urdu
    .replace(/\barroba\b/gi, "@")       // Spanish / Portuguese
    .replace(/\barobase\b/gi, "@")      // French
    // ── "dot" phonetics ─────────────────────────────────────────────────
    .replace(/ডট/g, ".")               // Bengali
    .replace(/डॉट|डोट/g, ".")          // Hindi
    .replace(/\bدوت\b|\bنقطة\b/g, ".") // Arabic
    .replace(/точка/gi, ".")            // Russian
    .replace(/ڈاٹ/g, ".")             // Urdu
    .replace(/\bnokta\b/gi, ".")        // Turkish
    .replace(/\bpunto\b/gi, ".")        // Spanish
    .replace(/\bponto\b/gi, ".")        // Portuguese
    .replace(/\bpoint\b/gi, ".")        // French
    // ── Universal English spoken words (used across all languages) ───────
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    // ── Collapse spaces so "john @ gmail . com" → "john@gmail.com" ───────
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, "");

  const m = t.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : "";
};

const extractFieldValue = (fieldKey, rawAnswer) => {
  const answer = rawAnswer.trim();
  if (!answer) return "";
  if (fieldKey === "items") return parseItemsFromText(answer);
  if (fieldKey.includes("email")) {
    return extractEmail(answer);
  }
  if (fieldKey.includes("phone")) {
    const m = answer.match(/[+]?[\d][\d\s\-().]{6,}/);
    if (m) return m[0].trim();
  }
  if (["monthly_rent", "security_deposit"].includes(fieldKey)) {
    const m = answer.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
    if (m) return m[1].replace(/,/g, "");
  }
  if (fieldKey === "channel") {
    return /sms|text/i.test(answer) ? "sms" : "email";
  }
  if (fieldKey === "agreement_type") {
    if (/nda/i.test(answer)) return "nda";
    if (/service/i.test(answer)) return "service";
    if (/lease/i.test(answer)) return "lease";
    if (/employment/i.test(answer)) return "employment";
    if (/contract/i.test(answer)) return "contract";
    return stripFiller(answer).toLowerCase();
  }
  if (fieldKey === "property_type") {
    if (/apartment|flat/i.test(answer)) return "apartment";
    if (/house|villa/i.test(answer)) return "house";
    if (/office/i.test(answer)) return "office";
    if (/commercial/i.test(answer)) return "commercial";
    return stripFiller(answer).toLowerCase();
  }
  return stripFiller(answer);
};

// ─── Confirmation summary ─────────────────────────────────────────────────────
const buildConfirmationText = (prefill, intent) => {
  const p = prefill;
  if (intent === "invoice") {
    const client = p.client_name || "the client";
    const itemCount = Array.isArray(p.items) ? p.items.length : 0;
    const due = p.due_date ? `, due ${p.due_date}` : "";
    return `I'll create an invoice for ${client} with ${itemCount} item${itemCount !== 1 ? "s" : ""}${due}. Does that look right?`;
  }
  if (intent === "agreement") {
    const client = p.client_name || "the client";
    const type = p.agreement_type ? p.agreement_type.toUpperCase() : "agreement";
    const date = p.start_date ? ` starting ${p.start_date}` : "";
    return `I'll create a ${type} for ${client}${date}. Does that look right?`;
  }
  if (intent === "lease") {
    const tenant = p.tenant_name || "the tenant";
    const rent = p.monthly_rent ? ` at $${p.monthly_rent}/month` : "";
    return `I'll create a lease for ${tenant}${rent}. Does that look right?`;
  }
  if (intent === "contact") {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "the contact";
    const phone = p.phone ? `, phone ${p.phone}` : "";
    const email = p.email ? `, email ${p.email}` : "";
    return `I'll save ${name}${phone}${email}. Does that look right?`;
  }
  const count = Object.values(p).filter((v) => v && v !== "").length;
  return `I've collected ${count} fields. Does everything look right?`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatValue = (key, value) => {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (key === "items")
      return value.map((i) => `${i.description} ×${i.quantity} @ $${i.unit_price}`).join(", ");
    return value.join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const mergePrefill = (base, incoming) => {
  const result = { ...base };
  Object.entries(incoming).forEach(([k, v]) => {
    const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
    if (!empty) result[k] = v;
  });
  return result;
};

// ─── Component ────────────────────────────────────────────────────────────────
const VoiceFormFillCard = ({
  label = "form",
  workflowIntent,
  sourceScreen,
  currentValues,
  triggerOpen = 0, // increment from parent to open modal programmatically
}) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { aiLanguage, currentAiLang, getPrompt, getQuestion } = useAiLanguage();
  const scrollRef = useRef(null);
  const phaseRef = useRef(PHASE.IDLE);
  const lastAutoStartedIdxRef = useRef(-1);
  const retryRef = useRef({});
  const handleOpenRef = useRef(null); // stable ref so triggerOpen effect always calls latest handleOpen

  const [modalVisible, setModalVisible] = useState(false);
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [voiceInput, setVoiceInput] = useState("");
  const [accPrefill, setAccPrefill] = useState({});
  const [missingFields, setMissingFields] = useState([]);
  const [fieldIdx, setFieldIdx] = useState(0);
  const [errorText, setErrorText] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const [workflowPrefill] = useMadbelAiWorkflowPrefillMutation();

  // Keep phaseRef synced (avoids stale closure in speech event handlers)
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const isListening = phase === PHASE.LISTENING || phase === PHASE.LISTENING_ANSWER;
  const isProcessing = phase === PHASE.PROCESSING;
  const isInitial = phase === PHASE.LISTENING || phase === PHASE.PROCESSING;
  const isConfirming = phase === PHASE.CONFIRMING;
  const currentFieldKey = missingFields[fieldIdx] ?? null;
  const currentQuestion = currentFieldKey
    ? (getQuestion(workflowIntent, currentFieldKey) ||
      `What is the ${FIELD_LABELS[currentFieldKey] ?? currentFieldKey}?`)
    : null;
  const totalQuestions = missingFields.length;
  const progressPct = totalQuestions > 0 ? (fieldIdx / totalQuestions) * 100 : 0;

  // ─── Speech recognition ───────────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript;
    if (text) setVoiceInput(text);
  });

  useSpeechRecognitionEvent("end", () => {
    if (phaseRef.current === PHASE.LISTENING_ANSWER) setPhase(PHASE.QUESTIONING);
  });

  useEffect(() => {
    if (!modalVisible) ExpoSpeechRecognitionModule.stop();
  }, [modalVisible]);

  useEffect(() => {
    const timer = setTimeout(
      () => scrollRef.current?.scrollToEnd?.({ animated: true }),
      100,
    );
    return () => clearTimeout(timer);
  }, [Object.keys(accPrefill).length]);

  // Auto-start recording once per question (or on retry via lastAutoStartedIdx reset)
  useEffect(() => {
    if (phase !== PHASE.QUESTIONING) return;
    if (lastAutoStartedIdxRef.current === fieldIdx) return;
    lastAutoStartedIdxRef.current = fieldIdx;

    const fieldKey = missingFields[fieldIdx];
    // Email fields always use English STT — email addresses are Latin-only
    const fieldLang = fieldKey?.includes("email") ? "en-US" : aiLanguage;
    const question =
      getQuestion(workflowIntent, fieldKey) ||
      `What is the ${FIELD_LABELS[fieldKey] ?? fieldKey}?`;

    const startListening = async () => {
      try {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) return;
        setVoiceInput("");
        ExpoSpeechRecognitionModule.start({
          lang: fieldLang,
          interimResults: true,
          maxAlternatives: 1,
        });
        setPhase(PHASE.LISTENING_ANSWER);
      } catch { /* user can type manually */ }
    };

    const spoken = speakText(question, { language: aiLanguage, onDone: startListening });
    let fallback = null;
    if (!spoken) fallback = setTimeout(startListening, 700);
    return () => { if (fallback) clearTimeout(fallback); };
  }, [phase, fieldIdx, missingFields, workflowIntent, aiLanguage, getQuestion]);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) { setErrorText("Microphone permission denied."); return false; }
      ExpoSpeechRecognitionModule.start({
        lang: aiLanguage,
        interimResults: true,
        maxAlternatives: 1,
      });
      return true;
    } catch { return false; }
  }, [aiLanguage]);

  const applyToScreen = useCallback(
    (prefill) => {
      if (route?.name === sourceScreen) {
        navigation.setParams?.({ prefill });
      } else if (sourceScreen) {
        navigation.navigate(sourceScreen, { prefill });
      }
    },
    [navigation, route?.name, sourceScreen],
  );

  // ─── Open / Close ─────────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    lastAutoStartedIdxRef.current = -1;
    retryRef.current = {};
    setAccPrefill({});
    setMissingFields([]);
    setFieldIdx(0);
    setVoiceInput("");
    setErrorText("");
    setConfirmText("");
    setPhase(PHASE.LISTENING);
    setModalVisible(true);
    const prompt = getPrompt(workflowIntent) || `Tell me about the ${label} in one sentence.`;
    const spoken = speakText(prompt, { language: aiLanguage, onDone: startRecording });
    if (!spoken) setTimeout(startRecording, 600);
  }, [label, workflowIntent, aiLanguage, getPrompt, startRecording]);

  // Keep handleOpenRef pointing at the latest handleOpen
  useEffect(() => { handleOpenRef.current = handleOpen; }, [handleOpen]);

  // Parent can increment triggerOpen to open the modal without rendering the mic button themselves
  useEffect(() => {
    if (!triggerOpen) return;
    handleOpenRef.current?.();
  }, [triggerOpen]);

  const handleClose = useCallback(() => {
    stopSpeech();
    ExpoSpeechRecognitionModule.stop();
    setModalVisible(false);
    setPhase(PHASE.IDLE);
    setVoiceInput("");
    setErrorText("");
  }, []);

  // ─── Initial submit ───────────────────────────────────────────────────────
  const handleInitialSubmit = useCallback(async () => {
    const transcript = voiceInput.trim();
    if (!transcript) { setErrorText("Please speak or type a command first."); return; }
    ExpoSpeechRecognitionModule.stop();
    setPhase(PHASE.PROCESSING);
    setErrorText("");

    try {
      const res = await workflowPrefill({
        transcript,
        workflow_intent: workflowIntent,
        current_values: currentValues || {},
      }).unwrap();

      const payload = res?.data ?? res ?? {};
      const newPrefill = mergePrefill(currentValues || {}, payload?.prefill ?? {});
      const backendMissing = Array.isArray(payload?.missing_fields) ? payload.missing_fields : [];
      const desired = DESIRED_FIELDS[workflowIntent] ?? [];
      const isEmpty = (v) =>
        v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
      const unfilledDesired = desired.filter((f) => isEmpty(newPrefill[f]));
      const allAsk = [...new Set([...backendMissing, ...unfilledDesired])].filter(
        (f) => !!getQuestion(workflowIntent, f),
      );

      setAccPrefill(newPrefill);

      if (!allAsk.length) {
        enterConfirming(newPrefill);
        return;
      }

      lastAutoStartedIdxRef.current = -1;
      setMissingFields(allAsk);
      setFieldIdx(0);
      setVoiceInput("");
      setPhase(PHASE.QUESTIONING);
    } catch (err) {
      setErrorText(err?.data?.message ?? "Could not process. Please try again.");
      setPhase(PHASE.LISTENING);
    }
  }, [voiceInput, workflowIntent, currentValues, workflowPrefill, getQuestion]);

  // ─── Confirmation ─────────────────────────────────────────────────────────
  const enterConfirming = useCallback((prefill) => {
    const text = buildConfirmationText(prefill, workflowIntent);
    setConfirmText(text);
    setPhase(PHASE.CONFIRMING);
    speakText(text, { language: aiLanguage });
  }, [workflowIntent, aiLanguage]);

  const handleConfirm = useCallback(() => {
    speakText("All done! Filling in your form now.", { language: aiLanguage });
    applyToScreen(accPrefill);
    setTimeout(handleClose, 1800);
  }, [accPrefill, aiLanguage, applyToScreen, handleClose]);

  const handleEditFromConfirm = useCallback(() => {
    stopSpeech();
    lastAutoStartedIdxRef.current = -1;
    setFieldIdx(0);
    setVoiceInput("");
    setErrorText("");
    setPhase(PHASE.QUESTIONING);
  }, []);

  // ─── Tap a collected field to re-ask ──────────────────────────────────────
  const handleEditField = useCallback((fieldKey) => {
    stopSpeech();
    setAccPrefill((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    retryRef.current[fieldKey] = 0;
    setMissingFields((prev) => {
      const without = prev.filter((f) => f !== fieldKey);
      return [fieldKey, ...without];
    });
    setFieldIdx(0);
    lastAutoStartedIdxRef.current = -1;
    setVoiceInput("");
    setErrorText("");
    setPhase(PHASE.QUESTIONING);
  }, []);

  // ─── Retry a field with hint ──────────────────────────────────────────────
  const handleRetry = useCallback((hint, fieldKey) => {
    ExpoSpeechRecognitionModule.stop();
    setErrorText(hint);
    setVoiceInput("");
    // Email fields always use English STT on retry too
    const fieldLang = fieldKey?.includes("email") ? "en-US" : aiLanguage;

    const startListeningAgain = async () => {
      try {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) return;
        setVoiceInput("");
        ExpoSpeechRecognitionModule.start({
          lang: fieldLang,
          interimResults: true,
          maxAlternatives: 1,
        });
        setPhase(PHASE.LISTENING_ANSWER);
      } catch { /* user can type */ }
    };

    const spoken = speakText(hint, { language: aiLanguage, onDone: startListeningAgain });
    if (!spoken) setTimeout(startListeningAgain, 1500);
  }, [aiLanguage]);

  // ─── Advance to next field or finish ────────────────────────────────────
  const advanceOrFinish = useCallback(
    (answer, idx, fields, prefill) => {
      ExpoSpeechRecognitionModule.stop();
      setVoiceInput("");
      setErrorText("");

      const fieldKey = fields[idx];
      const newPrefill = { ...prefill };
      if (fieldKey && answer.trim()) {
        newPrefill[fieldKey] = extractFieldValue(fieldKey, answer);
      }
      setAccPrefill(newPrefill);

      const nextIdx = idx + 1;
      if (nextIdx < fields.length) {
        setFieldIdx(nextIdx);
        setPhase(PHASE.QUESTIONING);
      } else {
        enterConfirming(newPrefill);
      }
    },
    [enterConfirming],
  );

  // ─── Answer submit with validation + retry ────────────────────────────────
  const handleAnswerSubmit = useCallback(() => {
    const fieldKey = missingFields[fieldIdx];
    const rawAnswer = voiceInput.trim();

    if (!rawAnswer) {
      advanceOrFinish("", fieldIdx, missingFields, accPrefill);
      return;
    }

    const extracted = extractFieldValue(fieldKey, rawAnswer);
    const valid = validateFieldAnswer(fieldKey, extracted);

    if (!valid) {
      const count = retryRef.current[fieldKey] || 0;
      if (count < 2) {
        retryRef.current[fieldKey] = count + 1;
        const hint = RETRY_HINTS[fieldKey] ?? "I didn't quite catch that. Could you please repeat?";
        handleRetry(hint, fieldKey);
        return;
      }
      retryRef.current[fieldKey] = 0;
    }

    advanceOrFinish(rawAnswer, fieldIdx, missingFields, accPrefill);
  }, [voiceInput, missingFields, fieldIdx, accPrefill, advanceOrFinish, handleRetry]);

  const handleSkip = useCallback(() => {
    retryRef.current[missingFields[fieldIdx]] = 0;
    advanceOrFinish("", fieldIdx, missingFields, accPrefill);
  }, [missingFields, fieldIdx, accPrefill, advanceOrFinish]);

  const toggleMic = useCallback(async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      if (phaseRef.current === PHASE.LISTENING_ANSWER) setPhase(PHASE.QUESTIONING);
    } else {
      const ok = await startRecording();
      if (ok) {
        setPhase(
          phaseRef.current === PHASE.QUESTIONING ? PHASE.LISTENING_ANSWER : PHASE.LISTENING,
        );
      }
    }
  }, [isListening, startRecording]);

  // ─── Collected fields (filter out empties and unlabelled) ─────────────────
  const collectedEntries = Object.entries(accPrefill).filter(
    ([k, v]) => FIELD_LABELS[k] && formatValue(k, v) !== null,
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.wrap}>
      <Pressable onPress={handleOpen} style={s.micCircle}>
        <Mic color="#EAF9FF" size={32} strokeWidth={2.4} />
      </Pressable>
      <Text style={s.labelText}>Tap mic to fill {label} with AI</Text>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={handleClose}>
        <View style={s.backdrop}>
          <View style={s.card}>

            {/* Header */}
            <View style={s.header}>
              <View>
                <Text style={s.headerTitle}>
                  {String(label).charAt(0).toUpperCase() + String(label).slice(1)} AI Fill
                </Text>
                {!isInitial && !isConfirming && totalQuestions > 0 && (
                  <Text style={s.headerSub}>Question {fieldIdx + 1} of {totalQuestions}</Text>
                )}
                {isConfirming && (
                  <Text style={s.headerSub}>{t("review_confirm")}</Text>
                )}
              </View>
              <Pressable onPress={handleClose} hitSlop={12} style={s.closeBtn}>
                <X size={20} color="#7A8BAA" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Current language indicator (change in Settings → AI Voice Language) */}
            <View style={s.langIndicator}>
              <Text style={s.langIndicatorText}>
                🌐 {currentAiLang.name ?? "English"}
              </Text>
            </View>

            {/* Progress bar */}
            {!isInitial && !isConfirming && totalQuestions > 0 && (
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPct}%` }]} />
              </View>
            )}

            <ScrollView
              ref={scrollRef}
              style={s.body}
              contentContainerStyle={s.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Collected fields — tap pencil icon to re-ask */}
              {collectedEntries.length > 0 && (
                <View style={s.collected}>
                  {collectedEntries.map(([k, v]) => (
                    <Pressable
                      key={k}
                      style={s.collectedRow}
                      onPress={() => handleEditField(k)}
                      hitSlop={6}
                    >
                      <CheckCircle2 size={13} color="#2CD086" strokeWidth={2.5} />
                      <Text style={s.collectedKey}>{FIELD_LABELS[k]}:</Text>
                      <Text style={s.collectedVal} numberOfLines={1}>
                        {formatValue(k, v)}
                      </Text>
                      <Edit3 size={12} color="#3A5070" strokeWidth={2} style={s.editIcon} />
                    </Pressable>
                  ))}
                  {!isConfirming && (
                    <Text style={s.editHint}>{t("tap_a_field_to_change_it")}</Text>
                  )}
                </View>
              )}

              {/* Confirmation phase */}
              {isConfirming ? (
                <View style={s.confirmBox}>
                  <Text style={s.confirmText}>{confirmText}</Text>
                </View>
              ) : (
                <>
                  {/* Question or initial prompt */}
                  <View style={s.questionBox}>
                    {isInitial ? (
                      <Text style={s.questionText}>
                        {getPrompt(workflowIntent) || `Describe the ${label} in one sentence.`}
                      </Text>
                    ) : currentQuestion ? (
                      <Text style={s.questionText}>{currentQuestion}</Text>
                    ) : null}
                  </View>

                  {/* Voice / text input */}
                  <View style={s.inputRow}>
                    <TextInput
                      value={voiceInput}
                      onChangeText={setVoiceInput}
                      placeholder={isListening ? "Listening..." : "Speak or type..."}
                      placeholderTextColor={isListening ? "#1AC8E4" : "#4A5568"}
                      style={[s.input, isListening && s.inputActive]}
                      multiline
                      textAlignVertical="top"
                    />
                    <Pressable
                      onPress={toggleMic}
                      style={[s.micToggle, isListening && s.micToggleActive]}
                    >
                      {isListening
                        ? <MicOff size={19} color="#EAF9FF" strokeWidth={2.3} />
                        : <Mic size={19} color="#19CDEB" strokeWidth={2.3} />
                      }
                    </Pressable>
                  </View>

                  {isListening && <Text style={s.statusListening}>● Listening in {currentAiLang.name ?? "English"}...</Text>}
                  {isProcessing && (
                    <View style={s.statusRow}>
                      <ActivityIndicator size="small" color="#19CDEB" />
                      <Text style={s.statusText}>{t("processing")}</Text>
                    </View>
                  )}
                  {phase === PHASE.COMPLETE && (
                    <Text style={s.statusDone}>{t("all_set_applying_to_form")}</Text>
                  )}
                  {errorText ? <Text style={s.errorText}>{errorText}</Text> : null}
                </>
              )}
            </ScrollView>

            {/* Action buttons */}
            <View style={s.actions}>
              {isConfirming ? (
                <>
                  <Pressable style={s.btnSecondary} onPress={handleEditFromConfirm}>
                    <Text style={s.btnSecondaryText}>{t("edit")}</Text>
                  </Pressable>
                  <Pressable style={s.btnPrimary} onPress={handleConfirm}>
                    <Text style={s.btnPrimaryText}>{t("confirm")}</Text>
                  </Pressable>
                </>
              ) : isInitial ? (
                <>
                  <Pressable style={s.btnSecondary} onPress={handleClose}>
                    <Text style={s.btnSecondaryText}>{t("cancel")}</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnPrimary, (!voiceInput.trim() || isProcessing) && s.btnDisabled]}
                    onPress={handleInitialSubmit}
                    disabled={!voiceInput.trim() || isProcessing}
                  >
                    {isProcessing
                      ? <ActivityIndicator size="small" color="#031218" />
                      : <Text style={s.btnPrimaryText}>{t("process")}</Text>
                    }
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={s.btnSecondary} onPress={handleSkip}>
                    <Text style={s.btnSecondaryText}>{t("skip")}</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btnPrimary, !voiceInput.trim() && s.btnDisabled]}
                    onPress={handleAnswerSubmit}
                    disabled={!voiceInput.trim()}
                  >
                    <Text style={s.btnPrimaryText}>
                      {fieldIdx + 1 >= totalQuestions ? "Review ->" : "Next ->"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { alignItems: "center", marginVertical: responsiveHeight(1) },
  micCircle: {
    width: responsiveWidth(26),
    height: responsiveWidth(26),
    borderRadius: responsiveWidth(13),
    backgroundColor: "#18CDEB",
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: {
    marginTop: responsiveHeight(1),
    color: "#19CDEB",
    fontSize: responsiveWidth(3.5),
    fontWeight: "500",
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(1, 4, 10, 0.75)",
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#2B3C67",
    backgroundColor: "#111A2D",
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(2.2),
    paddingBottom: responsiveHeight(0.5),
  },
  headerTitle: { color: "#E8F1FF", fontSize: responsiveWidth(4.5), fontWeight: "700" },
  headerSub: { color: "#19CDEB", fontSize: responsiveWidth(3), fontWeight: "500", marginTop: 2 },
  closeBtn: { padding: responsiveWidth(2) },
  langIndicator: {
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(0.5),
  },
  langIndicatorText: {
    color: "#3A5070",
    fontSize: responsiveWidth(3),
    fontWeight: "500",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "#1C2A45",
    marginHorizontal: responsiveWidth(5),
    borderRadius: 2,
    marginBottom: responsiveHeight(1),
  },
  progressFill: { height: 3, backgroundColor: "#19CDEB", borderRadius: 2, minWidth: 8 },
  body: { maxHeight: responsiveHeight(52) },
  bodyContent: {
    paddingHorizontal: responsiveWidth(5),
    paddingBottom: responsiveHeight(1.5),
    gap: responsiveHeight(1.4),
  },
  collected: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E3A2A",
    backgroundColor: "#0D1F18",
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1),
    gap: responsiveHeight(0.7),
  },
  collectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.5),
  },
  collectedKey: { color: "#6DB58A", fontSize: responsiveWidth(3), fontWeight: "600" },
  collectedVal: { color: "#B8D4C0", fontSize: responsiveWidth(3), flex: 1 },
  editIcon: { marginLeft: responsiveWidth(1) },
  editHint: {
    color: "#3A5070",
    fontSize: responsiveWidth(2.7),
    marginTop: responsiveHeight(0.3),
    textAlign: "right",
  },
  confirmBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1C3A5A",
    backgroundColor: "#0D1F2F",
    padding: responsiveWidth(4),
  },
  confirmText: {
    color: "#D0E8FF",
    fontSize: responsiveWidth(4),
    fontWeight: "600",
    lineHeight: responsiveWidth(6.2),
  },
  questionBox: { gap: responsiveHeight(0.5) },
  questionText: {
    color: "#E4EDF9",
    fontSize: responsiveWidth(4.2),
    fontWeight: "600",
    lineHeight: responsiveWidth(6.2),
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: responsiveWidth(2) },
  input: {
    flex: 1,
    minHeight: responsiveHeight(9),
    maxHeight: responsiveHeight(15),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#344567",
    backgroundColor: "#1C2A45",
    color: "#DDE8FB",
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1.2),
    fontSize: responsiveWidth(3.5),
  },
  inputActive: { borderColor: "#19CDEB", backgroundColor: "#142035" },
  micToggle: {
    width: responsiveWidth(11),
    height: responsiveWidth(11),
    borderRadius: responsiveWidth(5.5),
    borderWidth: 1,
    borderColor: "#344567",
    backgroundColor: "#1C2A45",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  micToggleActive: { backgroundColor: "#19CDEB", borderColor: "#19CDEB" },
  statusListening: { color: "#19CDEB", fontSize: responsiveWidth(3), fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  statusText: { color: "#5F7A8B", fontSize: responsiveWidth(3) },
  statusDone: { color: "#2CD086", fontSize: responsiveWidth(3.2), fontWeight: "600" },
  errorText: { color: "#FF7A8A", fontSize: responsiveWidth(3) },
  actions: {
    flexDirection: "row",
    gap: responsiveWidth(3),
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(1.5),
    paddingBottom: responsiveHeight(3.5),
    borderTopWidth: 1,
    borderTopColor: "#1C2A45",
  },
  btnSecondary: {
    flex: 1,
    minHeight: responsiveHeight(6.3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3A4D77",
    backgroundColor: "#1A2741",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: { color: "#D6E2F4", fontSize: responsiveWidth(3.5), fontWeight: "700" },
  btnPrimary: {
    flex: 1.5,
    minHeight: responsiveHeight(6.3),
    borderRadius: 999,
    backgroundColor: "#21C0DF",
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { color: "#051728", fontSize: responsiveWidth(3.5), fontWeight: "800" },
  btnDisabled: { opacity: 0.4 },
});

export default VoiceFormFillCard;
