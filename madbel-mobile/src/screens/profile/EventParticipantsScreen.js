import { View, Text, ScrollView, Image, Pressable } from "react-native";
import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import Navbar from "../../components/Navbar";

const participants = [
  {
    id: "1",
    name: "Emma Davis",
    email: "emma.davis@email.com",
    time: "Dec 13, 9:20 AM",
    status: "Paid",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300",
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "m.chen@email.com",
    time: "Dec 14, 11:45 AM",
    status: "Paid",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300",
  },
  {
    id: "3",
    name: "David Rodriguez",
    email: "d.rodriguez@email.com",
    time: "Dec 12, 4:15 PM",
    status: "Paid",
    image: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=300",
  },
  {
    id: "4",
    name: "Lisa Thompson",
    email: "lisa.t@email.com",
    time: "Dec 12, 1:30 PM",
    status: "Paid",
    image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300",
  },
  {
    id: "5",
    name: "James Wilson",
    email: "james.w@email.com",
    time: "Dec 11, 8:45 AM",
    status: "Paid",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300",
  },
];

const EventParticipantsScreen = ({ route }) => {
  const { t } = useAppLanguage();
  const event = route?.params?.event || {
    title: "Summer Music Festival",
    dateTime: "July 15, 2024 • 7:00 PM",
    totalParticipants: 127,
    booked: 98,
    pending: 29,
    revenue: "$12,450",
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f3f4f6]">
      <View
        style={{
          flex: 1,
          paddingHorizontal: responsiveWidth(5),
          paddingTop: responsiveWidth(5),
        }}
      >
        <Navbar title={t("event_participants")} />

        <ScrollView
          style={{ marginTop: responsiveHeight(3) }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: responsiveHeight(2), paddingBottom: responsiveHeight(2) }}
        >
          <View
            className="border border-[#d1d5db] rounded-2xl bg-[#f3f4f6]"
            style={{ padding: responsiveWidth(4) }}
          >
            <View className="flex-row justify-between">
              <View style={{ width: "65%" }}>
                <Text className="text-4xl font-bold text-[#1f2937]">{event.title}</Text>
                <Text className="text-[#6b7280] mt-2 text-xl">{event.dateTime}</Text>
              </View>
              <View className="items-end">
                <Text className="text-5xl font-bold text-[#1f2937]">{event.totalParticipants}</Text>
                <Text className="text-[#6b7280] text-center text-xl">
                  Total{"\n"}Participants
                </Text>
              </View>
            </View>

            <View
              className="bg-[#d1d5db]"
              style={{ height: 1, marginVertical: responsiveHeight(1.5) }}
            />

            <View className="flex-row justify-between">
              <View className="items-center" style={{ width: "30%" }}>
                <Text className="text-[#22c55e] font-bold text-4xl">{event.booked}</Text>
                <Text className="text-[#6b7280] text-xl">{t("booked")}</Text>
              </View>
              <View className="items-center" style={{ width: "30%" }}>
                <Text className="text-[#f97316] font-bold text-4xl">{event.pending}</Text>
                <Text className="text-[#6b7280] text-xl">{t("pending")}</Text>
              </View>
              <View className="items-center" style={{ width: "30%" }}>
                <Text className="text-[#2563eb] font-bold text-4xl">{event.revenue}</Text>
                <Text className="text-[#6b7280] text-xl">{t("revenue")}</Text>
              </View>
            </View>
          </View>

          {participants.map((participant) => (
            <Pressable
              key={participant.id}
              className="border border-[#d1d5db] rounded-2xl bg-[#f3f4f6] flex-row justify-between items-center"
              style={{ padding: responsiveWidth(4) }}
            >
              <View className="flex-row items-center" style={{ width: "62%" }}>
                <Image
                  source={{ uri: participant.image }}
                  style={{
                    width: responsiveWidth(12),
                    height: responsiveWidth(12),
                    borderRadius: responsiveWidth(6),
                  }}
                />
                <View className="ml-3">
                  <Text className="text-2xl font-semibold text-[#1f2937]">{participant.name}</Text>
                  <Text className="text-[#6b7280] text-lg mt-1">{participant.email}</Text>
                </View>
              </View>

              <View className="items-end">
                <View className="bg-[#d8f0da] rounded-full px-3 py-1">
                  <Text className="text-[#2f855a] text-lg">{participant.status}</Text>
                </View>
                <Text className="text-[#6b7280] text-lg mt-2">{participant.time}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default EventParticipantsScreen;
