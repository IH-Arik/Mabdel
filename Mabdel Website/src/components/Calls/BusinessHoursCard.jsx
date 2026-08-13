import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import { useLanguage } from '../../context/LanguageContext';

const DAY_KEYS = ['bh_day_mon', 'bh_day_tue', 'bh_day_wed', 'bh_day_thu', 'bh_day_fri', 'bh_day_sat', 'bh_day_sun'];
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) => hour);

function formatHour(hour) {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export default function BusinessHoursCard() {
  const { t } = useLanguage();
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    smartflowApi
      .getBusinessHours()
      .then((response) => setHours(response?.data?.data || null))
      .catch((err) => setError(err.response?.data?.message || t('bh_err_load')))
      .finally(() => setLoading(false));
  }, [t]);

  function toggleDay(day) {
    setHours((current) => {
      const days = current.days.includes(day)
        ? current.days.filter((value) => value !== day)
        : [...current.days, day].sort();
      return { ...current, days };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await smartflowApi.updateBusinessHours({
        days: hours.days,
        start_hour: Number(hours.start_hour),
        end_hour: Number(hours.end_hour),
        slot_minutes: Number(hours.slot_minutes),
      });
      setHours(response?.data?.data || hours);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || t('bh_err_save'));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !hours) {
    return (
      <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4 flex items-center gap-2 text-[#9BA7BB] text-sm">
        <Loader2 size={16} className="animate-spin" />
        {t('bh_loading')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#243041] bg-[#131A24] p-4 space-y-3.5">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-[#9333ea]" />
        <p className="text-sm font-semibold text-white">{t('bh_title')}</p>
      </div>
      <p className="text-xs text-[#A4B0B7]">{t('bh_subtitle')}</p>

      {error ? <div className="text-rose-400 text-xs">{error}</div> : null}

      <div className="flex flex-wrap gap-1.5">
        {DAY_KEYS.map((key, index) => {
          const active = hours.days.includes(index);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleDay(index)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                active ? 'bg-[#9333ea] text-[#03141E]' : 'bg-[#0C0E12] border border-[#1E2530] text-[#9BA7BB]'
              }`}
            >
              {t(key)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[#70829B] text-[11px] font-semibold uppercase tracking-wide block mb-1">
            {t('bh_lbl_from')}
          </label>
          <select
            value={hours.start_hour}
            onChange={(e) => setHours((current) => ({ ...current, start_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2 bg-[#0C0E12] border border-[#1E2530] text-white rounded-lg text-sm outline-none"
          >
            {HOUR_OPTIONS.slice(0, 24).map((hour) => (
              <option key={hour} value={hour}>{formatHour(hour)}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[#70829B] text-[11px] font-semibold uppercase tracking-wide block mb-1">
            {t('bh_lbl_to')}
          </label>
          <select
            value={hours.end_hour}
            onChange={(e) => setHours((current) => ({ ...current, end_hour: Number(e.target.value) }))}
            className="w-full px-3 py-2 bg-[#0C0E12] border border-[#1E2530] text-white rounded-lg text-sm outline-none"
          >
            {HOUR_OPTIONS.slice(1).map((hour) => (
              <option key={hour} value={hour}>{formatHour(hour)}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full h-[40px] bg-[#9333ea] text-[#03141E] rounded-lg font-semibold text-sm hover:bg-[#7e22ce] hover:text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : null}
        {saving ? t('bh_saving') : saved ? t('bh_saved') : t('bh_btn_save')}
      </button>
    </div>
  );
}
