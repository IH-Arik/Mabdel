import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { Mic } from "lucide-react-native";

const rw = (value) => responsiveWidth(value);
const rh = (value) => responsiveHeight(value);

const VoicePromptCard = ({ text = "Tap to ask SmartFlow...", onPress }) => (
  <Pressable style={styles.searchCard} onPress={onPress}>
    <Mic size={rw(6)} color="#11D1ED" />
    <Text style={styles.searchPlaceholder}>{text}</Text>
    <Text style={styles.dots}>•••</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  searchCard: {
    minHeight: rh(8.2),
    borderRadius: rw(5.2),
    backgroundColor: "#131A24",
    borderWidth: 1,
    borderColor: "#243041",
    paddingHorizontal: rw(4),
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.6),
  },
  searchPlaceholder: {
    flex: 1,
    color: "#6E8199",
    fontSize: rw(5),
  },
  dots: {
    color: "#12D2ED",
    fontSize: rw(6),
    fontWeight: "700",
  },
});

export default VoicePromptCard;
