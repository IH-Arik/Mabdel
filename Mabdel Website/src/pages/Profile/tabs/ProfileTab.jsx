import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Save } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import { useAuthStore } from '../../../store/useAuthStore';
import { Field, INPUT } from '../shared';

const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'bn-BD', label: 'Bangla' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'pt-BR', label: 'Portuguese' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ur-PK', label: 'Urdu' },
  { code: 'tr-TR', label: 'Turkish' },
];

const toDateInputValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    country: '',
    date_of_birth: '',
    language_preference: 'en-US',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let ignore = false;

    smartflowApi.getSettings()
      .then((response) => {
        if (ignore) return;
        const next = response?.data?.data || {};
        setForm({
          full_name: next.full_name || '',
          email: next.email || user?.email || '',
          phone: next.phone || user?.phone || '',
          country: next.country || '',
          date_of_birth: toDateInputValue(next.date_of_birth),
          language_preference: next.language_preference || 'en-US',
        });
        setUser?.(next);
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || 'Could not load your profile settings.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [setUser]);

  const languageHelpText = useMemo(() => {
    const selected = LANGUAGE_OPTIONS.find((item) => item.code === form.language_preference);
    return selected ? `${selected.label} preference is stored on your account.` : 'Language preference is stored on your account.';
  }, [form.language_preference]);

  async function save() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        full_name: form.full_name.trim(),
        country: form.country.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        language_preference: form.language_preference || undefined,
      };
      const response = await smartflowApi.updateSettings(payload);
      const next = response?.data?.data || {};
      setUser?.(next);
      setForm((current) => ({
        ...current,
        full_name: next.full_name || current.full_name,
        email: next.email || current.email,
        country: next.country || '',
        date_of_birth: toDateInputValue(next.date_of_birth || current.date_of_birth),
        language_preference: next.language_preference || current.language_preference,
      }));
      setSuccess('Profile saved.');
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('avatar_file', file);

    try {
      const response = await smartflowApi.uploadAvatar(formData);
      const next = response?.data?.data || {};
      setUser?.(next);
      setSuccess('Profile photo updated.');
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || 'Avatar upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
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

      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#11C7E5]/20 bg-[#11C7E5]/10 text-3xl font-black text-[#11C7E5]">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              user?.full_name?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-2.5 text-sm font-semibold text-[#A4B0B7] transition-all hover:border-[#11C7E5]/40 hover:text-white">
            <Camera size={15} />
            Upload Photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarUpload} />
          </label>
          <p className="mt-1.5 text-xs text-[#A4B0B7]">PNG, JPG, or WEBP up to 5MB.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full Name">
          <input
            value={form.full_name}
            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            className={INPUT}
            placeholder="Your name"
          />
        </Field>

        <Field label="Email Address">
          <input value={form.email} disabled className={`${INPUT} cursor-not-allowed opacity-50`} placeholder="email@example.com" />
        </Field>

        <Field label="Country">
          <input
            value={form.country}
            onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
            className={INPUT}
            placeholder="Country"
          />
        </Field>

        <Field label="Date of Birth">
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(event) => setForm((current) => ({ ...current, date_of_birth: event.target.value }))}
            className={INPUT}
          />
        </Field>

        <Field label="Language Preference">
          <select
            value={form.language_preference}
            onChange={(event) => setForm((current) => ({ ...current, language_preference: event.target.value }))}
            className={INPUT}
          >
            {LANGUAGE_OPTIONS.map((item) => (
              <option key={item.code} value={item.code} className="bg-[#0A1019]">
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[#A4B0B7]">{languageHelpText}</p>
        </Field>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#11C7E5] px-6 py-3 font-bold text-[#02080B] transition-colors hover:bg-[#0fd0f0] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
}

export default ProfileTab;
