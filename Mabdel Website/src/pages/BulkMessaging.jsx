import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CalendarClock, CheckCircle, CheckCircle2, Clock, FileText,
  Loader2, Mail, Mic, Paperclip, Phone, Play, Plus, Sparkles, Square, Upload, Users, X,
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { formatCstDate, formatCstDateTime } from '../utils/dateUtils';
import { DateTimePickerInput } from '../components/ui/DateTimeInputs';
import { useLanguage } from '../context/LanguageContext';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

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
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);
  const [file, setFile] = useState(null);
  const [validationSummary, setValidationSummary] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [loadingGroupId, setLoadingGroupId] = useState(null);
  const [groupError, setGroupError] = useState('');

  const channels = useMemo(() => [
    { id: 'email', label: t('bulk_lbl_email'), icon: Mail },
    { id: 'sms', label: t('bulk_lbl_phone_number'), icon: Phone },
  ], [t]);

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
        setGroupError(t('bulk_err_no_group_targets', { channel: channel === 'sms' ? t('bulk_lbl_phone_numbers') : t('bulk_lbl_emails'), group: group.name }));
        return;
      }
      setChips((current) => [...new Set([...current, ...targets])]);
    } catch (err) {
      setGroupError(err.response?.data?.message || t('bulk_err_load_group_members', { group: group.name }));
    } finally {
      setLoadingGroupId(null);
    }
  }

  function addChip(value) {
    const nextValue = value.trim();
    if (!nextValue) return;
    if (!chips.includes(nextValue)) setChips((current) => [...current, nextValue]);
    setManual('');
  }

  function removeChip(value) {
    setChips((current) => current.filter((item) => item !== value));
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
      setError(t('bulk_err_add_recipient'));
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
        .map((recipient) => (channel === 'sms' ? recipient?.phone : recipient?.email))
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
      setError(err.response?.data?.message || t('bulk_err_validation_failed'));
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
    <div className="space-y-5 text-left">
      {error && (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {validationSummary && (
        <div className="p-3 bg-[#9333ea]/5 border border-[#9333ea]/20 rounded-xl text-sm text-[#A4B0B7]">
          <span className="text-white font-semibold">{validationSummary.valid}</span> {t('bulk_lbl_valid')}
          {validationSummary.invalid ? <span>, <span className="text-amber-300 font-semibold">{validationSummary.invalid}</span> {t('bulk_lbl_invalid')}</span> : null}
          {validationSummary.duplicates ? <span>, <span className="text-amber-300 font-semibold">{validationSummary.duplicates}</span> {t('bulk_lbl_duplicate')}</span> : null}
          {validationSummary.invalidEntries?.length ? (
            <div className="text-xs mt-2 text-amber-300">{t('bulk_lbl_removed_invalid', { list: validationSummary.invalidEntries.join(', ') })}</div>
          ) : null}
        </div>
      )}

      <div>
        <label className={LABEL}>{t('bulk_lbl_delivery_channel')}</label>
        <div className="flex gap-3">
          {channels.map((option) => {
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
                    ? 'bg-[#9333ea]/10 border-[#9333ea]/30 text-[#9333ea]'
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
            <span key={chip} className="flex items-center gap-1.5 px-3 py-1 bg-[#9333ea]/10 border border-[#9333ea]/20 text-[#9333ea] text-xs font-bold rounded-full">
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
          placeholder={t('bulk_ph_type_target', { channel: channel === 'sms' ? t('bulk_lbl_phone_number') : t('bulk_lbl_email') })}
          className={`${INPUT} flex-1`}
        />
        <button
          type="button"
          onClick={() => addChip(manual)}
          className="px-4 py-3 bg-[#9333ea]/10 border border-[#9333ea]/20 text-[#9333ea] rounded-xl hover:bg-[#9333ea]/20 transition-colors cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>

      {contacts.length > 0 && (
        <div>
          <label className={LABEL}>{t('bulk_lbl_pick_contacts')}</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('bulk_ph_search_contacts')}
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
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-[#9333ea]/5 rounded-xl transition-colors text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#243041] flex items-center justify-center text-[#9333ea] font-black text-xs shrink-0">
                    {(contact.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-bold truncate">{contact.name}</p>
                    <p className="text-[#A4B0B7] text-[11px] truncate">{target}</p>
                  </div>
                </button>
              );
            })}
            {filteredContacts.length === 0 && <p className="text-center text-[#A4B0B7] text-xs py-4">{t('bulk_no_contacts')}</p>}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <label className={LABEL}>{t('bulk_lbl_pick_groups')}</label>
          <p className="text-[#A4B0B7] text-xs mb-2">{t('bulk_pick_groups_hint')}</p>
          {groupError && (
            <div className="p-2.5 mb-2 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex gap-2">
              <AlertTriangle size={13} className="shrink-0" />
              {groupError}
            </div>
          )}
          <input
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            placeholder={t('bulk_ph_search_groups')}
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
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-[#9333ea]/5 rounded-xl transition-colors text-left cursor-pointer disabled:opacity-60"
                >
                  <div className="w-8 h-8 rounded-full bg-[#243041] flex items-center justify-center text-[#9333ea] shrink-0">
                    {loadingGroupId === group.id ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-bold truncate">{group.name}</p>
                    <p className="text-[#A4B0B7] text-[11px] truncate">{t('bulk_members_count', { count: group.member_count ?? (group.member_ids || []).length })}</p>
                  </div>
                </button>
              ))}
            {groups.filter((group) => (group.name || '').toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
              <p className="text-center text-[#A4B0B7] text-xs py-4">{t('bulk_no_groups')}</p>
            )}
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 p-4 border border-dashed border-[#243246] hover:border-[#9333ea]/40 rounded-xl cursor-pointer transition-colors group">
        <Upload size={18} className="text-[#A4B0B7] group-hover:text-[#9333ea] transition-colors" />
        <div>
          <p className="text-white text-sm font-semibold">{file ? file.name : t('bulk_lbl_upload_csv')}</p>
          <p className="text-[#A4B0B7] text-xs">
            {t('bulk_csv_hint', { type: channel === 'sms' ? t('bulk_lbl_phone_number') : t('bulk_lbl_email') })}
          </p>
        </div>
        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
      </label>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[#A4B0B7] text-sm">{t('bulk_recipients_selected', { count: chips.length })}</span>
        <button
          onClick={validate}
          disabled={validating || chips.length === 0}
          className="px-6 py-3 bg-[#9333ea] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#a855f7] transition-colors cursor-pointer disabled:opacity-60"
        >
          {validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {t('bulk_btn_validate_recipients')}
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
  fromPrefix,
  setFromPrefix,
  emailDomain,
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
  const { t } = useLanguage();
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

  const channels = useMemo(() => [
    { id: 'email', label: t('bulk_lbl_email'), icon: Mail },
    { id: 'sms', label: t('bulk_lbl_phone_number'), icon: Phone },
  ], [t]);

  async function toggleVoiceWrite() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    setVoiceError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setVoiceError(t('bulk_err_audio_unsupported'));
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
          setVoiceError(t('bulk_err_recording_too_short'));
          return;
        }
        setTranscribing(true);
        try {
          const response = await smartflowApi.transcribeAudio(blob);
          const data = response?.data?.data || response?.data || {};
          const transcript = String(data?.transcript || '').trim();
          if (!transcript) {
            setVoiceError(t('bulk_err_no_speech'));
            return;
          }
          const isNoisyHallucination = NOISY_TRANSCRIPTS.has(transcript.toLowerCase());
          if (isNoisyHallucination) {
            setVoiceError(t('bulk_err_no_speech'));
            return;
          }
          if (transcript.length < 4 && durationMs < 2500) {
            setVoiceError(t('bulk_err_no_speech'));
            return;
          }
          setMessage((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript).slice(0, MAX));
        } catch (err) {
          setVoiceError(err.response?.data?.message || t('bulk_err_no_speech'));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      setVoiceError(t('bulk_err_mic_denied'));
    }
  }

  async function improveMessage() {
    if (!message.trim()) {
      setVoiceError(t('bulk_err_write_before_improve'));
      return;
    }
    setVoiceError('');
    setImproving(true);
    try {
      const response = await smartflowApi.improveBulkMessageContent(message);
      const improved = (response.data?.data?.content || response.data?.content || '').trim();
      if (improved) setMessage(improved.slice(0, MAX));
    } catch (err) {
      setVoiceError(err.response?.data?.message || t('bulk_err_ai_improve_unavailable'));
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
      setAttachmentError(err.response?.data?.message || t('bulk_err_upload_file'));
    } finally {
      setUploadingAttachment(false);
    }
  }

  return (
    <div className="space-y-5 text-left">
      <div className="p-4 bg-[#9333ea]/5 border border-[#9333ea]/20 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#9333ea]" />
          <span className="font-bold text-white">{recipients.length}</span>
          <span className="text-[#A4B0B7] text-sm">{t('bulk_recipients_validated', { count: recipients.length })}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {recipients.slice(0, 3).map((recipient) => (
            <span key={recipient} className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">
              {recipient}
            </span>
          ))}
          {recipients.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 bg-[#243041] text-[#A4B0B7] rounded-full">
              {t('bulk_more_recipients', { count: recipients.length - 3 })}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className={LABEL}>{t('bulk_lbl_delivery_channel')}</label>
        <div className="flex gap-3">
          {channels.map((option) => {
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
                    ? 'bg-[#9333ea]/10 border-[#9333ea]/30 text-[#9333ea]'
                    : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'
                }`}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-[#A4B0B7] text-xs mt-1">{t('bulk_switch_channel_hint')}</p>
      </div>

      {channel === 'email' && emailDomain?.status === 'verified' && (
        <div>
          <label className={LABEL}>{t('bulk_lbl_from')}</label>
          <div className="flex items-stretch">
            <input
              value={fromPrefix}
              onChange={(e) => setFromPrefix(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase())}
              placeholder={emailDomain.default_prefix || 'hello'}
              className={`${INPUT} rounded-r-none border-r-0 min-w-0`}
            />
            <span className="flex items-center px-3 bg-[#0C0E12] border border-[#1E2530] border-l-0 rounded-r-xl text-[#9BA7BB] text-sm whitespace-nowrap">
              @{emailDomain.domain}
            </span>
          </div>
          <p className="text-[#A4B0B7] text-xs mt-1">{t('bulk_hint_from')}</p>
        </div>
      )}

      {channel === 'email' && (
        <div>
          <label className={LABEL}>{t('bulk_lbl_subject')}</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('bulk_ph_subject')} className={INPUT} />
        </div>
      )}

      <div>
        <label className={LABEL}>{t('bulk_lbl_message', { count: message.length, max: MAX })}</label>
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
            placeholder={t('bulk_ph_message')}
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
              title={t('bulk_improve_with_ai')}
              className="w-9 h-9 rounded-lg border border-[#243246] bg-[#0A1019] text-[#A4B0B7] hover:text-[#9333ea] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60"
            >
              {improving ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            </button>
          </div>
        </div>
        {voiceError && (
          <p className="text-rose-300 text-xs mt-1.5 flex items-center gap-1.5"><AlertTriangle size={12} />{voiceError}</p>
        )}
        <p className="text-[#A4B0B7] text-xs mt-1">
          {t('bulk_variables_label')} <span className="text-[#9333ea]">{'{name}'}</span>, <span className="text-[#9333ea]">{'{phone}'}</span>, <span className="text-[#9333ea]">{'{date}'}</span>
        </p>
      </div>

      <div>
        <label className={LABEL}>{t('bulk_attachments_label')}</label>
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
            title={t('bulk_title_add_link')}
            className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer"
          >
            <Paperclip size={16} />
          </button>
          <label
            title={t('bulk_title_upload_device')}
            className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer flex items-center gap-2 shrink-0"
          >
            {uploadingAttachment ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span className="text-xs font-semibold whitespace-nowrap">{uploadingAttachment ? t('bulk_lbl_uploading') : t('bulk_lbl_upload_file')}</span>
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
        <label className={LABEL}>{t('bulk_lbl_schedule_send')}</label>
        <DateTimePickerInput
          value={scheduleDate}
          onChange={setScheduleDate}
          className="focus:border-[#9333ea]/50"
        />
        {scheduleDate && (
          <p className="text-[#9333ea] text-xs mt-1 flex items-center gap-1.5">
            <CalendarClock size={12} />
            {t('bulk_scheduled_for', { time: formatCstDateTime(scheduleDate) })}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">
          {t('bulk_btn_back')}
        </button>
        <button
          onClick={onSend}
          disabled={!message.trim() || sending}
          className="flex-[2] py-3 bg-[#9333ea] text-[#02080B] rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-[#a855f7] transition-colors cursor-pointer disabled:opacity-60"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : scheduleDate ? <CalendarClock size={18} /> : <Play size={18} />}
          {sending ? t('bulk_lbl_sending') : scheduleDate ? t('bulk_btn_schedule_broadcast') : t('bulk_btn_send_now')}
        </button>
      </div>
    </div>
  );
}

function BroadcastHistory({ refreshKey = 0 }) {
  const { t } = useLanguage();
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
        setLoadError(t('bulk_err_load_history'));
      })
      .finally(() => setLoading(false));
  }, [t]);

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
    return <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>;
  }
  if (loadError) {
    return <div className="mt-6 p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-sm text-left">{loadError}</div>;
  }
  if (!items.length) {
    return <div className="mt-6 p-4 rounded-2xl border border-[#243041] bg-[#131A24] text-[#A4B0B7] text-sm text-left">{t('bulk_no_campaigns')}</div>;
  }

  return (
    <div className="mt-6 text-left">
      <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Clock size={15} className="text-[#9333ea]" />{t('bulk_lbl_previous_broadcasts')}</h3>
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl overflow-hidden">
        {items.map((item, index) => (
          <div key={item.id || index} className="p-4 flex items-center justify-between gap-4 border-b border-[#243041]/30 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white text-sm truncate">{item.subject || item.content?.slice(0, 60) || t('bulk_default_subject')}</p>
              <p className="text-[#A4B0B7] text-xs mt-0.5">
                {(item.recipients || []).length || item.recipient_emails?.length || 0} recipients • {item.channel} • {item.created_at ? formatCstDate(item.created_at) : ''}
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
                <button onClick={() => cancel(item.id)} className="text-rose-400 hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors cursor-pointer" title={t('bulk_title_cancel')}>
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
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [chips, setChips] = useState([]);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [fromPrefix, setFromPrefix] = useState('');
  const [emailDomain, setEmailDomain] = useState(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);

  const channels = useMemo(() => [
    { id: 'email', label: t('bulk_lbl_email'), icon: Mail },
    { id: 'sms', label: t('bulk_lbl_phone_number'), icon: Phone },
  ], [t]);

  useEffect(() => {
    if (location.state?.prefill) {
      const prefill = location.state.prefill;
      if (prefill.message || prefill.content || prefill.body) {
        setMessage(prefill.message || prefill.content || prefill.body);
        setStep(2);
      }
      if (prefill.subject) setSubject(prefill.subject);
      if (prefill.channel && channels.some((item) => item.id === prefill.channel)) setChannel(prefill.channel);
      if (prefill.recipients && Array.isArray(prefill.recipients)) setChips(prefill.recipients);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [channels, location, navigate]);

  useEffect(() => {
    smartflowApi.getContacts()
      .then((response) => setContacts(response.data?.data?.items || response.data?.data || []))
      .catch(() => setContacts([]));
    smartflowApi.listGroups({ page_size: 100 })
      .then((response) => setGroups(response.data?.data?.items || response.data?.data || []))
      .catch(() => setGroups([]));
    // Only owners with a verified business domain get the custom From field.
    smartflowApi.getEmailDomain()
      .then((response) => setEmailDomain(response.data?.data || null))
      .catch(() => setEmailDomain(null));
  }, []);

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      await smartflowApi.createBulkMessage({
        channel,
        recipient_emails: chips,
        subject: channel === 'email' ? subject : undefined,
        from_prefix: channel === 'email' && fromPrefix.trim() ? fromPrefix.trim() : undefined,
        content: message,
        attachments: attachments.length ? attachments : undefined,
        send_now: !scheduleDate,
        scheduled_at: scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      setHistoryVersion((current) => current + 1);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || t('bulk_err_send_failed'));
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

  const steps = [t('bulk_step_recipients'), t('bulk_step_compose'), t('bulk_step_done')];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('bulk_title')}</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">{t('bulk_subtitle')}</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const active = step >= stepNumber;
          const current = step === stepNumber;
          return (
            <Fragment key={stepNumber}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold transition-all border ${active ? 'bg-[#9333ea]/10 border-[#9333ea]/35 text-white shadow-[0_0_15px_rgba(17,199,229,0.15)]' : 'bg-[#131A24] border-[#243041] text-[#A4B0B7]'} ${current ? 'ring-2 ring-[#9333ea]/30' : ''}`}>
                  {stepNumber === 3 && step === 3 ? <CheckCircle size={18} className="text-[#9333ea]" /> : stepNumber}
                </div>
                <span className={`text-[10px] font-bold ${active ? 'text-[#9333ea]' : 'text-[#A4B0B7]'}`}>{label}</span>
              </div>
              {stepNumber < steps.length && <div className={`flex-1 max-w-12 h-0.5 ${step > stepNumber ? 'bg-[#9333ea]/35' : 'bg-[#243041]'} transition-colors`} />}
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
                fromPrefix={fromPrefix}
                setFromPrefix={setFromPrefix}
                emailDomain={emailDomain}
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
              <div className="w-24 h-24 bg-[#9333ea]/10 border-2 border-[#9333ea]/30 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(17,199,229,0.1)]">
                <CheckCircle size={48} className="text-[#9333ea]" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">
                  {t('bulk_done_title', { action: scheduleDate ? t('bulk_action_scheduled') : t('bulk_action_sent') })}
                </h2>
                <p className="text-[#A4B0B7] text-sm mt-2 max-w-md mx-auto">
                  {scheduleDate
                    ? t('bulk_done_scheduled_sub', { time: formatCstDateTime(scheduleDate) })
                    : t('bulk_done_sent_sub', { count: chips.length })}
                </p>
              </div>
              <button onClick={reset} className="px-8 py-3 bg-[#9333ea] text-[#02080B] rounded-xl font-extrabold hover:bg-[#a855f7] active:scale-95 transition-all cursor-pointer">
                {t('bulk_btn_send_another')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BroadcastHistory refreshKey={historyVersion} />
    </div>
  );
}
