import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
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
  useMadbelLeaveGroupMutation,
  useMadbelListContactsQuery,
  useMadbelRemoveGroupMemberMutation,
  useMadbelUpdateGroupMemberRoleMutation,
} from "../../redux/slices/madbelSmartflowSlice";

const GroupSettingScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const routeGroup = route?.params?.group || {};
  const groupId = routeGroup?.id || route?.params?.group_id;
  const authUser =
    useSelector((state) => state?.auth?.user) ||
    route?.params?.currentUser ||
    routeGroup?.currentUser;
  const loggedInUserId =
    authUser?._id ||
    authUser?.id ||
    authUser?.userId ||
    authUser?.user_id ||
    null;

  const [contactSearch, setContactSearch] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [addingContactId, setAddingContactId] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  const {
    data: groupResponse,
    isLoading,
    isFetching,
    refetch: refetchGroup,
  } = useMadbelGetGroupQuery({ group_id: groupId }, { skip: !groupId });
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
  const isSystemManaged = Boolean(
    group?.is_system_managed || group?.is_global_chat,
  );

  const creatorId = useMemo(() => {
    const fromGroup =
      group?.owner_user_id ||
      group?.creator_id ||
      group?.created_by ||
      group?.owner_id ||
      group?.createdBy ||
      group?.ownerId ||
      group?.user_id;
    if (fromGroup) return String(fromGroup);

    const creatorMember = members.find((member) => {
      const role = String(
        member?.role || member?.member_role || member?.type || "",
      ).toLowerCase();
      return role === "creator" || role === "owner";
    });

    return String(
      creatorMember?.user_id ||
        creatorMember?.member_id ||
        creatorMember?.id ||
        creatorMember?.contact_id ||
        "",
    );
  }, [group, members]);

  const isCurrentUserCreator = Boolean(
    creatorId &&
      loggedInUserId &&
      String(creatorId) === String(loggedInUserId),
  );
  const canLeaveGroup = Boolean(!isSystemManaged && !isCurrentUserCreator);

  const [deleteGroup, { isLoading: deleting }] =
    useMadbelDeleteGroupMutation();
  const [leaveGroup, { isLoading: leaving }] = useMadbelLeaveGroupMutation();
  const [removeMember] = useMadbelRemoveGroupMemberMutation();
  const [addMembers] = useMadbelAddGroupMembersMutation();
  const [updateMemberRole] = useMadbelUpdateGroupMemberRoleMutation();

  const initials = useMemo(
    () => (group?.name || "GR").slice(0, 2).toUpperCase(),
    [group?.name],
  );
  const memberIdsSet = useMemo(() => {
    const getId = (item) =>
      String(item?.contact_id || item?.id || item?.member_id || item?.user_id || "");
    return new Set(members.map(getId).filter(Boolean));
  }, [members]);

  const filteredContacts = useMemo(() => {
    const getId = (item) => String(item?.contact_id || item?.id || item?._id || "");
    return contacts.filter((contact) => !memberIdsSet.has(getId(contact)));
  }, [contacts, memberIdsSet]);

  const getMemberRoleLabel = (member) => {
    const role = String(
      member?.role || member?.member_role || member?.type || "",
    ).toLowerCase();
    const memberId = String(
      member?.id || member?.member_id || member?.user_id || member?.contact_id || "",
    );
    const creatorMemberId = String(creatorId || "");

    if (creatorMemberId && memberId && memberId === creatorMemberId) {
      return "CREATOR";
    }
    if (role === "creator" || role === "owner") return "CREATOR";
    if (role === "admin") return "ADMIN";
    return "MEMBER";
  };

  const canManageMembers = Boolean(isCurrentUserCreator && !isSystemManaged);

  const canRemoveMember = (member) => {
    if (!canManageMembers) return false;

    const memberId = String(
      member?.id || member?.member_id || member?.user_id || member?.contact_id || "",
    );
    const normalizedCreatorId = String(creatorId || "");
    const normalizedLoggedInId = String(loggedInUserId || "");
    const roleLabel = getMemberRoleLabel(member);

    if (!memberId) return false;
    if (normalizedLoggedInId && memberId === normalizedLoggedInId) return false;
    if (normalizedCreatorId && memberId === normalizedCreatorId) return false;
    if (roleLabel === "CREATOR") return false;
    return true;
  };

  const handleDelete = () => {
    if (!groupId) return;
    if (isSystemManaged) {
      Alert.alert(
        t("owner_controlled_membership", "Owner-controlled membership"),
        t(
          "system_global_chat_cannot_be_deleted_here",
          "This organization Global Chat is managed from the Owner Dashboard and cannot be deleted here.",
        ),
      );
      return;
    }

    Alert.alert(
      t("delete_group"),
      t("are_you_sure_you_want_to_delete_this_group"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroup({ group_id: groupId }).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error?.data?.message || "Could not delete group.",
              );
            }
          },
        },
      ],
    );
  };

  const handleLeave = async () => {
    if (!groupId) return;
    if (isSystemManaged) {
      Alert.alert(
        t("owner_controlled_membership", "Owner-controlled membership"),
        t(
          "system_global_chat_cannot_be_left_here",
          "This organization Global Chat is managed from the Owner Dashboard and cannot be left here.",
        ),
      );
      return;
    }

    Alert.alert(
      t("leave_group", "Leave Group"),
      t(
        "leave_group_confirmation_message",
        "Are you sure you want to leave this group? You will lose access to its conversations.",
      ),
      [
        { text: t("cancel", "Cancel"), style: "cancel" },
        {
          text: t("leave", "Leave"),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroup({ group_id: groupId }).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Leave failed",
                error?.data?.message || "Could not leave group.",
              );
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = async (memberId) => {
    if (!groupId || !memberId) return;
    try {
      setRemovingMemberId(memberId);
      await removeMember({ group_id: groupId, member_id: memberId }).unwrap();
      await Promise.all([refetchGroup?.(), refetchContacts?.()]);
    } catch (error) {
      Alert.alert(
        t("remove_failed", "Remove failed"),
        error?.data?.message ||
          t(
            "could_not_remove_member",
            "Could not remove member from the group.",
          ),
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRoleChange = async (member, nextRole) => {
    const memberId = String(
      member?.id || member?.member_id || member?.user_id || member?.contact_id || "",
    );
    if (!groupId || !memberId || isSystemManaged) return;

    try {
      setUpdatingRoleId(memberId);
      await updateMemberRole({
        group_id: groupId,
        member_id: memberId,
        role: nextRole,
      }).unwrap();
      await refetchGroup?.();
    } catch (error) {
      Alert.alert(
        t("update_failed", "Update failed"),
        error?.data?.message ||
          t("could_not_update_member_role", "Could not update member role."),
      );
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleAddMember = async (contact) => {
    const contactId = String(
      contact?.contact_id || contact?.id || contact?._id || "",
    ).trim();
    if (!groupId || !contactId) return;

    if (isSystemManaged) {
      Alert.alert(
        t("owner_controlled_membership", "Owner-controlled membership"),
        t(
          "system_global_chat_membership_is_managed_from_owner_dashboard",
          "This organization Global Chat membership is managed from the Owner Dashboard.",
        ),
      );
      return;
    }

    if (memberIdsSet.has(contactId)) {
      Alert.alert(
        t("already_added"),
        t("this_contact_is_already_a_member_of_the_group"),
      );
      return;
    }

    try {
      setAddingContactId(contactId);
      await addMembers({ group_id: groupId, member_ids: [contactId] }).unwrap();
      Alert.alert(
        "Member added",
        `${contact?.name || "Contact"} has been added to the group.`,
      );
      await Promise.all([refetchGroup?.(), refetchContacts?.()]);
    } catch (error) {
      Alert.alert(
        "Add failed",
        error?.data?.message || "Could not add member.",
      );
    } finally {
      setAddingContactId(null);
    }
  };

  const openRemoveConfirm = (member) => {
    if (!canRemoveMember(member)) {
      Alert.alert(
        t("not_allowed", "Not allowed"),
        t(
          "only_the_group_creator_can_remove_eligible_members",
          "Only the group creator can remove eligible members.",
        ),
      );
      return;
    }

    Alert.alert(
      t("remove_member", "Remove Member"),
      t(
        "remove_member_confirmation_message",
        "Are you sure you want to remove this member from the group? They will lose access to the group and its conversations.",
      ),
      [
        { text: t("cancel", "Cancel"), style: "cancel" },
        {
          text: t("remove", "Remove"),
          style: "destructive",
          onPress: () =>
            handleRemoveMember(
              member?.id ||
                member?.member_id ||
                member?.user_id ||
                member?.contact_id,
            ),
        },
      ],
    );
  };

  if (isLoading && !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#14C9E7" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.iconWrap}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={28} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("group_setting")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.groupCard}>
            <View style={styles.groupBadgeContainer}>
              {group?.avatar_url ? (
                <Image
                  source={{ uri: group.avatar_url }}
                  style={styles.groupAvatarImage}
                />
              ) : (
                <LinearGradient
                  colors={["#00C2FF", "#0055FF"]}
                  style={styles.groupBadge}
                >
                  <Text style={styles.groupBadgeText}>{initials}</Text>
                </LinearGradient>
              )}
              {canManageMembers ? (
                <Pressable
                  style={styles.groupBadgePen}
                  onPress={() => navigation.navigate("CreateGroup", { groupId })}
                >
                  <PenLine size={12} color="#000000" />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.groupNameRow}>
                <Text style={styles.groupName}>{group?.name || ""}</Text>
                {canManageMembers ? (
                  <Pressable
                    onPress={() => navigation.navigate("CreateGroup", { groupId })}
                  >
                    <PenLine size={16} color="#B8C4D7" />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.groupMeta}>
                {group?.member_count || members.length || 0} Members
              </Text>
              {group?.description ? (
                <Text style={styles.groupDescription}>{group.description}</Text>
              ) : null}
              {isSystemManaged ? (
                <View style={styles.ownerControlledPill}>
                  <Text style={styles.ownerControlledPillText}>
                    {t(
                      "owner_controlled_global_chat",
                      "Owner-controlled Global Chat",
                    )}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {isSystemManaged ? (
            <View style={styles.ownerControlledCard}>
              <Text style={styles.ownerControlledTitle}>
                {t("owner_controlled_membership", "Owner-controlled membership")}
              </Text>
              <Text style={styles.ownerControlledText}>
                {t(
                  "global_chat_membership_controlled_outside_community",
                  "This conversation follows organization membership from the Owner Dashboard. Users cannot add, remove, invite, leave, or delete this global chat from Community.",
                )}
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>MEMBERS ({members.length})</Text>

          {members.length === 0 && !isLoading ? (
            <View style={styles.emptyMembers}>
              <Text style={styles.emptyMembersText}>
                {t("no_members_yet_add_members_below")}
              </Text>
            </View>
          ) : null}

          {members.map((member, index) => {
            const isOnline = member.is_online;
            const isPending =
              member.is_pending || member.email === "Pending Invite";
            const mInitials = (member.name || "?").slice(0, 2).toUpperCase();
            const memberKey = String(
              member?.id || member?.member_id || member?.contact_id || "",
            );
            const isRemovingThisMember = removingMemberId === memberKey;
            const isUpdatingThisMember = updatingRoleId === memberKey;
            const removable = canRemoveMember(member);
            const roleLabel = getMemberRoleLabel(member);

            return (
              <View key={memberKey || index} style={styles.memberCard}>
                <View style={styles.memberAvatarWrap}>
                  {member.avatar_url ? (
                    <Image
                      source={{ uri: member.avatar_url }}
                      style={styles.memberAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.memberAvatar,
                        styles.memberAvatarFallback,
                        {
                          backgroundColor:
                            index % 2 === 0 ? "#7F5DFF" : "#00C2FF",
                        },
                      ]}
                    >
                      <Text style={styles.memberAvatarFallbackText}>
                        {mInitials}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.memberActiveDot,
                      { backgroundColor: isOnline ? "#22C55E" : "#6B7280" },
                    ]}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text
                    style={[styles.memberEmail, isPending && styles.pendingEmail]}
                  >
                    {isPending
                      ? "Pending Invite"
                      : member.email || member.phone || "No contact"}
                  </Text>
                  <View style={styles.memberMetaRow}>
                    <View
                      style={[
                        styles.roleBadge,
                        roleLabel === "ADMIN"
                          ? styles.adminBadge
                          : roleLabel === "CREATOR"
                            ? styles.creatorBadge
                            : styles.memberBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBadgeText,
                          roleLabel === "ADMIN"
                            ? styles.adminBadgeText
                            : roleLabel === "CREATOR"
                              ? styles.creatorBadgeText
                              : styles.memberBadgeText,
                        ]}
                      >
                        {roleLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                {canManageMembers ? (
                  <View style={styles.memberActions}>
                    {roleLabel !== "CREATOR" ? (
                      <Pressable
                        onPress={() =>
                          handleRoleChange(
                            member,
                            roleLabel === "ADMIN" ? "member" : "admin",
                          )
                        }
                        style={styles.roleActionBtn}
                        disabled={isUpdatingThisMember}
                      >
                        {isUpdatingThisMember ? (
                          <ActivityIndicator size="small" color="#9BEAFC" />
                        ) : (
                          <Text style={styles.roleActionText}>
                            {roleLabel === "ADMIN"
                              ? t("make_member", "Make Member")
                              : t("make_admin", "Make Admin")}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    {removable ? (
                      <Pressable
                        onPress={() => openRemoveConfirm(member)}
                        style={styles.removeMemberBtn}
                        disabled={isRemovingThisMember}
                      >
                        {isRemovingThisMember ? (
                          <ActivityIndicator size="small" color="#FFB7BF" />
                        ) : (
                          <Text style={styles.removeMemberText}>
                            {t("remove_member", "Remove Member")}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    {removable ? (
                      <Pressable
                        onPress={() => openRemoveConfirm(member)}
                        style={styles.moreBtn}
                        disabled={isRemovingThisMember}
                      >
                        {isRemovingThisMember ? (
                          <ActivityIndicator size="small" color="#8E9AA0" />
                        ) : (
                          <MoreVertical size={20} color="#8E9AA0" />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          {showAddSection && canManageMembers ? (
            <View style={styles.addSection}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Text style={styles.addSectionTitle}>{t("add_member")}</Text>
                <Pressable onPress={() => setShowAddSection(false)}>
                  <Text style={{ color: "#00C2FF", fontWeight: "600" }}>
                    {t("cancel")}
                  </Text>
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
              {contactsFetching ? (
                <ActivityIndicator
                  color="#14C9E7"
                  style={styles.contactsLoader}
                />
              ) : null}
              {filteredContacts.slice(0, 8).map((contact) => {
                const contactId = String(
                  contact?.contact_id || contact?.id || contact?._id || "",
                );
                const contactName = contact?.name || contact?.full_name || "Unnamed";
                const contactMeta = contact?.email || contact?.phone || "No contact";
                const isAddingThisContact = addingContactId === contactId;
                return (
                  <View key={contactId} style={styles.memberCard}>
                    {contact?.avatar_url ? (
                      <Image
                        source={{ uri: contact.avatar_url }}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View style={styles.memberAvatarFallback}>
                        <Text style={styles.memberAvatarFallbackText}>
                          {contactName.slice(0, 1).toUpperCase()}
                        </Text>
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
                <Text style={styles.emptyContacts}>
                  {t("no_addable_contacts_found")}
                </Text>
              ) : null}
            </View>
          ) : canManageMembers ? (
            <Pressable
              style={styles.addMembersBtn}
              onPress={() => setShowAddSection(true)}
            >
              <Plus size={18} color="#00D2FF" />
              <Text style={styles.addMembersText}>{t("add_members")}</Text>
            </Pressable>
          ) : null}

          {isFetching ? <Text style={styles.refresh}>{t("refreshing")}</Text> : null}
        </ScrollView>
      </View>

      <View
        style={{
          padding: responsiveWidth(4.2),
          borderTopWidth: 1,
          borderColor: "#2A3142",
          marginBottom: responsiveHeight(13),
          gap: responsiveHeight(2),
        }}
      >
        {!isSystemManaged ? (
          <>
            {canLeaveGroup ? (
              <Pressable
                style={styles.leaveBtn}
                onPress={handleLeave}
                disabled={leaving}
              >
                {leaving ? (
                  <ActivityIndicator color="#FC4C58" />
                ) : (
                  <Text style={styles.leaveText}>{t("leave_group")}</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.ownerHintCard}>
                <Text style={styles.ownerHintText}>
                  {isCurrentUserCreator
                    ? t(
                        "group_owners_cannot_leave_delete_instead",
                        "Group owners cannot leave. Delete the group if you no longer need it.",
                      )
                    : t(
                        "leave_not_available_for_this_group",
                        "Leaving is not available for this group right now.",
                      )}
                </Text>
              </View>
            )}

            {canManageMembers ? (
              <Pressable
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#F9FCFF" />
                ) : (
                  <Text style={styles.deleteText}>{t("delete_group")}</Text>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4.2) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: responsiveHeight(1.5),
  },
  iconWrap: { padding: 4 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 32 },
  content: { paddingBottom: responsiveHeight(4), gap: 12 },
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
  groupBadgeContainer: { width: 64, height: 64, position: "relative" },
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
  groupAvatarImage: { width: 64, height: 64, borderRadius: 32 },
  groupBadgeText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
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
  groupNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  groupMeta: { color: "#8E9AA0", fontSize: 13, marginTop: 4 },
  groupDescription: { color: "#AAB4C6", fontSize: 13, marginTop: 6 },
  ownerControlledPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#12303A",
  },
  ownerControlledPillText: {
    color: "#79E9FF",
    fontSize: 11,
    fontWeight: "700",
  },
  ownerControlledCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#22404B",
    backgroundColor: "#102028",
    padding: 14,
    marginBottom: 10,
  },
  ownerControlledTitle: {
    color: "#F3FAFF",
    fontSize: 14,
    fontWeight: "700",
  },
  ownerControlledText: {
    color: "#97B7C2",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
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
  memberAvatarWrap: { width: 48, height: 48, position: "relative" },
  memberAvatar: { width: 48, height: 48, borderRadius: 24 },
  memberAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  memberName: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  memberEmail: { color: "#8E9AA0", fontSize: 13, marginTop: 1 },
  pendingEmail: { color: "#6B7280", fontStyle: "italic" },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: responsiveWidth(1.2),
    marginTop: responsiveHeight(0.4),
  },
  adminBadge: { backgroundColor: "#002D3C" },
  creatorBadge: { backgroundColor: "#2E2406" },
  memberBadge: { backgroundColor: "#1F2937" },
  roleBadgeText: { fontSize: 10, fontWeight: "700" },
  adminBadgeText: { color: "#00D2FF" },
  creatorBadgeText: { color: "#F5D728" },
  memberBadgeText: { color: "#9CA3AF" },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.8),
    marginLeft: responsiveWidth(2),
  },
  roleActionBtn: {
    minHeight: responsiveHeight(3.8),
    paddingHorizontal: responsiveWidth(3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#155E75",
    backgroundColor: "#0B2832",
    alignItems: "center",
    justifyContent: "center",
  },
  roleActionText: { color: "#9BEAFC", fontSize: 12, fontWeight: "700" },
  removeMemberBtn: {
    minHeight: responsiveHeight(3.8),
    paddingHorizontal: responsiveWidth(3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7A2D36",
    backgroundColor: "#2A161B",
    alignItems: "center",
    justifyContent: "center",
  },
  removeMemberText: {
    color: "#FFB7BF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  moreBtn: { padding: 4 },
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
  addSection: { gap: 8, marginTop: 8 },
  addSectionTitle: { color: "#8E9AA0", fontSize: 13, fontWeight: "600" },
  contactsLoader: { marginTop: 4 },
  emptyContacts: {
    color: "#8C98AF",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyMembers: { paddingVertical: 20, alignItems: "center" },
  emptyMembersText: { color: "#687588", fontSize: 14 },
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
  smallBtnText: { color: "#08141C", fontWeight: "600", fontSize: 13 },
  leaveBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FC4C58",
    alignItems: "center",
    justifyContent: "center",
  },
  leaveText: { color: "#FC4C58", fontSize: 16, fontWeight: "600" },
  deleteBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FC4C58",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  ownerHintCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A3142",
    backgroundColor: "#10151F",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ownerHintText: {
    color: "#9DA8BA",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  refresh: {
    color: "#00D2FF",
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
});

export default GroupSettingScreen;
