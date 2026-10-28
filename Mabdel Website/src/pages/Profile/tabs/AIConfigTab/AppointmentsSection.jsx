import { CalendarCheck } from 'lucide-react';
import SectionCard from './SectionCard';

export default function AppointmentsSection({ callSettings, updateField, t }) {
  return (
          <SectionCard icon={CalendarCheck} title={t('aiprof_hdr_appointments')} description={t('aiprof_appointments_desc')}>
            <p className="text-[#4A5568] text-xs mb-4">{t('aiprof_approval_moved_hint')}</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={callSettings?.sms_confirmations_enabled !== false}
                onChange={(event) => updateField('sms_confirmations_enabled', event.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#9333ea]"
              />
              <span>
                <span className="text-white text-sm font-semibold block">{t('aiprof_toggle_sms_confirmations')}</span>
                <span className="text-[#A4B0B7] text-xs">{t('aiprof_sms_confirmations_hint')}</span>
              </span>
            </label>

            <label className="flex items-start gap-2 cursor-pointer mt-4 pt-4 border-t border-[#243041]">
              <input
                type="checkbox"
                checked={Boolean(callSettings?.appointment_reminders_enabled)}
                onChange={(event) => updateField('appointment_reminders_enabled', event.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#9333ea]"
              />
              <span className="flex-1">
                <span className="text-white text-sm font-semibold block">{t('aiprof_toggle_reminders')}</span>
                <span className="text-[#A4B0B7] text-xs">{t('aiprof_reminders_hint')}</span>
              </span>
            </label>
            <fieldset className="space-y-2 rounded-xl border border-[#243041] p-3">
              <legend className="text-xs text-white px-1">Text after a request is saved</legend>
              <p className="text-xs text-[#A4B0B7]">Send a receipt for selected requests. SMS permission and approval settings still apply.</p>
              {['callback', 'quote', 'service_ticket', 'task', 'workflow'].map((kind) => (
                <label key={kind} className="flex gap-2 items-center text-xs text-[#A4B0B7] capitalize">
                  <input type="checkbox" checked={(callSettings?.request_sms_events || []).includes(kind)} onChange={(event) => {
                    const selected = callSettings?.request_sms_events || [];
                    updateField('request_sms_events', event.target.checked ? [...selected, kind] : selected.filter((value) => value !== kind));
                  }} />
                  {kind.replaceAll('_', ' ')}
                </label>
              ))}
            </fieldset>
            {callSettings?.appointment_reminders_enabled ? (
              <div className="mt-3 flex items-center gap-2 pl-6">
                <label className="text-[#A4B0B7] text-xs shrink-0" htmlFor="aiprof-reminder-hours">
                  {t('aiprof_lbl_reminder_hours')}
                </label>
                <input
                  id="aiprof-reminder-hours"
                  type="number"
                  min={1}
                  max={168}
                  value={callSettings?.appointment_reminder_hours_before ?? 24}
                  onChange={(event) => updateField('appointment_reminder_hours_before', Math.min(168, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-20 bg-[#131A24] border border-[#243041] rounded-lg text-sm text-white px-2 py-1.5 outline-none focus:border-[#9333ea]/50"
                />
              </div>
            ) : null}
          </SectionCard>
  );
}
