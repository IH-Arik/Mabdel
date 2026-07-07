import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SectionList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, ChevronRight, Plus, Search, UserRoundPlus, Phone } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useMadbelListContactsQuery, useMadbelCreateOutboundCallMutation } from "../../redux/slices/madbelApiSlice";
import PhoneContactsImportModal from "../../components/PhoneContactsImportModal";

const ContactsScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [callingId, setCallingId] = useState(null);
  const [createOutboundCall] = useMadbelCreateOutboundCallMutation();

  const handleCall = async (contact) => {
    if (!contact.phone) {
      Alert.alert(t("no_phone_number"), `${contact.name} ${t("has_no_phone_number_saved")}`);
      return;
    }
    const contactId = contact.id || contact._id || contact.contact_id;
    setCallingId(contactId);
    try {
      await createOutboundCall({ contact_id: contactId }).unwrap();
      Alert.alert(t("call_started"), t("calling_contact", { name: contact.name, phone: contact.phone }));
    } catch (e) {
      Alert.alert(
        t("call_failed"),
        e?.data?.message || t("could_not_start_the_call_make_sure_your_twilio_is_set_up_in_account_settings"),
      );
    } finally {
      setCallingId(null);
    }
  };

  const {
    data: contactsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
    search: query.trim() || undefined,
  });



  const contactsData = contactsResponse?.data;
  const contacts = contactsData?.items || [];
  const summary = contactsData?.summary;

  const sections = useMemo(() => {
    const onApp = contacts.filter((c) => c.is_app_user);
    const invite = contacts.filter((c) => !c.is_app_user);
    const result = [];
    if (onApp.length > 0) result.push({ title: t("on_mabdel"), data: onApp });
    if (invite.length > 0) result.push({ title: t("invite_to_mabdel"), data: invite });
    return result;
  }, [contacts, t]);

  const goToContact = (contact) => {
    navigation.navigate("AddContact", { contact });
  };

  const handleInvite = (contact) => {
    const via = contact.phone || contact.email || "";
    Alert.alert(
      t("invite_to_mabdel"),
      t("send_an_invite_to_contact", { name: contact.name, via: via ? ` (${via})` : "" }),
      [{ text: t("cancel"), style: "cancel" }, { text: t("invite"), onPress: () => {} }],
    );
  };

  const renderContact = ({ item }) => {
    const isCalling = callingId === (item.id || item._id || item.contact_id);
    return (
      <Pressable style={styles.contactCard} onPress={() => goToContact(item)}>
        <View style={styles.avatarWrap}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.initialAvatar, !item.is_app_user && styles.initialAvatarMuted]}>
              <Text style={[styles.initialText, !item.is_app_user && styles.initialTextMuted]}>
                {item.initials || "?"}
              </Text>
            </View>
          )}
          {item.is_online ? <View style={styles.onlineDot} /> : null}</View>

        <View style={styles.contactContent}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
            {item.is_app_user && (
              <View style={styles.appBadge}>
                <Text style={styles.appBadgeText}>{t("mabdel")}</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactSubtitle} numberOfLines={1}>
            {item.phone || t("no_phone")}
          </Text>
          <Text style={[styles.contactSubtitle, { opacity: item.email ? 1 : 0.45 }]} numberOfLines={1}>
            {item.email || t("no_email")}
          </Text>
        </View>

        <View style={styles.actionCol}>
          {!item.is_app_user && (
            <Pressable style={styles.inviteBtn} onPress={() => handleInvite(item)} hitSlop={8}>
              <Text style={styles.inviteBtnText}>{t("invite")}</Text>
            </Pressable>
          )}
          {item.phone && (
            <Pressable
              style={styles.callBtn}
              onPress={() => handleCall(item)}
              disabled={isCalling}
              hitSlop={8}
            >
              {isCalling ? (
                <ActivityIndicator size="small" color="#12D0ED" />
              ) : (
                <Phone size={18} color="#12D0ED" />
              )}
            </Pressable>
          )}
          {item.phone && (
            <Text style={styles.callNumText} numberOfLines={1}>{item.phone}</Text>
          )}
        </View>

        <ChevronRight size={22} color="#93DBEA" />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color="#F3F9FF" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("contacts")}</Text>
          <Pressable
            onPress={() => setImportModalVisible(true)}
            style={styles.importIconBtn}
          >
            <UserRoundPlus size={24} color="#12D0ED" />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Search size={31 / 1.6} color="#8FC9D7" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search_contacts")}
            placeholderTextColor="#7FA6B3"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {t("total")}: {summary?.total_contacts ?? contacts.length}
          </Text>
          <Text style={styles.summaryText}>
            {t("online")}: {summary?.online_contacts ?? 0}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#12D0ED" size="large" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{t("could_not_load_contacts")}</Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderContact({ item })}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={styles.stateText}>{query.trim() ? t("no_contacts_match_your_search") : t("no_contacts_yet")}</Text>
              </View>
            }
          />
        )}

        {isFetching && !isLoading ? (
          <Text style={styles.refreshText}>{t("refreshing_contacts")}</Text>
        ) : null}

        <Pressable style={styles.fab} onPress={() => navigation.navigate("AddContact")}>
          <Plus size={38} color="#E8FDFF" strokeWidth={2.1} />
        </Pressable>
      </View>

      <PhoneContactsImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImported={refetch}
      />
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
  importIconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: responsiveHeight(1),
    paddingHorizontal: 4,
    marginTop: responsiveHeight(1.2),
    marginBottom: responsiveHeight(0.4),
  },
  sectionTitle: {
    color: "#12D0ED",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionCount: {
    color: "#4A7A87",
    fontSize: 13,
    fontWeight: "500",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  appBadge: {
    backgroundColor: "#0C2E39",
    borderWidth: 1,
    borderColor: "#12D0ED55",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  appBadgeText: {
    color: "#12D0ED",
    fontSize: 10,
    fontWeight: "600",
  },
  initialAvatarMuted: {
    borderColor: "#2A3A42",
    backgroundColor: "#161E22",
  },
  initialTextMuted: {
    color: "#4A7080",
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0E2830",
    borderWidth: 1,
    borderColor: "#12D0ED33",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A4A5A",
    backgroundColor: "#111B22",
    marginRight: 4,
  },
  inviteBtnText: {
    color: "#7BBDCC",
    fontSize: 13,
    fontWeight: "600",
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
    borderRadius: 18,
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2C3744",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  initialAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "#1D7488",
    backgroundColor: "#1B2F3A",
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: {
    color: "#10CFEB",
    fontSize: 20,
    fontWeight: "700",
  },
  actionCol: {
    alignItems: "center",
    gap: 4,
  },
  callNumText: {
    color: "#5B9BAA",
    fontSize: 10,
    maxWidth: 72,
    textAlign: "center",
  },
  onlineDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    right: 1,
    bottom: 2,
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
    fontSize: 15,
    fontWeight: "600",
  },
  contactSubtitle: {
    color: "#88C6D4",
    fontSize: 12,
    marginTop: 2,
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
