import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calendar, Check, Loader2, Mail, Phone, X } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import { formatCstDateTime } from '../../utils/dateUtils';
import { useLanguage } from '../../context/LanguageContext';

export default function CallMeetingRequests() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const response = await smartflowApi.getCallMeetingRequests({ status: 'pending', page_size: 50 });
      setItems(response?.data?.data?.items || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || t('cmr_err_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(id) {
    setActingId(id);
    try {
      await smartflowApi.acceptCallMeetingRequest(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      window.alert(err.response?.data?.message || t('cmr_err_accept'));
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(id) {
    setActingId(id);
    try {
      await smartflowApi.declineCallMeetingRequest(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      window.alert(err.response?.data?.message || t('cmr_err_decline'));
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-[#9BA7BB] text-sm">
        <Loader2 size={16} className="animate-spin" />
        {t('cmr_loading')}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-rose-400 text-sm flex items-center gap-2"><AlertCircle size={14} />{error}</div>;
  }

  if (!items.length) return null;

  return (
    <div className="bg-[#111318] border border-[#1E2530] rounded-[20px] p-4 space-y-3 mb-4">
      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-[#c084fc]" />
        <h3 className="text-[#F3F9FF] font-bold text-[15px]">{t('cmr_title')}</h3>
        <span className="text-[12px] text-[#70829B]">({items.length})</span>
      </div>
      <p className="text-[#9BA7BB] text-[12px]">{t('cmr_subtitle')}</p>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-[#0C0E12] border border-[#1E2530] rounded-xl p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[#F3F9FF] font-semibold text-[14px] truncate">{item.caller_name}</p>
                <p className="text-[#9BA7BB] text-[13px] mt-0.5">{formatCstDateTime(item.requested_start)}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#70829B]">
                  {item.caller_phone ? (
                    <span className="flex items-center gap-1"><Phone size={11} />{item.caller_phone}</span>
                  ) : null}
                  {item.caller_email ? (
                    <span className="flex items-center gap-1 truncate"><Mail size={11} />{item.caller_email}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAccept(item.id)}
                  disabled={actingId === item.id}
                  className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50"
                  title={t('cmr_btn_accept')}
                >
                  {actingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDecline(item.id)}
                  disabled={actingId === item.id}
                  className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center hover:bg-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                  title={t('cmr_btn_decline')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
