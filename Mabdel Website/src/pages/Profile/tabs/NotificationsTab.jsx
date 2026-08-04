import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Calendar, CheckCircle2, Loader2, Mail, Phone, Save, Volume2, Vibrate } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import { useLanguage } from '../../../context/LanguageContext';

const ITEMS = [
  { key: 'general_notification', label: 'General Notifications', icon: Bell },
  { key: 'sound', label: 'Sound', icon: Volume2 },
  { key: 'vibrate', label: 'Vibrate', icon: Vibrate },
  { key: 'new_messages', label: 'New Messages', icon: Mail },
  { key: 'missed_calls', label: 'Missed Calls', icon: Phone },
  { key: 'scheduled_calls', label: 'Scheduled Calls', icon: Phone },
  { key: 'ai_tasks', label: 'AI Tasks', icon: Bell },
  { key: 'calendar_reminders', label: 'Calendar Reminders', icon: Calendar },
];

function NotificationsTab() {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    smartflowApi.getNotificationSettings()
      .then((response) => {
        if (ignore) return;
        setPrefs(response?.data?.data || {});
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || t('nprof_err_load'));
        setPrefs({});
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const toggle = (key) => setPrefs((current) => ({ ...current, [key]: !current[key] }));

  async function save() {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const response = await smartflowApi.updateNotificationSettings(prefs);
      setPrefs(response?.data?.data || prefs);
      setSuccess(t('nprof_saved'));
    } catch (saveError) {
      setError(saveError?.response?.data?.message || t('nprof_save_failed'));
    } finally {
      setSaving(false);
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
    <div className="space-y-4">
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

      {ITEMS.map((item) => (
        <div key={item.key} className="flex items-center justify-between rounded-2xl border border-[#243041] bg-[#0A1019] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9333ea]/10">
              <item.icon size={16} className="text-[#9333ea]" />
            </div>
            <span className="text-sm font-semibold text-white">{t(`nprof_lbl_${item.key.replace('notification', '')}`.replace('__', '_').replace(/_$/, ''))}</span>
          </div>

          <button
            onClick={() => toggle(item.key)}
            className={`relative h-6 w-12 rounded-full transition-colors ${prefs[item.key] ? 'bg-[#9333ea]' : 'bg-[#243041]'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#9333ea] px-6 py-3 font-bold text-[#02080B] transition-colors hover:bg-[#a855f7] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? t('prof_saving') : t('nprof_btn_save')}
      </button>
    </div>
  );
}

export default NotificationsTab;
