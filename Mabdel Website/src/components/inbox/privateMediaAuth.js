import { API_BASE_URL } from '../../api/client';

const PRIVATE_MEDIA_PATH_PREFIX = '/api/v1/media/private/';
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return null;
  }
})();

// Private attachment URLs (/media/private/...) require authentication, but
// <img>/<audio>/<video> src and a plain <a href> can't attach an Authorization
// header - the backend accepts the access token as a query param for this one
// route specifically so these tags can still work.
//
// Regression for R07: a substring check on the whole URL (".includes('/media/private/')")
// matched an attacker-controlled host too, e.g.
// https://attacker.example/media/private/x.png - the session access token was then
// attached and the browser auto-fetched it as an <img> src, leaking the token to
// that host. The URL must resolve to OUR OWN api origin and the real private-media
// path before a token is ever attached.
export function withAuth(url) {
  if (!url) return url;
  let parsed;
  try {
    parsed = new URL(url, API_BASE_URL);
  } catch {
    return url;
  }
  if (!API_ORIGIN || parsed.origin !== API_ORIGIN) return url;
  if (!parsed.pathname.startsWith(PRIVATE_MEDIA_PATH_PREFIX)) return url;
  const token = localStorage.getItem('access_token');
  if (!token) return url;
  parsed.searchParams.set('token', token);
  return parsed.toString();
}
