import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, HelpCircle, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import {
  SiMessenger,
  SiInstagram,
  SiWhatsapp,
  SiX,
  SiTelegram,
  SiSnapchat,
  SiGoogle,
  SiThreads,
} from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';
import { smartflowApi } from '../api/services';
import BusinessEmailDomain from '../components/BusinessEmailDomain';
import ModalShell from '../components/ModalShell';
import { useLanguage } from '../context/LanguageContext';
import { isTrustedOAuthMessage } from '../utils/oauthMessages';

// Only platforms the backend can actually connect. YouTube, TikTok and Pinterest were
// listed here before but have no backend provider, so they could never appear.
const PLATFORM_META = {
  facebook_messenger: { Icon: SiMessenger, bg: '#00B2FF', label: 'Facebook', descKey: 'integ_desc_facebook' },
  instagram: { Icon: SiInstagram, bg: '#C13584', label: 'Instagram', descKey: 'integ_desc_instagram' },
  whatsapp: { Icon: SiWhatsapp, bg: '#25D366', label: 'WhatsApp', descKey: 'integ_desc_whatsapp' },
  linkedin: { Icon: FaLinkedin, bg: '#0A66C2', label: 'LinkedIn', descKey: 'integ_desc_linkedin' },
  twitter_x: { Icon: SiX, bg: '#000000', label: 'X (Twitter)', descKey: 'integ_desc_twitter' },
  telegram: { Icon: SiTelegram, bg: '#229ED9', label: 'Telegram', descKey: 'integ_desc_telegram' },
  snapchat: { Icon: SiSnapchat, bg: '#FFFC00', label: 'Snapchat', descKey: 'integ_desc_snapchat', badgeColor: '#000' },
  google_business: { Icon: SiGoogle, bg: '#4285F4', label: 'Google Business', descKey: 'integ_desc_google' },
  threads: { Icon: SiThreads, bg: '#101010', label: 'Threads', descKey: 'integ_desc_threads' },
};

const INPUT =
  'w-full px-4 py-3 bg-[#0C0E12] border border-[#1E2530] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-[15px] placeholder:text-[#70829B]';
const SECONDARY_BUTTON =
  'w-full h-[50px] bg-[#1E2530] text-[#F8FAFC] rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-[15px]';

const OAUTH_COMPLETION_MESSAGES = ['mabdel-google-calendar-oauth', 'mabdel-zoom-calendar-oauth'];

// Backend list payloads are sometimes a bare array and sometimes { items: [...] }.
function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function WhatsAppChoiceModal({ onClose, onChooseQr, onChooseApi }) {
  const { t } = useLanguage();
  const titleId = useId();
  const optionClass =
    'w-full text-start bg-[#0C0E12] border border-[#1E2530] hover:border-[#25D366]/60 rounded-xl p-4 transition-colors cursor-pointer';

  return (
    <ModalShell titleId={titleId} onClose={onClose} className="space-y-3">
      <h3 id={titleId} className="font-bold text-[#F3F9FF] text-xl">
        {t('integ_wa_choice_title')}
      </h3>

      <button type="button" onClick={onChooseQr} className={optionClass}>
        <div className="text-[#F3F9FF] font-semibold text-[15px]">{t('integ_wa_choice_qr_title')}</div>
        <div className="text-[#9BA7BB] text-[13px] mt-1 leading-relaxed">{t('integ_wa_choice_qr_desc')}</div>
      </button>

      <button type="button" onClick={onChooseApi} className={optionClass}>
        <div className="text-[#F3F9FF] font-semibold text-[15px]">{t('integ_wa_choice_api_title')}</div>
        <div className="text-[#9BA7BB] text-[13px] mt-1 leading-relaxed">{t('integ_wa_choice_api_desc')}</div>
      </button>

      <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
        {t('integ_btn_cancel')}
      </button>
    </ModalShell>
  );
}

const WHATSAPP_POLL_INTERVAL_MS = 3000;
const WHATSAPP_SUCCESS_VISIBLE_MS = 1800;

