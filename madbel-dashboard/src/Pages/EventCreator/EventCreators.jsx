import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { listEventCreators } from "../../services/eventCreatorsApi";

const LIMIT = 10;

const formatMoney = (amount) => `$${Number(amount || 0).toLocaleString()}`;

const EventCreators = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const payload = await listEventCreators({ page: currentPage, limit: LIMIT });
        if (!mounted) return;

        const data = payload?.data ?? payload;
        const items = Array.isArray(data) ? data : data?.items || data?.rows || [];
        const total =
          Number(payload?.meta?.totalItems) ||
          Number(data?.total) ||
          items.length;

        setRows(Array.isArray(items) ? items : []);
        setTotalItems(total);
      } catch {
        if (mounted) {
          setRows([]);
          setTotalItems(0);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));
  const startIndex = (currentPage - 1) * LIMIT;
  const endIndex = startIndex + rows.length;

  const creators = useMemo(
    () =>
      rows.map((item, index) => {
        const pending = item?.paymentStatus === "pending";
        return {
          id: item?.sId || startIndex + index + 1,
          creatorId: item?.creatorId || "",
          name: item?.creatorName || "N/A",
          avatar: item?.creatorAvatarUrl || "",
          totalEvents: item?.totalEvents || 0,
          ticketSold: item?.ticketSold || 0,
          earnings: formatMoney(item?.totalEarnings || 0),
          paymentStatus: pending ? "Pending Payment" : "Complete Payment",
          pending,
        };
      }),
    [rows, startIndex]
  );

  return (
    <div className="p-4 bg-gray-50">
      <div className="mx-auto overflow-hidden bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#17b4c9] rounded-t-2xl">
          <h1 className="text-2xl font-semibold text-white">Event Creators</h1>
        </div>

        <div className="px-4 py-3 md:px-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#B9D6EF]">
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">S.ID</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Creator</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Total Events</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Ticket Sold</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Total Earnings</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Payment Status</th>
                  <th className="px-3 py-4 text-sm font-medium text-left text-[#17b4c9]">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {creators.map((creator) => (
                  <tr key={`${creator.creatorId}-${creator.id}`} className="hover:bg-gray-50">
                    <td className="px-3 py-4 text-sm text-gray-800">{String(creator.id).padStart(2, "0")}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={creator.avatar || "https://placehold.co/80x80?text=EC"}
                          alt={creator.name}
                          className="object-cover w-10 h-10 rounded-full"
                        />
                        <span className="text-sm text-gray-800">{creator.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-800">{String(creator.totalEvents).padStart(2, "0")}</td>
                    <td className="px-3 py-4 text-sm text-gray-800">{creator.ticketSold}</td>
                    <td className="px-3 py-4 text-sm text-gray-800">{creator.earnings}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-4 py-1 text-xs font-medium ${
                          creator.pending
                            ? "bg-[#F9A1A1] text-[#8B2424]"
                            : "bg-[#CFF1DC] text-[#216D3D]"
                        }`}
                      >
                        {creator.paymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        to={`/event-creator/${creator.creatorId}`}
                        className="inline-flex p-1 text-[#17b4c9] hover:bg-blue-50 rounded-full"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {creators.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-sm text-center text-slate-500">
                      No event creators found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 px-2 py-6 md:flex-row md:items-center">
            <div className="text-sm font-medium text-[#17b4c9]">
              SHOWING {totalItems ? startIndex + 1 : 0}-{endIndex} OF {totalItems}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="px-3 py-1 text-white rounded-md bg-[#17b4c9]">
                {currentPage}
              </span>
              <span>of {totalPages}</span>
              <button
                className="px-2 py-1 border rounded disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCreators;
