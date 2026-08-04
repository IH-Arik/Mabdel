import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FileText, Download, Plus, Search, 
  CheckCircle, Clock, AlertCircle, MoreVertical, 
  ArrowLeft, Check, Trash2, Mic, Send, 
  DollarSign, Mail, MapPin, 
  Activity, Phone, AlertTriangle, 
  Sparkles, Settings, Loader2
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { formatCalendarDate, formatCstDate, formatCstTime } from '../utils/dateUtils';
import VoiceFormFillModal from '../components/Documents/VoiceFormFillModal';
import { DatePickerInput } from '../components/ui/DateTimeInputs';
import { useLanguage } from '../context/LanguageContext';

const DEFAULT_SUMMARY = {
  total_outstanding: 0,
  total_invoices: 0,
  sent_invoices: 0,
  overdue_invoices: 0,
  draft_invoices: 0,
};

const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

const normalizePrefillItems = (items = []) =>
  Array.isArray(items) && items.length
    ? items.map((item) => ({
        description: item?.description || '',
        quantity: Number(item?.quantity ?? 1),
        unit_price: Number(item?.unit_price ?? 0),
      }))
    : [];

const getDueStatusText = (invoice, t) => {
  if (!invoice) return t('inv_no_due_date');

  const normalizedStatus = String(invoice.status || '').toLowerCase();
  if (normalizedStatus === 'paid') return t('inv_status_paid');
  if (normalizedStatus === 'cancelled') return t('inv_status_cancelled');
  if (!invoice.due_date) return t('inv_no_due_date');

  const dueDate = new Date(invoice.due_date);
  if (Number.isNaN(dueDate.getTime())) return t('inv_no_due_date');

  const today = new Date();
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86400000);

  if (diffDays === 0) return t('inv_due_today');
  if (diffDays > 0) return t('inv_due_in_days', { n: diffDays });

  const overdueDays = Math.abs(diffDays);
  return t('inv_days_overdue', { n: overdueDays });
};

