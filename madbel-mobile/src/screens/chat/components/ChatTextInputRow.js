import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { formatDuration } from "../chatHelpers";

const ChatTextInputRow = ({
  recorderState,
  recordingElapsedMs,
  message,
  onChangeText,
  threadId,
  inputDisabled,
  onSendPress,
  isSending,
  t,
}) => (
  <>
    {/* Input + mic */}
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        backgroundColor: "#1A2435",
        borderRadius: 24,
        minHeight: 58,
        paddingHorizontal: responsiveWidth(4),
        paddingVertical: responsiveHeight(0.7),
        borderWidth: 1,
        borderColor: recorderState?.isRecording ? "#EF4444" : "#232A34",
        gap: 8,
      }}
    >
      {recorderState?.isRecording ? (
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#EF4444",
            }}
          />
          <Text
            style={{
              color: "#E8EFF7",
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {t("recording")} {formatDuration(recordingElapsedMs)}
          </Text>
        </View>
      ) : (
        <TextInput
          style={{
            flex: 1,
            color: "#E8EFF7",
            fontSize: 15,
            minHeight: 40,
            maxHeight: 40,
            paddingVertical: 0,
            paddingTop: 0,
            paddingBottom: 0,
            textAlignVertical: "center",
          }}
          placeholder={threadId ? t("type_message") : t("chat_unavailable")}
          placeholderTextColor="#4A5568"
          value={message}
          onChangeText={onChangeText}
          multiline={false}
          maxLength={500}
          editable={!inputDisabled}
        />
      )}
    </View>

    {/* Send button (typed text) */}
    <Pressable
      onPress={onSendPress}
      disabled={!message.trim() || inputDisabled}
      style={{
        backgroundColor: message.trim() && !inputDisabled ? "#17CBE8" : "#1A2435",
        borderRadius: 24,
        paddingHorizontal: responsiveWidth(5),
        paddingVertical: responsiveHeight(1.3),
        borderWidth: 1,
        borderColor: message.trim() && !inputDisabled ? "#17CBE8" : "#232A34",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isSending ? (
        <ActivityIndicator size="small" color="#020406" />
      ) : (
        <Text
          style={{
            color: message.trim() && !inputDisabled ? "#020406" : "#5D6A7A",
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          {t("send")}
        </Text>
      )}
    </Pressable>
  </>
);

export default ChatTextInputRow;
