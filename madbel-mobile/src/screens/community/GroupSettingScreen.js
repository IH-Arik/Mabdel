import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, Alert, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, PenLine, MoreVertical, Plus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useMadbelAddGroupMembersMutation,
  useMadbelDeleteGroupMutation,
  useMadbelGetGroupQuery,
  useMadbelInviteGroupMemberMutation,
  useMadbelLeaveGroupMutation,
  useMadbelListContactsQuery,
  useMadbelRemoveGroupMemberMutation,
} from "../../redux/slices/madbelApiSlice";

const GroupSettingScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const routeGroup = route?.params?.group;
  const groupId = routeGroup?.id;
  const [contactSearch, setContactSearch] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [addingContactId, setAddingContactId] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const {
    data: groupResponse,
    isLoading,
    isFetching,
    refetch: refetchGroup,
  } = useMadbelGetGroupQuery(
    { group_id: groupId },
    { skip: !groupId },
  );
  const {
    data: contactsResponse,
    isFetching: contactsFetching,
    refetch: refetchContacts,
  } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
    search: contactSearch.trim() || undefined,
  });
  const group = groupResponse?.data || routeGroup;
  const members = group?.members || [];
  const contacts = contactsResponse?.data?.items || [];

  const [deleteGroup, { isLoading: deleting }] = useMadbelDeleteGroupMutation();
  const [leaveGroup, { isLoading: leaving }] = useMadbelLeaveGroupMutation();
  const [removeMember, { isLoading: removing }] = useMadbelRemoveGroupMemberMutation();
  const [addMembers] = useMadbelAddGroupMembersMutation();

  const initials = useMemo(() => (group?.name || "GR").slice(0, 2).toUpperCase(), [group?.name]);
  const memberIdsSet = useMemo(() => {
    const getId = (item) => String(item?.contact_id || item?.id || item?.member_id || item?.user_id || "");
    return new Set(members.map(getId).filter(Boolean));
  }, [members]);
  const filteredContacts = useMemo(() => {
    const getId = (item) => String(item?.contact_id || item?.id || item?._id || "");
    return contacts.filter((contact) => !memberIdsSet.has(getId(contact)));
  }, [contacts, memberIdsSet]);

  const handleDelete = () => {
    if (!groupId) return;
    Alert.alert(t("delete_group"), t("are_you_sure_you_want_to_delete_this_group"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGroup({ group_id: groupId }).unwrap();
            navigation.goBack();
          } catch (error) {
            Alert.alert("Delete failed", error?.data?.message || "Could not delete group.");
          }
        },
      },
    ]);
  };

  const handleLeave = async () => {
    if (!groupId) return;
    try {
      await leaveGroup({ group_id: groupId }).unwrap();
      navigation.goBack();
    } catch (error) {
      Alert.alert("Leave failed", error?.data?.message || "Could not leave group.");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!groupId || !memberId) return;
    try {
      setRemovingMemberId(memberId);
      await removeMember({ group_id: groupId, member_id: memberId }).unwrap();
      await refetchGroup?.();
    } catch (error) {
      Alert.alert("Remove failed", error?.data?.message || "Could not remove member.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleAddMember = async (contact) => {
    const contactId = String(contact?.contact_id || contact?.id || contact?._id || "").trim();
    if (!groupId || !contactId) return;
    if (memberIdsSet.has(contactId)) {
      Alert.alert(t("already_added"), t("this_contact_is_already_a_member_of_the_group"));
      return;
    }
    try {
      setAddingContactId(contactId);
      await addMembers({ group_id: groupId, member_ids: [contactId] }).unwrap();
      Alert.alert("Member added", `${contact?.name || "Contact"} has been added to the group.`);
      await Promise.all([refetchGroup?.(), refetchContacts?.()]);
    } catch (error) {
      Alert.alert("Add failed", error?.data?.message || "Could not add member.");
    } finally {
      setAddingContactId(null);
    }
  };

  if (isLoading && !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color="#14C9E7" size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("group_setting")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.groupCard}>
            <View style={styles.groupBadgeContainer}>
              {group?.avatar_url ? (
                <Image source={{ uri: group.avatar_url }} style={styles.groupAvatarImage} />
              ) : (
                <LinearGradient
                  colors={["#00C2FF", "#0055FF"]}
                  style={styles.groupBadge}
                >
                  <Text style={styles.groupBadgeText}>{initials}</Text>
                </LinearGradient>
              )}
              <Pressable style={styles.groupBadgePen} onPress={() => navigation.navigate("CreateGroup", { groupId })}>
                <PenLine size={12} color="#000000" />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupName}>{group?.name || ""}</Text>
                <Pressable onPress={() => navigation.navigate("CreateGroup", { groupId })}>
                  <PenLine size={16} color="#B8C4D7" />
                </Pressable>
              </View>
              <Text style={styles.groupMeta}>{group?.member_count || members.length || 0} Members</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>MEMBERS ({members.length})</Text>

          {members.length === 0 && !isLoading && (
            <View style={styles.emptyMembers}>
              <Text style={styles.emptyMembersText}>{t("no_members_yet_add_members_below")}</Text>
            </View>
          )}

          {members.map((member, index) => {
            const isOnline = member.is_online;
            const role = member.role || "MEMBER";
            const isPending = member.is_pending || member.email === "Pending Invite";
            const mInitials = member.initials || (member.name || "?").slice(0, 2).toUpperCase();
            const memberKey = String(member?.id || member?.member_id || member?.contact_id || "");
            const isRemovingThisMember = removingMemberId === memberKey;

            const handlePressOptions = () => {
              Alert.alert(
                "Remove Member",
                `Are you sure you want to remove ${member.name} from the group?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => handleRemoveMember(memberKey || member.id),
                  },
                ]
              );
            };

            return (
              <View key={memberKey || index} style={styles.memberCard}>
                <View style={styles.memberAvatarWrap}>
                  {member.avatar_url ? (
                    <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarFallback, { backgroundColor: index % 2 === 0 ? "#7F5DFF" : "#00C2FF" }]}>
                      <Text style={styles.memberAvatarFallbackText}>{mInitials}</Text>
                    </View>
                  )}
                  <View style={[styles.memberActiveDot, { backgroundColor: isOnline ? "#22C55E" : "#6B7280" }]} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={[styles.memberEmail, isPending && styles.pendingEmail]}>
                    {isPending ? "Pending Invite" : (member.email || member.phone || "No contact")}
                  </Text>
                  <View style={[styles.roleBadge, role.toUpperCase() === "ADMIN" ? styles.adminBadge : styles.memberBadge]}>
                    <Text style={[styles.roleBadgeText, role.toUpperCase() === "ADMIN" ? styles.adminBadgeText : styles.memberBadgeText]}>
                      {role.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={handlePressOptions} style={styles.moreBtn} disabled={isRemovingThisMember}>
                  {isRemovingThisMember ? (
                    <ActivityIndicator size="small" color="#8E9AA0" />
                  ) : (
                    <MoreVertical size={20} color="#8E9AA0" />
                  )}
                </Pressable>
              </View>
            );
          })}

          {showAddSection ? (
            <View style={styles.addSection}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={styles.addSectionTitle}>{t("add_member")}</Text>
                <Pressable onPress={() => setShowAddSection(false)}>
                  <Text style={{ color: "#00C2FF", fontWeight: "600" }}>{t("cancel")}</Text>
                </Pressable>
              </View>
              <TextInput
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder={t("search_contacts_by_name_or_email")}
                placeholderTextColor="#7F8AA1"
                style={styles.input}
                autoCapitalize="none"
              />
              {contactsFetching ? <ActivityIndicator color="#14C9E7" style={styles.contactsLoader} /> : null}
              {filteredContacts.slice(0, 8).map((contact) => {
                const contactId = String(contact?.contact_id || contact?.id || contact?._id || "");
                const contactName = contact?.name || contact?.full_name || "Unnamed";
                const contactMeta = contact?.email || contact?.phone || "No contact";
                const isAddingThisContact = addingContactId === contactId;
                return (
                  <View key={contactId} style={styles.memberCard}>
                    {contact?.avatar_url ? (
                      <Image source={{ uri: contact.avatar_url }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarFallback}>
                        <Text style={styles.memberAvatarFallbackText}>{contactName.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{contactName}</Text>
                      <Text style={styles.memberEmail}>{contactMeta}</Text>
                    </View>
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => handleAddMember(contact)}
                      disabled={Boolean(addingContactId)}
                    >
                      {isAddingThisContact ? (
                        <ActivityIndicator color="#EAF5FB" size="small" />
                      ) : (
                        <Text style={styles.smallBtnText}>{t("add")}</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}

              {!contactsFetching && filteredContacts.length === 0 ? (
                <Text style={styles.emptyContacts}>{t("no_addable_contacts_found")}</Text>
              ) : null}
            </View>
          ) : (
            <Pressable style={styles.addMembersBtn} onPress={() => setShowAddSection(true)}>
              <Plus size={18} color="#00D2FF" />
              <Text style={styles.addMembersText}>{t("add_members")}</Text>
            </Pressable>
          )}

          {isFetching ? <Text style={styles.refresh}>{t("refreshing")}</Text> : null}
        </ScrollView>
      </View>
      <View style={{ padding: responsiveWidth(4.2), borderTopWidth: 1, borderColor: "#2A3142" , marginBottom: responsiveHeight(13) , gap: responsiveHeight(2)}}>
         <Pressable style={styles.leaveBtn} onPress={handleLeave} disabled={leaving}>
            {leaving ? <ActivityIndicator color="#FC4C58" /> : <Text style={styles.leaveText}>{t("leave_group")}</Text>}
          </Pressable>

          <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#F9FCFF" /> : <Text style={styles.deleteText}>{t("delete_group")}</Text>}
          </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.2),
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: responsiveHeight(1.5),
  },
  iconWrap: {
    padding: 4,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    paddingBottom: responsiveHeight(4),
    gap: 12,
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#20242F",
    backgroundColor: "#161B26",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  groupBadgeContainer: {
    width: 64,
    height: 64,
    position: "relative",
  },
  groupBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#00D2FF",
  },
  groupAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  groupBadgeText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  groupBadgePen: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#00D2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#161B26",
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  groupMeta: {
    color: "#8E9AA0",
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  memberCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#20242F",
    backgroundColor: "#161B26",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  memberAvatarWrap: {
    width: 48,
    height: 48,
    position: "relative",
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  memberActiveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#161B26",
    position: "absolute",
    right: -1,
    bottom: -1,
  },
  memberName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  memberEmail: {
    color: "#8E9AA0",
    fontSize: 13,
    marginTop: 1,
  },
  pendingEmail: {
    color: "#6B7280",
    fontStyle: "italic",
  },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: "#002D3C",
  },
  memberBadge: {
    backgroundColor: "#1F2937",
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  adminBadgeText: {
    color: "#00D2FF",
  },
  memberBadgeText: {
    color: "#9CA3AF",
  },
  moreBtn: {
    padding: 4,
  },
  addMembersBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#00D2FF",
    borderRadius: 16,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  addMembersText: {
    color: "#00D2FF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 6,
  },
  addSection: {
    gap: 8,
    marginTop: 8,
  },
  addSectionTitle: {
    color: "#8E9AA0",
    fontSize: 13,
    fontWeight: "600",
  },
  contactsLoader: {
    marginTop: 4,
  },
  emptyContacts: {
    color: "#8C98AF",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyMembers: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyMembersText: {
    color: "#687588",
    fontSize: 14,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#20242F",
    backgroundColor: "#0E1116",
    color: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 15,
  },
  smallBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00D2FF",
  },
  smallBtnText: {
    color: "#08141C",
    fontWeight: "600",
    fontSize: 13,
  },
  leaveBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FC4C58",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveText: {
    color: "#FC4C58",
    fontSize: 16,
    fontWeight: "600",
  },
  deleteBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FC4C58",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  refresh: {
    color: "#00D2FF",
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
});

export default GroupSettingScreen;
