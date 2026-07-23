import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CalendarClock, CheckCircle, CheckCircle2, Clock, FileText,
  Loader2, Mail, Mic, Paperclip, Phone, Play, Plus, Sparkles, Square, Upload, Users, X,
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { DateTimePickerInput } from '../components/ui/DateTimeInputs';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: Phone },
];

const NOISY_TRANSCRIPTS = new Set(['you', 'yeah', 'ya', 'yo', 'uh', 'um', 'hmm', 'hm', 'thank you', 'thanks for watching']);

function getRecipientTarget(contact, channel) {
  return channel === 'sms' ? contact?.phone : contact?.email;
}

function attachmentLabelFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const tail = pathname.split('/').filter(Boolean).pop();
    return tail || 'Attachment';
  } catch {
    const tail = String(url).split('/').filter(Boolean).pop();
    return tail || 'Attachment';
  }
}

function StepRecipients({ channel, setChannel, contacts, groups, chips, setChips, onNext }) {
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [file, setFile] = useState(null);
  const [validationSummary, setValidationSummary] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [loadingGroupId, setLoadingGroupId] = useState(null);
  const [groupError, setGroupError] = useState('');

  async function addGroupRecipients(group) {
    setGroupError('');
    setLoadingGroupId(group.id);
    try {
      const response = await smartflowApi.getGroup(group.id);
      const fullGroup = response.data?.data || response.data || {};
      const targets = (fullGroup.members || [])
        .map((member) => getRecipientTarget(member, channel))
        .filter(Boolean);
      if (!targets.length) {
        setGroupError(`No ${channel === 'sms' ? 'phone numbers' : 'emails'} found in "${group.name}".`);
        return;
      }
      setChips((current) => [...new Set([...current, ...targets])]);
    } catch (err) {
      setGroupError(err.response?.data?.message || `Could not load members of "${group.name}".`);
    } finally {
      setLoadingGroupId(null);
    }
  }

  function addChip(value) {
    const nextValue = value.trim();
    if (!nextValue) return;
    if (!chips.includes(nextValue)) setChips(current => [...current, nextValue]);
    setManual('');
  }

  function removeChip(value) {
    setChips(current => current.filter((item) => item !== value));
  }

  function handleCSV(e) {
    const nextFile = e.target.files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = String(event.target?.result || '')
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);
      setChips((current) => [...new Set([...current, ...lines])]);
    };
    reader.readAsText(nextFile);
  }

  async function validate() {
    if (!chips.length) {
      setError('Add at least one recipient.');
      return;
    }
    setError('');
    setValidating(true);
    try {
      const response = await smartflowApi.validateBulkRecipients({
        channel,
        recipient_emails: chips,
      });
      const payload = response.data?.data || {};
      const normalizedTargets = (payload.recipients || [])
        .map((recipient) => channel === 'sms' ? recipient?.phone : recipient?.email)
        .filter(Boolean);
      setChips([...new Set(normalizedTargets)]);
      setValidationSummary({
        valid: payload.valid_count || 0,
        invalid: payload.invalid_count || 0,
        duplicates: payload.duplicate_count || 0,
        invalidEntries: payload.invalid_entries || [],
      });
      onNext();
    } catch (err) {
      setError(err.response?.data?.message || 'Validation failed, check recipients.');
    } finally {
      setValidating(false);
    }
  }

  const filteredContacts = contacts.filter((contact) => {
    const target = getRecipientTarget(contact, channel);
    if (!target || chips.includes(target)) return false;
    const haystack = `${contact?.name || ''} ${target}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {validationSummary && (
        <div className="p-3 bg-[#11C7E5]/5 border border-[#11C7E5]/20 rounded-xl text-sm text-[#A4B0B7]">
          <span className="text-white font-semibold">{validationSummary.valid}</span> valid
          {validationSummary.invalid ? <span>, <span className="text-amber-300 font-semibold">{validationSummary.invalid}</span> invalid</span> : null}
          {validationSummary.duplicates ? <span>, <span className="text-amber-300 font-semibold">{validationSummary.duplicates}</span> duplicate</span> : null}
          {validationSummary.invalidEntries?.length ? (
            <div className="text-xs mt-2 text-amber-300">Removed invalid: {validationSummary.invalidEntries.join(', ')}</div>
          ) : null}
        </div>
      )}

      <div>
        <label className={LABEL}>Delivery Channel</label>
        <div className="flex gap-3">
          {CHANNELS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setChannel(option.id);
                  setValidationSummary(null);
                }}
                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm border transition-all cursor-pointer ${
                  channel === option.id
                    ? 'bg-[#11C7E5]/10 border-[#11C7E5]/30 text-[#11C7E5]'
                    : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'
                }`}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-[#0A1019] border border-[#243246] rounded-xl min-h-12">
          {chips.map((chip) => (
            <span key={chip} className="flex items-center gap-1.5 px-3 py-1 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] text-xs font-bold rounded-full">
              {chip}
              <button type="button" onClick={() => removeChip(chip)} className="hover:text-white cursor-pointer">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addChip(manual);
            }
          }}
          placeholder={channel === 'sms' ? 'Type phone number and press Enter...' : 'Type email and press Enter...'}
          className={`${INPUT} flex-1`}
        />
        <button
          type="button"
          onClick={() => addChip(manual)}
          className="px-4 py-3 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] rounded-xl hover:bg-[#11C7E5]/20 transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {contacts.length > 0 && (
        <div>
          <label className={LABEL}>Pick from Contacts</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className={`${INPUT} mb-2`}
          />
          <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#243041] rounded-xl p-2">
            {filteredContacts.slice(0, 20).map((contact) => {
              const target = getRecipientTarget(contact, channel);
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    if (target) setChips((current) => [...new Set([...current, target])]);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-[#11C7E5]/5 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#243041] flex items-center justify-center text-[#11C7E5] font-black text-xs shrink-0">
                    {(contact.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-bold truncate">{contact.name}</p>
                    <p className="text-[#A4B0B7] text-[11px] truncate">{target}</p>
                  </div>
                </button>
              );
            })}
            {filteredContacts.length === 0 && <p className="text-center text-[#A4B0B7] text-xs py-4">No matching contacts.</p>}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <label className={LABEL}>Pick from Groups</label>
          <p className="text-[#A4B0B7] text-xs mb-2">Add every member of a group at once.</p>
          {groupError && (
            <div className="p-2.5 mb-2 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex gap-2">
              <AlertTriangle size={13} className="shrink-0" />
              {groupError}
            </div>
          )}
          <input
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            placeholder="Search groups..."
            className={`${INPUT} mb-2`}
          />
          <div className="max-h-40 overflow-y-auto space-y-1.5 border border-[#243041] rounded-xl p-2">
            {groups
              .filter((group) => (group.name || '').toLowerCase().includes(groupSearch.toLowerCase()))
              .map((group) => (
                <button
                  key={group.id}
                  type="button"
                  disabled={loadingGroupId === group.id}
                  onClick={() => addGroupRecipients(group)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-[#11C7E5]/5 rounded-xl transition-colors text-left cursor-pointer disabled:opacity-60"
                >
                  <div className="w-8 h-8 rounded-full bg-[#243041] flex items-center justify-center text-[#11C7E5] shrink-0">
                    {loadingGroupId === group.id ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-bold truncate">{group.name}</p>
                    <p className="text-[#A4B0B7] text-[11px] truncate">{group.member_count ?? (group.member_ids || []).length} members</p>
                  </div>
                </button>
              ))}
            {groups.filter((group) => (group.name || '').toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
              <p className="text-center text-[#A4B0B7] text-xs py-4">No matching groups.</p>
            )}
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 p-4 border border-dashed border-[#243246] hover:border-[#11C7E5]/40 rounded-xl cursor-pointer transition-colors group">
        <Upload size={18} className="text-[#A4B0B7] group-hover:text-[#11C7E5] transition-colors" />
        <div>
          <p className="text-white text-sm font-semibold">{file ? file.name : 'Upload CSV file'}</p>
          <p className="text-[#A4B0B7] text-xs">
            {channel === 'sms' ? 'One phone number per line or comma-separated' : 'One email per line or comma-separated'}
          </p>
        </div>
        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
      </label>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[#A4B0B7] text-sm">{chips.length} recipient{chips.length !== 1 ? 's' : ''} selected</span>
        <button
          onClick={validate}
          disabled={validating || chips.length === 0}
          className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60"
        >
          {validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Validate Recipients
        </button>
      </div>
    </div>
  );
}

function StepCompose({
  recipients,
  channel,
  setChannel,
  subject,
  setSubject,
  message,
  setMessage,
  attachments,
  setAttachments,
  scheduleDate,
  setScheduleDate,
  onBack,
  onSend,
  sending,
}) {
  const MAX = 5000;
  const [attachUrl, setAttachUrl] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);

  async function toggleVoiceWrite() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    setVoiceError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setVoiceError('Audio recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstart = () => {
        recordingStartedAtRef.current = Date.now();
        setIsRecording(true);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        const durationMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) return;
        if (durationMs < 600) {
          setVoiceError('Recording was too short. Hold the mic button and speak for a moment before stopping.');
          return;
        }
        setTranscribing(true);
        try {
          const response = await smartflowApi.transcribeAudio(blob);
          const data = response?.data?.data || response?.data || {};
          const transcript = String(data?.transcript || '').trim();
          if (!transcript) {
            setVoiceError('No speech detected. Please try again.');
            return;
          }
          const isNoisyHallucination = NOISY_TRANSCRIPTS.has(transcript.toLowerCase());
          if (isNoisyHallucination) {
            setVoiceError(
              `Only heard "${transcript}" - your microphone may be muted, set to the wrong input device, or too quiet. `
              + 'Check your browser/OS mic permissions and try again.'
            );
            return;
          }
          if (transcript.length < 4 && durationMs < 2500) {
            setVoiceError(`Could not clearly hear you (heard "${transcript}"). Please try again and speak a bit longer.`);
            return;
          }
          setMessage((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript).slice(0, MAX));
        } catch (err) {
          setVoiceError(err.response?.data?.message || 'Could not transcribe the recording.');
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      setVoiceError('Microphone access was denied.');
    }
  }

  async function improveMessage() {
    if (!message.trim()) {
      setVoiceError('Write a message before using AI Improve.');
      return;
    }
    setVoiceError('');
    setImproving(true);
    try {
      const response = await smartflowApi.improveBulkMessageContent(message);
      const improved = (response.data?.data?.content || response.data?.content || '').trim();
      if (improved) setMessage(improved.slice(0, MAX));
    } catch (err) {
      setVoiceError(err.response?.data?.message || 'AI improve is not available right now.');
    } finally {
      setImproving(false);
    }
  }

  function addAttachment() {
    if (!attachUrl.trim()) return;
    const nextUrl = attachUrl.trim();
    setAttachments((current) => [...current, { label: attachmentLabelFromUrl(nextUrl), url: nextUrl }]);
    setAttachUrl('');
  }

  async function handleLocalAttachment(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachmentError('');
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('attachment_file', file);
      const response = await smartflowApi.uploadBulkMessageAttachment(formData);
      const uploaded = response.data?.data || response.data;
      if (uploaded?.url) {
        setAttachments((current) => [...current, { label: uploaded.label || file.name, url: uploaded.url }]);
      }
    } catch (err) {
      setAttachmentError(err.response?.data?.message || 'Could not upload the file.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="p-4 bg-[#11C7E5]/5 border border-[#11C7E5]/20 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#11C7E5]" />
          <span className="font-bold text-white">{recipients.length}</span>
          <span className="text-[#A4B0B7] text-sm">recipients validated</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recipients.slice(0, 3).map((recipient) => (
            <span key={recipient} className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">
              {recipient}
            </span>
          ))}
          {recipients.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">
              +{recipients.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div>
        <label className={LABEL}>Delivery Channel</label>
        <div className="flex gap-3">
          {CHANNELS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  if (option.id !== channel) {
                    setChannel(option.id);
                    onBack();
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm border transition-all cursor-pointer ${
                  channel === option.id
                    ? 'bg-[#11C7E5]/10 border-[#11C7E5]/30 text-[#11C7E5]'
                    : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'
                }`}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-[#A4B0B7] text-xs mt-1">Switching channel sends you back to recipient validation for the selected channel.</p>
      </div>

      {channel === 'email' && (
        <div>
          <label className={LABEL}>Subject Line</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your subject here..." className={INPUT} />
        </div>
      )}

      <div>
        <label className={LABEL}>Message ({message.length}/{MAX})</label>
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
            placeholder="Write your broadcast message... Use {name} for personalization."
            className={`${INPUT} min-h-40 resize-none pb-12`}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceWrite}
              disabled={transcribing}
              title={isRecording ? 'Stop recording' : 'Write with your voice'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60 ${
                isRecording
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse'
                  : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7] hover:text-white'
              }`}
            >
              {transcribing ? <Loader2 size={15} className="animate-spin" /> : isRecording ? <Square size={14} /> : <Mic size={15} />}
            </button>
            <button
              type="button"
              onClick={improveMessage}
              disabled={improving || !message.trim()}
              title="Improve with AI"
              className="w-9 h-9 rounded-lg border border-[#243246] bg-[#0A1019] text-[#A4B0B7] hover:text-[#11C7E5] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
            >
              {improving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            </button>
          </div>
        </div>
        {voiceError && (
          <p className="text-rose-300 text-xs mt-1.5 flex items-center gap-1.5"><AlertTriangle size={12} />{voiceError}</p>
        )}
        <p className="text-[#A4B0B7] text-xs mt-1">
          Variables: <span className="text-[#11C7E5]">{'{name}'}</span>, <span className="text-[#11C7E5]">{'{phone}'}</span>, <span className="text-[#11C7E5]">{'{date}'}</span>
        </p>
      </div>

      <div>
        <label className={LABEL}>Attachments</label>
        <div className="flex gap-2 mb-2">
          <input
            value={attachUrl}
            onChange={(e) => setAttachUrl(e.target.value)}
            placeholder="https://example.com/file.pdf"
            className={`${INPUT} flex-1`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAttachment();
              }
            }}
          />
          <button
            type="button"
            onClick={addAttachment}
            title="Add link"
            className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer"
          >
            <Paperclip size={16} />
          </button>
          <label
            title="Upload from device"
            className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer flex items-center gap-2 shrink-0"
          >
            {uploadingAttachment ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="text-xs font-semibold whitespace-nowrap">{uploadingAttachment ? 'Uploading...' : 'Upload File'}</span>
            <input type="file" className="hidden" disabled={uploadingAttachment} onChange={handleLocalAttachment} />
          </label>
        </div>
        {attachmentError && (
          <p className="text-rose-300 text-xs mb-2 flex items-center gap-1.5"><AlertTriangle size={12} />{attachmentError}</p>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={`${attachment.url}-${index}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1019] border border-[#243246] rounded-xl text-xs text-[#A4B0B7]">
                <FileText size={11} />
                <span className="truncate max-w-[120px]">{attachment.label}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="hover:text-rose-400 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={LABEL}>Schedule Send (optional)</label>
        <DateTimePickerInput
          value={scheduleDate}
          onChange={setScheduleDate}
          className="focus:border-[#11C7E5]/50"
        />
        {scheduleDate && (
          <p className="text-[#11C7E5] text-xs mt-1 flex items-center gap-1.5">
            <CalendarClock size={12} />
            Scheduled for {new Date(scheduleDate).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">
          Back
        </button>
        <button
          onClick={onSend}
          disabled={!message.trim() || sending}
          className="flex-[2] py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : scheduleDate ? <CalendarClock size={18} /> : <Play size={18} />}
          {sending ? 'Sending...' : scheduleDate ? 'Schedule Broadcast' : 'Send Now'}
        </button>
      </div>
    </div>
  );
}

function BroadcastHistory({ refreshKey = 0 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadItems = useCallback(() => {
    setLoading(true);
    setLoadError('');
    smartflowApi.getBulkMessages({ page_size: 20 })
      .then((response) => setItems(response.data?.data?.items || response.data?.data || []))
      .catch(() => {
        setItems([]);
        setLoadError('Could not load broadcast history.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems, refreshKey]);

  async function cancel(id) {
    try {
      await smartflowApi.cancelBulkMessage(id);
      loadItems();
    } catch {
      // history stays unchanged when backend rejects the cancellation
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#11C7E5]" /></div>;
  }
  if (loadError) {
    return <div className="mt-6 p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-sm">{loadError}</div>;
  }
  if (!items.length) {
    return <div className="mt-6 p-4 rounded-2xl border border-[#243041] bg-[#131A24] text-[#A4B0B7] text-sm">No bulk campaigns yet.</div>;
  }

  return (
    <div className="mt-6">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Clock size={15} className="text-[#11C7E5]" />Previous Broadcasts</h3>
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl overflow-hidden">
        {items.map((item, index) => (
          <div key={item.id || index} className="p-4 flex items-center justify-between gap-4 border-b border-[#243041]/30 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-sm truncate">{item.subject || item.content?.slice(0, 60) || 'Broadcast'}</p>
              <p className="text-[#A4B0B7] text-xs mt-0.5">
                {(item.recipients || []).length || item.recipient_emails?.length || 0} recipients • {item.channel} • {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                item.status === 'sent' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
                item.status === 'scheduled' ? 'bg-amber-950/40 border-amber-500/20 text-amber-400' :
                item.status === 'draft' ? 'bg-[#243041] border-[#2A3550] text-[#A4B0B7]' :
                item.status === 'cancelled' ? 'bg-rose-950/40 border-rose-500/20 text-rose-400' :
                'bg-[#243041] border-[#2A3550] text-[#A4B0B7]'
              }`}>
                {item.status}
              </span>
              {item.status === 'scheduled' && (
                <button onClick={() => cancel(item.id)} className="text-rose-400 hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors cursor-pointer" title="Cancel">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BulkMessaging() {
  const location = useLocation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [chips, setChips] = useState([]);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    if (location.state?.prefill) {
      const prefill = location.state.prefill;
      if (prefill.message || prefill.content || prefill.body) {
        setMessage(prefill.message || prefill.content || prefill.body);
        setStep(2);
      }
      if (prefill.subject) setSubject(prefill.subject);
      if (prefill.channel && CHANNELS.some((item) => item.id === prefill.channel)) setChannel(prefill.channel);
      if (prefill.recipients && Array.isArray(prefill.recipients)) setChips(prefill.recipients);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    smartflowApi.getContacts()
      .then((response) => setContacts(response.data?.data?.items || response.data?.data || []))
      .catch(() => setContacts([]));
    smartflowApi.listGroups({ page_size: 100 })
      .then((response) => setGroups(response.data?.data?.items || response.data?.data || []))
      .catch(() => setGroups([]));
  }, []);

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      await smartflowApi.createBulkMessage({
        channel,
        recipient_emails: chips,
        subject: channel === 'email' ? subject : undefined,
        content: message,
        attachments: attachments.length ? attachments : undefined,
        send_now: !scheduleDate,
        scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      setHistoryVersion((current) => current + 1);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Send failed. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep(1);
    setChips([]);
    setMessage('');
    setSubject('');
    setAttachments([]);
    setScheduleDate('');
    setError('');
  }

  const steps = ['Recipients', 'Compose', 'Done'];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Bulk Messaging</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">Broadcast personalized messages to multiple recipients across supported channels.</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const active = step >= stepNumber;
          const current = step === stepNumber;
          return (
            <Fragment key={stepNumber}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold transition-all border ${active ? 'bg-[#11C7E5]/10 border-[#11C7E5]/35 text-white shadow-[0_0_15px_rgba(17,199,229,0.15)]' : 'bg-[#131A24] border-[#243041] text-[#A4B0B7]'} ${current ? 'ring-2 ring-[#11C7E5]/30' : ''}`}>
                  {stepNumber === 3 && step === 3 ? <CheckCircle size={18} className="text-[#11C7E5]" /> : stepNumber}
                </div>
                <span className={`text-[10px] font-bold ${active ? 'text-[#11C7E5]' : 'text-[#A4B0B7]'}`}>{label}</span>
              </div>
              {stepNumber < steps.length && <div className={`flex-1 max-w-12 h-0.5 ${step > stepNumber ? 'bg-[#11C7E5]/35' : 'bg-[#243041]'} transition-colors`} />}
            </Fragment>
          );
        })}
      </div>

      <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 text-left">
        {error && (
          <div className="mb-5 p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <StepRecipients channel={channel} setChannel={setChannel} contacts={contacts} groups={groups} chips={chips} setChips={setChips} onNext={() => setStep(2)} />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <StepCompose
                recipients={chips}
                channel={channel}
                setChannel={setChannel}
                subject={subject}
                setSubject={setSubject}
                message={message}
                setMessage={setMessage}
                attachments={attachments}
                setAttachments={setAttachments}
                scheduleDate={scheduleDate}
                setScheduleDate={setScheduleDate}
                onBack={() => setStep(1)}
                onSend={handleSend}
                sending={sending}
              />
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-12 text-center space-y-6">
              <div className="w-24 h-24 bg-[#11C7E5]/10 border-2 border-[#11C7E5]/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(17,199,229,0.1)]">
                <CheckCircle size={48} className="text-[#11C7E5]" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Broadcast {scheduleDate ? 'Scheduled!' : 'Sent!'}</h2>
                <p className="text-[#A4B0B7] text-sm mt-2 max-w-md mx-auto">
                  {scheduleDate
                    ? `Your message is scheduled for ${new Date(scheduleDate).toLocaleString()}.`
                    : `Your message is being delivered to ${chips.length} recipients.`}
                </p>
              </div>
              <button onClick={reset} className="px-8 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-extrabold hover:bg-[#0fd0f0] active:scale-95 transition-all cursor-pointer">
                Send Another
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BroadcastHistory refreshKey={historyVersion} />
    </div>
  );
}
