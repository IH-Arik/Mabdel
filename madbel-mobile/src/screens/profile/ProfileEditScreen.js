import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Controller, useFormContext } from "react-hook-form";
import { formatSelectedDate } from "../../utils/formatSelectedDate";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Mail,
  Pen,
} from "lucide-react-native";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import ImagePickerModal from "../../components/ImagePickerModal";
import { launchImageLibrary } from "react-native-image-picker";
import { useNavigation } from "@react-navigation/native";
import SuccessModal from "../../components/SuccessModal";
import ControllerTextInput from "../../components/ControllerTextInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import {
  useMadbelGetSettingsQuery,
  useMadbelUpdateSettingsMutation,
  useMadbelUploadProfileAvatarMutation,
} from "../../redux/slices/madbelApiSlice";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials } from "../../redux/reducers/authReducer";
import { baseApi } from "../../redux/baseApi";
import { getApiData } from "../../redux/apiUtils";

const avatarSize = responsiveWidth(40);

const ProfileEditScreen = () => {
  const { t } = useAppLanguage();
  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
  } = useFormContext();

  const navigation = useNavigation();
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state?.auth?.user || {});

  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState("");

  const { data: userData } = useMadbelGetSettingsQuery();
  const [editProfile, { isLoading: editProfileLoading }] =
    useMadbelUpdateSettingsMutation();
  const [uploadProfileAvatar, { isLoading: avatarUploading }] =
    useMadbelUploadProfileAvatarMutation();

  const syncProfileState = (response, fallback = {}) => {
    const profile = getApiData(response) || response || {};
    const fullName =
      profile?.full_name ||
      profile?.fullName ||
      profile?.name ||
      fallback?.full_name ||
      fallback?.fullName ||
      fallback?.name ||
      authUser?.full_name ||
      authUser?.fullName ||
      authUser?.name ||
      "";
    const avatarUrl =
      profile?.avatar_url ||
      profile?.profileImage ||
      profile?.avatar ||
      fallback?.avatar_url ||
      fallback?.profileImage ||
      fallback?.avatar ||
      authUser?.avatar_url ||
      authUser?.profileImage ||
      authUser?.avatar ||
      "";
    const email =
      profile?.email ||
      fallback?.email ||
      authUser?.email ||
      "";
    const country =
      profile?.country ||
      fallback?.country ||
      authUser?.country ||
      "";
    const dateOfBirth =
      profile?.date_of_birth ||
      profile?.dob ||
      profile?.dateOfBirth ||
      fallback?.date_of_birth ||
      fallback?.dob ||
      fallback?.dateOfBirth ||
      authUser?.date_of_birth ||
      authUser?.dob ||
      authUser?.dateOfBirth ||
      "";

    const mergedProfile = {
      ...authUser,
      ...fallback,
      ...profile,
      full_name: fullName,
      fullName,
      name: fullName,
      avatar_url: avatarUrl,
      profileImage: avatarUrl,
      avatar: avatarUrl,
      email,
      country,
      date_of_birth: dateOfBirth,
      dob: dateOfBirth,
      dateOfBirth,
    };

    dispatch(
      setCredentials({
        accessToken: undefined,
        refreshToken: undefined,
        user: mergedProfile,
      }),
    );

    dispatch(
      baseApi.util.updateQueryData("getProfile", undefined, (draft) => {
        if (!draft) return;
        if (draft.data && typeof draft.data === "object") {
          draft.data = {
            ...draft.data,
            ...mergedProfile,
          };
        } else {
          draft.data = {
            ...mergedProfile,
          };
        }
      }),
    );

    dispatch(
      baseApi.util.invalidateTags([{ type: "UserProfile", id: "ME" }]),
    );

    return mergedProfile;
  };

  useEffect(() => {
    const profile = userData?.data;
    if (!profile) return;

    reset({
      profileImage:
        profile?.avatar_url ||
        profile?.profileImage ||
        profile?.avatar ||
        profile?.profilePicture ||
        "",
      profileFullName: profile?.full_name || profile?.fullName || profile?.name || "",
      email: profile?.email || "",
      country: profile?.country || "Mexico",
    });

    setSelectedDate(profile?.date_of_birth || profile?.dob || profile?.dateOfBirth || null);
  }, [reset, userData]);

  const handleEditProfile = async (data) => {
    try {
      const payload = {
        full_name: data?.profileFullName?.trim(),
        email: data?.email?.trim(),
        avatar_url: data?.profileImage || undefined,
        country: data?.country?.trim() || undefined,
        date_of_birth: selectedDate || undefined,
      };

      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(
          ([, value]) => value !== undefined && value !== null && value !== "",
        ),
      );

      const response = await editProfile(sanitizedPayload).unwrap();
      const updatedProfile = syncProfileState(response, sanitizedPayload);
      reset({
        profileImage: updatedProfile?.avatar_url || updatedProfile?.profileImage || updatedProfile?.avatar || "",
        profileFullName: updatedProfile?.full_name || updatedProfile?.fullName || updatedProfile?.name || "",
        email: updatedProfile?.email || "",
        country: updatedProfile?.country || "",
      });
      setSelectedDate(updatedProfile?.date_of_birth || updatedProfile?.dob || updatedProfile?.dateOfBirth || null);
      setShowSuccessModal(true);
    } catch (error) {
      setError("root", {
        type: "editProfile",
        message: error?.data?.message || "Failed to update profile.",
      });
    }
  };

  const handlePickProfileImage = async (onChange) => {
    setAvatarUploadError("");

    const response = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.8,
    });

    if (response?.didCancel) return;

    if (response?.errorCode) {
      setAvatarUploadError(response?.errorMessage || "Could not pick that image.");
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) return;

      try {
        const uploadResponse = await uploadProfileAvatar({
          avatar_file: {
            uri: asset.uri,
            type: asset.type || "image/jpeg",
          name: asset.fileName || `profile-avatar-${Date.now()}.jpg`,
        },
        }).unwrap();

      const avatarUrl = getApiData(uploadResponse)?.avatar_url || uploadResponse?.data?.avatar_url || "";
      onChange(avatarUrl);
      const updatedProfile = syncProfileState(uploadResponse, { avatar_url: avatarUrl });
      reset({
        profileImage: updatedProfile?.avatar_url || updatedProfile?.profileImage || updatedProfile?.avatar || "",
        profileFullName: updatedProfile?.full_name || updatedProfile?.fullName || updatedProfile?.name || "",
        email: updatedProfile?.email || "",
        country: updatedProfile?.country || "",
      });
      setImageModalVisible(false);
    } catch (error) {
      setAvatarUploadError(error?.data?.message || "Could not upload the image.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020406" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
                <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
              </Pressable>
              <Text style={styles.title}>{t("edit_profile")}</Text>
              <View style={styles.spacer} />
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Controller
                name="profileImage"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <View style={styles.avatarWrap}>
                    <Pressable
                      onPress={() => setImageModalVisible(true)}
                      style={styles.avatarButton}
                    >
                      <Image
                        source={
                          value
                            ? { uri: value }
                            : require("../../../assets/images/profile.png")
                        }
                        style={styles.avatar}
                      />
                    </Pressable>

                    <Pressable
                      style={styles.avatarEditFab}
                      onPress={() => setImageModalVisible(true)}
                    >
                      <Pen size={18} color="#020406" strokeWidth={2.5} />
                    </Pressable>

                    <ImagePickerModal
                      visible={imageModalVisible}
                      onClose={() => setImageModalVisible(false)}
                      onPickGallery={() => handlePickProfileImage(onChange)}
                    />
                    {avatarUploading ? (
                      <ActivityIndicator color="#14C9E7" style={{ marginTop: 12 }} />
                    ) : null}
                    {avatarUploadError ? (
                      <Text style={styles.errorTextCenter}>{avatarUploadError}</Text>
                    ) : null}
                  </View>
                )}
              />

              <ControllerTextInput
                name="profileFullName"
                control={control}
                error={errors?.profileFullName?.message}
                rules={{ required: "Name is required" }}
                label={t("name")}
                placeholder={t("name")}
                placeholderTextColor="#8493A8"
                // inputStyle={styles.input}
                // labelStyle={styles.label}
                errorTextStyle={styles.errorText}
              />

              <ControllerTextInput
                name="email"
                control={control}
                error={errors?.email?.message}
                rules={{ required: "Email is required" }}
                label={t("email")}
                placeholder={t("email")}
                type="email-address"
                autoCapitalize="none"
                placeholderTextColor="#8493A8"
                // inputStyle={[styles.input, styles.inputWithIcon]}
                // labelStyle={styles.label}
                errorTextStyle={styles.errorText}
                rightIcon={<Mail size={22} color="#D5E5EF" />}
              />

              <View>
                <Text style={styles.label}>{t("date_of_birth")}</Text>
                <Pressable style={styles.inputIconWrap} onPress={() => setModalVisible(true)}>
                  {/* <View style={styles.inputStaticTextWrap}> */}
                    <Text style={styles.inputStaticText}>{formatSelectedDate(selectedDate)}</Text>
                  {/* </View> */}
                  <CalendarDays size={22} color="#D5E5EF" />
                </Pressable>
              </View>

              <ControllerTextInput
                name="country"
                control={control}
                label={t("country")}
                placeholder={t("country")}
                placeholderTextColor="#8493A8"
                // inputStyle={[styles.input, styles.inputWithIcon]}
                // labelStyle={styles.label}
                rightIcon={<ChevronDown size={28} color="#D5E5EF" />}
              />
              <VoiceFormFillCard
                label={t("profile")}
                workflowIntent="profile"
                sourceScreen="ProfileEdit"
              />
            </ScrollView>

            <SystemCalendarModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <Pressable
              onPress={handleSubmit(handleEditProfile)}
              style={[styles.saveBtn, editProfileLoading ? styles.saveBtnDisabled : null]}
              disabled={editProfileLoading}
            >
              {editProfileLoading ? (
                <ActivityIndicator color="#E8F4FA" size={22} />
              ) : (
                <Text style={styles.saveText}>{t("save")}</Text>
              )}
            </Pressable>

            {errors?.root?.type === "editProfile" && (
              <Text style={styles.errorTextCenter}>{errors?.root?.message}</Text>
            )}

            <SuccessModal
              visible={showSuccessModal}
              onClose={() => {
                setShowSuccessModal(false);
                navigation.goBack();
              }}
              title={t("profile_updated")}
              message="Your profile has been updated successfully."
              autoClose
              autoCloseTime={1500}
            />
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.2),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
    // backgroundColor: "#0F1A2B",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 40 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  scrollContent: {
    paddingBottom: responsiveHeight(2),
    gap: responsiveHeight(1.4),
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: responsiveHeight(0.8),
  },
  avatarButton: {
    borderWidth: 3,
    borderColor: "#13C8EA",
    borderRadius: avatarSize / 2,
  },
  avatar: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
  },
  avatarEditFab: {
    position: "absolute",
    right: responsiveWidth(28),
    bottom: responsiveHeight(1.5),
    width: responsiveWidth(13),
    height: responsiveWidth(13),
    borderRadius: responsiveWidth(6.5),
    backgroundColor: "#13C8EA",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#F1F4F8",
    fontSize: 32 / 2,
    fontWeight: "500",
    // marginBottom: responsiveHeight(0.7),
  },
  input: {
    // minHeight: responsiveHeight(7.8),
    borderWidth: 2,
    borderColor: "#12C9EB",
    borderRadius: 18,
    color: "#EAF0F6",
    fontSize: 32 / 2,
    // paddingHorizontal: responsiveWidth(4.5),
    backgroundColor: "#020406",
  },
  inputWithIcon: {
    // paddingRight: responsiveWidth(15),
  },
  inputIconWrap: {
    minHeight: responsiveHeight(6),
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 9,
    paddingLeft: responsiveWidth(2),
    paddingRight: responsiveWidth(6),
    backgroundColor: "#1D1F24",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputStaticTextWrap: {
    flex: 1,
  },
  inputStaticText: {
    color: "#EAF0F6",
    fontSize: 32 / 2,
  },
  errorText: {
    color: "#F87171",
    marginTop: responsiveHeight(0.6),
    fontSize: 13,
  },
  errorTextCenter: {
    color: "#F87171",
    textAlign: "center",
    marginTop: responsiveHeight(1),
  },
  saveBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#15C8E3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15C8E3",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 9,
    marginBottom: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: "#E8F4FA",
    fontSize: 32 / 2,
    fontWeight: "600",
  },
});

export default ProfileEditScreen;
