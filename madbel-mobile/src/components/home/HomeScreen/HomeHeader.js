import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { Bell, ChevronDown } from "lucide-react-native";

const rw = (value) => responsiveWidth(value);
const rh = (value) => responsiveHeight(value);

const HomeHeader = ({ greeting = "Good Morning, Raihan", onLanguagePress, onNotificationPress }) => (
  <View style={styles.header}>
    <Text style={styles.greeting}>{greeting}</Text>
    <View style={styles.headerRight}>
      <Pressable style={styles.langPill} onPress={onLanguagePress}>
        <Text style={styles.langText}>EN</Text>
        <ChevronDown size={14} color="#D8E4F3" />
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={onNotificationPress}>
        <Bell size={23} color="#F4F9FF" strokeWidth={2.1} />
      </Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rh(0.4),
  },
  greeting: {
    color: "#F3F8FF",
    fontSize: rw(6),
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.2),
  },
  langPill: {
    height: rh(4.6),
    borderRadius: rh(2.3),
    borderWidth: 1,
    borderColor: "#2B3645",
    backgroundColor: "#0D131D",
    paddingHorizontal: rw(3),
    flexDirection: "row",
    alignItems: "center",
    gap: rw(1.4),
  },
  langText: {
    color: "#D8E4F3",
    fontSize: rw(3.2),
    fontWeight: "600",
  },
  iconBtn: {
    width: rh(4.6),
    height: rh(4.6),
    borderRadius: rh(2.3),
    alignItems: "center",
    justifyContent: "center",
  },
});

export default HomeHeader;
