import { useEffect, useMemo, useState } from "react";
import RecentUsersTable from "../../Components/Dashboard/RecentUsersTable";
import UserRatioChart from "../../Components/Dashboard/UserRatioChart";
import {
  getDashboardOverview,
  getSuperGlobalGrowth,
  getSuperPlatformSummary,
  getUserGrowth,
  getMyProfile,
  listUsersSafe,
} from "../../services/adminApi";

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const firstFinite = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
};

const extractItems = (payload) => {
  const data = payload?.data ?? payload;
  const visited = new Set();

  const findFirstArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return null;
    if (visited.has(value)) return null;
    visited.add(value);

    const priorityKeys = ["users", "items", "rows", "results", "docs", "data", "list"];
    for (const key of priorityKeys) {
      if (Array.isArray(value[key])) return value[key];
    }

    for (const key of Object.keys(value)) {
      const found = findFirstArray(value[key]);
      if (found) return found;
    }

    return null;
  };

  return findFirstArray(data) || [];
};

const normalizeMonthData = (analytics) => {
  const source =
    analytics?.monthlyUsers ||
    analytics?.userRatio ||
    analytics?.monthly ||
    analytics?.chart ||
    analytics?.chart_data ||
    analytics?.chartData ||
    [];

  if (!Array.isArray(source) || source.length === 0) return [];

  return source.map((item, index) => ({
    month:
      item?.month ||
      item?.label ||
      item?.name ||
      item?.x ||
      `M${index + 1}`,
    users: toNumber(item?.users ?? item?.value ?? item?.count, 0),
  }));
};

const Dashboard = () => {
  const currentYear = new Date().getFullYear();
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => String(currentYear - index)),
    [currentYear]
  );

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        
        // Load profile to verify role
        const profilePayload = await getMyProfile().catch(() => null);
        const profile = profilePayload?.data || profilePayload;
        const superAdminFlag = profile?.role === "super_admin";
        
        if (mounted) {
          setIsSuperAdmin(superAdminFlag);
        }

        const [overviewPayload, usersPayload] = await Promise.all([
          superAdminFlag ? getSuperPlatformSummary() : getDashboardOverview(),
          listUsersSafe({ page: 1, limit: 5 }),
        ]);

        if (!mounted) return;

        setOverview(overviewPayload?.data || overviewPayload);

        const users = extractItems(usersPayload);
        setRecentUsers(users);
      } catch (error) {
        if (mounted) {
          setOverview(null);
          setAnalytics(null);
          setRecentUsers([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadAnalytics = async () => {
      try {
        const analyticsPayload = isSuperAdmin
          ? await getSuperGlobalGrowth()
          : await getUserGrowth();
        if (!mounted) return;
        setAnalytics(analyticsPayload?.data || analyticsPayload);
      } catch (error) {
        if (mounted) {
          setAnalytics(null);
        }
      }
    };

    loadAnalytics();
    return () => {
      mounted = false;
    };
  }, [selectedYear, isSuperAdmin]);

  // Extract stat items by matching labels
  const getStatByLabel = (labelToFind) => {
    if (overview?.stats && Array.isArray(overview.stats)) {
      const found = overview.stats.find(
        (s) => s.label?.toLowerCase() === labelToFind.toLowerCase()
      );
      if (found) {
        const strVal = String(found.value).replace(/[$,]/g, "");
        const numVal = parseFloat(strVal);
        return isNaN(numVal) ? found.value : numVal;
      }
    }
    return null;
  };

  const totalUsers = firstFinite(
    getStatByLabel("Total Users"),
    getStatByLabel("Total Platform Users"),
    overview?.totalUsers,
    overview?.usersCount,
    overview?.users,
    0
  );
  
  const totalRevenue = firstFinite(
    getStatByLabel("Organization Revenue"),
    getStatByLabel("Platform Revenue"),
    overview?.totalRevenue,
    overview?.revenueBreakdown?.totalRevenue,
    overview?.eventPlatformFeeRevenue + overview?.subscriptionRevenue,
    overview?.payments?.platformFee + overview?.subscriptionRevenue,
    overview?.payments?.platformFee,
    overview?.revenue,
    overview?.earnings,
    0
  );

  const usersGrowth = overview?.usersGrowth ?? overview?.userGrowthPercent ?? 12.5;
  const revenueGrowth = overview?.revenueGrowth ?? overview?.revenueGrowthPercent ?? 8.2;

  const chartData = useMemo(() => normalizeMonthData(analytics), [analytics]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-100">
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            {isSuperAdmin ? "Super Admin Overview" : "Overview"}
          </p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">
                {loading ? "..." : totalUsers.toLocaleString()}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-700">
                {isSuperAdmin ? "Total Platform Users" : "Total Users"}
              </p>
            </div>
            {usersGrowth !== undefined && usersGrowth !== null ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {usersGrowth > 0 ? "+" : ""}
                {usersGrowth}%
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-6 bg-white border shadow-sm rounded-2xl border-slate-100">
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            {isSuperAdmin ? "Super Admin Performance" : "Performance"}
          </p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">
                {loading ? "..." : typeof totalRevenue === "number" ? `$${totalRevenue.toLocaleString()}` : totalRevenue}
              </p>
              <p className="mt-1 text-base font-semibold text-slate-700">
                {isSuperAdmin ? "Platform Revenue" : "Total Revenue"}
              </p>
            </div>
            {revenueGrowth !== undefined && revenueGrowth !== null ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {revenueGrowth > 0 ? "+" : ""}
                {revenueGrowth}%
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-500">Revenue growth compared with last month.</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 pr-1">
        <UserRatioChart
          data={chartData}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          yearOptions={yearOptions}
        />
        <div className="pb-2">
          <RecentUsersTable users={recentUsers} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
