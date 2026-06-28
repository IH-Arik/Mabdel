import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Phone,
  Calendar,
  FileText,
  UserCheck,
  RefreshCw,
  TrendingUp,
  Award,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getTeamAnalysis } from "../../services/ownerApi";

const PERIOD_OPTIONS = [7, 14, 30, 90];
const ROLE_COLORS = {
  manager: "#6366f1",
  staff: "#10b981",
  assistant: "#f59e0b",
};
const PIE_COLORS = ["#17b4c9", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

const STAT_CARDS = [
  {
    key: "contacts",
    label: "Contacts Added",
    icon: Users,
    color: "text-[#17b4c9]",
    bg: "bg-cyan-50",
    border: "hover:border-[#17b4c9]/50",
  },
  {
    key: "calls",
    label: "Calls Made",
    icon: Phone,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    border: "hover:border-indigo-500/50",
  },
  {
    key: "appointments",
    label: "Appointments",
    icon: Calendar,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    border: "hover:border-emerald-500/50",
  },
  {
    key: "invoices",
    label: "Invoices",
    icon: FileText,
    color: "text-amber-500",
    bg: "bg-amber-50",
    border: "hover:border-amber-500/50",
  },
];

const TeamAnalysis = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getTeamAnalysis(days);
      setData(res?.data || res);
    } catch (err) {
      console.error("Failed to load team analysis:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const roleDist = data
    ? Object.entries(data.role_distribution).map(([role, count]) => ({
        name: role.charAt(0).toUpperCase() + role.slice(1),
        value: count,
      }))
    : [];

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-[#17b4c9]" />
          <p className="text-slate-500">Loading team analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 pb-4 border-b border-slate-100 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[#17b4c9]" />
            Team Analysis
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            CRM activity breakdown across your entire team
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {PERIOD_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === d
                    ? "bg-[#17b4c9] text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#17b4c9]" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg, border }) => (
          <div
            key={key}
            className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4 transition-all ${border}`}
          >
            <div className={`${bg} rounded-xl p-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">
                {(data?.totals?.[key] ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Trend Chart */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-4">
          Daily Activity — Last {days} Days
        </h2>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.daily_trend || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gContacts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17b4c9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#17b4c9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="contacts" stroke="#17b4c9" fill="url(#gContacts)" strokeWidth={2} name="Contacts" />
              <Area type="monotone" dataKey="calls" stroke="#6366f1" fill="url(#gCalls)" strokeWidth={2} name="Calls" />
              <Area type="monotone" dataKey="appointments" stroke="#10b981" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Appointments" />
              <Area type="monotone" dataKey="invoices" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Invoices" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-member + Role distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Per-member bar chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            Activity per Member
          </h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(data?.per_member || []).slice(0, 10)}
                margin={{ top: 5, right: 10, left: -20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="contacts" name="Contacts" fill="#17b4c9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" name="Calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="appointments" name="Appts" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invoices" name="Invoices" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Role distribution pie */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Role Distribution</h2>
          {roleDist.length > 0 ? (
            <>
              <div className="flex-1 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {roleDist.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            ROLE_COLORS[entry.name.toLowerCase()] ||
                            PIE_COLORS[i % PIE_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 12, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {roleDist.map((r) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            ROLE_COLORS[r.name.toLowerCase()] || "#94a3b8",
                        }}
                      />
                      <span className="text-slate-600 capitalize">{r.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
              No team members yet.
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          Member Leaderboard
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="text-xs text-slate-400 uppercase bg-slate-50 rounded-xl">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold text-right">Contacts</th>
                <th className="px-4 py-3 font-semibold text-right">Calls</th>
                <th className="px-4 py-3 font-semibold text-right">Appts</th>
                <th className="px-4 py-3 font-semibold text-right">Invoices</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.per_member || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No activity data for this period.
                  </td>
                </tr>
              ) : (
                (data?.per_member || []).map((m, idx) => (
                  <tr
                    key={m.user_id}
                    onClick={() => navigate(`/owner/member/${m.user_id}/analysis`)}
                    className="hover:bg-cyan-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-slate-400 font-semibold">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-cyan-100 flex items-center justify-center">
                          <UserCheck className="w-3.5 h-3.5 text-[#17b4c9]" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 group-hover:text-[#17b4c9] transition-colors">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                        style={{
                          backgroundColor:
                            m.role === "manager" ? "#ede9fe" : m.role === "staff" ? "#d1fae5" : "#fef3c7",
                          color:
                            m.role === "manager" ? "#6d28d9" : m.role === "staff" ? "#065f46" : "#92400e",
                        }}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{m.contacts}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{m.calls}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{m.appointments}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{m.invoices}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-slate-900">{m.total_activity}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#17b4c9] transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeamAnalysis;