function WhatsAppModal({ onClose, onSuccess }) {
  const { t } = useLanguage();
  const titleId = useId();
  // 'starting' | 'pending_qr' | 'connected' | 'error'
  const [phase, setPhase] = useState('starting');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [linkedNumber, setLinkedNumber] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const successTimerRef = useRef(null);
  const startPromiseRef = useRef(null);
  const phaseRef = useRef('starting');
  // The parent passes fresh inline callbacks on every render; keeping them in a ref
  // stops the session effect from restarting whenever the page re-renders.
  const callbacksRef = useRef({ onClose, onSuccess, t });
  useEffect(() => {
    callbacksRef.current = { onClose, onSuccess, t };
  });

  useEffect(() => {
    let cancelled = false;

    function setPhaseBoth(next) {
      phaseRef.current = next;
      setPhase(next);
    }

    function applyStatus(data) {
      if (!data) return;
      const { onClose: close, onSuccess: success, t: translate } = callbacksRef.current;
      if (data.status === 'connected') {
        if (phaseRef.current === 'connected') return;
        setPhaseBoth('connected');
        setLinkedNumber(data.linked_number);
        setQrDataUrl(null);
        if (pollRef.current) clearInterval(pollRef.current);
        // Let the success view be seen before the (blocking) alert and the close.
        successTimerRef.current = setTimeout(() => {
          success(translate('integ_msg_wa_linked', { number: data.linked_number || '' }));
          close();
        }, WHATSAPP_SUCCESS_VISIBLE_MS);
      } else {
        setPhaseBoth('pending_qr');
        if (data.qr_data_url) setQrDataUrl(data.qr_data_url);
      }
    }

    async function start() {
      try {
        const response = await smartflowApi.connectWhatsApp();
        if (cancelled) return;
        applyStatus(response.data?.data);
        pollRef.current = setInterval(async () => {
          try {
            const poll = await smartflowApi.getWhatsAppQr();
            if (!cancelled) applyStatus(poll.data?.data);
          } catch {
            // transient poll failure - keep trying on the next tick
          }
        }, WHATSAPP_POLL_INTERVAL_MS);
      } catch (err) {
        if (!cancelled) {
          setPhaseBoth('error');
          setError(err.response?.data?.message || callbacksRef.current.t('integ_err_wa_link_failed'));
        }
      }
    }

    startPromiseRef.current = start();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Cancelling before the phone is linked must also drop the half-open session on the
  // server, otherwise it keeps a pending QR session alive for nothing.
  const handleCancel = useCallback(async () => {
    if (phaseRef.current !== 'connected') {
      try {
        await startPromiseRef.current;
        await smartflowApi.disconnectIntegration('whatsapp');
      } catch {
        // nothing to clean up (never started) or already gone
      }
    }
    callbacksRef.current.onClose();
  }, []);

  return (
    <ModalShell titleId={titleId} onClose={handleCancel} className="space-y-3.5 text-center">
      <h3 id={titleId} className="font-bold text-[#F3F9FF] text-xl">
        {t('integ_title_connect_wa')}
      </h3>

      {phase === 'starting' && (
        <div role="status" className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={28} className="animate-spin text-[#25D366]" aria-hidden="true" />
          <p className="text-[#9BA7BB] text-sm">{t('integ_wa_starting')}</p>
        </div>
      )}

      {phase === 'pending_qr' && (
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={t('integ_wa_qr_alt')} className="w-56 h-56 rounded-xl bg-white p-2" />
          ) : (
            <div role="status" className="w-56 h-56 rounded-xl bg-[#0C0E12] border border-[#1E2530] flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-[#25D366]" aria-hidden="true" />
            </div>
          )}
          <p className="text-[#9BA7BB] text-[13px] leading-relaxed">{t('integ_wa_qr_instructions')}</p>
        </div>
      )}

      {phase === 'connected' && (
        <div role="status" className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 size={40} className="text-[#25D366]" aria-hidden="true" />
          <p className="text-[#F3F9FF] font-semibold">{t('integ_wa_connected', { number: linkedNumber || '' })}</p>
        </div>
      )}

      {phase === 'error' && (
        <div role="alert" className="text-rose-400 text-sm">
          {error}
        </div>
      )}

      <button type="button" onClick={handleCancel} className={SECONDARY_BUTTON}>
        {t('integ_btn_cancel')}
      </button>
    </ModalShell>
  );
}

