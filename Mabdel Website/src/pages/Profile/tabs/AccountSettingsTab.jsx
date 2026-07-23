import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, PhoneCall, Shield, Trash2 } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import { Field, INPUT } from '../shared';

const CONTENT_SECTIONS = [
  { key: 'about', label: 'About', request: () => smartflowApi.getAboutUs() },
  { key: 'terms', label: 'Terms', request: () => smartflowApi.getTermsAndConditions() },
  { key: 'privacy', label: 'Privacy', request: () => smartflowApi.getPrivacyPolicy() },
  { key: 'help', label: 'Help', request: () => smartflowApi.getHelpSupportContent() },
];

const formatUpdatedAt = (value) => {
  if (!value) return 'No update date';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'No update date';
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
  const [contentPages, setContentPages] = useState({});
  const [twilioStatus, setTwilioStatus] = useState(null);
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
    account_sid: '',
    auth_token: '',
    phone_number: '',
  });

  const loadData = async () => {
    const [twilioResponse, ...contentResponses] = await Promise.all([
      smartflowApi.getTwilioStatus(),
      ...CONTENT_SECTIONS.map((item) => item.request()),
    ]);

    const nextPages = {};
    CONTENT_SECTIONS.forEach((item, index) => {
      nextPages[item.key] = contentResponses[index]?.data?.data || null;
    });

    setTwilioStatus(twilioResponse?.data?.data || null);
    setContentPages(nextPages);
  };

  useEffect(() => {
    let ignore = false;

    loadData()
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || 'Could not load account settings.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const platformStatus = twilioStatus?.twilio_setup_status || 'not_provisioned';
  const customMode = twilioStatus?.twilio_mode === 'custom';

  const platformSummary = useMemo(() => {
    if (platformStatus === 'active' && twilioStatus?.twilio_phone_number) {
      return `Active number: ${twilioStatus.twilio_phone_number}`;
    }
    if (platformStatus === 'provisioning') return 'Provisioning is in progress.';
    if (platformStatus === 'failed') return 'Provisioning previously failed.';
    return 'No platform-managed Twilio number is active.';
  }, [platformStatus, twilioStatus?.twilio_phone_number]);

  async function handleProvisionTwilio() {
    setProvisioning(true);
    setError('');
    setSuccess('');

    try {
      const response = await smartflowApi.provisionTwilio();
      setTwilioStatus(response?.data?.data || twilioStatus);
      setSuccess('Twilio provisioning request completed.');
    } catch (provisionError) {
      setError(getApiErrorMessage(provisionError, 'Twilio provisioning failed.'));
    } finally {
      setProvisioning(false);
    }
  }

  async function handleSaveCustomTwilio() {
    setSavingCustom(true);
    setError('');
    setSuccess('');

    try {
      const response = await smartflowApi.saveCustomTwilio({
        account_sid: customForm.account_sid.trim(),
        auth_token: customForm.auth_token.trim(),
        phone_number: customForm.phone_number.trim(),
      });
      setTwilioStatus(response?.data?.data || twilioStatus);
      setCustomForm({ account_sid: '', auth_token: '', phone_number: '' });
      setSuccess('Custom Twilio credentials validated and saved.');
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Could not save Twilio credentials.'));
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleRemoveCustomTwilio() {
    setRemovingCustom(true);
    setError('');
    setSuccess('');

    try {
      await smartflowApi.removeCustomTwilio();
      const statusResponse = await smartflowApi.getTwilioStatus();
      setTwilioStatus(statusResponse?.data?.data || null);
      setSuccess('Custom Twilio credentials removed.');
    } catch (removeError) {
      setError(getApiErrorMessage(removeError, 'Could not remove custom credentials.'));
    } finally {
      setRemovingCustom(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-[#11C7E5]" />
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
          <PhoneCall size={16} className="text-[#11C7E5]" />
          <h3 className="font-bold text-white">Twilio Calling Setup</h3>
        </div>

        <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4">
          <p className="text-sm font-semibold text-white">Platform-managed number</p>
          <p className="mt-1 text-sm text-[#A4B0B7]">{platformSummary}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={handleProvisionTwilio}
              disabled={provisioning || platformStatus === 'provisioning'}
              className="rounded-xl bg-[#11C7E5] px-4 py-2.5 text-sm font-bold text-[#02080B] disabled:opacity-60"
            >
              {provisioning ? 'Provisioning...' : platformStatus === 'active' ? 'Re-run Provision Check' : 'Activate Platform Number'}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4">
          <p className="text-sm font-semibold text-white">Your own Twilio account</p>
          {customMode && twilioStatus?.twilio_custom_phone_number ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-sm text-emerald-300">
                Connected number: {twilioStatus.twilio_custom_phone_number}
              </div>
              <button
                onClick={handleRemoveCustomTwilio}
                disabled={removingCustom}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-2.5 text-sm font-semibold text-rose-300 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {removingCustom ? 'Removing...' : 'Remove Custom Credentials'}
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <Field label="Account SID">
                <input
                  value={customForm.account_sid}
                  onChange={(event) => setCustomForm((current) => ({ ...current, account_sid: event.target.value }))}
                  className={INPUT}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </Field>
              <Field label="Auth Token">
                <input
                  type="password"
                  value={customForm.auth_token}
                  onChange={(event) => setCustomForm((current) => ({ ...current, auth_token: event.target.value }))}
                  className={INPUT}
                  placeholder="Your Twilio auth token"
                />
              </Field>
              <Field label="Phone Number">
                <input
                  value={customForm.phone_number}
                  onChange={(event) => setCustomForm((current) => ({ ...current, phone_number: event.target.value }))}
                  className={INPUT}
                  placeholder="+12025551234"
                />
              </Field>
              <button
                onClick={handleSaveCustomTwilio}
                disabled={savingCustom}
                className="rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 px-4 py-2.5 text-sm font-bold text-[#11C7E5] disabled:opacity-60"
              >
                {savingCustom ? 'Validating...' : 'Validate & Save Credentials'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#243041] bg-[#0A1019] p-5">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#11C7E5]" />
          <h3 className="font-bold text-white">Account Content</h3>
        </div>

        {CONTENT_SECTIONS.map((section) => {
          const page = contentPages[section.key];
          const open = expanded[section.key];
          return (
            <div key={section.key} className="rounded-xl border border-[#243041] bg-[#131A24]">
              <button
                onClick={() => setExpanded((current) => ({ ...current, [section.key]: !current[section.key] }))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="font-semibold text-white">{page?.title || section.label}</p>
                  <p className="text-xs text-[#A4B0B7]">Updated {formatUpdatedAt(page?.updated_at)}</p>
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
                      href="mailto:sales@mabdelai.com"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#11C7E5]"
                    >
                      <ExternalLink size={14} />
                      sales@mabdelai.com
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
