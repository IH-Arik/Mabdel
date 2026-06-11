import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight } from "lucide-react-native";
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

const SETTINGS_ITEMS = [
  { label: "Edit Profile", path: "ProfileEdit" },
  { label: "Subscription Plans", path: "ProfileSubscription" },
  { label: "Notifications", path: "ProfileNotification" },
  { label: "AI Voice command History", path: "ProfileVoiceHistory" },
  { label: "Account Settings", path: "ProfileAccountSettings" },
  { label: "Help & Support", path: "ProfileSupport" },
  { label: "Business Profile", path: "ProfileBusiness" },
];

const avatarSize = responsiveWidth(34);

const ProfileHomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const [isProfileImageError, setIsProfileImageError] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [logout, { isLoading: logoutLoading }] = useLogoutMutation();

  const { data: userData, isLoading: userLoading, isError: userError } =
    useGetProfileQuery();
  const authUser = useSelector((state) => state?.auth?.user);

  const profileData = userData?.data || authUser || {};

  const normalizedEmail = String(
    profileData?.email ||
      profileData?.client_email ||
      authUser?.email ||
      "",
  ).trim();
  const emailPrefix = normalizedEmail.split("@")[0]?.trim();
  const displayName = String(
    profileData?.full_name ||
      profileData?.fullName ||
      profileData?.name ||
      profileData?.username ||
      "",
  ).trim() || (emailPrefix ? emailPrefix : "User");
  const displayEmail = normalizedEmail || (emailPrefix ? `${emailPrefix}@...` : "");

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
      setLogoutError(error?.data?.message || "Logout request failed.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

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
            {userLoading ? "Loading profile..." : displayName}
          </Text>
          <Text style={styles.email}>
            {userLoading ? "Please wait..." : displayEmail || "No email found"}
          </Text>
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
              <Text style={styles.rowText}>{item.label}</Text>
              <ChevronRight size={30} color="#90A2B7" strokeWidth={2.1} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => !logoutLoading && setShowLogoutModal(true)}
          disabled={logoutLoading}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        {!!logoutError && <Text style={styles.errorText}>{logoutError}</Text>}
      </ScrollView>

      <ConfirmModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutActivity}
        title="Logout?"
        description="Do you want logout?"
        cancelButtonText="Cancel"
        confirmButtonText="Logout"
        cancelButtonColor="bg-[#17CBE8]"
        confirmButtonColor="bg-red-500"
        type="warning"
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
    paddingHorizontal: responsiveWidth(5),
    paddingBottom: responsiveHeight(4),
  },
  title: {
    color: "#F8FAFC",
    fontSize: 48 / 2,
    fontWeight: "700",
    textAlign: "center",
    marginTop: responsiveHeight(1.3),
    marginBottom: responsiveHeight(2.4),
  },
  profileWrap: {
    alignItems: "center",
    marginBottom: responsiveHeight(2.5),
  },
  avatar: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
    borderWidth: 3,
    borderColor: "#16D5F0",
    marginBottom: responsiveHeight(1.2),
  },
  name: {
    color: "#F8FAFC",
    fontSize: 46 / 2,
    fontWeight: "500",
  },
  email: {
    marginTop: responsiveHeight(0.25),
    color: "#00BCE5",
    fontSize: 36 / 2,
    fontWeight: "400",
  },
  listCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1B1C21",
    borderWidth: 1,
    borderColor: "#212530",
  },
  row: {
    minHeight: responsiveHeight(8.3),
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#292D37",
  },
  rowText: {
    color: "#F2F4F7",
    fontSize: 48 / 2,
    fontWeight: "400",
  },
  logoutBtn: {
    marginTop: responsiveHeight(2.8),
    backgroundColor: "#1B1C21",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#212530",
    minHeight: responsiveHeight(7.8),
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#FC4C58",
    fontSize: 50 / 2,
    fontWeight: "500",
  },
  errorText: {
    textAlign: "center",
    color: "#F87171",
    marginTop: responsiveHeight(1.2),
  },
});

export default ProfileHomeScreen;
