import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  PhoneCall,
  X,
  CheckCircle,
  ExternalLink,
} from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelGetTwilioStatusQuery,
  useMadbelProvisionTwilioMutation,
  useMadbelSaveCustomTwilioMutation,
  useMadbelRemoveCustomTwilioMutation,
} from "../../redux/slices/madbelApiSlice";

const ACCOUNT_ITEMS = [
  { label: "Change Password", path: "ProfileChangePassword" },
  { label: "Terms & Condition", path: "ProfileTerms" },
  { label: "Privacy Policy", path: "ProfilePrivacy" },
  { label: "About Us", path: "ProfileAbout" },
];

const STEPS = [
  {
    num: "1",
    title: "Create a Twilio account",
    desc: 'Go to twilio.com → Click "Sign Up" → Complete registration (free trial available)',
  },
  {
    num: "2",
    title: "Get your Account SID & Auth Token",
    desc: 'In Twilio Console → Dashboard → Copy "Account SID" and "Auth Token" (click the eye icon to reveal)',
  },
  {
    num: "3",
    title: "Buy a phone number",
    desc: 'Console → Phone Numbers → Manage → Buy a number → Choose a number with "Voice" capability → Buy',
  },
  {
    num: "4",
    title: "Enter details below",
    desc: "Paste your Account SID, Auth Token, and the purchased phone number in E.164 format (e.g. +12025551234)",
  },
];

