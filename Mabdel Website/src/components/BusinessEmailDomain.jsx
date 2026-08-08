import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { useLanguage } from '../context/LanguageContext';

const INPUT =
  'w-full px-4 py-3 bg-[#0C0E12] border border-[#1E2530] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-[15px] placeholder:text-[#70829B]';

const STATUS_STYLES = {
  verified: { color: '#34d399', Icon: CheckCircle2 },
  verifying: { color: '#fbbf24', Icon: Loader2 },
  pending: { color: '#fbbf24', Icon: AlertCircle },
  failed: { color: '#fb7185', Icon: AlertCircle },
};

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? null;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
      aria-label="Copy"
    >
      {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} className="text-[#9BA7BB]" />}
    </button>
  );
}

export default function BusinessEmailDomain() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [useCustom, setUseCustom] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [prefix, setPrefix] = useState('');
  const [availability, setAvailability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);

  const availabilityTimer = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDomain(unwrap(await smartflowApi.getEmailDomain()));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('bed_err_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced availability preview while the owner types a business name.
  useEffect(() => {
    if (useCustom || domain) return undefined;
    const name = businessName.trim();
    if (name.length < 3) {
      setAvailability(null);
      return undefined;
    }
    clearTimeout(availabilityTimer.current);
    availabilityTimer.current = setTimeout(async () => {
      setChecking(true);
      try {
        setAvailability(unwrap(await smartflowApi.checkEmailDomainAvailability(name)));
      } catch {
        setAvailability(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => clearTimeout(availabilityTimer.current);
  }, [businessName, useCustom, domain]);

  async function handleCreate() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const payload = useCustom
        ? { custom_domain: customDomain.trim() }
        : { business_name: businessName.trim() };
      if (prefix.trim()) payload.default_prefix = prefix.trim();
      setDomain(unwrap(await smartflowApi.createEmailDomain(payload)));
      setNotice(t('bed_msg_created'));
    } catch (err) {
      setError(err.response?.data?.message || t('bed_err_create'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const updated = unwrap(await smartflowApi.verifyEmailDomain());
      setDomain(updated);
      setNotice(updated?.status === 'verified' ? t('bed_msg_verified') : t('bed_msg_still_pending'));
    } catch (err) {
      setError(err.response?.data?.message || t('bed_err_verify'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('bed_confirm_delete'))) return;
    setSubmitting(true);
    try {
      await smartflowApi.deleteEmailDomain();
      setDomain(null);
      setBusinessName('');
      setCustomDomain('');
      setNotice(t('bed_msg_deleted'));
    } catch (err) {
      setError(err.response?.data?.message || t('bed_err_delete'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[#111318] border border-[#1E2530] rounded-[20px] p-5 flex items-center gap-3">
        <Loader2 size={18} className="text-[#c084fc] animate-spin" />
        <span className="text-[#9BA7BB] text-[15px]">{t('bed_loading')}</span>
      </div>
    );
  }

  const status = domain?.status;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const StatusIcon = statusStyle.Icon;

  return (
    <div className="bg-[#111318] border border-[#1E2530] rounded-[20px] p-5 space-y-4 text-left">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#9333ea22' }}
        >
          <Mail size={20} className="text-[#c084fc]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[#F3F9FF] font-bold text-[16px]">{t('bed_title')}</h3>
          <p className="text-[#9BA7BB] text-[13px] mt-0.5">{t('bed_subtitle')}</p>
        </div>
        {domain ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ color: statusStyle.color, background: `${statusStyle.color}1A` }}
          >
            <StatusIcon size={13} className={status === 'verifying' ? 'animate-spin' : ''} />
            {t(`bed_status_${status}`)}
          </span>
        ) : null}
      </div>

      {error ? <div className="text-rose-400 text-[13px]">{error}</div> : null}
      {notice ? <div className="text-emerald-400 text-[13px]">{notice}</div> : null}

      {!domain ? (
        <div className="space-y-3.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUseCustom(false)}
              className={`flex-1 h-[42px] rounded-xl text-[14px] font-semibold transition-colors cursor-pointer ${
                !useCustom ? 'bg-[#c084fc] text-[#03141E]' : 'bg-[#0C0E12] border border-[#1E2530] text-[#9BA7BB]'
              }`}
            >
              {t('bed_tab_auto')}
            </button>
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`flex-1 h-[42px] rounded-xl text-[14px] font-semibold transition-colors cursor-pointer ${
                useCustom ? 'bg-[#c084fc] text-[#03141E]' : 'bg-[#0C0E12] border border-[#1E2530] text-[#9BA7BB]'
              }`}
            >
              {t('bed_tab_custom')}
            </button>
          </div>

          {!useCustom ? (
            <div>
              <label className="text-[#9BA7BB] text-[13px] font-semibold mb-1 block">
                {t('bed_lbl_business_name')}
              </label>
              <input
                className={INPUT}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t('bed_ph_business_name')}
              />
              <p className="text-[#70829B] text-[12px] mt-1.5">{t('bed_hint_auto')}</p>
              {checking ? (
                <p className="text-[#9BA7BB] text-[13px] mt-2 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" /> {t('bed_checking')}
                </p>
              ) : availability ? (
                <p
                  className="text-[13px] mt-2 flex items-center gap-1.5 break-all"
                  style={{ color: availability.available ? '#34d399' : '#fb7185' }}
                >
                  {availability.available ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {availability.available
                    ? t('bed_available', { domain: availability.domain })
                    : t('bed_taken', { domain: availability.domain })}
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="text-[#9BA7BB] text-[13px] font-semibold mb-1 block">
                {t('bed_lbl_custom_domain')}
              </label>
              <input
                className={INPUT}
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder={t('bed_ph_custom_domain')}
              />
              <p className="text-[#70829B] text-[12px] mt-1.5">{t('bed_hint_custom')}</p>
            </div>
          )}

          <div>
            <label className="text-[#9BA7BB] text-[13px] font-semibold mb-1 block">{t('bed_lbl_prefix')}</label>
            <input
              className={INPUT}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder={t('bed_ph_prefix')}
            />
            <p className="text-[#70829B] text-[12px] mt-1.5">{t('bed_hint_prefix')}</p>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting || (useCustom ? !customDomain.trim() : businessName.trim().length < 3)}
            className="w-full h-[46px] bg-[#c084fc] text-[#03141E] rounded-xl font-semibold hover:bg-[#7e22ce] hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            {t('bed_btn_create')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#0C0E12] border border-[#1E2530] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#70829B] text-[12px] font-semibold uppercase tracking-wide">
                {t('bed_lbl_your_domain')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#F3F9FF] text-[15px] font-semibold break-all">{domain.domain}</span>
              <CopyButton value={domain.domain} />
            </div>
            {domain.example_address ? (
              <p className="text-[#9BA7BB] text-[13px] break-all">
                {t('bed_example_address', { address: domain.example_address })}
              </p>
            ) : null}
          </div>

          {status === 'verified' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5">
              <p className="text-emerald-300 text-[13px] leading-relaxed">{t('bed_verified_help')}</p>
            </div>
          ) : domain.requires_manual_dns ? (
            <div className="space-y-2.5">
              <p className="text-[#9BA7BB] text-[13px] leading-relaxed">{t('bed_manual_dns_help')}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[440px]">
                  <thead>
                    <tr className="text-[#70829B] text-left">
                      <th className="pb-1.5 pr-2 font-semibold">{t('bed_col_type')}</th>
                      <th className="pb-1.5 pr-2 font-semibold">{t('bed_col_name')}</th>
                      <th className="pb-1.5 pr-2 font-semibold">{t('bed_col_value')}</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#C6D2E2]">
                    {(domain.dns_records || []).map((record, idx) => (
                      <tr key={`${record.type}-${record.name}-${idx}`} className="border-t border-[#1E2530]">
                        <td className="py-2 pr-2 align-top whitespace-nowrap">
                          {record.type}
                          {record.priority != null ? ` (${record.priority})` : ''}
                        </td>
                        <td className="py-2 pr-2 align-top break-all">
                          <span className="inline-flex items-center gap-1">
                            {record.name}
                            <CopyButton value={record.name} />
                          </span>
                        </td>
                        <td className="py-2 pr-2 align-top break-all">
                          <span className="inline-flex items-start gap-1">
                            <span className="break-all">{record.value}</span>
                            <CopyButton value={record.value} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-[#9BA7BB] text-[13px] leading-relaxed">{t('bed_auto_dns_help')}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {status !== 'verified' ? (
              <button
                type="button"
                onClick={handleVerify}
                disabled={submitting}
                className="h-[42px] px-4 bg-[#c084fc] text-[#03141E] rounded-xl font-semibold hover:bg-[#7e22ce] hover:text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 text-[14px]"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {t('bed_btn_check')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="h-[42px] px-4 bg-[#0C0E12] border border-[#1E2530] text-rose-400 rounded-xl font-semibold hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 text-[14px]"
            >
              <Trash2 size={15} />
              {t('bed_btn_remove')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
