import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import {
  useMadbelGetCallLogQuery,
  useMadbelGetCallTranscriptQuery,
  useMadbelGetCallAiSummaryQuery,
  useMadbelCreateOutboundCallMutation,
} from "../../redux/slices/madbelApiSlice";

const ALEX_THOMPSON_MOCK = {
  name: "Alex Thompson",
  title: "Acme Corp • Senior Manager",
  phone: "+1 (555) 012-3456",
  email: "alex.t@acme.com",
  location: "San Francisco, CA",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300", // professional headshot
  callTime: "Today, 10:45 AM",
  callDuration: "12m 34s",
  purpose: "Discussed invoice correction & future ordering.",
  keyPoints: [
    "Mismatch in the July 15th invoice totaling $420.",
    "Requested a credit note for missing produce.",
  ],
  actionItems: [
    "Send corrected PDF by Friday EOD.",
    "Schedule follow-up call for next inventory cycle.",
  ],
};

const WAVEFORM_HEIGHTS = [
  15, 25, 40, 20, 10, 30, 45, 55, 35, 15, 20, 35, 40, 25, 10, 20, 45, 50, 35, 15,
  20, 40, 30, 15, 25, 45, 35, 10, 20, 40, 48, 30, 15, 25, 42, 35, 10, 15, 30, 20,
];

const CallAnalysisScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { callId, callerName } = route.params || {};

  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState("1x");
  const [showTranscript, setShowTranscript] = useState(false);

  // APIs
  const { data: callLogResponse, isLoading: isLogLoading } = useMadbelGetCallLogQuery(
    { call_id: callId },
    { skip: !callId }
  );
  const { data: transcriptResponse } = useMadbelGetCallTranscriptQuery(
    { call_id: callId },
    { skip: !callId }
  );
  const { data: summaryResponse } = useMadbelGetCallAiSummaryQuery(
    { call_id: callId },
    { skip: !callId }
  );

  const [createOutboundCall] = useMadbelCreateOutboundCallMutation();

  const details = useMemo(() => {
    if (!callId) {
      return ALEX_THOMPSON_MOCK;
    }

    const log = callLogResponse?.data || callLogResponse;
    const summary = summaryResponse?.data || summaryResponse || {};
    const transcriptData = transcriptResponse?.data || transcriptResponse || {};

    const points = summary.key_points || summary.keyPoints || [];
    const actions = summary.action_items || summary.actionItems || [];

    return {
      name: log?.contact_name || callerName || ALEX_THOMPSON_MOCK.name,
      title: log?.contact?.job_title || ALEX_THOMPSON_MOCK.title,
      phone: log?.phone_number || ALEX_THOMPSON_MOCK.phone,
      email: log?.contact?.email || ALEX_THOMPSON_MOCK.email,
      location: log?.contact?.location || ALEX_THOMPSON_MOCK.location,
      avatar: log?.contact?.avatar_url || ALEX_THOMPSON_MOCK.avatar,
      callTime: log?.display_time_label || ALEX_THOMPSON_MOCK.callTime,
      callDuration: log?.duration_label || ALEX_THOMPSON_MOCK.callDuration,
      purpose: summary.purpose || ALEX_THOMPSON_MOCK.purpose,
      keyPoints: points.length > 0 ? points : ALEX_THOMPSON_MOCK.keyPoints,
      actionItems: actions.length > 0 ? actions : ALEX_THOMPSON_MOCK.actionItems,
      transcript: transcriptData.transcript || log?.transcript || "No transcript available for this call.",
    };
  }, [callId, callLogResponse, summaryResponse, transcriptResponse, callerName]);

  const handlePlaceCall = async () => {
    try {
      Alert.alert("Placing Call", `Connecting to ${details.name}...`);
      await createOutboundCall({ phone_number: details.phone }).unwrap();
    } catch (err) {
      console.log("Call failed:", err);
      Alert.alert("Call Failed", err?.data?.message || "Could not connect call.");
    }
  };

  const handleSendMessage = () => {
    Alert.alert("Message Contact", "Navigating to chat...");
  };

  const renderBulletText = (text, type) => {
    if (type === "keyPoints" && text.includes("July 15th")) {
      const parts = text.split("July 15th");
      return (
        <Text style={styles.bulletText}>
          {parts[0]}
          <Text style={{ color: "#7B61FF", fontWeight: "700" }}>July 15th</Text>
          {parts[1]}
        </Text>
      );
    }
    if (type === "actionItems" && text.includes("Friday EOD")) {
      const parts = text.split("Friday EOD");
      return (
        <Text style={styles.bulletText}>
          {parts[0]}
          <Text style={{ color: "#FFD043", fontWeight: "700" }}>Friday EOD</Text>
          {parts[1]}
        </Text>
      );
    }
    return <Text style={styles.bulletText}>{text}</Text>;
  };

  if (isLogLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#17CBE8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={28} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {details.name}
          </Text>
          <View style={styles.headerSpace} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <Image source={{ uri: details.avatar }} style={styles.profileAvatar} />
            <Text style={styles.profileName}>{details.name}</Text>
            <Text style={styles.profileTitle}>{details.title}</Text>

            <View style={styles.infoSeparator} />

            {/* Info rows */}
            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Phone size={16} color="#7E8DA7" />
                <Text style={styles.infoRowText}>{details.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <Mail size={16} color="#7E8DA7" />
                <Text style={styles.infoRowText}>{details.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <MapPin size={16} color="#7E8DA7" />
                <Text style={styles.infoRowText}>{details.location}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtons}>
              <Pressable style={styles.callBtn} onPress={handlePlaceCall}>
                <Phone size={18} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Call</Text>
              </Pressable>
              <Pressable style={styles.messageBtn} onPress={handleSendMessage}>
                <MessageSquare size={18} color="#FF7E40" />
                <Text style={styles.messageBtnText}>Message</Text>
              </Pressable>
            </View>
          </View>

          {/* Section Header */}
          <Text style={styles.sectionHeaderTitle}>Call History</Text>

          {/* Call Detail Box */}
          <View style={styles.detailBox}>
            <View style={styles.detailHeader}>
              <View style={styles.detailTitleWrap}>
                <View style={styles.callIconWrapper}>
                  <Phone size={16} color="#17CBE8" />
                </View>
                <View>
                  <Text style={styles.detailTitle}>Incoming Call</Text>
                  <Text style={styles.detailSub}>{`${details.callTime} • ${details.callDuration}`}</Text>
                </View>
              </View>
              <View style={styles.recordedBadge}>
                <Text style={styles.recordedBadgeText}>Recorded</Text>
              </View>
            </View>

            {/* Waveform Player */}
            <View style={styles.waveformContainer}>
              {WAVEFORM_HEIGHTS.map((h, i) => (
                <View
                  key={`wave-${i}`}
                  style={[
                    styles.waveformBar,
                    { height: h },
                    isPlaying && i % 4 === 0 && { backgroundColor: "#17CBE8" },
                  ]}
                />
              ))}
            </View>

            {/* Player Controls */}
            <View style={styles.playerControls}>
              <Pressable style={styles.playPauseBtn} onPress={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? (
                  <Pause size={18} color="#000" fill="#000" />
                ) : (
                  <Play size={18} color="#000" fill="#000" />
                )}
              </Pressable>

              <View style={styles.speedRow}>
                {["1x", "1.5x", "2x"].map((speed) => (
                  <Pressable
                    key={speed}
                    style={[styles.speedBox, playSpeed === speed && styles.speedBoxActive]}
                    onPress={() => setPlaySpeed(speed)}
                  >
                    <Text style={[styles.speedText, playSpeed === speed && styles.speedTextActive]}>
                      {speed}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={styles.transcriptToggle}
                onPress={() => setShowTranscript(!showTranscript)}
              >
                <Text style={styles.transcriptToggleText}>
                  {showTranscript ? "Hide Transcript" : "View Transcript"}
                </Text>
                {showTranscript ? (
                  <ChevronUp size={16} color="#17CBE8" />
                ) : (
                  <ChevronDown size={16} color="#17CBE8" />
                )}
              </Pressable>
            </View>

            {/* Transcript Area */}
            {showTranscript && (
              <View style={styles.transcriptCard}>
                <Text style={styles.transcriptHeader}>Call Transcript</Text>
                <ScrollView nestedScrollEnabled style={styles.transcriptScroll}>
                  <Text style={styles.transcriptBodyText}>
                    {details.transcript ||
                      "Alex: Hello? Yes, I received the July 15th invoice. It looks like we were billed $420 extra for the produce order. Can you check that?\n\nAgent: Hi Alex, I will look into it immediately. We'll issue a credit note for any mismatch. I can send the corrected PDF by Friday EOD.\n\nAlex: Perfect, and let's schedule a follow-up for our next inventory cycle.\n\nAgent: Absolutely, will do."}
                  </Text>
                </ScrollView>
              </View>
            )}

            {/* Summary Divider */}
            <View style={styles.cardSeparator} />

            {/* AI Call Summary */}
            <View style={styles.summarySection}>
              <View style={styles.summaryTitleRow}>
                <View style={styles.summaryDot} />
                <Text style={styles.summaryTitle}>AI Call Summary</Text>
              </View>

              {/* Purpose */}
              <Text style={styles.labelTitle}>PURPOSE</Text>
              <Text style={styles.purposeText}>{details.purpose}</Text>

              {/* Key Points */}
              <Text style={styles.labelTitle}>Key Points</Text>
              {details.keyPoints.map((pt, idx) => (
                <View key={`pt-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  {renderBulletText(pt, "keyPoints")}
                </View>
              ))}

              {/* Action Items */}
              <Text style={styles.labelTitle}>Action Items</Text>
              {details.actionItems.map((item, idx) => (
                <View key={`act-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDotGold}>•</Text>
                  {renderBulletText(item, "actionItems")}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, backgroundColor: "#000000", paddingHorizontal: responsiveWidth(4.5) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: responsiveHeight(0.5),
    paddingBottom: responsiveHeight(1.5),
  },
  backBtn: { width: responsiveWidth(10), alignItems: "flex-start" },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: responsiveWidth(4.8),
    fontWeight: "700",
    textAlign: "center",
    maxWidth: responsiveWidth(55),
  },
  headerSpace: { width: responsiveWidth(10) },
  scrollContent: { gap: responsiveHeight(1.8), paddingBottom: responsiveHeight(15) },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileCard: {
    backgroundColor: "#121318",
    borderWidth: 1,
    borderColor: "#1F222A",
    borderRadius: 18,
    alignItems: "center",
    padding: responsiveWidth(4),
  },
  profileAvatar: {
    width: responsiveWidth(20),
    height: responsiveWidth(20),
    borderRadius: responsiveWidth(10),
    backgroundColor: "#20222A",
  },
  profileName: { color: "#FFFFFF", fontSize: 20, fontWeight: "700", marginTop: responsiveHeight(1.5) },
  profileTitle: { color: "#7E8DA7", fontSize: 14, marginTop: 4 },
  infoSeparator: { height: 1, backgroundColor: "#1F222A", width: "100%", marginVertical: responsiveHeight(1.5) },
  infoRows: { width: "100%", gap: responsiveHeight(1), paddingHorizontal: responsiveWidth(2) },
  infoRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(3) },
  infoRowText: { color: "#B9CADF", fontSize: 15 },
  actionButtons: { flexDirection: "row", gap: responsiveWidth(3), marginTop: responsiveHeight(2.2), width: "100%" },
  callBtn: {
    flex: 1,
    height: responsiveHeight(5.6),
    borderRadius: 12,
    backgroundColor: "#1D283E",
    borderWidth: 1,
    borderColor: "#2B3C58",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  callBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  messageBtn: {
    flex: 1,
    height: responsiveHeight(5.6),
    borderRadius: 12,
    backgroundColor: "#2E1A14",
    borderWidth: 1,
    borderColor: "#5C3120",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  messageBtnText: { color: "#FF7E40", fontSize: 15, fontWeight: "700" },
  sectionHeaderTitle: { color: "#FFFFFF", fontSize: responsiveWidth(4.5), fontWeight: "600", marginTop: responsiveHeight(0.8) },
  detailBox: {
    backgroundColor: "#121318",
    borderWidth: 1,
    borderColor: "#1F222A",
    borderRadius: 18,
    padding: responsiveWidth(4),
  },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  detailTitleWrap: { flexDirection: "row", gap: responsiveWidth(3), alignItems: "center" },
  callIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0F2A38",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  detailSub: { color: "#7E8DA7", fontSize: 13, marginTop: 2 },
  recordedBadge: {
    backgroundColor: "#2E181A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordedBadgeText: { color: "#FC6166", fontSize: 11, fontWeight: "700" },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    marginTop: responsiveHeight(2.5),
    paddingHorizontal: responsiveWidth(1),
  },
  waveformBar: {
    width: 3,
    backgroundColor: "#2C3446",
    borderRadius: 1.5,
  },
  playerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: responsiveHeight(2.2),
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#17CBE8",
    alignItems: "center",
    justifyContent: "center",
  },
  speedRow: { flexDirection: "row", gap: 6 },
  speedBox: {
    borderWidth: 1,
    borderColor: "#2F384C",
    backgroundColor: "#14171E",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  speedBoxActive: {
    borderColor: "#17CBE8",
    backgroundColor: "#0C232F",
  },
  speedText: { color: "#7E8DA7", fontSize: 13, fontWeight: "600" },
  speedTextActive: { color: "#17CBE8" },
  transcriptToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  transcriptToggleText: { color: "#17CBE8", fontSize: 14, fontWeight: "600" },
  transcriptCard: {
    marginTop: responsiveHeight(2),
    backgroundColor: "#17181F",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2E3D",
    padding: 12,
  },
  transcriptHeader: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  transcriptScroll: { maxHeight: 150 },
  transcriptBodyText: { color: "#B9CADF", fontSize: 14, lineHeight: 22 },
  cardSeparator: { height: 1, backgroundColor: "#1F222A", marginVertical: responsiveHeight(2) },
  summarySection: {},
  summaryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: responsiveHeight(1.5) },
  summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#BD93F9" },
  summaryTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  labelTitle: { color: "#7E8DA7", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: responsiveHeight(1.5), textTransform: "uppercase" },
  purposeText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, marginTop: 4 },
  bulletRow: { flexDirection: "row", gap: 8, marginTop: 8, paddingRight: responsiveWidth(2) },
  bulletDot: { color: "#7B61FF", fontSize: 16, marginTop: -2 },
  bulletDotGold: { color: "#FFD043", fontSize: 16, marginTop: -2 },
  bulletText: { color: "#D1E0F5", fontSize: 14, lineHeight: 21, flex: 1 },
});

export default CallAnalysisScreen;
