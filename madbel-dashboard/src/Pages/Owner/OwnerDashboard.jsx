import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserCheck, UserCog, ArrowRight } from "lucide-react";
import { getOwnerProfile } from "../../services/ownerApi";

const OwnerDashboard = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOwnerProfile()
      .then((res) => {
        if (mounted) setProfile(res?.data || res);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const stats = profile?.team_stats || { supervisors: 0, staff: 0, total: 0 };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#17b4c9] to-[#0f8b9c] p-6 text-white shadow">
        <p className="text-sm font-medium opacity-80">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold">
          {loading ? "Loading..." : profile?.name || "Owner"}
        </h1>
        <p className="mt-1 text-sm opacity-70">{profile?.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="w-6 h-6 text-[#17b4c9]" />}
          label="Total Team"
          value={loading ? "..." : stats.total}
          bg="bg-cyan-50"
        />
        <StatCard
          icon={<UserCheck className="w-6 h-6 text-indigo-500" />}
          label="Supervisors"
          value={loading ? "..." : stats.supervisors}
          bg="bg-indigo-50"
        />
        <StatCard
          icon={<UserCog className="w-6 h-6 text-emerald-500" />}
          label="Staff"
          value={loading ? "..." : stats.staff}
          bg="bg-emerald-50"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
        <div className="space-y-3">
          <ActionLink
            to="/owner/team"
            label="Manage Team Members"
            desc="Assign supervisor or staff roles, set restrictions"
          />
          <ActionLink
            to="/owner/team"
            label="Add New Team Member"
            desc="Search for a user and assign them a role"
          />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, bg }) => (
  <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm flex items-center gap-4`}>
    <div className={`${bg} rounded-xl p-3`}>{icon}</div>
    <div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
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
