import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Ban, BookOpen, CalendarCheck, CheckCircle2, Globe, Grid3x3, Loader2, Mic, MessageSquare, Phone, PhoneForwarded, PhoneOff, PhoneOutgoing, Plus, Save, Send, ShieldCheck, Sparkles, Trash2, Users, Workflow, X, Zap,
} from 'lucide-react';
import { smartflowApi } from '../../../api/services';
import { LABEL } from '../shared';
import { AI_LANGUAGE_OPTIONS, getStoredAiLanguage, setStoredAiLanguage } from '../../../utils/voiceAgentConfig';
import { useLanguage } from '../../../context/LanguageContext';
import useDictation from '../../../components/inbox/useDictation';

// The phone agent's TTS/translation table (app/services/call_phrases.py) only covers
// these eleven codes — notably no Bengali, unlike the web assistant's language list
// above. Offering a code the backend can't speak would either silently fall back to
// English or, for the keypad menu, get filtered out server-side with no explanation
// in the UI, so the two pickers intentionally use separate lists.
const PHONE_LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'ar', name: 'العربية' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ur', name: 'اردو' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];
const MAX_MENU_OPTIONS = 4;
const DIGIT_CHOICES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// The kind's built-in text, shown as the field's placeholder so leaving it blank is a
// clearly reversible choice, not a mystery.
const SMS_WORDING_KINDS = [
  { key: 'booked', label: 'When an appointment is booked', builtIn: '{business}: your appointment is confirmed for {when}.' },
  { key: 'rescheduled', label: 'When an appointment is moved', builtIn: '{business}: your appointment has been moved to {when}.' },
  { key: 'cancelled', label: 'When an appointment is cancelled', builtIn: '{business}: your appointment on {when} has been cancelled. Call us any time to book a new one.' },
  { key: 'reminder', label: 'Reminder before the appointment', builtIn: '{business}: reminder - your appointment is {when}. Call us if you need to change it.' },
  { key: 'pending', label: 'When a request needs approval', builtIn: "{business}: we received your request for {when}. We'll confirm by text shortly." },
  { key: 'declined', label: "When a time can't be confirmed", builtIn: "{business}: sorry, we can't confirm {when}. Please call us to find another time." },
  { key: 'cancellation_declined', label: 'When a cancellation request is turned down', builtIn: '{business}: we were not able to cancel your appointment on {when}. It is still on the books - call us with any questions.' },
];

// A curated starting list, not an enum enforced server-side — the field stays a
// free string so a business whose type isn't listed can still type it via "Other".
const BUSINESS_TYPE_OPTIONS = [
  'Dental Clinic', 'Medical Clinic', 'Chiropractor', 'Law Firm', 'Real Estate Agency', 'Restaurant',
  'Salon / Spa', 'Home Services (Plumbing, Electrical, HVAC)', 'Auto Repair Shop',
  'Fitness Studio / Gym', 'Retail Store', 'Accounting / Bookkeeping Firm',
  'Insurance Agency', 'Veterinary Clinic', 'Photography Studio', 'Consulting Firm',
];

// AI capabilities the owner can hard-disable or gate behind approval, separate from
// the conversation script - enforced server-side regardless of what greetings/
// playbooks say. Only schedule/reschedule/cancel have a real "needs your approval"
// behavior today (an existing pending-request workflow); the rest are a simple
// on/off since there's no synchronous human-in-the-loop moment mid-call for them.
const AI_CAPABILITIES = [
  { key: 'schedule', labelKey: 'aiprof_cap_schedule', supportsApproval: true },
  { key: 'reschedule', labelKey: 'aiprof_cap_reschedule', supportsApproval: true },
  { key: 'cancel', labelKey: 'aiprof_cap_cancel', supportsApproval: true },
  { key: 'take_message', labelKey: 'aiprof_cap_take_message', supportsApproval: false },
  { key: 'transfer_to_human', labelKey: 'aiprof_cap_transfer_to_human', supportsApproval: false },
  { key: 'capture_lead', labelKey: 'aiprof_cap_capture_lead', supportsApproval: false },
  { key: 'send_payment_link', labelKey: 'aiprof_cap_send_payment_link', supportsApproval: false },
];

// Python's date.weekday(): 0=Monday ... 6=Sunday - matches business_hours.days already.
const WEEKDAYS = [
  { value: 0, labelKey: 'aiprof_day_mon' },
  { value: 1, labelKey: 'aiprof_day_tue' },
  { value: 2, labelKey: 'aiprof_day_wed' },
  { value: 3, labelKey: 'aiprof_day_thu' },
  { value: 4, labelKey: 'aiprof_day_fri' },
  { value: 5, labelKey: 'aiprof_day_sat' },
  { value: 6, labelKey: 'aiprof_day_sun' },
];

// Every AI-writable field, in the same order they appear on the page - used to
// generate everything at once when Business Type changes. sms_* keys map onto
// callSettings.sms_wording[<key without the sms_ prefix>] rather than a top-level field.
const RECEPTIONIST_FIELD_KEYS = [
  'greeting_inbound', 'greeting_outbound', 'closing_message', 'custom_instructions', 'knowledge_base', 'cancellation_policy',
  ...SMS_WORDING_KINDS.map((kind) => `sms_${kind.key}`),
];

function getReceptionistFieldValue(callSettings, fieldKey) {
  if (fieldKey.startsWith('sms_')) {
    return callSettings?.sms_wording?.[fieldKey.slice(4)] || '';
  }
  return callSettings?.[fieldKey] || '';
}

