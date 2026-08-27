import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarCheck2, CheckCircle2, Clock, Loader2, User, XCircle } from 'lucide-react';
import { publicApi } from '../api/services';
import logoMark from '../assets/gocustify-mark.png';
import { formatCstDate, formatCstTime } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#070a13] text-gray-100">
      <header className="border-b border-gray-900 bg-[#070a13]/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-center gap-2">
          <img src={logoMark} alt="GoCustify" className="w-9 h-9 rounded-lg shadow-lg shadow-purple-500/20" />
          <span className="text-lg font-bold tracking-tight text-white">GoCustify</span>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-6 py-16 md:py-20">{children}</main>
    </div>
  );
}

export default function ConfirmMeeting() {
  const { token } = useParams();
  const { t } = useLanguage();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    let ignore = false;
    publicApi
      .getProposedMeetingTime(token)
      .then((response) => {
        if (ignore) return;
        setProposal(response?.data?.data || null);
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || t('confirm_meeting_err_load'));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token, t]);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setError('');
    try {
      const response = await publicApi.confirmProposedMeetingTime(token);
      setConfirmed(response?.data?.data || null);
    } catch (confirmError) {
      setError(confirmError?.response?.data?.message || t('confirm_meeting_err_confirm'));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-400" size={28} />
        </div>
      </Shell>
    );
  }

  if (confirmed) {
    return (
      <Shell>
        <div className="rounded-[28px] border border-emerald-500/20 bg-[#0c101b]/80 px-6 py-10 md:px-10 md:py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 size={30} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t('confirm_meeting_success_title')}</h1>
          <p className="text-gray-400 text-sm">
            {formatCstDate(confirmed.confirmed_start)} · {formatCstTime(confirmed.confirmed_start)}
          </p>
          {confirmed.meeting_link ? (
            <a
              href={confirmed.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 px-5 py-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm transition-colors"
            >
              {t('confirm_meeting_btn_join_link')}
            </a>
          ) : null}
        </div>
      </Shell>
    );
  }

  if (error && !proposal) {
    return (
      <Shell>
        <div className="rounded-[28px] border border-rose-500/20 bg-[#0c101b]/80 px-6 py-10 md:px-10 md:py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <XCircle size={30} className="text-rose-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t('confirm_meeting_err_title')}</h1>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </Shell>
    );
  }

  const proposedStart = proposal?.proposal?.proposed_start;
  const note = proposal?.proposal?.note;
  const requesterName = `${proposal?.first_name || ''} ${proposal?.last_name || ''}`.trim();
  const alreadyConfirmed = proposal?.status === 'confirmed';

  return (
    <Shell>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-purple-400">{t('confirm_meeting_eyebrow')}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('confirm_meeting_title')}</h1>
        </div>

        <div className="rounded-[28px] border border-gray-900 bg-[#0c101b]/80 px-6 py-7 md:px-8 md:py-9 space-y-5">
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 px-4 py-3 text-sm text-rose-300">{error}</div>
          ) : null}

          {requesterName ? (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <User size={18} className="text-slate-400 mt-0.5" />
              <div>
                <p className="text-white font-semibold text-sm">{requesterName}</p>
                <p className="text-slate-400 text-xs mt-1">{proposal?.email}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <Clock size={18} className="text-slate-400 mt-0.5" />
            <div>
              <p className="text-white font-semibold text-sm">
                {proposedStart ? formatCstDate(proposedStart) : t('confirm_meeting_no_time')}
              </p>
              {proposedStart ? <p className="text-slate-400 text-xs mt-1">{formatCstTime(proposedStart)}</p> : null}
            </div>
          </div>

          {note ? (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <CalendarCheck2 size={18} className="text-slate-400 mt-0.5" />
              <p className="text-slate-300 text-sm">{note}</p>
            </div>
          ) : null}

          {alreadyConfirmed ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-3 text-sm text-emerald-300">
              {t('confirm_meeting_already_confirmed')}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070a13] font-extrabold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {confirming ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              {t('confirm_meeting_btn_confirm')}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
