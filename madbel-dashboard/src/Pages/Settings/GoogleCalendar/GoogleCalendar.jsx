import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import {
  disconnectIntegration,
  getIntegrationCatalog,
  startIntegrationOAuth,
} from "../../../services/integrationsApi";

const PLATFORM = "google_business";

const GoogleCalendar = () => {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const oauthWindowRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIntegrationCatalog();
      const items = res?.data?.data || res?.data || [];
      setItem(items.find((entry) => entry.platform === PLATFORM) || null);
    } catch {
      message.error("Failed to load Google Calendar status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleFocus() {
      if (oauthWindowRef.current && oauthWindowRef.current.closed) {
        oauthWindowRef.current = null;
        load();
      }
    }
    function handleMessage(event) {
      if (event?.data?.type === "mabdel-google-calendar-oauth") {
        load();
      }
    }
    window.addEventListener("focus", handleFocus);
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("message", handleMessage);
    };
  }, [load]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await startIntegrationOAuth(PLATFORM);
      const url = res?.data?.data?.auth_url || res?.data?.auth_url;
      if (!url) {
        message.error("Did not receive an authorization URL from the server.");
        return;
      }
      // No noopener/noreferrer: the popup needs window.opener intact so the
      // backend's OAuth callback can postMessage back to us when it's done.
      oauthWindowRef.current = window.open(url, "_blank");
    } catch (err) {
      message.error(err?.message || "Failed to start Google Calendar connection.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectIntegration(PLATFORM);
      message.success("Google Calendar disconnected.");
      load();
    } catch (err) {
      message.error(err?.message || "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const connected = Boolean(item?.connected);

  return (
    <div className="min-h-screen bg-white">
      <div
        style={{ boxShadow: "0px 1px 6px 0px rgba(0, 0, 0, 0.24)" }}
        className="mx-auto mt-20 max-w-2xl rounded-md"
      >
        <div className="px-6 py-8 bg-[#17b4c9] rounded-tl-md rounded-tr-md">
          <h1 className="text-2xl font-semibold text-white">Google Calendar</h1>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-[#4285F4]/10 p-3 text-[#4285F4]">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">Google Calendar</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Connect your Google Calendar so confirmed meeting requests get a real Google Meet link and land
                    on your calendar automatically.
                  </p>
                  {connected && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      Connected{item.external_account_name ? ` as ${item.external_account_name}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {connected ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={busy}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={busy}
                    className="rounded-xl bg-[#17b4c9] px-5 py-2 text-sm font-semibold text-white hover:bg-[#149cb0] transition-colors disabled:opacity-50"
                  >
                    {busy ? "Opening..." : "Connect Google Calendar"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendar;
