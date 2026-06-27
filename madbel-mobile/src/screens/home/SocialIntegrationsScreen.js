import React, { useState, useEffect, useRef } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  TextInput,
  AppState,
} from "react-native";
import { CheckCircle2, ChevronLeft, AlertCircle } from "lucide-react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelListIntegrationCatalogQuery,
  useLazyMadbelStartIntegrationOauthQuery,
  useMadbelDisconnectIntegrationMutation,
  useMadbelConnectWhatsAppManualMutation,
} from "../../redux/slices/madbelApiSlice";

const PLATFORM_META = {
  facebook_messenger: {
    label: "Facebook",
    symbol: "f",
    symbolSize: 22,
    bg: "#1877F2",
    symbolColor: "#fff",
    border: "#0d5fc4",
  },
  instagram: {
    label: "Instagram",
    symbol: "▣",
    symbolSize: 20,
    bg: "linear",
    gradientColors: ["#833AB4", "#E1306C", "#F77737"],
    bg: "#C13584",
    symbolColor: "#fff",
    border: "#9b2a6e",
  },
  whatsapp: {
    label: "WhatsApp",
    symbol: "✆",
    symbolSize: 22,
    bg: "#25D366",
    symbolColor: "#fff",
    border: "#1aac54",
  },
  linkedin: {
    label: "LinkedIn",
    symbol: "in",
    symbolSize: 16,
    bg: "#0A66C2",
    symbolColor: "#fff",
    border: "#074f9b",
  },
  twitter_x: {
    label: "X (Twitter)",
    symbol: "𝕏",
    symbolSize: 18,
    bg: "#000000",
    symbolColor: "#fff",
    border: "#333",
  },
  telegram: {
    label: "Telegram",
    symbol: "✈",
    symbolSize: 20,
    bg: "#229ED9",
    symbolColor: "#fff",
    border: "#1a7fad",
  },
  snapchat: {
    label: "Snapchat",
    symbol: "👻",
    symbolSize: 20,
    bg: "#FFFC00",
    symbolColor: "#000",
    border: "#d9d900",
  },
  google_business: {
    label: "Google Business",
    symbol: "G",
    symbolSize: 22,
    bg: "#4285F4",
    symbolColor: "#fff",
    border: "#2a6fd6",
  },
  threads: {
    label: "Threads",
    symbol: "@",
    symbolSize: 22,
    bg: "#101010",
    symbolColor: "#fff",
    border: "#333",
  },
  youtube: {
    label: "YouTube",
    symbol: "▶",
    symbolSize: 20,
    bg: "#FF0000",
    symbolColor: "#fff",
    border: "#cc0000",
  },
  tiktok: {
    label: "TikTok",
    symbol: "♪",
    symbolSize: 20,
    bg: "#010101",
    symbolColor: "#fff",
    border: "#333",
  },
  pinterest: {
    label: "Pinterest",
    symbol: "P",
    symbolSize: 22,
    bg: "#E60023",
    symbolColor: "#fff",
    border: "#b8001c",
  },
};

const getPlatformDesc = (platform) => {
  const descs = {
    facebook_messenger: "Manage page posts and messenger leads.",
    instagram: "Sync visual content and DMs.",
    whatsapp: "Customer service & automated replies.",
    linkedin: "B2B outreach and company updates.",
    twitter_x: "Real-time engagement and support.",
    youtube: "Manage comments and video metrics.",
    tiktok: "Short-form video engagement.",
    pinterest: "Visual discovery and traffic driving.",
    telegram: "Broadcast news and direct support.",
    snapchat: "Short-form content and analytics.",
    google_business: "Manage reviews and business profile.",
    threads: "Publish posts and manage replies.",
  };
  return descs[platform] || "Connect external channels.";
};

