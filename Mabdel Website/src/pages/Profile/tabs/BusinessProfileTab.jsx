import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Loader2, Save, Upload } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import { Field, INPUT } from '../shared';

function BusinessProfileTab() {
  const [data, setData] = useState({
    business_name: '',
    email: '',
    phone_number: '',
    website: '',
    office_address_text: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    let ignore = false;

    smartflowApi.getBusinessProfile()
      .then((response) => {
        if (ignore) return;
        const next = response?.data?.data || {};
        setData({
          business_name: next.business_name || '',
          email: next.email || '',
          phone_number: next.phone_number || '',
          website: next.website || '',
          office_address_text: next.office_address_text || '',
        });
        setLogoUrl(next.logo_url || '');
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || 'Could not load business profile.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const updateField = (key, value) => setData((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        business_name: data.business_name.trim() || undefined,
        email: data.email.trim() || undefined,
        phone_number: data.phone_number.trim() || undefined,
        website: data.website.trim() || undefined,
        office_address_text: data.office_address_text.trim() || undefined,
      };
      const response = await smartflowApi.updateBusinessProfile(payload);
      const next = response?.data?.data || {};
      setData({
        business_name: next.business_name || '',
        email: next.email || '',
        phone_number: next.phone_number || '',
        website: next.website || '',
        office_address_text: next.office_address_text || '',
      });
      setLogoUrl(next.logo_url || logoUrl);
      setSuccess('Business profile saved.');
    } catch (saveError) {
      setError(saveError?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('logo_file', file);

    try {
      const response = await smartflowApi.uploadBusinessLogo(formData);
      const next = response?.data?.data || {};
      setLogoUrl(next.logo_url || '');
      setData((current) => ({
        ...current,
        business_name: next.business_name || current.business_name,
        email: next.email || current.email,
        phone_number: next.phone_number || current.phone_number,
        website: next.website || current.website,
        office_address_text: next.office_address_text || current.office_address_text,
      }));
      setSuccess('Business logo updated.');
    } catch (uploadError) {
      setError(uploadError?.response?.data?.message || 'Logo upload failed.');
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
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#11C7E5]/20 bg-[#11C7E5]/10">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 size={32} className="text-[#11C7E5]/40" />
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={18} className="animate-spin text-white" />
            </div>
          ) : null}
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-2.5 text-sm font-semibold text-[#A4B0B7] transition-all hover:border-[#11C7E5]/40 hover:text-white">
          <Upload size={15} />
          Upload Logo
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Business Name">
          <input value={data.business_name} onChange={(event) => updateField('business_name', event.target.value)} className={INPUT} placeholder="Business name" />
        </Field>

        <Field label="Business Email">
          <input value={data.email} onChange={(event) => updateField('email', event.target.value)} className={INPUT} placeholder="business@example.com" />
        </Field>

        <Field label="Business Phone">
          <input value={data.phone_number} onChange={(event) => updateField('phone_number', event.target.value)} className={INPUT} placeholder="+1 234 567 890" />
        </Field>

        <Field label="Website">
          <input value={data.website} onChange={(event) => updateField('website', event.target.value)} className={INPUT} placeholder="https://example.com" />
        </Field>
      </div>

      <Field label="Office Address">
        <textarea
          value={data.office_address_text}
          onChange={(event) => updateField('office_address_text', event.target.value)}
          className={`${INPUT} min-h-24 resize-none`}
          placeholder="Street, city, state, postcode, country"
        />
      </Field>

      <button
        onClick={save}
        disabled={saving}
        className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#11C7E5] px-6 py-3 font-bold text-[#02080B] transition-colors hover:bg-[#0fd0f0] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save Business Profile'}
      </button>
    </div>
  );
}

export default BusinessProfileTab;
