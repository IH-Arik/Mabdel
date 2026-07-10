import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  TextInput,
  Image,
  FlatList,
  StyleSheet,
  ScrollView,
} from "react-native";
import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  Search,
  MessageCircle,
  Mail,
  MessageSquare,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
} from "lucide-react-native";
import { useFetchConversationsQuery } from "../../redux/slices/chat/chatSlice";
import { useAppLanguage } from "../../context/LanguageContext";

const formatRelativeTime = (dateValue, t) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ${t("ago")}`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ${t("ago")}`;
  if (diffMs < day * 2) return t("yesterday");
  return `${Math.floor(diffMs / day)}d ${t("ago")}`;
};

const normalizePlatform = (value) => {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("facebook") || lower.includes("fb")) return "facebook";
  if (lower.includes("instagram") || lower.includes("ig")) return "instagram";
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("twitter") || lower === "x") return "x";
  if (lower.includes("email") || lower.includes("mail")) return "email";
  if (lower.includes("sms") || lower.includes("text")) return "sms";
  return "sms";
};

const PLATFORM_CONFIG = {
  whatsapp: { Icon: MessageCircle, bg: "#25D366", color: "#fff", labelKey: "whatsapp" },
  facebook: { Icon: Facebook, bg: "#1877F2", color: "#fff", labelKey: "facebook" },
  instagram: { Icon: Instagram, bg: "#E1306C", color: "#fff", labelKey: "instagram" },
  linkedin: { Icon: Linkedin, bg: "#0A66C2", color: "#fff", labelKey: "linkedin" },
  x: { Icon: Twitter, bg: "#000", color: "#fff", labelKey: "x" },
  email: { Icon: Mail, bg: "#4D9CFF", color: "#fff", labelKey: "email" },
  sms: { Icon: MessageSquare, bg: "#6B7280", color: "#fff", labelKey: "sms" },
};

const FILTER_OPTIONS = [
  { key: "all", labelKey: "all" },
  { key: "whatsapp", labelKey: "whatsapp" },
  { key: "sms", labelKey: "sms" },
  { key: "email", labelKey: "email" },
  { key: "facebook", labelKey: "facebook" },
  { key: "instagram", labelKey: "instagram" },
];

const STATUS_ICONS = {
  sent: "✓",
  delivered: "✓✓",
  read: "✓✓",
};