export default function Invoices() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [, setError] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [page, setPage] = useState(1);
  
  // viewMode states: 'dashboard', 'create', 'dispatch', 'details'
  const [viewMode, setViewMode] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // Creation form states
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [issueDate, setIssueDate] = useState('2026-06-08');
  const [dueDate, setDueDate] = useState('2026-06-15');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2023-093');
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  const resetForm = useCallback(() => {
    setClientName('');
    setClientEmail('');
    setBillingAddress('');
    setCurrency('USD');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setInvoiceNumber('');
    setTaxRate(0);
    setNotes('');
    setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setEditingInvoiceId(null);
  }, []);

  const hydrateFormFromInvoice = useCallback((invoice) => {
    if (!invoice) return;
    setClientName(invoice.client_name || '');
    setClientEmail(invoice.client_email || '');
    setBillingAddress(invoice.billing_address || '');
    setCurrency(invoice.currency || 'USD');
    setIssueDate(toDateInput(invoice.issue_date) || new Date().toISOString().slice(0, 10));
    setDueDate(toDateInput(invoice.due_date));
    setInvoiceNumber(invoice.invoice_number || '');
    setTaxRate(Number(invoice.tax_rate || 0));
    setNotes(invoice.notes || '');
    setLineItems(
      Array.isArray(invoice.items) && invoice.items.length > 0
        ? invoice.items.map((item) => ({
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
          }))
        : [{ description: '', quantity: 1, unit_price: 0 }],
    );
    setEditingInvoiceId(invoice.id);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (location.state?.prefill) {
      const prefill = location.state.prefill;
      setViewMode('create');
      if (prefill.client_name) setClientName(prefill.client_name);
      if (prefill.client_email) setClientEmail(prefill.client_email);
      if (prefill.amount) {
        setLineItems([{ description: prefill.description || 'Services', quantity: 1, unit_price: Number(prefill.amount) }]);
      } else if (prefill.items && Array.isArray(prefill.items)) {
         setLineItems(prefill.items);
      }
      
      // Clear state so it doesn't trigger on every re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Dispatch details state
  const [deliveryChannels, setDeliveryChannels] = useState({
    email: true,
    sms: false,
    whatsapp: false
  });
  const [dispatching, setDispatching] = useState(false);

  // Details view variables
  const [aiVoiceReminderScheduled, setAiVoiceReminderScheduled] = useState(false);
  const [aiVoiceReminderTime, setAiVoiceReminderTime] = useState('2 days');

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await smartflowApi.getInvoices({
        page,
        page_size: 20,
        search: debouncedSearchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      const backendItems = response.data?.data?.items || [];
      const backendSummary = response.data?.data?.summary || DEFAULT_SUMMARY;
      const backendPagination = response.data?.data?.pagination || { page, page_size: 20, total: backendItems.length };
      setInvoices(backendItems);
      setSummary(backendSummary);
      setPagination(backendPagination);
      setSelectedInvoiceId((current) => {
        if (current && backendItems.some((item) => item.id === current)) return current;
        return backendItems[0]?.id || null;
      });
    } catch (error) {
      console.error('Error fetching invoices from backend:', error);
      setInvoices([]);
      setSummary(DEFAULT_SUMMARY);
      setPagination({ page, page_size: 20, total: 0 });
      setError(t('inv_err_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, page, statusFilter, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const fetchInvoiceDetails = useCallback(async (invoiceId) => {
    if (!invoiceId) {
      setSelectedInvoice(null);
      return;
    }
    try {
      const response = await smartflowApi.getInvoice(invoiceId);
      setSelectedInvoice(response.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch invoice details:', err);
      const fallback = invoices.find((inv) => inv.id === invoiceId) || null;
      setSelectedInvoice(fallback);
    }
  }, [invoices]);

  useEffect(() => {
    setSelectedInvoice(null);
    fetchInvoiceDetails(selectedInvoiceId);
  }, [fetchInvoiceDetails, selectedInvoiceId]);

  // Selected Invoice Object Helper
  const activeInvoice = (() => {
    const baseInvoice = selectedInvoice || invoices.find(inv => inv.id === selectedInvoiceId) || invoices[0] || null;
    if (!baseInvoice) return null;
    return {
      ...baseInvoice,
      items: Array.isArray(baseInvoice.items) ? baseInvoice.items : [],
      timeline: Array.isArray(baseInvoice.timeline) ? baseInvoice.timeline : [],
    };
  })();

  // Calculated Stats
  const outstandingSum = Number(summary.total_outstanding || 0);
  const sentCount = Number(summary.sent_invoices || 0);
  const overdueCount = Number(summary.overdue_invoices || 0);

  // Add line item trigger
  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  // Remove line item trigger
  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Change line item properties
  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  // Calculate Subtotal / Tax / Total
  const calculateFormSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price || 0), 0);
  };

  const calculateFormTax = () => {
    return (calculateFormSubtotal() * (taxRate / 100)) || 0;
  };

  const calculateFormTotal = () => {
    return calculateFormSubtotal() + calculateFormTax();
  };

  const applyVoicePrefill = useCallback((prefill = {}) => {
    if (prefill.client_name) setClientName(prefill.client_name);
    if (prefill.client_email) setClientEmail(prefill.client_email);
    if (prefill.billing_address) setBillingAddress(prefill.billing_address);
    if (prefill.due_date) setDueDate(toDateInput(prefill.due_date));
    if (prefill.issue_date) setIssueDate(toDateInput(prefill.issue_date));
    if (prefill.invoice_number) setInvoiceNumber(prefill.invoice_number);
    if (prefill.tax_rate !== undefined && prefill.tax_rate !== null) {
      setTaxRate(Number(prefill.tax_rate) || 0);
    }
    if (prefill.notes) setNotes(prefill.notes);

    if (Array.isArray(prefill.items) && prefill.items.length) {
      setLineItems(normalizePrefillItems(prefill.items));
      return;
    }

    if (prefill.total_amount) {
      setLineItems([{
        description: prefill.notes || 'AI Prefilled Work',
        quantity: 1,
        unit_price: Number(prefill.total_amount) || 0,
      }]);
    }
  }, []);

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (savingInvoice) return;
    if (!clientName.trim()) {
      alert(t('inv_err_client_name_required'));
      return;
    }
    if (!issueDate || !dueDate) {
      alert(t('inv_err_dates_required'));
      return;
    }
    if (new Date(dueDate) < new Date(issueDate)) {
      alert(t('inv_err_due_date_invalid'));
      return;
    }
    if (!lineItems.length || lineItems.some((item) => !item.description?.trim() || Number(item.quantity) <= 0 || Number(item.unit_price) < 0)) {
      alert(t('inv_err_items_invalid'));
      return;
    }

    const payload = {
      client_name: clientName.trim(),
      client_email: clientEmail || undefined,
      billing_address: billingAddress || undefined,
      currency,
      issue_date: issueDate,
      due_date: dueDate,
      tax_rate: taxRate,
      notes: notes || undefined,
      items: lineItems.map(item => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    };

    try {
      setSavingInvoice(true);
      setError('');
      const res = editingInvoiceId
        ? await smartflowApi.updateInvoice(editingInvoiceId, payload)
        : await smartflowApi.createInvoice(payload);
      const saved = res.data?.data;
      if (saved?.id) {
        setSelectedInvoiceId(saved.id);
        await fetchInvoices();
        await fetchInvoiceDetails(saved.id);
      }
      setViewMode('dashboard');
    } catch (err) {
      console.error('Error saving invoice to backend:', err);
      setError(err?.response?.data?.message || err?.response?.data?.detail || t('inv_err_save_failed'));
      alert(err?.response?.data?.message || t('inv_err_save_failed'));
    } finally {
      setSavingInvoice(false);
    }
  };

  // Perform Final Dispatching trigger
  const handleDispatchInvoice = async () => {
    if (!activeInvoice?.id) return;
    setDispatching(true);
    
    // Choose channel
    const channelsUsed = Object.entries(deliveryChannels)
      .filter(([, val]) => val)
      .map(([key]) => key);

    const channelPayload = channelsUsed[0] || 'email';

    try {
      await smartflowApi.sendInvoice(activeInvoice.id, {
        recipient_email: activeInvoice.client_email || undefined,
        message: t('inv_msg_review_due', { number: activeInvoice.invoice_number, date: activeInvoice.due_date }),
        channel: channelPayload
      });
    } catch (err) {
      console.error('Dispatch API failed:', err);
      alert(err?.response?.data?.message || t('inv_err_send_failed'));
      setDispatching(false);
      return;
    }
    await fetchInvoices();
    await fetchInvoiceDetails(activeInvoice.id);
    setDispatching(false);
    setViewMode('dashboard');
  };

  // Handle Mark Paid
  const handleMarkPaid = async () => {
    if (!activeInvoice?.id) return;
    try {
      await smartflowApi.updateInvoiceStatus(activeInvoice.id, { status: 'paid' });
    } catch (err) {
      console.error('Mark paid API failed:', err);
      alert(err?.response?.data?.message || t('inv_err_update_status_failed'));
      return;
    }
    await fetchInvoices();
    await fetchInvoiceDetails(activeInvoice.id);
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = async (id) => {
    try {
      await smartflowApi.deleteInvoice(id);
    } catch (err) {
      console.error('Delete API failed:', err);
      alert(err?.response?.data?.message || t('inv_err_delete_failed'));
      return;
    }
    await fetchInvoices();
    setSelectedInvoice(null);
    setViewMode('dashboard');
  };

  // PDF download trigger
  const handleDownloadPDF = async (inv) => {
    try {
      const response = await smartflowApi.downloadInvoice(inv.id);
      const blob = response?.data instanceof Blob
        ? response.data
        : new Blob([response?.data], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(blob);
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert(err?.response?.data?.message || err?.message || t('inv_err_pdf_failed'));
    }
  };

  // Schedule Voice Reminder Simulation
  const handleScheduleVoiceReminder = async () => {
    try {
      await smartflowApi.sendInvoiceReminder(activeInvoice.id, {
        recipient_email: activeInvoice.client_email || undefined,
        channel: 'email',
        message: t('inv_reminder_req')
      });
    } catch (err) {
      console.error('Reminder request API failed:', err);
    }
    setAiVoiceReminderScheduled(true);
    setTimeout(() => {
      setAiVoiceReminderScheduled(false);
      alert(t('inv_msg_reminder_scheduled', { time: aiVoiceReminderTime, name: activeInvoice.client_name }));
    }, 1200);
  };

  // Format Status Badge Styles
  const getStatusBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'overdue':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      case 'sent':
      case 'viewed':
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
      case 'draft':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  // Filter logic
  const filteredInvoices = invoices;

  return (
    <div className="h-full flex flex-col space-y-6">

      {/* =========================================================================
          VIEW MODE: INVOICES MAIN DASHBOARD
          ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="h-full flex flex-col space-y-6">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('inv_title')}</h1>
              <p className="text-slate-400 text-sm mt-1">
                {t('inv_subtitle')}
              </p>
            </div>
            
            <button 
              onClick={() => {
                resetForm();
                setViewMode('create');
              }}
              className="px-5 py-3 bg-purple-400 hover:bg-purple-300 text-[#070a13] hover:shadow-purple-400/10 rounded-xl text-xs font-extrabold shadow-lg shadow-purple-500/5 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
            >
              <Plus size={16} />
              <span>{t('inv_btn_new_invoice')}</span>
            </button>
          </div>

          {/* Stats Summary cards row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Outstanding */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('inv_stat_outstanding')}</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-purple-400 border border-slate-900">
                  <DollarSign size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  ${outstandingSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-2">
                  <Activity size={10} /> {t('inv_stat_from_last_month')}
                </span>
              </div>
            </div>

            {/* Sent */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('inv_stat_sent')}</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-purple-400 border border-slate-900">
                  <Send size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">{sentCount}</p>
                <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-2">
                  <Clock size={10} /> {t('inv_stat_awaiting_payment')}
                </span>
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{t('inv_stat_overdue')}</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-rose-400 border border-slate-900">
                  <AlertCircle size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">{overdueCount}</p>
                <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-2">
                  <AlertTriangle size={10} /> {t('inv_stat_requires_action')}
                </span>
              </div>
            </div>
          </div>

          {/* Split Dashboard Row */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            
            {/* Left table pane */}
            <div className="lg:col-span-8 flex flex-col space-y-4 min-h-0">
              
              {/* Toolbar filters */}
              <div className="bg-[#0c101b]/60 border border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text" 
                    placeholder={t('inv_ph_search')} 
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/40 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {['all', 'draft', 'sent', 'overdue', 'paid'].map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border capitalize cursor-pointer ${
                        statusFilter === status 
                          ? 'bg-purple-950/40 text-purple-400 border-purple-500/35' 
                          : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      {status === 'all' ? t('inv_filter_all') : status === 'draft' ? t('inv_filter_draft') : status === 'sent' ? t('inv_filter_sent') : status === 'overdue' ? t('inv_filter_overdue') : t('inv_filter_paid')}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-900/60 bg-slate-950/30 px-6 py-3 text-xs text-slate-500">
                  <span>
                    {t('inv_showing_count', { count: filteredInvoices.length, total: pagination.total || 0 })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="rounded-lg border border-slate-800 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('inv_btn_prev')}
                    </button>
                    <span>{t('inv_page_n', { page: pagination.page || page })}</span>
                    <button
                      type="button"
                      disabled={(pagination.page || page) * (pagination.page_size || 20) >= (pagination.total || 0)}
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-lg border border-slate-800 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('inv_btn_next')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Table list view */}
              <div className="flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl overflow-hidden min-h-[300px] flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-900/60 bg-slate-950/40 text-slate-400 text-xs font-bold tracking-wider">
                        <th className="px-6 py-4">{t('inv_th_client_id')}</th>
                        <th className="px-6 py-4">{t('inv_th_amount')}</th>
                        <th className="px-6 py-4">{t('inv_th_due_date')}</th>
                        <th className="px-6 py-4">{t('inv_th_status')}</th>
                        <th className="px-6 py-4 text-right">{t('inv_th_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/50">
                      {loading ? (
                        Array(3).fill(0).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="px-6 py-4"><div className="h-4 bg-slate-900 rounded w-32" /></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-900 rounded w-16" /></td>
                            <td className="px-6 py-4"><div className="h-4 bg-slate-900 rounded w-20" /></td>
                            <td className="px-6 py-4"><div className="h-6 bg-slate-900 rounded-full w-16" /></td>
                            <td className="px-6 py-4 text-right"><div className="h-8 bg-slate-900 rounded w-8 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredInvoices.length > 0 ? (
                        filteredInvoices.map((inv) => (
                          <tr 
                            key={inv.id} 
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className={`hover:bg-slate-950/50 transition-colors cursor-pointer group ${
                              selectedInvoiceId === inv.id ? 'bg-slate-950/30' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{inv.client_name}</p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{inv.invoice_number}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-300">
                              ${inv.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-semibold">
                              {formatCalendarDate(inv.due_date)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border capitalize ${getStatusBadgeStyle(inv.status)}`}>
                                {inv.status === 'draft' ? t('inv_filter_draft') : inv.status === 'sent' ? t('inv_filter_sent') : inv.status === 'overdue' ? t('inv_filter_overdue') : inv.status === 'paid' ? t('inv_filter_paid') : inv.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleDownloadPDF(inv)}
                                  className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                                  title={t('inv_btn_download_pdf')}
                                >
                                  <Download size={13} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setSelectedInvoiceId(inv.id);
                                    if (inv.status === 'draft') {
                                      setViewMode('dispatch');
                                    } else {
                                      setViewMode('details');
                                    }
                                  }}
                                  className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                                  title={t('inv_btn_view_details')}
                                >
                                  <MoreVertical size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-20 text-center">
                            <div className="w-12 h-12 bg-slate-950 border border-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                              <FileText size={24} />
                            </div>
                            <h3 className="text-sm font-bold text-white">{t('inv_no_invoices_found')}</h3>
                            <p className="text-xs text-slate-500 mt-1">{t('inv_try_changing_filter')}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Quick Preview column */}
            <div className="lg:col-span-4 text-left">
              {activeInvoice ? (
                <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 h-full flex flex-col justify-between relative overflow-hidden group hover:shadow-[0_0_35px_rgba(6,182,212,0.02)] transition-all">
                  
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
                      <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">{t('inv_details_title')}</span>
                      <span className="px-2.5 py-0.5 bg-purple-950/80 border border-purple-500/20 text-purple-400 text-[9px] font-bold rounded-full uppercase tracking-wider">
                        {t('inv_preview')}
                      </span>
                    </div>

                    {/* Summary Overview box */}
                    <div className="p-5 bg-slate-950/40 border border-slate-900 rounded-2xl space-y-4">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-extrabold text-white leading-tight">{activeInvoice.client_name}</h3>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border capitalize tracking-wider ${getStatusBadgeStyle(activeInvoice.status)}`}>
                            {activeInvoice.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                          {activeInvoice.invoice_number} • Due: {formatCalendarDate(activeInvoice.due_date, { year: undefined })}
                        </p>
                      </div>

                      <div className="border-t border-slate-900/60 pt-3 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-bold">{t('inv_lbl_total_amount')}</span>
                        <span className="text-2xl font-extrabold text-purple-400 tracking-tight">
                          ${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Line Items snippet details */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('inv_lbl_line_items')}</h4>
                      <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                        {activeInvoice.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-950/20 border border-slate-900/60 rounded-xl">
                            <div className="min-w-0 pr-2">
                              <p className="text-slate-300 font-bold truncate">{item.description}</p>
                              <p className="text-[9px] text-slate-500 font-semibold mt-0.5">{t('inv_lbl_qty', { n: item.quantity })}</p>
                            </div>
                            <span className="text-white font-bold">${item.line_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action button triggers */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => handleDownloadPDF(activeInvoice)}
                        className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Download size={12} /> {t('inv_btn_download_pdf')}
                      </button>
                      
                      {activeInvoice.status === 'draft' ? (
                        <button 
                          onClick={() => setViewMode('dispatch')}
                          className="py-2.5 bg-purple-400 hover:bg-purple-300 text-[#070a13] hover:shadow-purple-400/10 rounded-xl text-xs font-bold shadow-md shadow-purple-500/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {t('inv_btn_send_invoice')}
                        </button>
                      ) : activeInvoice.status !== 'paid' ? (
                        <button 
                          onClick={handleMarkPaid}
                          className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#070a13] hover:shadow-emerald-500/10 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check size={12} /> {t('inv_btn_mark_paid')}
                        </button>
                      ) : (
                        <div className="py-2.5 border border-dashed border-emerald-500/20 text-emerald-400/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                          <CheckCircle size={12} /> {t('inv_lbl_fully_paid')}
                        </div>
                      )}
                    </div>

                    {/* AI Suggestions Box */}
                    {activeInvoice.status !== 'paid' && (
                      <div className="border-t border-slate-900/60 pt-5 space-y-3.5">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles size={12} className="fill-current" /> {t('inv_ai_suggestions')}
                        </span>
                        
                        <div className="space-y-2.5">
                          <div 
                            onClick={handleScheduleVoiceReminder}
                            className="p-3 bg-slate-950/40 border border-slate-900 hover:border-slate-800 rounded-xl flex items-start gap-2.5 cursor-pointer transition-all"
                          >
                            <div className="p-1.5 bg-purple-950/80 border border-purple-500/20 text-purple-400 rounded-lg mt-0.5">
                              <Mail size={12} />
                            </div>
                            <div className="text-left leading-normal">
                              <p className="text-xs text-white font-bold">{t('inv_send_reminder')}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{t('inv_draft_followup_hint')}</p>
                            </div>
                          </div>

                          <div 
                            onClick={() => {
                              setSelectedInvoiceId(activeInvoice.id);
                              setViewMode('details');
                            }}
                            className="p-3 bg-slate-950/40 border border-slate-900 hover:border-slate-800 rounded-xl flex items-start gap-2.5 cursor-pointer transition-all"
                          >
                            <div className="p-1.5 bg-slate-950 border border-slate-900 text-slate-500 rounded-lg mt-0.5">
                              <Phone size={12} />
                            </div>
                            <div className="text-left leading-normal">
                              <p className="text-xs text-white font-bold">{t('inv_generate_followup')}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{t('inv_schedule_seq_hint')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Settings redirect link */}
                  <div className="mt-8 pt-4 border-t border-slate-900/60 flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setSelectedInvoiceId(activeInvoice.id);
                        if (activeInvoice.status === 'draft') {
                          setViewMode('dispatch');
                        } else {
                          setViewMode('details');
                        }
                      }}
                      className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {t('inv_view_timeline_logs')}
                    </button>
                    <button 
                      onClick={() => handleDeleteInvoice(activeInvoice.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      title={t('inv_btn_delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full border border-slate-900 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <FileText size={24} className="text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">{t('inv_select_an_invoice')}</p>
                  <p className="text-xs text-slate-600 mt-1">{t('inv_select_invoice_hint')}</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: CREATE INVOICE
          ========================================================================= */}
      {viewMode === 'create' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Pane: Left details form */}
          <div className="lg:col-span-8 flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setViewMode('dashboard')}
                    className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-white">{t('inv_create_title')}</h1>
                    <p className="text-slate-500 text-xs mt-0.5">{t('inv_create_subtitle')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSaveDraft}
                    disabled={savingInvoice}
                    className="px-4 py-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {savingInvoice ? t('inv_saving') : editingInvoiceId ? t('inv_btn_save_changes') : t('inv_btn_save_draft')}
                  </button>
                  <button 
                    onClick={handleSaveDraft}
                    disabled={savingInvoice}
                    className="px-4 py-2 bg-purple-400 hover:bg-purple-300 text-[#070a13] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    {editingInvoiceId ? t('inv_btn_update_invoice') : t('inv_btn_create_invoice')}
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-[#070a13] border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-900 text-purple-400 flex items-center justify-center flex-shrink-0">
                    <Mic size={20} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-white font-bold">{t('inv_voice_fill_title')}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold leading-relaxed">
                      {t('inv_voice_fill_subtitle')}
                    </p>
                  </div>
                </div>
                <VoiceFormFillModal
                  workflowIntent="invoice"
                  label="Invoice"
                  currentValues={{
                    client_name: clientName,
                    client_email: clientEmail,
                    due_date: dueDate,
                    billing_address: billingAddress,
                    issue_date: issueDate,
                    invoice_number: invoiceNumber,
                    tax_rate: taxRate,
                    notes,
                    items: lineItems,
                  }}
                  onApply={applyVoicePrefill}
                  buttonClassName="px-4 py-2 bg-purple-400 hover:bg-purple-300 text-[#070a13] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
                >
                  <Mic size={16} />
                  {t('inv_btn_start_voice_fill')}
                </VoiceFormFillModal>
              </div>

              {/* Invoice Form fields */}
              <div className="space-y-6 mt-6">
                <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase">{t('inv_details_title')}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Issue Date */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_issue_date')}</label>
                    <DatePickerInput
                      value={issueDate}
                      onChange={setIssueDate}
                      className="py-2.5 bg-slate-950 border-slate-900 text-xs focus:border-purple-500/40"
                    />
                  </div>

                  {/* Client Name */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_client_name')}</label>
                    <input 
                      type="text" 
                      placeholder={t('inv_ph_client_name')}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  {/* Client Email */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_client_email')}</label>
                    <input 
                      type="email" 
                      placeholder="client@example.com"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_due_date')}</label>
                    <DatePickerInput
                      value={dueDate}
                      onChange={setDueDate}
                      className="py-2.5 bg-slate-950 border-slate-900 text-xs focus:border-purple-500/40"
                    />
                  </div>

                  {/* Invoice Number */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_invoice_number')}</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-slate-400"
                      value={invoiceNumber}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_billing_address')}</label>
                    <input 
                      type="text" 
                      placeholder="123 Business St, City, Country"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_tax_rate')}</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_notes')}</label>
                  <textarea
                    rows={3}
                    placeholder={t('inv_ph_notes')}
                    className="w-full resize-none px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Line Items Editor list */}
                <div className="space-y-3 text-left pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">{t('inv_lbl_line_items')}</label>
                    <button 
                      type="button"
                      onClick={addLineItem}
                      className="text-[10px] font-bold text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {t('inv_btn_add_item')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                        <input 
                          type="text" 
                          placeholder={t('inv_ph_item_desc')}
                          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            placeholder={t('inv_ph_qty')}
                            className="w-16 px-3 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white text-center placeholder:text-gray-700"
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                          <input 
                            type="number" 
                            placeholder={t('inv_ph_price')}
                            className="w-24 px-3 py-2.5 bg-slate-950 border border-slate-900 focus:border-purple-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white text-center placeholder:text-gray-700"
                            value={item.unit_price || ''}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                          <span className="w-24 text-right text-xs font-bold text-slate-300 px-2">
                            ${(item.quantity * item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <button 
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="p-2.5 hover:bg-slate-950 border border-transparent hover:border-slate-900 text-slate-600 hover:text-red-400 rounded-xl transition-all"
                            title={t('inv_btn_delete_item')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing Summary calculation panel */}
                <div className="border-t border-slate-900/60 pt-4 flex flex-col items-end space-y-2 text-right">
                  <div className="flex justify-between w-64 text-xs font-bold text-slate-500">
                    <span>{t('inv_lbl_subtotal')}</span>
                    <span className="text-slate-300">${calculateFormSubtotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-64 text-xs font-bold text-slate-500 items-center">
                    <span className="flex items-center gap-1.5">{t('inv_lbl_tax_pct', { rate: taxRate })}</span>
                    <span className="text-slate-300">${calculateFormTax().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-64 border-t border-slate-900/60 pt-2 text-sm font-extrabold text-white">
                    <span className="text-purple-400">{t('inv_lbl_total')}</span>
                    <span className="text-purple-400">${calculateFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Sidebar: AI Intelligence & Live Preview */}
          <div className="lg:col-span-4 w-full lg:w-[420px] flex flex-col justify-between space-y-6">
            
            {/* Live extraction helper info */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-5 text-left space-y-3.5">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="fill-current animate-pulse" /> {t('inv_live_extraction')}
              </span>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                {t('inv_live_extraction_hint')}
              </p>
            </div>

            {/* LIVE PREVIEW DOCUMENT */}
            <div className="flex-1 bg-white rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative min-h-[400px] text-[#070a13] border-4 border-purple-500/30">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest absolute top-6 right-6">{t('inv_live_preview')}</span>
              
              <div className="space-y-6 text-left">
                {/* Header branding */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#070a13]">{t('inv_doc_invoice')}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{invoiceNumber}</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 leading-relaxed font-semibold">
                    <p className="font-extrabold text-slate-800">SmartFlow Agency</p>
                    <p>123 Cyber Way</p>
                    <p>Neo SF, CA 94105</p>
                  </div>
                </div>

                {/* Billed Client information */}
                <div className="border-t border-slate-100 pt-4">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t('inv_lbl_bill_to')}</span>
                  <p className="text-sm font-extrabold text-[#070a13] mt-1">{clientName || 'Client Name Placeholder'}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{clientEmail || 'client@example.com'}</p>
                </div>

                {/* Description lines items */}
                <div className="pt-2">
                  <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                    <div className="col-span-6">{t('inv_th_description')}</div>
                    <div className="col-span-2 text-center">{t('inv_lbl_qty', { n: '' }).replace(/:|\s/g, '')}</div>
                    <div className="col-span-2 text-right">{t('inv_ph_price')}</div>
                    <div className="col-span-2 text-right">{t('inv_th_amount')}</div>
                  </div>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 text-[10px] font-bold text-slate-800">
                        <div className="col-span-6 truncate pr-1">{item.description || 'Item Description'}</div>
                        <div className="col-span-2 text-center text-slate-500">{item.quantity}</div>
                        <div className="col-span-2 text-right text-slate-500">${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                        <div className="col-span-2 text-right">${(item.quantity * item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Total USD Summary block */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline text-left">
                <span className="text-xs font-bold text-slate-400">{t('inv_lbl_total')}</span>
                <span className="text-2xl font-extrabold text-[#070a13] tracking-tight">
                  USD ${calculateFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: DISPATCH INVOICE
          ========================================================================= */}
      {viewMode === 'dispatch' && activeInvoice && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Pane: Left White paper Invoice view */}
          <div className="lg:col-span-8 flex-1 bg-slate-950 border border-slate-900 rounded-3xl p-6 flex flex-col overflow-y-auto justify-center items-center">
            
            {/* White invoice preview sheet */}
            <div className="w-full max-w-[620px] bg-white rounded-3xl p-8 shadow-2xl text-[#070a13] space-y-8 min-h-[580px] flex flex-col justify-between border-4 border-purple-500/10">
              <div className="space-y-6">
                
                {/* Brand Logo header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#070a13] flex items-center justify-center border border-slate-900 text-purple-400">
                      <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M17 5v14M22 8v8M7 8v8M2 10v4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-1">
                        SmartFlow <span className="text-purple-600">Inc.</span>
                      </h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider -mt-0.5">billing@smartflow.ai</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-400">{t('inv_doc_invoice')}</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">{t('inv_lbl_invoice_no_colon')} {activeInvoice.invoice_number}</p>
                  </div>
                </div>

                {/* Company details row */}
                <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 pt-2 leading-relaxed font-semibold">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{t('inv_lbl_from')}</span>
                    <p className="font-extrabold text-slate-800">SmartFlow Inc.</p>
                    <p>482 Cyber Avenue</p>
                    <p>Neo-Tokyo, NT 100-0001</p>
                  </div>
                  <div className="text-right">
                    <p><span className="font-bold">{t('inv_lbl_date_of_issue')}</span> {formatCalendarDate(activeInvoice.issue_date)}</p>
                    <p><span className="font-bold">{t('inv_lbl_due_date_colon')}</span> {formatCalendarDate(activeInvoice.due_date)}</p>
                  </div>
                </div>

                {/* Bill to metadata */}
                <div className="p-4 bg-slate-50 rounded-2xl text-[10px] text-slate-500 leading-relaxed font-semibold">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{t('inv_lbl_bill_to')}</span>
                  <p className="text-xs font-extrabold text-slate-800 mt-1">{activeInvoice.client_name}</p>
                  {activeInvoice.billing_address && <p className="mt-0.5">{activeInvoice.billing_address}</p>}
                  {activeInvoice.client_email && <p>{activeInvoice.client_email}</p>}
                </div>

                {/* Line Items table */}
                <div className="pt-2">
                  <div className="grid grid-cols-12 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                    <div className="col-span-6">{t('inv_th_description')}</div>
                    <div className="col-span-2 text-center">{t('inv_lbl_qty', { n: '' }).replace(/:|\s/g, '')}</div>
                    <div className="col-span-2 text-right">{t('inv_th_rate')}</div>
                    <div className="col-span-2 text-right">{t('inv_th_amount')}</div>
                  </div>

                  <div className="space-y-2">
                    {activeInvoice.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 text-[10px] font-bold text-slate-800">
                        <div className="col-span-6 truncate pr-1">{item.description}</div>
                        <div className="col-span-2 text-center text-slate-500">{item.quantity}</div>
                        <div className="col-span-2 text-right text-slate-500">${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <div className="col-span-2 text-right">${item.line_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Total USD footer card */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex flex-col items-end space-y-1 text-right text-[10px] text-slate-500 font-semibold">
                  <div className="flex justify-between w-48">
                    <span>{t('inv_lbl_subtotal')}</span>
                    <span>${activeInvoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {activeInvoice.tax_amount > 0 && (
                    <div className="flex justify-between w-48">
                      <span>{t('inv_lbl_tax_pct', { rate: activeInvoice.tax_rate })}</span>
                      <span>${activeInvoice.tax_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-48 border-t border-slate-100 pt-1 text-xs font-extrabold text-[#070a13]">
                    <span>{t('inv_lbl_total_due')}</span>
                    <span className="text-purple-600">${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="text-[7px] text-slate-400 text-center font-medium leading-normal border-t border-slate-50 pt-3">
                  {t('inv_payment_due_terms')}<br />
                  {t('inv_bank_details')}
                </div>
              </div>
            </div>

          </div>

          {/* Right Sidebar Column: Dispatch Actions & send list */}
          <div className="lg:col-span-4 w-full lg:w-80 flex flex-col justify-between space-y-6">
            
            {/* Header back button */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-6 flex-1 flex flex-col justify-between">
              
              <div className="space-y-6 w-full">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-900/60">
                  <button 
                    onClick={() => setViewMode('create')}
                    className="p-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">{t('inv_dispatch_setup')}</span>
                </div>

                {/* Static document details metadata */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('inv_document_actions')}</h4>
                  
                  <div className="space-y-2">
                    <button 
                      onClick={() => handleDownloadPDF(activeInvoice)}
                      className="w-full p-3 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl flex items-center justify-between text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><FileText size={14} className="text-purple-400" /> {t('inv_btn_download_pdf')}</span>
                      <span className="text-[10px] text-slate-500">245 KB</span>
                    </button>
                    
                    <button 
                      className="w-full p-3 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl flex items-center justify-between text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><Phone size={14} className="text-purple-400" /> {t('inv_share_voice_brief')}</span>
                      <span className="text-slate-500">›</span>
                    </button>
                  </div>
                </div>

                {/* Delivery Channels Select Options */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('inv_send_to_client')}</h4>
                  <p className="text-[10px] text-slate-500 font-semibold leading-normal">{t('inv_select_channels_for', { name: activeInvoice.client_name })}</p>
                  
                  <div className="space-y-2.5">
                    {/* Secure Email Link */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, email: !deliveryChannels.email})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.email 
                          ? 'bg-purple-950/20 border-purple-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.email ? 'border-purple-500 bg-purple-950 text-purple-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.email && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">{t('inv_secure_email_link')}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">{activeInvoice.client_email || 'client@example.com'}</p>
                      </div>
                    </div>

                    {/* SMS Notification */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, sms: !deliveryChannels.sms})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.sms 
                          ? 'bg-purple-950/20 border-purple-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.sms ? 'border-purple-500 bg-purple-950 text-purple-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.sms && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">{t('inv_sms_notification')}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">+1 (555) 019-2834</p>
                      </div>
                    </div>

                    {/* WhatsApp Business */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, whatsapp: !deliveryChannels.whatsapp})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.whatsapp 
                          ? 'bg-purple-950/20 border-purple-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.whatsapp ? 'border-purple-500 bg-purple-950 text-purple-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.whatsapp && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">{t('inv_whatsapp_business')}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">{t('inv_verified_account_thread')}</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* DISPATCH INVOICE button */}
              <button 
                onClick={handleDispatchInvoice}
                disabled={dispatching || !Object.values(deliveryChannels).some(Boolean)}
                className="w-full py-4 mt-6 bg-purple-400 hover:bg-purple-300 text-[#070a13] hover:shadow-purple-400/20 rounded-xl font-bold shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dispatching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t('inv_dispatching')}</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>{t('inv_btn_dispatch_invoice')}</span>
                  </>
                )}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: TIMELINE DETAILS REVIEW
          ========================================================================= */}
      {viewMode === 'details' && activeInvoice && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Pane: Left progress review timeline */}
          <div className="lg:col-span-8 flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col space-y-6 overflow-y-auto">
            
            {/* Header back navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/60">
              <button 
                onClick={() => setViewMode('dashboard')}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>{t('inv_btn_back_to_invoices')}</span>
              </button>
              <h2 className="text-sm font-bold text-slate-500 tracking-widest uppercase">{t('inv_details_title')}</h2>
            </div>

            {/* Invoice Top overview details banner */}
            <div className="p-5 bg-slate-950/40 border border-slate-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-white tracking-tight">{activeInvoice.invoice_number}</h3>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold border capitalize tracking-wider ${getStatusBadgeStyle(activeInvoice.status)}`}>
                    {activeInvoice.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  {t('inv_billed_to_status', { client: activeInvoice.client_name, status: getDueStatusText(activeInvoice, t) })}
                </p>
              </div>
              <div className="text-left md:text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('inv_total_amount_due')}</span>
                <p className="text-2xl font-extrabold text-purple-400 tracking-tight mt-0.5">
                  ${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* PROGRESS TIMELINE */}
            <div className="p-6 bg-slate-950/20 border border-slate-900 rounded-2xl space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('inv_progress_timeline')}</h4>
              
              <div className="relative pt-4 pb-2 px-8 flex justify-between items-center w-full">
                {/* Horizontal progress bar track */}
                <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 z-0">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500" 
                    style={{ 
                      width: activeInvoice.status === 'paid' ? '100%' 
                           : activeInvoice.status === 'viewed' ? '66%'
                           : activeInvoice.status === 'sent' || activeInvoice.status === 'overdue' ? '33%' 
                           : '0%' 
                    }} 
                  />
                </div>

                {/* Steps markers */}
                {[
                  { name: t('inv_step_created'), done: true },
                  { name: t('inv_step_sent'), done: ['sent', 'viewed', 'paid', 'overdue'].includes(activeInvoice.status) },
                  { name: t('inv_step_viewed'), done: ['viewed', 'paid'].includes(activeInvoice.status) },
                  { name: t('inv_step_paid'), done: activeInvoice.status === 'paid' }
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center space-y-2 relative z-10">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      step.done 
                        ? 'bg-purple-500 border-purple-400 text-[#070a13]' 
                        : 'bg-slate-950 border-slate-850 text-slate-600'
                    }`}>
                      {step.done ? <Check size={12} strokeWidth={3} /> : <span className="w-1.5 h-1.5 bg-slate-700 rounded-full" />}
                    </div>
                    <span className={`text-[10px] font-bold tracking-wide ${step.done ? 'text-white' : 'text-slate-500'}`}>
                      {step.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions quick row */}
            <div className="flex flex-wrap items-center gap-3">
              {activeInvoice.status !== 'paid' && activeInvoice.status !== 'cancelled' ? (
                <button 
                  onClick={() => {
                    hydrateFormFromInvoice(activeInvoice);
                    setViewMode('create');
                  }}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings size={13} /> {t('inv_btn_edit_invoice')}
                </button>
              ) : null}
              <button 
                onClick={() => handleDownloadPDF(activeInvoice)}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} /> {t('inv_btn_view_pdf')}
              </button>
              <button 
                onClick={handleScheduleVoiceReminder}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Phone size={13} /> {t('inv_share_voice')}
              </button>
              <button 
                onClick={() => handleDeleteInvoice(activeInvoice.id)}
                className="px-4 py-2.5 bg-transparent border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/5 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} /> {t('inv_btn_delete')}
              </button>
            </div>

            {/* Detailed Line Items table list */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('inv_lbl_line_items')}</h4>
              
              <div className="bg-[#070a13] border border-slate-900 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-left text-xs font-semibold">
                  <thead>
                    <tr className="border-b border-slate-900/60 bg-slate-950/30 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3.5 col-span-6">{t('inv_th_description')}</th>
                      <th className="px-5 py-3.5 text-center">{t('inv_lbl_qty', { n: '' }).replace(/:|\s/g, '')}</th>
                      <th className="px-5 py-3.5 text-right">{t('inv_ph_price')}</th>
                      <th className="px-5 py-3.5 text-right">{t('inv_lbl_total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {activeInvoice.items.map((item) => (
                      <tr key={item.id} className="text-slate-350">
                        <td className="px-5 py-3.5 text-white font-bold">{item.description}</td>
                        <td className="px-5 py-3.5 text-center text-slate-500">{item.quantity}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">${item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3.5 text-right text-white font-bold">${item.line_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* visual analytics loading placeholder */}
            <div className="border border-slate-900 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <Loader2 className="animate-spin text-purple-400" size={20} />
              <p className="text-xs font-semibold text-slate-400">{t('inv_analytics_generating')}</p>
            </div>

          </div>

          {/* Right Sidebar: AI Intelligence, Identity profile & Activity Log */}
          <div className="lg:col-span-4 w-full lg:w-80 space-y-6">
            
            {/* AI Intelligence scheduler */}
            {activeInvoice.status !== 'paid' && (
              <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={12} className="fill-current animate-pulse" /> {t('inv_ai_intelligence')}
                </span>
                
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  {t('inv_ai_delay_warning', { client: activeInvoice.client_name, time: aiVoiceReminderTime })}
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{t('inv_lbl_schedule')}</span>
                  <select 
                    className="flex-1 bg-slate-950 border border-slate-900 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500/40"
                    value={aiVoiceReminderTime}
                    onChange={(e) => setAiVoiceReminderTime(e.target.value)}
                  >
                    <option value="1 day">{t('inv_opt_1_day')}</option>
                    <option value="2 days">{t('inv_opt_2_days')}</option>
                    <option value="5 days">{t('inv_opt_5_days')}</option>
                    <option value="1 week">{t('inv_opt_1_week')}</option>
                  </select>
                </div>

                <button 
                  onClick={handleScheduleVoiceReminder}
                  disabled={aiVoiceReminderScheduled}
                  className="w-full py-2.5 bg-transparent border border-purple-500/35 hover:bg-purple-950/20 text-purple-400 text-xs font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {aiVoiceReminderScheduled ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
                  <span>{t('inv_btn_schedule_voice_reminder')}</span>
                </button>
              </div>
            )}

            {/* Client Identity details metadata card */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">{t('inv_client_identity')}</h4>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center text-sm font-extrabold text-purple-400 shadow-md">
                    {activeInvoice.client_name[0] || 'C'}
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-white">{activeInvoice.client_name}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{activeInvoice.client_category || 'Enterprise Tech Client'}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-slate-400 text-[10px] font-semibold">
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-slate-500 flex-shrink-0" />
                    <span className="truncate">{activeInvoice.client_email || 'billing@acmecorp.com'}</span>
                  </div>
                  {activeInvoice.billing_address && (
                    <div className="flex items-start gap-2 leading-relaxed">
                      <MapPin size={12} className="text-slate-500 flex-shrink-0 mt-0.5" />
                      <span>{activeInvoice.billing_address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Log events timeline */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4 max-h-[300px] overflow-y-auto">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">{t('inv_activity_log')}</h4>
              
              <div className="relative pl-4 border-l border-slate-800 space-y-5">
                {activeInvoice.timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative space-y-1">
                    {/* Node point */}
                    <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 border border-[#070a13] shadow-md shadow-purple-500/20" />
                    
                    <h6 className="text-[10px] font-extrabold text-white leading-tight">{event.title}</h6>
                    {event.description && <p className="text-[9px] text-slate-500 leading-normal font-semibold">{event.description}</p>}
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wider block pt-0.5">
                      {formatCstDate(event.created_at, { year: undefined })} • {formatCstTime(event.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
