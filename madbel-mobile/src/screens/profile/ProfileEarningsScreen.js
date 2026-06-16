import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import React, { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import Navbar from "../../components/Navbar";
import { CalendarDays, ChevronRight, Ticket, Wallet } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useGetAllEventsQuery } from "../../redux/slices/event/eventSlice";

const isHostedByUser = (item, userId) => {
  if (!item || !userId) return false;
  const id = String(userId);
  return [
    item?.hostUserId, item?.hostId, item?.organizerId,
    item?.creatorId, item?.createdBy, item?.userId,
    item?.organizer?._id, item?.organizer?.id,
  ].filter(Boolean).some((v) => String(v) === id);
};

const formatDate = (val) => {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "-";
  }
};

const ProfileEarningsScreen = () => {
  const navigation = useNavigation();
  const authUser = useSelector((state) => state?.auth?.user);
  const userId = authUser?._id || authUser?.id || authUser?.userId;

  const { data, isLoading } = useGetAllEventsQuery({ page: 1, limit: 100 });
  const allEvents = data?.events || data?.data || data?.items || [];

  const hostedEvents = useMemo(
    () => allEvents.filter((e) => isHostedByUser(e, userId)),
    [allEvents, userId],
  );

  const totalEarnings = useMemo(
    () =>
      hostedEvents.reduce((sum, e) => {
        const price = Number(e?.ticketPrice || e?.price || e?.ticket_price || 0);
        const sold = Number(e?.soldTickets || e?.sold_tickets || e?.participants?.length || 0);
        return sum + price * sold;
      }, 0),
    [hostedEvents],
  );

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

        {isLoading ? (
          <ActivityIndicator color="#c7df57" style={{ marginTop: responsiveHeight(10) }} />
        ) : (
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
                  <Text className="text-black font-bold text-5xl mt-2">
                    ${totalEarnings.toLocaleString()}
                  </Text>
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

              {hostedEvents.length === 0 ? (
                <Text className="text-gray-500 text-center mt-4">No hosted events found.</Text>
              ) : (
                hostedEvents.map((eventItem) => {
                  const price = Number(eventItem?.ticketPrice || eventItem?.price || eventItem?.ticket_price || 0);
                  const sold = Number(eventItem?.soldTickets || eventItem?.sold_tickets || eventItem?.participants?.length || 0);
                  const total = Number(eventItem?.maxParticipants || eventItem?.max_participants || eventItem?.capacity || 0);
                  const id = eventItem?._id || eventItem?.id;
                  return (
                    <View
                      key={id}
                      className="bg-[#f3f4f6] border border-[#d1d5db] rounded-3xl"
                      style={{ padding: responsiveWidth(4) }}
                    >
                      <View className="flex-row justify-between items-center">
                        <Text className="text-2xl font-semibold text-[#1f2937]" numberOfLines={1} style={{ flex: 1 }}>
                          {eventItem?.title || "Untitled Event"}
                        </Text>
                        {price > 0 && (
                          <View className="bg-[#e8efc6] rounded-xl px-4 py-2 ml-2">
                            <Text className="text-[#444] font-bold text-2xl">${price}</Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center mt-2">
                        <CalendarDays color="#b3d040" size={16} />
                        <Text className="text-[#6b7280] ml-2 text-lg">
                          {formatDate(eventItem?.date || eventItem?.startDate || eventItem?.start_date)}
                        </Text>
                      </View>

                      <View
                        className="bg-[#d1d5db]"
                        style={{ height: 1, marginVertical: responsiveHeight(1.5) }}
                      />

                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Ticket color="#b3d040" size={16} />
                          <Text className="text-[#6b7280] ml-2 text-2xl">
                            <Text className="font-bold text-[#1f2937]">{sold}</Text>
                            {total > 0 ? ` /${total} sold` : " sold"}
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
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <View
        className="bg-[#eef0e5] border-t border-[#c7df57]"
        style={{ paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(2), paddingBottom: responsiveHeight(3) }}
      >
        <Pressable
          className="bg-[#c7df57] rounded-3xl flex-row items-center justify-center"
          style={{ paddingVertical: responsiveHeight(1.8), gap: responsiveWidth(2) }}
          onPress={() => {}}
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
