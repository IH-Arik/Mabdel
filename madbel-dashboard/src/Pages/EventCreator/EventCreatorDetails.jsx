import { useEffect, useMemo, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useParams } from "react-router-dom";
import { getEventCreatorById, payoutEventCreator } from "../../services/eventCreatorsApi";

const formatMoney = (value) => `$${Number(value || 0).toLocaleString()}`;

const statusClasses = {
  pending: "bg-[#F8E8B1] text-[#A56403]",
  complete: "bg-[#CFF1DC] text-[#216D3D]",
};

const eventStatusClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "bg-[#CFF1DC] text-[#216D3D]";
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "rejected") {
    return "bg-[#FBD9D9] text-[#A23838]";
  }
  return "bg-[#DCEBFF] text-[#3B6EA0]";
};

const EventCreatorDetails = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const payload = await getEventCreatorById({ id });
        if (!mounted) return;
        const data = payload?.data ?? payload;
        setDetails(data || null);
      } catch {
        if (mounted) setDetails(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (id) load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const creator = details?.creator || {};
  const metrics = details?.metrics || {};
  const events = Array.isArray(details?.events) ? details.events : [];
  const payoutStatus = String(metrics?.paymentStatus || "pending").toLowerCase();

  const payoutDisabled = useMemo(
    () => !id || Number(metrics?.pendingAmount || 0) <= 0 || processingPayout,
    [id, metrics?.pendingAmount, processingPayout]
  );

  const handleProcessPayout = async () => {
    if (!id || payoutDisabled) return;
    try {
      setProcessingPayout(true);
      await payoutEventCreator({ id, body: {} });
      const payload = await getEventCreatorById({ id });
      const data = payload?.data ?? payload;
      setDetails(data || null);
    } finally {
      setProcessingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50">
        <div className="p-10 text-sm text-center bg-white border rounded-2xl border-slate-100 shadow-sm text-slate-500">
          Loading event creator details...
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50">
      <div className="mx-auto bg-white border rounded-2xl border-slate-100 shadow-sm">
        <div className="sticky top-0 z-10 px-6 py-4 bg-[#17b4c9]">
          <h1 className="text-2xl font-semibold text-white">Event Creator</h1>
        </div>

        <div className="p-4 space-y-4 md:p-6">
          <div className="p-4 border border-gray-200 rounded-2xl">
            <div className="flex items-center gap-4">
              <img
                src={creator?.avatarUrl || "https://placehold.co/120x120?text=EC"}
                alt={creator?.fullName || "Event creator"}
                className="object-cover w-14 h-14 rounded-full"
              />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {creator?.fullName || "N/A"}
                </h2>
                <p className="text-sm text-gray-500">{creator?.email || "N/A"}</p>
                <span className="inline-flex items-center gap-2 px-3 py-1 mt-2 text-xs text-green-700 rounded-full bg-green-100">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  {creator?.status || "active"}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden border border-gray-200 rounded-2xl">
            <div className="px-4 py-3 text-base font-semibold text-gray-900 border-b border-gray-200 md:px-6">
              Events Created
            </div>

            {events.map((event) => (
              <div
                key={event?._id || event?.id || `${event?.title}-${event?.createdAt}`}
                className="flex flex-col gap-2 px-4 py-3 border-b border-gray-200 md:px-6 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    {event?.title || "Untitled Event"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {event?.startAt ? new Date(event.startAt).toLocaleString() : "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    {formatMoney(event?.ticketPrice)} ticket price
                    <span className="mx-2 text-gray-400">|</span>
                    {(event?.stats?.joinedCount || 0)} sold
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-semibold text-[#16A34A]">
                    {formatMoney(event?.ticketPrice)}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs ${eventStatusClass(event?.status)}`}
                  >
                    {event?.status || "draft"}
                  </span>
                </div>
              </div>
            ))}

            {events.length === 0 ? (
              <div className="px-4 py-6 text-sm text-center text-slate-500">No events found.</div>
            ) : null}
          </div>

          <div className="p-4 bg-[#E9EEF8] rounded-2xl md:p-6">
            <h3 className="text-xl font-semibold text-gray-900">Payout Information</h3>
            <p className="mt-1 text-sm text-gray-600">
              Current balance and withdrawal summary
            </p>

            <div className="grid grid-cols-1 gap-5 mt-5 md:grid-cols-3">
              <div>
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-3xl font-bold text-gray-900">{formatMoney(metrics?.pendingAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatMoney(metrics?.totalEarnings)}
                </p>
                <p className="text-lg text-gray-500">
                  Paid Out: {formatMoney(metrics?.totalPaidOut)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payout Status</p>
                <span
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${statusClasses[payoutStatus] || statusClasses.pending}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-current" />
                  {payoutStatus === "complete" ? "Complete" : "Pending Review"}
                </span>
              </div>
            </div>

            <button
              onClick={handleProcessPayout}
              disabled={payoutDisabled}
              className="inline-flex items-center gap-2 px-5 py-2 mt-6 text-sm text-white rounded-xl bg-[#17b4c9] hover:bg-[#5a9ad7] disabled:opacity-50"
            >
              <SendHorizontal className="w-5 h-5" />
              {processingPayout ? "Processing..." : "Process Payout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCreatorDetails;
