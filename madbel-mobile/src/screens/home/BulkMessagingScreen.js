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
import SystemCalendarModal from "../../components/SystemCalendarModal";
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

const BulkMessagingScreen = () => {
  const { t, currentAppLang } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const tabBarHeight = useBottomTabBarHeight();

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
  const [attachments, setAttachments] = useState(initialAttachments);
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
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
      Alert.alert(t("missing_message"), t("please_enter_your_bulk_message"));
      return null;
    }
    if (!subject.trim()) {
      Alert.alert(t("missing_subject"), t("email_bulk_messages_require_a_subject"));
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
      Alert.alert(t("no_recipients"), t("please_add_at_least_one_valid_recipient"));
      return null;
    }

    const scheduledAt = scheduleEnabled
      ? toLocalDateTimeIso(scheduleDate, scheduleTime)
      : null;
    if (scheduleEnabled && !scheduledAt) {
      Alert.alert(t("invalid_schedule"), t("use_time_format_like_10_00_am"));
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
      Alert.alert(t("success"), scheduleEnabled ? t("bulk_message_scheduled") : t("bulk_message_sent"));
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t("send_failed"),
        error?.data?.message || t("could_not_process_bulk_message"),
      );
    }
  };

  const handleCancelScheduled = async () => {
    if (!bulkMessageId) {
      Alert.alert(t("unavailable"), t("save_the_draft_before_canceling"));
      return;
    }
    try {
      await cancelBulkMessage({ bulk_message_id: bulkMessageId }).unwrap();
      Alert.alert(t("cancelled"), t("scheduled_bulk_message_has_been_cancelled"));
    } catch (error) {
      Alert.alert(t("cancel_failed"), error?.data?.message || t("could_not_cancel"));
    }
  };

  const addAttachment = () => {
    const label = attachmentLabel.trim();
    const url = attachmentUrl.trim();
    if (!label || !url) {
      Alert.alert(t("attachment_required"), t("please_provide_attachment_label_and_url"));
      return;
    }
    setAttachments((prev) => [...prev, { label, url }]);
    setAttachmentLabel("");
    setAttachmentUrl("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={responsiveWidth(7.2)} color="#F4F8FF" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("bulk_messaging")}</Text>
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
            <Text style={styles.sectionLabel}>{t("recipients")} ({recipients.length})</Text>
            <Pressable onPress={() => navigation.navigate("BulkEmailRecipients", { recipients })}>
              <Text style={styles.editAllText}>{t("edit_all")}</Text>
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

          <Text style={styles.sectionLabel}>{t("subject")}</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={t("write_email_subject")}
            placeholderTextColor="#4D5770"
            style={styles.subjectInput}
          />

          <View style={styles.messageHeaderRow}>
            <Text style={styles.sectionLabel}>{t("message")}</Text>
            <Text style={styles.counterText}>{message.length} / 5000</Text>
          </View>

          <View style={styles.messageCard}>
            <View style={styles.toolbarRow}>
              <Text style={styles.toolbarGlyph}>{t("b")}</Text>
              <Text style={styles.toolbarGlyph}>{t("i")}</Text>
              <Paperclip size={responsiveWidth(6)} color="#A8B4CC" strokeWidth={2.2} />
              <ClipboardList size={responsiveWidth(6)} color="#A8B4CC" strokeWidth={2.2} />
            </View>

            <TextInput
              value={message}
              onChangeText={(value) => setMessage(value.slice(0, 5000))}
              placeholder={t("type_your_message_or_use_ai_voice_to_text")}
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
            <Text style={styles.sectionLabel}>{t("attachment_urls_image_api")}</Text>
            <TextInput
              value={attachmentLabel}
              onChangeText={setAttachmentLabel}
              placeholder={t("attachment_label")}
              placeholderTextColor="#66748D"
              style={styles.attachInput}
            />
            <TextInput
              value={attachmentUrl}
              onChangeText={setAttachmentUrl}
              placeholder={t("https_image_jpg")}
              placeholderTextColor="#66748D"
              style={styles.attachInput}
              autoCapitalize="none"
            />
            <Pressable onPress={addAttachment} style={styles.attachBtn}>
              <Text style={styles.attachBtnText}>{t("add_attachment")}</Text>
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
                <Text style={styles.scheduleTitle}>{t("schedule_send")}</Text>
                <Text style={styles.scheduleSubtitle}>{t("pick_a_later_date_and_time")}</Text>
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
                <Text style={styles.dateTimeLabel}>{t("date")}</Text>
                <Text style={styles.dateTimeValue}>{dateLabel}</Text>
              </Pressable>

              <View style={styles.divider} />

              <View style={styles.dateTimeCol}>
                <Text style={styles.dateTimeLabel}>{t("time")}</Text>
                <TextInput
                  value={scheduleTime}
                  onChangeText={setScheduleTime}
                  style={styles.dateTimeInput}
                  placeholder={t("10_00_am")}
                  placeholderTextColor="#90A0B8"
                />
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomCtaWrap, { bottom: tabBarHeight + responsiveHeight(1.2) }]}>
          <View style={styles.bottomRow}>
            <Pressable
              style={[styles.cancelBtn, (!bulkMessageId || isBusy) && styles.disabledBtn]}
              onPress={handleCancelScheduled}
              disabled={!bulkMessageId || isBusy}
            >
              {cancellingBulk ? (
                <ActivityIndicator color="#DFF8FF" />
              ) : (
                <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
              )}
            </Pressable>
            <Pressable style={[styles.sendBtn, isBusy && styles.disabledBtn]} onPress={handleSend} disabled={isBusy}>
              {isBusy ? (
                <ActivityIndicator color="#DFF8FF" />
              ) : (
                <>
                  <SendHorizontal size={responsiveWidth(7)} color="#DFF8FF" strokeWidth={2.3} />
                  <Text style={styles.sendBtnText}>
                    {scheduleEnabled ? t("save_and_schedule") : t("send_bulk_message")}
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
