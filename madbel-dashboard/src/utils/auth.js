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

export const clearAdminSession = () => {
  localStorage.removeItem(AUTH_KEY);
};
