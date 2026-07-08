import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, ClipboardCheck, Sparkles, CheckCircle2, AlertTriangle, X, Download } from "lucide-react-native";
import { useSelector } from "react-redux";
import {
  useLazyMadbelDownloadAgreementPdfQuery,
  useMadbelGetAgreementQuery,
  useMadbelSendAgreementForSignatureMutation,
  useMadbelSignAgreementMutation,
} from "../../redux/slices/madbelApiSlice";

const STATUS_TONE_MAP = {
  pending_signature: { text: "PENDING SIGNATURE", color: "#F6D32B", border: "#796A05", bg: "#302C13" },
  signed: { text: "SIGNED", color: "#37E088", border: "#1B6F4D", bg: "#0F3426" },
  draft: { text: "DRAFT", color: "#9EC4FF", border: "#40506A", bg: "#253041" },
  expired: { text: "EXPIRED", color: "#FF5E74", border: "#703341", bg: "#3A1920" },
};

const AgreementPreviewScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const routeAgreement = route?.params?.agreement || {};
  const agreementId = route?.params?.agreementId || routeAgreement?.id;

  const { data: agreementResponse, isLoading: loadingAgreement } = useMadbelGetAgreementQuery(
    { agreement_id: agreementId },
    { skip: !agreementId },
  );
  const agreement = agreementResponse?.data || routeAgreement;
  const signingProvider = agreement?.signing_provider || routeAgreement?.signing_provider;
  const tone = STATUS_TONE_MAP[String(agreement?.status || "pending_signature").toLowerCase()] || STATUS_TONE_MAP.pending_signature;

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState(agreement?.client_name || "");
  const [email, setEmail] = useState(agreement?.client_email || "");
  const [phone, setPhone] = useState(agreement?.client_phone || "");

  const [sendForSignature, { isLoading: sending }] = useMadbelSendAgreementForSignatureMutation();
  const [downloadAgreementPdf, { isFetching: downloadingPdf }] = useLazyMadbelDownloadAgreementPdfQuery();

  const review = useMemo(() => agreement?.ai_review || [], [agreement?.ai_review]);

  const handleSend = async () => {
    if (!agreementId) {
      Alert.alert(t("unavailable"), t("agreement_not_found"));
      return;
    }
    try {
      const payload = {
        agreement_id: agreementId,
        recipient_name: name.trim() || undefined,
        recipient_email: email.trim() || undefined,
        channel: email.trim() ? "email" : "link",
        signing_provider: signingProvider || undefined,
      };
      await sendForSignature(payload).unwrap();
      setShowModal(false);
      Alert.alert(t("sent"), t("agreement_sent_for_signature"));
    } catch (error) {
      Alert.alert("Send failed", error?.data?.message || "Could not send agreement.");
    }
  };

  const openPdf = async () => {
    if (!agreementId) return;
    try {
      const response = await downloadAgreementPdf({ agreement_id: agreementId });
      const url = response?.data?.data?.pdf_url || agreement?.pdf_url;
      if (url) {
        await Linking.openURL(url);
        return;
      }
      Alert.alert(t("unavailable"), t("pdf_url_not_available"));
    } catch (error) {
      Alert.alert("PDF failed", error?.data?.message || "Could not open agreement PDF.");
    }
  };

  if (loadingAgreement && !agreement?.title) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color="#14C9E7" size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()}>
              <ChevronLeft size={35} color="#F8FAFC" />
            </Pressable>
            <Text style={styles.headerTitle}>{t("agreement_preview")}</Text>
          </View>
          <Pressable onPress={openPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <ActivityIndicator color="#D7E8FF" /> : <Download size={24} color="#D7E8FF" />}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={[styles.statusPill, { borderColor: tone.border, backgroundColor: tone.bg }]}>
            <ClipboardCheck size={19} color={tone.color} />
            <Text style={[styles.statusText, { color: tone.color }]}>{tone.text}</Text>
          </View>

          <View style={styles.docCard}>
            <Text style={styles.docMeta}>
              AGREEMENT NO: {agreement?.agreement_number || "--"}
              {"\n"}Generated: {agreement?.created_at ? new Date(agreement.created_at).toLocaleDateString("en-US") : "--"}
            </Text>
            <Text style={styles.docTitle}>{agreement?.title || "Agreement"}</Text>
            <Text style={styles.docBody}>{agreement?.content || "No agreement content available."}</Text>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureTag}>{t("signature_required")}</Text>
              <Text style={styles.signatureHint}>{t("click_to_sign")}</Text>
            </View>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Sparkles size={20} color="#10CDE9" />
              <Text style={styles.reviewTitle}>{t("ai_review")}</Text>
            </View>
            {review.length ? (
              review.map((item, index) => {
                const isWarning = item?.severity === "warning" || item?.severity === "error";
                return (
                  <View key={`${item?.key || item?.title || "item"}-${index}`} style={isWarning ? styles.warningCard : styles.reviewItem}>
                    {isWarning ? (
                      <AlertTriangle size={18} color="#FF5F74" />
                    ) : (
                      <CheckCircle2 size={18} color="#2CD086" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={isWarning ? styles.warningTitle : styles.reviewItemTitle}>{item?.title || "Review item"}</Text>
                      <Text style={isWarning ? styles.warningSub : styles.reviewItemSub}>{item?.message || ""}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.reviewItem}>
                <Text style={styles.reviewItemSub}>{t("no_ai_review_findings_available")}</Text>
              </View>
            )}
          </View>

          <Pressable style={styles.sendBtn} onPress={() => setShowModal(true)}>
            <Text style={styles.sendBtnText}>{t("send_for_signature")}</Text>
          </Pressable>
        </ScrollView>
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("send_for_signature")}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <X size={34} color="#B7C1D0" />
              </Pressable>
            </View>
            <View style={styles.modalDivider} />
            <Text style={styles.modalLabel}>{t("recipient_details")}</Text>
            <Text style={styles.fieldLabel}>{t("name")}</Text>
            <TextInput value={name} onChangeText={setName} placeholder={t("full_name")} placeholderTextColor="#5D687D" style={styles.modalInput} />
            <Text style={styles.fieldLabel}>{t("email")}</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder={t("email_example_com")} placeholderTextColor="#5D687D" style={styles.modalInput} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>{t("phone_optional")}</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+1 234 567 890" placeholderTextColor="#5D687D" style={styles.modalInput} />
            <View style={styles.modalFooter}>
              <Pressable onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSendBtn} onPress={handleSend} disabled={sending}>
                {sending ? (
                  <ActivityIndicator color="#EAF8FF" />
                ) : (
                  <Text style={styles.modalSendText}>{t("send_document")}</Text>
                )}
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
  header: { marginTop: responsiveHeight(0.7), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerTitle: { color: "#F4F8FF", fontSize: 46 / 2, fontWeight: "700" },
  content: { paddingTop: responsiveHeight(1.4), paddingBottom: responsiveHeight(9), gap: responsiveHeight(1.6) },
  statusPill: { alignSelf: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.8), paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(0.7) },
  statusText: { fontWeight: "700", fontSize: 17 },
  docCard: { borderRadius: 20, backgroundColor: "#F2F4F7", padding: responsiveWidth(4) },
  docMeta: { color: "#9BA6B7", fontSize: 14, marginBottom: responsiveHeight(1.3) },
  docTitle: { color: "#2A3241", fontSize: 20, marginBottom: responsiveHeight(1) },
  docBody: { color: "#4A5565", fontSize: 17, lineHeight: 29 },
  signatureBox: { marginTop: responsiveHeight(1.8), borderRadius: 12, borderWidth: 2, borderColor: "#F1D64E", borderStyle: "dashed", minHeight: responsiveHeight(8.2), alignItems: "center", justifyContent: "center" },
  signatureTag: { position: "absolute", top: -11, right: responsiveWidth(4), backgroundColor: "#F5D728", color: "#23201A", fontSize: 12, fontWeight: "700", paddingHorizontal: responsiveWidth(2), borderRadius: 8 },
  signatureHint: { color: "#D1BF5A", fontSize: 20 },
  reviewCard: { borderRadius: 18, borderWidth: 1, borderColor: "#283245", backgroundColor: "#1B1E24", overflow: "hidden" },
  reviewHeader: { minHeight: responsiveHeight(6.5), paddingHorizontal: responsiveWidth(4), flexDirection: "row", alignItems: "center", gap: responsiveWidth(2), backgroundColor: "#1A2436" },
  reviewTitle: { color: "#E7EEF9", fontSize: 18 },
  reviewItem: { flexDirection: "row", gap: responsiveWidth(2.4), paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1) },
  reviewItemTitle: { color: "#EAF2FF", fontWeight: "600", fontSize: 17 },
  reviewItemSub: { color: "#7F8BA0", fontSize: 15, marginTop: 2 },
  warningCard: { marginHorizontal: responsiveWidth(4), marginVertical: responsiveHeight(1), padding: responsiveWidth(3), borderRadius: 12, backgroundColor: "#391E2A", flexDirection: "row", gap: responsiveWidth(2.4) },
  warningTitle: { color: "#FF7287", fontWeight: "700", fontSize: 17 },
  warningSub: { color: "#C79AA9", fontSize: 15, marginTop: 2 },
  sendBtn: { minHeight: responsiveHeight(6.7), borderRadius: 14, backgroundColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  sendBtnText: { color: "#EAF8FF", fontSize: 19, fontWeight: "700" },
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

export default AgreementPreviewScreen;
