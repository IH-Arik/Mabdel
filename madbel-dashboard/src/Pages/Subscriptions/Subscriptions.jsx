import { CircleX, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getSubscriptionFees,
  listSubscriptions,
  updateSubscriptionFees,
} from "../../services/adminApi";

const ITEMS_PER_PAGE = 8;

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const normalizePlan = (plan) => {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "monthly") return "Monthly";
  if (normalized === "yearly") return "Yearly";
  return plan || "N/A";
};

const normalizeStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "active") return "Paid";
  if (normalized === "expired") return "Expired";
  if (normalized === "cancelled") return "Cancelled";
  return status || "Unknown";
};

const getStatusColor = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "active") {
    return "text-green-600 bg-green-50";
  }
  if (normalized === "expired" || normalized === "cancelled") {
    return "text-red-600 bg-red-50";
  }
  return "text-gray-600 bg-gray-50";
};

const normalizeListResponse = (payload) => {
  const data = payload?.data ?? payload;
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : [];
  const meta = payload?.meta || data?.meta || {};

  return {
    items,
    page: toNumber(meta?.page ?? meta?.currentPage, 1),
    totalPages: toNumber(meta?.totalPages ?? meta?.pageCount, 1),
    totalItems: toNumber(meta?.totalItems, items.length),
  };
};

const extractFees = (payload) => {
  const data = payload?.data ?? payload ?? {};
  return {
    monthly: toNumber(
      data?.subscriptionMonthlyPrice ?? data?.monthlyFee ?? data?.monthly,
      0
    ),
    yearly: toNumber(
      data?.subscriptionYearlyPrice ?? data?.yearlyFee ?? data?.yearly,
      0
    ),
  };
};

