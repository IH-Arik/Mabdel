import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ArrowLeft,
  X,
  UserRoundPlus,
  Mic,
  SendHorizontal,
  Paperclip,
  ClipboardList,
} from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { launchImageLibrary } from "react-native-image-picker";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import ImagePickerModal from "../../components/ImagePickerModal";
import TimePickerComponent from "../../components/TimePickerComponent";
import {
  useMadbelCancelBulkMessageMutation,
  useMadbelCreateBulkMessageMutation,
  useMadbelSendBulkMessageMutation,
  useMadbelUpdateBulkMessageMutation,
  useMadbelValidateBulkRecipientsMutation,
} from "../../redux/slices/madbelApiSlice";

const palette = ["#18C6E3", "#6C70F0", "#31B47B", "#FF8A2A", "#D16BE8"];

const getInitials = (value) => {
  if (!value) return "?";
  const local = String(value).split("@")[0] || "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return local.slice(0, 2).toUpperCase() || "?";
};

const toLocalDateTimeIso = (dateISO, timeValue) => {
  const match = String(timeValue || "")
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 1 || hours > 12 || minutes > 59) {
    return null;
  }
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const dt = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(hours, minutes, 0, 0);
  return dt.toISOString();
};

const parseTimeString = (timeValue) => {
  const match = String(timeValue || "")
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return new Date();
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return new Date();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatTimeString = (date) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

const BulkMessagingScreen = () => {
  const { t, currentAppLang } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const tabBarHeight = useBottomTabBarHeight();
  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const initialRecipients = useMemo(() => {
    const list =
      route?.params?.recipients ||
      route?.params?.prefill?.recipient_emails ||
      route?.params?.prefill?.contact_ids;
    if (!Array.isArray(list)) return [];
    return list.map((item) => String(item).trim()).filter(Boolean);
  }, [
    route?.params?.prefill?.contact_ids,
    route?.params?.prefill?.recipient_emails,
    route?.params?.recipients,
  ]);

  const initialAttachments = useMemo(() => {
    const items = route?.params?.prefill?.attachments;
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item?.label && item?.url);
  }, [route?.params?.prefill?.attachments]);

  const [recipients, setRecipients] = useState(initialRecipients);
  const [subject, setSubject] = useState(route?.params?.prefill?.subject || "");
  const [message, setMessage] = useState(
    route?.params?.prefill?.content || route?.params?.prefillPrompt || "",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    Boolean(route?.params?.prefill?.scheduled_at),
  );
  const [scheduleDate, setScheduleDate] = useState(
    route?.params?.prefill?.scheduled_at
      ? new Date(route.params.prefill.scheduled_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [scheduleTime, setScheduleTime] = useState("10:00 AM");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [bulkMessageId, setBulkMessageId] = useState(route?.params?.prefill?.id || null);

  const [validateRecipients, { isLoading: validatingRecipients }] =
    useMadbelValidateBulkRecipientsMutation();
  const [createBulkMessage, { isLoading: creatingBulk }] =
    useMadbelCreateBulkMessageMutation();
  const [updateBulkMessage, { isLoading: updatingBulk }] =
    useMadbelUpdateBulkMessageMutation();
  const [sendBulkMessage, { isLoading: sendingBulk }] = useMadbelSendBulkMessageMutation();
  const [cancelBulkMessage, { isLoading: cancellingBulk }] =
    useMadbelCancelBulkMessageMutation();

  const isBusy =
    validatingRecipients ||
    creatingBulk ||
    updatingBulk ||
    sendingBulk ||
    cancellingBulk;

  const dateLabel = useMemo(
    () =>
      new Date(`${scheduleDate}T00:00:00`).toLocaleDateString(currentAppLang?.code || "en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    [currentAppLang?.code, scheduleDate],
  );

  const upsertBulk = async () => {
    if (!message.trim()) {
      Alert.alert(tr("missing_message", "Missing message"), tr("please_enter_your_bulk_message", "Please enter your bulk message."));
      return null;
    }
    if (!subject.trim()) {
      Alert.alert(tr("missing_subject", "Missing subject"), tr("email_bulk_messages_require_a_subject", "Email bulk messages require a subject."));
      return null;
    }

    const validation = await validateRecipients({
      channel: "email",
      recipient_emails: recipients,
    }).unwrap();
    const validRecipients = (validation?.data?.recipients || [])
      .map((item) => item?.email)
      .filter(Boolean);
    if (!validRecipients.length) {
      Alert.alert(tr("no_recipients", "No recipients"), tr("please_add_at_least_one_valid_recipient", "Please add at least one valid recipient."));
      return null;
    }

    const scheduledAt = scheduleEnabled
      ? toLocalDateTimeIso(scheduleDate, scheduleTime)
      : null;
    if (scheduleEnabled && !scheduledAt) {
      Alert.alert(tr("invalid_schedule", "Invalid schedule"), tr("use_time_format_like_10_00_am", "Use a time format like 10:00 AM."));
      return null;
    }

    const payload = {
      channel: "email",
      recipient_emails: validRecipients,
      subject: subject.trim(),
      content: message.trim(),
      attachments,
      send_now: !scheduleEnabled,
      scheduled_at: scheduledAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    };
    console.log("upsertBulk payload:", payload);

    const response = bulkMessageId
      ? await updateBulkMessage({ bulk_message_id: bulkMessageId, ...payload }).unwrap()
      : await createBulkMessage(payload).unwrap();
    const id = response?.data?.id;
    if (id) setBulkMessageId(id);
    return id || bulkMessageId;
  };

  const handleSend = async () => {
    try {
      const id = await upsertBulk();
      if (!id) return;
      if (!scheduleEnabled) {
        await sendBulkMessage({ bulk_message_id: id }).unwrap();
      }
      Alert.alert(tr("success", "Success"), scheduleEnabled ? tr("bulk_message_scheduled", "Bulk message scheduled.") : tr("bulk_message_sent", "Bulk message sent."));
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        tr("send_failed", "Send failed"),
        error?.data?.message || tr("could_not_process_bulk_message", "Could not process bulk message."),
      );
    }
  };

  const handleCancelScheduled = async () => {
    if (!bulkMessageId) {
      Alert.alert(tr("unavailable", "Unavailable"), tr("save_the_draft_before_canceling", "Save the draft before canceling."));
      return;
    }
    try {
      await cancelBulkMessage({ bulk_message_id: bulkMessageId }).unwrap();
      Alert.alert(tr("cancelled", "Cancelled"), tr("scheduled_bulk_message_has_been_cancelled", "Scheduled bulk message has been cancelled."));
    } catch (error) {
      Alert.alert(tr("cancel_failed", "Cancel failed"), error?.data?.message || tr("could_not_cancel", "Could not cancel."));
    }
  };

  const handlePickAttachmentImage = async () => {
    const response = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.8,
    });

    if (response?.didCancel) return;

    if (response?.errorCode) {
      Alert.alert(
        tr("avatar_failed", "Image selection failed"),
        response?.errorMessage || tr("could_not_pick_image", "Could not pick image."),
      );
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) return;

    setAttachments((prev) => [
      ...prev,
      {
        label: asset?.fileName || tr("upload_photo", "Upload Photo"),
        url: asset.uri,
        type: asset?.type || "image/jpeg",
      },
    ]);
    setImagePickerVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={responsiveWidth(7.2)} color="#F4F8FF" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{tr("bulk_messaging", "Bulk Messaging")}</Text>
          <Pressable
            style={styles.userPlusWrap}
            onPress={() => navigation.navigate("BulkEmailRecipients", { recipients })}
          >
            <UserRoundPlus size={responsiveWidth(6)} color="#17CBE8" strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + responsiveHeight(16) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.recipientHeaderRow}>
            <Text style={styles.sectionLabel}>{tr("recipients", "Recipients")} ({recipients.length})</Text>
            <Pressable onPress={() => navigation.navigate("BulkEmailRecipients", { recipients })}>
              <Text style={styles.editAllText}>{tr("edit_all", "Edit All")}</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            <View style={styles.chipRow}>
              {recipients.map((recipient, index) => (
                <View key={recipient} style={styles.recipientChip}>
                  <View
                    style={[
                      styles.avatarDot,
                      { backgroundColor: palette[index % palette.length] },
                    ]}
                  >
                    <Text style={styles.avatarText}>{getInitials(recipient)}</Text>
                  </View>
                  <Text style={styles.recipientText} numberOfLines={1}>
                    {recipient.split("@")[0]}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setRecipients((prev) => prev.filter((item) => item !== recipient))}
                  >
                    <X size={responsiveWidth(4.5)} color="#9AA8C0" strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionLabel}>{tr("subject", "Subject")}</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={tr("write_email_subject", "Write email subject")}
            placeholderTextColor="#4D5770"
            style={styles.subjectInput}
          />

          <View style={styles.messageHeaderRow}>
            <Text style={styles.sectionLabel}>{tr("message", "Message")}</Text>
            <Text style={styles.counterText}>{message.length} / 5000</Text>
          </View>

          <View style={styles.messageCard}>
            {/* <View style={styles.toolbarRow}>
              <Text style={styles.toolbarGlyph}>{tr("b", "B")}</Text>
              <Text style={styles.toolbarGlyph}>{tr("i", "I")}</Text>
              <Paperclip size={responsiveWidth(6)} color="#A8B4CC" strokeWidth={2.2} />
              <ClipboardList size={responsiveWidth(6)} color="#A8B4CC" strokeWidth={2.2} />
            </View> */}

            <TextInput
              value={message}
              onChangeText={(value) => setMessage(value.slice(0, 5000))}
              placeholder={tr("type_your_message_or_use_ai_voice_to_text", "Type your message or use AI voice-to-text...")}
              placeholderTextColor="#4D5770"
              multiline
              style={styles.messageInput}
              textAlignVertical="top"
            />

            <Pressable style={styles.micButton}>
              <Mic size={responsiveWidth(8)} color="#EAF9FF" strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.attachCard}>
            <Text style={styles.sectionLabel}>{tr("attachment_urls_image_api", "ATTACHMENT URLS (IMAGE API)")}</Text>
            <Pressable onPress={() => setImagePickerVisible(true)} style={styles.attachBtn}>
              <Text style={styles.attachBtnText}>{tr("upload_photo", "Upload Photo")}</Text>
            </Pressable>
            {attachments.map((item, idx) => (
              <View key={`${item.url}-${idx}`} style={styles.attachRow}>
                <Text numberOfLines={1} style={styles.attachText}>
                  {item.label}
                </Text>
                <Pressable onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                  <X size={18} color="#9AA8C0" />
                </Pressable>
              </View>
            ))}
          </View>

          <View style={styles.scheduleCard}>
            <View style={styles.scheduleTopRow}>
              <View style={styles.scheduleTextCol}>
                <Text style={styles.scheduleTitle}>{tr("schedule_send", "Schedule Send")}</Text>
                <Text style={styles.scheduleSubtitle}>{tr("pick_a_later_date_and_time", "Pick a later date and time")}</Text>
              </View>
              <Switch
                value={scheduleEnabled}
                onValueChange={setScheduleEnabled}
                trackColor={{ false: "#3A4356", true: "#18C6E3" }}
                thumbColor="#F2F7FF"
              />
            </View>

            <View style={styles.dateTimeRow}>
              <Pressable style={styles.dateTimeCol} onPress={() => setCalendarVisible(true)}>
                <Text style={styles.dateTimeLabel}>{tr("date", "Date")}</Text>
                <Text style={styles.dateTimeValue}>{dateLabel}</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable style={styles.dateTimeCol} onPress={() => setTimePickerVisible(true)}>
                <Text style={styles.dateTimeLabel}>{tr("time", "Time")}</Text>
                <Text style={styles.dateTimeValue}>{scheduleTime || tr("10_00_am", "10:00 AM")}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomCtaWrap, { bottom: tabBarHeight + responsiveHeight(1.2) }]}>
          <View style={styles.bottomRow}>
              {/* <Pressable
                style={[styles.cancelBtn, (!bulkMessageId || isBusy) && styles.disabledBtn]}
                onPress={handleCancelScheduled}
                disabled={!bulkMessageId || isBusy}
              >
              {cancellingBulk ? (
                <ActivityIndicator color="#DFF8FF" />
              ) : (
                <Text style={styles.cancelBtnText}>{tr("cancel", "Cancel")}</Text>
              )}
            </Pressable> */}
            <Pressable style={[styles.sendBtn, isBusy && styles.disabledBtn]} onPress={handleSend} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color="#DFF8FF" />
              ) : (
                <>
                  <SendHorizontal size={responsiveWidth(7)} color="#DFF8FF" strokeWidth={2.3} />
                  <Text style={styles.sendBtnText}>
                    {scheduleEnabled ? tr("save_and_schedule", "Save & Schedule") : tr("send_bulk_message", "Send Bulk Message")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <SystemCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDate={scheduleDate}
        onSelectDate={setScheduleDate}
      />
      <TimePickerComponent
        visible={timePickerVisible}
        selectedTime={parseTimeString(scheduleTime)}
        onCancel={() => setTimePickerVisible(false)}
        onConfirm={(time) => {
          setScheduleTime(formatTimeString(time));
          setTimePickerVisible(false);
        }}
        title={tr("time", "Time")}
      />
      <ImagePickerModal
        visible={imagePickerVisible}
        onClose={() => setImagePickerVisible(false)}
        onPickGallery={handlePickAttachmentImage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#010507",
  },
  screen: {
    flex: 1,
    backgroundColor: "#010507",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(3.8),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: responsiveHeight(1),
  },
  backBtn: {
    width: responsiveWidth(11.2),
    height: responsiveWidth(11.2),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F2F7FF",
    fontSize: responsiveWidth(3.6),
    fontWeight: "700",
  },
  userPlusWrap: {
    width: responsiveWidth(11.2),
    height: responsiveWidth(11.2),
    borderRadius: responsiveWidth(6),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#092331",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: responsiveWidth(4.8),
    paddingTop: responsiveHeight(1.6),
    gap: responsiveHeight(1),
  },
  recipientHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(0.5),
  },
  sectionLabel: {
    color: "#A1AEC2",
    fontSize: responsiveWidth(3.1),
    fontWeight: "600",
    letterSpacing: 1,
  },
  editAllText: {
    color: "#17CBE8",
    fontSize: responsiveWidth(3.1),
    fontWeight: "600",
  },
  chipScroller: {
    marginBottom: responsiveHeight(1.3),
  },
  chipRow: {
    flexDirection: "row",
    gap: responsiveWidth(2.5),
    paddingRight: responsiveWidth(2),
  },
  recipientChip: {
    minWidth: responsiveWidth(40),
    maxWidth: responsiveWidth(52),
    borderRadius: responsiveWidth(7),
    borderWidth: 1,
    borderColor: "#1F7E94",
    backgroundColor: "#20232A",
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1.1),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2.2),
  },
  avatarDot: {
    width: responsiveWidth(9),
    height: responsiveWidth(9),
    borderRadius: responsiveWidth(4.5),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#DDF6FF",
    fontWeight: "700",
    fontSize: responsiveWidth(3.3),
  },
  recipientText: {
    flex: 1,
    color: "#E9EEF8",
    fontSize: responsiveWidth(3.7),
    fontWeight: "500",
  },
  subjectInput: {
    height: responsiveHeight(6),
    borderRadius: responsiveWidth(4),
    borderWidth: 1,
    borderColor: "#2B2F38",
    backgroundColor: "#1A1C22",
    color: "#DCE8FA",
    paddingHorizontal: responsiveWidth(3.5),
    fontSize: responsiveWidth(3.8),
  },
  messageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1.2),
    marginTop: responsiveHeight(0.8),
  },
  counterText: {
    color: "#8C9AB1",
    fontSize: responsiveWidth(3),
    fontWeight: "500",
  },
  messageCard: {
    backgroundColor: "#1A1C22",
    borderRadius: responsiveWidth(5),
    borderWidth: 1,
    borderColor: "#2B2F38",
    minHeight: responsiveHeight(30),
    overflow: "hidden",
  },
  toolbarRow: {
    height: responsiveHeight(7),
    borderBottomWidth: 1,
    borderBottomColor: "#2D3340",
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(6),
    paddingHorizontal: responsiveWidth(3.5),
  },
  toolbarGlyph: {
    color: "#A8B4CC",
    fontSize: responsiveWidth(6),
    fontWeight: "700",
    width: responsiveWidth(6),
    textAlign: "center",
  },
  messageInput: {
    minHeight: responsiveHeight(20),
    color: "#DCE8FA",
    fontSize: responsiveWidth(4),
    lineHeight: responsiveHeight(3.8),
    paddingHorizontal: responsiveWidth(3.5),
    paddingTop: responsiveHeight(1.8),
    paddingBottom: responsiveHeight(8),
  },
  micButton: {
    position: "absolute",
    right: responsiveWidth(4),
    bottom: responsiveHeight(2),
    width: responsiveWidth(13),
    height: responsiveWidth(13),
    borderRadius: responsiveWidth(7),
    backgroundColor: "#18C6E3",
    alignItems: "center",
    justifyContent: "center",
  },
  attachCard: {
    backgroundColor: "#1A1C22",
    borderRadius: responsiveWidth(5),
    borderWidth: 1,
    borderColor: "#2B2F38",
    padding: responsiveWidth(4),
    gap: responsiveHeight(0.8),
  },
  attachInput: {
    height: responsiveHeight(5.6),
    borderRadius: responsiveWidth(3),
    borderWidth: 1,
    borderColor: "#2D3550",
    backgroundColor: "#141821",
    color: "#DCE8FA",
    paddingHorizontal: responsiveWidth(3),
    fontSize: responsiveWidth(3.4),
  },
  attachBtn: {
    marginTop: responsiveHeight(0.2),
    height: responsiveHeight(5),
    borderRadius: responsiveWidth(3),
    backgroundColor: "#17CBE8",
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtnText: {
    color: "#E6F9FF",
    fontWeight: "700",
  },
  attachRow: {
    marginTop: responsiveHeight(0.5),
    height: responsiveHeight(4.8),
    borderRadius: responsiveWidth(3),
    borderWidth: 1,
    borderColor: "#2D3550",
    backgroundColor: "#141821",
    paddingHorizontal: responsiveWidth(2.8),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attachText: {
    color: "#DCE8FA",
    maxWidth: "85%",
  },
  scheduleCard: {
    marginTop: responsiveHeight(0.8),
    backgroundColor: "#1A1C22",
    borderRadius: responsiveWidth(5),
    borderWidth: 1,
    borderColor: "#2B2F38",
    padding: responsiveWidth(4),
  },
  scheduleTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: responsiveHeight(1.6),
  },
  scheduleTextCol: {
    paddingRight: responsiveWidth(2),
  },
  scheduleTitle: {
    color: "#F2F7FF",
    fontSize: responsiveWidth(4),
    fontWeight: "700",
  },
  scheduleSubtitle: {
    color: "#97A5BD",
    fontSize: responsiveWidth(3.2),
    marginTop: responsiveHeight(0.2),
  },
  dateTimeRow: {
    minHeight: responsiveHeight(9.5),
    borderRadius: responsiveWidth(4),
    borderWidth: 1,
    borderColor: "#2D3550",
    backgroundColor: "#141821",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
  },
  dateTimeCol: {
    flex: 1,
  },
  dateTimeLabel: {
    color: "#8F9BB2",
    fontSize: responsiveWidth(2.7),
    marginBottom: responsiveHeight(0.3),
  },
  dateTimeValue: {
    color: "#F0F6FF",
    fontSize: responsiveWidth(4.2),
    fontWeight: "700",
  },
  dateTimeInput: {
    color: "#F0F6FF",
    fontSize: responsiveWidth(4),
    fontWeight: "700",
    paddingVertical: 0,
  },
  divider: {
    width: 1,
    height: "64%",
    backgroundColor: "#2D3550",
    marginHorizontal: responsiveWidth(4),
  },
  bottomCtaWrap: {
    position: "absolute",
    left: responsiveWidth(4.8),
    right: responsiveWidth(4.8),
  },
  bottomRow: {
    flexDirection: "row",
    gap: responsiveWidth(2.5),
  },
  cancelBtn: {
    width: responsiveWidth(24),
    height: responsiveHeight(7),
    borderRadius: responsiveWidth(12),
    borderWidth: 1,
    borderColor: "#446077",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#15202A",
  },
  cancelBtnText: {
    color: "#DFF8FF",
    fontSize: responsiveWidth(3.6),
    fontWeight: "700",
  },
  sendBtn: {
    flex: 1,
    height: responsiveHeight(7),
    borderRadius: responsiveWidth(12),
    backgroundColor: "#18C6E3",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: responsiveWidth(2.2),
  },
  sendBtnText: {
    color: "#DFF8FF",
    fontSize: responsiveWidth(3.9),
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.65,
  },
});

export default BulkMessagingScreen;
