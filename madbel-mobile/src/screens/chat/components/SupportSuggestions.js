import React from "react";
import { View, Text, Pressable } from "react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ADMIN_SUPPORT_SUGGESTIONS } from "../chatHelpers";

const SupportSuggestions = ({ visible, onSelect, t }) => {
  if (!visible) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: responsiveWidth(2),
        marginBottom: responsiveHeight(1.1),
      }}
    >
      {ADMIN_SUPPORT_SUGGESTIONS.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          style={{
            flex: 1,
            minHeight: responsiveHeight(4.8),
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#2E3545",
            backgroundColor: "#111826",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: responsiveWidth(1.5),
          }}
        >
          <Text
            style={{
              color: "#D5DEE9",
              fontSize: 13,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {t(item)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default SupportSuggestions;
