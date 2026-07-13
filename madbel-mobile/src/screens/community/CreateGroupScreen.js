import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, Search, X } from "lucide-react-native";
import { useForm } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import {
  useMadbelCreateGroupSmartFlowMutation,
  useMadbelGetGroupQuery,
  useMadbelListContactsQuery,
  useMadbelSearchAppUsersQuery,
  useMadbelUpdateGroupMutation,
} from "../../redux/slices/madbelSmartflowSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const DEBOUNCE_MS = 350;

const CreateGroupScreen = () => {
  const appLanguage = useAppLanguage();
  const t = appLanguage?.t || ((key) => key);
  const navigation = useNavigation();
  const route = useRoute();
  const groupId = route?.params?.groupId || null;
  const isEditMode = Boolean(groupId);
  const tr = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const { control, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      groupName: "",
      description: "",
      memberSearch: "",
    },
  });

  const [createGroup, { isLoading: creating }] =
    useMadbelCreateGroupSmartFlowMutation();
  const [updateGroup, { isLoading: updating }] =
    useMadbelUpdateGroupMutation();
  const { data: existingGroupResponse } = useMadbelGetGroupQuery(
    { group_id: groupId },
    { skip: !groupId },
  );
  const existingGroup = existingGroupResponse?.data || null;

  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const selectedUsersCache = useRef({});

  const memberSearch = watch("memberSearch");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeoutId = setTimeout(
      () => setDebouncedSearch(memberSearch || ""),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [memberSearch]);

  const { data: contactsResponse } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
    search: debouncedSearch.trim() || undefined,
  });
  const { data: usersResponse, isFetching: usersFetching } =
    useMadbelSearchAppUsersQuery({
      q: debouncedSearch,
      page: 1,
      page_size: 50,
    });

  const appUsers = useMemo(() => {
    const source = usersResponse?.data?.items || contactsResponse?.data?.items || [];
    return source
      .map((user) => {
        const id = String(user?.id || user?._id || user?.contact_id || "").trim();
        if (!id) return null;
        const name = user?.name || user?.full_name || user?.fullName || "Unnamed";
        return {
          ...user,
          id,
          name,
          initials: user?.initials || name.slice(0, 2).toUpperCase(),
        };
      })
      .filter(Boolean);
  }, [contactsResponse?.data?.items, usersResponse?.data?.items]);

  useEffect(() => {
    appUsers.forEach((user) => {
      selectedUsersCache.current[String(user.id)] = user;
    });
  }, [appUsers]);

  useEffect(() => {
    if (!existingGroup) return;

    reset({
      groupName: existingGroup.name || "",
      description: existingGroup.description || "",
      memberSearch: "",
    });

    const members = Array.isArray(existingGroup.members)
      ? existingGroup.members
      : [];
    members.forEach((member) => {
      selectedUsersCache.current[member.id] = {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar_url: member.avatar_url,
        initials: (member.name || "?").slice(0, 2).toUpperCase(),
      };
    });
    setSelectedMemberIds(
      members
        .map((member) => String(member?.id || member?._id || member?.contact_id || "").trim())
        .filter(Boolean),
    );
  }, [existingGroup, reset]);

  const selectedMembers = useMemo(
    () =>
      selectedMemberIds
        .map((id) => selectedUsersCache.current[id])
        .filter(Boolean),
    [selectedMemberIds, appUsers],
  );

  const toggleMember = (id) => {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) return;
    setSelectedMemberIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((item) => item !== normalizedId)
        : [...prev, normalizedId],
    );
  };

  const onSubmit = async (data) => {
    const name = (data.groupName || "").trim();
    const description = (data.description || "").trim();

    if (!name) {
      Alert.alert(
        tr("missing_name", "Missing name"),
        tr("please_enter_a_group_name", "Please enter a group name."),
      );
      return;
    }

    if (!isEditMode && selectedMemberIds.length === 0) {
      Alert.alert(
        tr("no_members", "No members"),
        tr(
          "add_at_least_one_member_to_create_a_group",
          "Add at least one member to create a group.",
        ),
      );
      return;
    }

    try {
      if (isEditMode) {
        const response = await updateGroup({
          group_id: groupId,
          name,
          description: description || "",
        }).unwrap();
        navigation.replace("GroupSetting", {
          group: response?.data || existingGroup,
        });
        return;
      }

      const response = await createGroup({
        name,
        description: description || undefined,
        member_ids: selectedMemberIds,
      }).unwrap();
      const createdGroup = response?.data || response;
      navigation.replace("GroupChat", {
        group_id: createdGroup.id,
        group: createdGroup,
      });
    } catch (error) {
      Alert.alert(
        tr("save_failed", "Save failed"),
        error?.data?.message ||
          (isEditMode
            ? tr("could_not_update_group", "Could not update group.")
            : tr("could_not_create_group", "Could not create group.")),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.iconWrap}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={34} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditMode
              ? tr("edit_group", "Edit Group")
              : tr("create_group", "Create Group")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <ControllerTextInput
            name="groupName"
            control={control}
            label={tr("group_name", "Group Name")}
            placeholder={tr("enter_group_name", "Enter group name...")}
            placeholderTextColor="#6F7C95"
            labelStyle={styles.label}
            inputStyle={styles.input}
          />

          <ControllerTextInput
            name="description"
            control={control}
            label={tr("description", "Description")}
            placeholder={tr(
              "enter_group_description",
              "Enter group description...",
            )}
            placeholderTextColor="#6F7C95"
            labelStyle={styles.label}
            inputStyle={styles.input}
          />

          {!isEditMode ? (
            <>
              <View style={styles.membersHeader}>
                <Text style={styles.label}>{tr("members", "Members")}</Text>
                <Text style={styles.selectedCount}>
                  {selectedMemberIds.length} {tr("selected", "Selected")}
                </Text>
              </View>

              {selectedMembers.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectedChipsRow}
                  contentContainerStyle={styles.selectedChipsContent}
                >
                  {selectedMembers.map((member) => (
                    <Pressable
                      key={member.id}
                      style={styles.selectedChip}
                      onPress={() => toggleMember(member.id)}
                    >
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: member.avatar_url }}
                          style={styles.selectedChipAvatar}
                        />
                      ) : (
                        <View style={styles.selectedChipAvatarFallback}>
                          <Text style={styles.selectedChipInitials}>
                            {member.initials || "?"}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={styles.selectedChipName}
                        numberOfLines={1}
                      >
                        {member.name || tr("user", "User")}
                      </Text>
                      <X size={14} color="#9AA7BE" />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <ControllerTextInput
                name="memberSearch"
                control={control}
                placeholder={tr(
                  "search_by_name_or_email",
                  "Search by name or email...",
                )}
                placeholderTextColor="#6F7C95"
                inputStyle={[styles.input, styles.searchInput]}
                leftIcon={<Search size={24} color="#9AA7BE" />}
              />

              {usersFetching ? (
                <ActivityIndicator
                  color="#14C9E7"
                  style={{ marginVertical: 6 }}
                />
              ) : null}

              <View style={styles.memberList}>
                {appUsers.map((member) => {
                  const selected = selectedMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      style={[
                        styles.memberChip,
                        selected && styles.memberChipSelected,
                      ]}
                      onPress={() => toggleMember(member.id)}
                    >
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: member.avatar_url }}
                          style={styles.memberAvatar}
                        />
                      ) : (
                        <View style={styles.memberAvatarFallback}>
                          <Text style={styles.memberAvatarFallbackText}>
                            {member.initials || "?"}
                          </Text>
                        </View>
                      )}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {member.name || tr("unnamed", "Unnamed")}
                        </Text>
                        {member.email ? (
                          <Text
                            style={styles.memberEmail}
                            numberOfLines={1}
                          >
                            {member.email}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? (
                        <X size={20} color="#14C9E7" />
                      ) : (
                        <Text style={styles.addText}>{tr("add", "Add")}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <VoiceFormFillCard
            label={tr("group", "Group")}
            workflowIntent="group"
            sourceScreen="CreateGroup"
          />

          <View style={{ height: responsiveHeight(10) }} />
        </ScrollView>

        <Pressable
          style={styles.createBtn}
          onPress={handleSubmit(onSubmit)}
          disabled={creating || updating}
        >
          {creating || updating ? (
            <ActivityIndicator color="#EAF5FB" />
          ) : (
            <Text style={styles.createText}>
              {isEditMode ? tr("save", "Save") : tr("create", "Create")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.2),
    paddingTop: responsiveHeight(0.6),
    paddingBottom: responsiveHeight(2.2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.6),
  },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F8FAFC", fontSize: 34, fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  content: { gap: responsiveHeight(1.2), paddingBottom: responsiveHeight(2) },
  label: { color: "#C2CCDA", marginBottom: responsiveHeight(0.4) },
  input: {
    borderWidth: 1,
    borderColor: "#1E273A",
    backgroundColor: "#121725",
    color: "#E9EEF4",
    paddingHorizontal: responsiveWidth(4.8),
  },
  membersHeader: {
    marginTop: responsiveHeight(0.5),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedCount: { color: "#14C9E7", fontSize: 16, fontWeight: "500" },
  searchInput: { paddingLeft: responsiveWidth(10) },
  memberList: { marginTop: responsiveHeight(0.8), gap: responsiveHeight(1) },
  memberChip: {
    minHeight: responsiveHeight(6.9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374051",
    backgroundColor: "#1A2128",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(3),
    gap: responsiveWidth(3),
  },
  memberChipSelected: { borderColor: "#14C9E7", backgroundColor: "#132635" },
  memberAvatar: {
    width: responsiveWidth(10),
    height: responsiveWidth(10),
    borderRadius: responsiveWidth(5),
  },
  memberAvatarFallback: {
    width: responsiveWidth(10),
    height: responsiveWidth(10),
    borderRadius: responsiveWidth(5),
    backgroundColor: "#173041",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarFallbackText: { color: "#86E8FC", fontWeight: "700" },
  memberName: { color: "#E8EDF3", fontSize: 18 },
  addText: { color: "#14C9E7", fontWeight: "600" },
  memberInfo: { flex: 1 },
  memberEmail: { color: "#6B8499", fontSize: 13, marginTop: 2 },
  selectedChipsRow: { marginBottom: responsiveHeight(1) },
  selectedChipsContent: {
    gap: responsiveWidth(2),
    paddingRight: responsiveWidth(2),
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.5),
    backgroundColor: "#132635",
    borderWidth: 1,
    borderColor: "#14C9E7",
    borderRadius: 999,
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(0.6),
    maxWidth: responsiveWidth(40),
  },
  selectedChipAvatar: { width: 24, height: 24, borderRadius: 12 },
  selectedChipAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#173041",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedChipInitials: { color: "#86E8FC", fontWeight: "700", fontSize: 11 },
  selectedChipName: {
    color: "#D4EEF6",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  createBtn: {
    minHeight: responsiveHeight(8.1),
    borderRadius: 20,
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: responsiveHeight(8.1),
  },
  createText: { color: "#EAF5FB", fontSize: 26, fontWeight: "600" },
});

export default CreateGroupScreen;
