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

const STATUS_TONE_MAP = {
  pending_signature: { text: "PENDING SIGNATURE", color: "#F4D52B", border: "#7A6B06", bg: "#302C13" },
  signed: { text: "SIGNED", color: "#37E088", border: "#1B6F4D", bg: "#0F3426" },
  draft: { text: "DRAFT", color: "#9EC4FF", border: "#40506A", bg: "#253041" },
  expired: { text: "EXPIRED", color: "#FF5E74", border: "#703341", bg: "#3A1920" },
};

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

const LeasePreviewScreen = () => {
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

  const handleDirectSign = async () => {
    if (!leaseId) {
      Alert.alert("Unavailable", "Lease id is missing.");
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      Alert.alert("Missing fields", "Signer name and signature text are required.");
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
      Alert.alert("Success", "Lease signed successfully.");
    } catch (error) {
      Alert.alert("Signature failed", error?.data?.message || "Could not sign the lease.");
    }
  };

  const reviewItems = useMemo(() => lease?.ai_review || lease?.review || [], [lease?.ai_review, lease?.review]);

  const handleRunReview = async () => {
    if (!leaseId) {
      Alert.alert("Unavailable", "Lease id is missing.");
      return;
    }
    try {
      await reviewLease({ lease_id: leaseId }).unwrap();
      Alert.alert("Review complete", "Lease review has been updated.");
    } catch (error) {
      Alert.alert("Review failed", error?.data?.message || "Could not review the lease.");
    }
  };

  const handleSendForSignature = async () => {
    if (!leaseId) {
      Alert.alert("Unavailable", "Lease id is missing.");
      return;
    }
    try {
      const payload = {
        lease_id: leaseId,
        recipient_name: recipientName.trim() || undefined,
        recipient_email: recipientEmail.trim() || undefined,
        recipient_phone: recipientPhone.trim() || undefined,
        channel: recipientEmail.trim() ? "email" : "link",
      };
      await sendForSignature(payload).unwrap();
      setShowSendModal(false);
      Alert.alert("Sent", "Lease sent for signature.");
    } catch (error) {
      Alert.alert("Send failed", error?.data?.message || "Could not send lease for signature.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!leaseId) {
      Alert.alert("Unavailable", "Lease id is missing.");
      return;
    }
    try {
      const response = await downloadLeasePdf({ lease_id: leaseId });
      const pdfUrl = response?.data?.data?.pdf_url || lease?.pdf_url;
      if (!pdfUrl) {
        Alert.alert("PDF unavailable", "Could not generate PDF link.");
        return;
      }
      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert("Download failed", error?.data?.message || "Could not open lease PDF.");
    }
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
            <Text style={styles.headerTitle}>Lease Preview</Text>
          </View>
          <Pressable onPress={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <ActivityIndicator color="#D7E8FF" /> : <Download size={24} color="#D7E8FF" />}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.statusPill, { borderColor: statusTone.border, backgroundColor: statusTone.bg }]}>
            <ClipboardCheck size={18} color={statusTone.color} />
            <Text style={[styles.statusText, { color: statusTone.color }]}>{statusTone.text}</Text>
          </View>

          <View style={styles.docCard}>
            <Text style={styles.docTitle}>Residential Lease{"\n"}Agreement</Text>
            <View style={styles.docDivider} />
            <Text style={styles.docText}>
              This Residential Lease Agreement ("Agreement") is made and entered into this ____ day of _____, 2024, by and between:
            </Text>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>LANDLORD</Text>
              <Text style={styles.partyName}>{lease.landlord_name || "SmartFlow Properties"}</Text>
            </View>
            <View style={styles.partyBox}>
              <Text style={styles.partyLabel}>TENANT</Text>
              <Text style={styles.partyName}>{lease.tenant_name || "John Doe"}</Text>
            </View>

            <Text style={styles.section}>1. PROPERTY ADDRESS</Text>
            <Text style={styles.docText}>{lease.property_address || "221B Baker Street, London, NW1 6XE"}</Text>
            <Text style={styles.section}>2. RENT PAYMENT</Text>
            <Text style={styles.docText}>{formatMoney(lease.monthly_rent)}/month rent is due on the first day of each calendar month.</Text>
            <Text style={styles.section}>3. TERM OF LEASE</Text>
            <Text style={styles.docText}>
              The term of this lease begins on {formatDate(lease.start_date)} and terminates on {formatDate(lease.end_date)}.
            </Text>
            {lease.custom_terms ? (
              <>
                <Text style={styles.section}>4. LEASE TERMS</Text>
                <Text style={styles.docText}>{lease.custom_terms}</Text>
              </>
            ) : null}

            {lease.status === "active" || lease.status === "signed" ? (
              <View style={styles.signedBlock}>
                <Text style={styles.signedText}>Signed by {lease?.signature?.signer_name || "John Doe"}</Text>
                <Text style={styles.signedSubText}>Date: {formatDate(lease?.signature?.signed_at || lease?.signed_at)}</Text>
              </View>
            ) : (
              <>
                <Pressable style={styles.signBlock} onPress={() => setShowSignModal(true)}>
                  <Text style={styles.signHint}>Click to Sign</Text>
                  <Text style={styles.signTag}>Tenant Signature Required</Text>
                </Pressable>
                <Pressable style={styles.signBlock} onPress={() => setShowSignModal(true)}>
                  <Text style={styles.signHint}>Click to Sign</Text>
                  <Text style={styles.signTag}>Landlord Signature Required</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Sparkles size={20} color="#10CDE9" />
              <Text style={styles.reviewTitle}>AI Lease Review</Text>
              <Pressable onPress={handleRunReview} disabled={reviewingLease} style={styles.reviewRefresh}>
                {reviewingLease ? <ActivityIndicator color="#10CDE9" size="small" /> : <Text style={styles.reviewRefreshText}>Refresh</Text>}
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
                <Text style={styles.reviewItemSub}>No review findings yet. Tap Refresh to run lease review.</Text>
              </View>
            )}
          </View>

          {lease.status !== "active" && lease.status !== "signed" ? (
            <View style={styles.btnRow}>
              <Pressable style={[styles.sendBtn, { flex: 1 }]} onPress={() => setShowSendModal(true)}>
                <Text style={styles.sendText}>Send For Signature</Text>
              </Pressable>
              <Pressable style={styles.signBtn} onPress={() => setShowSignModal(true)}>
                <Text style={styles.signBtnText}>Sign Document</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.sendBtn} onPress={handleDownloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? (
                <ActivityIndicator color="#EAF8FF" />
              ) : (
                <Text style={styles.sendText}>Download Signed PDF</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal visible={showSendModal} transparent animationType="fade" onRequestClose={() => setShowSendModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send for Signature</Text>
              <Pressable onPress={() => setShowSendModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>RECIPIENT DETAILS</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput value={recipientName} onChangeText={setRecipientName} placeholder="Full Name" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput value={recipientEmail} onChangeText={setRecipientEmail} placeholder="email@example.com" placeholderTextColor="#5D687D" style={styles.modalInput} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Phone (Optional)</Text>
            <TextInput value={recipientPhone} onChangeText={setRecipientPhone} placeholder="+1 234 567 890" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowSendModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSendBtn} onPress={handleSendForSignature} disabled={sendingForSignature}>
                {sendingForSignature ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.modalSendText}>Send Document</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSignModal} transparent animationType="fade" onRequestClose={() => setShowSignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sign Document</Text>
              <Pressable onPress={() => setShowSignModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>SIGNATURE DETAILS</Text>
            <Text style={styles.fieldLabel}>Signer Name</Text>
            <TextInput value={signerName} onChangeText={setSignerName} placeholder="Your Full Name" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput value={signerEmail} onChangeText={setSignerEmail} placeholder="email@example.com" placeholderTextColor="#5D687D" style={styles.modalInput} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>Signature Text</Text>
            <TextInput value={signatureText} onChangeText={setSignatureText} placeholder="Type your signature here (e.g. John Doe)" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowSignModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSendBtn} onPress={handleDirectSign} disabled={signingLease}>
                {signingLease ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.modalSendText}>Sign Document</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginTop: responsiveHeight(0.8), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerTitle: { color: "#F4F8FF", fontSize: 46 / 2, fontWeight: "700" },
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
  btnRow: { flexDirection: "row", gap: responsiveWidth(3), width: "100%" },
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
