import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";

const MOCK_HISTORY = [
  { id: "1", text: "Schedule team sync tomorrow at 10 AM", time: "Today 10:45 AM" },
  { id: "2", text: "Create follow up message for client reminders", time: "Yesterday 6:12 PM" },
  { id: "3", text: "Read out weekly performance summary", time: "Yesterday 9:03 AM" },
];

const ProfileVoiceHistoryScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>AI Voice History</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {MOCK_HISTORY.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.text}>{item.text}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          ))}
        </ScrollView>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.4),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 50 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  list: {
    gap: responsiveHeight(1.4),
    paddingBottom: responsiveHeight(2.5),
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#212530",
    backgroundColor: "#1B1C21",
    paddingHorizontal: responsiveWidth(4.4),
    paddingVertical: responsiveHeight(1.6),
  },
  text: {
    color: "#F2F4F7",
    fontSize: 44 / 2,
    lineHeight: 32,
  },
  time: {
    marginTop: responsiveHeight(1),
    color: "#9AA6B3",
    fontSize: 34 / 2,
  },
});

export default ProfileVoiceHistoryScreen;
