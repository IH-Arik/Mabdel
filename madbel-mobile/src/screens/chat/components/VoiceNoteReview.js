import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Play, Pause, Trash2, Send } from "lucide-react-native";
import { responsiveWidth } from "react-native-responsive-dimensions";
import { formatDuration } from "../chatHelpers";

// --- Review recorded voice note: discard / play / send ---
const VoiceNoteReview = ({
  onDiscard,
  isSendingVoiceMessage,
  onTogglePreviewPlayback,
  previewPlayerStatus,
  previewProgressPercent,
  previewTimeLabelMs,
  onSend,
}) => (
  <View
    style={{
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: responsiveWidth(2),
    }}
  >
    <Pressable onPress={onDiscard} disabled={isSendingVoiceMessage} style={{ padding: 8 }}>
      <Trash2 size={20} color="#EF4444" />
    </Pressable>

    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1A2435",
        borderRadius: 24,
        minHeight: 58,
        paddingHorizontal: responsiveWidth(4),
        borderWidth: 1,
        borderColor: "#232A34",
        gap: 10,
      }}
    >
      <Pressable onPress={onTogglePreviewPlayback} disabled={isSendingVoiceMessage}>
        {previewPlayerStatus?.playing ? (
          <Pause size={20} color="#17CBE8" />
        ) : (
          <Play size={20} color="#17CBE8" />
        )}
      </Pressable>

      <View
        style={{
          flex: 1,
          height: 3,
          borderRadius: 2,
          backgroundColor: "#2E3545",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${previewProgressPercent}%`,
            backgroundColor: "#17CBE8",
          }}
        />
      </View>

      <Text style={{ color: "#8A9AB0", fontSize: 12, fontWeight: "600" }}>
        {formatDuration(previewTimeLabelMs)}
      </Text>
    </View>

    <Pressable
      onPress={onSend}
      disabled={isSendingVoiceMessage}
      style={{
        backgroundColor: "#17CBE8",
        borderRadius: 24,
        width: 52,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isSendingVoiceMessage ? (
        <ActivityIndicator size="small" color="#020406" />
      ) : (
        <Send size={18} color="#020406" />
      )}
    </Pressable>
  </View>
);

export default VoiceNoteReview;
