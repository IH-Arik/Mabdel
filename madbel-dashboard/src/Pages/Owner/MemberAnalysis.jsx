import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Users,
  Phone,
  Calendar,
  FileText,
  RefreshCw,
  ArrowLeft,
  Activity,
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getMemberAnalysis } from "../../services/ownerApi";

const PERIOD_OPTIONS = [7, 14, 30, 90];

const ROLE_BADGE = {
  manager:   { bg: "bg-indigo-100", text: "text-indigo-700" },
  staff:     { bg: "bg-emerald-100", text: "text-emerald-700" },
  assistant: { bg: "bg-amber-100", text: "text-amber-700" },
};

const STATUS_BADGE = {
  active:  { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
  blocked: { bg: "bg-red-100",     text: "text-red-700",     label: "Banned" },
};

const STAT_CARDS = [
  { key: "contacts",     label: "Contacts",     icon: Users,    color: "text-[#17b4c9]", bg: "bg-cyan-50" },
  { key: "calls",        label: "Calls",        icon: Phone,    color: "text-indigo-500", bg: "bg-indigo-50" },
  { key: "appointments", label: "Appointments", icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-50" },
  { key: "invoices",     label: "Invoices",     icon: FileText, color: "text-amber-500", bg: "bg-amber-50" },
];

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#94a3b8"];

const MemberAnalysis = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getMemberAnalysis(userId, days);
      setData(res?.data || res);
    } catch (err) {
      console.error("Failed to load member analysis:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId, days]);

  const member = data?.member || {};
  const totals = data?.totals || {};
  const roleBadge = ROLE_BADGE[member.role] || { bg: "bg-slate-100", text: "text-slate-600" };
  const statusBadge = STATUS_BADGE[member.status] || STATUS_BADGE.active;

  const callBreakdownData = Object.entries(data?.call_breakdown || {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));
  const invoiceBreakdownData = Object.entries(data?.invoice_breakdown || {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-[#17b4c9]" />
          <p className="text-slate-500">Loading member analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#17b4c9]" />
              Member Analysis
            </h1>
            <p className="text-sm text-slate-400">Individual CRM performance report</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {PERIOD_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === d ? "bg-[#17b4c9] text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#17b4c9]" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Member profile card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center shrink-0">
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <UserCheck className="w-8 h-8 text-[#17b4c9]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-slate-900">{member.name || "Unknown"}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roleBadge.bg} ${roleBadge.text}`}>
              {member.role}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-slate-500">{member.email}</p>
          {member.phone && <p className="text-sm text-slate-400">{member.phone}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold text-slate-900">{totals.total_activity ?? 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">total activities ({days}d)</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-3">
            <div className={`${bg} rounded-xl p-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totals[key] ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Daily Activity — Last {days} Days</h2>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.daily_trend || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="mContacts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17b4c9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#17b4c9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="mCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="contacts"     stroke="#17b4c9" fill="url(#mContacts)" strokeWidth={2} name="Contacts" />
              <Area type="monotone" dataKey="calls"        stroke="#6366f1" fill="url(#mCalls)"    strokeWidth={2} name="Calls" />
              <Area type="monotone" dataKey="appointments" stroke="#10b981" fill="none"            strokeWidth={2} strokeDasharray="4 2" name="Appointments" />
              <Area type="monotone" dataKey="invoices"     stroke="#f59e0b" fill="none"            strokeWidth={2} strokeDasharray="4 2" name="Invoices" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Call + Invoice breakdown pies */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Phone className="h-4 w-4 text-indigo-500" /> Call Status Breakdown
          </h2>
          {callBreakdownData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={callBreakdownData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {callBreakdownData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No call data.</div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" /> Invoice Status Breakdown
          </h2>
          {invoiceBreakdownData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={invoiceBreakdownData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {invoiceBreakdownData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No invoice data.</div>
          )}
        </div>
      </div>

      {/* Recent activity tables */}
      <div className="grid gap-6 md:grid-cols-2">
        <RecentTable
          title="Recent Contacts"
          icon={<Users className="h-4 w-4 text-[#17b4c9]" />}
          rows={data?.recent_contacts || []}
          columns={[
            { key: "full_name", label: "Name" },
            { key: "email",     label: "Email" },
            { key: "created_at", label: "Added", format: (v) => v ? new Date(v).toLocaleDateString() : "—" },
          ]}
        />
        <RecentTable
          title="Recent Calls"
          icon={<Phone className="h-4 w-4 text-indigo-500" />}
          rows={data?.recent_calls || []}
          columns={[
            { key: "contact_name", label: "Contact" },
            { key: "duration",     label: "Duration", format: (v) => v ? `${v}s` : "—" },
            { key: "status",       label: "Status", format: (v) => (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold capitalize ${v === "completed" ? "text-emerald-600" : "text-red-500"}`}>
                {v === "completed" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {v}
              </span>
            )},
          ]}
        />
        <RecentTable
          title="Recent Appointments"
          icon={<Calendar className="h-4 w-4 text-emerald-500" />}
          rows={data?.recent_appointments || []}
          columns={[
            { key: "title",     label: "Title" },
            { key: "starts_at", label: "Date", format: (v) => v ? new Date(v).toLocaleDateString() : "—" },
            { key: "status",    label: "Status", format: (v) => (
              <span className={`text-xs font-semibold capitalize ${v === "confirmed" ? "text-emerald-600" : v === "cancelled" ? "text-red-500" : "text-amber-500"}`}>
                {v || "—"}
              </span>
            )},
          ]}
        />
        <RecentTable
          title="Recent Invoices"
          icon={<FileText className="h-4 w-4 text-amber-500" />}
          rows={data?.recent_invoices || []}
          columns={[
            { key: "recipient_name", label: "Recipient" },
            { key: "total_amount",   label: "Amount", format: (v) => v != null ? `$${Number(v).toFixed(2)}` : "—" },
            { key: "status",         label: "Status", format: (v) => (
              <span className={`text-xs font-semibold capitalize ${v === "paid" ? "text-emerald-600" : v === "overdue" ? "text-red-500" : "text-amber-500"}`}>
                {v || "—"}
              </span>
            )},
          ]}
        />
      </div>
    </div>
  );
};

const RecentTable = ({ title, icon, rows, columns }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
    <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
      {icon} {title}
    </h2>
    {rows.length === 0 ? (
      <p className="text-sm text-slate-400 py-4 text-center">No data for this period.</p>
    ) : (
      <table className="w-full text-left text-sm text-slate-700">
        <thead className="text-xs text-slate-400 uppercase bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 truncate max-w-[140px]">
                  {c.format ? c.format(row[c.key]) : row[c.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

export default MemberAnalysis;
