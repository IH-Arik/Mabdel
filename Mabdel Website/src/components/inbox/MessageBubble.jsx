import { AlertCircle, Check, CheckCheck, FileText, Forward, Loader2, Reply, RotateCcw } from 'lucide-react';
import { formatBubbleTime } from './inboxUtils';

export function Attachment({ attachment, outbound, t }) {
  const url = attachment?.url;
  if (!url) return null;
  const hint = `${attachment.type || ''} ${attachment.mime_type || ''} ${url}`.toLowerCase();
  if (hint.includes('image') || /\.(png|jpe?g|gif|webp)(\?|$)/.test(hint)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={url} alt={attachment.file_name || t('conv_attachment_image')} className="max-h-60 rounded-xl object-cover" loading="lazy" />
      </a>
    );
  }
  if (hint.includes('audio') || /\.(mp3|wav|m4a|ogg|webm)(\?|$)/.test(hint)) {
    return <audio controls preload="metadata" src={url} className="mt-2 max-w-full" />;
  }
  if (hint.includes('video') || /\.(mp4|mov)(\?|$)/.test(hint)) {
    return <video controls preload="metadata" src={url} className="mt-2 max-h-60 max-w-full rounded-xl" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
        outbound ? 'border-white/20 text-white' : 'border-slate-700 text-purple-200'
      }`}
    >
      <FileText size={14} />
      <span className="truncate">{attachment.file_name || t('conv_open_attachment')}</span>
    </a>
  );
}

function StatusIcon({ status, t }) {
  if (status === 'pending') return <Loader2 size={11} className="animate-spin" aria-label={t('conv_status_sending')} />;
  if (status === 'read') return <CheckCheck size={12} className="text-sky-200" aria-label={t('conv_status_read')} />;
  if (status === 'delivered') return <CheckCheck size={12} aria-label={t('conv_status_delivered')} />;
  return <Check size={12} aria-label={t('conv_status_sent')} />;
}

export default function MessageBubble({ message, onReply, onForward, onRetry, retrying, t }) {
  const outbound = message.direction === 'outbound';
  const failed = message.status === 'failed';
  const attachments = message.attachments?.length
    ? message.attachments
    : message.media_url
      ? [{ url: message.media_url }]
      : [];
  const meta = message.provider_metadata || {};
  const showSender = outbound && message.sender_name && message.sender_name !== 'You';

  const actions = (
    <div className="flex items-center gap-1 self-center opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      <button type="button" aria-label={t('conv_reply_label')} title={t('conv_reply_label')} onClick={() => onReply(message)} className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:text-[#c084fc]">
        <Reply size={14} />
      </button>
      <button type="button" aria-label={t('conv_forward_label')} title={t('conv_forward_label')} onClick={() => onForward(message)} className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:text-[#c084fc]">
        <Forward size={14} />
      </button>
    </div>
  );

  return (
    <div className={`group flex gap-1 ${outbound ? 'justify-end' : 'justify-start'}`}>
      {outbound ? actions : null}
      <div className={`flex max-w-[85%] flex-col md:max-w-[70%] ${outbound ? 'items-end' : 'items-start'}`}>
        {showSender ? <span className="mb-1 px-1 text-[10px] font-bold text-slate-500">{message.sender_name}</span> : null}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md ${
            failed
              ? 'rounded-tr-none border border-rose-500/50 bg-rose-950/40 text-rose-100'
              : outbound
                ? 'rounded-tr-none bg-[#7e22ce] text-white'
                : 'rounded-tl-none border border-slate-800 bg-[#121625] text-slate-100'
          }`}
        >
          {message.subject ? <p className="mb-1 text-[12px] font-extrabold">{message.subject}</p> : null}
          {!outbound && meta.email_from ? <p className="mb-1.5 text-[10px] font-semibold opacity-70">{meta.email_from}</p> : null}
          {message.reply_to_message_preview?.content ? (
            <div className="mb-2 rounded-lg border-l-2 border-white/40 bg-black/20 px-2.5 py-1.5 text-[11px] opacity-80">
              {message.reply_to_message_preview.content}
            </div>
          ) : null}
          {message.content ? <p className="whitespace-pre-wrap break-words text-left">{message.content}</p> : null}
          {attachments.map((attachment, index) => (
            <Attachment key={`${attachment.url}-${index}`} attachment={attachment} outbound={outbound} t={t} />
          ))}
          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold ${outbound ? 'text-white/70' : 'text-slate-500'}`}>
            <span>{formatBubbleTime(message.timestamp)}</span>
            {outbound && !failed ? <StatusIcon status={message.status} t={t} /> : null}
          </div>
        </div>
        {failed ? (
          <div className="mt-1 flex max-w-full items-start justify-end gap-1.5 px-1 text-right text-[11px] text-rose-300">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <p>
              {message.delivery_error || t('conv_status_failed')}
              {onRetry && message.content ? (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  disabled={retrying}
                  className="ml-2 inline-flex cursor-pointer items-center gap-1 font-bold text-white hover:underline disabled:opacity-60"
                >
                  {retrying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                  {t('conv_retry')}
                </button>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
      {!outbound ? actions : null}
    </div>
  );
}
