import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setAdminSession, clearAdminSession } from "../../../utils/auth";
import { apiRequest } from "../../../services/httpClient";

// Lets an already-authenticated Website (Mabdel Website) user land here with
// their access token and get signed into the Dashboard app automatically,
// instead of typing their email/password a second time.
const SSOBridge = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      navigate("/sign-in", { replace: true });
      return;
    }

    (async () => {
      try {
        // Bootstrap a minimal session so apiRequest can find the token to verify it.
        setAdminSession({ email: "", accessToken: token, refreshToken: null, profile: null });
        const res = await apiRequest("/auth/me");
        const user = res?.data || res;

        setAdminSession({
          email: user?.email || "",
          accessToken: token,
          refreshToken: null,
          profile: {
            name: user?.full_name,
            full_name: user?.full_name,
            email: user?.email,
            role: user?.role || user?.primary_role || "user",
          },
        });
        navigate("/", { replace: true });
      } catch {
        clearAdminSession();
        setError("Could not sign you in automatically. Redirecting to login...");
        setTimeout(() => navigate("/sign-in", { replace: true }), 1800);
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0f8b9c 0%, #17b4c9 50%, #e0f7fa 100%)" }}
    >
      <div className="bg-white rounded-2xl px-8 py-10 shadow-xl text-center max-w-sm w-full">
        <p className="text-slate-700 font-semibold">
          {error || "Signing you in..."}
        </p>
      </div>
    </div>
  );
};

export default SSOBridge;
