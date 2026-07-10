import { GoogleSignin } from "@react-native-google-signin/google-signin";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export async function restoreGoogleCalendarConnection() {
  try {
    if (!GoogleSignin.hasPreviousSignIn()) {
      return null;
    }

    await GoogleSignin.signInSilently();
    const tokens = await GoogleSignin.getTokens();
    if (tokens?.accessToken) {
      return { accessToken: tokens.accessToken };
    }
  } catch {
    // no saved session
  }

  return null;
}

export async function connectGoogleCalendar() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const restored = await restoreGoogleCalendarConnection();
  if (restored?.accessToken) {
    await GoogleSignin.addScopes({ scopes: [GOOGLE_CALENDAR_SCOPE] });
    const tokens = await GoogleSignin.getTokens();
    if (tokens?.accessToken) {
      return { accessToken: tokens.accessToken };
    }
  }

  await GoogleSignin.signIn();
  await GoogleSignin.addScopes({ scopes: [GOOGLE_CALENDAR_SCOPE] });
  const tokens = await GoogleSignin.getTokens();

  if (!tokens?.accessToken) {
    throw new Error("Google Calendar access token not available.");
  }

  return {
    accessToken: tokens.accessToken,
  };
}

export async function createGoogleCalendarEvent(accessToken, event) {
  if (!accessToken) {
    throw new Error("Missing Google Calendar access token.");
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Could not create Google Calendar event.");
  }

  return data;
}

export async function disconnectGoogleCalendar() {
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // Ignore revoke errors and continue clearing local session state.
  }

  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore sign-out errors; the app state will still be cleared.
  }
}
