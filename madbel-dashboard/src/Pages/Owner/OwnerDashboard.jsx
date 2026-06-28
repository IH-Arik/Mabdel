import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, UserCog, ArrowRight,
  Phone, Calendar, FileText, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { getAdminRole } from "../../utils/auth";
import { getOwnerProfile, getTeamAnalysis } from "../../services/ownerApi";
import MyDashboard from "./MyDashboard";

const OwnerDashboard = () => {
  const role = getAdminRole();

  // Manager / Staff / Assistant see their own personal CRM dashboard
  if (["manager", "staff", "assistant"].includes(role)) {
    return <MyDashboard />;
  }

  return <OwnerView />;
};

const OwnerView = () => {
  const [profile, setProfile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getOwnerProfile(), getTeamAnalysis(14)])
      .then(([profRes, analysisRes]) => {
        if (!mounted) return;
        setProfile(profRes?.data || profRes);
        setAnalysis(analysisRes?.data || analysisRes);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const teamStats = profile?.team_stats || { managers: 0, staff: 0, assistants: 0, total: 0 };
  const totals    = analysis?.totals   || { contacts: 0, calls: 0, appointments: 0, invoices: 0 };
  const trend     = analysis?.daily_trend || [];
  const topMembers = (analysis?.per_member || []).slice(0, 5);

  return (
    <div className="space-y-6 p-1">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#17b4c9] to-[#0f8b9c] p-6 text-white shadow flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Welcome back</p>
          <h1 className="mt-1 text-2xl font-bold">
            {loading ? "Loading..." : profile?.name || "Owner"}
          </h1>
          <p className="mt-1 text-sm opacity-70">{profile?.email}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{loading ? "—" : teamStats.total}</p>
          <p className="text-sm opacity-70">Team Members</p>
        </div>
      </div>

      {/* Team role counts */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<UserCheck className="w-5 h-5 text-indigo-500" />} label="Managers"   value={loading ? "..." : teamStats.managers  ?? 0} bg="bg-indigo-50" />
        <StatCard icon={<UserCog   className="w-5 h-5 text-emerald-500"/>} label="Staff"      value={loading ? "..." : teamStats.staff     ?? 0} bg="bg-emerald-50" />
        <StatCard icon={<UserCog   className="w-5 h-5 text-amber-500"  />} label="Assistants" value={loading ? "..." : teamStats.assistants ?? 0} bg="bg-amber-50" />
      </div>

      {/* CRM totals — last 14 days */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">Team CRM Activity <span className="text-xs font-normal text-slate-400 ml-1">last 14 days</span></h2>
          <Link to="/owner/analysis" className="text-xs font-semibold text-[#17b4c9] hover:underline flex items-center gap-1">
            Full Analysis <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CrmCard icon={<Users    className="w-4 h-4 text-[#17b4c9]"  />} label="Contacts"     value={totals.contacts}     color="text-[#17b4c9]"  loading={loading} />
          <CrmCard icon={<Phone    className="w-4 h-4 text-indigo-500" />} label="Calls"         value={totals.calls}        color="text-indigo-500" loading={loading} />
          <CrmCard icon={<Calendar className="w-4 h-4 text-emerald-500"/>} label="Appointments"  value={totals.appointments} color="text-emerald-500" loading={loading} />
          <CrmCard icon={<FileText className="w-4 h-4 text-amber-500"  />} label="Invoices"      value={totals.invoices}     color="text-amber-500"  loading={loading} />
        </div>
      </div>

      {/* Mini trend chart */}
      {!loading && trend.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Activity Trend — Last 14 Days</h2>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="dContacts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#17b4c9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#17b4c9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderColor: "#e2e8f0", borderRadius: 10, fontSize: 11 }} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="contacts"     stroke="#17b4c9" fill="url(#dContacts)" strokeWidth={2} name="Contacts" />
                <Area type="monotone" dataKey="calls"        stroke="#6366f1" fill="url(#dCalls)"    strokeWidth={2} name="Calls" />
                <Area type="monotone" dataKey="appointments" stroke="#10b981" fill="none"            strokeWidth={1.5} strokeDasharray="3 2" name="Appts" />
                <Area type="monotone" dataKey="invoices"     stroke="#f59e0b" fill="none"            strokeWidth={1.5} strokeDasharray="3 2" name="Invoices" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top performers */}
      {!loading && topMembers.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#17b4c9]" /> Top Performers
            </h2>
            <Link to="/owner/analysis" className="text-xs font-semibold text-[#17b4c9] hover:underline flex items-center gap-1">
              See All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {topMembers.map((m, i) => (
              <Link
                key={m.user_id}
                to={`/owner/member/${m.user_id}/analysis`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cyan-50 transition-colors group"
              >
                <span className="w-5 text-center text-xs font-bold text-slate-400">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </span>
                <div className="w-7 h-7 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-[#17b4c9]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#17b4c9] transition-colors truncate">{m.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{m.role}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900">{m.total_activity}</p>
                  <p className="text-xs text-slate-400">activities</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#17b4c9] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
        <div className="space-y-2">
          <ActionLink to="/owner/team"     label="Manage Team Members" desc="Assign manager, staff, or assistant roles" />
          <ActionLink to="/owner/analysis" label="Team Analysis"       desc="Full CRM activity breakdown with charts" />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, bg }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex items-center gap-3">
    <div className={`${bg} rounded-xl p-2.5`}>{icon}</div>
    <div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  </div>
);

const CrmCard = ({ icon, label, value, color, loading }) => (
  <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-slate-500">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{loading ? "..." : value ?? 0}</p>
  </div>
);

const ActionLink = ({ to, label, desc }) => (
  <Link
    to={to}
    className="flex items-center justify-between rounded-xl border border-slate-100 p-4 hover:border-[#17b4c9] hover:bg-cyan-50 transition-colors group"
  >
    <div>
      <p className="font-semibold text-slate-800 text-sm">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
    </div>
    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#17b4c9] transition-colors" />
  </Link>
);

export default OwnerDashboard;
