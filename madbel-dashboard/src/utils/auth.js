const AUTH_KEY = "adminAuth";

const parseJwtPayload = (token) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return nowInSeconds >= payload.exp;
};

export const setAdminSession = ({
  email,
  accessToken = null,
  refreshToken = null,
  profile = null,
}) => {
  localStorage.setItem(
    AUTH_KEY,
    JSON.stringify({
      email,
      accessToken,
      refreshToken,
      profile,
      loggedInAt: new Date().toISOString(),
    })
  );
};

export const getAdminSession = () => {
  const stored = localStorage.getItem(AUTH_KEY);

  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);

    if (!parsed?.accessToken) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }

    if (isTokenExpired(parsed.accessToken)) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
};

export const isAdminAuthenticated = () => Boolean(getAdminSession());

export const getAdminRole = () => {
  const session = getAdminSession();
  return session?.profile?.role || "user";
};

export const clearAdminSession = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const isOnboardingComplete = () => {
  const session = getAdminSession();
  if (!session) return true;
  const role = session?.profile?.role || "user";
  if (["super_admin", "admin", "supervisor", "staff"].includes(role)) return true;
  // If onboarding_complete field is absent (old session), assume complete so existing users aren't blocked
  if (!("onboarding_complete" in (session?.profile || {}))) return true;
  return session.profile.onboarding_complete === true;
};

export const markOnboardingComplete = () => {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return;
  try {
    const session = JSON.parse(stored);
    if (session?.profile) {
      session.profile.onboarding_complete = true;
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
  } catch {}
};
