import React, { useMemo, useState, useEffect } from "react";
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
  useMadbelListContactsQuery,
  useMadbelUpdateGroupMutation,
} from "../../redux/slices/madbelApiSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

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
  const { data: contactsResponse, isFetching: contactsFetching } = useMadbelListContactsQuery({
    page: 1,
    page_size: 100,
  });
  const [createGroup, { isLoading: creating }] = useMadbelCreateGroupSmartFlowMutation();
  const [updateGroup, { isLoading: updating }] = useMadbelUpdateGroupMutation();

  const contacts = contactsResponse?.data?.items || [];
  const group = groupResponse?.data;
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  useEffect(() => {
    if (!group) return;
    setValue("groupName", group.name || "");
    setValue("avatarUrl", group.avatar_url || "");
    setValue("description", group.description || "");
    setSelectedMemberIds(group.member_ids || []);
  }, [group, setValue]);

  const memberSearch = watch("memberSearch");
  const filteredContacts = useMemo(() => {
    const search = (memberSearch || "").trim().toLowerCase();
    if (!search) return contacts;
    return contacts.filter((member) => (member.name || "").toLowerCase().includes(search));
  }, [contacts, memberSearch]);

  const selectedMembers = useMemo(
    () => contacts.filter((contact) => selectedMemberIds.includes(contact.id)),
    [contacts, selectedMemberIds],
  );

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const onSubmit = async (data) => {
    const name = (data.groupName || "").trim();
    if (!name) {
      Alert.alert("Missing name", "Please enter group name.");
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

            <ControllerTextInput
              name="memberSearch"
              control={control}
              placeholder="Search contacts..."
              placeholderTextColor="#6F7C95"
              inputStyle={[styles.input, styles.searchInput]}
              leftIcon={<Search size={24} color="#9AA7BE" />}
            />

            {contactsFetching ? <ActivityIndicator color="#14C9E7" /> : null}

            <View style={styles.memberList}>
              {filteredContacts.slice(0, 30).map((member) => {
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
                    <Text style={styles.memberName}>{member.name || "Unnamed"}</Text>
                    {selected ? <X size={20} color="#9AA7BE" /> : <Text style={styles.addText}>Add</Text>}
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
  memberName: { color: "#E8EDF3", fontSize: 18, flex: 1 },
  addText: { color: "#14C9E7", fontWeight: "600" },
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
