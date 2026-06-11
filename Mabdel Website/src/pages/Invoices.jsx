import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  FileText, Download, Plus, Search, Filter, 
  CheckCircle, Clock, AlertCircle, MoreVertical, 
  ArrowLeft, Check, Trash2, Mic, MicOff, Send, 
  Calendar, DollarSign, User, Mail, MapPin, 
  Activity, Phone, ShieldCheck, AlertTriangle, 
  Sparkles, Share2, Settings, Loader2
} from 'lucide-react';
import { smartflowApi } from '../api/services';

// Detailed Seed Data to match mockups
const MOCK_INVOICES = [
  {
    id: 'inv-1',
    invoice_number: 'INV-2023-089',
    client_name: 'Acme Corporation',
    client_email: 'billing@acmecorp.com',
    billing_address: '1200 Tech Blvd, Suite 400, San Francisco, CA 94107',
    currency: 'USD',
    issue_date: '2023-10-24',
    due_date: '2023-10-24',
    subtotal: 4500.00,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 4500.00,
    status: 'overdue',
    notes: 'Payment is due immediately. Late fees apply.',
    client_category: 'Enterprise Tech Client',
    items: [
      { id: 1, description: 'Strategy Consulting', quantity: 40, unit_price: 100.00, line_total: 4000.00 },
      { id: 2, description: 'Platform License Fee', quantity: 1, unit_price: 500.00, line_total: 500.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Invoice Generated', description: 'System prefilled via workflow template.', created_at: '2023-10-23T09:40:00Z' },
      { id: 2, event_type: 'sent', title: 'Invoice Sent', description: 'Via Email Automation to billing@acmecorp.com', created_at: '2023-10-24T09:41:00Z' }
    ]
  },
  {
    id: 'inv-2',
    invoice_number: 'INV-2023-090',
    client_name: 'Nebula Stream Inc.',
    client_email: 'finance@nebulastream.io',
    billing_address: '900 Innovation Drive, Suite 100, San Jose, CA 95110',
    currency: 'USD',
    issue_date: '2023-10-26',
    due_date: '2023-11-02',
    subtotal: 8250.00,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 8250.00,
    status: 'sent',
    notes: 'Thank you for your business.',
    client_category: 'Cloud Streaming Platform',
    items: [
      { id: 1, description: 'AI Infrastructure Setup', quantity: 1, unit_price: 7500.00, line_total: 7500.00 },
      { id: 2, description: 'Database Migration Support', quantity: 5, unit_price: 150.00, line_total: 750.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Invoice Generated', description: 'Created manually.', created_at: '2023-10-26T08:15:00Z' },
      { id: 2, event_type: 'sent', title: 'Invoice Sent', description: 'Via Email Automation', created_at: '2023-10-26T08:20:00Z' }
    ]
  },
  {
    id: 'inv-3',
    invoice_number: 'INV-2023-091',
    client_name: 'Julian Barnes',
    client_email: 'julian@barnesdev.com',
    billing_address: '45 London Wall, London, EC2M 5QD, UK',
    currency: 'USD',
    issue_date: '2023-10-01',
    due_date: '2023-10-15',
    subtotal: 1200.00,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 1200.00,
    status: 'paid',
    notes: 'Invoice Paid. Receipt generated.',
    client_category: 'Independent Developer',
    items: [
      { id: 1, description: 'Custom NLP Training', quantity: 8, unit_price: 150.00, line_total: 1200.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Invoice Generated', description: 'Created via client dashboard.', created_at: '2023-10-01T10:00:00Z' },
      { id: 2, event_type: 'sent', title: 'Invoice Sent', description: 'Delivered securely.', created_at: '2023-10-01T10:05:00Z' },
      { id: 3, event_type: 'viewed', title: 'Invoice Viewed', description: 'Viewed by client.', created_at: '2023-10-03T11:42:00Z' },
      { id: 4, event_type: 'paid', title: 'Invoice Paid', description: 'Paid via Stripe Credit Card.', created_at: '2023-10-14T15:20:00Z' }
    ]
  },
  {
    id: 'inv-4',
    invoice_number: 'INV-2023-092',
    client_name: 'Design Theory Ltd.',
    client_email: 'accounts@designtheory.co',
    billing_address: '78 Wardour St, Soho, London, W1D 6QB, UK',
    currency: 'USD',
    issue_date: '2023-11-03',
    due_date: '2023-11-10',
    subtotal: 3800.00,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 3800.00,
    status: 'draft',
    notes: 'Draft version. Subject to revision.',
    client_category: 'Creative Agency Partner',
    items: [
      { id: 1, description: 'UX Interface Design', quantity: 20, unit_price: 150.00, line_total: 3000.00 },
      { id: 2, description: 'Style Guide Refinement', quantity: 1, unit_price: 800.00, line_total: 800.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Draft Created', description: 'Prepared by billing manager.', created_at: '2023-11-03T14:22:00Z' }
    ]
  },
  {
    id: 'inv-5',
    invoice_number: 'INV-2023-08A9',
    client_name: 'NexaCorp Dynamics',
    client_email: 'ap@nexacorp.com',
    billing_address: '900 Innovation Drive, Suite 400, San Francisco, CA 94103',
    currency: 'USD',
    issue_date: '2023-10-24',
    due_date: '2023-11-23',
    subtotal: 23700.00,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 23700.00,
    status: 'draft',
    notes: 'Initial billing for platform deployment & NLP models.',
    client_category: 'Enterprise Tech Partner',
    items: [
      { id: 1, description: 'Enterprise AI Automation Platform', quantity: 1, unit_price: 4500.00, line_total: 4500.00 },
      { id: 2, description: 'Custom NLP Model Training', quantity: 120, unit_price: 150.00, line_total: 18000.00 },
      { id: 3, description: 'Priority 24/7 Support SLA', quantity: 1, unit_price: 1200.00, line_total: 1200.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Draft Created', description: 'Prefilled via voice entry.', created_at: '2023-10-23T14:22:00Z' }
    ]
  },
  {
    id: 'inv-6',
    invoice_number: 'INV-2023-004',
    client_name: 'Acme Corporation',
    client_email: 'billing@acmecorp.com',
    billing_address: '1200 Tech Blvd, Suite 400, San Francisco, CA 94107',
    currency: 'USD',
    issue_date: '2026-06-08',
    due_date: '2026-06-13', // Due in 5 days based on 2026-06-08
    subtotal: 650.00,
    tax_rate: 12,
    tax_amount: 79.60,
    total_amount: 729.60,
    status: 'sent',
    notes: 'Workflow automation invoice.',
    client_category: 'Enterprise Tech Client',
    items: [
      { id: 1, description: 'AI Workflow Automation Setup', quantity: 1, unit_price: 500.00, line_total: 500.00 },
      { id: 2, description: 'Monthly Maintenance Retainer', quantity: 1, unit_price: 150.00, line_total: 150.00 }
    ],
    timeline: [
      { id: 1, event_type: 'created', title: 'Draft Created', description: 'System prefilled.', created_at: '2026-06-07T14:22:00Z' },
      { id: 2, event_type: 'sent', title: 'Invoice Sent', description: 'Via Email Automation.', created_at: '2026-06-08T09:41:00Z' }
    ]
  }
];

export default function Invoices() {
  const [invoices, setInvoices] = useState(MOCK_INVOICES);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // viewMode states: 'dashboard', 'create', 'dispatch', 'details'
  const [viewMode, setViewMode] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('inv-1'); // Acme Corp default selected

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

  // AI Voice simulator state
  const [aiVoiceActive, setAiVoiceActive] = useState(false);
  const [aiVoiceTranscript, setAiVoiceTranscript] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

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

  const typingTimerRef = useRef(null);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await smartflowApi.getInvoices({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      // Merge backend results with mock data ensuring no duplicates
      const backendItems = response.data?.data?.items || [];
      if (backendItems.length > 0) {
        setInvoices(prev => {
          const combined = [...backendItems, ...MOCK_INVOICES];
          const seenIds = new Set();
          return combined.filter(item => {
            const uid = item.id || item.invoice_number;
            if (seenIds.has(uid)) return false;
            seenIds.add(uid);
            return true;
          });
        });
      }
    } catch (error) {
      console.error('Error fetching invoices from backend:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Selected Invoice Object Helper
  const activeInvoice = invoices.find(inv => inv.id === selectedInvoiceId) || invoices[0];

  // Calculated Stats
  const outstandingInvoices = invoices.filter(inv => ['sent', 'viewed', 'overdue'].includes(inv.status));
  const outstandingSum = outstandingInvoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const sentCount = invoices.filter(inv => inv.status === 'sent' || inv.status === 'viewed').length;
  const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;

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

  // Process the final voice transcript via the backend workflow prefill API
  const processVoicePrefill = async (transcriptText) => {
    try {
      setLoading(true);
      setError('');
      const res = await smartflowApi.getAIWorkflowPrefill(transcriptText, {
        workflow_intent: 'invoice'
      });
      const data = res.data?.data;
      if (data?.prefill) {
        const prefill = data.prefill;
        if (prefill.client_name) setClientName(prefill.client_name);
        if (prefill.client_email) setClientEmail(prefill.client_email);
        if (prefill.billing_address) setBillingAddress(prefill.billing_address);
        if (prefill.due_date) setDueDate(prefill.due_date.slice(0, 10));
        if (prefill.invoice_number) setInvoiceNumber(prefill.invoice_number);
        if (prefill.tax_rate !== undefined) setTaxRate(prefill.tax_rate);
        if (prefill.items && Array.isArray(prefill.items)) {
          setLineItems(prefill.items.map(item => ({
            description: item.description || 'Service',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0
          })));
        } else if (prefill.total_amount) {
          setLineItems([{
            description: prefill.notes || 'AI Voice Prefilled Work',
            quantity: 1,
            unit_price: prefill.total_amount
          }]);
        }
      }
    } catch (err) {
      console.error('Failed to parse voice command in backend:', err);
      setError('AI could not extract structured invoice details. Form remains editable.');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = () => {
    setAiVoiceActive(true);
    setAiVoiceTranscript('');
    const fullTranscript = "Invoice TechCorp $5,000 for Q3 UX Design due next Friday... Say 'Finish' to finalize data.";
    let currentIndex = 0;

    typingTimerRef.current = setInterval(() => {
      if (currentIndex < fullTranscript.length) {
        setAiVoiceTranscript(prev => prev + fullTranscript[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(typingTimerRef.current);
        setAiVoiceActive(false);
        // Autofill form contents
        setClientName('TechCorp Inc.');
        setClientEmail('client@example.com');
        setBillingAddress('123 Cyber Way, Neo SF, CA 94105');
        setDueDate('2026-06-12'); // next Friday based on Mon Jun 8
        setInvoiceNumber('INV-2023-089');
        setTaxRate(0);
        setLineItems([
          { description: 'Q3 UX Design Retainer', quantity: 1, unit_price: 5000 }
        ]);
      }
    }, 50);
  };

  // Trigger AI Voice prefills using Web SpeechRecognition with backend API validation
  const startVoiceTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (aiVoiceActive) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      } else {
        clearInterval(typingTimerRef.current);
      }
      setAiVoiceActive(false);
      return;
    }

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser, running simulation");
      runSimulation();
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setAiVoiceActive(true);
        setAiVoiceTranscript('Listening...');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setAiVoiceTranscript(text);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied.');
        }
        setAiVoiceActive(false);
      };

      rec.onend = () => {
        setAiVoiceActive(false);
        setAiVoiceTranscript(prev => {
          const finalPrompt = prev === 'Listening...' ? '' : prev;
          if (finalPrompt.trim()) {
            processVoicePrefill(finalPrompt);
          }
          return finalPrompt;
        });
      };

      setRecognitionInstance(rec);
      rec.start();
    } catch (e) {
      console.error(e);
      runSimulation();
    }
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    const sub = calculateFormSubtotal();
    const tx = calculateFormTax();
    const tot = calculateFormTotal();

    const payload = {
      client_name: clientName || 'Walking Customer',
      client_email: clientEmail || undefined,
      billing_address: billingAddress || undefined,
      currency: currency,
      issue_date: issueDate,
      due_date: dueDate,
      tax_rate: taxRate,
      notes: notes || undefined,
      items: lineItems.map(item => ({
        description: item.description || 'Consulting Session',
        quantity: item.quantity,
        unit_price: item.unit_price
      }))
    };

    try {
      setLoading(true);
      const res = await smartflowApi.createInvoice(payload);
      if (res.data?.data) {
        const created = res.data.data;
        setInvoices(prev => [created, ...prev]);
        setSelectedInvoiceId(created.id);
      }
    } catch (err) {
      console.error('Error saving invoice to backend:', err);
      // Fallback local update
      const localInvoice = {
        id: `inv-${Date.now()}`,
        invoice_number: invoiceNumber,
        client_name: clientName || 'Walking Customer',
        client_email: clientEmail,
        billing_address: billingAddress,
        currency,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: sub,
        tax_rate: taxRate,
        tax_amount: tx,
        total_amount: tot,
        status: 'draft',
        notes,
        client_category: 'Tech Client',
        items: lineItems.map((item, i) => ({
          id: i + 1,
          description: item.description || 'Item Description',
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price
        })),
        timeline: [
          { id: 1, event_type: 'created', title: 'Draft Created', description: 'Prefilled via form entry.', created_at: new Date().toISOString() }
        ]
      };
      setInvoices(prev => [localInvoice, ...prev]);
      setSelectedInvoiceId(localInvoice.id);
    } finally {
      setLoading(false);
      setViewMode('dashboard');
    }
  };

  // Handle Dispatch view transition
  const handleSendInvoiceClick = () => {
    setViewMode('dispatch');
  };

  // Perform Final Dispatching trigger
  const handleDispatchInvoice = async () => {
    setDispatching(true);
    
    // Choose channel
    const channelsUsed = Object.entries(deliveryChannels)
      .filter(([_, val]) => val)
      .map(([key]) => key);

    const channelPayload = channelsUsed[0] || 'email';

    try {
      await smartflowApi.sendInvoice(activeInvoice.id, {
        recipient_email: activeInvoice.client_email || undefined,
        message: `Please review invoice ${activeInvoice.invoice_number} due on ${activeInvoice.due_date}`,
        channel: channelPayload
      });
      // Mark viewed or sent
      await smartflowApi.updateInvoiceStatus(activeInvoice.id, { status: 'viewed' });
    } catch (err) {
      console.error('Dispatch API failed, running simulation fallback:', err);
    }

    // Update state locally
    setInvoices(prev => prev.map(inv => {
      if (inv.id === activeInvoice.id) {
        return {
          ...inv,
          status: 'sent',
          sent_at: new Date().toISOString(),
          timeline: [
            ...inv.timeline,
            {
              id: inv.timeline.length + 1,
              event_type: 'sent',
              title: 'Invoice Dispatched',
              description: `Sent via ${channelsUsed.join(', ')}`,
              created_at: new Date().toISOString()
            }
          ]
        };
      }
      return inv;
    }));

    setTimeout(() => {
      setDispatching(false);
      setViewMode('dashboard');
    }, 1500);
  };

  // Handle Mark Paid
  const handleMarkPaid = async () => {
    try {
      await smartflowApi.updateInvoiceStatus(activeInvoice.id, { status: 'paid' });
    } catch (err) {
      console.error('Mark paid API failed, updating locally:', err);
    }
    
    setInvoices(prev => prev.map(inv => {
      if (inv.id === activeInvoice.id) {
        return {
          ...inv,
          status: 'paid',
          paid_at: new Date().toISOString(),
          timeline: [
            ...inv.timeline,
            {
              id: inv.timeline.length + 1,
              event_type: 'paid',
              title: 'Invoice Paid',
              description: 'Marked paid manually by admin.',
              created_at: new Date().toISOString()
            }
          ]
        };
      }
      return inv;
    }));
  };

  // Handle Delete Invoice
  const handleDeleteInvoice = async (id) => {
    try {
      await smartflowApi.deleteInvoice(id);
    } catch (err) {
      console.error('Delete API failed, updating locally:', err);
    }
    const remaining = invoices.filter(inv => inv.id !== id);
    setInvoices(remaining);
    setSelectedInvoiceId(remaining.length > 0 ? remaining[0].id : null);
    setViewMode('dashboard');
  };

  // PDF download trigger
  const handleDownloadPDF = async (inv) => {
    try {
      const response = await smartflowApi.downloadInvoice(inv.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${inv.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('PDF download failed:', err);
      alert('Downloading simulated PDF brief...');
    }
  };

  // Schedule Voice Reminder Simulation
  const handleScheduleVoiceReminder = async () => {
    try {
      await smartflowApi.sendInvoiceReminder(activeInvoice.id, {
        recipient_email: activeInvoice.client_email || undefined,
        channel: 'email',
        message: 'Reminder notification request.'
      });
    } catch (err) {
      console.error('Reminder request API failed:', err);
    }
    setAiVoiceReminderScheduled(true);
    setTimeout(() => {
      setAiVoiceReminderScheduled(false);
      alert(`AI Call Reminder scheduled in ${aiVoiceReminderTime} for ${activeInvoice.client_name}`);
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
        return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
      case 'draft':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  // Filter logic
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inv.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col space-y-6">

      {/* =========================================================================
          VIEW MODE: INVOICES MAIN DASHBOARD (Image 2)
          ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="h-full flex flex-col space-y-6">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Invoices</h1>
              <p className="text-slate-400 text-sm mt-1">
                Create, manage, send, and track invoices with SmartFlow AI.
              </p>
            </div>
            
            <button 
              onClick={() => {
                setClientName('');
                setClientEmail('');
                setBillingAddress('');
                setDueDate('2026-06-15');
                setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
                setInvoiceNumber(`INV-2023-0${invoices.length + 89}`);
                setViewMode('create');
              }}
              className="px-5 py-3 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] hover:shadow-cyan-400/10 rounded-xl text-xs font-extrabold shadow-lg shadow-cyan-500/5 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
            >
              <Plus size={16} />
              <span>New Invoice</span>
            </button>
          </div>

          {/* Stats Summary cards row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Outstanding */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Outstanding</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-cyan-400 border border-slate-900">
                  <DollarSign size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  ${outstandingSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-2">
                  <Activity size={10} /> +15% from last month
                </span>
              </div>
            </div>

            {/* Sent */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Sent</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-cyan-400 border border-slate-900">
                  <Send size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">{sentCount}</p>
                <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-2">
                  <Clock size={10} /> Awaiting payment
                </span>
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between text-left relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Overdue</span>
                <span className="w-8 h-8 rounded-lg bg-slate-950/60 flex items-center justify-center text-rose-400 border border-slate-900">
                  <AlertCircle size={16} />
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-extrabold text-white tracking-tight">{overdueCount}</p>
                <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1 mt-2">
                  <AlertTriangle size={10} /> Requires action
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
                    placeholder="Search invoices..." 
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
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
                          ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/35' 
                          : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table list view */}
              <div className="flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl overflow-hidden min-h-[300px] flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-900/60 bg-slate-950/40 text-slate-400 text-xs font-bold tracking-wider">
                        <th className="px-6 py-4">Client / ID</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Due Date</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
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
                              {new Date(inv.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border capitalize ${getStatusBadgeStyle(inv.status)}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleDownloadPDF(inv)}
                                  className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                                  title="Download PDF"
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
                                  title="View Details"
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
                            <h3 className="text-sm font-bold text-white">No invoices found</h3>
                            <p className="text-xs text-slate-500 mt-1">Try changing your search term or filter status</p>
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
                      <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Invoice Details</span>
                      <span className="px-2.5 py-0.5 bg-cyan-950/80 border border-cyan-500/20 text-cyan-400 text-[9px] font-bold rounded-full uppercase tracking-wider">
                        Preview
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
                          {activeInvoice.invoice_number} • Due: {new Date(activeInvoice.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <div className="border-t border-slate-900/60 pt-3 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400 font-bold">Total Amount</span>
                        <span className="text-2xl font-extrabold text-cyan-400 tracking-tight">
                          ${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Line Items snippet details */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Line Items</h4>
                      <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                        {activeInvoice.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-950/20 border border-slate-900/60 rounded-xl">
                            <div className="min-w-0 pr-2">
                              <p className="text-slate-300 font-bold truncate">{item.description}</p>
                              <p className="text-[9px] text-slate-500 font-semibold mt-0.5">Qty: {item.quantity}</p>
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
                        <Download size={12} /> Download PDF
                      </button>
                      
                      {activeInvoice.status === 'draft' ? (
                        <button 
                          onClick={() => setViewMode('dispatch')}
                          className="py-2.5 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] hover:shadow-cyan-400/10 rounded-xl text-xs font-bold shadow-md shadow-cyan-500/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          Send Invoice
                        </button>
                      ) : activeInvoice.status !== 'paid' ? (
                        <button 
                          onClick={handleMarkPaid}
                          className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#070a13] hover:shadow-emerald-500/10 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Check size={12} /> Mark Paid
                        </button>
                      ) : (
                        <div className="py-2.5 border border-dashed border-emerald-500/20 text-emerald-400/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                          <CheckCircle size={12} /> Fully Paid
                        </div>
                      )}
                    </div>

                    {/* AI Suggestions Box */}
                    {activeInvoice.status !== 'paid' && (
                      <div className="border-t border-slate-900/60 pt-5 space-y-3.5">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles size={12} className="fill-current" /> AI Suggestions
                        </span>
                        
                        <div className="space-y-2.5">
                          <div 
                            onClick={handleScheduleVoiceReminder}
                            className="p-3 bg-slate-950/40 border border-slate-900 hover:border-slate-800 rounded-xl flex items-start gap-2.5 cursor-pointer transition-all"
                          >
                            <div className="p-1.5 bg-cyan-950/80 border border-cyan-500/20 text-cyan-400 rounded-lg mt-0.5">
                              <Mail size={12} />
                            </div>
                            <div className="text-left leading-normal">
                              <p className="text-xs text-white font-bold">Send Reminder</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Draft a polite follow-up email.</p>
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
                              <p className="text-xs text-white font-bold">Generate Follow-up</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Schedule automated sequence.</p>
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
                      className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      View Full Timeline & Logs →
                    </button>
                    <button 
                      onClick={() => handleDeleteInvoice(activeInvoice.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      title="Delete Invoice"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full border border-slate-900 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <FileText size={24} className="text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Select an invoice</p>
                  <p className="text-xs text-slate-600 mt-1">Choose an item from the invoice history list to display summaries, timelines, and payment options.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: CREATE INVOICE (Image 3)
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
                    <h1 className="text-xl font-bold text-white">Create Invoice</h1>
                    <p className="text-slate-500 text-xs mt-0.5">Generate via manual entry or conversational AI.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSaveDraft}
                    className="px-4 py-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Save Draft
                  </button>
                  <button 
                    onClick={handleSendInvoiceClick}
                    className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Send Invoice
                  </button>
                </div>
              </div>

              {/* AI Voice Entry Simulation Panel */}
              <div className="mt-6 bg-[#070a13] border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button 
                    type="button"
                    onClick={startVoiceTranscription}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all flex-shrink-0 relative ${
                      aiVoiceActive 
                        ? 'bg-cyan-500 text-[#070a13] shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse' 
                        : 'bg-slate-950 border border-slate-900 text-cyan-400 hover:bg-slate-900'
                    }`}
                  >
                    {aiVoiceActive ? <Mic size={20} /> : <Mic size={20} />}
                  </button>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-white font-bold">AI Voice Entry {aiVoiceActive && 'Active'}</p>
                    {aiVoiceActive || aiVoiceTranscript ? (
                      <p className="text-[11px] text-cyan-400 font-mono mt-1 italic leading-normal truncate">
                        "{aiVoiceTranscript}"
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 mt-0.5 font-semibold leading-relaxed">
                        "Invoice TechCorp $5,000 for Q3 UX Design due next Friday... Say 'Finish' to finalize data."
                      </p>
                    )}
                  </div>
                </div>
                {aiVoiceActive && (
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest animate-bounce">
                    Listening
                  </span>
                )}
              </div>

              {/* Invoice Form fields */}
              <div className="space-y-6 mt-6">
                <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase">Invoice Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client Name */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Client Name</label>
                    <input 
                      type="text" 
                      placeholder="Search or add client..."
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  {/* Client Email */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Client Email</label>
                    <input 
                      type="email" 
                      placeholder="client@example.com"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Due Date</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  {/* Invoice Number */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Invoice Number</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-slate-400"
                      value={invoiceNumber}
                      disabled
                    />
                  </div>
                </div>

                {/* Line Items Editor list */}
                <div className="space-y-3 text-left pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Line Items</label>
                    <button 
                      type="button"
                      onClick={addLineItem}
                      className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                        <input 
                          type="text" 
                          placeholder="Item description"
                          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            placeholder="Qty"
                            className="w-16 px-3 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white text-center placeholder:text-gray-700"
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                          <input 
                            type="number" 
                            placeholder="Price"
                            className="w-24 px-3 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white text-center placeholder:text-gray-700"
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
                            title="Delete Item"
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
                    <span>Subtotal</span>
                    <span className="text-slate-300">${calculateFormSubtotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between w-64 text-xs font-bold text-slate-500 items-center">
                    <span className="flex items-center gap-1.5">Tax (0%)</span>
                    <span className="text-slate-300">$0.00</span>
                  </div>
                  <div className="flex justify-between w-64 border-t border-slate-900/60 pt-2 text-sm font-extrabold text-white">
                    <span className="text-cyan-400">Total</span>
                    <span className="text-cyan-400">${calculateFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Sidebar: AI Intelligence & Live Preview */}
          <div className="lg:col-span-4 w-full lg:w-[420px] flex flex-col justify-between space-y-6">
            
            {/* Live extraction helper info */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-5 text-left space-y-3.5">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="fill-current animate-pulse" /> Live Extraction
              </span>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                SmartFlow is listening and auto-filling the form. Data confidence is high.
              </p>
            </div>

            {/* LIVE PREVIEW DOCUMENT (Image 3 right pane) */}
            <div className="flex-1 bg-white rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative min-h-[400px] text-[#070a13] border-4 border-cyan-500/30">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest absolute top-6 right-6">LIVE PREVIEW</span>
              
              <div className="space-y-6 text-left">
                {/* Header branding */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight text-[#070a13]">INVOICE</h2>
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
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bill To</span>
                  <p className="text-sm font-extrabold text-[#070a13] mt-1">{clientName || 'Client Name Placeholder'}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{clientEmail || 'client@example.com'}</p>
                </div>

                {/* Description lines items */}
                <div className="pt-2">
                  <div className="grid grid-cols-12 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-2 text-right">Amount</div>
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
                <span className="text-xs font-bold text-slate-400">Total</span>
                <span className="text-2xl font-extrabold text-[#070a13] tracking-tight">
                  USD ${calculateFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: DISPATCH INVOICE (Image 1)
          ========================================================================= */}
      {viewMode === 'dispatch' && activeInvoice && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Pane: Left White paper Invoice view */}
          <div className="lg:col-span-8 flex-1 bg-slate-950 border border-slate-900 rounded-3xl p-6 flex flex-col overflow-y-auto justify-center items-center">
            
            {/* White invoice preview sheet */}
            <div className="w-full max-w-[620px] bg-white rounded-3xl p-8 shadow-2xl text-[#070a13] space-y-8 min-h-[580px] flex flex-col justify-between border-4 border-cyan-500/10">
              <div className="space-y-6">
                
                {/* Brand Logo header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#070a13] flex items-center justify-center border border-slate-900 text-cyan-400">
                      <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20M17 5v14M22 8v8M7 8v8M2 10v4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-1">
                        SmartFlow <span className="text-cyan-600">Inc.</span>
                      </h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider -mt-0.5">billing@smartflow.ai</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-400">INVOICE</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">Invoice Number: {activeInvoice.invoice_number}</p>
                  </div>
                </div>

                {/* Company details row */}
                <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500 pt-2 leading-relaxed font-semibold">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">From</span>
                    <p className="font-extrabold text-slate-800">SmartFlow Inc.</p>
                    <p>482 Cyber Avenue</p>
                    <p>Neo-Tokyo, NT 100-0001</p>
                  </div>
                  <div className="text-right">
                    <p><span className="font-bold">Date of Issue:</span> {new Date(activeInvoice.issue_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p><span className="font-bold">Due Date:</span> {new Date(activeInvoice.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Bill to metadata */}
                <div className="p-4 bg-slate-50 rounded-2xl text-[10px] text-slate-500 leading-relaxed font-semibold">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Billed To</span>
                  <p className="text-xs font-extrabold text-slate-800 mt-1">{activeInvoice.client_name}</p>
                  {activeInvoice.billing_address && <p className="mt-0.5">{activeInvoice.billing_address}</p>}
                  {activeInvoice.client_email && <p>{activeInvoice.client_email}</p>}
                </div>

                {/* Line Items table */}
                <div className="pt-2">
                  <div className="grid grid-cols-12 text-[8px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-2">
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Rate</div>
                    <div className="col-span-2 text-right">Amount</div>
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
                    <span>Subtotal</span>
                    <span>${activeInvoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {activeInvoice.tax_amount > 0 && (
                    <div className="flex justify-between w-48">
                      <span>Tax ({activeInvoice.tax_rate}%)</span>
                      <span>${activeInvoice.tax_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-48 border-t border-slate-100 pt-1 text-xs font-extrabold text-[#070a13]">
                    <span>Total Due</span>
                    <span className="text-cyan-600">${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="text-[7px] text-slate-400 text-center font-medium leading-normal border-t border-slate-50 pt-3">
                  Payment is due within 30 days of issue. Please include the invoice number on your check or transfer reference.<br />
                  Bank Details: First Cyber Bank | ACC: 000-1234-5678 | ROUTING: 987654321
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
                  <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Dispatch Setup</span>
                </div>

                {/* Static document details metadata */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Document Actions</h4>
                  
                  <div className="space-y-2">
                    <button 
                      onClick={() => handleDownloadPDF(activeInvoice)}
                      className="w-full p-3 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl flex items-center justify-between text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><FileText size={14} className="text-cyan-400" /> Download PDF</span>
                      <span className="text-[10px] text-slate-500">245 KB</span>
                    </button>
                    
                    <button 
                      className="w-full p-3 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl flex items-center justify-between text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2"><Phone size={14} className="text-cyan-400" /> Share via Voice Brief</span>
                      <span className="text-slate-500">›</span>
                    </button>
                  </div>
                </div>

                {/* Delivery Channels Select Options */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Send to Client</h4>
                  <p className="text-[10px] text-slate-500 font-semibold leading-normal">Select delivery channels for {activeInvoice.client_name}:</p>
                  
                  <div className="space-y-2.5">
                    {/* Secure Email Link */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, email: !deliveryChannels.email})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.email 
                          ? 'bg-cyan-950/20 border-cyan-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.email ? 'border-cyan-500 bg-cyan-950 text-cyan-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.email && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">Secure Email Link</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">{activeInvoice.client_email || 'client@example.com'}</p>
                      </div>
                    </div>

                    {/* SMS Notification */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, sms: !deliveryChannels.sms})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.sms 
                          ? 'bg-cyan-950/20 border-cyan-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.sms ? 'border-cyan-500 bg-cyan-950 text-cyan-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.sms && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">SMS Notification</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">+1 (555) 019-2834</p>
                      </div>
                    </div>

                    {/* WhatsApp Business */}
                    <div 
                      onClick={() => setDeliveryChannels({...deliveryChannels, whatsapp: !deliveryChannels.whatsapp})}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        deliveryChannels.whatsapp 
                          ? 'bg-cyan-950/20 border-cyan-500/35' 
                          : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        deliveryChannels.whatsapp ? 'border-cyan-500 bg-cyan-950 text-cyan-400' : 'border-slate-850 bg-slate-950'
                      }`}>
                        {deliveryChannels.whatsapp && <Check size={10} />}
                      </div>
                      <div className="text-left leading-normal">
                        <p className="text-xs text-white font-bold">WhatsApp Business</p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-semibold">Verified Account Thread</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Glowing cyan DISPATCH INVOICE button */}
              <button 
                onClick={handleDispatchInvoice}
                disabled={dispatching || !Object.values(deliveryChannels).some(Boolean)}
                className="w-full py-4 mt-6 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] hover:shadow-cyan-400/20 rounded-xl font-bold shadow-lg shadow-cyan-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dispatching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>DISPATCH INVOICE</span>
                  </>
                )}
              </button>

            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: TIMELINE DETAILS REVIEW (Image 4)
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
                <span>Back to Invoices</span>
              </button>
              <h2 className="text-sm font-bold text-slate-500 tracking-widest uppercase">Invoice Details</h2>
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
                  Billed to <span className="text-slate-300 font-bold">{activeInvoice.client_name}</span> • Due in 5 days
                </p>
              </div>
              <div className="text-left md:text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Amount Due</span>
                <p className="text-2xl font-extrabold text-cyan-400 tracking-tight mt-0.5">
                  ${activeInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* PROGRESS TIMELINE (Image 4 middle) */}
            <div className="p-6 bg-slate-950/20 border border-slate-900 rounded-2xl space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Progress Timeline</h4>
              
              <div className="relative pt-4 pb-2 px-8 flex justify-between items-center w-full">
                {/* Horizontal progress bar track */}
                <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 z-0">
                  <div 
                    className="h-full bg-cyan-500 transition-all duration-500" 
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
                  { name: 'Created', done: true },
                  { name: 'Sent', done: ['sent', 'viewed', 'paid', 'overdue'].includes(activeInvoice.status) },
                  { name: 'Viewed', done: ['viewed', 'paid'].includes(activeInvoice.status) },
                  { name: 'Paid', done: activeInvoice.status === 'paid' }
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center space-y-2 relative z-10">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                      step.done 
                        ? 'bg-cyan-500 border-cyan-400 text-[#070a13]' 
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
              <button 
                onClick={() => handleDownloadPDF(activeInvoice)}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={13} /> View Document
              </button>
              <button 
                onClick={handleScheduleVoiceReminder}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Phone size={13} /> Share via Voice
              </button>
              <button 
                onClick={() => handleDeleteInvoice(activeInvoice.id)}
                className="px-4 py-2.5 bg-transparent border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/5 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>

            {/* Detailed Line Items table list */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Line Items</h4>
              
              <div className="bg-[#070a13] border border-slate-900 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-left text-xs font-semibold">
                  <thead>
                    <tr className="border-b border-slate-900/60 bg-slate-950/30 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3.5 col-span-6">Description</th>
                      <th className="px-5 py-3.5 text-center">Qty</th>
                      <th className="px-5 py-3.5 text-right">Price</th>
                      <th className="px-5 py-3.5 text-right">Total</th>
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
              <Loader2 className="animate-spin text-cyan-400" size={20} />
              <p className="text-xs font-semibold text-slate-400">Visual analytics for this invoice are generating...</p>
            </div>

          </div>

          {/* Right Sidebar: AI Intelligence, Identity profile & Activity Log */}
          <div className="lg:col-span-4 w-full lg:w-80 space-y-6">
            
            {/* AI Intelligence scheduler (Image 4 top right) */}
            {activeInvoice.status !== 'paid' && (
              <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={12} className="fill-current animate-pulse" /> AI Intelligence
                </span>
                
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  High likelihood of delayed payment based on historical patterns with {activeInvoice.client_name}. Consider sending an automated polite voice reminder in 2 days.
                </p>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Schedule</span>
                  <select 
                    className="flex-1 bg-slate-950 border border-slate-900 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/40"
                    value={aiVoiceReminderTime}
                    onChange={(e) => setAiVoiceReminderTime(e.target.value)}
                  >
                    <option value="1 day">In 1 day</option>
                    <option value="2 days">In 2 days</option>
                    <option value="5 days">In 5 days</option>
                    <option value="1 week">In 1 week</option>
                  </select>
                </div>

                <button 
                  onClick={handleScheduleVoiceReminder}
                  disabled={aiVoiceReminderScheduled}
                  className="w-full py-2.5 bg-transparent border border-cyan-500/35 hover:bg-cyan-950/20 text-cyan-400 text-xs font-bold rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {aiVoiceReminderScheduled ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
                  <span>Schedule Voice Reminder</span>
                </button>
              </div>
            )}

            {/* Client Identity details metadata card */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">Client Identity</h4>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center text-sm font-extrabold text-cyan-400 shadow-md">
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

            {/* Activity Log events timeline (Image 4 bottom right) */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4 max-h-[300px] overflow-y-auto">
              <h4 className="text-[10px] font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">Activity Log</h4>
              
              <div className="relative pl-4 border-l border-slate-800 space-y-5">
                {activeInvoice.timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative space-y-1">
                    {/* Node point */}
                    <span className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-500 border border-[#070a13] shadow-md shadow-cyan-500/20" />
                    
                    <h6 className="text-[10px] font-extrabold text-white leading-tight">{event.title}</h6>
                    {event.description && <p className="text-[9px] text-slate-500 leading-normal font-semibold">{event.description}</p>}
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wider block pt-0.5">
                      {new Date(event.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
