import React, { useMemo, useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, Camera, Search, X, UserPlus } from "lucide-react-native";
import { useForm } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import {
  useMadbelCreateGroupSmartFlowMutation,
  useMadbelGetGroupQuery,
  useMadbelSearchAppUsersQuery,
  useMadbelUpdateGroupMutation,
} from "../../redux/slices/madbelApiSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const DEBOUNCE_MS = 350;

const CreateGroupScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const editingGroupId = route?.params?.groupId || route?.params?.group?.id;
  const isEditMode = Boolean(editingGroupId);

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      groupName: route?.params?.group?.name || "",
      memberSearch: "",
      avatarUrl: route?.params?.group?.avatar_url || "",
      description: route?.params?.group?.description || "",
    },
  });

  const { data: groupResponse, isFetching: loadingGroup } = useMadbelGetGroupQuery(
    { group_id: editingGroupId },
    { skip: !editingGroupId },
  );
  const [createGroup, { isLoading: creating }] = useMadbelCreateGroupSmartFlowMutation();
  const [updateGroup, { isLoading: updating }] = useMadbelUpdateGroupMutation();

  const group = groupResponse?.data;
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  // Cache user objects for selected members so chips persist across search changes
  const selectedUsersCache = useRef({});

  useEffect(() => {
    if (!group) return;
    setValue("groupName", group.name || "");
    setValue("avatarUrl", group.avatar_url || "");
    setValue("description", group.description || "");
    setSelectedMemberIds(group.member_ids || []);
  }, [group, setValue]);

  const memberSearch = watch("memberSearch");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(memberSearch || ""), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const { data: usersResponse, isFetching: usersFetching } = useMadbelSearchAppUsersQuery(
    { q: debouncedSearch, page: 1, page_size: 50 },
  );
  const appUsers = usersResponse?.data?.items || [];

  // Keep cache up to date as search results arrive
  useEffect(() => {
    appUsers.forEach((u) => { selectedUsersCache.current[u.id] = u; });
  }, [appUsers]);

  // appUsers in deps forces recompute when cache updates (fixes edit-mode race condition)
  const selectedMembers = useMemo(
    () => selectedMemberIds.map((id) => selectedUsersCache.current[id]).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedMemberIds, appUsers],
  );

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const onSubmit = async (data) => {
    const name = (data.groupName || "").trim();
    if (!name) {
      Alert.alert("Missing name", "Please enter a group name.");
      return;
    }
    if (!isEditMode && selectedMemberIds.length === 0) {
      Alert.alert("No members", "Add at least one member to create a group.");
      return;
    }
    const payload = {
      name,
      avatar_url: (data.avatarUrl || "").trim() || undefined,
      description: (data.description || "").trim() || undefined,
      member_ids: selectedMemberIds,
    };
    try {
      const response = isEditMode
        ? await updateGroup({ group_id: editingGroupId, ...payload }).unwrap()
        : await createGroup(payload).unwrap();
      const saved = response?.data;
      navigation.replace("GroupSetting", { group: saved });
    } catch (error) {
      Alert.alert("Save failed", error?.data?.message || "Could not save group.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={34} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditMode ? "Edit Group" : "Create Group"}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {(loadingGroup && isEditMode) ? (
          <View style={styles.center}><ActivityIndicator color="#14C9E7" size="large" /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.avatarWrap}>
              <View style={styles.groupAvatar}>
                {watch("avatarUrl") ? (
                  <Image source={{ uri: watch("avatarUrl") }} style={styles.groupAvatarImage} />
                ) : (
                  <UserPlus size={45} color="#149CC0" />
                )}
              </View>
              <View style={styles.cameraFab}>
                <Camera size={20} color="#EFF8FC" />
              </View>
            </View>

            <ControllerTextInput
              name="groupName"
              control={control}
              label="Group Name"
              placeholder="Enter group name..."
              placeholderTextColor="#6F7C95"
              labelStyle={styles.label}
              inputStyle={styles.input}
            />
            <ControllerTextInput
              name="avatarUrl"
              control={control}
              label="Group Image URL (Images API)"
              placeholder="https://...image.jpg"
              placeholderTextColor="#6F7C95"
              labelStyle={styles.label}
              inputStyle={styles.input}
            />
            <ControllerTextInput
              name="description"
              control={control}
              label="Description"
              placeholder="Write description..."
              placeholderTextColor="#6F7C95"
              labelStyle={styles.label}
              inputStyle={styles.input}
              multiline
            />

            <View style={styles.membersHeader}>
              <Text style={styles.label}>Members</Text>
              <Text style={styles.selectedCount}>{selectedMemberIds.length} Selected</Text>
            </View>

            {selectedMembers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedChipsRow} contentContainerStyle={styles.selectedChipsContent}>
                {selectedMembers.map((member) => (
                  <Pressable key={member.id} style={styles.selectedChip} onPress={() => toggleMember(member.id)}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.selectedChipAvatar} />
                    ) : (
                      <View style={styles.selectedChipAvatarFallback}>
                        <Text style={styles.selectedChipInitials}>{member.initials || "?"}</Text>
                      </View>
                    )}
                    <Text style={styles.selectedChipName} numberOfLines={1}>{member.name || "User"}</Text>
                    <X size={14} color="#9AA7BE" />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <ControllerTextInput
              name="memberSearch"
              control={control}
              placeholder="Search by name or email..."
              placeholderTextColor="#6F7C95"
              inputStyle={[styles.input, styles.searchInput]}
              leftIcon={<Search size={24} color="#9AA7BE" />}
            />

            {usersFetching ? <ActivityIndicator color="#14C9E7" style={{ marginVertical: 6 }} /> : null}

            <View style={styles.memberList}>
              {appUsers.length === 0 && !usersFetching ? (
                <Text style={styles.emptyUsers}>
                  {debouncedSearch.trim() ? "No app users found." : "Start typing to search users."}
                </Text>
              ) : null}
              {appUsers.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <Pressable key={member.id} style={[styles.memberChip, selected && styles.memberChipSelected]} onPress={() => toggleMember(member.id)}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarFallback}>
                        <Text style={styles.memberAvatarFallbackText}>{member.initials || "?"}</Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name || "Unnamed"}</Text>
                      {member.email ? <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text> : null}
                    </View>
                    {selected ? <X size={20} color="#14C9E7" /> : <Text style={styles.addText}>Add</Text>}
                  </Pressable>
                );
              })}
            </View>
            <VoiceFormFillCard
              label="group"
              workflowIntent="group"
              sourceScreen="CreateGroup"
            />

            <View style={{ height: responsiveHeight(10) }} />
          </ScrollView>
        )}

        <Pressable style={styles.createBtn} onPress={handleSubmit(onSubmit)} disabled={creating || updating}>
          {(creating || updating) ? (
            <ActivityIndicator color="#EAF5FB" />
          ) : (
            <Text style={styles.createText}>{isEditMode ? "Save" : "Create"}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4.2), paddingTop: responsiveHeight(0.6), paddingBottom: responsiveHeight(2.2) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: responsiveHeight(1.6) },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F8FAFC", fontSize: 34, fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  content: { gap: responsiveHeight(1.2), paddingBottom: responsiveHeight(2) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarWrap: { alignItems: "center", marginBottom: responsiveHeight(0.6) },
  groupAvatar: {
    width: responsiveWidth(30),
    height: responsiveWidth(30),
    borderRadius: responsiveWidth(15),
    backgroundColor: "#083447",
    borderWidth: 2,
    borderColor: "#0B5A73",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  groupAvatarImage: { width: "100%", height: "100%" },
  cameraFab: {
    position: "absolute",
    bottom: -responsiveHeight(1),
    right: responsiveWidth(32),
    width: responsiveWidth(12),
    height: responsiveWidth(12),
    borderRadius: responsiveWidth(6),
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: "#C2CCDA", marginBottom: responsiveHeight(0.4) },
  input: {
    borderWidth: 1,
    borderColor: "#1E273A",
    backgroundColor: "#121725",
    color: "#E9EEF4",
    paddingHorizontal: responsiveWidth(4.8),
  },
  membersHeader: { marginTop: responsiveHeight(0.5), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  memberAvatar: { width: responsiveWidth(10), height: responsiveWidth(10), borderRadius: responsiveWidth(5) },
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
  emptyUsers: { color: "#6B8499", fontSize: 15, textAlign: "center", paddingVertical: responsiveHeight(2) },
  selectedChipsRow: { marginBottom: responsiveHeight(1) },
  selectedChipsContent: { gap: responsiveWidth(2), paddingRight: responsiveWidth(2) },
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
  selectedChipName: { color: "#D4EEF6", fontSize: 13, fontWeight: "500", flex: 1 },
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
