import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Globe, Loader2, MessageSquare, Save,
} from 'lucide-react';
import { smartflowApi } from '../../../../api/services';
import { AI_LANGUAGE_OPTIONS, getStoredAiLanguage, setStoredAiLanguage } from '../../../../utils/voiceAgentConfig';
import { useLanguage } from '../../../../context/LanguageContext';
import {
  BUSINESS_TYPE_OPTIONS, DIGIT_CHOICES, MAX_MENU_OPTIONS, PHONE_LANGUAGE_OPTIONS,
  RECEPTIONIST_FIELD_KEYS, SMS_WORDING_KINDS, getReceptionistFieldValue,
} from './constants';
import TestAIModal from './TestAIModal';
import PersonaSection from './PersonaSection';
import VoicesSection from './VoicesSection';
import GreetingsSection from './GreetingsSection';
import InstructionsSection from './InstructionsSection';
import EngineSection from './EngineSection';
import KnowledgeSection from './KnowledgeSection';
import AppointmentsSection from './AppointmentsSection';
import PermissionsSection from './PermissionsSection';
import SchedulingSection from './SchedulingSection';
import CancellationPolicySection from './CancellationPolicySection';
import InsuranceSection from './InsuranceSection';
import EmergencySection from './EmergencySection';
import SmsWordingSection from './SmsWordingSection';
import PlaybooksSection from './PlaybooksSection';
import OutboundPurposesSection from './OutboundPurposesSection';
import TransferSection from './TransferSection';
import LanguageMenuSection from './LanguageMenuSection';

