import { useCallback, useEffect, useState } from "react";
import { message, Modal } from "antd";
import { Mail, Phone, Video } from "lucide-react";
import {
  acceptMeetingRequest,
  declineMeetingRequest,
  getMeetingRequest,
  listMeetingRequests,
  proposeMeetingTime,
} from "../../services/meetingRequestsApi";

const STATUS_BADGES = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700" },
  proposed: { label: "Proposed", color: "bg-sky-100 text-sky-700" },
  confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Declined", color: "bg-slate-200 text-slate-600" },
};

const fmt = (value) => (value ? new Date(value).toLocaleString() : "—");

// datetime-local expects "YYYY-MM-DDTHH:mm" in local time
const toDatetimeLocalValue = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const MeetingRequestsTab = ({ onSummary }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposedStart, setProposedStart] = useState("");
  const [proposedEnd, setProposedEnd] = useState("");
  const [proposeNote, setProposeNote] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMeetingRequests({ status: statusFilter || undefined });
      const d = res?.data || res;
      setItems(d?.items || []);
      onSummary?.(d?.summary || {});
    } catch {
      message.error("Failed to load meeting requests.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDetail = async (id) => {
    setActiveId(id);
    setDetail(null);
    setShowProposeForm(false);
    setDetailLoading(true);
    try {
      const res = await getMeetingRequest(id);
      const data = res?.data || res;
      setDetail(data);
      if (data?.requested_start) {
        const start = new Date(data.requested_start);
        const end = data.requested_end ? new Date(data.requested_end) : new Date(start.getTime() + 30 * 60000);
        setProposedStart(toDatetimeLocalValue(start));
        setProposedEnd(toDatetimeLocalValue(end));
      }
    } catch {
      message.error("Failed to load this meeting request.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setActiveId(null);
    setDetail(null);
    setShowProposeForm(false);
    setProposeNote("");
  };

  const handleAccept = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const res = await acceptMeetingRequest(activeId);
      setDetail(res?.data || res);
      message.success("Meeting confirmed — the requester has been emailed.");
      loadList();
    } catch (err) {
      message.error(err?.message || "Failed to accept meeting.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!activeId) return;
    setBusy(true);
    try {
      const res = await declineMeetingRequest(activeId);
      setDetail(res?.data || res);
      message.success("Meeting request declined.");
      loadList();
    } catch (err) {
      message.error(err?.message || "Failed to decline meeting.");
    } finally {
      setBusy(false);
    }
  };

  const handlePropose = async () => {
    if (!activeId || !proposedStart || !proposedEnd) return;
    setBusy(true);
    try {
      const res = await proposeMeetingTime({
        requestId: activeId,
        proposedStart: new Date(proposedStart).toISOString(),
        proposedEnd: new Date(proposedEnd).toISOString(),
        note: proposeNote.trim() || undefined,
      });
      setDetail(res?.data || res);
      setShowProposeForm(false);
      setProposeNote("");
      message.success("New time proposed — the requester has been emailed a confirmation link.");
      loadList();
    } catch (err) {
      message.error(err?.message || "Failed to propose a new time.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {[
          { value: "", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "proposed", label: "Proposed" },
          { value: "confirmed", label: "Confirmed" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === s.value
                ? "bg-[#17b4c9] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading meeting requests...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No meeting requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Contact</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Requested Time</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-800">
                        {item.first_name} {item.last_name}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        <div>{item.email}</div>
                        <div>{item.phone}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {fmt(item.confirmed_start || item.requested_start)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(activeId)}
        onCancel={closeDetail}
        footer={null}
        width={620}
        title={
          detail ? (
            <div>
              <p className="font-bold text-slate-900">{detail.first_name} {detail.last_name}</p>
              <p className="text-xs font-normal text-slate-400 mt-0.5">Meeting Request</p>
            </div>
          ) : (
            "Meeting Request"
          )
        }
      >
        {detailLoading || !detail ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading...</div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> {detail.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> {detail.phone || "—"}
              </div>
            </div>

            {detail.notes && (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Requested Time</p>
              <p className="text-sm text-slate-700">{fmt(detail.requested_start)}</p>
            </div>

            {detail.status === "confirmed" && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Confirmed</p>
                <p className="text-sm text-emerald-800">{fmt(detail.confirmed_start)}</p>
                {detail.meeting_link ? (
                  <a
                    href={detail.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#17b4c9] hover:underline"
                  >
                    <Video className="w-4 h-4" /> Join Google Meet
                  </a>
                ) : (
                  <p className="text-xs text-emerald-700/70">
                    No Google Meet link — connect Google Calendar in Settings to auto-generate one.
                  </p>
                )}
              </div>
            )}

            {detail.status === "proposed" && detail.proposal && (
              <div className="rounded-xl bg-sky-50 border border-sky-100 p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Proposed Time (awaiting requester)</p>
                <p className="text-sm text-sky-800">{fmt(detail.proposal.proposed_start)}</p>
                {detail.proposal.note && <p className="text-xs text-sky-700/80 italic">{detail.proposal.note}</p>}
              </div>
            )}

            {(detail.status === "pending" || detail.status === "proposed") && (
              <div className="space-y-3">
                {!showProposeForm ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAccept}
                      disabled={busy}
                      className="flex-1 rounded-xl bg-[#17b4c9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors disabled:opacity-50"
                    >
                      {busy ? "Working..." : "Accept Requested Time"}
                    </button>
                    <button
                      onClick={() => setShowProposeForm(true)}
                      disabled={busy}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Propose Another Time
                    </button>
                    <button
                      onClick={handleDecline}
                      disabled={busy}
                      className="rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Start</label>
                        <input
                          type="datetime-local"
                          value={proposedStart}
                          onChange={(e) => setProposedStart(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">End</label>
                        <input
                          type="datetime-local"
                          value={proposedEnd}
                          onChange={(e) => setProposedEnd(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
                        />
                      </div>
                    </div>
                    <textarea
                      value={proposeNote}
                      onChange={(e) => setProposeNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note to include in the email..."
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowProposeForm(false)}
                        className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePropose}
                        disabled={busy || !proposedStart || !proposedEnd}
                        className="rounded-xl bg-[#17b4c9] px-5 py-2 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors disabled:opacity-50"
                      >
                        {busy ? "Sending..." : "Send Proposal"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default MeetingRequestsTab;
