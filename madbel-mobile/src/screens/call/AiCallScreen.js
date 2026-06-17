import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import useCallTimer from "../../hooks/useCallTimer";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { LinearGradient } from "expo-linear-gradient";
import {
  Phone,
  MicOff,
  Volume2,
  Grid,
  Pause,
  Circle,
  UserPlus,
  Bot,
  User,
  FileText,
} from "lucide-react-native";
import { useMadbelCallActionMutation, useMadbelGetLiveCallTranscriptQuery } from "../../redux/slices/madbelApiSlice";

const AiCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { callSid, call_sid, callId, callerName, callerNumber } = route.params || {};
  const activeCallSid = callSid || call_sid || callId || null;

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

  const segments = transcriptData?.speaker_segments || [];
  const renderedSegments = segments.length > 0 ? segments : [
    { speaker: "ai", text: "AI is handling the call. Transcript will appear here..." },
  ];

  // Animation values for the abstract blue orb
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation (scale)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // Rotation animation for the inner pattern
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    );

    pulse.start();
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [pulseAnim, rotateAnim]);

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
    navigation.navigate("HomeActivity");
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header Section */}
        <View style={styles.topRow}>
          <View style={styles.aiHandlingPill}>
            <View style={styles.liveCallDot} />
            <Text style={styles.aiHandlingText}>AI Handling Call</Text>
          </View>
          <Text style={styles.timerText}>{timer}</Text>
          <Text style={styles.subText}>Live AI conversation active</Text>
        </View>

        {/* Abstract Glowing Orb */}
        <View style={styles.orbArea}>
          {/* Floating Stars/Particles */}
          <View style={[styles.star, styles.starOne]} />
          <View style={[styles.star, styles.starTwo]} />
          <View style={[styles.star, styles.starThree]} />

          {/* Glowing rings */}
          <Animated.View
            style={[
              styles.ringOuter,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Animated.View
              style={[
                styles.ringInner,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              {/* Main Glowing Orb */}
              <LinearGradient
                colors={["#00D2FF", "#005CFF", "#03001E"]}
                style={styles.orbCircle}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Animated.View
                  style={[
                    styles.orbTexture,
                    { transform: [{ rotate: spin }] },
                  ]}
                >
                  <LinearGradient
                    colors={["rgba(0, 210, 255, 0.4)", "transparent"]}
                    style={{ flex: 1, borderRadius: 80 }}
                  />
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </View>

        {/* Contact Info (Talking With) */}
        <View style={styles.contactInfo}>
          <Text style={styles.talkingLabel}>Talking With: {callerName || "Unknown Caller"}</Text>
          {callerNumber ? <Text style={styles.contactPhone}>{callerNumber}</Text> : null}
        </View>

        {/* Live Transcript Dialog */}
        <View style={styles.transcriptCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>LIVE TRANSCRIPT</Text>
            <FileText size={14} color="#8E9AA0" />
          </View>

          {renderedSegments.map((seg, idx) => {
            const isAi = seg.speaker === "ai" || seg.speaker === "system";
            return (
              <View key={idx} style={styles.dialogRow}>
                <View style={styles.avatarIconWrap}>
                  {isAi ? (
                    <Bot size={16} color="#00D2FF" />
                  ) : (
                    <User size={16} color="#8E9AA0" />
                  )}
                </View>
                <View style={styles.dialogContent}>
                  <Text style={styles.dialogSender}>{isAi ? "AI" : "Customer"}</Text>
                  <Text style={styles.dialogText}>{seg.text}</Text>
                </View>
              </View>
            );
          })}
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
    gap: 6,
  },
  aiHandlingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#05202E",
    borderWidth: 1,
    borderColor: "#005C7A",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  liveCallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D2FF",
    marginRight: 6,
  },
  aiHandlingText: {
    color: "#00D2FF",
    fontSize: 10.5,
    fontWeight: "700",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
    marginTop: 4,
  },
  subText: {
    color: "#8E9AA0",
    fontSize: 12.5,
    fontWeight: "500",
  },
  orbArea: {
    height: responsiveHeight(26),
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: responsiveHeight(1),
  },
  star: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
    opacity: 0.6,
  },
  starOne: {
    top: 20,
    right: 40,
    width: 4,
    height: 4,
    backgroundColor: "#00D2FF",
  },
  starTwo: {
    bottom: 30,
    left: 50,
  },
  starThree: {
    top: "50%",
    left: 20,
    opacity: 0.4,
  },
  ringOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: "rgba(0, 210, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  ringInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: "rgba(0, 210, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  orbCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: "hidden",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.65,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 12,
  },
  orbTexture: {
    flex: 1,
    borderRadius: 75,
    opacity: 0.8,
  },
  contactInfo: {
    alignItems: "center",
    marginTop: responsiveHeight(0.5),
  },
  talkingLabel: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  contactPhone: {
    color: "#8E9AA0",
    fontSize: 15,
    marginTop: 4,
  },
  transcriptCard: {
    backgroundColor: "#11151F",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2330",
    padding: 16,
    marginVertical: responsiveHeight(0.5),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: "#8E9AA0",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dialogRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 10,
  },
  avatarIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#161B26",
    borderWidth: 1,
    borderColor: "#20242F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  dialogContent: {
    flex: 1,
  },
  dialogSender: {
    color: "#8E9AA0",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  dialogText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
  },
  controlsGrid: {
    gap: 16,
    marginTop: responsiveHeight(0.5),
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

export default AiCallScreen;
