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
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";
import {
  useMadbelListIntegrationCatalogQuery,
  useLazyMadbelStartIntegrationOauthQuery,
  useMadbelDisconnectIntegrationMutation,
  useMadbelConnectWhatsAppManualMutation,
} from "../../redux/slices/madbelApiSlice";

const getPlatformBadge = (platform) => {
  switch (platform) {
    case "facebook_messenger":
      return { badge: "f", bg: "#1877F2" };
    case "instagram":
      return { badge: "IG", bg: "#E4405F" };
    case "whatsapp":
      return { badge: "WA", bg: "#25D366" };
    case "linkedin":
      return { badge: "in", bg: "#0A66C2" };
    case "twitter_x":
      return { badge: "X", bg: "#111111" };
    case "youtube":
      return { badge: "YT", bg: "#FF0000" };
    case "tiktok":
      return { badge: "TT", bg: "#111111" };
    case "pinterest":
      return { badge: "P", bg: "#E60023" };
    case "telegram":
      return { badge: "TG", bg: "#229ED9" };
    case "snapchat":
      return { badge: "SC", bg: "#FFFC00" };
    case "google_business":
      return { badge: "G", bg: "#4285F4" };
    default:
      return { badge: "?", bg: "#455A64" };
  }
};

const getPlatformDesc = (platform) => {
  switch (platform) {
    case "facebook_messenger":
      return "Manage page posts and messenger leads.";
    case "instagram":
      return "Sync visual content and DMs.";
    case "whatsapp":
      return "Customer service & automated replies.";
    case "linkedin":
      return "B2B outreach and company updates.";
    case "twitter_x":
      return "Real-time engagement and support.";
    case "youtube":
      return "Manage comments and video metrics.";
    case "tiktok":
      return "Short-form video engagement.";
    case "pinterest":
      return "Visual discovery and traffic driving.";
    case "telegram":
      return "Broadcast news and direct support.";
    case "snapchat":
      return "Short-form content and analytics.";
    case "google_business":
      return "Manage reviews and business profile.";
    default:
      return "Connect external channels.";
  }
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
        `To connect ${item.platform_label}, please log into the Web Dashboard at your browser and enter the bot token/secret credentials.`,
        [{ text: "OK" }]
      );
      return;
    }

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
      console.error(err);
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
      Alert.alert("Success", "WhatsApp linked successfully. Scan the QR code on your gateway to log in!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.data?.message || "Failed to link WhatsApp manual integration.");
    }
  };

  const handleDisconnectPress = (item) => {
    Alert.alert(
      "Disconnect Integration",
      `Are you sure you want to disconnect ${item.platform_label}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => performDisconnect(item.platform),
        },
      ]
    );
  };

  const performDisconnect = async (platform) => {
    try {
      await disconnectIntegration({ platform }).unwrap();
      refetch();
      Alert.alert("Success", "Integration disconnected successfully.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.data?.message || "Failed to disconnect integration.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={36} color="#F1F7FF" />
          </Pressable>
          <Text style={styles.title}>Connect Your Social{"\n"}Media Platform</Text>
          <View style={styles.backBtn} />
        </View>

        {(isStartingOauth || isDisconnecting || isConnectingWhatsApp) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#16CDE9" />
          </View>
        )}

        {isCatalogLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#16CDE9" />
            <Text style={styles.stateText}>Loading integration catalog...</Text>
          </View>
        ) : isCatalogError ? (
          <View style={styles.centerState}>
            <AlertCircle size={48} color="#FF6B6B" />
            <Text style={styles.stateText}>Failed to load catalog.</Text>
            <Pressable style={styles.retryBtn} onPress={refetch}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {catalog.map((item) => {
              const badgeInfo = getPlatformBadge(item.platform);
              const desc = getPlatformDesc(item.platform);
              const isUnavailable = !item.is_available && item.cta_label === "Unavailable";

              return (
                <View key={item.platform} style={[styles.card, isUnavailable && { opacity: 0.6 }]}>
                  <View style={[styles.badge, { backgroundColor: badgeInfo.bg }]}>
                    <Text style={styles.badgeText}>{badgeInfo.badge}</Text>
                  </View>

                  <View style={styles.meta}>
                    <Text style={styles.name}>{item.platform_label}</Text>
                    <Text style={styles.desc}>{desc}</Text>
                  </View>

                  {item.connected ? (
                    <Pressable
                      style={styles.connectedWrap}
                      onPress={() => {
                        if (item.platform === "google_business") {
                          navigation.navigate("GoogleReviews");
                        } else {
                          handleDisconnectPress(item);
                        }
                      }}
                      onLongPress={() => handleDisconnectPress(item)}
                    >
                      <CheckCircle2 size={24} color="#4DCE63" />
                      <Text style={styles.connectedText}>Connected</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.connectBtn,
                        isUnavailable && styles.connectBtnDisabled
                      ]}
                      onPress={() => !isUnavailable && handleConnect(item)}
                      disabled={isUnavailable}
                    >
                      <Text style={styles.connectText}>
                        {item.cta_label || "Connect"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        <Modal
          animationType="fade"
          transparent={true}
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
                  onPress={() => {
                    setWhatsappModalVisible(false);
                    setWhatsappPhone("");
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSubmit]}
                  onPress={handleWhatsAppConnectSubmit}
                >
                  <Text style={styles.modalSubmitText}>Connect</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    flex: 1,
    backgroundColor: "#020406",
    paddingHorizontal: responsiveWidth(4.6),
    paddingTop: responsiveHeight(0.9),
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.8),
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#F3F9FF",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 36,
  },
  listContent: {
    gap: 12,
    paddingBottom: responsiveHeight(4),
  },
  card: {
    minHeight: 118,
    borderRadius: 22,
    backgroundColor: "#1D1D21",
    borderWidth: 1,
    borderColor: "#2B3442",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#F4FBFF",
    fontSize: 25,
    fontWeight: "700",
  },
  meta: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    color: "#F3F8FF",
    fontSize: 24,
    fontWeight: "600",
  },
  desc: {
    color: "#9BA7BB",
    fontSize: 18,
    marginTop: 2,
    lineHeight: 28,
  },
  connectedWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: responsiveWidth(24),
    justifyContent: "flex-end",
  },
  connectedText: {
    color: "#50D068",
    fontSize: 16,
    fontWeight: "600",
  },
  connectBtn: {
    minWidth: responsiveWidth(28),
    height: 56,
    borderRadius: 18,
    backgroundColor: "#16CDE9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  connectText: {
    color: "#03141E",
    fontSize: 18,
    fontWeight: "600",
  },
  connectBtnDisabled: {
    backgroundColor: "#2B3442",
    opacity: 0.5,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 4, 6, 0.7)",
    zIndex: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
  },
  stateText: {
    color: "#9BA7BB",
    fontSize: 18,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#16CDE9",
    marginTop: 8,
  },
  retryText: {
    color: "#03141E",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#1D1D21",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#2B3442",
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    color: "#F3F9FF",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputLabel: {
    color: "#9BA7BB",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: -8,
  },
  textInput: {
    backgroundColor: "#0C0E12",
    color: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3442",
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  modalBtn: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#2B3442",
  },
  modalBtnSubmit: {
    backgroundColor: "#16CDE9",
  },
  modalCancelText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSubmitText: {
    color: "#03141E",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SocialIntegrationsScreen;
