import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  Mail,
  NotebookText,
  Phone,
  User,
  UserRound,
  Trash2,
} from "lucide-react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import { useForm } from "react-hook-form";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import ControllerTextInput from "../../components/ControllerTextInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import {
  useMadbelCreateContactMutation,
  useMadbelDeleteContactMutation,
  useMadbelUpdateContactMutation,
  useMadbelUploadContactAvatarMutation,
} from "../../redux/slices/madbelApiSlice";

const AddContactScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const contact = route.params?.contact;
  const getContactId = (value) =>
    value?.id || value?._id || value?.contact_id || null;
  const currentContactId = getContactId(contact);
  const isEditMode = Boolean(currentContactId);

  const defaults = useMemo(
    () => ({
      firstName: contact?.first_name || contact?.name?.split(" ")?.[0] || "",
      lastName:
        contact?.last_name ||
        contact?.name?.split(" ")?.slice(1).join(" ") ||
        "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      dob: contact?.date_of_birth || null,
      notes: contact?.notes || "",
      avatarUrl: contact?.avatar_url || null,
    }),
    [contact],
  );

  const { control, getValues, setValue } = useForm({
    defaultValues: {
      firstName: defaults.firstName,
      lastName: defaults.lastName,
      phone: defaults.phone,
      email: defaults.email,
      notes: defaults.notes,
    },
  });
  const [dob, setDob] = useState(defaults.dob);
  const [avatarUrl, setAvatarUrl] = useState(defaults.avatarUrl);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [voiceTrigger, setVoiceTrigger] = useState(0);

  useEffect(() => {
    const p = route?.params?.prefill;
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    if (p.first_name) setValue("firstName", p.first_name);
    if (p.last_name) setValue("lastName", p.last_name);
    if (p.phone) setValue("phone", p.phone);
    if (p.email) setValue("email", p.email);
    if (p.notes) setValue("notes", p.notes);
    if (p.date_of_birth) setDob(p.date_of_birth);
    navigation.setParams?.({ prefill: undefined });
  }, [route?.params?.prefill]);

  const [createContact, { isLoading: creatingContact }] =
    useMadbelCreateContactMutation();
  const [updateContact, { isLoading: updatingContact }] =
    useMadbelUpdateContactMutation();
  const [deleteContact, { isLoading: deletingContact }] =
    useMadbelDeleteContactMutation();
  const [uploadContactAvatar, { isLoading: uploadingAvatar }] =
    useMadbelUploadContactAvatarMutation();

  const isSaving = creatingContact || updatingContact || deletingContact;
  const displayDob = dob
    ? new Date(dob).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : "MM/DD/YYYY";

  const handleAvatarPick = async () => {
    const response = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.8,
    });

    if (response?.didCancel) return;
    if (response?.errorCode) {
      Alert.alert("Avatar failed", response?.errorMessage || "Could not pick image.");
      return;
    }

    const asset = response?.assets?.[0];
    setAvatarUrl(asset?.uri || null);
  };


  const saveContact = async () => {
    const values = getValues();
    const firstName = values.firstName || "";
    const lastName = values.lastName || "";
    const phone = values.phone || "";
    const email = values.email || "";
    const notes = values.notes || "";

    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName || fullName.length < 2) {
      Alert.alert("Invalid name", "Please enter a valid contact name.");
      return;
    }

    const payload = {
      name: fullName,
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      date_of_birth: dob || undefined,
      notes: notes.trim() || undefined,
      avatar_url: !currentContactId && avatarUrl ? avatarUrl : undefined,
    };

    try {
      if (currentContactId) {
        await updateContact({ contact_id: currentContactId, ...payload }).unwrap();
      } else {
        const response = await createContact(payload).unwrap();
        const createdContact = response?.data || response;
        const createdContactId = getContactId(createdContact);
        if (createdContactId && avatarUrl && avatarUrl.startsWith("file:")) {
          await uploadContactAvatar({
            contact_id: createdContactId,
            avatar_file: {
              uri: avatarUrl,
              type: "image/jpeg",
              name: `contact-avatar-${Date.now()}.jpg`,
            },
          }).unwrap();
        }
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Save failed",
        error?.data?.message || "Could not save contact.",
      );
    }
  };

  const handleDelete = () => {
    if (!currentContactId) return;
    Alert.alert(
      "Delete contact",
      "Are you sure you want to delete this contact?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteContact({ contact_id: currentContactId }).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Delete failed",
                error?.data?.message || "Could not delete contact.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={36} color="#F4F9FF" />
          </Pressable>
          <Text style={styles.title}>{isEditMode ? "Edit Contact" : "Add Contact"}</Text>
          <View style={styles.headerActions}>
            {isEditMode ? (
              <Pressable onPress={handleDelete} style={styles.deleteIconBtn}>
                <Trash2 size={20} color="#FF4F5F" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarArea}>
            <View style={styles.avatarCircle}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <UserRound size={57 / 1.7} color="#14D2ED" strokeWidth={2.2} />
              )}
            </View>
            <Pressable style={styles.cameraBadge} onPress={handleAvatarPick}>
              {uploadingAvatar ? (
                <ActivityIndicator color="#EEFFFF" size="small" />
              ) : (
                <Camera size={17} color="#EEFFFF" />
              )}
            </Pressable>
          </View>

          <ControllerTextInput
            name="firstName"
            control={control}
            label="FIRST NAME"
            placeholder="First name"
            leftIcon={<User size={23} color="#A3AFBC" strokeWidth={2} />}
            labelStyle={styles.fieldLabel}
            containerStyle={styles.fieldGroup}
            inputStyle={styles.input}
            inputWrapperStyle={styles.inputWrap}
            placeholderTextColor="#7C8796"
          />
          <ControllerTextInput
            name="lastName"
            control={control}
            label="LAST NAME"
            placeholder="Last name"
            leftIcon={<User size={23} color="#A3AFBC" strokeWidth={2} />}
            labelStyle={styles.fieldLabel}
            containerStyle={styles.fieldGroup}
            inputStyle={styles.input}
            inputWrapperStyle={styles.inputWrap}
            placeholderTextColor="#7C8796"
          />
          <ControllerTextInput
            name="phone"
            control={control}
            label="PHONE NUMBER"
            placeholder="+1 (415) 555-0123"
            type="phone-pad"
            leftIcon={<Phone size={23} color="#A3AFBC" strokeWidth={2} />}
            labelStyle={styles.fieldLabel}
            containerStyle={styles.fieldGroup}
            inputStyle={styles.input}
            inputWrapperStyle={styles.inputWrap}
            placeholderTextColor="#7C8796"
          />
          <ControllerTextInput
            name="email"
            control={control}
            label="EMAIL ADDRESS"
            placeholder="name@example.com"
            type="email-address"
            leftIcon={<Mail size={23} color="#A3AFBC" strokeWidth={2} />}
            labelStyle={styles.fieldLabel}
            containerStyle={styles.fieldGroup}
            inputStyle={styles.input}
            inputWrapperStyle={styles.inputWrap}
            placeholderTextColor="#7C8796"
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DATE OF BIRTH (DOB)</Text>
            <Pressable style={styles.inputWrap} onPress={() => setCalendarVisible(true)}>
              <CalendarDays size={23} color="#A3AFBC" strokeWidth={2} />
              <Text style={[styles.input, { paddingTop: 0 }]}>{displayDob}</Text>
            </Pressable>
          </View>
          <ControllerTextInput
            name="notes"
            control={control}
            label="NOTES"
            placeholder="Type notes..."
            multiline
            leftIcon={<NotebookText size={23} color="#A3AFBC" strokeWidth={2} />}
            labelStyle={styles.fieldLabel}
            containerStyle={styles.fieldGroup}
            inputStyle={[styles.input, styles.inputMultiline]}
            inputWrapperStyle={[styles.inputWrap, styles.inputWrapMultiline]}
            placeholderTextColor="#7C8796"
          />
          <VoiceFormFillCard
            label="contact"
            workflowIntent="contact"
            sourceScreen="AddContact"
            triggerOpen={voiceTrigger}
            currentValues={{
              first_name: getValues("firstName"),
              last_name: getValues("lastName"),
              phone: getValues("phone"),
              email: getValues("email"),
              notes: getValues("notes"),
              date_of_birth: dob,
            }}
          />

          <View style={styles.saveWrap}>
            <Pressable
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={saveContact}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#EEFFFF" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>

        <SystemCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          selectedDate={dob || undefined}
          onSelectDate={(selectedDate) => setDob(selectedDate)}
        />
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
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(4.5),
    paddingTop: responsiveHeight(0.8),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.5),
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F5FAFF",
    fontSize: responsiveWidth(7),
    fontWeight: "700",
  },
  headerActions: {
    width: 40,
    alignItems: "flex-end",
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A1115",
  },
  scrollContent: {
    paddingBottom: responsiveHeight(12),
  },
  avatarArea: {
    alignItems: "center",
    marginTop: responsiveHeight(1.4),
    marginBottom: responsiveHeight(2.6),
  },
  avatarCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "#10657A",
    // backgroundColor: "#083646",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    position: "absolute",
    right: responsiveWidth(31),
    bottom: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#15CFE9",
    borderWidth: 2,
    borderColor: "#0A1A22",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    marginBottom: responsiveHeight(1.9),
  },
  fieldLabel: {
    color: "#A0A7B3",
    fontSize: responsiveWidth(2.7),
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: "#0F1116",
    borderWidth: 1,
    borderColor: "#212734",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputWrapMultiline: {
    minHeight: 174,
    alignItems: "flex-start",
    paddingTop: 16,
  },
  input: {
    flex: 1,
    color: "#E8F2FF",
    fontSize: responsiveWidth(3.9),
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 130,
    lineHeight: 38 / 1.6,
    paddingTop: 0,
  },
  saveWrap: {
    marginTop: responsiveHeight(7),
  },
  saveBtn: {
    height: 74,
    borderRadius: 22,
    backgroundColor: "#15CFE9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15CFE9",
    shadowOpacity: 0.33,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.8,
  },
  saveText: {
    color: "#EEFFFF",
    fontSize: responsiveWidth(5),
    fontWeight: "700",
  },
});

export default AddContactScreen;
