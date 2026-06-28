import { useEffect, useState } from "react";
import {
  Users, Phone, Calendar, FileText,
  RefreshCw, CheckCircle, XCircle, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { getAdminRole } from "../../utils/auth";
import { getMyDashboard } from "../../services/ownerApi";

const ROLE_COLORS = {
  manager:   "from-indigo-500 to-indigo-700",
  staff:     "from-emerald-500 to-emerald-700",
  assistant: "from-amber-500 to-amber-700",
};

const STAT_CARDS = [
  { key: "contacts",     label: "Contacts Added",  icon: Users,    color: "text-[#17b4c9]",  bg: "bg-cyan-50"    },
  { key: "calls",        label: "Calls Made",      icon: Phone,    color: "text-indigo-500", bg: "bg-indigo-50"  },
  { key: "appointments", label: "Appointments",    icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-50" },
  { key: "invoices",     label: "Invoices",        icon: FileText, color: "text-amber-500",  bg: "bg-amber-50"   },
];

const STATUS_ICON = {
  completed: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
  missed:    <XCircle     className="h-3.5 w-3.5 text-red-500"     />,
  pending:   <Clock       className="h-3.5 w-3.5 text-amber-500"   />,
};

const MyDashboard = () => {
  const role = getAdminRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getMyDashboard(days);
      setData(res?.data || res);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const totals = data?.totals || {};
  const gradient = ROLE_COLORS[role] || "from-[#17b4c9] to-[#0f8b9c]";

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-[#17b4c9]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {/* Banner */}
      <div className={`rounded-2xl bg-gradient-to-r ${gradient} p-6 text-white shadow flex items-center justify-between`}>
        <div>
          <p className="text-sm opacity-80 capitalize">{role} Dashboard</p>
          <h1 className="mt-1 text-xl font-bold">My Activity Overview</h1>
          <p className="text-sm opacity-70 mt-0.5">Your personal CRM performance</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{totals.total_activity ?? 0}</p>
          <p className="text-sm opacity-70">total activities</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">Period:</span>
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              days === d ? "bg-[#17b4c9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3">
            <div className={`${bg} rounded-xl p-2.5`}><Icon className={`w-5 h-5 ${color}`} /></div>
            <div>
              <p className="text-xl font-bold text-slate-900">{totals[key] ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      {(data?.daily_trend || []).length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Activity Trend — Last {Math.min(days, 14)} Days</h2>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="myCont" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#17b4c9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#17b4c9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 10, fontSize: 11 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="contacts"     stroke="#17b4c9" fill="url(#myCont)" strokeWidth={2} name="Contacts" />
                <Area type="monotone" dataKey="calls"        stroke="#6366f1" fill="none"          strokeWidth={2} name="Calls" />
                <Area type="monotone" dataKey="appointments" stroke="#10b981" fill="none"          strokeWidth={1.5} strokeDasharray="3 2" name="Appts" />
                <Area type="monotone" dataKey="invoices"     stroke="#f59e0b" fill="none"          strokeWidth={1.5} strokeDasharray="3 2" name="Invoices" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent activity — 2 col grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <RecentList
          title="Recent Contacts"
          icon={<Users className="h-4 w-4 text-[#17b4c9]" />}
          items={data?.recent_contacts || []}
          renderItem={(c) => (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{c.full_name || "—"}</p>
                <p className="text-xs text-slate-400">{c.email || c.phone || ""}</p>
              </div>
              <p className="text-xs text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</p>
            </div>
          )}
        />

        <RecentList
          title="Recent Calls"
          icon={<Phone className="h-4 w-4 text-indigo-500" />}
          items={data?.recent_calls || []}
          renderItem={(c) => (
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                {STATUS_ICON[c.status] || <Clock className="h-3.5 w-3.5 text-slate-400" />}
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.contact_name || "Unknown"}</p>
                  <p className="text-xs text-slate-400 capitalize">{c.status} {c.duration ? `· ${c.duration}s` : ""}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{c.timestamp ? new Date(c.timestamp).toLocaleDateString() : ""}</p>
            </div>
          )}
        />

        <RecentList
          title="Upcoming Appointments"
          icon={<Calendar className="h-4 w-4 text-emerald-500" />}
          items={data?.recent_appointments || []}
          renderItem={(a) => (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.title || "—"}</p>
                <p className="text-xs text-slate-400 capitalize">{a.status || ""}</p>
              </div>
              <p className="text-xs text-slate-400">{a.starts_at ? new Date(a.starts_at).toLocaleDateString() : ""}</p>
            </div>
          )}
        />

        <RecentList
          title="Recent Invoices"
          icon={<FileText className="h-4 w-4 text-amber-500" />}
          items={data?.recent_invoices || []}
          renderItem={(inv) => (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{inv.recipient_name || "—"}</p>
                <p className={`text-xs font-semibold capitalize ${inv.status === "paid" ? "text-emerald-600" : inv.status === "overdue" ? "text-red-500" : "text-amber-500"}`}>
                  {inv.status || "—"}
                </p>
              </div>
              <p className="text-sm font-bold text-slate-900">
                {inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : "—"}
              </p>
            </div>
          )}
        />
      </div>
    </div>
  );
};

const RecentList = ({ title, icon, items, renderItem }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
      {icon} {title}
    </h2>
    {items.length === 0 ? (
      <p className="text-xs text-slate-400 py-4 text-center">No data for this period.</p>
    ) : (
      <div className="divide-y divide-slate-50">
        {items.map((item, i) => <div key={i}>{renderItem(item)}</div>)}
      </div>
    )}
  </div>
);

export default MyDashboard;