// The three AI tools (generate / dictate / improve) for one text field. Self-contained:
// each instance owns its own recorder and loading state, so one field's "Generate" spinner
// never affects the others.
function AiFieldTools({ fieldKey, value, onChange, businessType, t }) {
  const [busy, setBusy] = useState(null); // 'generate' | 'improve' | null
  const [error, setError] = useState('');
  const { recording, transcribing, toggle } = useDictation({
    onText: (text) => onChange(value ? `${value} ${text}` : text),
    onError: setError,
    t,
  });

  async function runAction(kind) {
    if (kind === 'generate' && value.trim() && !window.confirm(t('aiprof_confirm_overwrite_field'))) return;
    if (kind === 'improve' && !value.trim()) return;
    setBusy(kind);
    setError('');
    try {
      const response = await smartflowApi.composeReceptionistFields({
        fields: [fieldKey],
        action: kind === 'generate' ? 'draft' : 'improve',
        business_type: businessType || '',
        current_texts: kind === 'improve' ? { [fieldKey]: value } : {},
      });
      const text = response?.data?.data?.[fieldKey];
      if (text) onChange(text);
      else setError(t('aiprof_ai_unavailable'));
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_ai_unavailable'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => runAction('generate')}
        disabled={busy !== null}
        title={t('aiprof_btn_generate_hint')}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131A24] border border-[#243041] text-[#A78BFA] hover:border-[#9333ea]/50 text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {busy === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {t('aiprof_btn_generate')}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={transcribing}
        title={t('aiprof_btn_dictate_hint')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer disabled:opacity-50 ${
          recording ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-[#131A24] border-[#243041] text-[#9BA7BB] hover:border-[#9333ea]/50'
        }`}
      >
        {transcribing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
        {recording ? t('aiprof_btn_dictate_stop') : t('aiprof_btn_dictate')}
      </button>
      <button
        type="button"
        onClick={() => runAction('improve')}
        disabled={busy !== null || !value.trim()}
        title={t('aiprof_btn_improve_hint')}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131A24] border border-[#243041] text-[#9BA7BB] hover:border-[#9333ea]/50 text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {busy === 'improve' ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
        {t('aiprof_btn_improve')}
      </button>
      {error ? <span className="text-rose-400 text-[11px]">{error}</span> : null}
    </div>
  );
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
      <h3 className="font-bold text-white mb-1 flex items-center gap-2">
        <Icon size={16} className="text-[#9333ea]" />{title}
      </h3>
      {description ? <p className="text-[#A4B0B7] text-xs mb-3">{description}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}

function AIConfigTab() {
  const { t } = useLanguage();

  // Web voice assistant — unrelated to phone calls, unchanged from before.
  const [aiLanguage, setAiLanguage] = useState(() => getStoredAiLanguage());
  useEffect(() => { setStoredAiLanguage(aiLanguage); }, [aiLanguage]);

  // Phone call persona.
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [callSettings, setCallSettings] = useState(null);
  const [businessTypeIsOther, setBusinessTypeIsOther] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Providers & appointment types — separate resources, saved immediately per action
  // (like team members on a group), not part of the call-settings Save button.
  const [providers, setProviders] = useState([]);
  const [appointmentTypes, setAppointmentTypes] = useState([]);
  const [loadingScheduling, setLoadingScheduling] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderRole, setNewProviderRole] = useState('');
  const [newProviderLinkedId, setNewProviderLinkedId] = useState('');
  const [newProviderWorkingDays, setNewProviderWorkingDays] = useState([]);
  const [newProviderStartHour, setNewProviderStartHour] = useState('');
  const [newProviderEndHour, setNewProviderEndHour] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeMinutes, setNewTypeMinutes] = useState(30);
  const [newTypeEligibleProviderIds, setNewTypeEligibleProviderIds] = useState([]);
  const [schedulingError, setSchedulingError] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingType, setSavingType] = useState(false);

  const fetchScheduling = useCallback(async () => {
    setLoadingScheduling(true);
    try {
      const [providersRes, typesRes, teamRes] = await Promise.all([
        smartflowApi.getProviders(),
        smartflowApi.getAppointmentTypes(),
        smartflowApi.getTeamMembers().catch(() => ({ data: { data: { items: [] } } })),
      ]);
      const providersData = providersRes.data?.data;
      setProviders(Array.isArray(providersData) ? providersData : providersData?.items || []);
      const typesData = typesRes.data?.data;
      setAppointmentTypes(Array.isArray(typesData) ? typesData : typesData?.items || []);
      const teamData = teamRes.data?.data;
      setTeamMembers(Array.isArray(teamData) ? teamData : teamData?.items || []);
    } catch {
      setSchedulingError(t('aiprof_err_scheduling_load_failed'));
    } finally {
      setLoadingScheduling(false);
    }
  }, [t]);

  const fetchCallSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const response = await smartflowApi.getAICallSettings();
      const data = response.data?.data || null;
      setCallSettings(data);
      setBusinessTypeIsOther(Boolean(data?.business_type) && !BUSINESS_TYPE_OPTIONS.includes(data.business_type));
    } catch {
      setError(t('aiprof_err_load_failed'));
    } finally {
      setLoadingSettings(false);
    }
  }, [t]);

  useEffect(() => {
    smartflowApi.getAIVoices()
      .then((r) => setVoices(r.data?.data || []))
      .catch(() => setVoices([]))
      .finally(() => setLoadingVoices(false));
    fetchCallSettings();
    fetchScheduling();
  }, [fetchCallSettings, fetchScheduling]);

  const handleAddProvider = async () => {
    if (!newProviderName.trim() || savingProvider) return;
    setSavingProvider(true);
    setSchedulingError('');
    try {
      const response = await smartflowApi.createProvider({
        name: newProviderName.trim(),
        role_title: newProviderRole.trim() || null,
        linked_user_id: newProviderLinkedId || null,
        working_days: newProviderWorkingDays.length ? newProviderWorkingDays : null,
        working_hours: newProviderStartHour !== '' && newProviderEndHour !== ''
          ? { start_hour: Number(newProviderStartHour), end_hour: Number(newProviderEndHour) }
          : null,
      });
      setProviders((current) => [...current, response.data?.data]);
      setNewProviderName('');
      setNewProviderRole('');
      setNewProviderLinkedId('');
      setNewProviderWorkingDays([]);
      setNewProviderStartHour('');
      setNewProviderEndHour('');
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_provider_save_failed'));
    } finally {
      setSavingProvider(false);
    }
  };

  const handleToggleProvider = async (provider) => {
    try {
      const response = await smartflowApi.updateProvider(provider.id, { active: !provider.active });
      setProviders((current) => current.map((item) => (item.id === provider.id ? response.data?.data : item)));
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_provider_save_failed'));
    }
  };

  const handleDeleteProvider = async (provider) => {
    try {
      await smartflowApi.deleteProvider(provider.id);
      setProviders((current) => current.filter((item) => item.id !== provider.id));
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_provider_save_failed'));
    }
  };

  const handleAddType = async () => {
    const minutes = Math.min(480, Math.max(5, Number(newTypeMinutes) || 30));
    if (!newTypeName.trim() || savingType) return;
    setSavingType(true);
    setSchedulingError('');
    try {
      const response = await smartflowApi.createAppointmentType({
        name: newTypeName.trim(),
        duration_minutes: minutes,
        eligible_provider_ids: newTypeEligibleProviderIds.length ? newTypeEligibleProviderIds : null,
      });
      setAppointmentTypes((current) => [...current, response.data?.data]);
      setNewTypeName('');
      setNewTypeMinutes(30);
      setNewTypeEligibleProviderIds([]);
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_type_save_failed'));
    } finally {
      setSavingType(false);
    }
  };

  const handleToggleType = async (type) => {
    try {
      const response = await smartflowApi.updateAppointmentType(type.id, { active: !type.active });
      setAppointmentTypes((current) => current.map((item) => (item.id === type.id ? response.data?.data : item)));
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_type_save_failed'));
    }
  };

  const handleDeleteType = async (type) => {
    try {
      await smartflowApi.deleteAppointmentType(type.id);
      setAppointmentTypes((current) => current.filter((item) => item.id !== type.id));
    } catch (err) {
      setSchedulingError(err?.response?.data?.message || t('aiprof_err_type_save_failed'));
    }
  };

  const updateField = (field, value) => {
    setCallSettings((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const updateWordingField = (kind, value) => {
    setCallSettings((prev) => ({ ...(prev || {}), sms_wording: { ...(prev?.sms_wording || {}), [kind]: value } }));
  };

  const updateCapability = (capability, value) => {
    setCallSettings((prev) => ({ ...(prev || {}), ai_capabilities: { ...(prev?.ai_capabilities || {}), [capability]: value } }));
  };

  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllError, setGenerateAllError] = useState('');

  const generateAllFieldsForBusinessType = async (businessType) => {
    if (!businessType || !businessType.trim()) return;
    const hasExistingText = RECEPTIONIST_FIELD_KEYS.some((key) => getReceptionistFieldValue(callSettings, key).trim());
    if (hasExistingText && !window.confirm(t('aiprof_confirm_overwrite_all'))) return;
    setGeneratingAll(true);
    setGenerateAllError('');
    try {
      const response = await smartflowApi.composeReceptionistFields({
        fields: RECEPTIONIST_FIELD_KEYS,
        action: 'draft',
        business_type: businessType,
      });
      const results = response?.data?.data || {};
      setCallSettings((prev) => {
        let next = { ...(prev || {}) };
        for (const key of RECEPTIONIST_FIELD_KEYS) {
          const text = results[key];
          if (!text) continue;
          if (key.startsWith('sms_')) {
            next = { ...next, sms_wording: { ...(next.sms_wording || {}), [key.slice(4)]: text } };
          } else {
            next = { ...next, [key]: text };
          }
        }
        return next;
      });
    } catch (err) {
      setGenerateAllError(err?.response?.data?.message || t('aiprof_ai_unavailable'));
    } finally {
      setGeneratingAll(false);
    }
  };

  const [newEmergencyKeyword, setNewEmergencyKeyword] = useState('');

  const addEmergencyKeyword = () => {
    const value = newEmergencyKeyword.trim();
    if (!value) return;
    setCallSettings((prev) => {
      const existing = prev?.emergency_keywords || [];
      if (existing.some((item) => item.toLowerCase() === value.toLowerCase())) return prev;
      return { ...(prev || {}), emergency_keywords: [...existing, value] };
    });
    setNewEmergencyKeyword('');
  };

  const removeEmergencyKeyword = (value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      emergency_keywords: (prev?.emergency_keywords || []).filter((item) => item !== value),
    }));
  };

  const updatePlaybook = (id, field, value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      call_routing_rules: (prev?.call_routing_rules || []).map((rule) => (rule.id === id ? { ...rule, [field]: value } : rule)),
    }));
  };

  const addPlaybook = () => {
    const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCallSettings((prev) => ({
      ...(prev || {}),
      call_routing_rules: [
        ...(prev?.call_routing_rules || []),
        { id, name: '', trigger_description: '', questions_to_ask: [], provider_id: '', appointment_type_id: '', notify_target: '', crm_note: '', active: true },
      ],
    }));
  };

  const removePlaybook = (id) => {
    setCallSettings((prev) => ({ ...(prev || {}), call_routing_rules: (prev?.call_routing_rules || []).filter((rule) => rule.id !== id) }));
  };

  const addPlaybookQuestion = (id) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      call_routing_rules: (prev?.call_routing_rules || []).map((rule) =>
        rule.id === id && (rule.questions_to_ask || []).length < 8 ? { ...rule, questions_to_ask: [...(rule.questions_to_ask || []), ''] } : rule
      ),
    }));
  };

  const updatePlaybookQuestion = (id, index, value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      call_routing_rules: (prev?.call_routing_rules || []).map((rule) => {
        if (rule.id !== id) return rule;
        const questions = [...(rule.questions_to_ask || [])];
        questions[index] = value;
        return { ...rule, questions_to_ask: questions };
      }),
    }));
  };

  const removePlaybookQuestion = (id, index) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      call_routing_rules: (prev?.call_routing_rules || []).map((rule) => {
        if (rule.id !== id) return rule;
        const questions = [...(rule.questions_to_ask || [])];
        questions.splice(index, 1);
        return { ...rule, questions_to_ask: questions };
      }),
    }));
  };

  const updateOutboundPurpose = (id, field, value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      outbound_call_purposes: (prev?.outbound_call_purposes || []).map((purpose) => (purpose.id === id ? { ...purpose, [field]: value } : purpose)),
    }));
  };

  const addOutboundPurpose = () => {
    const id = `purpose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCallSettings((prev) => ({
      ...(prev || {}),
      outbound_call_purposes: [
        ...(prev?.outbound_call_purposes || []),
        { id, name: '', opening_message: '', objective: '', questions_to_ask: [], allowed_actions: [], closing_message: '', follow_up_sms: '', active: true },
      ],
    }));
  };

  const removeOutboundPurpose = (id) => {
    setCallSettings((prev) => ({ ...(prev || {}), outbound_call_purposes: (prev?.outbound_call_purposes || []).filter((purpose) => purpose.id !== id) }));
  };

  const addOutboundPurposeListItem = (id, field) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      outbound_call_purposes: (prev?.outbound_call_purposes || []).map((purpose) =>
        purpose.id === id && (purpose[field] || []).length < 8 ? { ...purpose, [field]: [...(purpose[field] || []), ''] } : purpose
      ),
    }));
  };

  const updateOutboundPurposeListItem = (id, field, index, value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      outbound_call_purposes: (prev?.outbound_call_purposes || []).map((purpose) => {
        if (purpose.id !== id) return purpose;
        const items = [...(purpose[field] || [])];
        items[index] = value;
        return { ...purpose, [field]: items };
      }),
    }));
  };

  const removeOutboundPurposeListItem = (id, field, index) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      outbound_call_purposes: (prev?.outbound_call_purposes || []).map((purpose) => {
        if (purpose.id !== id) return purpose;
        const items = [...(purpose[field] || [])];
        items.splice(index, 1);
        return { ...purpose, [field]: items };
      }),
    }));
  };

  const updateMenuOption = (index, field, value) => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      menu[index] = { ...menu[index], [field]: value };
      return { ...prev, language_menu: menu };
    });
  };

  const addMenuOption = () => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      if (menu.length >= MAX_MENU_OPTIONS) return prev;
      const usedDigits = new Set(menu.map((option) => option.digit));
      const nextDigit = DIGIT_CHOICES.find((digit) => !usedDigits.has(digit)) || '1';
      const usedLanguages = new Set(menu.map((option) => option.language));
      const nextLanguage = PHONE_LANGUAGE_OPTIONS.find((lang) => !usedLanguages.has(lang.code))?.code || 'en';
      return { ...prev, language_menu: [...menu, { digit: nextDigit, language: nextLanguage }] };
    });
  };

  const removeMenuOption = (index) => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      menu.splice(index, 1);
      return { ...prev, language_menu: menu };
    });
  };

  const handleSave = async () => {
    if (!callSettings || saving) return;
    try {
      setSaving(true);
      setError('');
      const response = await smartflowApi.updateAICallSettings({
        assistant_name: callSettings.assistant_name || null,
        voice_id: callSettings.voice_id || null,
        business_type: callSettings.business_type || null,
        custom_instructions: callSettings.custom_instructions || null,
        greeting_inbound: callSettings.greeting_inbound || null,
        greeting_outbound: callSettings.greeting_outbound || null,
        closing_message: callSettings.closing_message || null,
        language_menu_enabled: Boolean(callSettings.language_menu_enabled),
        language_menu: callSettings.language_menu || [],
        knowledge_base: callSettings.knowledge_base || null,
        transfer_number: callSettings.transfer_number || null,
        voice_engine: callSettings.voice_engine === 'classic' ? 'classic' : 'realtime',
        require_meeting_approval: Boolean(callSettings.require_meeting_approval),
        require_approval_for_reschedules: Boolean(callSettings.require_approval_for_reschedules),
        require_approval_for_cancellations: Boolean(callSettings.require_approval_for_cancellations),
        ai_capabilities: callSettings.ai_capabilities || {},
        sms_confirmations_enabled: callSettings.sms_confirmations_enabled !== false,
        appointment_reminders_enabled: Boolean(callSettings.appointment_reminders_enabled),
        appointment_reminder_hours_before: Math.min(168, Math.max(1, Number(callSettings.appointment_reminder_hours_before) || 24)),
        sms_wording: SMS_WORDING_KINDS.reduce((acc, kind) => ({ ...acc, [kind.key]: callSettings.sms_wording?.[kind.key] || null }), {}),
        cancellation_policy: callSettings.cancellation_policy || null,
        emergency_keywords: callSettings.emergency_keywords || [],
        emergency_response_mode: callSettings.emergency_response_mode === 'direct_to_911' ? 'direct_to_911' : 'take_message',
        emergency_alert_phone: callSettings.emergency_alert_phone || null,
        call_routing_rules: (callSettings.call_routing_rules || [])
          .filter((rule) => rule.name?.trim() && rule.trigger_description?.trim())
          .map((rule) => ({
            id: rule.id,
            name: rule.name.trim(),
            trigger_description: rule.trigger_description.trim(),
            questions_to_ask: (rule.questions_to_ask || []).map((q) => q.trim()).filter(Boolean),
            provider_id: rule.provider_id || null,
            appointment_type_id: rule.appointment_type_id || null,
            notify_target: rule.notify_target?.trim() || null,
            crm_note: rule.crm_note?.trim() || null,
            active: rule.active !== false,
          })),
        outbound_call_purposes: (callSettings.outbound_call_purposes || [])
          .filter((purpose) => purpose.name?.trim())
          .map((purpose) => ({
            id: purpose.id,
            name: purpose.name.trim(),
            opening_message: purpose.opening_message?.trim() || null,
            objective: purpose.objective?.trim() || null,
            questions_to_ask: (purpose.questions_to_ask || []).map((q) => q.trim()).filter(Boolean),
            allowed_actions: (purpose.allowed_actions || []).map((a) => a.trim()).filter(Boolean),
            closing_message: purpose.closing_message?.trim() || null,
            follow_up_sms: purpose.follow_up_sms?.trim() || null,
            active: purpose.active !== false,
          })),
      });
      setCallSettings(response.data?.data || callSettings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_err_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const instructionsLength = (callSettings?.custom_instructions || '').length;
  const knowledgeLength = (callSettings?.knowledge_base || '').length;
  const engine = callSettings?.voice_engine === 'classic' ? 'classic' : 'realtime';

  return (
    <div className="space-y-5">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Globe size={16} className="text-[#9333ea]" />{t('aiprof_hdr_lang')}</h3>
        <select
          value={aiLanguage}
          onChange={(event) => setAiLanguage(event.target.value)}
          className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none"
        >
          {AI_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>{language.name}</option>
          ))}
        </select>
        <p className="text-[#A4B0B7] text-xs mt-3">{t('aiprof_lang_desc')}</p>
      </div>

      {error ? <div className="bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3">{error}</div> : null}

      {loadingSettings ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>
      ) : (
        <>
          <SectionCard icon={Sparkles} title={t('aiprof_hdr_persona')} description={t('aiprof_persona_desc')}>
            <label className={LABEL}>{t('aiprof_lbl_assistant_name')}</label>
            <input
              type="text"
              maxLength={60}
              placeholder={t('aiprof_ph_assistant_name')}
              value={callSettings?.assistant_name || ''}
              onChange={(event) => updateField('assistant_name', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            />

            <label className={`${LABEL} mt-4`}>{t('aiprof_lbl_business_type')}</label>
            <p className="text-[#A4B0B7] text-xs mb-2">{t('aiprof_business_type_desc')}</p>
            <select
              value={businessTypeIsOther ? 'Other' : callSettings?.business_type || ''}
              onChange={(event) => {
                const nextIsOther = event.target.value === 'Other';
                setBusinessTypeIsOther(nextIsOther);
                updateField('business_type', nextIsOther ? '' : event.target.value);
                if (!nextIsOther && event.target.value) generateAllFieldsForBusinessType(event.target.value);
              }}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            >
              <option value="">{t('aiprof_ph_business_type')}</option>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            {businessTypeIsOther ? (
              <input
                type="text"
                maxLength={80}
                placeholder={t('aiprof_ph_business_type')}
                value={callSettings?.business_type || ''}
                onChange={(event) => updateField('business_type', event.target.value)}
                onBlur={(event) => generateAllFieldsForBusinessType(event.target.value)}
                className="w-full mt-2 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
              />
            ) : null}
            {generatingAll ? (
              <p className="text-[#A78BFA] text-xs mt-2 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />{t('aiprof_generating_all')}</p>
            ) : null}
            {generateAllError ? <p className="text-rose-400 text-xs mt-2">{generateAllError}</p> : null}
          </SectionCard>

          <SectionCard icon={Mic} title={t('aiprof_hdr_voices')}>
            {loadingVoices ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>
            ) : voices.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {voices.map((voice) => {
                  const voiceId = voice.id || voice.voice_id || voice.name;
                  const isSelected = (callSettings?.voice_id || 'female_warm') === voiceId;
                  return (
                    <button
                      key={voiceId}
                      type="button"
                      onClick={() => updateField('voice_id', voiceId)}
                      className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#9333ea]/10 border-[#9333ea]/50' : 'bg-[#131A24] border-[#243041] hover:border-[#9333ea]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold text-sm">{voice.label || voice.name || voice.voice_name}</p>
                        {isSelected ? <CheckCircle2 size={14} className="text-[#9333ea] shrink-0" /> : null}
                      </div>
                      {(voice.style || voice.language) && (
                        <p className="text-[#A4B0B7] text-xs mt-0.5 capitalize">{voice.style || voice.language}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[#A4B0B7] text-sm">{t('aiprof_no_voices')}</p>}
          </SectionCard>

          <SectionCard icon={Phone} title={t('aiprof_hdr_greeting_inbound')} description={t('aiprof_greeting_inbound_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_greeting_default')}
              value={callSettings?.greeting_inbound || ''}
              onChange={(event) => updateField('greeting_inbound', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="greeting_inbound" value={callSettings?.greeting_inbound || ''} onChange={(text) => updateField('greeting_inbound', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={PhoneOutgoing} title={t('aiprof_hdr_greeting_outbound')} description={t('aiprof_greeting_outbound_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_greeting_default')}
              value={callSettings?.greeting_outbound || ''}
              onChange={(event) => updateField('greeting_outbound', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="greeting_outbound" value={callSettings?.greeting_outbound || ''} onChange={(text) => updateField('greeting_outbound', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={PhoneOff} title={t('aiprof_hdr_closing_message')} description={t('aiprof_closing_message_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_closing_message')}
              value={callSettings?.closing_message || ''}
              onChange={(event) => updateField('closing_message', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="closing_message" value={callSettings?.closing_message || ''} onChange={(text) => updateField('closing_message', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={Sparkles} title={t('aiprof_hdr_instructions')} description={t('aiprof_instructions_desc')}>
            <textarea
              rows={4}
              maxLength={2000}
              placeholder={t('aiprof_ph_instructions')}
              value={callSettings?.custom_instructions || ''}
              onChange={(event) => updateField('custom_instructions', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <p className="text-[#4A5568] text-xs mt-1 text-right">{instructionsLength}/2000</p>
            <AiFieldTools fieldKey="custom_instructions" value={callSettings?.custom_instructions || ''} onChange={(text) => updateField('custom_instructions', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={Zap} title={t('aiprof_hdr_engine')} description={t('aiprof_engine_desc')}>
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t('aiprof_hdr_engine')}>
              {[
                { key: 'realtime', title: t('aiprof_engine_realtime'), body: t('aiprof_engine_realtime_desc') },
                { key: 'classic', title: t('aiprof_engine_classic'), body: t('aiprof_engine_classic_desc') },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={engine === option.key}
                  onClick={() => updateField('voice_engine', option.key)}
                  className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                    engine === option.key ? 'bg-[#9333ea]/10 border-[#9333ea]/50' : 'bg-[#131A24] border-[#243041] hover:border-[#9333ea]/30'
                  }`}
                >
                  <p className="text-white font-semibold text-sm flex items-center justify-between">
                    {option.title}
                    {engine === option.key ? <CheckCircle2 size={14} className="text-[#9333ea]" /> : null}
                  </p>
                  <p className="text-[#A4B0B7] text-xs mt-1">{option.body}</p>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard icon={BookOpen} title={t('aiprof_hdr_knowledge')} description={t('aiprof_knowledge_desc')}>
            <textarea
              rows={7}
              maxLength={8000}
              placeholder={t('aiprof_ph_knowledge')}
              value={callSettings?.knowledge_base || ''}
              onChange={(event) => updateField('knowledge_base', event.target.value)}
              aria-label={t('aiprof_hdr_knowledge')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-y"
            />
            <p className="text-[#4A5568] text-xs mt-1 text-right">{knowledgeLength}/8000</p>
            <AiFieldTools fieldKey="knowledge_base" value={callSettings?.knowledge_base || ''} onChange={(text) => updateField('knowledge_base', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={CalendarCheck} title={t('aiprof_hdr_appointments')} description={t('aiprof_appointments_desc')}>
            <p className="text-[#4A5568] text-xs mb-4">{t('aiprof_approval_moved_hint')}</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={callSettings?.sms_confirmations_enabled !== false}
                onChange={(event) => updateField('sms_confirmations_enabled', event.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#9333ea]"
              />
              <span>
                <span className="text-white text-sm font-semibold block">{t('aiprof_toggle_sms_confirmations')}</span>
                <span className="text-[#A4B0B7] text-xs">{t('aiprof_sms_confirmations_hint')}</span>
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer mt-4 pt-4 border-t border-[#243041]">
              <input
                type="checkbox"
                checked={Boolean(callSettings?.appointment_reminders_enabled)}
                onChange={(event) => updateField('appointment_reminders_enabled', event.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#9333ea]"
              />
              <span className="flex-1">
                <span className="text-white text-sm font-semibold block">{t('aiprof_toggle_reminders')}</span>
                <span className="text-[#A4B0B7] text-xs">{t('aiprof_reminders_hint')}</span>
              </span>
            </label>
            {callSettings?.appointment_reminders_enabled ? (
              <div className="mt-3 flex items-center gap-2 pl-6">
                <label className="text-[#A4B0B7] text-xs shrink-0" htmlFor="aiprof-reminder-hours">
                  {t('aiprof_lbl_reminder_hours')}
                </label>
                <input
                  id="aiprof-reminder-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={callSettings?.appointment_reminder_hours_before ?? 24}
                  onChange={(event) => updateField('appointment_reminder_hours_before', Math.min(168, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-20 bg-[#131A24] border border-[#243041] rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-[#9333ea]/50"
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard icon={ShieldCheck} title={t('aiprof_hdr_permissions')} description={t('aiprof_permissions_desc')}>
            <div className="space-y-3">
              {AI_CAPABILITIES.map((capability) => {
                const effectiveDefault = capability.key === 'schedule'
                  ? (callSettings?.require_meeting_approval ? 'human_approval_required' : 'ai_allowed')
                  : capability.key === 'reschedule'
                    ? (callSettings?.require_approval_for_reschedules ? 'human_approval_required' : 'ai_allowed')
                    : capability.key === 'cancel'
                      ? (callSettings?.require_approval_for_cancellations ? 'human_approval_required' : 'ai_allowed')
                      : 'ai_allowed';
                const value = callSettings?.ai_capabilities?.[capability.key] || effectiveDefault;
                return (
                  <div key={capability.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#243041] bg-[#131A24] px-4 py-3">
                    <span className="text-white text-sm font-semibold">{t(capability.labelKey)}</span>
                    <select
                      aria-label={t(capability.labelKey)}
                      value={value}
                      onChange={(event) => updateCapability(capability.key, event.target.value)}
                      className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    >
                      <option value="disabled">{t('aiprof_perm_disabled')}</option>
                      <option value="ai_allowed">{t('aiprof_perm_ai_allowed')}</option>
                      {capability.supportsApproval ? (
                        <option value="human_approval_required">{t('aiprof_perm_human_approval_required')}</option>
                      ) : null}
                    </select>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard icon={Users} title={t('aiprof_hdr_scheduling')} description={t('aiprof_scheduling_desc')}>
            {schedulingError ? (
              <p className="text-rose-300 text-xs mb-3 flex items-center gap-1.5"><Ban size={12} />{schedulingError}</p>
            ) : null}
            {loadingScheduling ? (
              <div className="flex items-center justify-center h-16"><Loader2 className="animate-spin text-[#9333ea]" size={18} /></div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>{t('aiprof_lbl_providers')}</label>
                  <div className="space-y-1.5 mb-3">
                    {providers.map((provider) => (
                      <div key={provider.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${provider.active ? 'bg-[#131A24] border-[#243041]' : 'bg-[#131A24]/40 border-[#243041]/60 opacity-60'}`}>
                        <span className="flex-1 min-w-0 text-white text-xs font-semibold truncate">
                          {provider.name}{provider.role_title ? <span className="text-[#A4B0B7] font-normal"> · {provider.role_title}</span> : null}
                        </span>
                        <button type="button" onClick={() => handleToggleProvider(provider)} className="text-[10px] font-bold text-[#9333ea] cursor-pointer">
                          {provider.active ? t('aiprof_btn_pause') : t('aiprof_btn_resume')}
                        </button>
                        <button type="button" onClick={() => handleDeleteProvider(provider)} className="text-[#A4B0B7] hover:text-rose-400 cursor-pointer" title={t('aiprof_btn_remove')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {!providers.length ? <p className="text-[#4A5568] text-xs">{t('aiprof_no_providers')}</p> : null}
                  </div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_provider_name')}
                      value={newProviderName}
                      onChange={(event) => setNewProviderName(event.target.value)}
                      className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <input
                      type="text"
                      maxLength={60}
                      placeholder={t('aiprof_ph_provider_role')}
                      value={newProviderRole}
                      onChange={(event) => setNewProviderRole(event.target.value)}
                      className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    {teamMembers.length ? (
                      <select
                        aria-label={t('aiprof_lbl_providers')}
                        value={newProviderLinkedId}
                        onChange={(event) => setNewProviderLinkedId(event.target.value)}
                        className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                      >
                        <option value="">{t('aiprof_opt_no_login')}</option>
                        {teamMembers.map((member) => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    ) : null}
                    <div>
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_provider_working_days')}</span>
                      <div className="flex gap-1">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setNewProviderWorkingDays((current) =>
                              current.includes(day.value) ? current.filter((d) => d !== day.value) : [...current, day.value]
                            )}
                            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                              newProviderWorkingDays.includes(day.value)
                                ? 'bg-[#9333ea]/20 border-[#9333ea]/50 text-[#9333ea]'
                                : 'bg-[#131A24] border-[#243041] text-[#70829B]'
                            }`}
                          >
                            {t(day.labelKey)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_provider_working_hours')}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min={0} max={23}
                          placeholder="Start"
                          value={newProviderStartHour}
                          onChange={(event) => setNewProviderStartHour(event.target.value)}
                          className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-1.5 outline-none"
                        />
                        <span className="text-[#70829B] text-xs">–</span>
                        <input
                          type="number" min={1} max={24}
                          placeholder="End"
                          value={newProviderEndHour}
                          onChange={(event) => setNewProviderEndHour(event.target.value)}
                          className="w-full bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-1.5 outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddProvider}
                      disabled={savingProvider || !newProviderName.trim()}
                      className="w-full py-2 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {savingProvider ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {t('aiprof_btn_add_provider')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={LABEL}>{t('aiprof_lbl_appointment_types')}</label>
                  <div className="space-y-1.5 mb-3">
                    {appointmentTypes.map((type) => (
                      <div key={type.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${type.active ? 'bg-[#131A24] border-[#243041]' : 'bg-[#131A24]/40 border-[#243041]/60 opacity-60'}`}>
                        <span className="flex-1 min-w-0 text-white text-xs font-semibold truncate">
                          {type.name} <span className="text-[#A4B0B7] font-normal">· {type.duration_minutes} min</span>
                        </span>
                        <button type="button" onClick={() => handleToggleType(type)} className="text-[10px] font-bold text-[#9333ea] cursor-pointer">
                          {type.active ? t('aiprof_btn_pause') : t('aiprof_btn_resume')}
                        </button>
                        <button type="button" onClick={() => handleDeleteType(type)} className="text-[#A4B0B7] hover:text-rose-400 cursor-pointer" title={t('aiprof_btn_remove')}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {!appointmentTypes.length ? <p className="text-[#4A5568] text-xs">{t('aiprof_no_types')}</p> : null}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_type_name')}
                      value={newTypeName}
                      onChange={(event) => setNewTypeName(event.target.value)}
                      className="flex-1 min-w-0 bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <input
                      type="number"
                      min={5}
                      max={480}
                      value={newTypeMinutes}
                      onChange={(event) => setNewTypeMinutes(event.target.value)}
                      title={t('aiprof_lbl_minutes')}
                      className="w-16 bg-[#131A24] border border-[#243041] rounded-lg text-xs text-white px-2 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <button
                      type="button"
                      onClick={handleAddType}
                      disabled={savingType || !newTypeName.trim()}
                      className="px-3 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg cursor-pointer disabled:opacity-60"
                      title={t('aiprof_btn_add_type')}
                    >
                      {savingType ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    </button>
                  </div>
                  {providers.length ? (
                    <div className="mt-2">
                      <span className="text-[#70829B] text-[10px] block mb-1">{t('aiprof_lbl_eligible_providers')}</span>
                      <div className="flex flex-wrap gap-1">
                        {providers.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setNewTypeEligibleProviderIds((current) =>
                              current.includes(provider.id) ? current.filter((id) => id !== provider.id) : [...current, provider.id]
                            )}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                              newTypeEligibleProviderIds.includes(provider.id)
                                ? 'bg-[#9333ea]/20 border-[#9333ea]/50 text-[#9333ea]'
                                : 'bg-[#131A24] border-[#243041] text-[#70829B]'
                            }`}
                          >
                            {provider.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Ban} title={t('aiprof_hdr_cancellation_policy')} description={t('aiprof_cancellation_policy_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_cancellation_policy')}
              value={callSettings?.cancellation_policy || ''}
              onChange={(event) => updateField('cancellation_policy', event.target.value)}
              aria-label={t('aiprof_hdr_cancellation_policy')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="cancellation_policy" value={callSettings?.cancellation_policy || ''} onChange={(text) => updateField('cancellation_policy', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={AlertTriangle} title={t('aiprof_hdr_emergency_keywords')} description={t('aiprof_emergency_keywords_desc')}>
            <p className="text-xs text-[#70829B] mb-2">{t('aiprof_emergency_keywords_builtin_hint')}</p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                maxLength={80}
                placeholder={t('aiprof_ph_emergency_keyword')}
                value={newEmergencyKeyword}
                onChange={(event) => setNewEmergencyKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addEmergencyKeyword();
                  }
                }}
                className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
              />
              <button
                type="button"
                id="aiprof-emergency-add"
                onClick={addEmergencyKeyword}
                className="px-3 rounded-xl bg-[#131A24] border border-[#243041] text-[#9BA7BB] hover:text-white flex items-center gap-1 text-xs font-semibold cursor-pointer"
              >
                <Plus size={14} />
                {t('aiprof_btn_add_keyword')}
              </button>
            </div>
            {(callSettings?.emergency_keywords || []).length === 0 ? (
              <p className="text-xs text-[#70829B]">{t('aiprof_emergency_keywords_empty')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(callSettings?.emergency_keywords || []).map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#131A24] border border-[#243041] text-[#9BA7BB] flex items-center gap-1.5"
                  >
                    {keyword}
                    <button type="button" onClick={() => removeEmergencyKeyword(keyword)} title={t('aiprof_btn_remove_keyword')} className="cursor-pointer hover:text-rose-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-[#243041] space-y-3">
              <div>
                <label className={LABEL}>{t('aiprof_lbl_emergency_mode')}</label>
                <div className="space-y-2 mt-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emergency_response_mode"
                      checked={(callSettings?.emergency_response_mode || 'take_message') === 'take_message'}
                      onChange={() => updateField('emergency_response_mode', 'take_message')}
                      className="w-4 h-4 mt-0.5 accent-[#9333ea]"
                    />
                    <span>
                      <span className="text-white text-sm font-semibold block">{t('aiprof_emergency_mode_message_title')}</span>
                      <span className="text-[#A4B0B7] text-xs">{t('aiprof_emergency_mode_message_hint')}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emergency_response_mode"
                      checked={callSettings?.emergency_response_mode === 'direct_to_911'}
                      onChange={() => updateField('emergency_response_mode', 'direct_to_911')}
                      className="w-4 h-4 mt-0.5 accent-[#9333ea]"
                    />
                    <span>
                      <span className="text-white text-sm font-semibold block">{t('aiprof_emergency_mode_911_title')}</span>
                      <span className="text-[#A4B0B7] text-xs">{t('aiprof_emergency_mode_911_hint')}</span>
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="aiprof-emergency-alert-phone">{t('aiprof_lbl_emergency_alert_phone')}</label>
                <input
                  id="aiprof-emergency-alert-phone"
                  type="tel"
                  maxLength={32}
                  placeholder={t('aiprof_ph_emergency_alert_phone')}
                  value={callSettings?.emergency_alert_phone || ''}
                  onChange={(event) => updateField('emergency_alert_phone', event.target.value)}
                  className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
                />
                <p className="text-[#70829B] text-xs mt-1">{t('aiprof_emergency_alert_phone_hint')}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={MessageSquare} title={t('aiprof_hdr_sms_wording')} description={t('aiprof_sms_wording_desc')}>
            <div className="space-y-3">
              {SMS_WORDING_KINDS.map((kind) => (
                <div key={kind.key}>
                  <label className={LABEL} htmlFor={`aiprof-wording-${kind.key}`}>{kind.label}</label>
                  <input
                    id={`aiprof-wording-${kind.key}`}
                    type="text"
                    maxLength={300}
                    placeholder={kind.builtIn}
                    value={callSettings?.sms_wording?.[kind.key] || ''}
                    onChange={(event) => updateWordingField(kind.key, event.target.value)}
                    className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
                  />
                  <AiFieldTools
                    fieldKey={`sms_${kind.key}`}
                    value={callSettings?.sms_wording?.[kind.key] || ''}
                    onChange={(text) => updateWordingField(kind.key, text)}
                    businessType={callSettings?.business_type}
                    t={t}
                  />
                </div>
              ))}
            </div>
            <p className="text-[#4A5568] text-xs mt-3">{t('aiprof_sms_wording_placeholders_hint')}</p>
          </SectionCard>

          <SectionCard icon={Workflow} title={t('aiprof_hdr_playbooks')} description={t('aiprof_playbooks_desc')}>
            <div className="space-y-4">
              {(callSettings?.call_routing_rules || []).map((rule) => (
                <div key={rule.id} className="rounded-xl border border-[#243041] bg-[#131A24] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_playbook_name')}
                      value={rule.name}
                      onChange={(event) => updatePlaybook(rule.id, 'name', event.target.value)}
                      className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white font-semibold px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title={t('aiprof_lbl_playbook_active')}>
                      <input
                        type="checkbox"
                        checked={rule.active !== false}
                        onChange={(event) => updatePlaybook(rule.id, 'active', event.target.checked)}
                        className="w-4 h-4 accent-[#9333ea]"
                      />
                      <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_playbook_active')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removePlaybook(rule.id)}
                      className="shrink-0 p-2 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                      title={t('aiprof_btn_remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_playbook_trigger')}</label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder={t('aiprof_ph_playbook_trigger')}
                      value={rule.trigger_description}
                      onChange={(event) => updatePlaybook(rule.id, 'trigger_description', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_playbook_questions')}</label>
                    <div className="space-y-1.5">
                      {(rule.questions_to_ask || []).map((question, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={200}
                            placeholder={t('aiprof_ph_playbook_question')}
                            value={question}
                            onChange={(event) => updatePlaybookQuestion(rule.id, index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removePlaybookQuestion(rule.id, index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(rule.questions_to_ask || []).length < 8 ? (
                      <button
                        type="button"
                        onClick={() => addPlaybookQuestion(rule.id)}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_question')}
                      </button>
                    ) : null}
                  </div>

                  {(providers.length || appointmentTypes.length) ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {providers.length ? (
                        <select
                          aria-label={t('aiprof_lbl_playbook_provider')}
                          value={rule.provider_id || ''}
                          onChange={(event) => updatePlaybook(rule.id, 'provider_id', event.target.value)}
                          className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                        >
                          <option value="">{t('cal_opt_no_provider')}</option>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                          ))}
                        </select>
                      ) : null}
                      {appointmentTypes.length ? (
                        <select
                          aria-label={t('aiprof_lbl_playbook_appointment_type')}
                          value={rule.appointment_type_id || ''}
                          onChange={(event) => updatePlaybook(rule.id, 'appointment_type_id', event.target.value)}
                          className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none"
                        >
                          <option value="">{t('cal_opt_no_appointment_type')}</option>
                          {appointmentTypes.map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ) : null}

                  <input
                    type="text"
                    maxLength={120}
                    placeholder={t('aiprof_ph_playbook_notify')}
                    value={rule.notify_target || ''}
                    onChange={(event) => updatePlaybook(rule.id, 'notify_target', event.target.value)}
                    className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                  />
                  <input
                    type="text"
                    maxLength={200}
                    placeholder={t('aiprof_ph_playbook_note')}
                    value={rule.crm_note || ''}
                    onChange={(event) => updatePlaybook(rule.id, 'crm_note', event.target.value)}
                    className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                  />
                </div>
              ))}
              {!(callSettings?.call_routing_rules || []).length ? (
                <p className="text-[#4A5568] text-xs">{t('aiprof_no_playbooks')}</p>
              ) : null}
              <button
                type="button"
                onClick={addPlaybook}
                className="w-full py-2.5 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> {t('aiprof_btn_add_playbook')}
              </button>
            </div>
          </SectionCard>

          <SectionCard icon={PhoneOutgoing} title={t('aiprof_hdr_outbound_purposes')} description={t('aiprof_outbound_purposes_desc')}>
            <div className="space-y-4">
              {(callSettings?.outbound_call_purposes || []).map((purpose) => (
                <div key={purpose.id} className="rounded-xl border border-[#243041] bg-[#131A24] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={80}
                      placeholder={t('aiprof_ph_outbound_purpose_name')}
                      value={purpose.name}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'name', event.target.value)}
                      className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white font-semibold px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title={t('aiprof_lbl_outbound_purpose_active')}>
                      <input
                        type="checkbox"
                        checked={purpose.active !== false}
                        onChange={(event) => updateOutboundPurpose(purpose.id, 'active', event.target.checked)}
                        className="w-4 h-4 accent-[#9333ea]"
                      />
                      <span className="text-[10px] font-bold text-[#A4B0B7] uppercase">{t('aiprof_lbl_outbound_purpose_active')}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeOutboundPurpose(purpose.id)}
                      className="shrink-0 p-2 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                      title={t('aiprof_btn_remove')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_opening')}</label>
                    <input
                      type="text"
                      maxLength={500}
                      placeholder={t('aiprof_ph_outbound_purpose_opening')}
                      value={purpose.opening_message || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'opening_message', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_objective')}</label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder={t('aiprof_ph_outbound_purpose_objective')}
                      value={purpose.objective || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'objective', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_questions')}</label>
                    <div className="space-y-1.5">
                      {(purpose.questions_to_ask || []).map((question, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={200}
                            placeholder={t('aiprof_ph_outbound_purpose_question')}
                            value={question}
                            onChange={(event) => updateOutboundPurposeListItem(purpose.id, 'questions_to_ask', index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeOutboundPurposeListItem(purpose.id, 'questions_to_ask', index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(purpose.questions_to_ask || []).length < 8 ? (
                      <button
                        type="button"
                        onClick={() => addOutboundPurposeListItem(purpose.id, 'questions_to_ask')}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_outbound_purpose_question')}
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_actions')}</label>
                    <div className="space-y-1.5">
                      {(purpose.allowed_actions || []).map((action, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={120}
                            placeholder={t('aiprof_ph_outbound_purpose_action')}
                            value={action}
                            onChange={(event) => updateOutboundPurposeListItem(purpose.id, 'allowed_actions', index, event.target.value)}
                            className="flex-1 bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-1.5 outline-none focus:border-[#9333ea]/50"
                          />
                          <button
                            type="button"
                            onClick={() => removeOutboundPurposeListItem(purpose.id, 'allowed_actions', index)}
                            className="shrink-0 p-1.5 text-[#A4B0B7] hover:text-rose-400 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(purpose.allowed_actions || []).length < 10 ? (
                      <button
                        type="button"
                        onClick={() => addOutboundPurposeListItem(purpose.id, 'allowed_actions')}
                        className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-[#9333ea] cursor-pointer"
                      >
                        <Plus size={11} /> {t('aiprof_btn_add_outbound_purpose_action')}
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_closing')}</label>
                    <input
                      type="text"
                      maxLength={500}
                      placeholder={t('aiprof_ph_outbound_purpose_closing')}
                      value={purpose.closing_message || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'closing_message', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-sm text-white px-3 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>

                  <div>
                    <label className={LABEL}>{t('aiprof_lbl_outbound_purpose_followup_sms')}</label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder={t('aiprof_ph_outbound_purpose_followup_sms')}
                      value={purpose.follow_up_sms || ''}
                      onChange={(event) => updateOutboundPurpose(purpose.id, 'follow_up_sms', event.target.value)}
                      className="w-full bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    />
                  </div>
                </div>
              ))}
              {!(callSettings?.outbound_call_purposes || []).length ? (
                <p className="text-[#4A5568] text-xs">{t('aiprof_no_outbound_purposes')}</p>
              ) : null}
              <button
                type="button"
                onClick={addOutboundPurpose}
                className="w-full py-2.5 bg-[#9333ea]/10 border border-[#9333ea]/30 text-[#9333ea] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> {t('aiprof_btn_add_outbound_purpose')}
              </button>
            </div>
          </SectionCard>

          <SectionCard icon={PhoneForwarded} title={t('aiprof_hdr_transfer')} description={t('aiprof_transfer_desc')}>
            <input
              type="tel"
              maxLength={32}
              placeholder="+1 555 000 1111"
              value={callSettings?.transfer_number || ''}
              onChange={(event) => updateField('transfer_number', event.target.value)}
              aria-label={t('aiprof_hdr_transfer')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            />
          </SectionCard>

          <SectionCard icon={Grid3x3} title={t('aiprof_hdr_language_menu')} description={t('aiprof_language_menu_desc')}>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={Boolean(callSettings?.language_menu_enabled)}
                onChange={(event) => updateField('language_menu_enabled', event.target.checked)}
                className="w-4 h-4 accent-[#9333ea]"
              />
              <span className="text-white text-sm font-semibold">{t('aiprof_toggle_language_menu')}</span>
            </label>

            {callSettings?.language_menu_enabled ? (
              <div className="space-y-2">
                {(callSettings?.language_menu || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={option.digit}
                      onChange={(event) => updateMenuOption(index, 'digit', event.target.value)}
                      className="w-16 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-2 py-2 outline-none"
                    >
                      {DIGIT_CHOICES.map((digit) => <option key={digit} value={digit}>{digit}</option>)}
                    </select>
                    <select
                      value={option.language}
                      onChange={(event) => updateMenuOption(index, 'language', event.target.value)}
                      className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2 outline-none"
                    >
                      {PHONE_LANGUAGE_OPTIONS.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMenuOption(index)}
                      className="p-2 text-[#A4B0B7] hover:text-rose-400 transition-colors cursor-pointer"
                      title={t('aiprof_btn_remove_option')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(callSettings?.language_menu || []).length < MAX_MENU_OPTIONS ? (
                  <button
                    type="button"
                    onClick={addMenuOption}
                    className="text-xs font-bold text-[#9333ea] hover:underline cursor-pointer"
                  >
                    + {t('aiprof_btn_add_option')}
                  </button>
                ) : null}
                <p className="text-[#4A5568] text-xs mt-2">{t('aiprof_language_menu_hint')}</p>
              </div>
            ) : null}
          </SectionCard>

          <div className="flex items-center justify-end gap-3">
            {saved ? <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} />{t('aiprof_saved')}</span> : null}
            <button
              type="button"
              onClick={() => setTestModalOpen(true)}
              className="px-5 py-2.5 bg-[#131A24] border border-[#243041] hover:border-[#9333ea]/50 text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <MessageSquare size={14} className="text-[#9333ea]" />
              {t('aiprof_btn_test_ai')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('aiprof_btn_save')}
            </button>
          </div>
        </>
      )}

      {testModalOpen ? <TestAIModal onClose={() => setTestModalOpen(false)} t={t} /> : null}
    </div>
  );
}

function TestAIModal({ onClose, t }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // { id, role: 'ai' | 'user', text }
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const sessionIdRef = useRef(null);

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const startSession = useCallback(async () => {
    setStarting(true);
    setError('');
    setEnded(false);
    setMessages([]);
    try {
      const response = await smartflowApi.startAICallTest();
      const data = response.data?.data || {};
      setSessionId(data.session_id || null);
      sessionIdRef.current = data.session_id || null;
      setMessages([{ id: 'greeting', role: 'ai', text: data.greeting || '' }]);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_test_err_start'));
    } finally {
      setStarting(false);
      scrollToBottom();
    }
  }, [t]);

  useEffect(() => {
    startSession();
    return () => {
      // Best-effort cleanup — don't block closing the modal on it.
      if (sessionIdRef.current) {
        smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !sessionId || ended) return;
    setInput('');
    setError('');
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    scrollToBottom();
    try {
      const response = await smartflowApi.sendAICallTestMessage(sessionId, text);
      const data = response.data?.data || {};
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ai', text: data.reply || '' }]);
      if (data.ended) setEnded(true);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_test_err_send'));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleNewTest = () => {
    if (sessionIdRef.current) {
      smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
    }
    setSessionId(null);
    sessionIdRef.current = null;
    startSession();
  };

  const handleClose = () => {
    if (sessionIdRef.current) {
      smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-[#0A1019] border border-[#243041] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#243041]">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-[#9333ea]" />
              {t('aiprof_test_modal_title')}
            </h3>
            <p className="text-[#A4B0B7] text-xs mt-1">{t('aiprof_test_modal_desc')}</p>
          </div>
          <button type="button" onClick={handleClose} className="text-[#A4B0B7] hover:text-white cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
          {starting ? (
            <div className="flex items-center justify-center h-40 gap-2 text-[#A4B0B7] text-sm">
              <Loader2 size={16} className="animate-spin text-[#9333ea]" />
              {t('aiprof_test_starting')}
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    message.role === 'user'
                      ? 'bg-[#9333ea]/20 border border-[#9333ea]/30 text-white rounded-br-none'
                      : 'bg-[#131A24] border border-[#243041] text-white rounded-bl-none'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}
          {sending ? (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-none bg-[#131A24] border border-[#243041] text-[#A4B0B7] text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
              </div>
            </div>
          ) : null}
          {ended ? (
            <p className="text-center text-[#4A5568] text-xs pt-2">{t('aiprof_test_ended')}</p>
          ) : null}
        </div>

        {error ? <div className="mx-4 mb-2 bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-2.5">{error}</div> : null}

        <div className="p-4 border-t border-[#243041] space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              disabled={starting || ended}
              placeholder={t('aiprof_test_input_ph')}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={starting || sending || ended || !input.trim()}
              className="p-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-white rounded-xl transition-all cursor-pointer disabled:opacity-60"
              title={t('aiprof_test_btn_send')}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleNewTest}
              disabled={starting}
              className="text-xs font-bold text-[#9333ea] hover:underline cursor-pointer disabled:opacity-60"
            >
              {t('aiprof_test_btn_new')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-[#131A24] border border-[#243041] hover:border-[#9333ea]/50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {t('aiprof_test_btn_close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIConfigTab;
