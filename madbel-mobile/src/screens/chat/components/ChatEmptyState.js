import React from "react";
import { View, Text, Image } from "react-native";

const ChatEmptyState = ({ currentConversation, isThreadError, t }) => (
  <View
    style={{
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    }}
  >
    {currentConversation.avatar ? (
      <Image
        source={{ uri: currentConversation.avatar }}
        style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
      />
    ) : null}
    <Text
      style={{
        fontSize: 18,
        fontWeight: "600",
        color: "#F8FAFC",
        marginBottom: 4,
      }}
    >
      {currentConversation.name}
    </Text>
    <Text style={{ color: "#5D6A7A", fontSize: 15, textAlign: "center" }}>
      {isThreadError ? t("failed_to_load_messages") : t("no_messages_yet")}
    </Text>
    <Text
      style={{
        color: "#3D4A58",
        fontSize: 14,
        textAlign: "center",
        marginTop: 4,
      }}
    >
      {t("send_message_to_start")}
    </Text>
  </View>
);

export default ChatEmptyState;
