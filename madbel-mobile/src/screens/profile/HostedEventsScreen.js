import React, { useMemo } from "react";
import { useAppLanguage } from "../../context/LanguageContext";
import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import Navbar from "../../components/Navbar";
import { useGetAllEventsQuery } from "../../redux/slices/event/eventSlice";

const isHostedByUser = (item, userId) => {
  const { t } = useAppLanguage();

  if (!item || !userId) return false;
  const id = String(userId);
  const candidates = [
    item?.hostUserId,
    item?.hostId,
    item?.organizerId,
    item?.creatorId,
    item?.createdBy,
    item?.userId,
    item?.organizer?._id,
    item?.organizer?.id,
  ].filter(Boolean);
  return candidates.some((value) => String(value) === id);
};

const EventItem = ({ item }) => (
  <View
    className="bg-white border border-gray-200 rounded-xl"
    style={{ padding: responsiveWidth(4), marginBottom: responsiveHeight(1.2) }}
  >
    <Text className="text-black text-base font-semibold">{item?.title || "Untitled Event"}</Text>
    <Text className="text-gray-500 mt-1">{item?.date || "-"} {item?.time || ""}</Text>
    <Text className="text-gray-600 mt-2">{item?.location || "No location provided"}</Text>
  </View>
);

const HostedEventsScreen = () => {
  const authUser = useSelector((state) => state?.auth?.user);
  const userId = authUser?._id || authUser?.id || authUser?.userId;

  const { data, isFetching } = useGetAllEventsQuery({ page: 1, limit: 100 });

  const events = data?.events || [];
  const hostedEvents = useMemo(
    () => events.filter((item) => isHostedByUser(item, userId)),
    [events, userId],
  );

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ padding: responsiveWidth(5) }}>
      <Navbar title={t("hosted_events")} />
      <FlatList
        contentContainerStyle={{ paddingTop: responsiveHeight(2), paddingBottom: responsiveHeight(2) }}
        data={hostedEvents}
        keyExtractor={(item, index) => String(item?._id || item?.id || index)}
        renderItem={({ item }) => <EventItem item={item} />}
        ListEmptyComponent={
          <Text className="text-center text-gray-500 mt-8">
            {isFetching ? "Loading events..." : "No hosted events found."}
          </Text>
        }
      />
    </SafeAreaView>
  );
};

export default HostedEventsScreen;

