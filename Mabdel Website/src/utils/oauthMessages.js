import { API_BASE_URL } from '../api/client';

// The OAuth popup pages are served by the backend, so a genuine completion message can
// only come from the API's origin. Ignoring everything else stops any other window
// (an embedded frame, a popup opened by another site) from poking our refetch logic.
export function isTrustedOAuthMessage(event, expectedTypes) {
  let apiOrigin;
  try {
    apiOrigin = new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
  return event.origin === apiOrigin && expectedTypes.includes(event?.data?.type);
}
