import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import {
  Pressable,

  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  List,
  MapPin,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  useMadbelDeleteCalendarEventMutation,
  useMadbelGetCalendarEventQuery,
  useMadbelShareCalendarEventMutation,
} from "../../redux/slices/madbelApiSlice";
import { API_BASE_URL } from "../../redux/apiUtils";
import { SafeAreaView } from "react-native-safe-area-context";

const DetailRow = ({ icon: Icon, title, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Icon size={26} color="#12CFEA" />
    </View>
    <View style={styles.detailContent}>
      <Text style={styles.detailTitle}>{title}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const MeetingDetailsScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const eventId =
    route?.params?.event?.id ||
    route?.params?.event?._id ||
    route?.params?.event_id ||
    null;
  const { data: eventResponse, isLoading } = useMadbelGetCalendarEventQuery(
    { event_id: eventId },
    { skip: !eventId },
  );
  const [shareCalendarEvent, { isLoading: sharingEvent }] =
    useMadbelShareCalendarEventMutation();
  const [deleteCalendarEvent, { isLoading: deletingEvent }] =
    useMadbelDeleteCalendarEventMutation();
  const [resolvingShare, setResolvingShare] = React.useState(false);
  const [cachedShareUrl, setCachedShareUrl] = React.useState(null);

  const event = eventResponse?.data || route?.params?.event || null;

  const dateTimeLabel = React.useMemo(() => {
    if (!event?.starts_at || !event?.ends_at) return "-";
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
    const datePart = start.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    const startPart = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endPart = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${datePart} • ${startPart} - ${endPart}`;
  }, [event?.starts_at, event?.ends_at]);

  const normalizeShareUrl = (rawUrl) => {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) {
      try {
        const parsed = new URL(rawUrl);
        return `${API_BASE_URL}${parsed.pathname}${parsed.search || ""}`;
      } catch {
        return rawUrl;
      }
    }
    return `${API_BASE_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  };

  const ensureShareUrl = async () => {
    if (cachedShareUrl) return cachedShareUrl;
    if (event?.share_url) {
      const normalized = normalizeShareUrl(event.share_url);
      setCachedShareUrl(normalized);
      return normalized;
    }
    if (!eventId) return null;

    const response = await shareCalendarEvent({
      event_id: eventId,
      channel: "link",
    }).unwrap();
    const rawUrl = response?.data?.share_url || response?.share_url || null;
    const normalized = normalizeShareUrl(rawUrl);
    if (normalized) setCachedShareUrl(normalized);
    return normalized;
  };

  const handleShare = async () => {
    try {
      setResolvingShare(true);
      const shareUrl = await ensureShareUrl();
      if (!shareUrl) {
        Alert.alert(t("share_unavailable"), t("could_not_generate_a_share_link"));
        return;
      }

      const lines = [
        `Meeting: ${event?.title || "Meeting"}`,
        `Date & Time: ${dateTimeLabel}`,
        event?.meeting_mode === "online"
          ? `Meeting Link: ${event?.meeting_link || "Online meeting"}`
          : `Location: ${event?.location || "Not provided"}`,
        event?.description ? `Description: ${event.description}` : null,
        `View Invite: ${shareUrl}`,
      ].filter(Boolean);

      await Share.share({
        message: lines.join("\n"),
        url: shareUrl,
        title: event?.title || "Meeting Invite",
      });
    } catch (error) {
      Alert.alert("Share failed", error?.data?.message || "Could not share this meeting.");
    } finally {
      setResolvingShare(false);
    }
  };

  const handleDelete = () => {
    if (!eventId) return;
    Alert.alert(
      t("delete_meeting"),
      t("are_you_sure_you_want_to_delete_this_meeting"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCalendarEvent({ event_id: eventId }).unwrap();
              navigation.navigate("ScheduleMeeting");
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error?.data?.message || "Could not delete this meeting.",
              );
            }
          },
        },
      ],
    );
  };

  const handleEdit = () => {
    navigation.navigate("CreateMeetingSchedule", { prefill: event, event_id: eventId });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color="#F2F8FF" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("meeting_details")}</Text>
          <View style={styles.backBtn} />
        </View>

        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#12CFEA" />
          </View>
        ) : (
          <>
        <Text style={styles.meetingTitle}>{event?.title || "Meeting"}</Text>

        <DetailRow
          icon={CalendarDays}
          title={t("date_time")}
          value={dateTimeLabel}
        />
        <DetailRow
          icon={MapPin}
          title={event?.meeting_mode === "online" ? "Meeting Link" : "Location"}
          value={
            event?.meeting_mode === "online"
              ? event?.meeting_link || "Online"
              : event?.location || "Not provided"
          }
        />
        <DetailRow
          icon={List}
          title={t("description")}
          value={event?.description || "No description provided."}
        />

        <View style={styles.divider} />

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, styles.actionBtnBlue]} onPress={handleEdit}>
            <Pencil size={30} color="#12CFEA" />
            <Text style={[styles.actionText, styles.actionTextBlue]}>{t("edit")}</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={handleShare}
            disabled={sharingEvent || resolvingShare}
          >
            <Share2 size={30} color="#EAF5FF" />
            <Text style={styles.actionText}>
              {sharingEvent || resolvingShare ? "Sharing..." : "Share"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deletingEvent}
          >
            <Trash2 size={32} color="#FF4F5F" />
          </Pressable>
        </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    flex: 1,
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(6),
    paddingTop: responsiveHeight(1),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2),
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#F2F8FF", fontSize: 33 / 1.6, fontWeight: "700" },
  meetingTitle: {
    color: "#F4F9FF",
    fontSize: 62 / 1.6,
    lineHeight: 70 / 1.6,
    fontWeight: "700",
    marginBottom: responsiveHeight(2.5),
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: responsiveHeight(2) },
  detailIcon: {
    width: 84 / 1.2,
    height: 84 / 1.2,
    borderRadius: 20,
    backgroundColor: "#0E3542",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  detailContent: { flex: 1 },
  detailTitle: { color: "#F2F9FF", fontSize: 29 / 1.6, fontWeight: "700", marginBottom: 4 },
  detailValue: { color: "#95A4B9", fontSize: 27 / 1.6, lineHeight: 45 / 1.6 },
  divider: { borderTopWidth: 1, borderTopColor: "#1D2A37", marginTop: 10, marginBottom: 22 },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  actionBtn: {
    flex: 1,
    height: 84 / 1.2,
    borderRadius: 22,
    backgroundColor: "#171C22",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  actionBtnBlue: {
    backgroundColor: "#072A35",
    borderWidth: 1,
    borderColor: "#0E5D70",
  },
  actionText: { color: "#F2F8FF", fontSize: 32 / 1.6, fontWeight: "700" },
  actionTextBlue: { color: "#12CFEA" },
  deleteBtn: {
    width: 84 / 1.2,
    height: 84 / 1.2,
    borderRadius: 22,
    backgroundColor: "#2A1115",
    borderWidth: 1,
    borderColor: "#5E222A",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MeetingDetailsScreen;
