import { Fragment, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CalendarClock, CheckCircle, CheckCircle2, Clock, FileText,
  Link2, Loader2, Mail, Paperclip, Phone, Play, Plus, RefreshCw,
  Send, Trash2, Upload, Users, X,
} from 'lucide-react';
import { smartflowApi } from '../api/services';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

const CHANNELS = [
  { id:'email', label:'Email', icon: Mail },
  { id:'sms', label:'SMS', icon: Phone },
  { id:'whatsapp', label:'WhatsApp', icon: Phone },
];

// ── Step 1: Recipients ────────────────────────────────────────────────────────
function StepRecipients({ contacts, chips, setChips, onNext }) {
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [file, setFile] = useState(null);

  function addChip(email) {
    const e = email.trim();
    if (!e) return;
    if (!chips.includes(e)) setChips(c => [...c, e]);
    setManual('');
  }

  function removeChip(email) { setChips(c => c.filter(x => x !== email)); }

  function handleCSV(e) {
    const f = e.target.files?.[0]; if(!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split(/[\n,]/).map(l=>l.trim()).filter(l => l.includes('@'));
      setChips(c => [...new Set([...c, ...lines])]);
    };
    reader.readAsText(f);
  }

  async function validate() {
    if (!chips.length) { setError('Add at least one recipient.'); return; }
    setError(''); setValidating(true);
    try {
      await smartflowApi.validateBulkRecipients({ channel:'email', recipient_emails: chips });
      onNext();
    } catch(err) {
      setError(err.response?.data?.message || 'Validation failed, check recipients.');
    } finally { setValidating(false); }
  }

  const filtered = contacts.filter(c =>
    c.email && (c.name?.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    && !chips.includes(c.email)
  );

  return (
    <div className="space-y-5">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}

      {/* Chips display */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-[#0A1019] border border-[#243246] rounded-xl min-h-12">
          {chips.map(ch => (
            <span key={ch} className="flex items-center gap-1.5 px-3 py-1 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] text-xs font-bold rounded-full">
              {ch}
              <button type="button" onClick={()=>removeChip(ch)} className="hover:text-white cursor-pointer"><X size={11}/></button>
            </span>
          ))}
        </div>
      )}

      {/* Manual entry */}
      <div className="flex gap-2">
        <input value={manual} onChange={e=>setManual(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addChip(manual);}}}
          placeholder="Type email and press Enter…" className={`${INPUT} flex-1`}/>
        <button type="button" onClick={()=>addChip(manual)}
          className="px-4 py-3 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] rounded-xl hover:bg-[#11C7E5]/20 transition-colors cursor-pointer">
          <Plus size={16}/>
        </button>
      </div>

      {/* Contact picker */}
      {contacts.length > 0 && (
        <div>
          <label className={LABEL}>Pick from Contacts</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts…" className={`${INPUT} mb-2`}/>
          <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#243041] rounded-xl p-2">
            {filtered.slice(0,20).map(c => (
              <button key={c.id} type="button" onClick={()=>{if(c.email)setChips(ch=>[...new Set([...ch,c.email])])}}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-[#11C7E5]/5 rounded-xl transition-colors text-left cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-[#243041] flex items-center justify-center text-[#11C7E5] font-black text-xs shrink-0">
                  {(c.name||'?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">{c.name}</p>
                  <p className="text-[#A4B0B7] text-[11px] truncate">{c.email}</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-[#A4B0B7] text-xs py-4">No matching contacts.</p>}
          </div>
        </div>
      )}

      {/* CSV upload */}
      <label className="flex items-center gap-3 p-4 border border-dashed border-[#243246] hover:border-[#11C7E5]/40 rounded-xl cursor-pointer transition-colors group">
        <Upload size={18} className="text-[#A4B0B7] group-hover:text-[#11C7E5] transition-colors"/>
        <div>
          <p className="text-white text-sm font-semibold">{file ? file.name : 'Upload CSV file'}</p>
          <p className="text-[#A4B0B7] text-xs">One email per line or comma-separated</p>
        </div>
        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV}/>
      </label>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[#A4B0B7] text-sm">{chips.length} recipient{chips.length !== 1?'s':''} selected</span>
        <button onClick={validate} disabled={validating || chips.length === 0}
          className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
          {validating ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
          Validate Recipients
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Compose ───────────────────────────────────────────────────────────
function StepCompose({ recipients, channel, setChannel, subject, setSubject, message, setMessage, attachments, setAttachments, scheduleDate, setScheduleDate, onBack, onSend, sending }) {
  const MAX = 5000;
  const [attachUrl, setAttachUrl] = useState('');

  function addAttachment() {
    if (!attachUrl.trim()) return;
    setAttachments(a => [...a, attachUrl.trim()]);
    setAttachUrl('');
  }

  return (
    <div className="space-y-5">
      {/* Recipient summary */}
      <div className="p-4 bg-[#11C7E5]/5 border border-[#11C7E5]/20 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#11C7E5]"/>
          <span className="font-bold text-white">{recipients.length}</span>
          <span className="text-[#A4B0B7] text-sm">recipients validated</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recipients.slice(0,3).map(r=><span key={r} className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">{r}</span>)}
          {recipients.length>3 && <span className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">+{recipients.length-3} more</span>}
        </div>
      </div>

      {/* Channel */}
      <div>
        <label className={LABEL}>Delivery Channel</label>
        <div className="flex gap-3">
          {CHANNELS.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" onClick={()=>setChannel(c.id)}
                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm border transition-all cursor-pointer ${channel===c.id ? 'bg-[#11C7E5]/10 border-[#11C7E5]/30 text-[#11C7E5]' : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'}`}>
                <Icon size={14}/>{c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject */}
      {channel === 'email' && (
        <div>
          <label className={LABEL}>Subject Line</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Your subject here…" className={INPUT}/>
        </div>
      )}

      {/* Message */}
      <div>
        <label className={LABEL}>Message ({message.length}/{MAX})</label>
        <textarea value={message} onChange={e=>setMessage(e.target.value.slice(0,MAX))}
          placeholder="Write your broadcast message... Use {name} for personalization."
          className={`${INPUT} min-h-40 resize-none`}/>
        <p className="text-[#A4B0B7] text-xs mt-1">Variables: <span className="text-[#11C7E5]">{'{name}'}</span>, <span className="text-[#11C7E5]">{'{phone}'}</span>, <span className="text-[#11C7E5]">{'{date}'}</span></p>
      </div>

      {/* Attachments */}
      <div>
        <label className={LABEL}>Attachments (URLs)</label>
        <div className="flex gap-2 mb-2">
          <input value={attachUrl} onChange={e=>setAttachUrl(e.target.value)} placeholder="https://example.com/file.pdf" className={`${INPUT} flex-1`}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addAttachment();}}}/>
          <button type="button" onClick={addAttachment} className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer">
            <Paperclip size={16}/>
          </button>
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a,i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1019] border border-[#243246] rounded-xl text-xs text-[#A4B0B7]">
                <FileText size={11}/> <span className="truncate max-w-[120px]">{a}</span>
                <button type="button" onClick={()=>setAttachments(at=>at.filter((_,j)=>j!==i))} className="hover:text-rose-400 cursor-pointer"><X size={11}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule */}
      <div>
        <label className={LABEL}>Schedule Send (optional)</label>
        <input type="datetime-local" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} className={INPUT}/>
        {scheduleDate && (
          <p className="text-[#11C7E5] text-xs mt-1 flex items-center gap-1.5"><CalendarClock size={12}/> Scheduled for {new Date(scheduleDate).toLocaleString()}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">
          Back
        </button>
        <button onClick={onSend} disabled={!message.trim() || sending}
          className="flex-[2] py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
          {sending ? <Loader2 size={18} className="animate-spin"/> : scheduleDate ? <CalendarClock size={18}/> : <Play size={18}/>}
          {sending ? 'Sending…' : scheduleDate ? 'Schedule Broadcast' : 'Send Now'}
        </button>
      </div>
    </div>
  );
}

// ── History ────────────────────────────────────────────────────────────────────
function BroadcastHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartflowApi.getBulkMessages({ page_size: 20 })
      .then(r => setItems(r.data?.data?.items || r.data?.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function cancel(id) {
    try { await smartflowApi.cancelBulkMessage(id); setItems(i => i.filter(x => x.id !== id)); } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#11C7E5]"/></div>;
  if (!items.length) return null;

  return (
    <div className="mt-6">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Clock size={15} className="text-[#11C7E5]"/>Previous Broadcasts</h3>
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl overflow-hidden">
        {items.map((item,i) => (
          <div key={item.id||i} className="p-4 flex items-center justify-between gap-4 border-b border-[#243041]/30 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-sm truncate">{item.subject || item.content?.slice(0,60) || 'Broadcast'}</p>
              <p className="text-[#A4B0B7] text-xs mt-0.5">
                {item.recipient_count || 0} recipients • {item.channel} • {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                item.status === 'sent' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
                item.status === 'scheduled' ? 'bg-amber-950/40 border-amber-500/20 text-amber-400' :
                item.status === 'draft' ? 'bg-[#243041] border-[#2A3550] text-[#A4B0B7]' :
                'bg-rose-950/40 border-rose-500/20 text-rose-400'
              }`}>{item.status}</span>
              {item.status === 'scheduled' && (
                <button onClick={()=>cancel(item.id)} className="text-rose-400 hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors cursor-pointer" title="Cancel">
                  <X size={13}/>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BulkMessaging() {
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [chips, setChips] = useState([]);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    smartflowApi.getContacts()
      .then(r => setContacts(r.data?.data?.items || r.data?.data || []))
      .catch(() => setContacts([]));
  }, []);

  async function handleSend() {
    setError(''); setSending(true);
    try {
      const payload = {
        channel,
        recipient_emails: chips,
        subject: channel === 'email' ? subject : undefined,
        content: message,
        attachment_urls: attachments.length ? attachments : undefined,
        send_now: !scheduleDate,
        scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
      };
      const res = await smartflowApi.createBulkMessage(payload);
      if (!scheduleDate && res.data?.data?.status === 'draft') {
        await smartflowApi.sendBulkMessage(res.data.data.id);
      }
      setStep(3);
    } catch(err) {
      setError(err.response?.data?.message || 'Send failed. Please try again.');
    } finally { setSending(false); }
  }

  function reset() {
    setStep(1); setChips([]); setMessage(''); setSubject(''); setAttachments([]); setScheduleDate(''); setError('');
  }

  const STEPS = ['Recipients', 'Compose', 'Done'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Bulk Messaging</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">Broadcast personalized messages to multiple recipients across any channel.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {STEPS.map((label, i) => {
          const s = i + 1;
          const active = step >= s;
          const current = step === s;
          return (
            <Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold transition-all border ${active ? 'bg-[#11C7E5]/10 border-[#11C7E5]/35 text-white shadow-[0_0_15px_rgba(17,199,229,0.15)]' : 'bg-[#131A24] border-[#243041] text-[#A4B0B7]'} ${current ? 'ring-2 ring-[#11C7E5]/30' : ''}`}>
                  {s === 3 && step === 3 ? <CheckCircle size={18} className="text-[#11C7E5]"/> : s}
                </div>
                <span className={`text-[10px] font-bold ${active ? 'text-[#11C7E5]' : 'text-[#A4B0B7]'}`}>{label}</span>
              </div>
              {s < STEPS.length && <div className={`flex-1 max-w-12 h-0.5 ${step > s ? 'bg-[#11C7E5]/35' : 'bg-[#243041]'} transition-colors`}/>}
            </Fragment>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 text-left">
        {error && <div className="mb-5 p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.2}}>
              <StepRecipients contacts={contacts} chips={chips} setChips={setChips} onNext={()=>setStep(2)}/>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.2}}>
              <StepCompose
                recipients={chips} channel={channel} setChannel={setChannel}
                subject={subject} setSubject={setSubject}
                message={message} setMessage={setMessage}
                attachments={attachments} setAttachments={setAttachments}
                scheduleDate={scheduleDate} setScheduleDate={setScheduleDate}
                onBack={()=>setStep(1)} onSend={handleSend} sending={sending}/>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} className="py-12 text-center space-y-6">
              <div className="w-24 h-24 bg-[#11C7E5]/10 border-2 border-[#11C7E5]/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(17,199,229,0.1)]">
                <CheckCircle size={48} className="text-[#11C7E5]"/>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Broadcast {scheduleDate ? 'Scheduled!' : 'Sent!'}</h2>
                <p className="text-[#A4B0B7] text-sm mt-2 max-w-md mx-auto">
                  {scheduleDate
                    ? `Your message is scheduled for ${new Date(scheduleDate).toLocaleString()}.`
                    : `Your message is being delivered to ${chips.length} recipients.`}
                </p>
              </div>
              <button onClick={reset}
                className="px-8 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-extrabold hover:bg-[#0fd0f0] active:scale-95 transition-all cursor-pointer">
                Send Another
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History */}
      <BroadcastHistory/>
    </div>
  );
}
