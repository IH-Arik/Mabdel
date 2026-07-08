import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  Image,
  FlatList,
  StyleSheet,
} from "react-native";
import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { Bot, Search } from "lucide-react-native";
import { useAppLanguage } from "../../context/LanguageContext";
import {
  useFetchConversationsQuery,
  useArchiveConversationMutation,
} from "../../redux/slices/chat/chatSlice";

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

const FILTER_OPTIONS = [
  { key: "all", labelKey: "all" },
  { key: "unread", labelKey: "unread" },
];

const AllChatScreen = () => {
  const navigation = useNavigation();
  const { t } = useAppLanguage();
  const { data: threads = [], isLoading } = useFetchConversationsQuery();
  const [archiveConversation] = useArchiveConversationMutation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const formattedConversations = useMemo(() => {
    if (!Array.isArray(threads) || !threads.length) return [];
    return threads.map((thread) => {
      const isGroup = Boolean(thread?.type === "group" || thread?.is_group || thread?.isGroup);
      return {
        id: thread?._id || thread?.id,
        name:
          thread?.title ||
          thread?.group?.name ||
          thread?.directPeer?.fullName ||
          thread?.directPeer?.name ||
          t(isGroup ? "group_chat" : "unknown_user"),
        lastMessage: thread?.lastMessage?.text || t("no_messages_yet"),
        time: formatRelativeTime(
          thread?.lastMessage?.createdAt || thread?.updatedAt,
          t,
        ),
        unreadCount: Number(thread?.unreadCount || 0),
        avatar:
          thread?.avatar_url || thread?.directPeer?.profileImage || thread?.directPeer?.avatar || "",
        isOnline: Boolean(thread?.directPeer?.isOnline),
        isGroup,
      };
    });
  }, [threads, t]);

  const handleConversationLongPress = (item) => {
    Alert.alert(
      item.name,
      t("what_would_you_like_to_do"),
      [
        {
          text: t("archive"),
          onPress: () =>
            archiveConversation({ threadId: item.id, archived: true }),
        },
        { text: t("cancel"), style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const handleConversationPress = (item) => {
    if (item?.isGroup) {
      navigation.navigate("Community", {
        screen: "GroupChat",
        params: {
          group: {
            id: item.id,
            name: item.name,
            avatar_url: item.avatar,
            conversation_id: item.id,
          },
        }
      });
    } else {
      navigation.navigate("SingleChat", {
        threadId: item.id,
        conversation: item,
      });
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return formattedConversations.filter((item) => {
      if (activeFilter === "unread" && !(item.unreadCount > 0)) return false;
      if (!q) return true;
      return (
        String(item.name).toLowerCase().includes(q) ||
        String(item.lastMessage).toLowerCase().includes(q)
      );
    });
  }, [activeFilter, searchQuery, formattedConversations]);

  const renderItem = ({ item }) => {
    const hasUnread = item.unreadCount > 0;
    return (
      <Pressable
        style={styles.card}
        onPress={() => handleConversationPress(item)}
        onLongPress={() => handleConversationLongPress(item)}
        delayLongPress={400}
      >
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
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text
              style={[styles.name, hasUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {item.time}
            </Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {Math.min(item.unreadCount, 99)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("messages")}</Text>
        {formattedConversations.length > 0 && (
          <Text style={styles.subtitle}>
            {formattedConversations.length} {t("conversations")}
          </Text>
        )}
      </View>

      <View style={styles.searchWrap}>
        <Search size={18} color="#70829B" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("search_messages")}
          placeholderTextColor="#667A93"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[
              styles.filterChip,
              activeFilter === opt.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(opt.key)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === opt.key && styles.filterTextActive,
              ]}
            >
              {t(opt.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pinned AI Assistant */}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#1AD3EF" />
          <Text style={styles.loadingText}>{t("loading_chats")}</Text>
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
                {searchQuery ? t("no_results_found") : t("no_conversations_yet")}
              </Text>
            </View>
          }
          ListHeaderComponent={
            <Pressable
              style={styles.aiCard}
              onPress={() => navigation.navigate("MicConversation")}
            >
              <View style={styles.aiAvatarWrap}>
                <View style={styles.aiAvatar}>
                  <Bot size={22} color="#17CBE8" />
                </View>
                <View style={styles.aiOnlineDot} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.aiName}>{t("ai_assistant")}</Text>
                  <Text style={styles.aiOnlineText}>{t("online")}</Text>
                </View>
                <Text style={styles.aiPreview} numberOfLines={1}>
                  {t("ask_me_anything_about_your_business")}
                </Text>
              </View>
            </Pressable>
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
    marginBottom: responsiveHeight(2),
  },
  title: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#5D6A7A",
    fontSize: 13,
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
  filterRow: {
    flexDirection: "row",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1.8),
  },
  filterChip: {
    paddingHorizontal: responsiveWidth(4.5),
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
  aiCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0D1F30",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#17CBE8",
    padding: responsiveWidth(3.5),
    marginBottom: responsiveHeight(0.8),
    gap: responsiveWidth(3),
  },
  aiAvatarWrap: {
    position: "relative",
  },
  aiAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0B2A3F",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#17CBE8",
  },
  aiOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#17CBE8",
    borderWidth: 2,
    borderColor: "#020406",
  },
  aiName: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },
  aiOnlineText: {
    color: "#17CBE8",
    fontSize: 12,
    fontWeight: "600",
  },
  aiPreview: {
    color: "#7A8FA0",
    fontSize: 13,
    marginTop: 2,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: responsiveHeight(1.4),
    borderBottomWidth: 1,
    borderBottomColor: "#141820",
    gap: responsiveWidth(3),
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    backgroundColor: "#1B2A3B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#17CBE8",
    fontSize: 18,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
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
  listContent: {
    paddingBottom: responsiveHeight(12),
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

export default AllChatScreen;