export default function AIConfigTab() {
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

  const updateInsurancePlan = (id, field, value) => {
    setCallSettings((prev) => ({
      ...(prev || {}),
      insurance_plans: (prev?.insurance_plans || []).map((plan) => (plan.id === id ? { ...plan, [field]: value } : plan)),
    }));
  };

  const addInsurancePlan = () => {
    const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCallSettings((prev) => ({
      ...(prev || {}),
      insurance_plans: [
        ...(prev?.insurance_plans || []),
        { id, payer: '', plan_name: '', accepted: true, network_status: 'unknown', verification_required: false, active: true },
      ],
    }));
  };

  const removeInsurancePlan = (id) => {
    setCallSettings((prev) => ({ ...(prev || {}), insurance_plans: (prev?.insurance_plans || []).filter((plan) => plan.id !== id) }));
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
        { id, name: '', trigger_description: '', questions_to_ask: [], provider_id: '', appointment_type_id: '', notify_target: '', notify_role: null, crm_note: '', active: true },
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
        insurance_plans: (callSettings.insurance_plans || [])
          .filter((plan) => plan.payer?.trim())
          .map((plan) => ({
            id: plan.id,
            payer: plan.payer.trim(),
            plan_name: plan.plan_name?.trim() || null,
            accepted: plan.accepted !== false,
            network_status: plan.network_status || 'unknown',
            verification_required: Boolean(plan.verification_required),
            effective_from: plan.effective_from || null,
            effective_until: plan.effective_until || null,
            last_verified_at: plan.last_verified_at || null,
            active: plan.active !== false,
          })),
        sms_confirmations_enabled: callSettings.sms_confirmations_enabled !== false,
        request_sms_events: callSettings.request_sms_events || [],
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
            notify_role: rule.notify_role || null,
            target_user_ids: rule.target_user_ids || [],
            transfer_number: rule.transfer_number?.trim() || null,
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
          <PersonaSection
            callSettings={callSettings} businessTypeIsOther={businessTypeIsOther} setBusinessTypeIsOther={setBusinessTypeIsOther}
            generatingAll={generatingAll} generateAllError={generateAllError} updateField={updateField}
            generateAllFieldsForBusinessType={generateAllFieldsForBusinessType} t={t}
          />

          <VoicesSection voices={voices} loadingVoices={loadingVoices} callSettings={callSettings} updateField={updateField} t={t} />

          <GreetingsSection callSettings={callSettings} updateField={updateField} t={t} />

          <InstructionsSection callSettings={callSettings} instructionsLength={instructionsLength} updateField={updateField} t={t} />

          <EngineSection engine={engine} updateField={updateField} t={t} />

          <KnowledgeSection callSettings={callSettings} knowledgeLength={knowledgeLength} updateField={updateField} t={t} />

          <AppointmentsSection callSettings={callSettings} updateField={updateField} t={t} />

          <PermissionsSection callSettings={callSettings} updateCapability={updateCapability} t={t} />

          <SchedulingSection
            providers={providers} appointmentTypes={appointmentTypes} loadingScheduling={loadingScheduling} teamMembers={teamMembers}
            newProviderName={newProviderName} setNewProviderName={setNewProviderName}
            newProviderRole={newProviderRole} setNewProviderRole={setNewProviderRole}
            newProviderLinkedId={newProviderLinkedId} setNewProviderLinkedId={setNewProviderLinkedId}
            newProviderWorkingDays={newProviderWorkingDays} setNewProviderWorkingDays={setNewProviderWorkingDays}
            newProviderStartHour={newProviderStartHour} setNewProviderStartHour={setNewProviderStartHour}
            newProviderEndHour={newProviderEndHour} setNewProviderEndHour={setNewProviderEndHour}
            newTypeName={newTypeName} setNewTypeName={setNewTypeName}
            newTypeMinutes={newTypeMinutes} setNewTypeMinutes={setNewTypeMinutes}
            newTypeEligibleProviderIds={newTypeEligibleProviderIds} setNewTypeEligibleProviderIds={setNewTypeEligibleProviderIds}
            schedulingError={schedulingError} savingProvider={savingProvider} savingType={savingType}
            handleAddProvider={handleAddProvider} handleToggleProvider={handleToggleProvider} handleDeleteProvider={handleDeleteProvider}
            handleAddType={handleAddType} handleToggleType={handleToggleType} handleDeleteType={handleDeleteType} t={t}
          />

          <CancellationPolicySection callSettings={callSettings} updateField={updateField} t={t} />

          <InsuranceSection
            callSettings={callSettings} updateInsurancePlan={updateInsurancePlan}
            addInsurancePlan={addInsurancePlan} removeInsurancePlan={removeInsurancePlan} t={t}
          />

          <EmergencySection
            callSettings={callSettings} newEmergencyKeyword={newEmergencyKeyword} setNewEmergencyKeyword={setNewEmergencyKeyword}
            updateField={updateField} addEmergencyKeyword={addEmergencyKeyword} removeEmergencyKeyword={removeEmergencyKeyword} t={t}
          />

          <SmsWordingSection callSettings={callSettings} updateWordingField={updateWordingField} t={t} />

          <PlaybooksSection
            callSettings={callSettings} providers={providers} appointmentTypes={appointmentTypes} teamMembers={teamMembers}
            updatePlaybook={updatePlaybook} addPlaybook={addPlaybook} removePlaybook={removePlaybook}
            addPlaybookQuestion={addPlaybookQuestion} updatePlaybookQuestion={updatePlaybookQuestion}
            removePlaybookQuestion={removePlaybookQuestion} t={t}
          />

          <OutboundPurposesSection
            callSettings={callSettings} updateOutboundPurpose={updateOutboundPurpose}
            addOutboundPurpose={addOutboundPurpose} removeOutboundPurpose={removeOutboundPurpose}
            addOutboundPurposeListItem={addOutboundPurposeListItem} updateOutboundPurposeListItem={updateOutboundPurposeListItem}
            removeOutboundPurposeListItem={removeOutboundPurposeListItem} t={t}
          />

          <TransferSection callSettings={callSettings} updateField={updateField} t={t} />

          <LanguageMenuSection
            callSettings={callSettings} updateField={updateField} updateMenuOption={updateMenuOption}
            addMenuOption={addMenuOption} removeMenuOption={removeMenuOption} t={t}
          />

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
