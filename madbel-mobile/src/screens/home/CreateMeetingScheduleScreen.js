import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  Mail,
  MapPin,
  Mic,
  NotebookPen,
} from "lucide-react-native";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import TimeSlotInput from "../../components/TimeSlotInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import { useCreateMeetingScheduleLogic } from "./hooks/useCreateMeetingScheduleLogic";
import { mergeDateAndTime } from "./createMeetingScheduleHelpers";
import GoogleCalendarCard from "./components/GoogleCalendarCard";
import AppleCalendarCard from "./components/AppleCalendarCard";
import RecipientsChipsRow from "./components/RecipientsChipsRow";
import styles from "./CreateMeetingScheduleScreen.styles";

const CreateMeetingScheduleScreen = () => {
  const {
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
  } = useCreateMeetingScheduleLogic();

  return (
    <View style={styles.flex}>
      <View style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
            >
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
              starts_at:
                mergeDateAndTime(dateISO, startTimeSlot, true)?.toISOString() ??
                "",
              ends_at:
                mergeDateAndTime(dateISO, endTimeSlot, true)?.toISOString() ??
                "",
              location,
              meeting_mode: meetingMode,
              meeting_link: meetingLink,
            }}
          />

          <Text style={styles.sectionLabel}>{t("date")}</Text>
          <Pressable
            style={styles.inputWrap}
            onPress={() => setCalendarVisible(true)}
          >
            <CalendarDays size={20} color="#798498" />
            <Text style={styles.input}>{dateLabel}</Text>
          </Pressable>

          <TimeSlotInput
            label={t("time")}
            value={startTimeSlot}
            onChange={setStartTimeSlot}
          />

          <TimeSlotInput
            label={t("end_time")}
            value={endTimeSlot}
            onChange={setEndTimeSlot}
          />

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
              >
                {t("offline")}
              </Text>
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
              >
                {t("online")}
              </Text>
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
              onChangeText={
                meetingMode === "online" ? setMeetingLink : setLocation
              }
              style={styles.input}
              placeholder={
                meetingMode === "online" ? "https://..." : "Meeting location"
              }
              placeholderTextColor="#697588"
            />
          </View>

          <RecipientsChipsRow
            contacts={contacts}
            contactsFetching={contactsFetching}
            selectedRecipientIds={selectedRecipientIds}
            onToggleRecipient={toggleRecipient}
          />

          {/* <Text style={styles.sectionLabel}>{t("notify_via")}</Text>
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
        </View> */}

          {/* <Text style={styles.helperText}>{t("your_ai_assistant_mabdel_will_prioritize_push_noti")}</Text>

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
        </View> */}

          <GoogleCalendarCard
            googleCalendarConnected={googleCalendarConnected}
            googleCalendarSyncMessage={googleCalendarSyncMessage}
            googleCalendarSyncStatus={googleCalendarSyncStatus}
            googleLoading={googleLoading}
            onConnect={handleGoogleCalendarConnect}
            onDisconnect={handleGoogleCalendarDisconnect}
            t={t}
          />

          <AppleCalendarCard
            appleCalendarConnected={appleCalendarConnected}
            appleCalendarSyncMessage={appleCalendarSyncMessage}
            appleCalendarSyncStatus={appleCalendarSyncStatus}
            appleLoading={appleLoading}
            onConnect={handleAppleCalendarConnect}
            onDisconnect={handleAppleCalendarDisconnect}
          />
        </ScrollView>

        <SystemCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          selectedDate={dateISO}
          onSelectDate={setDateISO}
        />

        <View
          style={[styles.footerWrap, { marginBottom: footerBottomMargin }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[
              styles.submitBtn,
              creatingMeeting && styles.submitBtnDisabled,
            ]}
            onPress={sendMeeting}
            disabled={creatingMeeting}
          >
            {creatingMeeting ? (
              <ActivityIndicator color="#EAFDFF" />
            ) : (
              <Text style={styles.submitText}>
                {t("send_schedule_meeting")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default CreateMeetingScheduleScreen;
