import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, TextInput, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, ClipboardCheck, Sparkles, CheckCircle2, AlertTriangle, X, Download } from "lucide-react-native";
import { useSelector } from "react-redux";
import {
  useLazyMadbelDownloadLeasePdfQuery,
  useMadbelGetLeaseQuery,
  useMadbelReviewLeaseMutation,
  useMadbelSendLeaseForSignatureMutation,
  useMadbelSignLeaseMutation,
} from "../../redux/slices/madbelApiSlice";
import { API_BASE_URL } from "../../redux/apiUtils";

const STATUS_TONE_MAP = {
  pending_signature: { text: "PENDING SIGNATURE", color: "#F4D52B", border: "#7A6B06", bg: "#302C13" },
  signed: { text: "SIGNED", color: "#37E088", border: "#1B6F4D", bg: "#0F3426" },
  draft: { text: "DRAFT", color: "#9EC4FF", border: "#40506A", bg: "#253041" },
  expired: { text: "EXPIRED", color: "#FF5E74", border: "#703341", bg: "#3A1920" },
};

const SIGNING_PROVIDER = "docusign";

const formatDate = (value) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatMoney = (value) => {
  if (value === undefined || value === null || value === "") return "--";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  return `$${numeric.toLocaleString()}`;
};

const resolvePdfUrl = (payload) => {
  if (!payload) return null;
  if (typeof payload === "string") return payload;

  return (
    payload?.pdf_url ||
    payload?.pdfUrl ||
    payload?.url ||
    payload?.data?.pdf_url ||
    payload?.data?.pdfUrl ||
    payload?.data?.url ||
    null
  );
};