function TelegramModal({ onClose, onSuccess }) {
  const { t } = useLanguage();
  const titleId = useId();
  const tokenId = useId();
  const usernameId = useId();
  const secretId = useId();
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect(event) {
    event?.preventDefault();
    if (loading) return;
    // Same limits the API enforces (bot_token >= 10, secret_token >= 8), so the user
    // gets a clear message instead of a raw 422.
    if (botToken.trim().length < 10) {
      setError(t('integ_err_invalid_bot_token'));
      return;
    }
    if (secretToken.trim() && secretToken.trim().length < 8) {
      setError(t('integ_err_secret_short'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await smartflowApi.connectTelegramManual({
        bot_token: botToken.trim(),
        bot_username: botUsername.trim() || undefined,
        secret_token: secretToken.trim() || undefined,
      });
      onSuccess(t('integ_msg_tg_linked'));
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || t('integ_err_tg_link_failed'));
    } finally {
      setLoading(false);
    }
  }

  const labelClass = 'text-[#9BA7BB] text-[13px] font-semibold mb-1 block';

  return (
    <ModalShell titleId={titleId} onClose={onClose}>
      <form onSubmit={connect} className="space-y-3.5">
        <h3 id={titleId} className="font-bold text-[#F3F9FF] text-xl">
          {t('integ_title_connect_tg')}
        </h3>

        {error && (
          <div role="alert" className="text-rose-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={tokenId} className={labelClass}>
            {t('integ_lbl_bot_token')}
          </label>
          <input
            id={tokenId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="123456:ABCDEF_bot_token"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={usernameId} className={labelClass}>
            {t('integ_lbl_bot_username')}
          </label>
          <input
            id={usernameId}
            autoComplete="off"
            spellCheck={false}
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value)}
            placeholder="gocustify_bot"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={secretId} className={labelClass}>
            {t('integ_lbl_secret_token')}
          </label>
          <input
            id={secretId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={secretToken}
            onChange={(e) => setSecretToken(e.target.value)}
            placeholder={t('integ_webhook_secret_placeholder')}
            className={INPUT}
          />
        </div>

        <div className="flex gap-2.5 pt-1.5">
          <button type="button" onClick={onClose} className={`flex-1 ${SECONDARY_BUTTON}`}>
            {t('integ_btn_cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 h-[50px] bg-[#c084fc] text-[#03141E] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#7e22ce] transition-colors cursor-pointer disabled:opacity-60 text-[15px]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {t('integ_btn_connect')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function PlatformCard({ item, onConnect, onDisconnect }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const meta = PLATFORM_META[item.platform] || {
    Icon: HelpCircle,
    bg: '#455A64',
    label: item.platform_label || item.platform,
    descKey: 'integ_desc_default',
  };
  const desc = t(meta.descKey);
  // Judge availability by the structured fields the API sends, not by comparing a
  // display string ("Unavailable") that could be reworded or translated.
  const isUnavailable = item.is_available === false || item.is_configured === false;
  const iconColor = meta.badgeColor || '#fff';
  const Icon = meta.Icon;

  async function run(action) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm(t('integ_confirm_disconnect', { name: meta.label }))) return;
    await run(() => onDisconnect(item.platform));
  }

  return (
    <div
      className={`bg-[#111318] border border-[#1E2530] rounded-2xl px-3.5 py-3.5 flex flex-row items-center gap-3 text-start ${
        isUnavailable ? 'opacity-50' : ''
      }`}
    >
      <div
        className="w-[52px] h-[52px] rounded-xl flex items-center justify-center shrink-0 border-[1.5px]"
        style={{ backgroundColor: meta.bg, borderColor: '#333' }}
      >
        <Icon size={26} color={iconColor} aria-hidden="true" />
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h3 className="font-bold text-[#F0F6FF] text-[16px] truncate">{meta.label}</h3>
        <p className="text-[13px] text-[#6B7A90] leading-[18px] line-clamp-2">{desc}</p>
        {item.external_account_name ? (
          <p className="text-[12px] text-[#9BA7BB] truncate mt-1">{item.external_account_name}</p>
        ) : null}
      </div>

      {item.connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={busy}
          aria-label={t('integ_aria_disconnect', { name: meta.label })}
          className="flex items-center gap-1.5 bg-[#0D2318] border border-[#1a4a2e] px-3 py-2 rounded-full cursor-pointer hover:bg-emerald-950 transition-colors shrink-0 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin text-[#4DCE63]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} className="text-[#4DCE63]" aria-hidden="true" />
          )}
          <span className="text-[#4DCE63] text-[13px] font-semibold">{t('integ_status_connected')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => !isUnavailable && run(() => onConnect(item))}
          disabled={isUnavailable || busy}
          className={`px-4 py-2 rounded-full min-w-[80px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
            isUnavailable ? 'bg-[#1E2530] text-[#03141E]' : 'bg-[#c084fc] text-[#03141E] hover:bg-[#7e22ce] disabled:opacity-60'
          }`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          <span className="text-[14px] font-bold">{isUnavailable ? t('integ_status_soon') : t('integ_btn_connect')}</span>
        </button>
      )}
    </div>
  );
}

export default function Integrations() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [whatsappChoice, setWhatsappChoice] = useState(false);
  const [telegramModal, setTelegramModal] = useState(false);
  const oauthWindowRef = useRef(null);
  const loadedOnceRef = useRef(false);
  const itemsRef = useRef([]);

  const fetchAll = useCallback(async () => {
    // Only the first load blanks the page. Later refreshes (after an OAuth return,
    // a disconnect, a modal closing) update in place - they used to swap the whole
    // list for a spinner, which also threw away anything typed in the email-domain form.
    if (!loadedOnceRef.current) setLoading(true);
    setError('');

    let list = [];
    let failed = false;
    try {
      const catalogRes = await smartflowApi.getIntegrationCatalog();
      list = asList(catalogRes.data?.data);
    } catch (err) {
      failed = true;
      console.error('Integrations catalog request failed.', err);
    }

    // The status endpoint returns the same catalog plus a summary, so it is only a
    // fallback; calling both on every load doubled the backend work.
    if (list.length === 0) {
      try {
        const statusRes = await smartflowApi.getIntegrationStatus();
        list = asList(statusRes.data?.data).map((item) => ({
          platform: item.platform,
          platform_label: PLATFORM_META[item.platform]?.label || item.platform_label || item.platform,
          connected: Boolean(item.connected),
          auth_mode: item.auth_mode || (item.platform === 'whatsapp' || item.platform === 'telegram' ? 'manual' : 'oauth'),
          is_available: item.is_available ?? true,
          external_account_name: item.external_account_name || null,
        }));
        failed = false;
      } catch (err) {
        console.error('Integrations status request failed.', err);
      }
    }

    if (list.length === 0 && failed) {
      // Keep showing what we already had rather than wiping a working page.
      if (itemsRef.current.length === 0) setItems([]);
      setError(t('integ_err_load_failed'));
    } else {
      itemsRef.current = list;
      setItems(list);
    }
    loadedOnceRef.current = true;
    setLoading(false);
  }, [t]);

  const fetchAllRef = useRef(fetchAll);
  useEffect(() => {
    fetchAllRef.current = fetchAll;
  });

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    function handleFocus() {
      if (oauthWindowRef.current && oauthWindowRef.current.closed) {
        oauthWindowRef.current = null;
        fetchAllRef.current();
      }
    }

    function handleMessage(event) {
      if (isTrustedOAuthMessage(event, OAUTH_COMPLETION_MESSAGES)) {
        fetchAllRef.current();
      }
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  async function handleConnect(item) {
    if (item.platform === 'whatsapp') {
      setWhatsappChoice(true);
      return;
    }
    if (item.platform === 'telegram') {
      setTelegramModal(true);
      return;
    }
    if (item.auth_mode === 'manual') {
      window.alert(t('integ_msg_manual_setup', { label: item.platform_label }));
      return;
    }
    if (item.platform === 'instagram') {
      const confirmed = window.confirm(t('integ_confirm_instagram'));
      if (!confirmed) return;
    }
    await startOAuth(item.platform);
  }

  async function startOAuth(platform) {
    try {
      const res = await smartflowApi.startIntegrationOAuth(platform);
      const url = res.data?.data?.auth_url || res.data?.auth_url;
      if (!url) {
        window.alert(t('integ_err_no_auth_url'));
        return;
      }
      const popup = window.open(url, '_blank');
      if (!popup) {
        // Opened after an await, so browsers may treat it as an unsolicited pop-up.
        window.alert(t('integ_err_popup_blocked'));
        return;
      }
      oauthWindowRef.current = popup;
    } catch (err) {
      window.alert(err.response?.data?.message || t('integ_err_initiate_failed'));
    }
  }

  async function handleDisconnect(platform) {
    try {
      await smartflowApi.disconnectIntegration(platform);
      await fetchAll();
    } catch (err) {
      window.alert(err.response?.data?.message || t('integ_err_disconnect_failed'));
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#020406] max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between py-2 mb-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          aria-label={t('integ_btn_back')}
          className="w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-white/5 rounded-full transition-colors"
        >
          <ChevronLeft size={28} className="text-[#F1F7FF] rtl:rotate-180" aria-hidden="true" />
        </button>
        <h1 className="text-[#F3F9FF] text-[20px] font-bold text-center flex-1">{t('integ_title')}</h1>
        <div className="w-9 h-9" />
      </div>

      <div className="flex-1 pb-10">
        <div className="flex flex-col gap-3">
          {/* Always mounted, so a catalog failure or refresh never hides or resets it. */}
          <BusinessEmailDomain />

          {loading ? (
            <div role="status" className="flex flex-col items-center justify-center h-48 gap-3.5">
              <Loader2 size={32} className="text-[#c084fc] animate-spin" aria-hidden="true" />
              <p className="text-[#9BA7BB] text-[15px]">{t('integ_loading')}</p>
            </div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center justify-center h-48 gap-3.5 text-center px-6">
              <AlertCircle size={32} className="text-rose-400" aria-hidden="true" />
              <p className="text-[#F3F9FF] text-[16px] font-semibold">{error}</p>
              <button
                type="button"
                onClick={fetchAll}
                className="h-[46px] px-5 bg-[#c084fc] text-[#03141E] rounded-xl font-semibold hover:bg-[#7e22ce] transition-colors cursor-pointer"
              >
                {t('integ_btn_retry')}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-[#9BA7BB] text-[15px] py-10">{t('integ_empty')}</p>
          ) : (
            items.map((item) => (
              <PlatformCard key={item.platform} item={item} onConnect={handleConnect} onDisconnect={handleDisconnect} />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {whatsappChoice ? (
          <WhatsAppChoiceModal
            key="wa-choice"
            onClose={() => setWhatsappChoice(false)}
            onChooseQr={() => {
              setWhatsappChoice(false);
              setWhatsappModal(true);
            }}
            onChooseApi={() => {
              setWhatsappChoice(false);
              startOAuth('whatsapp');
            }}
          />
        ) : null}
        {whatsappModal ? (
          <WhatsAppModal
            key="wa-qr"
            onClose={() => {
              setWhatsappModal(false);
              // Whatever happened in the modal (linked, cancelled, poll missed it), the
              // card must reflect the server's state afterwards.
              fetchAll();
            }}
            onSuccess={(msg) => window.alert(msg)}
          />
        ) : null}
        {telegramModal ? (
          <TelegramModal
            key="tg"
            onClose={() => setTelegramModal(false)}
            onSuccess={(msg) => {
              window.alert(msg);
              fetchAll();
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