const PlatformIcon = ({ platform }) => {
  const meta = PLATFORM_META[platform] || {
    symbol: "?",
    symbolSize: 20,
    bg: "#455A64",
    symbolColor: "#fff",
    border: "#333",
  };
  return (
    <View style={[styles.iconWrap, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <Text style={[styles.iconSymbol, { fontSize: meta.symbolSize, color: meta.symbolColor }]}>
        {meta.symbol}
      </Text>
    </View>
  );
};

const SocialIntegrationsScreen = () => {
  const navigation = useNavigation();

  const {
    data: catalogResponse,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch,
  } = useMadbelListIntegrationCatalogQuery();

  const [triggerOauthStart, { isFetching: isStartingOauth }] = useLazyMadbelStartIntegrationOauthQuery();
  const [disconnectIntegration, { isLoading: isDisconnecting }] = useMadbelDisconnectIntegrationMutation();
  const [connectWhatsAppManual, { isLoading: isConnectingWhatsApp }] = useMadbelConnectWhatsAppManualMutation();

  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappGatewayUrl, setWhatsappGatewayUrl] = useState("http://localhost:3001");

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        refetch();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [refetch]);

  const catalog = catalogResponse?.data || [];

  const handleConnect = async (item) => {
    if (item.platform === "whatsapp") {
      setWhatsappModalVisible(true);
      return;
    }
    if (item.auth_mode === "manual") {
      Alert.alert(
        "Manual Setup Required",
        `To connect ${item.platform_label}, please log into the Web Dashboard and enter the credentials.`,
        [{ text: "OK" }]
      );
      return;
    }
    if (item.platform === "instagram") {
      Alert.alert(
        "Instagram uses Facebook Login",
        "Instagram Business accounts are managed through Meta. You'll be redirected to Facebook to authorize access to your connected Instagram account.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => _startOauth(item) },
        ]
      );
      return;
    }
    _startOauth(item);
  };

  const _startOauth = async (item) => {
    try {
      const res = await triggerOauthStart({ platform: item.platform }).unwrap();
      const authUrl = res?.data?.auth_url || res?.auth_url;
      if (authUrl) {
        const supported = await Linking.canOpenURL(authUrl);
        if (supported) {
          await Linking.openURL(authUrl);
        } else {
          Alert.alert("Error", "Cannot open authorization URL on this device.");
        }
      } else {
        Alert.alert("Error", "Did not receive authorization URL from server.");
      }
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Failed to initiate connection.");
    }
  };

  const handleWhatsAppConnectSubmit = async () => {
    const trimmedPhone = whatsappPhone.trim();
    if (!trimmedPhone) {
      Alert.alert("Error", "Please enter a valid phone number.");
      return;
    }
    try {
      await connectWhatsAppManual({
        phone_number: trimmedPhone,
        whatsapp_gateway_url: whatsappGatewayUrl.trim() || "http://localhost:3001",
      }).unwrap();
      setWhatsappModalVisible(false);
      setWhatsappPhone("");
      refetch();
      Alert.alert("Success", "WhatsApp linked successfully!");
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Failed to link WhatsApp.");
    }
  };

  const handleDisconnectPress = (item) => {
    Alert.alert(
      "Disconnect",
      `Disconnect ${item.platform_label}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => performDisconnect(item.platform) },
      ]
    );
  };

  const performDisconnect = async (platform) => {
    try {
      await disconnectIntegration({ platform }).unwrap();
      refetch();
      Alert.alert("Success", "Integration disconnected.");
    } catch (err) {
      Alert.alert("Error", err?.data?.message || "Failed to disconnect.");
    }
  };

  const isLoading = isStartingOauth || isDisconnecting || isConnectingWhatsApp;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={28} color="#F1F7FF" />
        </Pressable>
        <Text style={styles.title}>Connect Social Media</Text>
        <View style={styles.backBtn} />
      </View>

      {isCatalogLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#16CDE9" />
          <Text style={styles.stateText}>Loading platforms...</Text>
        </View>
      ) : isCatalogError ? (
        <View style={styles.centerState}>
          <AlertCircle size={40} color="#FF6B6B" />
          <Text style={styles.stateText}>Failed to load platforms.</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={styles.scrollView}
        >
            {catalog.map((item) => {
              const desc = getPlatformDesc(item.platform);
              const isUnavailable = !item.is_available && item.cta_label === "Unavailable";
              const meta = PLATFORM_META[item.platform];
              const platformLabel = meta?.label || item.platform_label;

              return (
                <View
                  key={item.platform}
                  style={[styles.card, isUnavailable && styles.cardUnavailable]}
                >
                  <PlatformIcon platform={item.platform} />

                  <View style={styles.cardMeta}>
                    <Text style={styles.cardName} numberOfLines={1}>{platformLabel}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{desc}</Text>
                  </View>

                  {item.connected ? (
                    <Pressable
                      style={styles.connectedBtn}
                      onPress={() => {
                        if (item.platform === "google_business") {
                          navigation.navigate("GoogleReviews");
                        } else {
                          handleDisconnectPress(item);
                        }
                      }}
                      onLongPress={() => handleDisconnectPress(item)}
                    >
                      <CheckCircle2 size={16} color="#4DCE63" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.connectBtn, isUnavailable && styles.connectBtnDisabled]}
                      onPress={() => !isUnavailable && handleConnect(item)}
                      disabled={isUnavailable}
                    >
                      <Text style={styles.connectText}>
                        {isUnavailable ? "Soon" : "Connect"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* WhatsApp Modal */}
        <Modal
          animationType="fade"
          transparent
          visible={whatsappModalVisible}
          onRequestClose={() => setWhatsappModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Connect WhatsApp</Text>

              <Text style={styles.inputLabel}>WhatsApp Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 8801700000000"
                placeholderTextColor="#70829B"
                value={whatsappPhone}
                onChangeText={setWhatsappPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Gateway URL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="http://localhost:3001"
                placeholderTextColor="#70829B"
                value={whatsappGatewayUrl}
                onChangeText={setWhatsappGatewayUrl}
              />

              <View style={styles.modalBtnRow}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => { setWhatsappModalVisible(false); setWhatsappPhone(""); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={handleWhatsAppConnectSubmit}>
                  <Text style={styles.modalSubmitText}>Connect</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(4),
    paddingTop: responsiveHeight(0.5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.5),
    paddingVertical: responsiveHeight(0.5),
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F3F9FF",
    fontSize: responsiveWidth(5),
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  scrollView: {
    flex: 1,
    marginBottom: responsiveHeight(10)
  },
  listContent: {
    gap: responsiveHeight(1.2),
    paddingBottom: responsiveHeight(4),
  },
  card: {
    borderRadius: 16,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#1E2530",
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1.4),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(3),
  },
  cardUnavailable: { opacity: 0.5 },
  iconWrap: {
    width: responsiveWidth(13),
    height: responsiveWidth(13),
    borderRadius: responsiveWidth(3.5),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  iconSymbol: {
    fontWeight: "800",
    textAlign: "center",
  },
  cardMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 3,
  },
  cardName: {
    color: "#F0F6FF",
    fontSize: responsiveWidth(4),
    fontWeight: "700",
  },
  cardDesc: {
    color: "#6B7A90",
    fontSize: responsiveWidth(3.2),
    lineHeight: responsiveWidth(4.5),
  },
  connectedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0D2318",
    paddingHorizontal: responsiveWidth(3),
    paddingVertical: responsiveHeight(0.8),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1a4a2e",
  },
  connectedText: {
    color: "#4DCE63",
    fontSize: responsiveWidth(3.2),
    fontWeight: "600",
  },
  connectBtn: {
    backgroundColor: "#16CDE9",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1),
    borderRadius: 20,
    minWidth: responsiveWidth(20),
    alignItems: "center",
  },
  connectBtnDisabled: {
    backgroundColor: "#1E2530",
  },
  connectText: {
    color: "#03141E",
    fontSize: responsiveWidth(3.4),
    fontWeight: "700",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
  },
  stateText: {
    color: "#9BA7BB",
    fontSize: 15,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#16CDE9",
  },
  retryText: { color: "#03141E", fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "88%",
    backgroundColor: "#111318",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E2530",
    padding: 22,
    gap: 14,
  },
  modalTitle: { color: "#F3F9FF", fontSize: 20, fontWeight: "700" },
  inputLabel: { color: "#9BA7BB", fontSize: 13, fontWeight: "600", marginBottom: -6 },
  textInput: {
    backgroundColor: "#0C0E12",
    color: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2530",
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalBtnCancel: { backgroundColor: "#1E2530" },
  modalBtnSubmit: { backgroundColor: "#16CDE9" },
  modalCancelText: { color: "#F8FAFC", fontSize: 15, fontWeight: "600" },
  modalSubmitText: { color: "#03141E", fontSize: 15, fontWeight: "600" },
});

export default SocialIntegrationsScreen;
