import React from "react";
import { View, Text, Pressable } from "react-native";
import { ChevronLeft, Ellipsis } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";

const ChatHeader = ({
  onLayout,
  onBackPress,
  headerName,
  peerIsOnline,
  peerIsTyping,
  isGroupChat,
  onGroupSettingPress,
  t,
}) => (
  <View
    onLayout={onLayout}
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: responsiveWidth(2),
      paddingVertical: responsiveHeight(1),
      borderBottomWidth: 1,
      borderBottomColor: "#141820",
    }}
  >
    <Pressable onPress={onBackPress} style={{ padding: 8 }}>
      <ChevronLeft size={26} color="#F8FAFC" />
    </Pressable>

    <View style={{ alignItems: "center", flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 17, color: "#F8FAFC", fontWeight: "700" }}>
          {headerName}
        </Text>
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: peerIsOnline ? "#22C55E" : "#5D6A7A",
          }}
        />
      </View>
      <Text
        style={{
          fontSize: 13,
          color: peerIsTyping
            ? "#17CBE8"
            : peerIsOnline
              ? "#22C55E"
              : "#5D6A7A",
          fontWeight: "600",
          marginTop: 1,
        }}
      >
        {peerIsTyping
          ? t("typing")
          : peerIsOnline
            ? t("online")
            : t("offline")}
      </Text>
    </View>

    {isGroupChat ? (
      <Pressable style={{ padding: 8 }} onPress={onGroupSettingPress}>
        <Ellipsis color="#F8FAFC" />
      </Pressable>
    ) : (
      <View style={{ width: 42 }} />
    )}
  </View>
);

export default ChatHeader;
