import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import useCallTimer from "../../hooks/useCallTimer";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  Phone,
  MessageSquare,
  Calendar,
  PenLine,
  FileText,
  Brain,
} from "lucide-react-native";
import { useMadbelCallActionMutation } from "../../redux/slices/madbelApiSlice";

const IncomingCallScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const authUser = useSelector((state) => state?.auth?.user);
  const myUserId = authUser?._id || authUser?.id || authUser?.userId;

  const { callSid, call_sid, callId, callerName, callerNumber } = route.params || {};
  const activeCallSid = callSid || call_sid || callId || "mock_sid";

  const timer = useCallTimer(true);
  const [callAction] = useMadbelCallActionMutation();

  const handleDecline = async () => {
    try {
      await callAction({
        call_sid: activeCallSid,
        action: "cancel",
        user_id: myUserId || "guest",
      }).unwrap();
    } catch (e) {
      console.log("Decline action failed:", e);
    }
    navigation.goBack();
  };

  const handleAccept = async () => {
    try {
      await callAction({
        call_sid: activeCallSid,
        action: "receive",
        user_id: myUserId || "guest",
      }).unwrap();
    } catch (e) {
      console.log("Accept action failed:", e);
    }
    navigation.navigate("ActiveCall", {
      callSid: activeCallSid,
      callerName: callerName || "Sarah Jenkins",
      callerNumber: callerNumber || "+1 234 567 890",
    });
  };

  const handleTransferToAi = async () => {
    try {
      await callAction({
        call_sid: activeCallSid,
        action: "transfer_to_ai",
        user_id: myUserId || "guest",
      }).unwrap();
    } catch (e) {
      console.log("Transfer to AI action failed:", e);
    }
    navigation.navigate("AiCall", {
      callSid: activeCallSid,
      callerName: callerName || "Sarah Jenkins",
      callerNumber: callerNumber || "+1 234 567 890",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.liveCallPill}>
            <View style={styles.liveCallDot} />
            <Text style={styles.liveCallText}>Live Call</Text>
          </View>
          <Text style={styles.timerText}>{timer}</Text>
          <View style={{ width: 85 }} /> {/* Spacer to center the timer */}
        </View>
 
        {/* Profile Avatar */}
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
 
        {/* Contact Info */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{callerName || "Sarah Jenkins"}</Text>
          <Text style={styles.contactPhone}>{callerNumber || "+1 234 567 890"}</Text>
        </View>
 
        {/* AI Assistant Available Card */}
        <View style={styles.aiAssistantCard}>
          <View style={styles.cardHeader}>
            <Brain size={20} color="#00D2FF" style={{ marginRight: 8 }} />
            <Text style={styles.cardTitle}>AI Assistant Available</Text>
          </View>
 
          {/* Grid of features */}
          <View style={styles.featuresGrid}>
            <View style={styles.featureItem}>
              <MessageSquare size={18} color="#00D2FF" style={styles.featureIcon} />
              <Text style={styles.featureText}>Answer questions</Text>
            </View>
            <View style={styles.featureItem}>
              <Calendar size={18} color="#00D2FF" style={styles.featureIcon} />
              <Text style={styles.featureText}>Schedule meetings</Text>
            </View>
            <View style={styles.featureItem}>
              <PenLine size={18} color="#00D2FF" style={styles.featureIcon} />
              <Text style={styles.featureText}>Take notes</Text>
            </View>
            <View style={styles.featureItem}>
              <FileText size={18} color="#00D2FF" style={styles.featureIcon} />
              <Text style={styles.featureText}>Generate summaries</Text>
            </View>
          </View>
        </View>
 
        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {/* Decline Button */}
          <View style={styles.actionBtnContainer}>
            <Pressable
              style={[styles.circleBtn, styles.declineBtn]}
              onPress={handleDecline}
            >
              <Phone size={24} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Text style={styles.actionLabel}>DECLINE</Text>
          </View>
 
          {/* Transfer to AI Button */}
          <View style={styles.actionBtnContainer}>
            <Pressable
              style={[styles.circleBtn, styles.transferBtn]}
              onPress={handleTransferToAi}
            >
              <Brain size={28} color="#00D2FF" />
            </Pressable>
            <Text style={styles.transferLabel}>Transfer to AI</Text>
            <Text style={styles.transferSubLabel}>AI handles the call</Text>
          </View>
 
          {/* Accept Button */}
          <View style={styles.actionBtnContainer}>
            <Pressable
              style={[styles.circleBtn, styles.acceptBtn]}
              onPress={handleAccept}
            >
              <Phone size={24} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.actionLabel}>ACCEPT</Text>
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: responsiveHeight(1.5),
  },
  liveCallPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#05202E",
    borderWidth: 1,
    borderColor: "#005C7A",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveCallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00D2FF",
    marginRight: 6,
  },
  liveCallText: {
    color: "#00D2FF",
    fontSize: 12,
    fontWeight: "600",
  },
  timerText: {
    color: "#00D2FF",
    fontSize: 32,
    fontWeight: "700",
  },
  avatarContainer: {
    alignItems: "center",
    marginTop: responsiveHeight(2),
  },
  avatarOutline: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2.5,
    borderColor: "#00D2FF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    elevation: 10,
    backgroundColor: "#000000",
  },
  avatarImage: {
    width: 174,
    height: 174,
    borderRadius: 87,
  },
  aiReadyBadge: {
    position: "absolute",
    bottom: -10,
    backgroundColor: "#000000",
    borderWidth: 1.5,
    borderColor: "#00D2FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  aiReadyText: {
    color: "#00D2FF",
    fontSize: 10,
    fontWeight: "800",
  },
  contactInfo: {
    alignItems: "center",
    marginTop: responsiveHeight(2),
  },
  contactName: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
  },
  contactPhone: {
    color: "#8E9AA0",
    fontSize: 16,
    marginTop: 6,
  },
  aiAssistantCard: {
    backgroundColor: "#11151F",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1E2330",
    padding: 18,
    marginTop: responsiveHeight(1),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  featureItem: {
    width: "48%",
    backgroundColor: "#1E2230",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  featureIcon: {
    marginRight: 8,
  },
  featureText: {
    color: "#E2E8F0",
    fontSize: 11.5,
    fontWeight: "500",
    flex: 1,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: responsiveHeight(2),
    paddingHorizontal: responsiveWidth(2),
  },
  actionBtnContainer: {
    alignItems: "center",
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  declineBtn: {
    backgroundColor: "#A80B13",
  },
  acceptBtn: {
    backgroundColor: "#1E873C",
  },
  transferBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#08101C",
    borderWidth: 2,
    borderColor: "#00D2FF",
    shadowColor: "#00D2FF",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  actionLabel: {
    color: "#8E9AA0",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  transferLabel: {
    color: "#00D2FF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  transferSubLabel: {
    color: "#8E9AA0",
    fontSize: 9.5,
    marginTop: 2,
  },
});

export default IncomingCallScreen;
