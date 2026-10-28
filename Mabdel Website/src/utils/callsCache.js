// Module-level (not per-component) so Calls.jsx's call list/AI summary/transcript/
// recording-URL caches survive navigating away from /calls and back - but that same
// module-level lifetime means they used to survive logout too: a different account
// signing in on the same tab could briefly see the previous account's cached call
// data before the fresh, correctly-scoped fetch landed. clearCallsCache() is called
// from useAuthStore's logout so a stale account's data never carries across.
export let callsPageCache = null; // { payload, analytics } for page 1 of the call list
export const analysisCache = new Map(); // call id -> { aiSummary, transcript, recordingUrl }

export function clearCallsCache() {
  callsPageCache = null;
  analysisCache.clear();
}

export function setCallsPageCache(value) {
  callsPageCache = value;
}
