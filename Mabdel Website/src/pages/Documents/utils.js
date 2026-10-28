import { FileCheck2, FileText, ScrollText } from 'lucide-react';
import { formatCalendarDate } from '../../utils/dateUtils';

// ── Shared constants & helpers for the Documents page ───────────────────────
export const tabs = [
  { id: 'leases',     labelKey: 'docs_tab_leases',      icon: ScrollText },
  { id: 'agreements', labelKey: 'docs_tab_agreements',  icon: FileCheck2 },
  { id: 'documents',  labelKey: 'docs_tab_documents',   icon: FileText },
];

export const DOCUMENT_TYPES = ['others', 'agreement', 'invoice', 'lease'];

export const INPUT_CLS = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-sm placeholder:text-[#4A5568]';
export const LABEL_CLS = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

export function normalizeDate(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function extractSigningToken(signatureUrl) {
  const match = String(signatureUrl || '').match(/\/(?:agreements|leases)\/signing\/([^/]+)/);
  return match?.[1] || null;
}

export function getAgreementStatusBadge(status) {
  switch (String(status || '').toLowerCase()) {
    case 'signed':
      return 'bg-emerald-950/40 text-emerald-400';
    case 'pending_signature':
      return 'bg-amber-950/40 text-amber-400';
    case 'expired':
      return 'bg-rose-950/40 text-rose-400';
    case 'cancelled':
      return 'bg-slate-800 text-slate-300';
    default:
      return 'bg-[#243041] text-[#A4B0B7]';
  }
}

export function formatDisplayDate(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return formatCalendarDate(dt);
}

export function formatLeaseMoney(value, currency = 'USD', suffix = '') {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(numeric) + suffix;
}
