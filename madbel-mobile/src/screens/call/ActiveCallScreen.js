import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import useCallTimer from "../../hooks/useCallTimer";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  Phone,
  PhoneForwarded,
  Brain,
  PhoneCall,
} from "lucide-react-native";
import { useMadbelCallActionMutation, useMadbelGetLiveCallTranscriptQuery } from "../../redux/slices/madbelApiSlice";

const ActiveCallScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { callSid, call_sid, callId, callerName, callerNumber, mode: initialMode } = route.params || {};
  const activeCallSid = callSid || call_sid || callId || null;
  const [currentMode, setCurrentMode] = useState(initialMode || "forwarded"); // "forwarded" or "ai"

  const timer = useCallTimer(true);
  const [callAction] = useMadbelCallActionMutation();

  const { data: transcriptResponse } = useMadbelGetLiveCallTranscriptQuery(
    activeCallSid,
    {
      pollingInterval: 2000,
      skip: !activeCallSid,
    }
  );

  const transcriptData = transcriptResponse?.data || transcriptResponse;

  const displayTranscript = (() => {
    const segments = transcriptData?.speaker_segments || [];
    if (segments && segments.length > 0) {
      return segments
        .map((seg) => `${seg.speaker === "ai" ? "AI" : (callerName || "Caller")}: ${seg.text}`)
        .join("\n");
    }
    return transcriptData?.transcript || t("waiting_for_transcript") || "Live call transcription in progress...";
  })();

  // Blinking effect for live indicator
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [blinkAnim]);

  const handleEndCall = async () => {
    try {
      await callAction({
        call_sid: activeCallSid,
        action: "cancel",
        user_id: myUserId || "guest",
      }).unwrap();
    } catch (e) {
      // call may already be ended
    }
    navigation.navigate("BottomNavigator", {
      screen: "Home",
      params: { screen: "HomeActivity" },
    });
  };

  const handleTransferToMyPhone = async () => {
    try {
      await callAction({
        call_sid: activeCallSid,
        action: "receive",
        user_id: myUserId || "guest",
      }).unwrap();
      setCurrentMode("forwarded");
    } catch (e) {
      // transfer error
    }
  };

  const isForwarded = currentMode === "forwarded";

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Status Pill & Call Timer */}
        <View style={styles.topRow}>
          <Animated.View style={[isForwarded ? styles.forwardedPill : styles.aiPill, { opacity: blinkAnim }]}>
            <View style={isForwarded ? styles.forwardedDot : styles.aiDot} />
            <Text style={isForwarded ? styles.forwardedPillText : styles.aiPillText}>
              {isForwarded ? (t("call_forwarded_pill") || "FORWARDED TO PHONE") : (t("ai_active_pill") || "AI RECEPTIONIST ACTIVE")}
            </Text>
          </Animated.View>
          <Text style={styles.timerText}>{timer}</Text>
        </View>

        {/* Circular Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatarOutline, isForwarded ? styles.avatarForwardedBorder : styles.avatarAiBorder]}>
            <View style={styles.avatarInitialsWrap}>
              <Text style={styles.avatarInitialsText}>
                {callerName ? callerName.slice(0, 2).toUpperCase() : "??"}
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Info & Clear Honest Status Banner */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{callerName || "Caller"}</Text>
          {callerNumber ? <Text style={styles.contactPhone}>{callerNumber}</Text> : null}

          {/* Honest Status Banner */}
          <View style={styles.statusBanner}>
            {isForwarded ? (
              <>
                <PhoneForwarded size={18} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.statusBannerText}>
                  {t("call_forwarded_banner_msg") || "Call routed to your registered phone. Answer your cellular phone to talk."}
                </Text>
              </>
            ) : (
              <>
                <Brain size={18} color="#A855F7" style={{ marginRight: 8 }} />
                <Text style={styles.statusBannerText}>
                  {t("ai_active_banner_msg") || "AI Receptionist is answering this call. Watching real-time transcript below."}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Option to Take Over AI Call to Cellular Phone */}
        {!isForwarded && (
          <Pressable style={styles.takeOverBtn} onPress={handleTransferToMyPhone}>
            <PhoneCall size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.takeOverBtnText}>
              {t("transfer_to_my_phone") || "Transfer Call to My Phone"}
            </Text>
          </Pressable>
        )}

        {/* Live AI Call Transcript Monitor Card */}
        <View style={styles.transcriptCard}>
          <View style={styles.cardHeader}>
            <Brain size={16} color="#00D2FF" style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>{t("ai_smart_transcript") || "LIVE CALL TRANSCRIPT"}</Text>
          </View>
          <Text style={styles.transcriptText}>{displayTranscript}</Text>
          <View style={styles.liveUpdateContainer}>
            <Animated.View style={[styles.liveUpdateDot, { opacity: blinkAnim }]} />
            <Text style={styles.liveUpdateText}>{t("live_update") || "LIVE TRANSCRIPT POLLING"}</Text>
          </View>
        </View>

        {/* Red End Call Button */}
        <View style={styles.endCallContainer}>
          <Pressable style={styles.endCallBtn} onPress={handleEndCall}>
            <Phone size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
          <Text style={styles.endCallLabel}>{t("end_call") || "End Call"}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(6),
    justifyContent: "space-between",
    paddingBottom: responsiveHeight(4),
  },
  topRow: {
    alignItems: "center",
    paddingTop: responsiveHeight(1.5),
    gap: 8,
  },
  forwardedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  forwardedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  forwardedPillText: {
    color: "#6EE7B7",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  aiPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B0764",
    borderWidth: 1,
    borderColor: "#A855F7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C084FC",
    marginRight: 6,
  },
  aiPillText: {
    color: "#E9D5FF",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  avatarContainer: {
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  avatarOutline: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  avatarForwardedBorder: {
    borderColor: "#10B981",
    shadowColor: "#10B981",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  avatarAiBorder: {
    borderColor: "#A855F7",
    shadowColor: "#A855F7",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  avatarInitialsWrap: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: "#0F2A38",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: {
    color: "#00D2FF",
    fontSize: 36,
    fontWeight: "700",
  },
  contactInfo: {
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  contactName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  contactPhone: {
    color: "#8E9AA0",
    fontSize: 14,
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginHorizontal: 10,
  },
  statusBannerText: {
    color: "#D1D5DB",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  takeOverBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0284C7",
    borderRadius: 14,
    paddingVertical: 12,
    marginHorizontal: 10,
    marginTop: 8,
  },
  takeOverBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  transcriptCard: {
    backgroundColor: "#161B26",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#20242F",
    padding: 16,
    marginVertical: responsiveHeight(1),
    maxHeight: 180,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#8E9AA0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  transcriptText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },
  liveUpdateContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 8,
  },
  liveUpdateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D2FF",
    marginRight: 6,
  },
  liveUpdateText: {
    color: "#8E9AA0",
    fontSize: 9.5,
    fontWeight: "600",
  },
  endCallContainer: {
    alignItems: "center",
    marginTop: responsiveHeight(1),
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#A80B13",
    justifyContent: "center",
    alignItems: "center",
  },
  endCallLabel: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
});

export default ActiveCallScreen;
