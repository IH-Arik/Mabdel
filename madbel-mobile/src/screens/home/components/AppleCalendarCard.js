import React from "react";
import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import styles from "../CreateMeetingScheduleScreen.styles";

const AppleCalendarCard = ({
  appleCalendarConnected,
  appleCalendarSyncMessage,
  appleCalendarSyncStatus,
  appleLoading,
  onConnect,
  onDisconnect,
}) => (
  <View style={styles.appleCard}>
    <View style={styles.appleTextWrap}>
      <Text style={styles.appleTitle}>Apple Calendar</Text>
      <Text style={styles.appleSubTitle}>
        {Platform.OS === "ios"
          ? appleCalendarConnected
            ? "Apple Calendar connected."
            : "Connect Apple Calendar to give permission and sync this meeting."
          : "Apple Calendar sync is available on iPhone and iPad only."}
      </Text>
      {appleCalendarSyncMessage ? (
        <Text
          style={[
            styles.appleSyncStatus,
            appleCalendarSyncStatus === "synced" &&
              styles.appleSyncStatusSuccess,
            appleCalendarSyncStatus === "failed" &&
              styles.appleSyncStatusFailed,
            appleCalendarSyncStatus === "syncing" &&
              styles.appleSyncStatusInfo,
          ]}
        >
          {appleCalendarSyncMessage}
        </Text>
      ) : null}
    </View>
    <View style={styles.appleActions}>
      {Platform.OS === "ios" ? (
        <>
          <Pressable
            style={[styles.appleBtn, appleLoading && styles.appleBtnDisabled]}
            onPress={onConnect}
            disabled={appleLoading}
          >
            {appleLoading && !appleCalendarConnected ? (
              <ActivityIndicator color="#03141E" />
            ) : (
              <Text style={styles.appleBtnText}>
                {appleCalendarConnected ? "Connected" : "Grant Access"}
              </Text>
            )}
          </Pressable>
          {appleCalendarConnected ? (
            <Pressable
              style={[
                styles.appleDisconnectBtn,
                appleLoading && styles.appleBtnDisabled,
              ]}
              onPress={onDisconnect}
              disabled={appleLoading}
            >
              {appleLoading ? (
                <ActivityIndicator color="#EAFDFF" />
              ) : (
                <Text style={styles.appleDisconnectBtnText}>Disconnect</Text>
              )}
            </Pressable>
          ) : null}
        </>
      ) : (
        <View style={styles.applePlatformBadge}>
          <Text style={styles.applePlatformText}>iOS only</Text>
        </View>
      )}
    </View>
  </View>
);

export default AppleCalendarCard;
