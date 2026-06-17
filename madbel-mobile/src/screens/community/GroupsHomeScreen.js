import React from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, Plus, Users } from "lucide-react-native";
import { useFetchConversationsQuery } from "../../redux/slices/chat/chatSlice";

const GroupsHomeScreen = () => {
  const navigation = useNavigation();
  const { data: groups = [], isLoading, isFetching, error } = useFetchConversationsQuery({ type: "group" });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={34} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>Groups</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subTitle}>Manage your contact groups</Text>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#14C9E7" size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.metaText}>Could not load groups.</Text>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.groupCard}
                onPress={() => navigation.navigate("GroupChat", {
                  group: {
                    ...item,
                    name: item.title || item.directPeer?.fullName || "Team Chat",
                    conversation_id: item.id,
                  },
                })}
              >
                <View style={styles.groupIconWrap}>
                  <Users size={24} color="#13CBEB" strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>{item.title || item.directPeer?.fullName || "Team Chat"}</Text>
                  <Text style={styles.groupMeta}>
                    {Array.isArray(item.member_ids) ? item.member_ids.length : 0} Members
                  </Text>
                </View>
              </Pressable>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.metaText}>No groups found.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {isFetching && !isLoading ? <Text style={styles.refresh}>Refreshing groups...</Text> : null}

        <Pressable style={styles.fab} onPress={() => navigation.navigate("CreateGroup")}>
          <Plus size={36} color="#020406" strokeWidth={2.5} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4.2), paddingTop: responsiveHeight(0.6) },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.6),
  },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F8FAFC", fontSize: 34, fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  subTitle: { color: "#A7B1C3", fontSize: 20, marginBottom: responsiveHeight(1.8) },
  listContent: { gap: responsiveHeight(1.4), paddingBottom: responsiveHeight(20) },
  groupCard: {
    backgroundColor: "#1B1F31",
    borderWidth: 1,
    borderColor: "#2B3142",
    borderRadius: 22,
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(2),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(4),
  },
  groupIconWrap: {
    width: responsiveWidth(12),
    height: responsiveWidth(12),
    borderRadius: responsiveWidth(11),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#163042",
  },
  groupTitle: { color: "#F3F6FA", fontSize: 22, fontWeight: "600" },
  groupMeta: { marginTop: responsiveHeight(0.2), color: "#9EA9BD", fontSize: 16 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: responsiveHeight(3) },
  metaText: { color: "#9EA9BD", fontSize: 16 },
  refresh: { color: "#88C4D3", textAlign: "center", marginBottom: responsiveHeight(0.5) },
  fab: {
    position: "absolute",
    right: responsiveWidth(4.5),
    bottom: responsiveHeight(13),
    width: responsiveWidth(16),
    height: responsiveWidth(16),
    borderRadius: responsiveWidth(8),
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default GroupsHomeScreen;