const UnifiedConversationsScreen = () => {
  const navigation = useNavigation();
  const { t } = useAppLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const platformParam = activeFilter !== "all" ? activeFilter : undefined;
  const { data: threads = [], isLoading } = useFetchConversationsQuery(
    platformParam ? { platform: platformParam } : undefined,
  );

  const allData = useMemo(() => {
    if (!Array.isArray(threads)) return [];
    return threads.map((thread) => ({
      id: thread?._id || thread?.id,
      name:
        thread?.title ||
        thread?.group?.name ||
        thread?.directPeer?.fullName ||
        thread?.directPeer?.name ||
        t(thread?.type === "group" ? "group_chat" : "unknown_user"),
      lastMessage: thread?.lastMessage?.text || t("no_messages_yet"),
      time: formatRelativeTime(thread?.lastMessage?.createdAt || thread?.updatedAt, t),
      unreadCount: Number(thread?.unreadCount || 0),
      avatar:
        thread?.avatar_url ||
        thread?.group?.avatar_url ||
        thread?.group?.avatar ||
        thread?.directPeer?.profileImage ||
        thread?.directPeer?.avatar ||
        "",
      platform: normalizePlatform(thread?.channel || thread?.source || thread?.platform || thread?.type),
      status: thread?.lastMessage?.status || null,
      isGroup: Boolean(thread?.type === "group" || thread?.is_group || thread?.isGroup),
      raw: thread,
    }));
  }, [threads, t]);

  const totalUnread = useMemo(() => allData.reduce((s, i) => s + i.unreadCount, 0), [allData]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allData.filter((item) => {
      if (!q) return true;
      return (
        String(item.name).toLowerCase().includes(q) ||
        String(item.lastMessage).toLowerCase().includes(q)
      );
    });
  }, [searchQuery, allData]);

  const handlePress = (item) => {
    if (item?.isGroup) {
      navigation.navigate("GroupChat", {
        group: {
          ...(item.raw || {}),
          id: item.id,
          name: item.name,
          avatar_url: item.avatar,
          conversation_id: item.id,
          threadId: item.id,
          type: "group",
          is_group: true,
          isGroup: true,
        },
      });
    } else {
      navigation.navigate("SingleChat", {
        threadId: item.id,
        conversation: item,
      });
    }
  };

  const renderItem = ({ item }) => {
    const hasUnread = item.unreadCount > 0;
    const platform = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.sms;
    const PlatformIcon = platform.Icon;

    return (
      <Pressable style={styles.card} onPress={() => handlePress(item)}>
        <View style={styles.avatarWrap}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {String(item.name || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.platformBadge, { backgroundColor: platform.bg }]}>
            <PlatformIcon size={9} color={platform.color} strokeWidth={2.5} />
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>{item.time}</Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{Math.min(item.unreadCount, 99)}</Text>
              </View>
            ) : item.status === "read" ? (
              <Text style={styles.readTick}>{t("")}</Text>
            ) : item.status === "delivered" ? (
              <Text style={styles.deliveredTick}>{t("")}</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={26} color="#F8FAFC" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t("unified_conversations")}</Text>
          {totalUnread > 0 && (
            <Text style={styles.subtitle}>{totalUnread} {t("unread_messages")}</Text>
          )}
        </View>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.searchWrap}>
        <Search size={18} color="#70829B" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("search_conversations")}
          placeholderTextColor="#667A93"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.filterChip, activeFilter === opt.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(opt.key)}
          >
            <Text style={[styles.filterText, activeFilter === opt.key && styles.filterTextActive]}>
              {opt.labelKey}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1AD3EF" />
          <Text style={styles.loadingText}>{t("loading_conversations")}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item, i) => String(item?.id || i)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? t("no_results_found")
                  : activeFilter !== "all"
                  ? t("no_platform_conversations", { platform: t(PLATFORM_CONFIG[activeFilter]?.labelKey || activeFilter) })
                  : t("no_conversations_yet")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(4),
    paddingTop: responsiveHeight(1),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2),
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#17CBE8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#171A21",
    borderWidth: 1,
    borderColor: "#232A34",
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1.6),
  },
  searchInput: {
    flex: 1,
    color: "#C8D8E8",
    fontSize: 15,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: responsiveHeight(1.8),
  },
  filterRow: {
    gap: responsiveWidth(2),
    paddingRight: responsiveWidth(2),
  },
  filterChip: {
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 20,
    backgroundColor: "#171A21",
    borderWidth: 1,
    borderColor: "#232A34",
  },
  filterChipActive: {
    backgroundColor: "#17CBE8",
    borderColor: "#17CBE8",
  },
  filterText: {
    color: "#7A8FA0",
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#020406",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: responsiveHeight(1.6),
    borderBottomWidth: 1,
    borderBottomColor: "#141820",
    gap: responsiveWidth(3),
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    backgroundColor: "#1B2A3B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#17CBE8",
    fontSize: 20,
    fontWeight: "700",
  },
  platformBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#020406",
  },
  cardBody: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    color: "#C8D8E8",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    color: "#F8FAFC",
    fontWeight: "700",
  },
  time: {
    color: "#5D6A7A",
    fontSize: 12,
  },
  timeUnread: {
    color: "#17CBE8",
    fontWeight: "600",
  },
  preview: {
    color: "#5D6A7A",
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  previewUnread: {
    color: "#8A9AB0",
    fontWeight: "500",
  },
  unreadBadge: {
    backgroundColor: "#17CBE8",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    color: "#020406",
    fontSize: 11,
    fontWeight: "700",
  },
  readTick: {
    color: "#17CBE8",
    fontSize: 12,
    fontWeight: "700",
  },
  deliveredTick: {
    color: "#5D6A7A",
    fontSize: 12,
  },
  listContent: {
    paddingBottom: responsiveHeight(20),
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveHeight(1),
  },
  loadingText: {
    color: "#5D6A7A",
    fontSize: 14,
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: responsiveHeight(8),
  },
  emptyText: {
    color: "#5D6A7A",
    fontSize: 15,
  },
});

export default UnifiedConversationsScreen;
