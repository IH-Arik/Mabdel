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
} from "lucide-react-native";
import { conversations } from "../../../assets/data/data";
import { useFetchConversationsQuery } from "../../redux/slices/chat/chatSlice";

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `${mins}m ago`;
  }

  if (diffMs < day) {
    const hrs = Math.floor(diffMs / hour);
    return `${hrs}h ago`;
  }

  if (diffMs < day * 2) return "Yesterday";
  return `${Math.floor(diffMs / day)}d ago`;
};

const normalizeChannel = (value) => {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("email") || lower.includes("mail")) return "email";
  if (lower.includes("sms") || lower.includes("text")) return "sms";
  return "sms";
};

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "social-media", label: "Social Media" },
  // { key: "insta", label: "Instagram" },
];

const getChannelBadgeConfig = (channelValue) => {
  const channel = normalizeChannel(channelValue);
  if (channel === "whatsapp") {
    return {
      Icon: MessageCircle,
      backgroundColor: "#25D366",
    };
  }

  if (channel === "email") {
    return {
      Icon: Mail,
      backgroundColor: "#4D9CFF",
    };
  }

  return {
    Icon: MessageSquare,
    backgroundColor: "#8A94A8",
  };
};

const AllChatScreen = () => {
  const navigation = useNavigation();
  const { data: threads = [], isLoading } = useFetchConversationsQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const formattedConversations = useMemo(() => {
    if (!Array.isArray(threads) || !threads.length) return [];

    return threads.map((thread) => ({
      id: thread?._id,
      name: thread?.directPeer?.fullName || thread?.directPeer?.name || "Unknown User",
      lastMessage: thread?.lastMessage?.text || "No messages yet",
      time: formatRelativeTime(thread?.lastMessage?.createdAt),
      unreadCount: Number(thread?.unreadCount || 0),
      avatar:
        thread?.directPeer?.profileImage ||
        thread?.directPeer?.avatar ||
        "https://robohash.org/user.png",
      isOnline: Boolean(thread?.directPeer?.isOnline),
      channel: normalizeChannel(thread?.channel || thread?.source || thread?.type),
      isGroup: Boolean(thread?.is_group || thread?.isGroup),
    }));
  }, [threads]);

  const fallbackConversations = useMemo(
    () =>
      conversations.map((item, index) => ({
        ...item,
        unreadCount: item.unread ? 1 : 0,
        isOnline: index === 0,
        channel: ["whatsapp", "sms", "email"][index % 3],
        isGroup: false,
      })),
    [],
  );

  const handleConversationPress = (conversation) => {
    if (conversation?.isGroup) {
      navigation.navigate("GroupChat", {
        group: {
          id: conversation?.id,
          name: conversation?.name,
          avatar_url: conversation?.avatar,
          conversation_id: conversation?.id,
        },
      });
    } else {
      navigation.navigate("SingleChat", {
        threadId: conversation?.id,
        conversation,
      });
    }
  };

  const sourceData = formattedConversations.length
    ? formattedConversations
    : fallbackConversations;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sourceData.filter((item) => {
      if (activeFilter === "unread" && !(item.unreadCount > 0)) return false;
      if (["whatsapp", "email", "sms"].includes(activeFilter)) {
        if (normalizeChannel(item?.channel) !== activeFilter) return false;
      }

      if (!query) return true;
      const name = String(item?.name || "").toLowerCase();
      const lastMessage = String(item?.lastMessage || "").toLowerCase();
      return name.includes(query) || lastMessage.includes(query);
    });
  }, [activeFilter, searchQuery, sourceData]);

  const renderConversation = ({ item, index }) => {
    const unreadCount = Number(item?.unreadCount || 0);
    const hasUnread = unreadCount > 0;
    const showAiStyle = index === 0 && activeFilter === "all";
    const channelBadge = getChannelBadgeConfig(item?.channel);

    const handlePress = () => {
      if (showAiStyle) {
        navigation.navigate("MicConversation");
      } else {
        handleConversationPress(item);
      }
    };

    return (
      <Pressable
        style={[styles.card, showAiStyle && styles.cardHighlight]}
        onPress={handlePress}
      >
        <View style={styles.avatarWrap}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View
            style={[
              styles.channelBadge,
              { backgroundColor: channelBadge.backgroundColor },
            ]}
          >
            <channelBadge.Icon size={12} color="#F8FBFF" strokeWidth={2.5} />
          </View>
          {item?.isOnline ? <View style={styles.onlineDot} /> : null}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]} numberOfLines={1}>
              {item.time}
            </Text>
          </View>

          <View style={styles.cardBottomRow}>
            <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{Math.min(unreadCount, 99)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={26} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchWrap}>
        <Search size={23} color="#70829B" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search messages..."
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
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            style={[
              styles.filterChip,
              activeFilter === option.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(option.key)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === option.key && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1AD3EF" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item, index) => String(item?.id || index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No conversations found</Text>
          </View>
        }
      />
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
    marginBottom: responsiveHeight(2.2),
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  searchWrap: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#171A21",
    borderWidth: 1,
    borderColor: "#232A34",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveHeight(1.8),
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: "#D3DFEF",
    fontSize: 17,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: responsiveHeight(1.8),
    // paddingRight: 16,
    // paddingVertical: 20,
  },
  filterScroll: {
    flexGrow: 0,
    // maxHeight: 52,
  },
  filterChip: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "#191D24",
    borderWidth: 1,
    borderColor: "#2A313C",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  filterChipActive: {
    backgroundColor: "#16CBEA",
    borderColor: "#16CBEA",
  },
  filterText: {
    color: "#94A6BC",
    fontSize: 16,
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#F7FDFF",
    fontWeight: "600",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveHeight(1.5),
  },
  loadingText: {
    color: "#7187A0",
    marginTop: 8,
    fontSize: 14,
  },
  listContent: {
    gap: 12,
    paddingBottom: responsiveHeight(14),
  },
  card: {
    minHeight: 96,
    borderRadius: 20,
    backgroundColor: "#181B21",
    borderWidth: 1,
    borderColor: "#242B36",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cardHighlight: {
    backgroundColor: "rgba(3, 20, 27, 0.9)",
    borderColor: "rgba(22, 203, 234, 0.35)",
    shadowColor: "#1AD3EF",
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  onlineDot: {
    position: "absolute",
    left: 0,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2CE652",
    borderWidth: 2,
    borderColor: "#020406",
  },
  channelBadge: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#020406",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  name: {
    flex: 1,
    color: "#F2F7FF",
    fontSize: 23,
    fontWeight: "700",
  },
  time: {
    color: "#7387A1",
    fontSize: 14,
    fontWeight: "500",
  },
  timeUnread: {
    color: "#18CDEB",
    fontWeight: "600",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  preview: {
    flex: 1,
    color: "#6E8099",
    fontSize: 17,
    fontWeight: "400",
  },
  previewUnread: {
    color: "#CFDBEA",
    fontWeight: "500",
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#18CDEB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  unreadText: {
    color: "#F7FDFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyWrap: {
    paddingTop: responsiveHeight(10),
    alignItems: "center",
  },
  emptyText: {
    color: "#7F8EA2",
    fontSize: 16,
  },
});

export default AllChatScreen;
