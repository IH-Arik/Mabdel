import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { responsiveHeight } from "react-native-responsive-dimensions";
import { useAppLanguage } from "../../../context/LanguageContext";
import {
  useMadbelCreateCalendarEventMutation,
  useMadbelListContactsQuery,
} from "../../../redux/slices/madbelApiSlice";
import useKeyboard from "../../../hooks/useKeyboard";
import {
  connectGoogleCalendar as connectGoogleCalendarAuth,
  createGoogleCalendarEvent,
  disconnectGoogleCalendar,
  restoreGoogleCalendarConnection,
} from "../../../utils/googleCalendarAuth";
import {
  connectAppleCalendar,
  createAppleCalendarEvent,
  disconnectAppleCalendar,
  restoreAppleCalendarConnection,
} from "../../../utils/appleCalendar";
import { parseServerDateTime } from "../../../utils/formatDateTime";
import { mergeDateAndTime } from "../createMeetingScheduleHelpers";

export const useCreateMeetingScheduleLogic = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const prefill = route?.params?.prefill || {};
  const selectedDateFromRoute = route?.params?.selectedDate;
  const startsAt = prefill?.starts_at
    ? parseServerDateTime(prefill.starts_at)
    : null;
  const hasValidStart = startsAt && !Number.isNaN(startsAt.getTime());
  const { t } = useAppLanguage();

  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarAccessToken, setGoogleCalendarAccessToken] =
    useState("");
  const [googleCalendarSyncStatus, setGoogleCalendarSyncStatus] =
    useState("idle");
  const [googleCalendarSyncMessage, setGoogleCalendarSyncMessage] =
    useState("");
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleCalendarConnected, setAppleCalendarConnected] = useState(false);
  const [appleCalendarId, setAppleCalendarId] = useState("");
  const [appleCalendarName, setAppleCalendarName] = useState("");
  const [appleCalendarSyncStatus, setAppleCalendarSyncStatus] =
    useState("idle");
  const [appleCalendarSyncMessage, setAppleCalendarSyncMessage] = useState("");
  const keyboardHeight = useKeyboard();

  const [createCalendarEvent, { isLoading: creatingMeeting }] =
    useMadbelCreateCalendarEventMutation();
  const { data: contactsResponse, isFetching: contactsFetching } =
    useMadbelListContactsQuery({ page: 1, page_size: 100 });

  const contacts = contactsResponse?.data?.items || [];

  const [meetingTitle, setMeetingTitle] = useState(
    prefill?.title || "Project Sync with Design Team",
  );
  const [meetingDescription, setMeetingDescription] = useState(
    prefill?.description ||
      route?.params?.prefillPrompt ||
      "Discussion on roadmap and delivery blockers.",
  );
  const [dateISO, setDateISO] = useState(
    hasValidStart
      ? startsAt.toISOString().slice(0, 10)
      : selectedDateFromRoute || new Date().toISOString().slice(0, 10),
  );
  const [startTimeSlot, setStartTimeSlot] = useState(
    hasValidStart ? startsAt : new Date(),
  );
  const [endTimeSlot, setEndTimeSlot] = useState(() => {
    const base = hasValidStart && startsAt ? startsAt : new Date();
    return new Date(base.getTime() + 60 * 60 * 1000);
  });
  const [location, setLocation] = useState(
    prefill?.location || "HQ - Meeting Room 4",
  );
  const [meetingMode, setMeetingMode] = useState(
    prefill?.meeting_mode || "offline",
  );
  const [meetingLink, setMeetingLink] = useState(prefill?.meeting_link || "");
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySMS, setNotifySMS] = useState(false);
  const [activeReminder, setActiveReminder] = useState("10 min");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(
    Array.isArray(prefill?.contact_ids) ? prefill.contact_ids : [],
  );

  // Applies a prefill object to all form state fields
  const applyPrefill = (p) => {
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    if (p.title) setMeetingTitle(p.title);
    if (p.description) setMeetingDescription(p.description);
    if (p.starts_at) {
      const d = parseServerDateTime(p.starts_at);
      if (d) {
        setDateISO(d.toISOString().slice(0, 10));
        setStartTimeSlot(d);
      }
    }
    if (p.ends_at) {
      const d = parseServerDateTime(p.ends_at);
      if (d) setEndTimeSlot(d);
    }
    if (p.location) setLocation(p.location);
    if (p.meeting_mode) setMeetingMode(p.meeting_mode);
    if (p.meeting_link) setMeetingLink(p.meeting_link);
  };

  // React to VoiceFormFillCard setting route params
  useEffect(() => {
    const p = route?.params?.prefill;
    applyPrefill(p);
    if (p && Object.keys(p).length) {
      navigation.setParams?.({ prefill: undefined });
    }
  }, [route?.params?.prefill]);

  useEffect(() => {
    let cancelled = false;
    const restoreGoogleCalendar = async () => {
      try {
        const restored = await restoreGoogleCalendarConnection();
        const accessToken = restored?.accessToken;
        if (!cancelled && accessToken) {
          setGoogleCalendarAccessToken(accessToken);
          setGoogleCalendarConnected(true);
          setGoogleCalendarSyncStatus("connected");
          setGoogleCalendarSyncMessage(
            "Google Calendar is connected on this device.",
          );
        }
      } catch {
        // No saved Google session yet; user can connect from this screen.
      }
    };

    restoreGoogleCalendar();
    const restoreAppleCalendar = async () => {
      try {
        const restored = await restoreAppleCalendarConnection();
        if (!cancelled && restored?.calendarId) {
          setAppleCalendarId(restored.calendarId);
          setAppleCalendarName(restored.calendarName || "Apple Calendar");
          setAppleCalendarConnected(true);
          setAppleCalendarSyncStatus("connected");
          setAppleCalendarSyncMessage(
            `${restored.calendarName || "Apple Calendar"} is connected on this device.`,
          );
        }
      } catch {
        // No saved Apple session yet; user can connect from this screen.
      }
    };

    restoreAppleCalendar();
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLabel = useMemo(
    () =>
      new Date(dateISO).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    [dateISO],
  );

  const footerBottomMargin =
    keyboardHeight > 0
      ? keyboardHeight + insets.bottom + responsiveHeight(1)
      : insets.bottom + responsiveHeight(5);

  const toggleRecipient = (contactId) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const handleGoogleCalendarConnect = async () => {
    setGoogleLoading(true);
    try {
      const { accessToken } = await connectGoogleCalendarAuth();
      setGoogleCalendarAccessToken(accessToken);
      setGoogleCalendarConnected(true);
      setGoogleCalendarSyncStatus("connected");
      setGoogleCalendarSyncMessage(
        "Google Calendar is connected on this device.",
      );
      Alert.alert(t("success"), "Google Calendar connected successfully.");
    } catch (error) {
      if (error?.code === "SIGN_IN_CANCELLED") return;
      Alert.alert(
        t("error"),
        error?.data?.message ||
          error?.message ||
          "Google Calendar sign-in failed.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleCalendarDisconnect = async () => {
    setGoogleLoading(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleCalendarAccessToken("");
      setGoogleCalendarConnected(false);
      setGoogleCalendarSyncStatus("idle");
      setGoogleCalendarSyncMessage("Google Calendar disconnected.");
      Alert.alert(t("success"), "Google Calendar disconnected successfully.");
    } catch (error) {
      Alert.alert(
        t("error"),
        error?.message || "Could not disconnect Google Calendar.",
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleCalendarConnect = async () => {
    setAppleLoading(true);
    try {
      const restored = await connectAppleCalendar();
      setAppleCalendarId(restored.calendarId);
      setAppleCalendarName(restored.calendarName || "Apple Calendar");
      setAppleCalendarConnected(true);
      setAppleCalendarSyncStatus("connected");
      setAppleCalendarSyncMessage(
        `${restored.calendarName || "Apple Calendar"} is connected on this device.`,
      );
      Alert.alert(t("success"), "Apple Calendar connected successfully.");
    } catch (error) {
      Alert.alert(
        t("error"),
        error?.message || "Apple Calendar connection failed.",
      );
    } finally {
      setAppleLoading(false);
    }
  };

  const handleAppleCalendarDisconnect = async () => {
    setAppleLoading(true);
    try {
      await disconnectAppleCalendar();
      setAppleCalendarId("");
      setAppleCalendarName("");
      setAppleCalendarConnected(false);
      setAppleCalendarSyncStatus("idle");
      setAppleCalendarSyncMessage("Apple Calendar disconnected.");
      Alert.alert(t("success"), "Apple Calendar disconnected successfully.");
    } catch (error) {
      Alert.alert(
        t("error"),
        error?.message || "Could not disconnect Apple Calendar.",
      );
    } finally {
      setAppleLoading(false);
    }
  };

  const sendMeeting = async () => {
    const startsAtDate = mergeDateAndTime(dateISO, startTimeSlot, true);
    if (!startsAtDate) {
      Alert.alert(t("invalid_time"), t("use_a_valid_time_like_10_00_am"));
      return;
    }

    const endsAtDate = mergeDateAndTime(dateISO, endTimeSlot, true);
    if (!endsAtDate) {
      Alert.alert(t("invalid_time"), t("use_a_valid_time_like_10_00_am"));
      return;
    }
    if (endsAtDate <= startsAtDate) {
      Alert.alert(
        t("invalid_time_range"),
        t("end_time_must_be_later_than_start_time"),
      );
      return;
    }
    if (!meetingTitle.trim()) {
      Alert.alert(t("missing_title"), t("please_add_a_meeting_title"));
      return;
    }

    try {
      const payload = {
        title: meetingTitle.trim(),
        description: meetingDescription.trim() || undefined,
        starts_at: startsAtDate.toISOString(),
        ends_at: endsAtDate.toISOString(),
        contact_ids: selectedRecipientIds,
        meeting_mode: meetingMode,
        location:
          meetingMode === "offline" ? location.trim() || undefined : undefined,
        meeting_link:
          meetingMode === "online"
            ? meetingLink.trim() || undefined
            : undefined,
        // notify_via_push: notifyPush,
        // notify_via_email: notifyEmail,
        // notify_via_sms: notifySMS,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        // reminder_minutes: REMINDER_TO_MINUTES[activeReminder] || 10,
      };

      const response = await createCalendarEvent(payload).unwrap();
      let createdGoogleEvent = null;
      let createdAppleEvent = null;

      if (googleCalendarConnected && googleCalendarAccessToken) {
        try {
          setGoogleCalendarSyncStatus("syncing");
          setGoogleCalendarSyncMessage(
            "Syncing this meeting to Google Calendar...",
          );
          createdGoogleEvent = await createGoogleCalendarEvent(
            googleCalendarAccessToken,
            {
              summary: payload.title,
              description: payload.description || "",
              location: payload.location || payload.meeting_link || "",
              start: {
                dateTime: payload.starts_at,
                timeZone: payload.timezone,
              },
              end: {
                dateTime: payload.ends_at,
                timeZone: payload.timezone,
              },
            },
          );
          setGoogleCalendarSyncStatus("synced");
          setGoogleCalendarSyncMessage(
            createdGoogleEvent?.htmlLink
              ? "Meeting synced to Google Calendar."
              : "Meeting synced to Google Calendar, but no event link was returned.",
          );
        } catch (googleError) {
          setGoogleCalendarSyncStatus("failed");
          setGoogleCalendarSyncMessage(
            googleError?.message || "Google Calendar sync failed.",
          );
        }
      } else {
        setGoogleCalendarSyncStatus("idle");
        setGoogleCalendarSyncMessage("");
      }

      if (appleCalendarConnected && appleCalendarId) {
        try {
          setAppleCalendarSyncStatus("syncing");
          setAppleCalendarSyncMessage(
            "Syncing this meeting to Apple Calendar...",
          );
          createdAppleEvent = await createAppleCalendarEvent(
            {
              calendarId: appleCalendarId,
              calendarName: appleCalendarName,
            },
            {
              title: payload.title,
              notes: payload.description || "",
              location: payload.location || payload.meeting_link || "",
              startDate: startsAtDate,
              endDate: endsAtDate,
              timeZone: payload.timezone,
            },
          );
          setAppleCalendarSyncStatus("synced");
          setAppleCalendarSyncMessage(
            `Meeting synced to ${appleCalendarName || "Apple Calendar"}.`,
          );
        } catch (appleError) {
          setAppleCalendarSyncStatus("failed");
          setAppleCalendarSyncMessage(
            appleError?.message || "Apple Calendar sync failed.",
          );
        }
      } else {
        setAppleCalendarSyncStatus("idle");
        setAppleCalendarSyncMessage("");
      }

      navigation.navigate("MeetingDetails", {
        event: response?.data || response,
        googleCalendarEvent: createdGoogleEvent,
        appleCalendarEvent: createdAppleEvent,
      });
    } catch (error) {
      Alert.alert(
        "Schedule failed",
        error?.data?.message || "Could not create the meeting schedule.",
      );
    }
  };

  return {
    navigation,
    t,

    voiceTrigger,
    setVoiceTrigger,
    googleLoading,
    googleCalendarConnected,
    googleCalendarSyncMessage,
    googleCalendarSyncStatus,
    appleLoading,
    appleCalendarConnected,
    appleCalendarSyncMessage,
    appleCalendarSyncStatus,

    creatingMeeting,
    contacts,
    contactsFetching,

    meetingTitle,
    setMeetingTitle,
    meetingDescription,
    setMeetingDescription,
    dateISO,
    setDateISO,
    startTimeSlot,
    setStartTimeSlot,
    endTimeSlot,
    setEndTimeSlot,
    location,
    setLocation,
    meetingMode,
    setMeetingMode,
    meetingLink,
    setMeetingLink,
    notifyPush,
    setNotifyPush,
    notifyEmail,
    setNotifyEmail,
    notifySMS,
    setNotifySMS,
    activeReminder,
    setActiveReminder,
    calendarVisible,
    setCalendarVisible,
    selectedRecipientIds,

    dateLabel,
    footerBottomMargin,
    toggleRecipient,
    handleGoogleCalendarConnect,
    handleGoogleCalendarDisconnect,
    handleAppleCalendarConnect,
    handleAppleCalendarDisconnect,
    sendMeeting,
  };
};
