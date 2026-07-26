import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  AppState,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ChevronLeft,
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
} from "lucide-react-native";
import { useSelector } from "react-redux";
import {
  useLazyMadbelGetAgreementDocusignStatusQuery,
  useLazyMadbelStartAgreementDocusignOauthQuery,
  useMadbelGetLeaseQuery,
  useMadbelReviewLeaseMutation,
  useMadbelSendLeaseForSignatureMutation,
  useMadbelSignLeaseMutation,
} from "../../redux/slices/madbelApiSlice";
import {
  downloadAndOpenProtectedPdf,
  normalizeProtectedFileUrl,
} from "../../utils/downloadPdf";

const STATUS_TONE_MAP = {
  pending_signature: {
    text: "PENDING SIGNATURE",
    color: "#F4D52B",
    border: "#7A6B06",
    bg: "#302C13",
  },
  signed: {
    text: "SIGNED",
    color: "#37E088",
    border: "#1B6F4D",
    bg: "#0F3426",
  },
  draft: { text: "DRAFT", color: "#9EC4FF", border: "#40506A", bg: "#253041" },
  expired: {
    text: "EXPIRED",
    color: "#FF5E74",
    border: "#703341",
    bg: "#3A1920",
  },
};

const SIGNING_PROVIDER = "docusign";

const formatDate = (value) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMoney = (value) => {
  if (value === undefined || value === null || value === "") return "--";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `$${numeric.toLocaleString()}`;
};

const resolveSigningUrl = (response) =>
  response?.signing_url ||
  response?.data?.signing_url ||
  response?.data?.data?.signing_url ||
  response?.sign_url ||
  response?.data?.sign_url ||
  response?.data?.data?.sign_url ||
  null;

const resolveSigningToken = (response) =>
  response?.signature_token ||
  response?.signatureToken ||
  response?.signing_token ||
  response?.signingToken ||
  response?.data?.signature_token ||
  response?.data?.signatureToken ||
  response?.data?.signing_token ||
  response?.data?.signingToken ||
  response?.data?.data?.signature_token ||
  response?.data?.data?.signatureToken ||
  response?.data?.data?.signing_token ||
  response?.data?.data?.signingToken ||
  null;

const resolveDocusignStatus = (response) =>
  response?.data?.data || response?.data || response || null;

const resolveAuthUrl = (response) =>
  response?.data?.data?.auth_url ||
  response?.data?.auth_url ||
  response?.auth_url ||
  null;

const resolveLeasePublicPdfUrl = (lease) => {
  // The signing-token PDF route is only served by the backend while the
  // signature request is still pending; once signed/expired it 404s
  // (SIGNATURE_REQUEST_NOT_FOUND), so only use it in that window.
  if (String(lease?.status || "").toLowerCase() !== "pending_signature") return null;
  return normalizeProtectedFileUrl(
    lease?.signature_request_url ||
      lease?.data?.signature_request_url ||
      null,
  );
};

const LeasePreviewScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const routeLease = route?.params?.lease || {};
  const leaseId = route?.params?.leaseId || routeLease?.id || routeLease?._id;
  const { data: leaseResponse, isLoading: loadingLease } =
    useMadbelGetLeaseQuery({ lease_id: leaseId }, { skip: !leaseId });
  const lease = leaseResponse?.data || routeLease;

  const statusTone =
    STATUS_TONE_MAP[
      String(lease?.status || "pending_signature").toLowerCase()
    ] || STATUS_TONE_MAP.pending_signature;

  const [showSendModal, setShowSendModal] = useState(false);
  const [signatureProvider, setSignatureProvider] = useState(
    lease?.signing_provider || SIGNING_PROVIDER || "native",
  );
  const [recipientName, setRecipientName] = useState(lease?.tenant_name || "");
  const [recipientEmail, setRecipientEmail] = useState(
    lease?.tenant_email || "",
  );
  const [recipientPhone, setRecipientPhone] = useState(
    lease?.tenant_phone || "",
  );

  const authUser = useSelector((state) => state?.auth?.user || {});
  const [showSignModal, setShowSignModal] = useState(false);
  const [signerName, setSignerName] = useState(
    authUser?.full_name || authUser?.name || "",
  );
  const [signerEmail, setSignerEmail] = useState(authUser?.email || "");
  const [signatureText, setSignatureText] = useState("");

  const [reviewLease, { isLoading: reviewingLease }] =
    useMadbelReviewLeaseMutation();
  const [sendForSignature, { isLoading: sendingForSignature }] =
    useMadbelSendLeaseForSignatureMutation();
  const [startDocusignOauth] = useLazyMadbelStartAgreementDocusignOauthQuery();
  const [triggerDocusignStatus, { data: docusignStatusResponse }] =
    useLazyMadbelGetAgreementDocusignStatusQuery();
  const [signLease, { isLoading: signingLease }] = useMadbelSignLeaseMutation();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const accessToken = useSelector(
    (state) => state?.auth?.accessToken || state?.auth?.token,
  );
  const appState = useRef(AppState.currentState);
  const docusignStatus = resolveDocusignStatus(docusignStatusResponse);

  useEffect(() => {
    setSignatureProvider(
      lease?.signing_provider || SIGNING_PROVIDER || "native",
    );
  }, [lease?.id, lease?.signing_provider]);

  useEffect(() => {
    if (!showSendModal || signatureProvider !== "docusign") return undefined;

    void triggerDocusignStatus();
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        void triggerDocusignStatus();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, [showSendModal, signatureProvider, triggerDocusignStatus]);

  const handleConnectDocusign = async () => {
    try {
      const response = await startDocusignOauth().unwrap();
      const authUrl = resolveAuthUrl(response);
      if (!authUrl) {
        Alert.alert(
          "Unavailable",
          "Did not receive a DocuSign authorization URL from the server.",
        );
        return;
      }
      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        Alert.alert(
          "Unavailable",
          "This device cannot open the DocuSign authorization link.",
        );
        return;
      }
      await Linking.openURL(authUrl);
    } catch (error) {
      Alert.alert(
        "Connection failed",
        error?.data?.message || "Could not start DocuSign connection.",
      );
    }
  };

  const handleDirectSign = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      Alert.alert(
        t("missing_fields"),
        t("signer_name_and_signature_text_are_required"),
      );
      return;
    }
    try {
      await signLease({
        lease_id: leaseId,
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || undefined,
        signature_text: signatureText.trim(),
      }).unwrap();
      setShowSignModal(false);
      Alert.alert(t("success"), t("lease_signed_successfully"));
    } catch (error) {
      Alert.alert(
        "Signature failed",
        error?.data?.message || "Could not sign the lease.",
      );
    }
  };

  const reviewItems = useMemo(
    () => lease?.ai_review || lease?.review || [],
    [lease?.ai_review, lease?.review],
  );

  const handleRunReview = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    try {
      await reviewLease({ lease_id: leaseId }).unwrap();
      Alert.alert(t("review_complete"), t("lease_review_has_been_updated"));
    } catch (error) {
      Alert.alert(
        "Review failed",
        error?.data?.message || "Could not review the lease.",
      );
    }
  };

  const handleSendForSignature = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    if (signatureProvider === "docusign" && !docusignStatus?.connected) {
      Alert.alert(
        "Connect DocuSign",
        "Connect DocuSign before sending with DocuSign.",
      );
      return;
    }
    try {
      const payload = {
        lease_id: leaseId,
        recipient_name: recipientName.trim() || undefined,
        recipient_email: recipientEmail.trim() || undefined,
        recipient_phone: recipientPhone.trim() || undefined,
        channel: recipientEmail.trim() ? "email" : "link",
        provider: signatureProvider,
        signing_provider: signatureProvider,
      };
      const response = await sendForSignature(payload).unwrap();
      const signingUrl = resolveSigningUrl(response);
      const signingToken = resolveSigningToken(response);
      setShowSendModal(false);
      Alert.alert(t("sent"), t("lease_sent_for_signature"));
      if (signingUrl) {
        const canOpen = await Linking.canOpenURL(signingUrl);
        if (canOpen) {
          await Linking.openURL(signingUrl);
        }
      } else if (signingToken) {
        navigation.navigate("PublicSigning", {
          documentType: "lease",
          signatureToken: signingToken,
        });
      }
    } catch (error) {
      Alert.alert(
        "Send failed",
        error?.data?.message || "Could not send lease for signature.",
      );
    }
  };

  const handleDownloadPdf = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    try {
      setDownloadingPdf(true);
      const pdfUrl =
        resolveLeasePublicPdfUrl(lease) ||
        normalizeProtectedFileUrl(lease?.pdf_url) ||
        normalizeProtectedFileUrl(`/api/v1/smartflow/leases/${leaseId}/pdf`);
      if (!pdfUrl) {
        Alert.alert(t("pdf_unavailable"), t("could_not_generate_pdf_link"));
        return;
      }
      const localUri = await downloadAndOpenProtectedPdf({
        url: pdfUrl,
        accessToken,
        filePrefix: `lease-${leaseId}`,
      });
      if (localUri) {
        await Linking.openURL(localUri);
      }
      Alert.alert("Downloaded", "Lease PDF downloaded successfully.");
    } catch (error) {
      Alert.alert(
        t("download_failed"),
        error?.data?.message ||
          error?.message ||
          t("could_not_open_the_lease_pdf"),
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEditLease = () => {
    if (!leaseId && !lease?.id) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }

    navigation.navigate("NewLease", {
      mode: "edit",
      leaseId: leaseId || lease?.id,
      lease,
    });
  };

  if (loadingLease && !lease?.id) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#11CDE8" size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()}>
              <ChevronLeft size={34} color="#F5FAFF" />
            </Pressable>
            <Text style={styles.headerTitle}>{t("lease_preview")}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.editBtn} onPress={handleEditLease}>
              <Text style={styles.editBtnText}>
                {t("edit_lease", "Edit Lease")}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <ActivityIndicator color="#D7E8FF" />
              ) : (
                <Download size={24} color="#D7E8FF" />
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.statusPill,
              {
                borderColor: statusTone.border,
                backgroundColor: statusTone.bg,
              },
            ]}
          >
            <ClipboardCheck size={18} color={statusTone.color} />
            <Text style={[styles.statusText, { color: statusTone.color }]}>
              {statusTone.text}
            </Text>
          </View>

          <View style={styles.docCard}>
            <Text style={styles.docTitle}>
              Residential Lease{"\n"}Agreement
            </Text>
            <View style={styles.docDivider} />
            <Text style={styles.docText}>{lease?.content}</Text>
          </View>

          {lease.status !== "active" && lease.status !== "signed" ? (
            <View style={styles.btnRow}>
              <Pressable
                style={[styles.sendBtn, { flex: 1 }]}
                onPress={() => setShowSendModal(true)}
              >
                <Text style={styles.sendText}>{t("send_for_signature")}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.sendBtn}
              onPress={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? (
                <ActivityIndicator color="#EAF8FF" />
              ) : (
                <Text style={styles.sendText}>{t("download_signed_pdf")}</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showSendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("send_for_signature")}</Text>
              <Pressable onPress={() => setShowSendModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>Signature provider</Text>
            <View style={styles.providerRow}>
              <Pressable
                onPress={() => setSignatureProvider("native")}
                style={[
                  styles.providerChip,
                  signatureProvider === "native" && styles.providerChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.providerChipText,
                    signatureProvider === "native" &&
                      styles.providerChipTextActive,
                  ]}
                >
                  Native
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSignatureProvider("docusign")}
                style={[
                  styles.providerChip,
                  signatureProvider === "docusign" && styles.providerChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.providerChipText,
                    signatureProvider === "docusign" &&
                      styles.providerChipTextActive,
                  ]}
                >
                  DocuSign
                </Text>
              </Pressable>
            </View>
            {signatureProvider === "docusign" ? (
              <View style={styles.providerStatusCard}>
                <Text style={styles.providerStatusText}>
                  DocuSign status:{" "}
                  {docusignStatus?.connection_status || "disconnected"}
                </Text>
                {docusignStatus?.connected ? (
                  <Text style={styles.providerStatusSubText}>
                    Connected to {docusignStatus?.account_name || "DocuSign"}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.providerStatusSubText}>
                      {docusignStatus?.last_error ||
                        "DocuSign is not connected yet."}
                    </Text>
                    <Pressable
                      style={styles.connectBtn}
                      onPress={handleConnectDocusign}
                    >
                      <Text style={styles.connectBtnText}>
                        Connect DocuSign
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.providerHint}>
                Use the existing Mabdel signing link flow.
              </Text>
            )}
            <Text style={styles.modalLabel}>{t("recipient_details")}</Text>
            <Text style={styles.fieldLabel}>{t("name")}</Text>
            <TextInput
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder={t("full_name")}
              placeholderTextColor="#5D687D"
              style={styles.modalInput}
            />
            <Text style={styles.fieldLabel}>{t("email")}</Text>
            <TextInput
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              placeholder={t("email_example_com")}
              placeholderTextColor="#5D687D"
              style={styles.modalInput}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>{t("phone_optional")}</Text>
            <TextInput
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              placeholder="+1 234 567 890"
              placeholderTextColor="#5D687D"
              style={styles.modalInput}
            />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowSendModal(false)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.modalSendBtn}
                onPress={handleSendForSignature}
                disabled={
                  sendingForSignature ||
                  (signatureProvider === "docusign" &&
                    !docusignStatus?.connected)
                }
              >
                {sendingForSignature ? (
                  <ActivityIndicator color="#EAF8FF" />
                ) : (
                  <Text style={styles.modalSendText}>{t("send_document")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    marginTop: responsiveHeight(0.8),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  headerTitle: { color: "#F4F8FF", fontSize: 46 / 2, fontWeight: "700" },
  editBtn: {
    minHeight: responsiveHeight(4.2),
    paddingHorizontal: responsiveWidth(3.2),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#11CDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: { color: "#11CDE8", fontSize: 14, fontWeight: "700" },
  content: {
    paddingTop: responsiveHeight(1.4),
    paddingBottom: responsiveHeight(8),
    gap: responsiveHeight(1.4),
  },
  statusPill: {
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(1.6),
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(0.6),
  },
  statusText: { fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  docCard: {
    borderRadius: 18,
    backgroundColor: "#F2F4F7",
    padding: responsiveWidth(4.2),
  },
  docTitle: {
    color: "#202937",
    fontSize: 40 / 2,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 34,
  },
  docDivider: {
    height: 1,
    backgroundColor: "#D8DDE4",
    marginVertical: responsiveHeight(1.5),
  },
  docText: { color: "#303A49", fontSize: 18, lineHeight: 30 },
  partyBox: {
    marginTop: responsiveHeight(1.1),
    borderRadius: 10,
    backgroundColor: "#ECEFF3",
    padding: responsiveWidth(3),
  },
  partyLabel: { color: "#818E9F", fontSize: 13, fontWeight: "700" },
  partyName: {
    color: "#1F2836",
    fontSize: 20 / 2,
    fontWeight: "700",
    marginTop: responsiveHeight(0.3),
  },
  section: {
    marginTop: responsiveHeight(1.3),
    marginBottom: responsiveHeight(0.4),
    color: "#1F2734",
    fontSize: 36 / 2,
    fontWeight: "800",
  },
  signBlock: {
    marginTop: responsiveHeight(1.1),
    minHeight: responsiveHeight(7),
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#EBCF49",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9F5DE",
  },
  signHint: { color: "#CCBC7A", fontSize: 19 },
  signTag: {
    position: "absolute",
    left: responsiveWidth(3),
    bottom: -12,
    color: "#D8B63E",
    fontSize: 13,
    backgroundColor: "#F8EFC5",
    paddingHorizontal: responsiveWidth(1),
  },
  signedBlock: {
    marginTop: responsiveHeight(1.1),
    minHeight: responsiveHeight(7),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1B6F4D",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAFBF3",
  },
  signedText: { color: "#1B6F4D", fontSize: 18, fontWeight: "700" },
  signedSubText: { color: "#278961", fontSize: 14 },
  btnRow: {
    flexDirection: "row",
    gap: responsiveWidth(3),
    width: "100%",
    marginBottom: responsiveHeight(5),
  },
  signBtn: {
    flex: 1,
    minHeight: responsiveHeight(6.4),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#11CDE8",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  signBtnText: { color: "#11CDE8", fontSize: 20 / 2, fontWeight: "700" },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#283245",
    backgroundColor: "#1B1E24",
    overflow: "hidden",
  },
  reviewHeader: {
    minHeight: responsiveHeight(6.4),
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    backgroundColor: "#1A2436",
  },
  reviewTitle: { color: "#E7EEF9", fontSize: 20 / 2 },
  reviewRefresh: {
    marginLeft: "auto",
    minHeight: responsiveHeight(3.2),
    minWidth: responsiveWidth(18),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2D455E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(2.5),
  },
  reviewRefreshText: { color: "#9CD8E7", fontSize: 13, fontWeight: "700" },
  reviewItem: {
    flexDirection: "row",
    gap: responsiveWidth(2.4),
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1),
  },
  reviewItemTitle: { color: "#EAF2FF", fontWeight: "600", fontSize: 18 / 2 },
  reviewItemSub: { color: "#7F8BA0", fontSize: 15 / 2, marginTop: 2 },
  warningCard: {
    marginHorizontal: responsiveWidth(4),
    marginBottom: responsiveHeight(0.8),
    padding: responsiveWidth(3),
    borderRadius: 12,
    backgroundColor: "#222A39",
    flexDirection: "row",
    gap: responsiveWidth(2.4),
  },
  warningTitle: { color: "#E8EDF7", fontWeight: "700", fontSize: 18 / 2 },
  warningSub: { color: "#A5B2C7", fontSize: 15 / 2, marginTop: 2 },
  sendBtn: {
    minHeight: responsiveHeight(6.4),
    borderRadius: 14,
    backgroundColor: "#11CDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "#EAF8FF", fontSize: 19, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(4),
  },
  modalCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#313847",
    backgroundColor: "#1B1E24",
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(1.5),
    paddingBottom: responsiveHeight(2.2),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { color: "#F2F7FF", fontSize: 44 / 2, fontWeight: "700" },
  modalDivider: {
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(1.5),
    height: 1,
    backgroundColor: "#2F3747",
  },
  modalLabel: {
    color: "#9DD8EC",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 3,
    marginBottom: responsiveHeight(0.6),
  },
  providerRow: {
    flexDirection: "row",
    gap: responsiveWidth(2.4),
    marginBottom: responsiveHeight(1),
  },
  providerChip: {
    minHeight: responsiveHeight(4.6),
    paddingHorizontal: responsiveWidth(3.8),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2A3445",
    backgroundColor: "#121722",
    alignItems: "center",
    justifyContent: "center",
  },
  providerChipActive: { borderColor: "#12CDEA", backgroundColor: "#0D2230" },
  providerChipText: { color: "#9AB0C8", fontSize: 14, fontWeight: "700" },
  providerChipTextActive: { color: "#11CDE8" },
  providerStatusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A3445",
    backgroundColor: "#121722",
    padding: responsiveWidth(3.8),
    marginBottom: responsiveHeight(1.4),
  },
  providerStatusText: { color: "#D6E3F5", fontSize: 15, fontWeight: "700" },
  providerStatusSubText: {
    color: "#8FA1B9",
    fontSize: 14,
    marginTop: responsiveHeight(0.5),
  },
  providerHint: {
    color: "#8FA1B9",
    fontSize: 14,
    marginBottom: responsiveHeight(1.4),
  },
  connectBtn: {
    marginTop: responsiveHeight(1),
    minHeight: responsiveHeight(5),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#12CDEA",
    alignItems: "center",
    justifyContent: "center",
  },
  connectBtnText: { color: "#11CDE8", fontWeight: "700", fontSize: 15 },
  fieldLabel: {
    color: "#C2CCDA",
    fontSize: 20,
    marginBottom: responsiveHeight(0.5),
    marginTop: responsiveHeight(0.6),
  },
  modalInput: {
    minHeight: responsiveHeight(6.3),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#344153",
    backgroundColor: "#1A1D24",
    color: "#EAF2FF",
    paddingHorizontal: responsiveWidth(4),
    fontSize: 18,
  },
  modalFooter: {
    marginTop: responsiveHeight(2.2),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cancelText: { color: "#D0D8E4", fontSize: 20 },
  modalSendBtn: {
    minHeight: responsiveHeight(6),
    minWidth: responsiveWidth(44),
    borderRadius: 13,
    backgroundColor: "#19CDEC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(3),
  },
  modalSendText: { color: "#EAF8FF", fontSize: 22, fontWeight: "700" },
});

export default LeasePreviewScreen;
