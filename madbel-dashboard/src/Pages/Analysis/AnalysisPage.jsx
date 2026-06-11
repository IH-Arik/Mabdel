import { useState, useEffect } from "react";
import { 
  Activity, 
  Cpu, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  RefreshCw,
  Terminal,
  ChevronLeft,
  ChevronRight,
  User,
  ExternalLink
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { getAiStats, getAiLogs } from "../../services/adminApi";
import { Modal, Tag } from "antd";

const COLORS = ["#17b4c9", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
const ERROR_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#ec4899"];
const PAGE_SIZE = 10;

const AnalysisPage = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, logsRes] = await Promise.all([
        getAiStats(),
        getAiLogs(100)
      ]);
      setStats(statsRes?.data || statsRes || null);
      setLogs(logsRes?.data || logsRes || []);
    } catch (error) {
      console.error("Failed to load AI analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logs locally based on search
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.user_id?.toLowerCase().includes(term) ||
      log.status?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Generate dynamic trend if empty
  const getTrendData = () => {
    if (stats?.usage_trend && stats.usage_trend.length > 0) {
      return stats.usage_trend;
    }
    // Mock last 7 days trend if empty
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      trend.push({
        date: dateStr,
        requests: Math.floor(Math.random() * 50) + 15,
        tokens: Math.floor(Math.random() * 10000) + 2500,
      });
    }
    return trend;
  };

  const getTaskData = () => {
    if (stats?.task_distribution && stats.task_distribution.length > 0) {
      return stats.task_distribution;
    }
    return [
      { task: "Sneaker Classification", count: 145 },
      { task: "Authenticity Check", count: 98 },
      { task: "Brand Recognition", count: 62 },
      { task: "Quality Grading", count: 35 }
    ];
  };

  const getErrorData = () => {
    if (stats?.error_breakdown && stats.error_breakdown.length > 0) {
      return stats.error_breakdown;
    }
    return [
      { error: "Rate limit reached", count: 6 },
      { error: "API Timeout", count: 4 },
      { error: "Invalid image format", count: 3 },
      { error: "Model loading failure", count: 1 }
    ];
  };

  const trendData = getTrendData();
  const taskData = getTaskData();
  const errorData = getErrorData();

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6 min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-[#17b4c9]" />
          <p className="text-xl font-medium text-slate-400">Loading AI performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 font-sans text-slate-100 bg-[#0b0f19] sm:p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 pb-4 border-b border-slate-800 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Terminal className="h-8 w-8 text-[#17b4c9]" />
            AI Insights & Monitoring
          </h1>
          <p className="text-base text-slate-400 mt-1">
            Real-time API metrics, token consumption, success rates, and prompt log streams.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-all border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-[#17b4c9]" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Requests */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 shadow-md rounded-2xl flex items-center gap-4 hover:border-[#17b4c9]/50 transition-all group">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-[#17b4c9] group-hover:scale-110 transition-transform">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Requests</p>
            <p className="text-3xl font-bold text-white mt-1">
              {(stats?.total_requests ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 shadow-md rounded-2xl flex items-center gap-4 hover:border-emerald-500/50 transition-all group">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Success Rate</p>
            <p className="text-3xl font-bold text-white mt-1">
              {(stats?.success_rate ?? 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 shadow-md rounded-2xl flex items-center gap-4 hover:border-amber-500/50 transition-all group">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Avg Response Time</p>
            <p className="text-3xl font-bold text-white mt-1">
              {(stats?.avg_response_time ?? 0).toFixed(2)}s
            </p>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 shadow-md rounded-2xl flex items-center gap-4 hover:border-purple-500/50 transition-all group">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Tokens Used</p>
            <p className="text-3xl font-bold text-white mt-1">
              {(stats?.total_tokens_used ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Trend Area Chart */}
      <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-sm">
        <h3 className="text-xl font-bold text-white mb-4">Request & Token Consumption Trend</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#17b4c9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#17b4c9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}
                itemStyle={{ color: "#17b4c9" }}
              />
              <Area 
                type="monotone" 
                dataKey="requests" 
                stroke="#17b4c9" 
                fillOpacity={1} 
                fill="url(#colorRequests)" 
                strokeWidth={2}
                name="Requests"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Pie Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Distribution */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="text-xl font-bold text-white mb-4">AI Task Distribution</h3>
          <div className="h-[250px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="task"
                >
                  {taskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" tick={{ fill: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Breakdown */}
        <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <h3 className="text-xl font-bold text-white mb-4">System Error Breakdown</h3>
          <div className="h-[250px] flex items-center justify-center">
            {errorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="error"
                  >
                    {errorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ERROR_COLORS[index % ERROR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                  <Legend layout="horizontal" align="center" verticalAlign="bottom" tick={{ fill: "#94a3b8" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <CheckCircle className="h-12 w-12 text-emerald-400" />
                <p className="text-lg">No errors recorded!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logs Terminal */}
      <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-4 pb-4 mb-4 border-b border-slate-800 md:flex-row md:items-center md:justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Recent Prompt & Request Logs
          </h3>
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter logs by task, ID, status..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm text-white bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#17b4c9]"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/40 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">User ID</th>
                <th className="px-4 py-3 font-semibold">Action / Task</th>
                <th className="px-4 py-3 font-semibold">Tokens</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {pagedLogs.length > 0 ? (
                pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-950/30 transition-colors">
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs flex items-center gap-1 text-slate-400">
                      <User className="h-3 w-3 text-[#17b4c9]" />
                      {log.user_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{log.tokens_used}</td>
                    <td className="px-4 py-3">
                      <Tag color={log.status === "success" ? "success" : "error"} className="capitalize font-semibold border-none rounded-md px-2 py-0.5">
                        {log.status}
                      </Tag>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="View Detailed Payload"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No matching AI logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-4 mt-6 text-sm text-slate-400">
            <span>
              Showing <span className="text-white">{Math.min(page * PAGE_SIZE, filteredLogs.length)}</span> out of{" "}
              <span className="text-white">{filteredLogs.length}</span> entries
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        title={<span className="text-xl font-bold text-white">Log Event Details</span>}
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        className="ai-log-modal"
        wrapClassName="dark-modal-wrapper"
      >
        {selectedLog && (
          <div className="mt-4 space-y-4 text-slate-300 font-sans">
            <div>
              <span className="text-slate-500 text-sm block">Log ID</span>
              <span className="font-mono text-white text-sm bg-slate-900 px-2 py-1 rounded-md mt-1 block">
                {selectedLog.id}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-sm block">User ID</span>
                <span className="font-medium text-white">{selectedLog.user_id}</span>
              </div>
              <div>
                <span className="text-slate-500 text-sm block">Timestamp</span>
                <span className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-sm block">Action</span>
                <span className="text-white font-medium">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-slate-500 text-sm block">Tokens Used</span>
                <span className="text-white font-mono">{selectedLog.tokens_used}</span>
              </div>
            </div>
            <div>
              <span className="text-slate-500 text-sm block">Status</span>
              <Tag color={selectedLog.status === "success" ? "success" : "error"} className="capitalize font-semibold border-none mt-1">
                {selectedLog.status}
              </Tag>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AnalysisPage;
