import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,

  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  Mail,
  MapPin,
  Mic,
  NotebookPen,
  Phone,
  Bell,
} from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation, useRoute } from "@react-navigation/native";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import {
  useMadbelCreateCalendarEventMutation,
  useMadbelListContactsQuery,
} from "../../redux/slices/madbelApiSlice";
import { MEETING_REMINDERS } from "../../../assets/data/meetingMockData";
import { SafeAreaView } from "react-native-safe-area-context";
import TimeSlotInput from "../../components/TimeSlotInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const REMINDER_TO_MINUTES = {
  "10 min": 10,
  "30 min": 30,
  "1 hr": 60,
  "2 hr": 120,
  "1 day": 1440,
};

const formatTimeForInput = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parseTimeInput = (timeValue) => {
  const { t } = useAppLanguage();
  const cleaned = String(timeValue || "").trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59 || hours < 1 || hours > 12) {
    return null;
  }

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (!meridiem && hours === 12) hours = 12;

  return { hours, minutes };
};

const combineDateTime = (dateISO, timeInput) => {
  const parsed = parseTimeInput(timeInput);
  if (!parsed) return null;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
};

const CreateMeetingScheduleScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const prefill = route?.params?.prefill || {};
  const selectedDateFromRoute = route?.params?.selectedDate;
  const startsAt = prefill?.starts_at ? new Date(prefill.starts_at) : null;
  const hasValidStart = startsAt && !Number.isNaN(startsAt.getTime());

  const [voiceTrigger, setVoiceTrigger] = useState(0);

  const [createCalendarEvent, { isLoading: creatingMeeting }] =
    useMadbelCreateCalendarEventMutation();
  const { data: contactsResponse, isFetching: contactsFetching } =
    useMadbelListContactsQuery({ page: 1, page_size: 100 });

  const contacts = contactsResponse?.data?.items || [];

  // Applies a prefill object to all form state fields
  const applyPrefill = (p) => {
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    if (p.title) setMeetingTitle(p.title);
    if (p.description) setMeetingDescription(p.description);
    if (p.starts_at) {
      const d = new Date(p.starts_at);
      if (!Number.isNaN(d.getTime())) {
        setDateISO(d.toISOString().slice(0, 10));
        setTime(formatTimeForInput(d));
      }
    }
    if (p.ends_at) {
      const d = new Date(p.ends_at);
      if (!Number.isNaN(d.getTime())) setEndTimeSlot(d);
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
  const [time, setTime] = useState(
    hasValidStart ? formatTimeForInput(startsAt) : "10:00 AM",
  );
  const [endTimeSlot, setEndTimeSlot] = useState(() => {
    const base = hasValidStart && startsAt ? startsAt : new Date();
    return new Date(base.getTime() + 60 * 60 * 1000);
  });
  const [location, setLocation] = useState(prefill?.location || "HQ - Meeting Room 4");
  const [meetingMode, setMeetingMode] = useState(prefill?.meeting_mode || "offline");
  const [meetingLink, setMeetingLink] = useState(prefill?.meeting_link || "");
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySMS, setNotifySMS] = useState(false);
  const [activeReminder, setActiveReminder] = useState("10 min");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(
    Array.isArray(prefill?.contact_ids) ? prefill.contact_ids : [],
  );

  const dateLabel = useMemo(
    () =>
      new Date(dateISO).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    [dateISO],
  );

  const toggleRecipient = (contactId) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const sendMeeting = async () => {
    const startsAtDate = combineDateTime(dateISO, time);
    if (!startsAtDate) {
      Alert.alert(t("invalid_time"), t("use_a_valid_time_like_10_00_am"));
      return;
    }

    const endsAtDate = new Date(dateISO);
    endsAtDate.setHours(
      endTimeSlot.getHours(),
      endTimeSlot.getMinutes(),
      0,
      0,
    );
    if (endsAtDate <= startsAtDate) {
      Alert.alert(t("invalid_time_range"), t("end_time_must_be_later_than_start_time"));
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
        location: meetingMode === "offline" ? location.trim() || undefined : undefined,
        meeting_link: meetingMode === "online" ? meetingLink.trim() || undefined : undefined,
        notify_via_push: notifyPush,
        notify_via_email: notifyEmail,
        notify_via_sms: notifySMS,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        reminder_minutes: REMINDER_TO_MINUTES[activeReminder] || 10,
      };

      const response = await createCalendarEvent(payload).unwrap();
      navigation.navigate("MeetingDetails", { event: response?.data });
    } catch (error) {
      Alert.alert(
        "Schedule failed",
        error?.data?.message || "Could not create the meeting schedule.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeft size={30} color="#11CDE8" />
          </Pressable>
          <Text style={styles.title}>{t("create_meeting_schedule")}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t("meeting_title")}</Text>
        <View style={styles.inputWrap}>
          <NotebookPen size={21} color="#798498" />
          <TextInput
            value={meetingTitle}
            onChangeText={setMeetingTitle}
            style={styles.input}
            placeholder={t("meeting_title")}
            placeholderTextColor="#697588"
          />
        </View>

        <Text style={styles.sectionLabel}>{t("meeting_description")}</Text>
        <View style={[styles.inputWrap, styles.inputAreaWrap]}>
          <TextInput
            value={meetingDescription}
            onChangeText={setMeetingDescription}
            style={styles.inputArea}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            onPress={() => setVoiceTrigger((t) => t + 1)}
            style={styles.micBtn}
            hitSlop={8}
          >
            <Mic size={26} color="#EAFDFF" strokeWidth={2.2} />
          </Pressable>
        </View>
        <VoiceFormFillCard
          label={t("meeting_schedule")}
          workflowIntent="calendar"
          sourceScreen="CreateMeetingSchedule"
          triggerOpen={voiceTrigger}
          currentValues={{
            title: meetingTitle,
            description: meetingDescription,
            starts_at: combineDateTime(dateISO, time)?.toISOString() ?? "",
            ends_at: endTimeSlot?.toISOString() ?? "",
            location,
            meeting_mode: meetingMode,
            meeting_link: meetingLink,
          }}
        />

        <View style={styles.twoCol}>
          <View style={styles.colItem}>
            <Text style={styles.sectionLabel}>{t("date")}</Text>
            <Pressable style={styles.inputWrap} onPress={() => setCalendarVisible(true)}>
              <CalendarDays size={20} color="#798498" />
              <Text style={styles.input}>{dateLabel}</Text>
            </Pressable>
          </View>
          <View style={styles.colItem}>
            <Text style={styles.sectionLabel}>{t("time")}</Text>
            <View style={styles.inputWrap}>
              <Clock3 size={20} color="#798498" />
              <TextInput
                value={time}
                onChangeText={setTime}
                style={styles.input}
                placeholder={t("10_00_am")}
                placeholderTextColor="#697588"
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t("end_time")}</Text>
        <View style={styles.slotWrap}>
          <TimeSlotInput
            value={endTimeSlot}
            onChange={setEndTimeSlot}
          />
        </View>

        <View style={styles.twoCol}>
          <Pressable
            style={[
              styles.modeBtn,
              meetingMode === "offline" && styles.modeBtnActive,
            ]}
            onPress={() => setMeetingMode("offline")}
          >
            <Text
              style={[
                styles.modeText,
                meetingMode === "offline" && styles.modeTextActive,
              ]}
            >{t("offline")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeBtn,
              meetingMode === "online" && styles.modeBtnActive,
            ]}
            onPress={() => setMeetingMode("online")}
          >
            <Text
              style={[
                styles.modeText,
                meetingMode === "online" && styles.modeTextActive,
              ]}
            >{t("online")}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>
          {meetingMode === "online" ? "MEETING LINK" : "LOCATION"}
        </Text>
        <View style={styles.inputWrap}>
          {meetingMode === "online" ? (
            <Mail size={20} color="#798498" />
          ) : (
            <MapPin size={20} color="#798498" />
          )}
          <TextInput
            value={meetingMode === "online" ? meetingLink : location}
            onChangeText={meetingMode === "online" ? setMeetingLink : setLocation}
            style={styles.input}
            placeholder={meetingMode === "online" ? "https://..." : "Meeting location"}
            placeholderTextColor="#697588"
          />
        </View>

        <View style={[styles.row, styles.recipientsHead]}>
          <Text style={styles.sectionLabel}>RECIPIENTS ({selectedRecipientIds.length})</Text>
          {contactsFetching ? <ActivityIndicator color="#11CDE8" size="small" /> : null}</View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {contacts.map((contact) => {
            const selected = selectedRecipientIds.includes(contact.id);
            return (
              <Pressable
                key={contact.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleRecipient(contact.id)}
              >
                <View style={styles.chipAvatar}>
                  {contact.avatar_url ? (
                    <Image source={{ uri: contact.avatar_url }} style={styles.chipAvatarImage} />
                  ) : (
                    <Text style={styles.chipAvatarText}>
                      {String(contact.name || "NA")
                        .split(" ")
                        .map((v) => v[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.chipText}>{contact.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>{t("notify_via")}</Text>
        <View style={styles.notifyCard}>
          <View style={styles.notifyRow}>
            <View style={styles.notifyLeft}>
              <View style={styles.notifyIcon}>
                <Bell size={20} color="#11CDE8" />
              </View>
              <Text style={styles.notifyText}>{t("push_notification")}</Text>
            </View>
            <Switch value={notifyPush} onValueChange={setNotifyPush} />
          </View>
          <View style={styles.notifyRow}>
            <View style={styles.notifyLeft}>
              <View style={styles.notifyIcon}>
                <Mail size={20} color="#11CDE8" />
              </View>
              <Text style={styles.notifyText}>{t("email")}</Text>
            </View>
            <Switch value={notifyEmail} onValueChange={setNotifyEmail} />
          </View>
          <View style={styles.notifyRow}>
            <View style={styles.notifyLeft}>
              <View style={styles.notifyIcon}>
                <Phone size={20} color="#11CDE8" />
              </View>
              <Text style={styles.notifyText}>{t("sms")}</Text>
            </View>
            <Switch value={notifySMS} onValueChange={setNotifySMS} />
          </View>
        </View>

        <Text style={styles.helperText}>{t("your_ai_assistant_mabdel_will_prioritize_push_noti")}</Text>

        <Text style={styles.sectionLabel}>{t("reminder_time")}</Text>
        <View style={styles.reminderGrid}>
          {MEETING_REMINDERS.map((item) => (
            <Pressable
              key={item}
              style={[
                styles.reminderBtn,
                activeReminder === item && styles.reminderBtnActive,
              ]}
              onPress={() => setActiveReminder(item)}
            >
              <Text
                style={[
                  styles.reminderText,
                  activeReminder === item && styles.reminderTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.submitBtn, creatingMeeting && styles.submitBtnDisabled]}
          onPress={sendMeeting}
          disabled={creatingMeeting}
        >
          {creatingMeeting ? (
            <ActivityIndicator color="#EAFDFF" />
          ) : (
            <Text style={styles.submitText}>{t("send_schedule_meeting")}</Text>
          )}
        </Pressable>
      </ScrollView>

      <SystemCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDate={dateISO}
        onSelectDate={setDateISO}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  content: {
    paddingHorizontal: responsiveWidth(4.5),
    paddingTop: responsiveHeight(1),
    paddingBottom: responsiveHeight(12),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F3F9FF",
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  sectionLabel: {
    color: "#808B9E",
    fontSize: 18 / 1.6,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  inputWrap: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2A3442",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, color: "#E7F2FF", fontSize: 20 / 1.6 },
  inputAreaWrap: {
    minHeight: 220,
    alignItems: "flex-start",
    paddingTop: 14,
    marginBottom: 2,
  },
  inputArea: {
    flex: 1,
    color: "#B9C7D8",
    fontSize: 20 / 1.6,
    lineHeight: 28 / 1.6,
    paddingRight: 64,
  },
  micBtn: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#15CFE9",
    alignItems: "center",
    justifyContent: "center",
  },
  twoCol: { flexDirection: "row", gap: 12, marginTop: 2 },
  colItem: { flex: 1 },
  slotWrap: {
    marginTop: 2,
  },
  modeBtn: {
    flex: 1,
    marginTop: 12,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2A3442",
    alignItems: "center",
    justifyContent: "center",
  },
  modeBtnActive: { backgroundColor: "#17CCE9", borderColor: "#17CCE9" },
  modeText: { color: "#7F8C9E", fontSize: 22 / 1.6, fontWeight: "600" },
  modeTextActive: { color: "#EAFDFF" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recipientsHead: { marginTop: 6 },
  chipsRow: {
    gap: 10,
    paddingVertical: 10,
    paddingRight: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2A3442",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 8,
  },
  chipSelected: {
    borderColor: "#17CCE9",
    backgroundColor: "#13303A",
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#20414A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chipAvatarImage: { width: "100%", height: "100%" },
  chipAvatarText: { color: "#DFF7FC", fontSize: 10, fontWeight: "600" },
  chipText: { color: "#DCE7F7", fontSize: 12 },
  notifyCard: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#2A3442",
    borderRadius: 18,
    backgroundColor: "#1D1D21",
    paddingHorizontal: 12,
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A3442",
  },
  notifyLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#132A34",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyText: { color: "#E7F2FF", fontSize: 14 },
  helperText: {
    color: "#7F8C9E",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  reminderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  reminderBtn: {
    borderWidth: 1,
    borderColor: "#2A3442",
    backgroundColor: "#1D1D21",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reminderBtnActive: {
    borderColor: "#17CCE9",
    backgroundColor: "#13303A",
  },
  reminderText: { color: "#9BA8BE", fontSize: 12, fontWeight: "600" },
  reminderTextActive: { color: "#EAFDFF" },
  submitBtn: {
    marginTop: 18,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#15CFE9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15CFE9",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  submitBtnDisabled: {
    opacity: 0.8,
  },
  submitText: { color: "#EAFDFF", fontSize: 18, fontWeight: "700" },
});

export default CreateMeetingScheduleScreen;
