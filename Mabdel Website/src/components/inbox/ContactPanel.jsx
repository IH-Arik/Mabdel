import { Loader2, Mail, Phone, X } from 'lucide-react';
import ChannelIcon from './ChannelIcon';
import { channelMeta } from '../../constants/channels';
import { formatListTime } from './inboxUtils';

export default function ContactPanel({ details, loading, onClose, onOpenConversation, conversation, members, onAssign, assigning, t }) {
  const contact = details?.contact;
  return (
    <aside
      aria-label={t('conv_contact_details')}
      className="flex w-full shrink-0 flex-col border-l border-[#243041]/40 bg-[#0c101b] @5xl:w-72"
    >
      <div className="flex items-center justify-between border-b border-[#243041]/40 p-4">
        <h3 className="text-sm font-extrabold text-white">{t('conv_contact_details')}</h3>
        <button type="button" onClick={onClose} aria-label={t('conv_close')} className="cursor-pointer rounded-lg p-1 text-slate-500 hover:text-white">
          <X size={16} />
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center p-8 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#9333ea]/15 text-2xl font-black uppercase text-[#c084fc]">
              {(contact?.name || conversation?.contact_name || '?')[0]}
            </div>
            <p className="mt-2 text-sm font-extrabold text-white">{contact?.name || conversation?.contact_name}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <ChannelIcon platform={conversation?.platform} size={12} />
              {channelMeta(conversation?.platform).label}
            </p>
          </div>

          <div className="space-y-2">
            {contact?.phone ? (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-[#c084fc]">
                <Phone size={13} className="text-slate-500" />
                {contact.phone}
              </a>
            ) : null}
            {contact?.email ? (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 break-all text-xs font-semibold text-slate-200 hover:text-[#c084fc]">
                <Mail size={13} className="shrink-0 text-slate-500" />
                {contact.email}
              </a>
            ) : null}
            {!contact?.phone && !contact?.email ? <p className="text-xs text-slate-500">{t('conv_no_contact_info')}</p> : null}
          </div>

          <div>
            <label htmlFor="conv-assignee" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {t('conv_assigned_to')}
            </label>
            <div className="relative">
              <select
                id="conv-assignee"
                value={conversation?.assigned_to || ''}
                disabled={assigning}
                onChange={(event) => onAssign(event.target.value || null)}
                className="w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:border-[#9333ea]/50 focus:outline-none disabled:opacity-60"
              >
                <option value="">{t('conv_unassigned')}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {assigning ? <Loader2 size={12} className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin text-slate-400" /> : null}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('conv_also_on')}</p>
            {details?.related?.length ? (
              <ul className="space-y-1">
                {details.related.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpenConversation(item.id)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:border-[#9333ea]/40"
                    >
                      <ChannelIcon platform={item.platform} size={13} />
                      <span className="flex-1 truncate">{channelMeta(item.platform).label}</span>
                      <span className="text-[10px] text-slate-500">{formatListTime(item.last_message_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">{t('conv_no_other_channels')}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
