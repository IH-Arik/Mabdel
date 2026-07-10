import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, Signature, CheckCircle2, AlertTriangle, Download, Sparkles } from "lucide-react-native";
import {
  useMadbelGetPublicSigningAgreementQuery,
  useMadbelGetPublicSigningLeaseQuery,
  useMadbelSignPublicAgreementMutation,
  useMadbelSignPublicLeaseMutation,
} from "../../redux/slices/madbelApiSlice";

const STATUS_TONE_MAP = {
  pending_signature: { text: "PENDING SIGNATURE", color: "#F4D52B", border: "#7A6B06", bg: "#302C13" },
  signed: { text: "SIGNED", color: "#37E088", border: "#1B6F4D", bg: "#0F3426" },
  draft: { text: "DRAFT", color: "#9EC4FF", border: "#40506A", bg: "#253041" },
  expired: { text: "EXPIRED", color: "#FF5E74", border: "#703341", bg: "#3A1920" },
};

const resolveFirstString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || "";

const resolveUrl = (response) =>
  response?.signing_url ||
  response?.data?.signing_url ||
  response?.data?.data?.signing_url ||
  response?.url ||
  response?.data?.url ||
  response?.data?.data?.url ||
  response?.pdf_url ||
  response?.data?.pdf_url ||
  response?.data?.data?.pdf_url ||
  null;

const PublicSigningScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const documentType = String(route?.params?.documentType || route?.params?.type || "agreement").toLowerCase();
  const signatureToken = resolveFirstString(
    route?.params?.signatureToken,
    route?.params?.signature_token,
    route?.params?.token,
  );

  const isLease = documentType === "lease";
  const isAgreement = documentType === "agreement" || !isLease;

  const leaseQuery = useMadbelGetPublicSigningLeaseQuery(
    { signature_token: signatureToken },
    { skip: !signatureToken || !isLease },
  );
  const agreementQuery = useMadbelGetPublicSigningAgreementQuery(
    { signature_token: signatureToken },
    { skip: !signatureToken || !isAgreement },
  );

  const signingResponse = isLease ? leaseQuery.data : agreementQuery.data;
  const loading = isLease ? leaseQuery.isLoading : agreementQuery.isLoading;
  const signingError = isLease ? leaseQuery.error : agreementQuery.error;
  const document = signingResponse?.data || signingResponse || route?.params?.document || {};

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const [signPublicLease] = useMadbelSignPublicLeaseMutation();
  const [signPublicAgreement] = useMadbelSignPublicAgreementMutation();

  useEffect(() => {
    setSignerName(
      resolveFirstString(
        document?.recipient_name,
        document?.tenant_name,
        document?.client_name,
        document?.signer_name,
      ),
    );
    setSignerEmail(
      resolveFirstString(
        document?.recipient_email,
        document?.tenant_email,
        document?.client_email,
        document?.signer_email,
      ),
    );
  }, [document?.recipient_email, document?.recipient_name, document?.tenant_email, document?.tenant_name, document?.client_email, document?.client_name, document?.signer_email, document?.signer_name]);

  const reviewItems = useMemo(() => document?.ai_review || document?.review || [], [document?.ai_review, document?.review]);
  const statusTone =
    STATUS_TONE_MAP[String(document?.status || "pending_signature").toLowerCase()] ||
    STATUS_TONE_MAP.pending_signature;

  const handleOpenPdf = async () => {
    const pdfUrl = resolveUrl(signingResponse) || document?.pdf_url;
    if (!pdfUrl) {
      Alert.alert("Unavailable", "Signed PDF is not available yet.");
      return;
    }

    const canOpen = await Linking.canOpenURL(pdfUrl);
    if (!canOpen) {
      Alert.alert("Unavailable", "This device cannot open the PDF link.");
      return;
    }

    await Linking.openURL(pdfUrl);
  };

  const handleSign = async () => {
    if (!signatureToken) {
      Alert.alert("Unavailable", "Signature token is missing.");
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      Alert.alert("Missing fields", "Signer name and signature text are required.");
      return;
    }

    try {
      setIsSigning(true);
      const payload = {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || undefined,
        signature_text: signatureText.trim(),
      };

      const response = isLease
        ? await signPublicLease({
            signature_token: signatureToken,
            ...payload,
          }).unwrap()
        : await signPublicAgreement({
            signature_token: signatureToken,
            ...payload,
          }).unwrap();

      const nextUrl = resolveUrl(response);
      setShowConfirm(false);

      if (nextUrl) {
        const canOpen = await Linking.canOpenURL(nextUrl);
        if (canOpen) {
          await Linking.openURL(nextUrl);
        }
      }

      Alert.alert("Success", "Document signature submitted.");
    } catch (error) {
      Alert.alert("Signature failed", error?.data?.message || "Could not complete signing.");
    } finally {
      setIsSigning(false);
    }
  };

  if (loading && !document?.title && !document?.content) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color="#14C9E7" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color="#F5FAFF" />
          </Pressable>
          <Text style={styles.headerTitle}>DocuSign</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.statusPill, { borderColor: statusTone.border, backgroundColor: statusTone.bg }]}>
            <Signature size={18} color={statusTone.color} />
            <Text style={[styles.statusText, { color: statusTone.color }]}>{statusTone.text}</Text>
          </View>

          {signingError ? (
            <View style={styles.errorCard}>
              <AlertTriangle size={20} color="#FF5E74" />
              <Text style={styles.errorText}>Could not load the signing document.</Text>
            </View>
          ) : null}

          <View style={styles.docCard}>
            <Text style={styles.metaText}>
              {document?.agreement_number || document?.lease_number || "--"}
              {"\n"}
              {document?.title || (isLease ? "Lease" : "Agreement")}
            </Text>
            <Text style={styles.docTitle}>{document?.title || "Document"}</Text>
            <Text style={styles.docBody}>{document?.content || "No document content available."}</Text>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Sparkles size={20} color="#10CDE9" />
              <Text style={styles.reviewTitle}>Signature details</Text>
            </View>
            <View style={styles.reviewBody}>
              <Text style={styles.reviewText}>
                Please confirm the signer details below, then submit the signature.
              </Text>
            </View>
          </View>

          {reviewItems.length ? (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <CheckCircle2 size={20} color="#10CDE9" />
                <Text style={styles.reviewTitle}>Review</Text>
              </View>
              {reviewItems.map((item, index) => (
                <View key={`${item?.title || "item"}-${index}`} style={styles.reviewItem}>
                  <Text style={styles.reviewItemTitle}>{item?.title || "Review item"}</Text>
                  <Text style={styles.reviewItemSub}>{item?.message || ""}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.formCard}>
            <Text style={styles.label}>Signer name</Text>
            <TextInput value={signerName} onChangeText={setSignerName} placeholder="Full name" placeholderTextColor="#66748C" style={styles.input} />

            <Text style={styles.label}>Signer email</Text>
            <TextInput value={signerEmail} onChangeText={setSignerEmail} placeholder="email@example.com" placeholderTextColor="#66748C" style={styles.input} autoCapitalize="none" />

            <Text style={styles.label}>Signature text</Text>
            <TextInput
              value={signatureText}
              onChangeText={setSignatureText}
              placeholder="Type your signature"
              placeholderTextColor="#66748C"
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <Pressable style={styles.signBtn} onPress={() => setShowConfirm(true)} disabled={isSigning}>
            {isSigning ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.signBtnText}>Complete signature</Text>}
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={handleOpenPdf}>
            <Download size={18} color="#11CDE8" />
            <Text style={styles.secondaryBtnText}>Open PDF</Text>
          </Pressable>
        </ScrollView>
      </View>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm signature</Text>
            <Text style={styles.modalText}>This will submit your digital signature to the document workflow.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtn} onPress={handleSign} disabled={isSigning}>
                {isSigning ? <ActivityIndicator color="#EAF8FF" /> : <Text style={styles.modalBtnText}>Sign now</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { marginTop: responsiveHeight(0.7), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: responsiveWidth(11.2), height: responsiveWidth(11.2), alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#F4F8FF", fontSize: responsiveWidth(3.9), fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(11.2) },
  content: { paddingTop: responsiveHeight(1.6), paddingBottom: responsiveHeight(10), gap: responsiveHeight(1.4) },
  statusPill: { alignSelf: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.6), paddingHorizontal: responsiveWidth(3.5), paddingVertical: responsiveHeight(0.6) },
  statusText: { fontSize: 14, fontWeight: "700" },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: "#5E2D38", backgroundColor: "#2B151C", padding: responsiveWidth(4), flexDirection: "row", gap: responsiveWidth(2), alignItems: "center" },
  errorText: { color: "#F3C2CD", flex: 1, fontSize: 15 },
  docCard: { borderRadius: 18, backgroundColor: "#F2F4F7", padding: responsiveWidth(4) },
  metaText: { color: "#9BA6B7", fontSize: 13, marginBottom: responsiveHeight(1) },
  docTitle: { color: "#202937", fontSize: 20, fontWeight: "700", marginBottom: responsiveHeight(0.8) },
  docBody: { color: "#303A49", fontSize: 16, lineHeight: 26 },
  reviewCard: { borderRadius: 18, borderWidth: 1, borderColor: "#283245", backgroundColor: "#1B1E24", overflow: "hidden" },
  reviewHeader: { minHeight: responsiveHeight(6.2), paddingHorizontal: responsiveWidth(4), flexDirection: "row", alignItems: "center", gap: responsiveWidth(2), backgroundColor: "#1A2436" },
  reviewTitle: { color: "#E7EEF9", fontSize: 17, fontWeight: "700" },
  reviewBody: { padding: responsiveWidth(4) },
  reviewText: { color: "#B2BFCE", fontSize: 15, lineHeight: 22 },
  reviewItem: { paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1) },
  reviewItemTitle: { color: "#EAF2FF", fontWeight: "600", fontSize: 15 },
  reviewItemSub: { color: "#7F8BA0", fontSize: 14, marginTop: 2 },
  formCard: { borderRadius: 18, borderWidth: 1, borderColor: "#2B3342", backgroundColor: "#1A1D24", padding: responsiveWidth(4) },
  label: { color: "#A8B3C4", fontSize: 14, marginBottom: responsiveHeight(0.5), marginTop: responsiveHeight(0.8) },
  input: { minHeight: responsiveHeight(5.8), borderRadius: 10, borderWidth: 1, borderColor: "#334056", backgroundColor: "#11151C", color: "#EAF2FF", paddingHorizontal: responsiveWidth(3), fontSize: 15 },
  textArea: { minHeight: responsiveHeight(11), paddingTop: responsiveHeight(1), textAlignVertical: "top" },
  signBtn: { minHeight: responsiveHeight(6.4), borderRadius: 14, backgroundColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  signBtnText: { color: "#EAF8FF", fontSize: 18, fontWeight: "700" },
  secondaryBtn: { minHeight: responsiveHeight(5.8), borderRadius: 14, borderWidth: 1, borderColor: "#11CDE8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: responsiveWidth(2), backgroundColor: "#0B1118" },
  secondaryBtnText: { color: "#11CDE8", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", paddingHorizontal: responsiveWidth(4) },
  modalCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "#313847", backgroundColor: "#1B1E24", paddingHorizontal: responsiveWidth(5), paddingTop: responsiveHeight(2), paddingBottom: responsiveHeight(2.2) },
  modalTitle: { color: "#F2F7FF", fontSize: 20, fontWeight: "700" },
  modalText: { color: "#B2BFCE", fontSize: 15, marginTop: responsiveHeight(1), lineHeight: 22 },
  modalActions: { marginTop: responsiveHeight(2), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cancelText: { color: "#D0D8E4", fontSize: 16 },
  modalBtn: { minHeight: responsiveHeight(5.8), minWidth: responsiveWidth(40), borderRadius: 13, backgroundColor: "#19CDEC", alignItems: "center", justifyContent: "center", paddingHorizontal: responsiveWidth(3) },
  modalBtnText: { color: "#EAF8FF", fontSize: 16, fontWeight: "700" },
});

export default PublicSigningScreen;
