import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useMadbelListContactsQuery } from "../../redux/slices/madbelApiSlice";

const ContactsScreen = () => {
  const navigation = useNavigation();
  const [query, setQuery] = useState("");

  const {
    data: contactsResponse,
    isLoading,
    isFetching,
    error,
  } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
    search: query.trim() || undefined,
  });



  const contactsData = contactsResponse?.data;
  const contacts = contactsData?.items || [];
  const summary = contactsData?.summary;

  const filteredContacts = useMemo(() => contacts, [contacts]);

  const goToContact = (contact) => {
    navigation.navigate("AddContact", { contact });
  };

  const renderContact = ({ item }) => (
    <Pressable style={styles.contactCard} onPress={() => goToContact(item)}>
      <View style={styles.avatarWrap}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.initialAvatar}>
            <Text style={styles.initialText}>{item.initials || "?"}</Text>
          </View>
        )}
        {item.is_online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.contactContent}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.contactSubtitle} numberOfLines={1}>
          {item.primary_detail || item.phone || item.email || "No details"}
        </Text>
      </View>

      <ChevronRight size={28} color="#93DBEA" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color="#F3F9FF" />
          </Pressable>
          <Text style={styles.headerTitle}>Contacts</Text>
          <View style={styles.headerSpace} />
        </View>

        <View style={styles.searchWrap}>
          <Search size={31 / 1.6} color="#8FC9D7" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search contacts..."
            placeholderTextColor="#7FA6B3"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            Total: {summary?.total_contacts ?? filteredContacts.length}
          </Text>
          <Text style={styles.summaryText}>
            Online: {summary?.online_contacts ?? 0}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#12D0ED" size="large" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>Could not load contacts.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={styles.stateText}>
                  {query.trim() ? "No contacts match your search." : "No contacts yet."}
                </Text>
              </View>
            }
          />
        )}

        {isFetching && !isLoading ? (
          <Text style={styles.refreshText}>Refreshing contacts...</Text>
        ) : null}

        <Pressable style={styles.fab} onPress={() => navigation.navigate("AddContact")}>
          <Plus size={38} color="#E8FDFF" strokeWidth={2.1} />
        </Pressable>
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
    backgroundColor: "#020406",
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
  },
  headerTitle: {
    color: "#F4FAFF",
    fontSize: responsiveWidth(8.5),
    fontWeight: "700",
  },
  headerSpace: {
    width: 38,
    height: 38,
  },
  searchWrap: {
    height: 74,
    borderRadius: 24,
    backgroundColor: "#1B1B1F",
    borderWidth: 1,
    borderColor: "#283544",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: responsiveHeight(1.2),
  },
  searchInput: {
    flex: 1,
    color: "#CFE6EE",
    fontSize: 27 / 1.6,
    marginLeft: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.2),
  },
  summaryText: {
    color: "#8FC9D7",
    fontSize: 13,
  },
  listContent: {
    gap: 12,
    paddingBottom: responsiveHeight(14),
  },
  contactCard: {
    minHeight: 118,
    borderRadius: 22,
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2C3744",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  initialAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: "#1D7488",
    backgroundColor: "#1B2F3A",
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    color: "#10CFEB",
    fontSize: 30,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    right: 2,
    bottom: 6,
    backgroundColor: "#2DDD60",
    borderWidth: 2,
    borderColor: "#1D1D21",
  },
  contactContent: {
    flex: 1,
    justifyContent: "center",
  },
  contactName: {
    color: "#F5F9FF",
    fontSize: 29 / 1.6,
    fontWeight: "600",
  },
  contactSubtitle: {
    color: "#88C6D4",
    fontSize: 24 / 1.6,
    marginTop: 4,
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveHeight(10),
  },
  stateText: {
    color: "#95A4B9",
    fontSize: 16,
    textAlign: "center",
  },
  refreshText: {
    color: "#7FA6B3",
    textAlign: "center",
    marginTop: responsiveHeight(0.8),
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    right: responsiveWidth(6),
    bottom: responsiveHeight(8),
    width: 64,
    height: 64,
    borderRadius: 42,
    backgroundColor: "#12D0ED",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#12D0ED",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});

export default ContactsScreen;
