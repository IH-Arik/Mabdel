import {
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LABEL_CLS } from './utils';

// ── Shared sub-components for the Documents page ────────────────────────────
export function Field({ label, children }) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
    </div>
  );
}

export function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#243041]/40">
      <Icon size={18} className="text-[#9333ea]" />
      <h3 className="text-white font-bold text-sm">{title}</h3>
    </div>
  );
}

// ── AI Review Panel ─────────────────────────────────────────────────────────────
export function AIReviewPanel({ review }) {
  const { t } = useLanguage();
  if (!review?.length) return (
    <div className="p-4 text-[#A4B0B7] text-sm text-center">
      {t('docs_no_review_yet')}
    </div>
  );
  return (
    <div className="space-y-2">
      {review.map((item, i) => {
        const isWarning = item.severity === 'warning' || item.severity === 'error';
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${isWarning ? 'bg-rose-950/30 border border-rose-500/20' : 'bg-emerald-950/20 border border-emerald-500/20'}`}>
            {isWarning
              ? <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
              : <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />}
            <div>
              <p className={`font-semibold text-sm ${isWarning ? 'text-rose-300' : 'text-emerald-300'}`}>{item.title}</p>
              {item.message && <p className="text-xs mt-0.5 text-[#A4B0B7]">{item.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SigToggle({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 bg-[#0A1019] border border-[#243246] rounded-xl">
      <span className="flex items-center gap-2.5 text-white text-sm font-semibold"><Icon size={16} className="text-[#A4B0B7]" />{label}</span>
      <button onClick={() => onChange(!value)} className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-[#9333ea]' : 'bg-[#243041]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
