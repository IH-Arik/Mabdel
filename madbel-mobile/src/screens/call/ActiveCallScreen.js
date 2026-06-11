import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Image, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  Phone,
  MicOff,
  Volume2,
  Grid,
  Pause,
  Circle,
  UserPlus,
  Brain,
} from "lucide-react-native";
import { useMadbelCallActionMutation, useMadbelGetCallTranscriptQuery } from "../../redux/slices/madbelApiSlice";

const ActiveCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { callSid, call_sid, callId, callerName, callerNumber } = route.params || {};
  const activeCallSid = callSid || call_sid || callId || "mock_sid";

  const [callAction] = useMadbelCallActionMutation();

  // Poll transcript every 2 seconds if not mock
  const { data: transcriptResponse } = useMadbelGetCallTranscriptQuery(
    activeCallSid,
    {
      pollingInterval: 2000,
      skip: !activeCallSid || activeCallSid === "mock_sid",
    }
  );

  const transcriptData = transcriptResponse?.data || transcriptResponse;

  // Compile transcription text from speaker segments or raw transcript string
  const displayTranscript = (() => {
    const segments = transcriptData?.speaker_segments || [];
    if (segments && segments.length > 0) {
      return segments
        .map((seg) => `${seg.speaker === "ai" ? "AI" : (callerName || "Sarah Jenkins")}: ${seg.text}`)
        .join("\n");
    }
    return (
      transcriptData?.transcript ||
      "Sarah Jenkins: I'm calling about the maintenance clauses in the lease agreement, specifically section 4.2 regarding emergency repairs..."
    );
  })();

  // Blinking effect for recording dot
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.2,
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
      console.log("End call action failed:", e);
    }
    navigation.navigate("HomeActivity");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Flashing Recording indicator & Timer */}
        <View style={styles.topRow}>
          <Animated.View style={[styles.recActivePill, { opacity: blinkAnim }]}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC ACTIVE</Text>
          </Animated.View>
          <Text style={styles.timerText}>04:12</Text>
        </View>

        {/* Circular Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarOutline}>
            <Image
              source={{ uri: "https://i.pravatar.cc/300?img=49" }}
              style={styles.avatarImage}
            />
          </View>
          <View style={styles.aiReadyBadge}>
            <Text style={styles.aiReadyText}>AI READY CALL</Text>
          </View>
        </View>

        {/* Caller Info */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{callerName || "Sarah Jenkins"}</Text>
          <Text style={styles.contactPhone}>{callerNumber || "+1 234 567 890"}</Text>
        </View>

        {/* AI Smart Transcript Card */}
        <View style={styles.transcriptCard}>
          <View style={styles.cardHeader}>
            <Brain size={16} color="#00D2FF" style={{ marginRight: 6 }} />
            <Text style={styles.cardTitle}>AI SMART TRANSCRIPT</Text>
          </View>
          <Text style={styles.transcriptText}>{displayTranscript}</Text>
          <View style={styles.liveUpdateContainer}>
            <Animated.View style={[styles.liveUpdateDot, { opacity: blinkAnim }]} />
            <Text style={styles.liveUpdateText}>Live Update</Text>
          </View>
        </View>

        {/* Controls Grid */}
        <View style={styles.controlsGrid}>
          {/* Row 1 */}
          <View style={styles.controlsRow}>
            <View style={styles.controlItem}>
              <Pressable style={styles.controlCircle}>
                <MicOff size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.controlLabel}>MUTE</Text>
            </View>

            <View style={styles.controlItem}>
              <Pressable style={styles.controlCircle}>
                <Volume2 size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.controlLabel}>SPEAKER</Text>
            </View>

            <View style={styles.controlItem}>
              <Pressable style={styles.controlCircle}>
                <Grid size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.controlLabel}>KEYPAD</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.controlsRow}>
            <View style={styles.controlItem}>
              <Pressable style={styles.controlCircle}>
                <Pause size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.controlLabel}>HOLD</Text>
            </View>

            <View style={styles.controlItem}>
              <Pressable style={[styles.controlCircle, styles.recordingCircle]}>
                <Circle size={14} color="#00D2FF" fill="#00D2FF" />
              </Pressable>
              <Text style={styles.recordingLabel}>RECORDING</Text>
            </View>

            <View style={styles.controlItem}>
              <Pressable style={styles.controlCircle}>
                <UserPlus size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.controlLabel}>ADD CALL</Text>
            </View>
          </View>
        </View>

        {/* Red End Call Button */}
        <View style={styles.endCallContainer}>
          <Pressable style={styles.endCallBtn} onPress={handleEndCall}>
            <Phone size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
  recActivePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#200E0E",
    borderWidth: 1,
    borderColor: "#5F1A1A",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF5E5E",
    marginRight: 6,
  },
  recText: {
    color: "#FF8A8A",
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
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#00D2FF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: "#000000",
  },
  avatarImage: {
    width: 134,
    height: 134,
    borderRadius: 67,
  },
  aiReadyBadge: {
    position: "absolute",
    bottom: -8,
    backgroundColor: "#000000",
    borderWidth: 1.2,
    borderColor: "#00D2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiReadyText: {
    color: "#00D2FF",
    fontSize: 9,
    fontWeight: "800",
  },
  contactInfo: {
    alignItems: "center",
    marginTop: responsiveHeight(1.5),
  },
  contactName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  contactPhone: {
    color: "#8E9AA0",
    fontSize: 15,
    marginTop: 4,
  },
  transcriptCard: {
    backgroundColor: "#161B26",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#20242F",
    padding: 16,
    marginVertical: responsiveHeight(1),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    color: "#8E9AA0",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  transcriptText: {
    color: "#E2E8F0",
    fontSize: 13.5,
    lineHeight: 20,
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
    fontSize: 10,
    fontWeight: "500",
  },
  controlsGrid: {
    gap: 16,
    marginTop: responsiveHeight(1),
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(2),
  },
  controlItem: {
    alignItems: "center",
    width: "30%",
  },
  controlCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "#20242F",
    justifyContent: "center",
    alignItems: "center",
  },
  recordingCircle: {
    borderColor: "#00D2FF",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 6,
  },
  controlLabel: {
    color: "#8E9AA0",
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  recordingLabel: {
    color: "#00D2FF",
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  endCallContainer: {
    alignItems: "center",
    marginTop: responsiveHeight(2),
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#A80B13",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ActiveCallScreen;
