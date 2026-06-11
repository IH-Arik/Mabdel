import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  MapPin,
  Users,
  Tag,
  Info,
  Check,
  Trash2,
} from "lucide-react";
import {
  listEvents,
  updateActivityStatus,
  updateEventStatus,
} from "../../services/adminApi";
import {
  listAdminActivities,
  searchAdminActivities,
} from "../../services/activitiesApi";

const ITEMS_PER_PAGE = 8;
const PLACEHOLDER_AVATAR = "https://via.placeholder.com/80x80.png?text=U";
const PLACEHOLDER_IMAGE = "https://via.placeholder.com/320x180.png?text=Activity";

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeStatusLabel = (item) => {
  const raw = String(item.status || "").toLowerCase();
  if (raw === "cancelled" || raw === "canceled") return "Cancelled";
  if (raw === "completed") return "Completed";

  const now = Date.now();
  const startAt = item.startAt ? new Date(item.startAt).getTime() : null;
  const endAt = item.endAt ? new Date(item.endAt).getTime() : null;

  if (startAt && startAt > now) return "Upcoming";
  if (endAt && endAt <= now) return "Completed";
  return "Ongoing";
};

const ActivityEvents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [activitiesPayload, eventsPayload] = await Promise.all([
          debouncedSearch
            ? searchAdminActivities({
                page: 1,
                limit: 100,
                q: debouncedSearch,
              })
            : listAdminActivities({
                page: 1,
                limit: 100,
              }),
          listEvents({
            page: 1,
            limit: 100,
            q: debouncedSearch || undefined,
          }),
        ]);

        if (!mounted) return;

        const activityData = activitiesPayload?.data || activitiesPayload;
        const activities = Array.isArray(activityData)
          ? activityData
          : activityData?.items || activityData?.rows || [];
        const events = Array.isArray(eventsPayload?.data) ? eventsPayload.data : [];

        const normalized = [...activities, ...events]
          .map((item) => {
            const entityType = item.entityType === "event" ? "event" : "activity";
            return {
              id: item.id || item._id || "",
              entityType,
              title: item.title || item.name || "Untitled",
              type: entityType === "event" ? "Event" : "Activity",
              hostName: item.hostName || item.host?.name || "Unknown Host",
              hostAvatarUrl:
                item.hostAvatarUrl || item.host?.avatarUrl || PLACEHOLDER_AVATAR,
              status: item.status || "draft",
              statusLabel: normalizeStatusLabel(item),
              imageUrl: item.imageUrl || PLACEHOLDER_IMAGE,
              description: item.description || "No description available.",
              startAt: item.startAt || null,
              endAt: item.endAt || null,
              location: item.location || "N/A",
              participantLimit: item.participantLimit ?? null,
              category: item.type || "General",
              createdAt: item.createdAt || null,
            };
          })
          .sort((a, b) => {
            const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return right - left;
          });

        setRows(normalized);
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const renderPaginationNumbers = useMemo(() => {
    const pages = [];
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  const handleView = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleUpdateStatus = async (nextStatus) => {
    if (!selectedItem?.id) return;
    try {
      setSaving(true);
      if (selectedItem.entityType === "event") {
        await updateEventStatus({ id: selectedItem.id, status: nextStatus });
      } else {
        await updateActivityStatus({ id: selectedItem.id, status: nextStatus });
      }

      setRows((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                status: nextStatus,
                statusLabel: normalizeStatusLabel({ ...item, status: nextStatus }),
              }
            : item
        )
      );
      closeModal();
    } catch (error) {
      alert(error?.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50">
      <div className="mx-auto overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#17b4c9] rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white">Activities & Events Management</h1>
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                placeholder="Search Events"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 py-2 pl-10 pr-4 text-sm bg-white rounded-lg focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </div>
        </div>

        <div className="bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">S.ID</th>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">Title</th>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">Type</th>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">Host</th>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-medium text-left text-[#17b4c9] uppercase">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td className="px-6 py-10 text-sm text-center text-gray-500" colSpan={6}>
                      Loading activities and events...
                    </td>
                  </tr>
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-sm text-center text-gray-500" colSpan={6}>
                      No activities/events found.
                    </td>
                  </tr>
                ) : (
                  currentRows.map((row, index) => (
                    <tr key={`${row.entityType}-${row.id}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{String(startIndex + index + 1).padStart(2, "0")}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{row.type}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img src={row.hostAvatarUrl || PLACEHOLDER_AVATAR} className="w-8 h-8 rounded-full" />
                          <span className="ml-3 text-sm text-gray-900">{row.hostName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{row.statusLabel}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleView(row)}
                          className="p-1 text-[#17b4c9] hover:bg-blue-50 rounded-full"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t">
            <span className="text-sm text-gray-700">
              SHOWING {rows.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, rows.length)} OF {rows.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-400 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {renderPaginationNumbers.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof page === "number" && setCurrentPage(page)}
                  className={`min-w-[32px] px-3 py-1 text-sm rounded-lg ${
                    page === currentPage ? "bg-[#17b4c9] text-white" : "hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-400 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-blue-400">
                Manage {selectedItem.type}
              </h2>
              <button onClick={closeModal} className="text-gray-400 transition-colors hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
                <div className="flex flex-col gap-4 p-5 sm:flex-row">
                  <div className="flex-shrink-0">
                    <img
                      src={selectedItem.imageUrl || PLACEHOLDER_IMAGE}
                      alt="Activity"
                      className="object-cover w-full h-32 rounded-lg sm:w-32"
                    />
                  </div>

                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-semibold text-gray-900">{selectedItem.title}</h3>

                    <div className="flex items-center gap-2">
                      <img src={selectedItem.hostAvatarUrl || PLACEHOLDER_AVATAR} className="w-8 h-8 rounded-full" />
                      <span className="font-medium text-gray-700">{selectedItem.hostName}</span>
                    </div>

                    <p className="text-sm leading-relaxed text-gray-600">
                      {selectedItem.description || "No description available."}
                    </p>

                    <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">Date & Time:</div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{formatDateTime(selectedItem.startAt)}</span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">Location:</div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{selectedItem.location || "N/A"}</span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">Participants Limit:</div>
                        <div className="flex items-center gap-2 text-sm">
                          <Users size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {selectedItem.participantLimit ?? "N/A"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs font-medium text-gray-500">Category:</div>
                        <div className="flex items-center gap-2 text-sm">
                          <Tag size={16} className="text-gray-400" />
                          <span className="px-3 py-1 text-xs font-medium text-blue-600 rounded-full bg-blue-50">
                            {selectedItem.category || "General"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 mt-6 border border-blue-200 rounded-lg bg-blue-50">
                <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">Only approved activities/events appear in the app.</p>
              </div>

              <div className="flex flex-col gap-3 mt-6 sm:flex-row">
                <button
                  onClick={() => handleUpdateStatus("approved")}
                  disabled={saving || selectedItem.status === "approved"}
                  className="flex items-center justify-center flex-1 gap-2 px-6 py-3 font-medium text-white transition-colors bg-blue-400 rounded-lg hover:bg-blue-500 disabled:opacity-60"
                >
                  <Check size={20} />
                  {saving ? "Saving..." : `Approve ${selectedItem.type}`}
                </button>

                <button
                  onClick={() => handleUpdateStatus("cancelled")}
                  disabled={saving}
                  className="flex items-center justify-center flex-1 gap-2 px-6 py-3 font-medium text-white transition-colors bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-60"
                >
                  <Trash2 size={20} />
                  {saving ? "Saving..." : `Cancel ${selectedItem.type}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityEvents;
