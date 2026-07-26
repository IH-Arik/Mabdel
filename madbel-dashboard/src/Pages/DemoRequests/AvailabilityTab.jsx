import { useCallback, useEffect, useState } from "react";
import { message } from "antd";
import { Plus, Trash2 } from "lucide-react";
import {
  createAvailabilitySlots,
  deleteAvailabilitySlot,
  listMyAvailabilitySlots,
} from "../../services/availabilitySlotsApi";

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysIso = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const AvailabilityTab = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("10:00");
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyAvailabilitySlots({ from: todayIso() });
      const d = res?.data || res;
      setSlots(Array.isArray(d) ? d : []);
    } catch {
      message.error("Failed to load your availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!date || !time) return;
    setSaving(true);
    try {
      const weeks = Math.max(1, Number(repeatWeeks) || 1);
      const entries = Array.from({ length: weeks }, (_, i) => ({
        date: addDaysIso(date, i * 7),
        time,
      }));
      const res = await createAvailabilitySlots(entries);
      const data = res?.data || res;
      message.success(
        data?.skipped_duplicates
          ? `Added ${data.created?.length ?? 0} slot(s), skipped ${data.skipped_duplicates} already set.`
          : `Added ${data.created?.length ?? entries.length} slot(s).`
      );
      load();
    } catch (err) {
      message.error(err?.message || "Failed to save availability.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slotId) => {
    try {
      await deleteAvailabilitySlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      message.success("Slot removed.");
    } catch (err) {
      message.error(err?.message || "Failed to remove slot.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Add availability (times in UTC)</h3>
        <p className="mb-4 text-xs text-slate-400">
          Anyone who books this time on the website will land on your calendar, with a Google Meet link if you've
          connected Google Calendar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              min={todayIso()}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Time (UTC)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Repeat weekly</label>
            <select
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#17b4c9]"
            >
              <option value={1}>Just this day</option>
              <option value={2}>2 weeks</option>
              <option value={4}>4 weeks</option>
              <option value={8}>8 weeks</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-[#17b4c9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {saving ? "Saving..." : "Add Slot(s)"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading your availability...</div>
        ) : slots.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No upcoming availability set. Add some slots above so clients can book you.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Time (UTC)</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {slots.map((slot) => (
                <tr key={slot.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">{slot.date}</td>
                  <td className="px-5 py-3">{slot.time}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        slot.status === "booked"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {slot.status === "booked" ? "Booked" : "Open"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {slot.status !== "booked" && (
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Remove slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AvailabilityTab;
