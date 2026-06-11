import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { applyAdminReportAction, listAdminReports } from "../../services/reportsApi";
import { getUserById } from "../../services/adminApi";

const Reports = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [reports, setReports] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [updatingActionKey, setUpdatingActionKey] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const itemsPerPage = 8;

  useEffect(() => {
    let mounted = true;

    const loadReports = async () => {
      try {
        const payload = await listAdminReports({ page: currentPage, limit: itemsPerPage });
        if (!mounted) return;

        const data = payload?.data ?? payload;
        const items = Array.isArray(data)
          ? data
          : data?.reports || data?.items || data?.rows || [];
        const total =
          Number(payload?.meta?.totalItems) ||
          Number(data?.total) ||
          Number(data?.meta?.total) ||
          Number(data?.pagination?.total) ||
          items.length;

        setReports(Array.isArray(items) ? items : []);
        setTotalItems(total);
      } catch {
        if (mounted) {
          setReports([]);
          setTotalItems(0);
        }
      }
    };

    loadReports();
    return () => {
      mounted = false;
    };
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + reports.length;

  const currentData = useMemo(
    () =>
      reports.map((report, index) => ({
        id: report?.id || report?._id || String(startIndex + index + 1).padStart(2, "0"),
        reportFrom:
          report?.reportFrom?.fullName ||
          report?.reportFrom?.name ||
          report?.reporter?.fullName ||
          report?.reporter?.name ||
          report?.from?.name ||
          "N/A",
        reportReason: report?.reason || report?.reportReason || "N/A",
        reportTo:
          report?.reportTo?.fullName ||
          report?.reportTo?.name ||
          report?.target?.fullName ||
          report?.target?.name ||
          report?.to?.name ||
          "N/A",
        date: report?.createdAt
          ? new Date(report.createdAt).toLocaleString()
          : report?.dateTime
            ? new Date(report.dateTime).toLocaleString()
            : report?.date || "N/A",
        status:
          report?.status === "resolved" || report?.status === "rejected"
            ? "closed"
            : report?.status || "open",
        reportToId:
          report?.reportTo?.id ||
          report?.reportedUserId ||
          null,
        reportToStatus:
          report?.reportTo?.status ||
          report?.target?.status ||
          null,
      })),
    [reports, startIndex]
  );

  const handleReportAction = async (reportId, action) => {
    const actionKey = `${reportId}:${action}`;
    try {
      setUpdatingActionKey(actionKey);
      await applyAdminReportAction({ reportId, action });
      setReports((prev) =>
        prev.map((r) => {
          if ((r.id || r._id) !== reportId) return r;
          const next = { ...r, status: "resolved" };
          if (action === "disable_user") {
            next.reportTo = { ...(next.reportTo || {}), status: "blocked" };
          }
          if (action === "recover_user") {
            next.reportTo = { ...(next.reportTo || {}), status: "active" };
          }
          return next;
        })
      );
    } finally {
      setUpdatingActionKey(null);
    }
  };

  const handleViewUser = async (userId) => {
    if (!userId) return;
    setIsUserModalOpen(true);
    setIsUserLoading(true);
    try {
      const payload = await getUserById({ id: userId });
      const user = payload?.data ?? payload;
      setSelectedUser(user || null);
    } catch {
      setSelectedUser(null);
    } finally {
      setIsUserLoading(false);
    }
  };

  const getVisiblePages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    } else if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, "...", totalPages - 1, totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, 2, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="mx-auto overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="bg-white">
          <div className="sticky top-0 z-10 px-6 py-4 text-white bg-[#17b4c9] rounded-t-2xl">
            <h1 className="text-xl font-semibold">Reports</h1>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white border-b">
                  <th className="w-16 px-4 py-3 text-sm font-medium text-center text-[#17b4c9]">S.ID</th>
                  <th className="px-4 py-3 text-sm font-medium text-left text-[#17b4c9]">Report From</th>
                  <th className="px-4 py-3 text-sm font-medium text-left text-[#17b4c9]">Report Reason</th>
                  <th className="px-4 py-3 text-sm font-medium text-left text-[#17b4c9]">Report To</th>
                  <th className="px-4 py-3 text-sm font-medium text-left text-[#17b4c9]">Date & Time</th>
                  <th className="px-4 py-3 text-sm font-medium text-left text-[#17b4c9]">Action</th>
                </tr>
              </thead>

              <tbody>
                {currentData.map((report, index) => (
                  <tr key={report.id} className="transition-colors border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-center">{String(startIndex + index + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-3"><span className="font-medium">{report.reportFrom}</span></td>
                    <td className="px-4 py-3 text-gray-700">{report.reportReason}</td>
                    <td className="px-4 py-3"><span className="font-medium">{report.reportTo}</span></td>
                    <td className="px-4 py-3 text-gray-700">{report.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 text-xs text-white rounded bg-amber-500 disabled:opacity-50"
                          onClick={() => handleReportAction(report.id, "warn")}
                          disabled={updatingActionKey === `${report.id}:warn`}
                        >
                          {updatingActionKey === `${report.id}:warn` ? "Processing..." : "Warn"}
                        </button>
                        <button
                          className="px-2 py-1 text-xs text-white rounded bg-sky-600 disabled:opacity-50"
                          onClick={() => handleViewUser(report.reportToId)}
                          disabled={!report.reportToId}
                        >
                          View User
                        </button>
                        {report.reportToStatus === "blocked" ? (
                          <button
                            className="px-2 py-1 text-xs text-white bg-green-600 rounded disabled:opacity-50"
                            onClick={() => handleReportAction(report.id, "recover_user")}
                            disabled={updatingActionKey === `${report.id}:recover_user`}
                          >
                            {updatingActionKey === `${report.id}:recover_user` ? "Processing..." : "Recover User"}
                          </button>
                        ) : (
                          <button
                            className="px-2 py-1 text-xs text-white bg-red-500 rounded disabled:opacity-50"
                            onClick={() => handleReportAction(report.id, "disable_user")}
                            disabled={updatingActionKey === `${report.id}:disable_user`}
                          >
                            {updatingActionKey === `${report.id}:disable_user` ? "Processing..." : "Disable User"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No reports found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="text-sm font-medium text-[#17b4c9]">SHOWING {totalItems ? startIndex + 1 : 0}-{endIndex} OF {totalItems}</div>

            <div className="flex items-center gap-1">
              <button className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}`} onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </button>

              {getVisiblePages().map((page, index) => (
                <div key={`${page}-${index}`}>
                  {page === "..." ? (
                    <span className="px-2 text-gray-500">...</span>
                  ) : (
                    <button
                      className={`w-8 h-8 flex items-center justify-center rounded text-sm font-medium transition-colors ${
                        currentPage === page
                          ? "bg-[#17b4c9] text-white hover:bg-[#17b4c9]"
                          : "hover:bg-gray-200 text-gray-700"
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )}
                </div>
              ))}

              <button className={`w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 transition-colors ${currentPage === totalPages ? "opacity-50 cursor-not-allowed" : ""}`} onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {isUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Reported User Details</h2>
              <button
                className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setIsUserModalOpen(false);
                  setSelectedUser(null);
                }}
              >
                Close
              </button>
            </div>
            {isUserLoading ? (
              <p className="text-sm text-slate-500">Loading user details...</p>
            ) : selectedUser ? (
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-700">
                <p><span className="font-semibold">Name:</span> {selectedUser.fullName || "N/A"}</p>
                <p><span className="font-semibold">Email:</span> {selectedUser.email || "N/A"}</p>
                <p><span className="font-semibold">Role:</span> {selectedUser.role || "N/A"}</p>
                <p><span className="font-semibold">Status:</span> {selectedUser.status || "N/A"}</p>
                <p><span className="font-semibold">Phone:</span> {selectedUser.phone || "N/A"}</p>
                <p>
                  <span className="font-semibold">Joined:</span>{" "}
                  {selectedUser.joinedAt ? new Date(selectedUser.joinedAt).toLocaleString() : "N/A"}
                </p>
                <p><span className="font-semibold">Blocked Reason:</span> {selectedUser.blockedReason || "N/A"}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Unable to load user details.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
