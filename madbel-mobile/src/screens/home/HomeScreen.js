
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  Bot,
  CalendarCheck2,
  FileText,
  Megaphone,
  Mic,
  PhoneCall,
  PhoneMissed,
  Plus,
  ReceiptText,
  Users,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { LinearGradient } from "expo-linear-gradient";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";
import { useFetchConversationsQuery } from "../../redux/slices/chat/chatSlice";
import {
  HOME_AVATARS,
  HOME_DOC_ITEMS,
} from "../../../assets/data/homeMockData";
import {
  ActionButton,
  AnalyticsCallRow,
  AvatarStack,
  DashboardCard,
  DocumentTile,
  HomeHeader,
} from "../../components/home/HomeScreen";
import { useAppLanguage } from "../../context/LanguageContext";
import {
  useMadbelListContactsQuery,
  useMadbelGetCallSummaryQuery,
} from "../../redux/slices/madbelApiSlice";
import {
  useMadbelListCallsQuery,
  useMadbelGetIntegrationStatusQuery,
} from "../../redux/slices/madbelSmartflowSlice";

const rw = (value) => responsiveWidth(value);
const rh = (value) => responsiveHeight(value);

const DOC_ICON_MAP = {
  file: FileText,
  receipt: ReceiptText,
  bot: Bot,
  plus: Plus,
};

const CALL_ICON_MAP = {
  phoneCall: PhoneCall,
  phoneMissed: PhoneMissed,
};

const PLATFORM_BADGE_CONFIG = {
  instagram: { label: "IG", backgroundColor: "#EA4C89", color: "#FFFFFF" },
  facebook: { label: "f", backgroundColor: "#1877F2", color: "#FFFFFF" },
  x_twitter: { label: "X", backgroundColor: "#FFFFFF", color: "#000000" },
  x: { label: "X", backgroundColor: "#FFFFFF", color: "#000000" },
  whatsapp: { label: "W", backgroundColor: "#25D366", color: "#FFFFFF" },
  telegram: { label: "TG", backgroundColor: "#2AABEE", color: "#FFFFFF" },
  google_business: { label: "G", backgroundColor: "#F4F4F4", color: "#EA4335" },
  linkedin: { label: "in", backgroundColor: "#0A66C2", color: "#FFFFFF" },
};

const Shimmer = ({ width, height, radius, style }) => (
  <ShimmerPlaceHolder
    visible={false}
    LinearGradient={LinearGradient}
    width={width}
    height={height}
    shimmerStyle={[
      {
        borderRadius: radius,
        backgroundColor: "#151D28",
      },
      style,
    ]}
    shimmerColors={["#151D28", "#1E2937", "#151D28"]}
  />
);

const HomeScreenSkeleton = () => (
  <ScrollView
    contentContainerStyle={styles.content}
    showsVerticalScrollIndicator={false}
  >
    <View style={styles.header}>
      <Shimmer width={rw(52)} height={rh(4)} radius={10} />
      <View style={styles.headerRight}>
        <Shimmer width={rw(16)} height={rh(4.6)} radius={20} />
        <Shimmer width={rh(4.6)} height={rh(4.6)} radius={999} />
      </View>
    </View>

    <Shimmer width={rw(91)} height={rh(8.2)} radius={rw(5.2)} />
    <Shimmer width={rw(91)} height={rh(19)} radius={rw(5.2)} />

    <View style={styles.gridWrap}>
      <Shimmer width={rw(44)} height={rh(35)} radius={rw(5.2)} />
      <View style={styles.rightCol}>
        <Shimmer width={rw(44)} height={rh(16.5)} radius={rw(5.2)} />
        <Shimmer width={rw(44)} height={rh(16.5)} radius={rw(5.2)} />
      </View>
    </View>

    <Shimmer width={rw(91)} height={rh(23)} radius={rw(5.2)} />
    <Shimmer width={rw(91)} height={rh(27)} radius={rw(5.2)} />
  </ScrollView>
);

