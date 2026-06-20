import React from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { useMadbelListAiHistoryQuery } from "../../redux/slices/madbelSmartflowSlice";

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  try {
    return new Date(dateValue).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const ProfileVoiceHistoryScreen = () => {
  const navigation = useNavigation();
  const { data, isLoading, isError } = useMadbelListAiHistoryQuery({ page: 1, page_size: 50 });

  const calls = data?.items || data?.data || [];

  const renderItem = ({ item }) => {
    const label = item?.command_text || "Voice command";
    const typeLabel = item?.command_type_label || item?.command_type || "";
    const statusLabel = item?.status_label || item?.status || "";
    const time = formatTime(item?.timestamp || item?.created_at);

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          {!!typeLabel && <Text style={styles.badge}>{typeLabel}</Text>}
          {!!statusLabel && <Text style={styles.status}>{statusLabel}</Text>}
        </View>
        <Text style={styles.text}>{label}</Text>
        {!!time && <Text style={styles.time}>{time}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>AI Voice History</Text>
          <View style={styles.spacer} />
        </View>

        {isLoading ? (
          <ActivityIndicator color="#17b4c9" style={{ marginTop: responsiveHeight(10) }} />
        ) : isError || calls.length === 0 ? (
          <Text style={styles.empty}>No voice history found.</Text>
        ) : (
          <FlatList
            data={calls}
            keyExtractor={(item, i) => String(item?._id || item?.id || i)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.4),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 50 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  list: {
    gap: responsiveHeight(1.4),
    paddingBottom: responsiveHeight(2.5),
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#212530",
    backgroundColor: "#1B1C21",
    paddingHorizontal: responsiveWidth(4.4),
    paddingVertical: responsiveHeight(1.6),
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(0.6),
  },
  badge: {
    color: "#17CBE8",
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: "rgba(23,203,232,0.12)",
    borderRadius: 6,
    paddingHorizontal: responsiveWidth(2),
    paddingVertical: 2,
    textTransform: "capitalize",
  },
  status: {
    color: "#8A9AB0",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  text: {
    color: "#F2F4F7",
    fontSize: 44 / 2,
    lineHeight: 32,
  },
  time: {
    marginTop: responsiveHeight(1),
    color: "#9AA6B3",
    fontSize: 34 / 2,
  },
  empty: {
    color: "#9AA6B3",
    textAlign: "center",
    marginTop: responsiveHeight(10),
    fontSize: 16,
  },
});

export default ProfileVoiceHistoryScreen;
