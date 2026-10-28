import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import styles from "../CreateMeetingScheduleScreen.styles";

const GoogleCalendarCard = ({
  googleCalendarConnected,
  googleCalendarSyncMessage,
  googleCalendarSyncStatus,
  googleLoading,
  onConnect,
  onDisconnect,
  t,
}) => (
  <View style={styles.googleCard}>
    <View style={styles.googleTextWrap}>
      <Text style={styles.googleTitle}>Google Calendar</Text>
      <Text style={styles.googleSubTitle}>
        {googleCalendarConnected
          ? "Google Calendar connected."
          : "Connect your Google account to sync this meeting to Google Calendar."}
      </Text>
      {googleCalendarSyncMessage ? (
        <Text
          style={[
            styles.googleSyncStatus,
            googleCalendarSyncStatus === "synced" &&
              styles.googleSyncStatusSuccess,
            googleCalendarSyncStatus === "failed" &&
              styles.googleSyncStatusFailed,
            googleCalendarSyncStatus === "syncing" &&
              styles.googleSyncStatusInfo,
          ]}
        >
          {googleCalendarSyncMessage}
        </Text>
      ) : null}
    </View>
    <View style={styles.googleActions}>
      <Pressable
        style={[styles.googleBtn, googleLoading && styles.googleBtnDisabled]}
        onPress={onConnect}
        disabled={googleLoading}
      >
        {googleLoading && !googleCalendarConnected ? (
          <ActivityIndicator color="#03141E" />
        ) : (
          <Text style={styles.googleBtnText}>
            {googleCalendarConnected ? t("connected") : t("connect")}
          </Text>
        )}
      </Pressable>
      {googleCalendarConnected ? (
        <Pressable
          style={[
            styles.googleDisconnectBtn,
            googleLoading && styles.googleBtnDisabled,
          ]}
          onPress={onDisconnect}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#EAFDFF" />
          ) : (
            <Text style={styles.googleDisconnectBtnText}>Disconnect</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  </View>
);

export default GoogleCalendarCard;
