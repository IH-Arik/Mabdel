import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Camera, Pen, Globe, Mail } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { useForm } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import { launchImageLibrary } from "react-native-image-picker";
import {
  useMadbelGetBusinessProfileQuery,
  useMadbelUpdateBusinessProfileMutation,
  useMadbelUploadBusinessLogoMutation,
} from "../../redux/slices/madbelApiSlice";

const logoSize = responsiveWidth(46);

const ProfileBusinessEditScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      businessName: "",
      email: "",
      website: "",
      officeAddress: "",
      logoUrl: "",
    },
  });
  const {
    data: businessProfileResponse,
    isLoading: loadingProfile,
    isError: businessProfileError,
    refetch,
  } = useMadbelGetBusinessProfileQuery();
  const [updateBusinessProfile, { isLoading: savingProfile }] =
    useMadbelUpdateBusinessProfileMutation();
  const [uploadBusinessLogo, { isLoading: uploadingLogo }] =
    useMadbelUploadBusinessLogoMutation();
  const [logoError, setLogoError] = useState("");
  const profile = businessProfileResponse?.data;
  const logoUrl = watch("logoUrl");

  useEffect(() => {
    if (!profile) return;

    reset({
      businessName: profile.business_name || "",
      email: profile.email || "",
      website: profile.website || "",
      officeAddress: profile.office_address_text || "",
      logoUrl: profile.logo_url || "",
    });
  }, [profile, reset]);

  const handleSelectLogo = async () => {
    setLogoError("");

    const response = await launchImageLibrary({
      mediaType: "photo",
      selectionLimit: 1,
      quality: 0.8,
    });

    if (response?.didCancel) return;

    if (response?.errorCode) {
      setLogoError(response?.errorMessage || "Could not select that image.");
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) return;

    try {
      const uploadResponse = await uploadBusinessLogo({
        logo_file: {
          uri: asset.uri,
          type: asset.type || "image/jpeg",
          name: asset.fileName || `business-logo-${Date.now()}.jpg`,
        },
      }).unwrap();

      setValue("logoUrl", uploadResponse?.data?.logo_url || "");
    } catch (error) {
      setLogoError(error?.data?.message || "Could not upload the logo.");
    }
  };

  const handleSave = async (values) => {
    try {
      await updateBusinessProfile({
        business_name: values.businessName?.trim() || undefined,
        email: values.email?.trim() || undefined,
        website: values.website?.trim() || undefined,
        office_address_text: values.officeAddress?.trim() || undefined,
        logo_url: values.logoUrl || undefined,
      }).unwrap();

      Alert.alert(t("saved"), t("business_profile_updated_successfully"));
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Update failed",
        error?.data?.message || "Could not update the business profile.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("edit_business_profile")}</Text>
          <View style={styles.spacer} />
        </View>

        {loadingProfile ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#15C8E3" size="large" />
            <Text style={styles.stateText}>{t("loading_business_profile")}</Text>
          </View>
        ) : businessProfileError ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{t("could_not_load_business_profile")}</Text>
            <Pressable style={styles.retryBtn} onPress={refetch}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoAreaWrap}>
            <Pressable style={styles.logoArea} onPress={handleSelectLogo}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
              ) : (
                <>
                  <Camera size={40} color="#12C9EB" />
                  <Text style={styles.logoText}>{t("upload_logo")}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.logoEditFab} onPress={handleSelectLogo}>
              <Pen size={16} color="#020406" strokeWidth={2.5} />
            </Pressable>
            {uploadingLogo ? <ActivityIndicator color="#15C8E3" style={{ marginTop: 12 }} /> : null}
            {logoError ? <Text style={styles.logoError}>{logoError}</Text> : null}
          </View>

          <View>
            <ControllerTextInput
              name="businessName"
              control={control}
              label={t("business_name")}
              placeholder={t("business_name")}
              placeholderTextColor="#8291A8"
              labelStyle={styles.label}
              inputStyle={styles.input}
            />
          </View>

          <View>
            <Text style={styles.sectionTitle}>{t("contact_information")}</Text>
            <ControllerTextInput
              name="email"
              control={control}
              label={t("email")}
              placeholder={t("email")}
              type="email-address"
              autoCapitalize="none"
              placeholderTextColor="#8291A8"
              labelStyle={styles.label}
              inputStyle={[styles.input, styles.inputWithIcon]}
              rightIcon={<Mail size={22} color="#CFE4EC" />}
            />
          </View>

          <View>
            <ControllerTextInput
              name="website"
              control={control}
              label={t("company_website")}
              placeholder={t("company_website")}
              placeholderTextColor="#8291A8"
              labelStyle={styles.label}
              inputStyle={[styles.input, styles.inputWithIcon]}
              rightIcon={<Globe size={22} color="#CFE4EC" />}
            />
          </View>

          <View>
            <ControllerTextInput
              name="officeAddress"
              control={control}
              label={t("office_address")}
              placeholder={t("street_address_suite_city_state_zip_code")}
              placeholderTextColor="#8291A8"
              labelStyle={styles.label}
              inputStyle={[styles.input, styles.multilineInput]}
              multiline
              // textAlignVertical="top"
            />
          </View>
          <VoiceFormFillCard
            label={t("business_profile")}
            workflowIntent="business_profile"
            sourceScreen="ProfileBusinessEdit"
          />
          </ScrollView>
        )}

        <Pressable
          style={[styles.saveBtn, savingProfile ? styles.saveBtnDisabled : null]}
          onPress={handleSubmit(handleSave)}
          disabled={savingProfile || uploadingLogo}
        >
          {savingProfile ? (
            <ActivityIndicator color="#E8F4FA" />
          ) : (
            <Text style={styles.saveText}>{t("save")}</Text>
          )}
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
    paddingBottom: 24,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveHeight(1.2),
  },
  stateText: {
    color: "#C2D0E1",
    fontSize: 16,
  },
  retryBtn: {
    minHeight: responsiveHeight(5.5),
    borderRadius: 12,
    backgroundColor: "#15C8E3",
    paddingHorizontal: responsiveWidth(7),
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: "#EAF8FF",
    fontSize: 16,
    fontWeight: "700",
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
  logoAreaWrap: {
    alignItems: "center",
    marginBottom: responsiveHeight(1),
  },
  logoArea: {
    width: logoSize,
    height: logoSize,
    borderRadius: logoSize / 2,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#13C8EA",
    backgroundColor: "#182033",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveHeight(0.8),
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  logoText: {
    color: "#13C8EA",
    fontSize: 34 / 2,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  logoError: {
    color: "#FF8F8F",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  logoEditFab: {
    position: "absolute",
    right: responsiveWidth(20),
    bottom: responsiveHeight(1.2),
    width: responsiveWidth(13),
    height: responsiveWidth(13),
    borderRadius: responsiveWidth(6.5),
    backgroundColor: "#13C8EA",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#E8EDF5",
    fontSize: 36 / 2,
    fontWeight: "600",
    marginBottom: responsiveHeight(0.6),
  },
  label: {
    color: "#F1F4F8",
    fontSize: 32 / 2,
    fontWeight: "500",
    marginBottom: responsiveHeight(0.7),
  },
  input: {
    // minHeight: responsiveHeight(7.8),
    borderWidth: 2,
    borderColor: "#12C9EB",
    borderRadius: 18,
    color: "#EAF0F6",
    fontSize: 32 / 2,
    paddingHorizontal: responsiveWidth(4.5),
    backgroundColor: "#020406",
  },
  inputWithIcon: {
    paddingRight: responsiveWidth(15),
  },
  multilineInput: {
    minHeight: responsiveHeight(14.6),
    paddingTop: responsiveHeight(1.6),
    lineHeight: 36,
  },
  saveBtn: {
    minHeight: 52,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "#15C8E3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15C8E3",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 9,
  },
  saveText: {
    color: "#E8F4FA",
    fontSize: 32 / 2,
    fontWeight: "600",
  },
  saveBtnDisabled: {
    opacity: 0.8,
  },
});

export default ProfileBusinessEditScreen;