const HomeScreen = () => {
  const navigation = useNavigation();
  const authUser = useSelector((state) => state?.auth?.user || {});
  const { t } = useAppLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const { data: threads = [] } = useFetchConversationsQuery();
  const { data: contactsResponse } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
  });

  const { data: callSummaryResponse } = useMadbelGetCallSummaryQuery(
    undefined,
    {
      pollingInterval: 10000,
    },
  );

  const callSummaryData = callSummaryResponse?.data;
  const totalCallsCount = callSummaryData?.total_calls ?? 0;
  const minutesSavedCount = callSummaryData?.total_minutes_saved ?? 0;

  const { data: recentCallsResponse } = useMadbelListCallsQuery({
    page: 1,
    limit: 5,
  });
  const { data: integrationStatusResponse } =
    useMadbelGetIntegrationStatusQuery();
  const recentCallsRaw =
    recentCallsResponse?.calls ??
    recentCallsResponse?.data ??
    recentCallsResponse?.items ??
    recentCallsResponse;
  const recentCalls = Array.isArray(recentCallsRaw) ? recentCallsRaw : [];
  const recentCallRows = recentCalls.slice(0, 3).map((call, i) => ({
    id: call?._id || call?.id || `call-${i}`,
    icon: PhoneCall,
    iconColor: call?.status === "missed" ? "#ED4444" : "#11D1ED",
    muted: false,
    name:
      call?.contact_name ||
      call?.caller_name ||
      call?.phone_number ||
      t("unknown"),
    subtitle: call?.ai_summary?.purpose || call?.summary || call?.status || "",
    rightType: call?.duration ? "text" : "badge",
    rightText: call?.duration
      ? `${Math.round(Number(call.duration) / 60)}m`
      : call?.status === "completed"
        ? t("done")
        : t("ai_ready"),
  }));

  const analyticsCallRows = recentCallRows;

  const integrationItems = integrationStatusResponse?.data?.items ?? [];
  const connectedBadges = integrationItems
    .filter((item) => item?.connected)
    .map((item) => {
      const platform = item?.platform ?? "";
      const cfg = PLATFORM_BADGE_CONFIG[platform] ?? {
        label: platform.slice(0, 2).toUpperCase(),
        backgroundColor: "#1D2A38",
        color: "#FFFFFF",
      };
      return { id: platform, ...cfg };
    });

  const analyticsStats = [
    {
      id: "total",
      label: t("total_calls"),
      value: String(totalCallsCount),
      accent: false,
    },
    {
      id: "saved",
      label: t("minutes_saved"),
      value: String(minutesSavedCount),
      accent: true,
    },
  ];

  const firstNameFromEmail = String(
    authUser?.email || authUser?.client_email || "",
  )
    .split("@")[0]
    .trim();

  const displayName =
    authUser?.full_name ||
    authUser?.fullName ||
    authUser?.name ||
    authUser?.username ||
    (firstNameFromEmail ? firstNameFromEmail : "there");
  const totalChats = Array.isArray(threads) ? threads.length : 0;
  const latestThread = totalChats > 0 ? threads[0] : null;
  const latestPeerName =
    latestThread?.directPeer?.fullName ||
    latestThread?.directPeer?.name ||
    t("no_contact");
  const latestMessage =
    latestThread?.lastMessage?.text?.trim?.() || t("no_messages_yet");
  const inboxAvatars = (threads || []).slice(0, 2).map((thread) => ({
    uri: thread?.directPeer?.profileImage || thread?.directPeer?.avatar || "",
    name: thread?.directPeer?.fullName || thread?.directPeer?.name || "User",
  }));
  const remainingCount = Math.max(totalChats - inboxAvatars.length, 0);
  const inboxCountText = remainingCount > 0 ? `+${remainingCount}` : null;
  const contactsItems = Array.isArray(contactsResponse?.data?.items)
    ? contactsResponse.data.items
    : Array.isArray(contactsResponse?.items)
      ? contactsResponse.items
      : Array.isArray(contactsResponse?.data)
        ? contactsResponse.data
        : [];
  const totalContacts = contactsItems.length;
  const contactAvatars = contactsItems.slice(0, 3).map((contact) => ({
    uri:
      contact?.avatar_url ||
      contact?.avatar ||
      contact?.profileImage ||
      contact?.image ||
      "",
    name:
      contact?.name ||
      contact?.full_name ||
      contact?.fullName ||
      contact?.first_name ||
      contact?.firstName ||
      String(contact?.email || "").split("@")[0] ||
      "User",
  }));
  const contactCountText =
    totalContacts > contactAvatars.length
      ? `+${totalContacts - contactAvatars.length}`
      : null;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const openMessages = () => {
    const parentNav = navigation.getParent?.();
    if (parentNav) {
      parentNav.navigate("Chat");
      return;
    }
    navigation.navigate("Chat");
  };

  const openUnifiedConversations = () => {
    navigation.navigate("UnifiedConversations");
  };

  const openContacts = () => navigation.navigate("Contacts");
  const openScheduleMeeting = () => navigation.navigate("ScheduleMeeting");
  const openBulkMessaging = () => navigation.navigate("BulkMessaging");
  const openSocialIntegrations = () =>
    navigation.navigate("SocialIntegrations");
  const openVoiceAssistant = () => {
    const parentNav = navigation.getParent?.();
    if (parentNav) {
      parentNav.navigate("Shop", { screen: "MicListening" });
      return;
    }
    navigation.navigate("Shop", { screen: "MicListening" });
  };

  const openDocScreen = (route) => {
    if (!route) return;
    navigation.navigate(route);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? <HomeScreenSkeleton /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader
          greeting={`${t("good_morning")}, ${displayName}`}
          onNotificationPress={() => navigation.navigate("Notification")}
        />

        <Pressable style={styles.searchCard} onPress={openVoiceAssistant}>
          <Mic size={rw(6)} color="#11D1ED" />
          <Text style={styles.searchPlaceholder}>
            {t("tap_to_ask_smartflow")}
          </Text>
          <Text style={styles.dots}>{t("")}</Text>
        </Pressable>

        <Pressable style={styles.bulkQuickAction} onPress={openBulkMessaging}>
          <View style={styles.bulkQuickLeft}>
            <Megaphone size={20} color="#13D0EC" />
            <Text style={styles.bulkQuickText}>{t("bulk_messaging")}</Text>
          </View>
          <Text style={styles.bulkQuickHint}>{t("open")}</Text>
        </Pressable>

        <DashboardCard baseStyle={styles.cardBase}>
          <View style={styles.rowBetween}>
            <View style={styles.inboxBadge}>
              <Text style={styles.inboxText}>{t("inbox")}</Text>
            </View>
            <Text style={styles.mutedText}>
              {totalChats} {t("chats")}
            </Text>
          </View>

          <Text style={styles.cardTitle}>{t("unified_conversations")}</Text>
          <Text style={styles.cardSubTitle}>
            {t("latest")}: {latestPeerName} - "
            {latestMessage.length > 50
              ? latestMessage.slice(0, 47) + "..."
              : latestMessage}
            "
          </Text>

          <View style={[styles.rowBetween, styles.mt18]}>
            <AvatarStack avatars={inboxAvatars} countText={inboxCountText} />
            <ActionButton
              title={t("view_all")}
              onPress={openUnifiedConversations}
              baseStyle={styles.actionButton}
              baseTextStyle={styles.actionButtonText}
            />
          </View>
        </DashboardCard>

        <View style={styles.gridWrap}>
          <DashboardCard
            baseStyle={styles.cardBase}
            style={styles.leftTallCard}
            onPress={openContacts}
          >
            <View style={styles.iconSquare}>
              <Users size={24} color="#12D2ED" />
            </View>
            <Text style={styles.cardTitle}>{t("contacts")}</Text>
            <View style={styles.contactsStackWrap}>
              <AvatarStack
                avatars={contactAvatars}
                countText={contactCountText}
                size={rw(8.5)}
                overlap={-rw(2.4)}
              />
            </View>
            <ActionButton
              title={t("view_all")}
              onPress={openContacts}
              style={styles.secondaryBtn}
              baseStyle={styles.actionButton}
              baseTextStyle={styles.actionButtonText}
            />
          </DashboardCard>

          <View style={styles.rightCol}>
            <DashboardCard
              baseStyle={styles.cardBase}
              style={styles.upcomingLargeCard}
              onPress={openScheduleMeeting}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.labelText}>{t("upcoming")}</Text>
                <CalendarCheck2 size={23} color="#12D2ED" />
              </View>
              <Text style={styles.cardTitle}>{t("calendar")}</Text>
              <View style={styles.upcomingAvatarWrap} />
              <ActionButton
                title={t("add_your_calendar")}
                onPress={openScheduleMeeting}
                baseStyle={[styles.actionButton, styles.upcomingActionButton]}
                baseTextStyle={styles.actionButtonText}
              />
            </DashboardCard>

            <DashboardCard baseStyle={styles.cardBase} style={styles.smallCard}>
              <Text style={styles.labelText}>{t("integrations")}</Text>
              <View style={styles.integrationRow}>
                {connectedBadges.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.integrationBadge,
                      { backgroundColor: item.backgroundColor },
                    ]}
                  >
                    <Text
                      style={[styles.integrationLabel, { color: item.color }]}
                    >
                      {item.label}
                    </Text>
                  </View>
                ))}
                <Pressable
                  style={styles.integrationAdd}
                  onPress={openSocialIntegrations}
                >
                  <Plus size={16} color="#6A7C95" />
                </Pressable>
              </View>
            </DashboardCard>
          </View>
        </View>

        <DashboardCard baseStyle={styles.cardBase}>
          <Text style={styles.cardTitle}>{t("documents")}</Text>
          <View style={styles.docsRow}>
            {HOME_DOC_ITEMS.map((item) => (
              <DocumentTile
                key={item.id}
                item={{
                  ...item,
                  icon: DOC_ICON_MAP[item.iconKey] || FileText,
                }}
                onPress={openDocScreen}
                cardStyle={styles.docCard}
                iconWrapStyle={styles.docIconWrap}
                titleStyle={styles.docTitle}
              />
            ))}
          </View>
        </DashboardCard>

        <DashboardCard
          baseStyle={styles.cardBase}
          style={styles.analyticsCard}
          onPress={() => navigation.navigate("CallHistory")}
        >
          <View style={styles.analyticsHeader}>
            <PhoneCall size={21} color="#12D2ED" />
            <Text style={styles.analyticsTitle}>{t("ai_call_analytics")}</Text>
          </View>

          <View style={styles.statsRow}>
            {analyticsStats.map((item) => (
              <View key={item.id} style={styles.statBox}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={[styles.statValue, item.accent && styles.accent]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {analyticsCallRows.map((item) => (
            <AnalyticsCallRow
              key={item.id}
              item={{
                ...item,
                icon: item.icon || CALL_ICON_MAP[item.iconKey] || PhoneCall,
              }}
              styles={styles}
            />
          ))}
        </DashboardCard>
      </ScrollView>{" "}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  content: {
    paddingHorizontal: rw(4.5),
    paddingTop: rh(1.5),
    paddingBottom: rh(17),
    gap: rh(1.5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: rh(0.4),
  },
  greeting: {
    color: "#F3F8FF",
    fontSize: rw(5),
    fontWeight: "700",
    width: "60%",
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
  bulkQuickAction: {
    marginTop: rh(1.2),
    borderRadius: rw(4.4),
    borderWidth: 1,
    borderColor: "#1B5E6E",
    backgroundColor: "#0C2028",
    minHeight: rh(6.6),
    paddingHorizontal: rw(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkQuickLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.2),
  },
  bulkQuickText: {
    color: "#EAF8FF",
    fontSize: rw(3.9),
    fontWeight: "600",
  },
  bulkQuickHint: {
    color: "#78B7C7",
    fontSize: rw(3.2),
    fontWeight: "600",
  },
  cardBase: {
    borderRadius: rw(5.2),
    backgroundColor: "#131A24",
    borderWidth: 1,
    borderColor: "#243041",
    padding: rw(4.4),
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inboxBadge: {
    paddingHorizontal: rw(3.4),
    paddingVertical: rh(0.65),
    borderRadius: rw(3),
    backgroundColor: "#123B4A",
  },
  inboxText: {
    color: "#12D2ED",
    fontSize: rw(3),
    fontWeight: "700",
    letterSpacing: 1,
  },
  mutedText: {
    color: "#8093AC",
    fontSize: rw(3.6),
  },
  cardTitle: {
    color: "#F4F8FF",
    fontSize: rw(5.5),
    fontWeight: "700",
    marginTop: rh(1.1),
  },
  cardSubTitle: {
    color: "#8EA0B6",
    fontSize: rw(3.9),
    marginTop: rh(0.8),
    maxWidth: "78%",
  },
  mt18: {
    marginTop: rh(2),
  },
  actionButton: {
    backgroundColor: "#15D4EE",
    borderRadius: rw(4.8),
    paddingHorizontal: rw(7.5),
    paddingVertical: rh(1.2),
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#071016",
    fontSize: rw(4.3),
    fontWeight: "700",
  },
  gridWrap: {
    flexDirection: "row",
    gap: rw(2.8),
  },
  leftTallCard: {
    flex: 1,
    minHeight: rh(35),
    justifyContent: "space-between",
  },
  iconSquare: {
    width: rw(18),
    height: rw(18),
    borderRadius: rw(5.2),
    backgroundColor: "#103B49",
    alignItems: "center",
    justifyContent: "center",
  },
  contactsStackWrap: {
    marginTop: rh(1.2),
    marginBottom: rh(1.6),
  },
  secondaryBtn: {
    height: rh(6.2),
    borderRadius: rw(4),
    paddingHorizontal: rw(3),
  },
  rightCol: {
    flex: 1,
    gap: rw(2.8),
  },
  smallCard: {
    flex: 1,
    minHeight: rh(16.5),
    padding: rw(4),
  },
  upcomingLargeCard: {
    flex: 1,
    minHeight: rh(22.5),
    padding: rw(4.2),
    justifyContent: "space-between",
  },
  upcomingAvatarWrap: {
    marginTop: rh(1),
    marginBottom: rh(1.2),
  },
  upcomingActionButton: {
    minHeight: rh(6.4),
    borderRadius: rw(4),
    paddingHorizontal: rw(3),
  },
  labelText: {
    color: "#7B8EA7",
    fontSize: rw(3.6),
    fontWeight: "600",
  },
  timeText: {
    color: "#A8B7CB",
    fontSize: rw(4),
    marginTop: rh(1.1),
  },
  integrationRow: {
    marginTop: rh(2.1),
    flexDirection: "row",
    alignItems: "center",
    gap: rw(2.3),
    flexWrap: "wrap",
  },
  integrationBadge: {
    width: rw(8.7),
    height: rw(8.7),
    borderRadius: rw(2.1),
    alignItems: "center",
    justifyContent: "center",
  },
  integrationLabel: {
    fontSize: rw(4.2),
    fontWeight: "700",
  },
  integrationAdd: {
    width: rw(8.7),
    height: rw(8.7),
    borderRadius: rw(4.35),
    borderWidth: 1,
    borderColor: "#2F3F54",
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
  },
  docsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: rh(1.8),
    gap: rw(1.8),
  },
  docCard: {
    flex: 1,
    borderRadius: rw(3.8),
    borderWidth: 1,
    borderColor: "#214457",
    backgroundColor: "#12303F",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: rh(1.8),
    minHeight: rh(16.5),
  },
  docIconWrap: {
    width: rw(12),
    height: rw(12),
    borderRadius: rw(3.5),
    backgroundColor: "#0E2A38",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: rh(1),
  },
  docTitle: {
    color: "#E9F2FF",
    fontSize: rw(3.5),
    fontWeight: "500",
    textAlign: "center",
    lineHeight: rw(4.6),
    width: "100%",
    paddingHorizontal: rw(1),
  },
  analyticsCard: {
    marginBottom: rh(1),
  },
  analyticsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: rw(1.8),
  },
  analyticsTitle: {
    color: "#F4F8FF",
    fontSize: rw(5.5),
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: rw(2.6),
    marginTop: rh(1.5),
    marginBottom: rh(1.5),
  },
  statBox: {
    flex: 1,
    borderRadius: rw(3.8),
    borderWidth: 1,
    borderColor: "#243246",
    backgroundColor: "#0A1019",
    padding: rw(3.4),
  },
  statLabel: {
    color: "#8E9FB5",
    fontSize: rw(3.8),
  },
  statValue: {
    color: "#F4F9FF",
    fontSize: rw(6.3),
    fontWeight: "700",
    marginTop: rh(0.6),
  },
  accent: {
    color: "#12D2ED",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: rh(1.2),
  },
  callIconWrap: {
    width: rw(10.4),
    height: rw(10.4),
    borderRadius: rw(5.2),
    backgroundColor: "#0F3A48",
    alignItems: "center",
    justifyContent: "center",
    marginRight: rw(2.3),
  },
  callIconMuted: {
    backgroundColor: "#202833",
  },
  callTextWrap: {
    flex: 1,
  },
  callName: {
    color: "#F1F8FF",
    fontSize: rw(4.8),
    fontWeight: "700",
  },
  callSub: {
    color: "#95A6BC",
    fontSize: rw(4),
    marginTop: rh(0.2),
  },
  readyBadge: {
    borderRadius: rw(3.4),
    backgroundColor: "#184833",
    paddingHorizontal: rw(3.2),
    paddingVertical: rh(0.65),
  },
  readyText: {
    color: "#3ADF87",
    fontSize: rw(3.8),
    fontWeight: "600",
  },
  callbackText: {
    color: "#12D2ED",
    fontSize: rw(4.1),
    fontWeight: "500",
    textDecorationLine: "underline",
  },
});

export default HomeScreen;
