import { useCallback, useEffect, useState } from "react";
import { message, Modal } from "antd";
import { Mail, MessageSquare, Phone } from "lucide-react";
import {
  getDemoRequest,
  listDemoRequests,
  replyToDemoRequest,
  updateDemoRequestStatus,
} from "../../services/demoRequestsApi";

const STATUS_BADGES = {
  new: { label: "New", color: "bg-amber-100 text-amber-700" },
  replied: { label: "Replied", color: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Closed", color: "bg-slate-200 text-slate-600" },
};

const MessagesTab = ({ onSummary }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDemoRequests({ status: statusFilter || undefined });
      const d = res?.data || res;
      setItems(d?.items || []);
      onSummary?.(d?.summary || {});
    } catch {
      message.error("Failed to load demo requests.");
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
    setReplyText("");
    setDetailLoading(true);
    try {
      const res = await getDemoRequest(id);
      setDetail(res?.data || res);
    } catch {
      message.error("Failed to load this demo request.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setActiveId(null);
    setDetail(null);
    setReplyText("");
  };

  const handleReply = async () => {
    if (!replyText.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await replyToDemoRequest({ requestId: activeId, message: replyText.trim() });
      setDetail(res?.data || res);
      setReplyText("");
      message.success("Reply sent.");
      loadList();
    } catch (err) {
      message.error(err?.message || "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  const handleMarkClosed = async () => {
    if (!activeId) return;
    try {
      const res = await updateDemoRequestStatus({ requestId: activeId, status: "closed" });
      setDetail(res?.data || res);
      message.success("Marked as closed.");
      loadList();
    } catch (err) {
      message.error(err?.message || "Failed to update status.");
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {[
          { value: "", label: "All" },
          { value: "new", label: "New" },
          { value: "replied", label: "Replied" },
          { value: "closed", label: "Closed" },
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
          <div className="p-8 text-center text-sm text-slate-400">Loading demo requests...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No demo requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Contact</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Message</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const badge = STATUS_BADGES[item.status] || STATUS_BADGES.new;
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
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{item.message}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}
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
              <p className="text-xs font-normal text-slate-400 mt-0.5">Demo Request</p>
            </div>
          ) : (
            "Demo Request"
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

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Message</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.message}</p>
            </div>

            {detail.replies?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Replies
                </p>
                {detail.replies.map((r, i) => (
                  <div key={i} className="rounded-xl bg-cyan-50/60 border border-cyan-100 p-3 text-sm">
                    <p className="text-slate-700 whitespace-pre-wrap">{r.message}</p>
                    <p className="mt-1.5 text-xs text-slate-400">
                      {r.admin_name} &middot; {r.sent_at ? new Date(r.sent_at).toLocaleString() : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {detail.status !== "closed" && (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder={`Reply to ${detail.first_name}... (sent to ${detail.email})`}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9] focus:ring-1 focus:ring-[#17b4c9] resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleMarkClosed}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Mark as Closed
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={sending || !replyText.trim()}
                    className="rounded-xl bg-[#17b4c9] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors disabled:opacity-50"
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default MessagesTab;
