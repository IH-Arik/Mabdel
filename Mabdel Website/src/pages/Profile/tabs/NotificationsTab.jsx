import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Calendar, CheckCircle2, Loader2, Mail, Phone, Save, Volume2, Vibrate } from 'lucide-react';

import { smartflowApi } from '../../../api/services';

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
        setError(loadError?.response?.data?.message || 'Could not load notification settings.');
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
      setSuccess('Notification settings saved.');
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Could not save notification settings.');
    } finally {
      setSaving(false);
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#11C7E5]/10">
              <item.icon size={16} className="text-[#11C7E5]" />
            </div>
            <span className="text-sm font-semibold text-white">{item.label}</span>
          </div>

          <button
            onClick={() => toggle(item.key)}
            className={`relative h-6 w-12 rounded-full transition-colors ${prefs[item.key] ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      ))}

      <button
        onClick={save}
        disabled={saving}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#11C7E5] px-6 py-3 font-bold text-[#02080B] transition-colors hover:bg-[#0fd0f0] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Save Preferences
      </button>
    </div>
  );
}

export default NotificationsTab;