const Subscriptions = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showManageFeesModal, setShowManageFeesModal] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFees, setLoadingFees] = useState(true);
  const [savingFees, setSavingFees] = useState(false);

  const [subscriptions, setSubscriptions] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [subscriptionFees, setSubscriptionFees] = useState({
    monthly: 0,
    yearly: 0,
  });
  const [defaultFees, setDefaultFees] = useState({
    monthly: 0,
    yearly: 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      setAppliedSearch(searchQuery.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let mounted = true;

    const loadSubscriptions = async () => {
      try {
        setLoadingList(true);
        const payload = await listSubscriptions({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: appliedSearch || undefined,
        });

        if (!mounted) return;

        const normalized = normalizeListResponse(payload);
        setSubscriptions(
          normalized.items.map((item, index) => ({
            id: item.id || item._id || `row-${currentPage}-${index}`,
            sId:
              item.sId
              || item.serial
              || (currentPage - 1) * ITEMS_PER_PAGE + index + 1,
            user: {
              name:
                item.user?.fullName
                || item.user?.name
                || item.user
                || item.fullName
                || "Unknown User",
              avatar:
                item.user?.avatarUrl
                || item.user?.profileImageUrl
                || item.avatarUrl
                || null,
            },
            email: item.email || item.user?.email || "N/A",
            status: normalizeStatus(item.status),
            plan: normalizePlan(item.plans || item.plan),
            expirationDate: formatDate(item.expirationDate || item.endAt),
          }))
        );
        setTotalItems(normalized.totalItems);
        setTotalPages(Math.max(1, normalized.totalPages));
      } catch {
        if (!mounted) return;
        setSubscriptions([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        if (mounted) setLoadingList(false);
      }
    };

    loadSubscriptions();
    return () => {
      mounted = false;
    };
  }, [appliedSearch, currentPage]);

  useEffect(() => {
    let mounted = true;

    const loadFees = async () => {
      try {
        setLoadingFees(true);
        const payload = await getSubscriptionFees();
        if (!mounted) return;
        const fees = extractFees(payload);
        setSubscriptionFees(fees);
        setDefaultFees(fees);
      } catch {
        if (!mounted) return;
        setSubscriptionFees({ monthly: 0, yearly: 0 });
        setDefaultFees({ monthly: 0, yearly: 0 });
      } finally {
        if (mounted) setLoadingFees(false);
      }
    };

    loadFees();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePageChange = (page) => {
    const nextPage = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(nextPage);
  };

  const handleManageFees = () => {
    setShowManageFeesModal(true);
  };

  const handleCloseModal = () => {
    setShowManageFeesModal(false);
  };

  const handleUpdateFees = async () => {
    try {
      setSavingFees(true);
      const payload = await updateSubscriptionFees({
        subscriptionMonthlyPrice: subscriptionFees.monthly,
        subscriptionYearlyPrice: subscriptionFees.yearly,
      });
      const updated = extractFees(payload);
      setSubscriptionFees(updated);
      setDefaultFees(updated);
      alert("Fees updated successfully");
      setShowManageFeesModal(false);
    } catch {
      alert("Failed to update fees");
    } finally {
      setSavingFees(false);
    }
  };

  const handleResetToDefault = () => {
    setSubscriptionFees(defaultFees);
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const visiblePages = useMemo(() => {
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    return Array.from(
      { length: Math.max(0, endPage - startPage + 1) },
      (_, index) => startPage + index
    );
  }, [currentPage, totalPages]);

  return (
    <div className="p-6 bg-gray-50">
      <div className="mx-auto overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#17b4c9] rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white">Subscriptions</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search User"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block py-2 pl-10 pr-3 leading-5 placeholder-gray-500 bg-white border border-gray-300 rounded-md w-80 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleManageFees}
                className="px-4 py-2 font-medium text-blue-500 transition-colors bg-white rounded-md hover:bg-gray-50"
              >
                Manage Fees
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    S.ID
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    User
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    Email
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    Plans
                  </th>
                  <th className="px-6 py-4 text-sm font-medium text-left text-[#17b4c9]">
                    Expiration Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingList ? (
                  <tr>
                    <td
                      className="px-6 py-8 text-sm text-center text-gray-500"
                      colSpan={6}
                    >
                      Loading subscriptions...
                    </td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-8 text-sm text-center text-gray-500"
                      colSpan={6}
                    >
                      No subscriptions found.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((subscription, index) => (
                    <tr
                      key={subscription.id}
                      className={`${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      } hover:bg-gray-100`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{subscription.sId}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={subscription.user.avatar || "/placeholder.svg"}
                            alt={subscription.user.name}
                            className="object-cover w-10 h-10 rounded-full"
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {subscription.user.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{subscription.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            subscription.status
                          )}`}
                        >
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{subscription.plan}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {subscription.expirationDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
            <div className="text-sm font-medium text-[#17b4c9]">
              SHOWING {startItem}-{endItem} OF {totalItems}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-gray-500 hover:text-[#17b4c9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {visiblePages.map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded ${
                    currentPage === page
                      ? "bg-[#17b4c9] text-white"
                      : "text-[#17b4c9] hover:bg-gray-100"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-gray-500 hover:text-[#17b4c9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showManageFeesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 text-center text-white bg-[#17b4c9] rounded-t-lg">
              <h2 className="text-xl font-semibold">Manage Fees</h2>
              <div className="flex items-center justify-end">
                <button
                  onClick={handleCloseModal}
                  className="text-white transition-colors hover:text-gray-200"
                >
                  <CircleX />
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingFees ? (
                <div className="py-8 text-center text-gray-500">
                  Loading current fees...
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-gray-800">
                      Subscription Fees
                    </h3>

                    <div className="p-4 mb-6 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-center mb-3">
                        <span className="text-sm font-medium text-[#17b4c9]">
                          Monthly Plan: ${subscriptionFees.monthly}
                        </span>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              setSubscriptionFees((prev) => ({
                                ...prev,
                                monthly: Math.max(0, prev.monthly - 1),
                              }))
                            }
                            className="flex items-center justify-center w-8 h-8 transition-colors bg-gray-200 rounded-full hover:bg-gray-300"
                          >
                            <span className="font-bold text-gray-600">-</span>
                          </button>
                          <span className="text-lg font-semibold text-gray-800 min-w-[50px] text-center">
                            {subscriptionFees.monthly}
                          </span>
                          <button
                            onClick={() =>
                              setSubscriptionFees((prev) => ({
                                ...prev,
                                monthly: prev.monthly + 1,
                              }))
                            }
                            className="flex items-center justify-center w-8 h-8 text-white transition-colors bg-[#17b4c9] rounded-full hover:bg-blue-400"
                          >
                            <span className="font-bold">+</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 mb-6 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-center mb-3">
                        <span className="text-sm font-medium text-[#17b4c9]">
                          Yearly Plan: ${subscriptionFees.yearly}
                        </span>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              setSubscriptionFees((prev) => ({
                                ...prev,
                                yearly: Math.max(0, prev.yearly - 1),
                              }))
                            }
                            className="flex items-center justify-center w-8 h-8 transition-colors bg-gray-200 rounded-full hover:bg-gray-300"
                          >
                            <span className="font-bold text-gray-600">-</span>
                          </button>
                          <span className="text-lg font-semibold text-gray-800 min-w-[50px] text-center">
                            {subscriptionFees.yearly}
                          </span>
                          <button
                            onClick={() =>
                              setSubscriptionFees((prev) => ({
                                ...prev,
                                yearly: prev.yearly + 1,
                              }))
                            }
                            className="flex items-center justify-center w-8 h-8 text-white transition-colors bg-[#17b4c9] rounded-full hover:bg-blue-400"
                          >
                            <span className="font-bold">+</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4 pt-6 mt-8 border-t border-gray-200">
                    <button
                      onClick={handleUpdateFees}
                      disabled={savingFees}
                      className="px-6 py-2 font-medium text-[#175994] transition-colors border-2 border-[#17b4c9] rounded-lg hover:bg-blue-50 disabled:opacity-50"
                    >
                      {savingFees ? "Updating..." : "Update Fee"}
                    </button>
                    <button
                      onClick={handleResetToDefault}
                      disabled={savingFees}
                      className="px-6 py-2 font-medium text-white transition-colors bg-[#17b4c9] rounded-lg hover:bg-[#1e496f] disabled:opacity-50"
                    >
                      Reset to Default
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
