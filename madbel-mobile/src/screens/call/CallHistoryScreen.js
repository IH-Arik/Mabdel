import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ArrowLeft,
  Search,
  Mic,
  MessageSquare,
  Sparkles,
  Phone,
  Download,
  PhoneCall,
} from "lucide-react-native";
import {
  useMadbelListCallsQuery,
  useMadbelCreateOutboundCallMutation,
} from "../../redux/slices/madbelApiSlice";


const CallHistoryScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: apiCallsResponse, isLoading: isCallsLoading, refetch } = useMadbelListCallsQuery({
    page: 1,
    page_size: 50,
  });

  const [createOutboundCall, { isLoading: isCalling }] = useMadbelCreateOutboundCallMutation();

  const handleCallBack = async (numberOrContactId) => {
    try {
      Alert.alert("Initiating Outbound Call", `Connecting outbound call session...`);
      const payload = numberOrContactId.includes("+")
        ? { phone_number: numberOrContactId }
        : { contact_id: numberOrContactId };

      const res = await createOutboundCall(payload).unwrap();
      const callLog = res?.call_log || res?.data?.call_log;
      if (callLog) {
        navigation.navigate("ActiveCall", {
          callSid: callLog.twilio_call_sid || res?.twilio_call_sid,
          callerName: callLog.contact_name || numberOrContactId,
          callerNumber: callLog.phone_number || numberOrContactId,
        });
      }
    } catch (err) {
      Alert.alert("Call Failed", err?.data?.message || "Could not place outbound call.");
    }
  };

  const handleDownloadRecording = (callId) => {
    Alert.alert("Recording Download", "Downloading call audio recording...");
  };

  const callsList = useMemo(() => {
    const rawItems = apiCallsResponse?.data?.items || apiCallsResponse?.items || [];

    return rawItems.map((item) => {
      // Map colors and initials based on types
      let initials = item.initials || "NA";
      let avatarColor = "#1C2431";
      let initialsColor = "#8E9AA0";
      
      if (item.contact_name) {
        const parts = item.contact_name.split(" ");
        initials = parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
        if (item.call_type === "missed") {
          avatarColor = "#2F191B";
          initialsColor = "#FC6166";
        } else if (item.call_type === "incoming_automated") {
          avatarColor = "#0F2A38";
          initialsColor = "#17CBE8";
        } else {
          avatarColor = "#2E1C38";
          initialsColor = "#D16BE8";
        }
      } else {
        initials = "📞";
      }

      return {
        ...item,
        initials,
        avatarColor,
        initialsColor,
        hasTranscript: item.transcript_available || item.call_type === "incoming_automated",
        hasAiSummary: item.ai_summary_available || item.call_type === "incoming_automated",
        hasRecording: item.recording_available,
        hasCallBack: item.call_type === "outgoing_direct",
        hasCallBackNow: item.call_type === "missed",
        isGreenCallBack: true,
      };
    });
  }, [apiCallsResponse]);

  const filteredCalls = useMemo(() => {
    if (!searchQuery.trim()) return callsList;
    return callsList.filter((item) => {
      const name = item.contact_name || "";
      const num = item.phone_number || "";
      return (
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        num.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [callsList, searchQuery]);

  const renderItem = ({ item }) => {
    const isMissed = item.call_type === "missed";
    const nameDisplay = item.contact_name || item.phone_number || "Unknown Caller";

    return (
      <Pressable
        style={styles.callRow}
        onPress={() =>
          navigation.navigate("CallAnalysis", {
            callId: item.id,
            callerName: nameDisplay,
            callerNumber: item.phone_number || "+1 (555) 012-3456",
          })
        }
      >
        <View style={styles.callMainInfo}>
          {/* Avatar circle */}
          <View style={[styles.avatarCircle, { backgroundColor: item.avatarColor }]}>
            <Text style={[styles.avatarInitials, { color: item.initialsColor }]}>
              {item.initials}
            </Text>
          </View>

          {/* Name, label & count */}
          <View style={styles.textContainer}>
            <View style={styles.nameHeaderRow}>
              <Text style={[styles.callerName, isMissed && { color: "#FC6166" }]} numberOfLines={1}>
                {nameDisplay}
              </Text>
              {item.repeat_count > 1 && (
                <View style={styles.countCapsule}>
                  <Text style={styles.countText}>{item.repeat_count}</Text>
                </View>
              )}
            </View>
            <View style={styles.subtextRow}>
              {isMissed ? (
                <Text style={styles.missedCallArrow}>🗙 </Text>
              ) : item.call_type === "outgoing_direct" ? (
                <Text style={styles.outgoingCallArrow}>➔ </Text>
              ) : (
                <Text style={styles.incomingCallArrow}>➔ </Text>
              )}
              <Text style={styles.callTypeLabel}>{item.call_type_label || "Call"}</Text>
            </View>
          </View>

          {/* Time & Duration */}
          <View style={styles.timeInfo}>
            <Text style={styles.durationText}>{item.duration_label || "--"}</Text>
            <Text style={styles.timestampText}>{item.display_time_label || "Yesterday"}</Text>
          </View>
        </View>

        {/* Buttons row */}
        <View style={styles.actionButtonsRow}>
          {item.hasTranscript && (
            <Pressable
              style={styles.actionBtn}
              onPress={() =>
                navigation.navigate("CallAnalysis", {
                  callId: item.id,
                  callerName: nameDisplay,
                  callerNumber: item.phone_number || "+1 (555) 012-3456",
                  openSection: "transcript",
                })
              }
            >
              <MessageSquare size={14} color="#8E9AA0" />
              <Text style={styles.actionBtnText}>Transcript</Text>
            </Pressable>
          )}

          {item.hasAiSummary && (
            <Pressable
              style={styles.actionBtn}
              onPress={() =>
                navigation.navigate("CallAnalysis", {
                  callId: item.id,
                  callerName: nameDisplay,
                  callerNumber: item.phone_number || "+1 (555) 012-3456",
                  openSection: "summary",
                })
              }
            >
              <Sparkles size={14} color="#8E9AA0" />
              <Text style={styles.actionBtnText}>AI Summary</Text>
            </Pressable>
          )}

          {item.hasRecording && (
            <Pressable style={styles.actionBtn} onPress={() => handleDownloadRecording(item.id)}>
              <Download size={14} color="#8E9AA0" />
              <Text style={styles.actionBtnText}>Recording</Text>
            </Pressable>
          )}

          {item.hasCallBack && (
            <Pressable
              style={[styles.callBackBtn, item.isGreenCallBack && styles.greenBtn]}
              onPress={() => handleCallBack(item.phone_number || nameDisplay)}
            >
              <Phone size={14} color="#000" />
              <Text style={styles.callBackBtnText}>Call Back</Text>
            </Pressable>
          )}

          {item.hasCallBackNow && (
            <Pressable
              style={[styles.callBackBtn, styles.redBtn]}
              onPress={() => handleCallBack(nameDisplay)}
            >
              <Phone size={14} color="#FFF" />
              <Text style={[styles.callBackBtnText, { color: "#FFF" }]}>Call Back Now</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={28} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
          <Text style={styles.headerTitle}>Call History</Text>
          <View style={styles.headerSpace} />
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={20} color="#7E8DA5" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name or number"
            placeholderTextColor="#7E8DA5"
            style={styles.searchInput}
          />
          <Mic size={20} color="#7E8DA5" />
        </View>

        {/* List */}
        {isCallsLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#17CBE8" />
          </View>
        ) : (
          <FlatList
            data={filteredCalls}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
            onRefresh={refetch}
            refreshing={isCallsLoading}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No calls yet</Text>
                <Text style={styles.emptySubText}>Your call history will appear here.</Text>
              </View>
            }
          />
        )}
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
  headerTitle: { color: "#FFFFFF", fontSize: responsiveWidth(5.2), fontWeight: "700", textAlign: "center" },
  headerSpace: { width: responsiveWidth(10) },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#13151A",
    borderWidth: 1,
    borderColor: "#242830",
    borderRadius: 14,
    height: responsiveHeight(6.4),
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(3),
    marginBottom: responsiveHeight(2.2),
  },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 16, paddingVertical: 0 },
  listContainer: { paddingBottom: responsiveHeight(15) },
  separator: { height: 1, backgroundColor: "#11141A", marginVertical: responsiveHeight(1.2) },
  loaderWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: responsiveHeight(10) },
  emptyText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySubText: { color: "#687588", fontSize: 14 },
  callRow: {
    paddingVertical: responsiveHeight(1),
  },
  callMainInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: responsiveWidth(12),
    height: responsiveWidth(12),
    borderRadius: responsiveWidth(6),
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
    marginLeft: responsiveWidth(4),
    justifyContent: "center",
  },
  nameHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    maxWidth: responsiveWidth(40),
  },
  countCapsule: {
    backgroundColor: "#1F232E",
    borderWidth: 1,
    borderColor: "#303746",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    color: "#8E9AA0",
    fontSize: 11,
    fontWeight: "700",
  },
  subtextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  incomingCallArrow: {
    color: "#17CBE8",
    fontWeight: "700",
    fontSize: 11,
  },
  outgoingCallArrow: {
    color: "#3ADF87",
    fontWeight: "700",
    fontSize: 11,
  },
  missedCallArrow: {
    color: "#FC6166",
    fontWeight: "700",
    fontSize: 11,
  },
  callTypeLabel: {
    color: "#8E9AA0",
    fontSize: 13,
  },
  timeInfo: {
    alignItems: "flex-end",
  },
  durationText: {
    color: "#8E9AA0",
    fontSize: 14,
    fontWeight: "500",
  },
  timestampText: {
    color: "#687588",
    fontSize: 12,
    marginTop: 4,
  },
  actionButtonsRow: {
    flexDirection: "row",
    marginTop: responsiveHeight(1.5),
    paddingLeft: responsiveWidth(16),
    gap: responsiveWidth(2.5),
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D0F12",
    borderWidth: 1,
    borderColor: "#202530",
    borderRadius: 10,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(1),
    gap: 6,
  },
  actionBtnText: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "600",
  },
  callBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1),
    gap: 6,
  },
  greenBtn: {
    backgroundColor: "#22C55E",
  },
  redBtn: {
    backgroundColor: "#EF4444",
  },
  callBackBtnText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default CallHistoryScreen;
