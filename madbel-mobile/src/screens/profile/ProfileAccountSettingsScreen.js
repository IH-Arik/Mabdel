import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";

const ACCOUNT_ITEMS = [
  { label: "Change Password", path: "ProfileChangePassword" },
  { label: "Terms & Condition", path: "ProfileTerms" },
  { label: "Privacy Policy", path: "ProfilePrivacy" },
  { label: "About Us", path: "ProfileAbout" },
];

const ProfileAccountSettingsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>Account Settings</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.card}>
          {ACCOUNT_ITEMS.map((item, index) => (
            <Pressable
              key={item.path}
              onPress={() => navigation.navigate(item.path)}
              style={[styles.row, index < ACCOUNT_ITEMS.length - 1 ? styles.rowBorder : null]}
            >
              <Text style={styles.rowText}>{item.label}</Text>
              <ChevronRight size={30} color="#90A2B7" strokeWidth={2.1} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(3),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 40 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1B1C21",
    borderWidth: 1,
    borderColor: "#212530",
  },
  row: {
    minHeight: 58,
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#292D37",
  },
  rowText: {
    color: "#F2F4F7",
    fontSize: 32 / 2,
    fontWeight: "400",
  },
  deleteBtn: {
    marginTop: "auto",
    marginBottom: 10,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#212530",
    backgroundColor: "#1B1C21",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#FC4C58",
    fontSize: 30 / 2,
    fontWeight: "600",
  },
});

export default ProfileAccountSettingsScreen;