const getPublicLeasePdfUrl = (shareUrl) => {
  if (!shareUrl) return null;

  if (/^https?:\/\//i.test(shareUrl)) {
    try {
      const parsed = new URL(shareUrl);
      const pathWithQuery = `${parsed.pathname || ""}${parsed.search || ""}`;
      return `${API_BASE_URL}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
    } catch {
      return shareUrl;
    }
  }

  return `${API_BASE_URL}${shareUrl.startsWith("/") ? shareUrl : `/${shareUrl}`}`;
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

const LeasePreviewScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const routeLease = route?.params?.lease || {};
  const leaseId = route?.params?.leaseId || routeLease?.id;
  const { data: leaseResponse, isLoading: loadingLease } = useMadbelGetLeaseQuery(
    { lease_id: leaseId },
    { skip: !leaseId },
  );
  const lease = leaseResponse?.data || routeLease;

  const statusTone = STATUS_TONE_MAP[String(lease?.status || "pending_signature").toLowerCase()] || STATUS_TONE_MAP.pending_signature;

  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientName, setRecipientName] = useState(lease?.tenant_name || "");
  const [recipientEmail, setRecipientEmail] = useState(lease?.tenant_email || "");
  const [recipientPhone, setRecipientPhone] = useState(lease?.tenant_phone || "");

  const authUser = useSelector((state) => state?.auth?.user || {});
  const [showSignModal, setShowSignModal] = useState(false);
  const [signerName, setSignerName] = useState(authUser?.full_name || authUser?.name || "");
  const [signerEmail, setSignerEmail] = useState(authUser?.email || "");
  const [signatureText, setSignatureText] = useState("");

  const [reviewLease, { isLoading: reviewingLease }] = useMadbelReviewLeaseMutation();
  const [sendForSignature, { isLoading: sendingForSignature }] = useMadbelSendLeaseForSignatureMutation();
  const [signLease, { isLoading: signingLease }] = useMadbelSignLeaseMutation();
  const [downloadLeasePdf, { isFetching: downloadingPdf }] = useLazyMadbelDownloadLeasePdfQuery();
  const [cachedDownloadUrl, setCachedDownloadUrl] = useState(null);
  const [resolvingDownloadLink, setResolvingDownloadLink] = useState(false);

  const ensureDownloadUrl = async () => {
    if (cachedDownloadUrl) return cachedDownloadUrl;
    if (lease?.pdf_url) {
      const normalizedLeaseUrl = getPublicLeasePdfUrl(lease.pdf_url);
      setCachedDownloadUrl(normalizedLeaseUrl);
      return normalizedLeaseUrl;
    }
    if (!leaseId) return null;

    const response = await downloadLeasePdf({ lease_id: leaseId }).unwrap();
    const resolvedUrl =
      getPublicLeasePdfUrl(resolvePdfUrl(response)) ||
      getPublicLeasePdfUrl(resolvePdfUrl(lease)) ||
      null;

    if (resolvedUrl) {
      setCachedDownloadUrl(resolvedUrl);
    }

    return resolvedUrl;
  };

  const handleDirectSign = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      Alert.alert(t("missing_fields"), t("signer_name_and_signature_text_are_required"));
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
      Alert.alert("Signature failed", error?.data?.message || "Could not sign the lease.");
    }
  };

  const reviewItems = useMemo(() => lease?.ai_review || lease?.review || [], [lease?.ai_review, lease?.review]);

  const handleRunReview = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    try {
      await reviewLease({ lease_id: leaseId }).unwrap();
      Alert.alert(t("review_complete"), t("lease_review_has_been_updated"));
    } catch (error) {
      Alert.alert("Review failed", error?.data?.message || "Could not review the lease.");
    }
  };

  const handleSendForSignature = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    try {
      const payload = {
        lease_id: leaseId,
        recipient_name: recipientName.trim() || undefined,
        recipient_email: recipientEmail.trim() || undefined,
        recipient_phone: recipientPhone.trim() || undefined,
        channel: recipientEmail.trim() ? "email" : "link",
        signing_provider: lease?.signing_provider || SIGNING_PROVIDER,
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
      Alert.alert("Send failed", error?.data?.message || "Could not send lease for signature.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!leaseId) {
      Alert.alert(t("unavailable"), t("lease_id_is_missing"));
      return;
    }
    try {
      setResolvingDownloadLink(true);
      const pdfUrl = await ensureDownloadUrl();
      if (!pdfUrl) {
        Alert.alert(t("pdf_unavailable"), t("could_not_generate_pdf_link"));
        return;
      }

      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (!canOpen) {
        Alert.alert(t("open_failed"), t("this_device_cannot_open_the_pdf_link"));
        return;
      }

      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert(t("download_failed"), error?.data?.message || t("could_not_open_the_lease_pdf"));
    } finally {
      setResolvingDownloadLink(false);
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#11CDE8" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
              <Text style={styles.editBtnText}>{t("edit_lease", "Edit Lease")}</Text>
            </Pressable>
            <Pressable onPress={handleDownloadPdf} disabled={downloadingPdf || resolvingDownloadLink}>
              {downloadingPdf || resolvingDownloadLink ? <ActivityIndicator color="#D7E8FF" /> : <Download size={24} color="#D7E8FF" />}
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.statusPill, { borderColor: statusTone.border, backgroundColor: statusTone.bg }]}>
            <ClipboardCheck size={18} color={statusTone.color} />
            <Text style={[styles.statusText, { color: statusTone.color }]}>{statusTone.text}</Text>
          </View>

          <View style={styles.docCard}>
            <Text style={styles.docTitle}>Residential Lease{"\n"}Agreement</Text>
            <View style={styles.docDivider} />
            <Text style={styles.docText}>{lease?.content}</Text>
            {/* <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>{t("landlord")}</Text>
              <Text style={styles.partyName}>{lease.landlord_name || "SmartFlow Properties"}</Text>
            </View> */}
            {/* <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>{t("tenant")}</Text>
              <Text style={styles.partyName}>{lease.tenant_name || "John Doe"}</Text>
            </View> */}

            {/* <Text style={styles.section}>{t("1_property_address")}</Text>
            <Text style={styles.docText}>{lease.property_address || "221B Baker Street, London, NW1 6XE"}</Text>
            <Text style={styles.section}>{t("2_rent_payment")}</Text>
            <Text style={styles.docText}>{formatMoney(lease.rent.monthly_rent_label)} rent is due on the first day of each calendar month.</Text>
            <Text style={styles.section}>{t("3_term_of_lease")}</Text> */}
            {/* <Text style={styles.docText}>
              The term of this lease begins on {formatDate(lease.start_date)} and terminates on {formatDate(lease.end_date)}.
            </Text> */}
            {/* {lease.custom_terms ? (
              <>
                <Text style={styles.section}>{t("4_lease_terms")}</Text>
                <Text style={styles.docText}>{lease.custom_terms}</Text>
              </>
            ) : null} */}

            {/* {lease.status === "active" || lease.status === "signed" ? (
              <View style={styles.signedBlock}>
                <Text style={styles.signedText}>Signed by {lease?.signature?.signer_name || "John Doe"}</Text>
                <Text style={styles.signedSubText}>Date: {formatDate(lease?.signature?.signed_at || lease?.signed_at)}</Text>
              </View>
            ) : (
              <>
                <Pressable style={styles.signBlock} onPress={() => setShowSignModal(true)}>
                  <Text style={styles.signHint}>{t("click_to_sign")}</Text>
                  <Text style={styles.signTag}>{t("tenant_signature_required")}</Text>
                </Pressable>
                <Pressable style={styles.signBlock} onPress={() => setShowSignModal(true)}>
                  <Text style={styles.signHint}>{t("click_to_sign")}</Text>
                  <Text style={styles.signTag}>{t("landlord_signature_required")}</Text>
                </Pressable>
              </>
            )} */}
          </View>

          {/* <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Sparkles size={20} color="#10CDE9" />
              <Text style={styles.reviewTitle}>{t("ai_lease_review")}</Text>
              <Pressable onPress={handleRunReview} disabled={reviewingLease} style={styles.reviewRefresh}>
                {reviewingLease ? <ActivityIndicator color="#10CDE9" size="small" /> : <Text style={styles.reviewRefreshText}>{t("refresh")}</Text>}
              </Pressable>
            </View>
            {reviewItems.length ? (
              reviewItems.map((item, index) => {
                const isWarning = item?.severity === "warning" || item?.severity === "error";
                return (
                  <View key={`${item?.key || item?.title || "review"}-${index}`} style={isWarning ? styles.warningCard : styles.reviewItem}>
                    {isWarning ? <AlertTriangle size={18} color="#FF5F74" /> : <CheckCircle2 size={18} color="#2CD086" />}
                    <View style={{ flex: 1 }}>
                      <Text style={isWarning ? styles.warningTitle : styles.reviewItemTitle}>{item?.title || "Review item"}</Text>
                      <Text style={isWarning ? styles.warningSub : styles.reviewItemSub}>{item?.message || ""}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.reviewItem}>
                <Text style={styles.reviewItemSub}>{t("no_review_findings_yet_tap_refresh_to_run_lease_re")}</Text>
              </View>
            )}
          </View> */}

          {lease.status !== "active" && lease.status !== "signed" ? (
            <View style={styles.btnRow}>
              <Pressable style={[styles.sendBtn, { flex: 1 }]} onPress={() => setShowSendModal(true)}>
                <Text style={styles.sendText}>{t("send_for_signature")}</Text>
              </Pressable>
          
            </View>
          ) : (
            <Pressable style={styles.sendBtn} onPress={handleDownloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? (
                <ActivityIndicator color="#EAF8FF" />
              ) : (
                <Text style={styles.sendText}>{t("download_signed_pdf")}</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal visible={showSendModal} transparent animationType="fade" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("send_for_signature")}</Text>
              <Pressable onPress={() => setShowSendModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>{t("recipient_details")}</Text>
            <Text style={styles.fieldLabel}>{t("name")}</Text>
            <TextInput value={recipientName} onChangeText={setRecipientName} placeholder={t("full_name")} placeholderTextColor="#5D687D" style={styles.modalInput} />
            <Text style={styles.fieldLabel}>{t("email")}</Text>
            <TextInput value={recipientEmail} onChangeText={setRecipientEmail} placeholder={t("email_example_com")} placeholderTextColor="#5D687D" style={styles.modalInput} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>{t("phone_optional")}</Text>
            <TextInput value={recipientPhone} onChangeText={setRecipientPhone} placeholder="+1 234 567 890" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowSendModal(false)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSendBtn} onPress={handleSendForSignature} disabled={sendingForSignature}>
                {sendingForSignature ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.modalSendText}>{t("send_document")}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* <Modal visible={showSignModal} transparent animationType="fade" onRequestClose={() => setShowSignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("sign_document")}</Text>
              <Pressable onPress={() => setShowSignModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>{t("signature_details")}</Text>
            <Text style={styles.fieldLabel}>{t("signer_name")}</Text>
            <TextInput value={signerName} onChangeText={setSignerName} placeholder={t("your_full_name")} placeholderTextColor="#5D687D" style={styles.modalInput} />
            <Text style={styles.fieldLabel}>{t("email_address")}</Text>
            <TextInput value={signerEmail} onChangeText={setSignerEmail} placeholder={t("email_example_com")} placeholderTextColor="#5D687D" style={styles.modalInput} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>{t("signature_text")}</Text>
            <TextInput value={signatureText} onChangeText={setSignatureText} placeholder={t("type_your_signature_here_e_g_john_doe")} placeholderTextColor="#5D687D" style={styles.modalInput} />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowSignModal(false)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSendBtn} onPress={handleDirectSign} disabled={signingLease}>
                {signingLease ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.modalSendText}>{t("sign_document")}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginTop: responsiveHeight(0.8), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerActions: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerTitle: { color: "#F4F8FF", fontSize: 46 / 2, fontWeight: "700" },
  editBtn: { minHeight: responsiveHeight(4.2), paddingHorizontal: responsiveWidth(3.2), borderRadius: 12, borderWidth: 1, borderColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  editBtnText: { color: "#11CDE8", fontSize: 14, fontWeight: "700" },
  content: { paddingTop: responsiveHeight(1.4), paddingBottom: responsiveHeight(8), gap: responsiveHeight(1.4) },
  statusPill: { alignSelf: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.6), paddingHorizontal: responsiveWidth(3.5), paddingVertical: responsiveHeight(0.6) },
  statusText: { fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  docCard: { borderRadius: 18, backgroundColor: "#F2F4F7", padding: responsiveWidth(4.2) },
  docTitle: { color: "#202937", fontSize: 40 / 2, textAlign: "center", fontWeight: "700", lineHeight: 34 },
  docDivider: { height: 1, backgroundColor: "#D8DDE4", marginVertical: responsiveHeight(1.5) },
  docText: { color: "#303A49", fontSize: 18, lineHeight: 30 },
  partyBox: { marginTop: responsiveHeight(1.1), borderRadius: 10, backgroundColor: "#ECEFF3", padding: responsiveWidth(3) },
  partyLabel: { color: "#818E9F", fontSize: 13, fontWeight: "700" },
  partyName: { color: "#1F2836", fontSize: 20 / 2, fontWeight: "700", marginTop: responsiveHeight(0.3) },
  section: { marginTop: responsiveHeight(1.3), marginBottom: responsiveHeight(0.4), color: "#1F2734", fontSize: 36 / 2, fontWeight: "800" },
  signBlock: { marginTop: responsiveHeight(1.1), minHeight: responsiveHeight(7), borderRadius: 10, borderWidth: 2, borderStyle: "dashed", borderColor: "#EBCF49", alignItems: "center", justifyContent: "center", backgroundColor: "#F9F5DE" },
  signHint: { color: "#CCBC7A", fontSize: 19 },
  signTag: { position: "absolute", left: responsiveWidth(3), bottom: -12, color: "#D8B63E", fontSize: 13, backgroundColor: "#F8EFC5", paddingHorizontal: responsiveWidth(1) },
  signedBlock: { marginTop: responsiveHeight(1.1), minHeight: responsiveHeight(7), borderRadius: 10, borderWidth: 1, borderColor: "#1B6F4D", alignItems: "center", justifyContent: "center", backgroundColor: "#EAFBF3" },
  signedText: { color: "#1B6F4D", fontSize: 18, fontWeight: "700" },
  signedSubText: { color: "#278961", fontSize: 14 },
  btnRow: { flexDirection: "row", gap: responsiveWidth(3), width: "100%" , marginBottom: responsiveHeight(5)},
  signBtn: { flex: 1, minHeight: responsiveHeight(6.4), borderRadius: 14, borderWidth: 1, borderColor: "#11CDE8", backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  signBtnText: { color: "#11CDE8", fontSize: 20 / 2, fontWeight: "700" },
  reviewCard: { borderRadius: 18, borderWidth: 1, borderColor: "#283245", backgroundColor: "#1B1E24", overflow: "hidden" },
  reviewHeader: { minHeight: responsiveHeight(6.4), paddingHorizontal: responsiveWidth(4), flexDirection: "row", alignItems: "center", gap: responsiveWidth(2), backgroundColor: "#1A2436" },
  reviewTitle: { color: "#E7EEF9", fontSize: 20 / 2 },
  reviewRefresh: { marginLeft: "auto", minHeight: responsiveHeight(3.2), minWidth: responsiveWidth(18), borderRadius: 10, borderWidth: 1, borderColor: "#2D455E", alignItems: "center", justifyContent: "center", paddingHorizontal: responsiveWidth(2.5) },
  reviewRefreshText: { color: "#9CD8E7", fontSize: 13, fontWeight: "700" },
  reviewItem: { flexDirection: "row", gap: responsiveWidth(2.4), paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1) },
  reviewItemTitle: { color: "#EAF2FF", fontWeight: "600", fontSize: 18 / 2 },
  reviewItemSub: { color: "#7F8BA0", fontSize: 15 / 2, marginTop: 2 },
  warningCard: { marginHorizontal: responsiveWidth(4), marginBottom: responsiveHeight(0.8), padding: responsiveWidth(3), borderRadius: 12, backgroundColor: "#222A39", flexDirection: "row", gap: responsiveWidth(2.4) },
  warningTitle: { color: "#E8EDF7", fontWeight: "700", fontSize: 18 / 2 },
  warningSub: { color: "#A5B2C7", fontSize: 15 / 2, marginTop: 2 },
  sendBtn: { minHeight: responsiveHeight(6.4), borderRadius: 14, backgroundColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#EAF8FF", fontSize: 20 / 2, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: responsiveWidth(4) },
  modalCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "#313847", backgroundColor: "#1B1E24", paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(1.5), paddingBottom: responsiveHeight(2.2) },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: "#F2F7FF", fontSize: 44 / 2, fontWeight: "700" },
  modalDivider: { marginTop: responsiveHeight(1), marginBottom: responsiveHeight(1.5), height: 1, backgroundColor: "#2F3747" },
  modalLabel: { color: "#9DD8EC", fontWeight: "700", fontSize: 17, letterSpacing: 3, marginBottom: responsiveHeight(0.6) },
  fieldLabel: { color: "#C2CCDA", fontSize: 20, marginBottom: responsiveHeight(0.5), marginTop: responsiveHeight(0.6) },
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
  modalFooter: { marginTop: responsiveHeight(2.2), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cancelText: { color: "#D0D8E4", fontSize: 20 },
  modalSendBtn: { minHeight: responsiveHeight(6), minWidth: responsiveWidth(44), borderRadius: 13, backgroundColor: "#19CDEC", alignItems: "center", justifyContent: "center", paddingHorizontal: responsiveWidth(3) },
  modalSendText: { color: "#EAF8FF", fontSize: 22, fontWeight: "700" },
});

export default LeasePreviewScreen;
