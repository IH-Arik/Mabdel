import { useAppLanguage } from "../context/LanguageContext";
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  Pressable,
  ScrollView,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Bell, ChevronLeft , MessageCircle , Mail , MessageSquare} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelListNotificationsQuery,
  useMadbelMarkAllNotificationsReadMutation,
  useMadbelDeleteNotificationMutation,
} from "../redux/slices/madbelApiSlice";

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
];

const getChannelBadgeConfig = (channelValue) => {
  const { t } = useAppLanguage();
  const channel = String(channelValue || "").toLowerCase();
  if (channel.includes("whatsapp")) {
    return {
      Icon: MessageCircle,
      backgroundColor: "#25D366",
    };
  }

  if (channel.includes("email")) {
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

const NotificationScreen = () => {
  const navigation = useNavigation();
  const [activeFilter, setActiveFilter] = React.useState("all");
  const { t } = useAppLanguage();

  const { data: apiResponse, isLoading, refetch } = useMadbelListNotificationsQuery({
    page: 1,
    page_size: 100,
  }, { refetchOnMountOrArgChange: true });

  const [markAllRead] = useMadbelMarkAllNotificationsReadMutation();
  const [deleteNotification] = useMadbelDeleteNotificationMutation();

  const notifications = React.useMemo(() => {
    const rawItems = apiResponse?.data?.items || [];
    return rawItems.map(item => {
      // Determine channel
      let channel = "system";
      if (item.type === "message") {
        channel = item.metadata?.channel || "whatsapp";
      } else if (item.type === "missed_call" || item.type === "scheduled_call") {
        channel = "sms";
      } else if (item.type === "daily_digest") {
        channel = "email";
      }
      
      // Determine avatar
      let avatar = item.metadata?.avatar;
      if (!avatar) {
        if (item.type === "message" && item.title) {
          avatar = `https://robohash.org/${encodeURIComponent(item.title)}.png`;
        } else {
          avatar = `https://robohash.org/${encodeURIComponent(item.type || "bell")}.png`;
        }
      }

      return {
        id: item.id,
        title: item.title,
        description: item.body,
        isNew: item.unread,
        avatar,
        channel,
        originalItem: item,
      };
    });
  }, [apiResponse]);

  const handleDelete = (id) => {
    Alert.alert(
      t("delete_notification"),
      t("are_you_sure_you_want_to_delete_this_notification"),
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteNotification(id).unwrap();
            } catch (err) {
              Alert.alert(t("error"), t("could_not_delete_notification_please_try_again"));
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllRead().unwrap();
    } catch (err) {
      Alert.alert(t("error"), t("could_not_mark_notifications_as_read"));
    }
  };

  const filteredNotifications = React.useMemo(() => {
    return notifications.filter((item) => {
      if (activeFilter === "unread" && !item.isNew) return false;
      if (["whatsapp", "email", "sms"].includes(activeFilter)) {
        if (item.channel !== activeFilter) return false;
      }
      return true;
    });
  }, [activeFilter, notifications]);

  const renderItem = ({ item, index }) => {
    const channelBadge = getChannelBadgeConfig(item?.channel);
    const showHighlight = index === 0 && activeFilter === "all" && item.isNew;

    return (
      <View style={[styles.card, showHighlight && styles.cardHighlight]}>
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
          {item.isNew && <View style={styles.newDot} />}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isNew && <View style={styles.newBadge} />}
          </View>
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  const renderHiddenItem = ({ item }) => (
    <View style={styles.hiddenItemContainer}>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <Text style={styles.deleteButtonText}>{t("delete")}</Text>
      </TouchableOpacity>
    </View>
  );

  const newCount = notifications.filter((n) => n.isNew).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#020406" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.header2}>

        <Pressable
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          style={styles.backBtn}
          >
          <ChevronLeft size={responsiveWidth(5)} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("notifications")}</Text>
          </View>
        <TouchableOpacity onPress={handleMarkAllAsRead}>
          <Text style={styles.markAllText}>{t("mark_all_as_read")}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}


      {/* NEW badge */}
      {newCount > 0 && activeFilter === "all" && (
        <View style={styles.newBadgeContainer}>
          <Bell size={16} color="#16CBEA" />
          <Text style={styles.newBadgeText}>{newCount} {newCount > 1 ? t("new_notifications") : t("new_notification")}</Text>
        </View>
      )}

      {/* List of notifications */}
      {isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t("loading_notifications")}</Text>
        </View>
      ) : filteredNotifications.length > 0 ? (
        <SwipeListView
          data={filteredNotifications}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          rightOpenValue={-80}
          disableRightSwipe={true}
          swipeToOpenPercent={30}
          previewRowKey="0"
          previewOpenValue={-40}
          previewOpenDelay={3000}
          refreshing={isLoading}
          onRefresh={refetch}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Bell size={48} color="#2A313C" />
          <Text style={styles.emptyText}>{t("no_notifications")}</Text>
          <Text style={styles.emptySubText}>{t("youre_all_caught_up")}</Text>
        </View>
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
    marginBottom: responsiveHeight(2.2),
  },
    header2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // marginBottom: responsiveHeight(2.2),
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: responsiveWidth(5),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  markAllText: {
    fontSize: 12,
    color: "#16CBEA",
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: responsiveHeight(1.8),
  },
  filterScroll: {
    flexGrow: 0,
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
  newBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    backgroundColor: "#0A1C24",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(22, 203, 234, 0.2)",
  },
  newBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#16CBEA",
  },
  listContent: {
    paddingBottom: responsiveHeight(14),
    gap: 12,
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
    backgroundColor: "rgba(3, 20, 27)",
    borderColor: "rgba(22, 203, 234)",
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
  newDot: {
    position: "absolute",
    right: 0,
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#16CBEA",
    borderWidth: 2,
    borderColor: "#020406",
  },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16CBEA",
    marginLeft: 8,
  },
  channelBadge: {
    position: "absolute",
    left: 0,
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
  itemTitle: {
    flex: 1,
    color: "#F2F7FF",
    fontSize: 18,
    fontWeight: "700",
  },
  itemDescription: {
    color: "#6E8099",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 20,
  },
  hiddenItemContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    height: "90%",
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    borderRadius: 12,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: responsiveHeight(10),
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    color: "#F2F7FF",
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#6E8099",
  },
});

export default NotificationScreen;
