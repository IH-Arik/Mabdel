import { useCallback, useEffect, useState } from "react";
import {
  assignTelnyxNumber,
  listTelnyxNumbers,
  releaseTelnyxNumber,
} from "../../services/telnyxNumbersApi";

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const TelnyxNumbers = () => {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState("");

  const loadNumbers = useCallback(async () => {
    const payload = await listTelnyxNumbers();
    setNumbers(Array.isArray(payload?.data) ? payload.data : []);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      setLoading(true);
      setError("");
      try {
        await loadNumbers();
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load Telnyx numbers.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, [loadNumbers]);

  const handleRelease = async (phoneNumber) => {
    const ownerPart = phoneNumber.owner_email ? ` from ${phoneNumber.owner_email}` : "";
    const confirmed = window.confirm(
      `Permanently delete ${phoneNumber.phone_number}${ownerPart} from the Telnyx account? ` +
        "This cannot be undone and will immediately stop calling/SMS on this number."
    );
    if (!confirmed) return;

    setActioningId(phoneNumber.phone_number_id);
    setError("");
    try {
      await releaseTelnyxNumber(phoneNumber.phone_number_id);
      await loadNumbers();
    } catch (releaseError) {
      setError(releaseError?.message || "Failed to release number.");
    } finally {
      setActioningId("");
    }
  };

  const handleAssign = async (phoneNumber) => {
    const organizationId = window.prompt(
      `Assign ${phoneNumber.phone_number} to organization id:`
    );
    if (!organizationId || !organizationId.trim()) return;

    setActioningId(phoneNumber.phone_number_id);
    setError("");
    try {
      await assignTelnyxNumber(phoneNumber.phone_number_id, organizationId.trim());
      await loadNumbers();
    } catch (assignError) {
      setError(assignError?.message || "Failed to assign number.");
    } finally {
      setActioningId("");
    }
  };

  return (
    <div className="min-h-screen mx-auto mt-20">
      <div
        style={{ boxShadow: "0px 1px 6px 0px rgba(0, 0, 0, 0.24)" }}
        className="w-full mx-auto rounded-md overflow-hidden"
      >
        <div className="p-4 text-lg font-semibold text-white bg-[#17b4c9] rounded-t-md">
          Telnyx Numbers
        </div>

        {loading ? (
          <div className="p-4 text-sm text-center text-gray-500">Loading numbers...</div>
        ) : numbers.length === 0 ? (
          <div className="p-4 text-sm text-center text-gray-500">No Telnyx numbers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="p-3">Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Usage</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((number) => {
                  const isBusy = actioningId === number.phone_number_id;
                  return (
                    <tr key={number.phone_number_id} className="border-b last:border-b-0">
                      <td className="p-3 font-medium whitespace-nowrap">
                        {number.phone_number}
                        {number.platform ? (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full">
                            Platform
                          </span>
                        ) : number.orphaned ? (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full">
                            Orphaned
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 capitalize">{number.status || "-"}</td>
                      <td className="p-3">{number.owner_email || "Unassigned"}</td>
                      <td className="p-3 whitespace-nowrap">
                        {number.usage?.call_count ?? 0} calls / {number.usage?.total_minutes ?? 0} min
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatDate(number.created_at)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {!number.platform ? (
                            <button
                              onClick={() => handleRelease(number)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Release
                            </button>
                          ) : null}
                          {number.orphaned && !number.platform ? (
                            <button
                              onClick={() => handleAssign(number)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs text-sky-600 border border-sky-300 rounded-md hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Assign
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
    </div>
  );
};

export default TelnyxNumbers;
