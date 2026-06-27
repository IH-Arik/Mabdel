import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Check, Globe } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  useGetProfileQuery,
  useLogoutMutation,
} from "../../redux/slices/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "../../redux/reducers/authReducer";
import ConfirmModal from "../../components/ConfirmModal";
import { LANGUAGES, useLanguage } from "../../context/LanguageContext";

const SETTINGS_ITEMS = [
  { labelKey: "edit_profile", path: "ProfileEdit" },
  { labelKey: "subscription_plans", path: "ProfileSubscription" },
  { labelKey: "notifications", path: "ProfileNotification" },
  { labelKey: "ai_voice_history", path: "ProfileVoiceHistory" },
  { labelKey: "account_settings", path: "ProfileAccountSettings" },
  { labelKey: "help_support", path: "ProfileSupport" },
  { labelKey: "business_profile", path: "ProfileBusiness" },
];

const ProfileHomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { selectedLang, setSelectedLang, t } = useLanguage();
  const currentLangMeta = LANGUAGES.find((l) => l.code === selectedLang) ?? LANGUAGES[0];

  const [isProfileImageError, setIsProfileImageError] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const [logout, { isLoading: logoutLoading }] = useLogoutMutation();

  const { data: userData, isLoading: userLoading } = useGetProfileQuery();
  const authUser = useSelector((state) => state?.auth?.user);

  const profileData = userData?.data || authUser || {};

  const normalizedEmail = String(
    profileData?.email ||
      profileData?.client_email ||
      authUser?.email ||
      "",
  ).trim();
  const emailPrefix = normalizedEmail.split("@")[0]?.trim();
  const displayName =
    String(
      profileData?.full_name ||
        profileData?.fullName ||
        profileData?.name ||
        profileData?.username ||
        "",
    ).trim() || (emailPrefix ? emailPrefix : "User");
  const displayEmail =
    normalizedEmail || (emailPrefix ? `${emailPrefix}@...` : "");

  const rawProfileImage =
    profileData?.profileImage ||
    profileData?.avatar ||
    "https://robohash.org/user.png";

  useEffect(() => {
    setIsProfileImageError(false);
  }, [rawProfileImage]);

  const hasRemoteImage =
    typeof rawProfileImage === "string" &&
    rawProfileImage.trim().length > 0 &&
    !isProfileImageError;

  const handleLogoutActivity = async () => {
    setLogoutError("");
    setShowLogoutModal(false);
    try {
      await logout({}).unwrap();
      dispatch(clearAuth());
    } catch (error) {
      setLogoutError(error?.data?.message || t("logout_request_failed"));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("settings")}</Text>

        <View style={styles.profileWrap}>
          <Image
            source={
              hasRemoteImage
                ? { uri: rawProfileImage.trim() }
                : require("../../../assets/images/profile.png")
            }
            onError={() => setIsProfileImageError(true)}
            style={styles.avatar}
          />
          <Text style={styles.name}>
            {userLoading ? t("loading_profile") : displayName}
          </Text>
          <Text style={styles.email}>
            {userLoading ? t("please_wait") : displayEmail || t("no_email_found")}
          </Text>

          {/* Language badge — tapping opens picker */}
          <Pressable
            onPress={() => setShowLangModal(true)}
            style={styles.langBadge}
          >
            <Globe size={14} color="#19CDEB" strokeWidth={2.2} />
            <Text style={styles.langBadgeText}>
              {t("ai_voice_badge")}: {currentLangMeta.label} · {currentLangMeta.name}
            </Text>
            <ChevronRight size={14} color="#19CDEB" strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.listCard}>
          {SETTINGS_ITEMS.map((item, index) => (
            <Pressable
              key={item.path}
              onPress={() => navigation.navigate(item.path)}
              style={[
                styles.row,
                index < SETTINGS_ITEMS.length - 1 ? styles.rowBorder : null,
              ]}
            >
              <Text style={styles.rowText}>{t(item.labelKey)}</Text>
              <ChevronRight size={30} color="#90A2B7" strokeWidth={2.1} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => !logoutLoading && setShowLogoutModal(true)}
          disabled={logoutLoading}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>{t("logout")}</Text>
        </Pressable>

        {!!logoutError && <Text style={styles.errorText}>{logoutError}</Text>}
      </ScrollView>

      {/* Language picker modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showLangModal}
        onRequestClose={() => setShowLangModal(false)}
      >
        <Pressable
          style={styles.langBackdrop}
          onPress={() => setShowLangModal(false)}
        >
          <Pressable style={styles.langSheet} onPress={() => {}}>
            <View style={styles.langHandle} />
            <Text style={styles.langSheetTitle}>{t("ai_voice_language")}</Text>
            <Text style={styles.langSheetSub}>
              {t("ai_voice_language_subtitle")}
            </Text>
            <ScrollView style={styles.langList} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => {
                const active = lang.code === selectedLang;
                return (
                  <Pressable
                    key={lang.code}
                    style={[styles.langRow, active && styles.langRowActive]}
                    onPress={() => {
                      setSelectedLang(lang.code);
                      setShowLangModal(false);
                    }}
                  >
                    <View style={styles.langRowLeft}>
                      <Text style={styles.langRowLabel}>{lang.label}</Text>
                      <Text style={[styles.langRowName, active && styles.langRowNameActive]}>
                        {lang.name}
                      </Text>
                    </View>
                    {active && (
                      <Check size={18} color="#19CDEB" strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutActivity}
        title={t("logout_title")}
        description={t("logout_description")}
        cancelButtonText={t("cancel")}
        confirmButtonText={t("logout")}
        cancelButtonColor="bg-[#17CBE8]"
        confirmButtonColor="bg-red-500"
        type="warning"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { paddingHorizontal: responsiveWidth(5), paddingBottom: 135 },
  title: {
    color: "#F8FAFC",
    fontSize: 40 / 2,
    fontWeight: "700",
    textAlign: "center",
    marginTop: responsiveHeight(1.3),
    marginBottom: responsiveHeight(2.4),
  },
  profileWrap: { alignItems: "center", marginBottom: responsiveHeight(2.5) },
  avatar: {
    width: responsiveWidth(26),
    height: responsiveWidth(26),
    borderRadius: responsiveWidth(13),
    borderWidth: 2.5,
    borderColor: "#16D5F0",
    marginBottom: responsiveHeight(1),
  },
  name: { color: "#F8FAFC", fontSize: 36 / 2, fontWeight: "600" },
  email: {
    marginTop: responsiveHeight(0.2),
    color: "#00BCE5",
    fontSize: 26 / 2,
    fontWeight: "400",
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.5),
    marginTop: responsiveHeight(1.2),
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1C3A4A",
    backgroundColor: "#0D1F2D",
  },
  langBadgeText: { color: "#19CDEB", fontSize: responsiveWidth(3), fontWeight: "600" },
  listCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1B1C21",
    borderWidth: 1,
    borderColor: "#212530",
  },
  row: {
    minHeight: 58,
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#292D37" },
  rowText: { color: "#F2F4F7", fontSize: 30 / 2, fontWeight: "400" },
  logoutBtn: {
    marginTop: responsiveHeight(2.5),
    backgroundColor: "#1B1C21",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#212530",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: { color: "#FC4C58", fontSize: 30 / 2, fontWeight: "600" },
  errorText: {
    textAlign: "center",
    color: "#F87171",
    marginTop: responsiveHeight(1.2),
  },
  langBackdrop: {
    flex: 1,
    backgroundColor: "rgba(1,4,10,0.7)",
    justifyContent: "flex-end",
  },
  langSheet: {
    backgroundColor: "#111A2D",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#2B3C67",
    paddingBottom: responsiveHeight(4),
  },
  langHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2E3D5A",
    alignSelf: "center",
    marginTop: responsiveHeight(1.2),
    marginBottom: responsiveHeight(0.5),
  },
  langSheetTitle: {
    color: "#E8F1FF",
    fontSize: responsiveWidth(4.5),
    fontWeight: "700",
    paddingHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(1),
  },
  langSheetSub: {
    color: "#4A6080",
    fontSize: responsiveWidth(3.2),
    paddingHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(0.4),
    marginBottom: responsiveHeight(1.5),
  },
  langList: { maxHeight: responsiveHeight(52) },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(5),
    paddingVertical: responsiveHeight(1.6),
    borderBottomWidth: 1,
    borderBottomColor: "#1C2A45",
  },
  langRowActive: { backgroundColor: "#0D1F2D" },
  langRowLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(3) },
  langRowLabel: {
    color: "#19CDEB",
    fontSize: responsiveWidth(4),
    fontWeight: "700",
    minWidth: responsiveWidth(9),
  },
  langRowName: { color: "#8A9BB8", fontSize: responsiveWidth(3.8) },
  langRowNameActive: { color: "#D0E8FF", fontWeight: "600" },
});

export default ProfileHomeScreen;
