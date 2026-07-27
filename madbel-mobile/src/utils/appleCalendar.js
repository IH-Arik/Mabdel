import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const APPLE_CALENDAR_STORAGE_KEY = "@madbel/apple-calendar";

let calendarModulePromise = null;

const getAppleCalendarModule = async () => {
  if (!calendarModulePromise) {
    calendarModulePromise = import("expo-calendar");
  }

  return calendarModulePromise;
};

const isWritableCalendar = (calendar) => Boolean(calendar?.allowsModifications);

const normalizeCalendarRecord = (calendar) =>
  calendar
    ? {
        calendarId: calendar.id,
        calendarName: calendar.title || "Apple Calendar",
      }
    : null;

const loadStoredCalendarSelection = async () => {
  try {
    const raw = await AsyncStorage.getItem(APPLE_CALENDAR_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.calendarId) return null;

    return parsed;
  } catch {
    return null;
  }
};

const saveCalendarSelection = async (calendar) => {
  const selection = normalizeCalendarRecord(calendar);
  if (!selection) return;

  await AsyncStorage.setItem(
    APPLE_CALENDAR_STORAGE_KEY,
    JSON.stringify(selection),
  );
};

const findWritableCalendar = async (Calendar, preferredCalendarId = null) => {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const writableCalendars = calendars.filter(isWritableCalendar);

  if (!writableCalendars.length) {
    return null;
  }

  if (preferredCalendarId) {
    const preferred = writableCalendars.find(
      (calendar) => calendar.id === preferredCalendarId,
    );
    if (preferred) {
      return preferred;
    }
  }

  if (Platform.OS === "ios") {
    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar?.id) {
        const matchingDefault = writableCalendars.find(
          (calendar) => calendar.id === defaultCalendar.id,
        );
        if (matchingDefault) {
          return matchingDefault;
        }
      }
    } catch {
      // Fall back to the first writable calendar.
    }
  }

  return writableCalendars[0];
};

export async function restoreAppleCalendarConnection() {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    const Calendar = await getAppleCalendarModule();
    const permission = await Calendar.getCalendarPermissionsAsync();

    if (permission?.status !== "granted") {
      return null;
    }

    const storedSelection = await loadStoredCalendarSelection();
    const selectedCalendar = await findWritableCalendar(
      Calendar,
      storedSelection?.calendarId,
    );

    if (!selectedCalendar) {
      return null;
    }

    await saveCalendarSelection(selectedCalendar);
    return normalizeCalendarRecord(selectedCalendar);
  } catch {
    return null;
  }
}

export async function connectAppleCalendar() {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Calendar is only available on iOS devices.");
  }

  const Calendar = await getAppleCalendarModule();
  const permission = await Calendar.requestCalendarPermissionsAsync();

  if (permission?.status !== "granted") {
    throw new Error("Apple Calendar permission was not granted.");
  }

  const selectedCalendar = await findWritableCalendar(Calendar);

  if (!selectedCalendar) {
    throw new Error("No writable Apple Calendar was found on this device.");
  }

  await saveCalendarSelection(selectedCalendar);
  return normalizeCalendarRecord(selectedCalendar);
}

export async function createAppleCalendarEvent(connection, event) {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Calendar is only available on iOS devices.");
  }

  const Calendar = await getAppleCalendarModule();
  const calendarId = connection?.calendarId;

  if (!calendarId) {
    throw new Error("Missing Apple Calendar selection.");
  }

  const startDate =
    event?.startDate instanceof Date
      ? event.startDate
      : new Date(event?.startDate);
  const endDate =
    event?.endDate instanceof Date ? event.endDate : new Date(event?.endDate);

  if (
    Number.isNaN(startDate?.getTime?.()) ||
    Number.isNaN(endDate?.getTime?.())
  ) {
    throw new Error("Invalid Apple Calendar event dates.");
  }

  const eventId = await Calendar.createEventAsync(calendarId, {
    title: event?.title || "Meeting",
    notes: event?.notes || "",
    location: event?.location || "",
    startDate,
    endDate,
    timeZone: event?.timeZone,
  });

  return {
    id: eventId,
    calendarId,
    calendarName: connection?.calendarName || "Apple Calendar",
  };
}

export async function disconnectAppleCalendar() {
  await AsyncStorage.removeItem(APPLE_CALENDAR_STORAGE_KEY);
}
