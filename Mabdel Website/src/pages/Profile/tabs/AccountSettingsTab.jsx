import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, PhoneCall, Shield, Trash2 } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import BusinessHoursCard from '../../../components/Calls/BusinessHoursCard';
import { Field, INPUT } from '../shared';
import { formatCstDate } from '../../../utils/dateUtils';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuthStore } from '../../../store/useAuthStore';

const CONTENT_SECTIONS = [
  { key: 'about', label: 'About', request: () => smartflowApi.getAboutUs() },
  { key: 'terms', label: 'Terms', request: () => smartflowApi.getTermsAndConditions() },
  { key: 'privacy', label: 'Privacy', request: () => smartflowApi.getPrivacyPolicy() },
  { key: 'help', label: 'Help', request: () => smartflowApi.getHelpSupportContent() },
];

const formatUpdatedAt = (value, t) => {
  if (!value) return t('aprof_no_date');
  try {
    return formatCstDate(value);
  } catch {
    return t('aprof_no_date');
  }
};

const getApiErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((item) => item?.msg).filter(Boolean).join(', ') || fallback;
  }
  return error?.response?.data?.message || fallback;
};

function AccountSettingsTab() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  // Everyone on the team can see the business number's status (matches the
  // backend's own calls:view gate on GET /telnyx/status), but only an owner or
  // someone the owner has explicitly granted calls:manage to (RBAC, via Owner
  // Dashboard) may provision/reprovision the platform number or connect/remove a
  // custom Telnyx account — those actions were previously shown to every role,
  // relying entirely on the backend's 403 to stop non-owners after the fact.
  const canManageTelnyx = (user?.permissions || []).includes('calls:manage');
  const [contentPages, setContentPages] = useState({});
  const [telnyxStatus, setTelnyxStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingCustom, setSavingCustom] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [removingCustom, setRemovingCustom] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState({
    about: true,
    terms: false,
    privacy: false,
    help: false,
  });
  const [customForm, setCustomForm] = useState({
    api_key: '',
    phone_number: '',
  });

  const loadData = async () => {
    const [telnyxResponse, ...contentResponses] = await Promise.all([
      smartflowApi.getTelnyxStatus(),
      ...CONTENT_SECTIONS.map((item) => item.request()),
    ]);

    const nextPages = {};
    CONTENT_SECTIONS.forEach((item, index) => {
      nextPages[item.key] = contentResponses[index]?.data?.data || null;
    });

    setTelnyxStatus(telnyxResponse?.data?.data || null);
    setContentPages(nextPages);
  };

  useEffect(() => {
    let ignore = false;

    loadData()
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || t('aprof_err_load'));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const platformStatus = telnyxStatus?.telnyx_setup_status || 'not_provisioned';
  const customMode = telnyxStatus?.telnyx_mode === 'custom';

  const platformSummary = useMemo(() => {
    if (platformStatus === 'active' && telnyxStatus?.telnyx_phone_number) {
      return t('aprof_active_num', { number: telnyxStatus.telnyx_phone_number });
    }
    if (platformStatus === 'provisioning') return t('aprof_provisioning');
    if (platformStatus === 'failed') return t('aprof_failed');
    return t('aprof_inactive');
  }, [platformStatus, telnyxStatus?.telnyx_phone_number, t]);

  async function handleProvisionTelnyx() {
    setProvisioning(true);
    setError('');
    setSuccess('');

    try {
      const response = await smartflowApi.provisionTelnyx();
      setTelnyxStatus(response?.data?.data || telnyxStatus);
      setSuccess(t('aprof_success_provision'));
    } catch (provisionError) {
      setError(getApiErrorMessage(provisionError, t('aprof_err_provision')));
    } finally {
      setProvisioning(false);
    }
  }

  async function handleSaveCustomTelnyx() {
    setSavingCustom(true);
    setError('');
    setSuccess('');

    try {
      const response = await smartflowApi.saveCustomTelnyx({
        api_key: customForm.api_key.trim(),
        phone_number: customForm.phone_number.trim(),
      });
      setTelnyxStatus(response?.data?.data || telnyxStatus);
      setCustomForm({ api_key: '', phone_number: '' });
      setSuccess(t('aprof_success_connect'));
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, t('aprof_err_connect')));
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleRemoveCustomTelnyx() {
    setRemovingCustom(true);
    setError('');
    setSuccess('');

    try {
      await smartflowApi.removeCustomTelnyx();
      const statusResponse = await smartflowApi.getTelnyxStatus();
      setTelnyxStatus(statusResponse?.data?.data || null);
      setSuccess(t('aprof_success_remove'));
    } catch (removeError) {
      setError(getApiErrorMessage(removeError, t('aprof_err_remove')));
    } finally {
      setRemovingCustom(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-[#9333ea]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">
          <AlertTriangle size={14} />
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-300">
          <CheckCircle2 size={14} />
          {success}
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-[#243041] bg-[#0A1019] p-5">
        <div className="flex items-center gap-2">
          <PhoneCall size={16} className="text-[#9333ea]" />
          <h3 className="font-bold text-white">{t('aprof_title')}</h3>
        </div>

        <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4">
          <p className="text-sm font-semibold text-white">{t('aprof_lbl_platform') || 'Platform-managed number'}</p>
          <p className="mt-1 text-sm text-[#A4B0B7]">{platformSummary}</p>
          {canManageTelnyx ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                onClick={handleProvisionTelnyx}
                disabled={provisioning || platformStatus === 'provisioning'}
                className="rounded-xl bg-[#9333ea] px-4 py-2.5 text-sm font-bold text-[#02080B] disabled:opacity-60 cursor-pointer"
              >
                {provisioning ? t('aprof_provisioning_btn') : platformStatus === 'active' ? t('aprof_btn_reprovision') || 'Re-run Provision Check' : t('aprof_btn_provision')}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#4A5568]">{t('aprof_owner_only_hint')}</p>
          )}
        </div>

        <BusinessHoursCard />

        {canManageTelnyx ? (
          <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4">
            <p className="text-sm font-semibold text-white">{t('aprof_hdr_custom')}</p>
            <p className="text-xs text-[#A4B0B7] mt-1">{t('aprof_lbl_custom_desc')}</p>
            {customMode && telnyxStatus?.telnyx_custom_phone_number ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-sm text-emerald-300">
                  {t('aprof_connected_num') || 'Connected number:'} {telnyxStatus.telnyx_custom_phone_number}
                </div>
                <button
                  onClick={handleRemoveCustomTelnyx}
                  disabled={removingCustom}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-2.5 text-sm font-semibold text-rose-300 disabled:opacity-60 cursor-pointer"
                >
                  <Trash2 size={14} />
                  {removingCustom ? t('aprof_removing_btn') : t('aprof_btn_remove')}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <Field label={t('aprof_lbl_api_key') || 'Telnyx API Key'}>
                  <input
                    type="password"
                    value={customForm.api_key}
                    onChange={(event) => setCustomForm((current) => ({ ...current, api_key: event.target.value }))}
                    className={INPUT}
                    placeholder={t('aprof_ph_token') || 'Your Telnyx API key'}
                  />
                </Field>
                <Field label={t('aprof_lbl_phone')}>
                  <input
                    value={customForm.phone_number}
                    onChange={(event) => setCustomForm((current) => ({ ...current, phone_number: event.target.value }))}
                    className={INPUT}
                    placeholder="+12025551234"
                  />
                </Field>
                <button
                  onClick={handleSaveCustomTelnyx}
                  disabled={savingCustom}
                  className="rounded-xl border border-[#9333ea]/20 bg-[#9333ea]/10 px-4 py-2.5 text-sm font-bold text-[#9333ea] disabled:opacity-60 cursor-pointer"
                >
                  {savingCustom ? t('aprof_connecting_btn') : t('aprof_btn_connect')}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-[#243041] bg-[#0A1019] p-5">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#9333ea]" />
          <h3 className="font-bold text-white">{t('aprof_hdr_legal')}</h3>
        </div>

        {CONTENT_SECTIONS.map((section) => {
          const page = contentPages[section.key];
          const open = expanded[section.key];
          return (
            <div key={section.key} className="rounded-xl border border-[#243041] bg-[#131A24]">
              <button
                onClick={() => setExpanded((current) => ({ ...current, [section.key]: !current[section.key] }))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
              >
                <div>
                  <p className="font-semibold text-white">{page?.title || section.label}</p>
                  <p className="text-xs text-[#A4B0B7]">{t('aprof_updated').replace('{date}', formatUpdatedAt(page?.updated_at, t))}</p>
                </div>
                {open ? <ChevronUp size={16} className="text-[#A4B0B7]" /> : <ChevronDown size={16} className="text-[#A4B0B7]" />}
              </button>

              {open ? (
                <div className="space-y-3 border-t border-[#243041] px-4 py-4">
                  {(page?.blocks || []).map((block) => (
                    <div key={`${section.key}-${block.order}`}>
                      {block.heading ? <p className="text-sm font-semibold text-white">{block.heading}</p> : null}
                      <p className="text-sm leading-6 text-[#A4B0B7]">{block.body}</p>
                    </div>
                  ))}
                  {section.key === 'help' ? (
                    <a
                      href="mailto:sales@gocustify.com"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#9333ea]"
                    >
                      <ExternalLink size={14} />
                      sales@gocustify.com
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccountSettingsTab;
