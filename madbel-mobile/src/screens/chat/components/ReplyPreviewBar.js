import React from "react";
import { View, Text, Pressable } from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

const ReplyPreviewBar = ({ replyToMessage, currentConversation, onDismiss, t }) => {
  if (!replyToMessage) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1A2435",
        borderRadius: 12,
        paddingHorizontal: responsiveWidth(3),
        paddingVertical: responsiveHeight(0.8),
        marginBottom: responsiveHeight(0.8),
        borderLeftWidth: 3,
        borderLeftColor: "#17CBE8",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#17CBE8",
            fontSize: 12,
            fontWeight: "700",
            marginBottom: 2,
          }}
        >
          {t("replying_to")}{" "}
          {replyToMessage.sender === "me" ? t("yourself") : currentConversation.name}
        </Text>
        <Text style={{ color: "#8A9AB0", fontSize: 13 }} numberOfLines={1}>
          {replyToMessage.text}
        </Text>
      </View>
      <Pressable onPress={onDismiss} style={{ paddingLeft: 8, paddingVertical: 4 }}>
        <Text style={{ color: "#5D6A7A", fontSize: 20, lineHeight: 20 }}>✕</Text>
      </Pressable>
    </View>
  );
};

export default ReplyPreviewBar;
