import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import { useMadbelGetBusinessProfileQuery } from "../../redux/slices/madbelApiSlice";

const logoSize = responsiveWidth(36);

const ProfileBusinessScreen = () => {
  const navigation = useNavigation();

  const {
    data: businessProfileResponse,
    isLoading,
    isError,
    refetch,
  } = useMadbelGetBusinessProfileQuery();

  const profile = businessProfileResponse?.data;

  const officeLines =
    profile?.office_location_lines?.length
      ? profile.office_location_lines
      : profile?.office_address_text
        ? profile.office_address_text.split("\n").filter(Boolean)
        : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.iconWrap}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>

          <Text style={styles.title}>Business Profile</Text>

          <Pressable
            onPress={() => navigation.navigate("ProfileBusinessEdit")}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* LOADING */}
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#14C9E7" size="large" />
            <Text style={styles.stateText}>
              Loading business profile...
            </Text>
          </View>
        ) : isError ? (
          /* ERROR */
          <View style={styles.centerState}>
            <Text style={styles.stateText}>
              Could not load business profile.
            </Text>

            <Pressable style={styles.retryBtn} onPress={refetch}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          /* CONTENT */
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* LOGO */}
            <View style={styles.logoWrapOuter}>
              <View style={styles.logoWrapInner}>
                <Image
                  source={
                    profile?.logo_url
                      ? { uri: profile.logo_url }
                      : require("../../../assets/images/logo.png")
                  }
                  style={styles.logo}
                />
              </View>
            </View>

            {/* CARD 1 */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
              <Text style={styles.fieldValue}>
                {profile?.business_name || "-"}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <Text style={styles.fieldValue}>
                {profile?.email || "-"}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
              <Text style={styles.fieldValue}>
                {profile?.phone_number || "-"}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>WEBSITE</Text>
              <Text style={styles.fieldLink}>
                {profile?.website || "-"}
              </Text>
            </View>

            {/* CARD 2 */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>OFFICE LOCATION</Text>

              <View
                style={{
                  marginTop: responsiveHeight(1.5),
                  gap: responsiveHeight(0.9),
                }}
              >
                {officeLines.length ? (
                  officeLines.map((line, index) => (
                    <Text
                      key={`${line}-${index}`}
                      style={
                        index === officeLines.length - 1
                          ? styles.fieldSub
                          : styles.fieldValue
                      }
                    >
                      {line}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.fieldValue}>-</Text>
                )}
              </View>
            </View>
          </ScrollView>
        )}
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
    backgroundColor: "#020406",
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
    fontSize: 26,
    fontWeight: "700",
  },

  editText: {
    color: "#13CBEC",
    fontSize: 22,
    fontWeight: "600",
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
    textAlign: "center",
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: responsiveHeight(12),
    gap: responsiveHeight(2.1),
  },

  logoWrapOuter: {
    alignItems: "center",
    marginBottom: responsiveHeight(0.4),
  },

  logoWrapInner: {
    width: logoSize,
    height: logoSize,
    borderRadius: logoSize / 2,
    borderWidth: 3,
    borderColor: "#16D5F0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#16D5F0",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    overflow: "hidden",
  },

  logo: {
    width: logoSize - 16,
    height: logoSize - 16,
    borderRadius: (logoSize - 16) / 2,
    resizeMode: "cover",
  },

  card: {
    borderWidth: 2,
    borderColor: "#12C9EB",
    borderRadius: 22,
    paddingHorizontal: responsiveWidth(6),
    paddingVertical: responsiveHeight(2.2),
    backgroundColor: "#020406",
  },

  fieldLabel: {
    color: "#8D95A5",
    fontSize: 16,
    letterSpacing: 0.9,
    fontWeight: "500",
  },

  fieldValue: {
    marginTop: responsiveHeight(1),
    color: "#F2F4F7",
    fontSize: 28,
    fontWeight: "400",
  },

  fieldSub: {
    color: "#A4ABB8",
    fontSize: 28,
    fontWeight: "400",
  },

  fieldLink: {
    marginTop: responsiveHeight(1),
    color: "#11C8EA",
    fontSize: 28,
    fontWeight: "500",
    textDecorationLine: "underline",
  },

  divider: {
    marginTop: responsiveHeight(1.8),
    marginBottom: responsiveHeight(0.8),
    borderBottomWidth: 1,
    borderBottomColor: "#2C3240",
  },
});

export default ProfileBusinessScreen;