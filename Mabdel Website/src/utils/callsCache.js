// Module-level (not per-component) so Calls.jsx's call list/AI summary/transcript/
// recording-URL caches survive navigating away from /calls and back - but that same
// module-level lifetime means they used to survive logout too: a different account
// signing in on the same tab could briefly see the previous account's cached call
// data before the fresh, correctly-scoped fetch landed. clearCallsCache() is called
// from useAuthStore's logout so a stale account's data never carries across.
export let callsPageCache = null; // { payload, analytics } for page 1 of the call list
export const analysisCache = new Map(); // call id -> { aiSummary, transcript, recordingUrl }

// Regression for R04: logout clearing these caches doesn't stop a request that
// was already in flight when logout happened - it can still resolve afterward
// and write the previous account's data back in, which a subsequent (possibly
// failing) request from the next account would then leave on screen. Callers
// capture getSessionGeneration() before firing a request and compare it again
// before writing the response into either cache; a mismatch means the session
// changed while the request was in flight, so the response is discarded.
let sessionGeneration = 0;

export function getSessionGeneration() {
  return sessionGeneration;
}

export function clearCallsCache() {
  callsPageCache = null;
  analysisCache.clear();
  sessionGeneration += 1;
}

export function setCallsPageCache(value) {
  callsPageCache = value;
}
