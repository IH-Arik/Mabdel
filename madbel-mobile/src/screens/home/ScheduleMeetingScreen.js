import React, { useMemo, useState } from "react";
import {
  Pressable,

  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import { Calendar, Timeline } from "react-native-calendars";
import { ChevronLeft, Plus, Video } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { useMadbelListCalendarEventsQuery } from "../../redux/slices/madbelApiSlice";
import { SafeAreaView } from "react-native-safe-area-context";

const INITIAL_DATE = new Date().toISOString().slice(0, 10);

const ScheduleMeetingScreen = () => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(INITIAL_DATE);
  const { data: calendarResponse, isLoading, isFetching } =
    useMadbelListCalendarEventsQuery({
      page: 1,
      page_size: 100,
      date_from: selectedDate,
      date_to: selectedDate,
    });

    console.log('LINE AT 33' , calendarResponse);
    

  const apiEvents = calendarResponse?.data?.items || [];
  const allEventsByDate = useMemo(() => {
    const grouped = {};
    apiEvents.forEach((event) => {
      const dateKey = String(event?.starts_at || "").slice(0, 10);
      if (!dateKey) return;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    return grouped;
  }, [apiEvents]);

  const selectedEvents = useMemo(
    () =>
      (allEventsByDate[selectedDate] || []).map((event) => ({
        id: event.id,
        title: event.title,
        start: event.starts_at,
        end: event.ends_at,
        summary: `${new Date(event.starts_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${new Date(event.ends_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        raw: event,
      })),
    [allEventsByDate, selectedDate],
  );

  const markedDates = useMemo(() => {
    const marks = {};
    Object.keys(allEventsByDate).forEach((date) => {
      marks[date] = {
        marked: true,
        dotColor: "#14CFEA",
      };
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: "#16CDE9",
      selectedTextColor: "#F2FBFF",
    };

    return marks;
  }, [allEventsByDate, selectedDate]);

  const handleEventPress = (event) => {
    navigation.navigate("MeetingDetails", {
      event: event?.raw || event,
    });
  };

  const renderTimelineEvent = (event) => {
    const eventData = event?.raw || {};
    const showJoinCall = eventData?.meeting_mode === "online";
    const attendees = eventData?.attendees || [];

    return (
      <Pressable style={styles.eventCard} onPress={() => handleEventPress(event)}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventTime}>{event.summary}</Text>
        {showJoinCall ? (
          <View style={styles.joinBtn}>
            <Video size={15} color="#11CDE9" />
            <Text style={styles.joinText}>Join Call</Text>
          </View>
        ) : (
          <View style={styles.attendeeRow}>
            {attendees.length ? (
              attendees.slice(0, 3).map((attendee, index) => (
                <View
                  key={attendee.id || `${attendee.name}-${index}`}
                  style={[styles.avatarCircle, index > 0 ? styles.avatarOverlap : null]}
                >
                  {attendee.avatar_url ? (
                    <Image source={{ uri: attendee.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{attendee.initials || "NA"}</Text>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>NA</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeft size={30} color="#11CDE8" />
          </Pressable>
          <Text style={styles.title}>Create Meeting Schedule</Text>
        </View>
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          hideExtraDays={false}
          enableSwipeMonths
          style={styles.calendar}
          theme={{
            backgroundColor: "#020406",
            calendarBackground: "#020406",
            monthTextColor: "#F3F9FF",
            dayTextColor: "#F1F6FF",
            textDisabledColor: "#515C6B",
            arrowColor: "#13CFEA",
            todayTextColor: "#13CFEA",
            selectedDayBackgroundColor: "#16CDE9",
            textMonthFontSize: 21,
            textMonthFontWeight: "700",
            textDayFontSize: 16,
            textSectionTitleColor: "#617185",
          }}
        />

        <View style={styles.timelineWrap}>
          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#12CFEA" />
            </View>
          ) : (
          <Timeline
            date={selectedDate}
            events={selectedEvents}
            start={0}
            end={24}
            initialTime={{ hour: 0, minutes: 0 }}
            scrollToFirst
            showNowIndicator
            onEventPress={handleEventPress}
            renderEvent={renderTimelineEvent}
            format24h={false}
            timelineLeftInset={62}
            theme={{
              calendarBackground: "#020406",
              timelineContainer: { backgroundColor: "#020406" },
              contentStyle: { backgroundColor: "#020406" },
              timeLabel: { color: "#6E7D92" },
              line: { backgroundColor: "#1B2836", height: 1 },
              verticalLine: { backgroundColor: "#1B2836" },
              nowIndicatorLine: { backgroundColor: "#12CFEA" },
              nowIndicatorKnob: { backgroundColor: "#12CFEA" },
            }}
          />
          )}
          {selectedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No meetings scheduled for this date
              </Text>
            </View>
          ) : null}
          {isFetching && !isLoading ? (
            <Text style={styles.refreshText}>Refreshing schedule...</Text>
          ) : null}
        </View>
      </View>

      <Pressable
        style={styles.fab}
        onPress={() =>
          navigation.navigate("CreateMeetingSchedule", { selectedDate })
        }
      >
        <Plus size={44} color="#EAFDFF" />
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  content: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.5),
    paddingTop: responsiveHeight(0.8),
  },
  title: {
    color: "#F3F9FF",
    fontSize: 22,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
    header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  calendar: {
    borderBottomWidth: 1,
    borderBottomColor: "#1A2633",
    paddingBottom: 10,
    marginBottom: 8,
  },
  timelineWrap: {
    flex: 1,
    paddingBottom: responsiveHeight(12),
  },
  eventCard: {
    borderRadius: 18,
    backgroundColor: "#1F1F24",
    borderLeftWidth: 5,
    borderLeftColor: "#13CFEA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 94,
  },
  eventTitle: { color: "#F5F9FF", fontSize: 14, fontWeight: "700" },
  eventTime: { color: "#99A7BC", fontSize: 12, marginTop: 5, marginBottom: 8 },
  attendeeRow: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#20414A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#D6EEF4", fontSize: 11 },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  avatarOverlap: { marginLeft: -6, backgroundColor: "#3D4552" },
  joinBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#1F6776",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "#0E2731",
  },
  joinText: { color: "#11CDE9", fontSize: 11, fontWeight: "600" },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: { color: "#7B899E", fontSize: 14 },
  refreshText: {
    textAlign: "center",
    color: "#7B899E",
    fontSize: 12,
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    right: responsiveWidth(7),
    bottom: responsiveHeight(12),
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#16CDE9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16CDE9",
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});

export default ScheduleMeetingScreen;