const CustomTwilioModal = ({ visible, onClose, onSaved }) => {
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saveCustomTwilio, { isLoading }] = useMadbelSaveCustomTwilioMutation();

  const handleSave = async () => {
    if (!accountSid.trim() || !authToken.trim() || !phoneNumber.trim()) {
      Alert.alert("Missing fields", "Please fill in all three fields.");
      return;
    }
    if (!accountSid.trim().startsWith("AC") || accountSid.trim().length !== 34) {
      Alert.alert("Invalid Account SID", "Account SID must start with 'AC' and be 34 characters long.");
      return;
    }
    try {
      await saveCustomTwilio({
        account_sid: accountSid.trim(),
        auth_token: authToken.trim(),
        phone_number: phoneNumber.trim(),
      }).unwrap();
      setAccountSid("");
      setAuthToken("");
      setPhoneNumber("");
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert(
        "Save failed",
        e?.data?.message || "Could not save Twilio credentials. Please check and try again."
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={onClose} style={styles.modalCloseBtn}>
                <X size={24} color="#F3F9FF" />
              </Pressable>
              <Text style={styles.modalTitle}>Connect Your Twilio</Text>
              <View style={{ width: 38 }} />
            </View>

            <Text style={styles.modalSubtitle}>
              Use your own Twilio account for calls. Follow the steps below to get your credentials.
            </Text>

            {/* Step by step guide */}
            <View style={styles.stepsCard}>
              <Text style={styles.stepsHeading}>How to set up</Text>
              {STEPS.map((step) => (
                <View key={step.num} style={styles.stepRow}>
                  <View style={styles.stepNumCircle}>
                    <Text style={styles.stepNum}>{step.num}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.twilioLinkRow}>
                <ExternalLink size={14} color="#12D0ED" />
                <Text style={styles.twilioLink}>twilio.com/console</Text>
              </View>
            </View>

            {/* Input fields */}
            <View style={styles.inputsCard}>
              <Text style={styles.inputsHeading}>Your Twilio credentials</Text>

              <Text style={styles.inputLabel}>Account SID</Text>
              <TextInput
                style={styles.input}
                value={accountSid}
                onChangeText={setAccountSid}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#4A6070"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Auth Token</Text>
              <TextInput
                style={styles.input}
                value={authToken}
                onChangeText={setAuthToken}
                placeholder="Your Auth Token"
                placeholderTextColor="#4A6070"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+12025551234"
                placeholderTextColor="#4A6070"
                keyboardType="phone-pad"
                autoCorrect={false}
              />

              <Text style={styles.inputHint}>
                Your credentials are encrypted and stored securely. We validate them before saving.
              </Text>
            </View>

            <Pressable
              style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#020406" />
              ) : (
                <Text style={styles.saveBtnText}>Validate & Save</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const TwilioSetupCard = () => {
  const { data, isLoading: statusLoading, refetch } = useMadbelGetTwilioStatusQuery();
  const [provisionTwilio, { isLoading: provisioning }] = useMadbelProvisionTwilioMutation();
  const [removeCustom] = useMadbelRemoveCustomTwilioMutation();
  const [customModalVisible, setCustomModalVisible] = useState(false);

  const twilioData = data?.data;
  const platformStatus = twilioData?.twilio_setup_status || "not_provisioned";
  const platformNumber = twilioData?.twilio_phone_number;
  const mode = twilioData?.twilio_mode || "not_set";
  const customNumber = twilioData?.twilio_custom_phone_number;
  const customSid = twilioData?.twilio_custom_account_sid;

  const isProvisioning = platformStatus === "provisioning" || provisioning;

  const handleActivatePlatform = () => {
    Alert.alert(
      "Activate Platform Calling",
      "We'll assign a dedicated phone number to your account automatically. This may take up to 30 seconds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate",
          onPress: async () => {
            try {
              await provisionTwilio().unwrap();
              refetch();
            } catch (e) {
              Alert.alert("Activation failed", e?.data?.message || "Could not activate. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleRemoveCustom = () => {
    Alert.alert(
      "Remove Custom Twilio",
      "Are you sure you want to remove your Twilio credentials?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeCustom().unwrap();
              refetch();
            } catch (e) {
              Alert.alert("Error", e?.data?.message || "Could not remove credentials.");
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <View style={styles.twilioCard}>
        <View style={styles.twilioHeader}>
          <PhoneCall size={17} color="#12D0ED" />
          <Text style={styles.twilioTitle}>Calling Setup</Text>
          {(statusLoading || isProvisioning) && (
            <ActivityIndicator size="small" color="#12D0ED" style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* Option A — Platform number */}
        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>Option A — Platform number</Text>
          <Text style={styles.optionDesc}>We assign a dedicated number automatically. No setup needed.</Text>
          {platformStatus === "active" && platformNumber ? (
            <View style={styles.activeRow}>
              <Phone size={13} color="#2DDD60" />
              <Text style={styles.activeNumber}>{platformNumber}</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>
          ) : isProvisioning ? (
            <Text style={styles.provisioningText}>Setting up your number...</Text>
          ) : (
            <Pressable style={styles.optionBtn} onPress={handleActivatePlatform}>
              <Text style={styles.optionBtnText}>Activate</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.divider} />

        {/* Option B — User's own Twilio */}
        <View style={styles.optionBlock}>
          <Text style={styles.optionLabel}>Option B — Your own Twilio</Text>
          <Text style={styles.optionDesc}>Connect your Twilio account and use your own number.</Text>
          {mode === "custom" && customNumber ? (
            <View>
              <View style={styles.activeRow}>
                <CheckCircle size={13} color="#2DDD60" />
                <Text style={styles.activeNumber}>{customNumber}</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Connected</Text>
                </View>
              </View>
              <Text style={styles.customSidText}>SID: {customSid}</Text>
              <Pressable onPress={handleRemoveCustom} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.optionBtn, styles.optionBtnOutline]}
              onPress={() => setCustomModalVisible(true)}
            >
              <Text style={[styles.optionBtnText, { color: "#12D0ED" }]}>Connect Twilio</Text>
            </Pressable>
          )}
        </View>
      </View>

      <CustomTwilioModal
        visible={customModalVisible}
        onClose={() => setCustomModalVisible(false)}
        onSaved={refetch}
      />
    </>
  );
};

const ProfileAccountSettingsScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>Account Settings</Text>
          <View style={styles.spacer} />
        </View>

        <TwilioSetupCard />

        <View style={styles.card}>
          {ACCOUNT_ITEMS.map((item, index) => (
            <Pressable
              key={item.path}
              onPress={() => navigation.navigate(item.path)}
              style={[styles.row, index < ACCOUNT_ITEMS.length - 1 ? styles.rowBorder : null]}
            >
              <Text style={styles.rowText}>{item.label}</Text>
              <ChevronRight size={30} color="#90A2B7" strokeWidth={2.1} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete Account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.5),
  },
  iconWrap: { width: responsiveWidth(9), alignItems: "flex-start" },
  title: { color: "#F8FAFC", fontSize: 20, fontWeight: "700" },
  spacer: { width: responsiveWidth(9) },

  // Twilio card
  twilioCard: {
    borderRadius: 18,
    backgroundColor: "#0E1520",
    borderWidth: 1,
    borderColor: "#1A2E40",
    padding: 16,
    marginBottom: 14,
  },
  twilioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  twilioTitle: { color: "#B8D4E0", fontSize: 14, fontWeight: "700", flex: 1 },
  optionBlock: { gap: 6 },
  optionLabel: { color: "#CFE6EE", fontSize: 13, fontWeight: "600" },
  optionDesc: { color: "#5A7A8A", fontSize: 12, lineHeight: 17 },
  divider: { height: 1, backgroundColor: "#1A2E40", marginVertical: 14 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
  activeNumber: { color: "#F4FAFF", fontSize: 15, fontWeight: "700", flex: 1 },
  activeBadge: {
    backgroundColor: "#0F3320",
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  activeBadgeText: { color: "#2DDD60", fontSize: 11, fontWeight: "600" },
  customSidText: { color: "#4A6070", fontSize: 11, marginTop: 3 },
  provisioningText: { color: "#F5A623", fontSize: 12, marginTop: 6 },
  optionBtn: {
    backgroundColor: "#12D0ED",
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 8,
  },
  optionBtnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#12D0ED" },
  optionBtnText: { color: "#020406", fontSize: 13, fontWeight: "700" },
  removeBtn: { marginTop: 6 },
  removeBtnText: { color: "#FC4C58", fontSize: 12 },

  // Account items card
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1B1C21",
    borderWidth: 1,
    borderColor: "#212530",
    marginBottom: 14,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#292D37" },
  rowText: { color: "#F2F4F7", fontSize: 15, fontWeight: "400" },
  deleteBtn: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#212530",
    backgroundColor: "#1B1C21",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#FC4C58", fontSize: 15, fontWeight: "600" },

  // Modal styles
  modalSafe: { flex: 1, backgroundColor: "#020406" },
  modalScroll: { flex: 1 },
  modalContent: { paddingHorizontal: 20, paddingBottom: 40 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 4,
  },
  modalCloseBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  modalTitle: { color: "#F4FAFF", fontSize: 18, fontWeight: "700" },
  modalSubtitle: { color: "#7A9BAD", fontSize: 13, lineHeight: 19, marginBottom: 20 },

  // Steps
  stepsCard: {
    backgroundColor: "#0D1A24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A2E40",
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  stepsHeading: { color: "#12D0ED", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  stepRow: { flexDirection: "row", gap: 12 },
  stepNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0F3040",
    borderWidth: 1,
    borderColor: "#12D0ED",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNum: { color: "#12D0ED", fontSize: 12, fontWeight: "700" },
  stepBody: { flex: 1, gap: 3 },
  stepTitle: { color: "#CFE6EE", fontSize: 13, fontWeight: "600" },
  stepDesc: { color: "#5A7A8A", fontSize: 12, lineHeight: 17 },
  twilioLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  twilioLink: { color: "#12D0ED", fontSize: 12 },

  // Input fields
  inputsCard: {
    backgroundColor: "#0D1A24",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1A2E40",
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  inputsHeading: { color: "#CFE6EE", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  inputLabel: { color: "#7A9BAD", fontSize: 12, fontWeight: "500", marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: "#111C26",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E3040",
    color: "#F0F8FF",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  inputHint: { color: "#3A5060", fontSize: 11, lineHeight: 16, marginTop: 10 },
  saveBtn: {
    backgroundColor: "#12D0ED",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#020406", fontSize: 15, fontWeight: "700" },
});

export default ProfileAccountSettingsScreen;
