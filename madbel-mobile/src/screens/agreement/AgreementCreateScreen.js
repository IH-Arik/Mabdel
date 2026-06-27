import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, Mic, Sparkles, CircleAlert, CheckCircle2, AlertTriangle } from "lucide-react-native";
import { useSelector } from "react-redux";
import {
  useMadbelCreateAgreementMutation,
  useMadbelGenerateAgreementDraftMutation,
  useMadbelGetAgreementTypesQuery,
  useMadbelReviewAgreementDraftMutation,
} from "../../redux/slices/madbelApiSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const normalizeReview = (review = []) =>
  review.map((item) => ({
    title: item?.title || "Review item",
    message: item?.message || "",
    severity: item?.severity || (item?.passed ? "success" : "warning"),
    passed: Boolean(item?.passed),
  }));

const normalizeDate = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
};

const AgreementCreateScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const accessToken = useSelector((state) => state?.auth?.accessToken || state?.auth?.token);
  const routePrefill = route?.params?.prefill || route?.params?.agreement || {};

  const [signatureEnabled, setSignatureEnabled] = useState(true);
  const [title, setTitle] = useState(routePrefill.title || "");
  const [clientName, setClientName] = useState(routePrefill.client_name || "");
  const [clientEmail, setClientEmail] = useState(routePrefill.client_email || "");
  const [clientPhone, setClientPhone] = useState(routePrefill.client_phone || "");
  const [agreementType, setAgreementType] = useState(routePrefill.agreement_type || "contract");
  const [date, setDate] = useState(routePrefill.start_date || "");
  const [prompt, setPrompt] = useState(routePrefill.prompt || "");
  const [content, setContent] = useState(routePrefill.content || "");
  const [aiReview, setAiReview] = useState(normalizeReview(routePrefill.ai_review));

  useEffect(() => {
    const p = route?.params?.prefill;
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    if (p.title) setTitle(p.title);
    if (p.client_name) setClientName(p.client_name);
    if (p.client_email) setClientEmail(p.client_email);
    if (p.client_phone) setClientPhone(p.client_phone);
    if (p.agreement_type) setAgreementType(p.agreement_type);
    if (p.start_date) setDate(p.start_date);
    if (p.content) setContent(p.content);
    if (p.prompt) setPrompt(p.prompt);
    navigation.setParams?.({ prefill: undefined });
  }, [route?.params?.prefill]);

  const { data: typesResponse } = useMadbelGetAgreementTypesQuery();
  const [generateDraft, { isLoading: generating }] = useMadbelGenerateAgreementDraftMutation();
  const [reviewDraft, { isLoading: reviewing }] = useMadbelReviewAgreementDraftMutation();
  const [createAgreement, { isLoading: creating }] = useMadbelCreateAgreementMutation();

  const agreementTypeOptions = useMemo(() => {
    const items = typesResponse?.data?.items || typesResponse?.data || [];
    if (!Array.isArray(items) || !items.length) return ["contract", "nda", "lease", "legal"];
    return items.map((item) => item?.value || item?.id || item?.key || "contract");
  }, [typesResponse]);

  const runGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert("Prompt required", "Please add a prompt to generate agreement draft.");
      return;
    }
    try {
      const response = await generateDraft({
        prompt: prompt.trim(),
        title: title.trim() || undefined,
        client_name: clientName.trim() || undefined,
        agreement_type: agreementType,
      }).unwrap();
      const draft = response?.data || {};
      setTitle(draft?.title || title);
      setClientName(draft?.client_name || clientName);
      setAgreementType(draft?.agreement_type || agreementType);
      setContent(draft?.content || "");
      setAiReview(normalizeReview(draft?.ai_review));
    } catch (error) {
      Alert.alert("Generate failed", error?.data?.message || "Could not generate agreement draft.");
    }
  };

  const runReview = async () => {
    if (!content.trim()) {
      Alert.alert("Content required", "Generate or write agreement content first.");
      return;
    }
    try {
      const response = await reviewDraft({
        content: content.trim(),
        agreement_type: agreementType,
      }).unwrap();
      setAiReview(normalizeReview(response?.data?.ai_review || response?.data));
    } catch (error) {
      Alert.alert("Review failed", error?.data?.message || "Could not review agreement.");
    }
  };

  const handlePreview = () => {
    navigation.navigate("AgreementPreview", {
      agreement: {
        title: title.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        agreement_type: agreementType,
        start_date: normalizeDate(date),
        content,
        ai_review: aiReview,
      },
    });
  };

  const handleCreate = async () => {
    if (!accessToken) {
      Alert.alert("Session expired", "Please login again to create an agreement.", [
        {
          text: "OK",
          onPress: () => navigation.navigate("Auth"),
        },
      ]);
      return;
    }

    if (!title.trim() || !clientName.trim() || !content.trim()) {
      Alert.alert("Missing fields", "Title, client name, and agreement content are required.");
      return;
    }
    try {
      const response = await createAgreement({
        title: title.trim(),
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        agreement_type: agreementType,
        start_date: normalizeDate(date),
        content: content.trim(),
        status: signatureEnabled ? "pending_signature" : "draft",
      }).unwrap();
      navigation.replace("AgreementPreview", { agreementId: response?.data?.id, agreement: response?.data });
    } catch (error) {

      
      if (error?.status === 401 || error?.originalStatus === 401 || error?.data?.message === "Not authenticated") {
        Alert.alert("Session expired", "Please login again to continue.", [
          {
            text: "OK",
            onPress: () => navigation.navigate("Auth"),
          },
        ]);
        return;
      }
      Alert.alert("Create failed", error?.data?.message || "Could not create agreement.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()}>
              <ChevronLeft size={35} color="#F8FAFC" />
            </Pressable>
            <Text style={styles.headerTitle}>Agreement</Text>
          </View>
          <Pressable onPress={handlePreview}>
            <Text style={styles.previewText}>Preview</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
       
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <CircleAlert size={22} color="#12CDEA" />
              <Text style={styles.panelHeaderText}>Agreement Basic Info</Text>
            </View>
            <View style={styles.panelDivider} />

            <Text style={styles.label}>Agreement Title</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Website Design Service" placeholderTextColor="#5F6B80" style={styles.input} />

            <Text style={styles.label}>Client Name</Text>
            <TextInput value={clientName} onChangeText={setClientName} placeholder="Enter client name" placeholderTextColor="#5F6B80" style={styles.input} />

            <Text style={styles.label}>Client Email</Text>
            <TextInput value={clientEmail} onChangeText={setClientEmail} placeholder="email@example.com" placeholderTextColor="#5F6B80" style={styles.input} autoCapitalize="none" />

            <Text style={styles.label}>Client Phone</Text>
            <TextInput value={clientPhone} onChangeText={setClientPhone} placeholder="+1 234 567 890" placeholderTextColor="#5F6B80" style={styles.input} />

            <Text style={styles.label}>Agreement Type</Text>
            <TextInput
              value={agreementType}
              onChangeText={setAgreementType}
              placeholder={agreementTypeOptions[0] || "contract"}
              placeholderTextColor="#5F6B80"
              style={styles.input}
            />

            <Text style={styles.label}>Date</Text>
            <TextInput value={date} onChangeText={setDate} placeholder="yyyy-mm-dd" placeholderTextColor="#5F6B80" style={styles.input} />
          </View>

          <View style={styles.generateCard}>
            <Text style={styles.generateTitle}>Generate with AI</Text>
            <View style={styles.promptBox}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Create agreement draft..."
                placeholderTextColor="#5F6B80"
                multiline
                style={styles.promptInput}
              />
              <Pressable onPress={() => setVoiceTrigger((t) => t + 1)} hitSlop={10}>
                <Mic size={24} color="#10CDE9" />
              </Pressable>
            </View>
            <Pressable style={styles.generateBtn} onPress={runGenerate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color="#E9F8FF" />
              ) : (
                <>
                  <Sparkles size={20} color="#E9F8FF" />
                  <Text style={styles.generateBtnText}>Generate Agreement</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.generateCard}>
            <Text style={styles.generateTitle}>Agreement Content</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Agreement content..."
              placeholderTextColor="#5F6B80"
              multiline
              style={styles.contentInput}
            />
            <Pressable style={[styles.generateBtn, { marginTop: responsiveHeight(1) }]} onPress={runReview} disabled={reviewing}>
              {reviewing ? (
                <ActivityIndicator color="#E9F8FF" />
              ) : (
                <Text style={styles.generateBtnText}>Run AI Review</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Sparkles size={20} color="#10CDE9" />
              <Text style={styles.reviewTitle}>AI Review</Text>
            </View>
            {aiReview.length ? (
              aiReview.map((item, idx) => {
                const isWarning = item.severity === "warning" || item.severity === "error";
                return (
                  <View key={`${item.title}-${idx}`} style={isWarning ? styles.warningCard : styles.reviewItem}>
                    {isWarning ? (
                      <AlertTriangle size={18} color="#FF5F74" />
                    ) : (
                      <CheckCircle2 size={18} color="#2CD086" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={isWarning ? styles.warningTitle : styles.reviewItemTitle}>{item.title}</Text>
                      <Text style={isWarning ? styles.warningSub : styles.reviewItemSub}>{item.message}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.reviewItem}>
                <Text style={styles.reviewItemSub}>No review yet. Generate or review a draft.</Text>
              </View>
            )}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Signature Field</Text>
            <Switch
              value={signatureEnabled}
              onValueChange={setSignatureEnabled}
              trackColor={{ false: "#313846", true: "#12CDEA" }}
              thumbColor="#F3F8FF"
            />
          </View>

          <VoiceFormFillCard
            label="agreement"
            workflowIntent="agreement"
            sourceScreen="AgreementCreate"
            triggerOpen={voiceTrigger}
            currentValues={{
              title,
              client_name: clientName,
              client_email: clientEmail,
              client_phone: clientPhone,
              agreement_type: agreementType,
              start_date: date,
              content,
            }}
          />

          <Pressable style={styles.sendBtn} onPress={handleCreate} disabled={creating}>
            {creating ? (
              <ActivityIndicator color="#EAF8FF" />
            ) : (
              <Text style={styles.sendBtnText}>Send For Signature</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  header: { marginTop: responsiveHeight(0.7), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerTitle: { color: "#F4F8FF", fontSize: 46 / 2, fontWeight: "700" },
  previewText: { color: "#10CDE9", fontSize: 20, fontWeight: "600" },
  content: { paddingTop: responsiveHeight(1.8), paddingBottom: responsiveHeight(9), gap: responsiveHeight(1.6) , paddingBottom : responsiveHeight(14)},
  panel: { borderRadius: 18, borderWidth: 1, borderColor: "#2B3342", backgroundColor: "#1B1E24", padding: responsiveWidth(4) },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  panelHeaderText: { color: "#DCE5F2", fontSize: 18 },
  panelDivider: { marginTop: responsiveHeight(1), marginBottom: responsiveHeight(1.4), height: 1, backgroundColor: "#333A48" },
  label: { marginTop: responsiveHeight(0.4), marginBottom: responsiveHeight(0.6), color: "#BCC7D7", fontSize: 18 },
  input: {
    minHeight: responsiveHeight(6.5),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#344153",
    backgroundColor: "#1A1D24",
    color: "#EAF2FF",
    paddingHorizontal: responsiveWidth(4),
    fontSize: 17,
    marginBottom: responsiveHeight(1),
  },
  generateCard: { borderRadius: 18, borderWidth: 1, borderColor: "#283245", backgroundColor: "#1B1E24", padding: responsiveWidth(4) },
  generateTitle: { color: "#E7EEF9", fontSize: 20, marginBottom: responsiveHeight(1) },
  promptBox: {
    minHeight: responsiveHeight(10),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#344153",
    backgroundColor: "#1A1D24",
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1.2),
    flexDirection: "row",
    alignItems: "flex-end",
    gap: responsiveWidth(2),
  },
  promptInput: { flex: 1, color: "#D8E2F2", fontSize: 17, minHeight: responsiveHeight(7) },
  contentInput: {
    minHeight: responsiveHeight(20),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#344153",
    backgroundColor: "#1A1D24",
    color: "#D8E2F2",
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1.2),
    fontSize: 16,
    textAlignVertical: "top",
  },
  generateBtn: {
    marginTop: responsiveHeight(1.4),
    minHeight: responsiveHeight(6.3),
    borderRadius: 15,
    backgroundColor: "#12CDEA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
  },
  generateBtnText: { color: "#E9F8FF", fontWeight: "700", fontSize: 18 },
  reviewCard: { borderRadius: 18, borderWidth: 1, borderColor: "#283245", backgroundColor: "#1B1E24", overflow: "hidden" },
  reviewHeader: { minHeight: responsiveHeight(6.5), paddingHorizontal: responsiveWidth(4), flexDirection: "row", alignItems: "center", gap: responsiveWidth(2), backgroundColor: "#1A2436" },
  reviewTitle: { color: "#E7EEF9", fontSize: 18 },
  reviewItem: { flexDirection: "row", gap: responsiveWidth(2.4), paddingHorizontal: responsiveWidth(4), paddingVertical: responsiveHeight(1) },
  reviewItemTitle: { color: "#EAF2FF", fontWeight: "600", fontSize: 17 },
  reviewItemSub: { color: "#7F8BA0", fontSize: 15, marginTop: 2 },
  warningCard: { marginHorizontal: responsiveWidth(4), marginVertical: responsiveHeight(1), padding: responsiveWidth(3), borderRadius: 12, backgroundColor: "#391E2A", flexDirection: "row", gap: responsiveWidth(2.4) },
  warningTitle: { color: "#FF7287", fontWeight: "700", fontSize: 17 },
  warningSub: { color: "#C79AA9", fontSize: 15, marginTop: 2 },
  switchRow: {
    minHeight: responsiveHeight(6.8),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A3342",
    backgroundColor: "#1B1E24",
    paddingHorizontal: responsiveWidth(4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: { color: "#D9E3F3", fontSize: 18 },
  sendBtn: { minHeight: responsiveHeight(6.7), borderRadius: 14, backgroundColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  sendBtnText: { color: "#EAF8FF", fontSize: 19, fontWeight: "700" },
});

export default AgreementCreateScreen;
