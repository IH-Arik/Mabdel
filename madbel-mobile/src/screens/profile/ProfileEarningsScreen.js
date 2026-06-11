import { View, Text, Pressable, ScrollView } from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import Navbar from "../../components/Navbar";
import { CalendarDays, ChevronRight, Ticket, Wallet } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

const events = [
  {
    id: "1",
    title: "Summer Music Fest",
    dateTime: "July 15, 2024 • 7:00 PM",
    amount: "$500",
    totalParticipants: 127,
    booked: 98,
    pending: 29,
    revenue: "$12,450",
    sold: 50,
    total: 100,
  },
  {
    id: "2",
    title: "Tech Conference 2024",
    dateTime: "Sep 22, 2024 • 9:00 AM",
    amount: "$750",
    sold: 75,
    total: 150,
  },
];

const ProfileEarningsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-[#f3f4f6]">
      <View
        style={{
          flex: 1,
          paddingHorizontal: responsiveWidth(5),
          paddingTop: responsiveWidth(5),
        }}
      >
        <Navbar title="My Earnings" />

        <ScrollView
          style={{ marginTop: responsiveHeight(3) }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: responsiveHeight(3), paddingBottom: responsiveHeight(2) }}
        >
          <View
            className="rounded-3xl bg-[#c7df57]"
            style={{
              paddingVertical: responsiveHeight(2.2),
              paddingHorizontal: responsiveWidth(6),
            }}
          >
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-[#44502a] text-xl">Total Earnings</Text>
                <Text className="text-black font-bold text-5xl mt-2">$1,250</Text>
                <Text className="text-[#4b5563] mt-3 text-base">
                  Total earnings from your events
                </Text>
              </View>

              <View
                className="items-center justify-center rounded-2xl bg-[#dced8d]"
                style={{ width: responsiveWidth(14), height: responsiveWidth(14) }}
              >
                <Wallet color="#374151" size={20} />
              </View>
            </View>
          </View>

          <View style={{ gap: responsiveHeight(1.6) }}>
            <Text className="text-3xl font-bold text-[#1f2937]">My Events</Text>

            {events.map((eventItem) => (
              <View
                key={eventItem.id}
                className="bg-[#f3f4f6] border border-[#d1d5db] rounded-3xl"
                style={{ padding: responsiveWidth(4) }}
              >
                <View className="flex-row justify-between items-center">
                  <Text className="text-2xl font-semibold text-[#1f2937]">
                    {eventItem.title}
                  </Text>
                  <View className="bg-[#e8efc6] rounded-xl px-4 py-2">
                    <Text className="text-[#444] font-bold text-2xl">
                      {eventItem.amount}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center mt-2">
                  <CalendarDays color="#b3d040" size={16} />
                  <Text className="text-[#6b7280] ml-2 text-lg">{eventItem.dateTime}</Text>
                </View>

                <View
                  className="bg-[#d1d5db]"
                  style={{ height: 1, marginVertical: responsiveHeight(1.5) }}
                />

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ticket color="#b3d040" size={16} />
                    <Text className="text-[#6b7280] ml-2 text-2xl">
                      <Text className="font-bold text-[#1f2937]">{eventItem.sold}</Text>
                      {" "}/{eventItem.total} sold
                    </Text>
                  </View>

                  <Pressable
                    className="flex-row items-center"
                    onPress={() =>
                      navigation.navigate("EventParticipants", { event: eventItem })
                    }
                  >
                    <Text className="text-black text-xl">View Details</Text>
                    <ChevronRight color="#111" size={18} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View
        className="bg-[#eef0e5] border-t border-[#c7df57]"
        style={{ paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(2), paddingBottom: responsiveHeight(3) }}
      >
        <Pressable
          className="bg-[#c7df57] rounded-3xl flex-row items-center justify-center"
          style={{ paddingVertical: responsiveHeight(1.8), gap: responsiveWidth(2) }}
        >
          <Wallet color="#111" size={20} />
          <Text className="text-black font-bold text-3xl">Withdraw Earnings</Text>
        </Pressable>

        <Text className="text-[#6b7280] text-center mt-4 text-base">
          Earnings will be transfered to your bank account{"\n"}within 3-5 business days
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ProfileEarningsScreen;
