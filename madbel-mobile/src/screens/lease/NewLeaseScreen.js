import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Switch, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, Mic, Sparkles, House, Users, Wallet, CalendarDays, PenLine, UserRound, Building2 } from "lucide-react-native";
import {
  useMadbelCreateLeaseMutation,
  useMadbelGenerateLeaseDraftMutation,
} from "../../redux/slices/madbelApiSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const NewLeaseScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const [tenantSignature, setTenantSignature] = useState(true);
  const [landlordSignature, setLandlordSignature] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [address, setAddress] = useState("123 Skyview Terrace, Suite 402");
  const [propertyType, setPropertyType] = useState("apartment");
  const [landlord, setLandlord] = useState("");
  const [tenant, setTenant] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [rent, setRent] = useState("2500");
  const [deposit, setDeposit] = useState("5000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [terms, setTerms] = useState("");

  const [voiceTrigger, setVoiceTrigger] = useState(0);

  const [generateLeaseDraft, { isLoading: generating }] = useMadbelGenerateLeaseDraftMutation();
  const [createLease, { isLoading: creating }] = useMadbelCreateLeaseMutation();

  useEffect(() => {
    const p = route?.params?.prefill;
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    if (p.tenant_name) setTenant(p.tenant_name);
    if (p.tenant_email) setTenantEmail(p.tenant_email);
    if (p.tenant_phone) setTenantPhone(p.tenant_phone);
    if (p.landlord_name) setLandlord(p.landlord_name);
    if (p.property_address) setAddress(p.property_address);
    if (p.property_type) setPropertyType(p.property_type);
    if (p.monthly_rent != null) setRent(String(p.monthly_rent));
    if (p.security_deposit != null) setDeposit(String(p.security_deposit));
    if (p.start_date) setStartDate(p.start_date);
    if (p.end_date) setEndDate(p.end_date);
    if (p.custom_terms) setTerms(p.custom_terms);
    if (p.prompt) setPrompt(p.prompt);
    // Clear to prevent re-applying on re-render
    navigation.setParams?.({ prefill: undefined });
  }, [route?.params?.prefill]);

  const parseMoney = (value) => {
    const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
    return Number.isNaN(numeric) ? undefined : numeric;
  };

  const normalizeDate = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString().slice(0, 10);
  };

  const buildPayload = () => ({
    property_address: address.trim(),
    property_type: propertyType.toLowerCase(),
    landlord_name: landlord.trim() || undefined,
    tenant_name: tenant.trim() || undefined,
    tenant_email: tenantEmail.trim() || undefined,
    tenant_phone: tenantPhone.trim() || undefined,
    monthly_rent: parseMoney(rent),
    security_deposit: parseMoney(deposit),
    start_date: normalizeDate(startDate),
    end_date: normalizeDate(endDate),
    custom_terms: terms.trim() || undefined,
    signature_fields: {
      tenant_signature: tenantSignature,
      landlord_signature: landlordSignature,
    },
  });

  const runGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert(t("prompt_required"), t("please_add_a_prompt_to_generate_lease_draft"));
      return;
    }
    try {
      const response = await generateLeaseDraft({
        prompt: prompt.trim(),
        ...buildPayload(),
      }).unwrap();
      const draft = response?.data || {};
      setAddress(draft?.property_address || address);
      setPropertyType(draft?.property_type || propertyType);
      setLandlord(draft?.landlord_name || landlord);
      setTenant(draft?.tenant_name || tenant);
      setTenantEmail(draft?.tenant_email || tenantEmail);
      setTenantPhone(draft?.tenant_phone || tenantPhone);
      setRent(String(draft?.monthly_rent ?? rent));
      setDeposit(String(draft?.security_deposit ?? deposit));
      setStartDate(draft?.start_date || startDate);
      setEndDate(draft?.end_date || endDate);
      setTerms(draft?.custom_terms || terms);
    } catch (error) {
      Alert.alert("Generate failed", error?.data?.message || "Could not generate lease draft.");
    }
  };

  const handleCreate = async () => {
    if (!address.trim() || !tenant.trim() || !rent.trim()) {
      Alert.alert(t("missing_fields"), t("property_address_tenant_name_and_monthly_rent_are_"));
      return;
    }
    try {
      const response = await createLease(buildPayload()).unwrap();
      const createdLease = response?.data || response;
      const leaseId = createdLease?.id;
      if (!leaseId) {
        Alert.alert(t("create_failed"), t("lease_was_created_but_lease_id_is_missing_in_respo"));
        return;
      }
      navigation.replace("LeasePreview", { leaseId, lease: createdLease });
    } catch (error) {
      Alert.alert("Create failed", error?.data?.message || "Could not create lease.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <ChevronLeft size={34} color="#F5FAFF" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("new_lease")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("generate_lease_with_ai")}</Text>
            <View style={styles.promptBox}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder={t("create_a_1_year_apartment_lease")}
                placeholderTextColor="#66748C"
                multiline
                style={styles.promptInput}
              />
              <Pressable onPress={() => setVoiceTrigger((t) => t + 1)} hitSlop={10}>
                <Mic size={22} color="#11CDE8" />
              </Pressable>
            </View>
            <Pressable style={styles.generateBtn} onPress={runGenerate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color="#EAF9FF" />
              ) : (
                <>
                  <Sparkles size={20} color="#EAF9FF" />
                  <Text style={styles.generateText}>{t("generate_lease")}</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><House size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("property_details")}</Text></View>
            <Text style={styles.label}>{t("property_address")}</Text>
            <TextInput value={address} onChangeText={setAddress} style={styles.input} />
            <Text style={styles.label}>{t("property_type")}</Text>
            <TextInput value={propertyType} onChangeText={setPropertyType} style={styles.input} />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><Users size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("parties_info")}</Text></View>
            <Text style={styles.label}>{t("landlord_full_name")}</Text>
            <TextInput value={landlord} onChangeText={setLandlord} placeholder={t("e_g_john_doe")} placeholderTextColor="#66748C" style={styles.input} />
            <Text style={styles.label}>{t("tenant_full_name")}</Text>
            <TextInput value={tenant} onChangeText={setTenant} placeholder={t("e_g_jane_smith")} placeholderTextColor="#66748C" style={styles.input} />
            <Text style={styles.label}>{t("tenant_email")}</Text>
            <TextInput value={tenantEmail} onChangeText={setTenantEmail} placeholder={t("email_example_com")} placeholderTextColor="#66748C" style={styles.input} autoCapitalize="none" />
            <Text style={styles.label}>{t("tenant_phone")}</Text>
            <TextInput value={tenantPhone} onChangeText={setTenantPhone} placeholder="+1 234 567 890" placeholderTextColor="#66748C" style={styles.input} />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><Wallet size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("payment_details")}</Text></View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>{t("monthly_rent")}</Text>
                <TextInput value={rent} onChangeText={setRent} keyboardType="numeric" style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>{t("security_deposit")}</Text>
                <TextInput value={deposit} onChangeText={setDeposit} keyboardType="numeric" style={styles.input} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><CalendarDays size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("lease_duration")}</Text></View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>{t("start_date")}</Text>
                <TextInput value={startDate} onChangeText={setStartDate} placeholder={t("yyyy_mm_dd")} placeholderTextColor="#66748C" style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>{t("end_date")}</Text>
                <TextInput value={endDate} onChangeText={setEndDate} placeholder={t("yyyy_mm_dd")} placeholderTextColor="#66748C" style={styles.input} />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><PenLine size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("lease_terms")}</Text></View>
            <TextInput
              value={terms}
              onChangeText={setTerms}
              placeholder={t("enter_custom_terms_or_use_ai_to_generate_legal_cla")}
              placeholderTextColor="#66748C"
              multiline
              style={styles.textArea}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}><PenLine size={20} color="#11CDE8" /><Text style={styles.blockTitle}>{t("signature_fields")}</Text></View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}><UserRound size={18} color="#AAB7CA" /><Text style={styles.switchText}>{t("tenant_signature")}</Text></View>
              <Switch value={tenantSignature} onValueChange={setTenantSignature} trackColor={{ false: "#2C3445", true: "#10CDE9" }} thumbColor="#F2F8FF" />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}><Building2 size={18} color="#AAB7CA" /><Text style={styles.switchText}>{t("landlord_signature")}</Text></View>
              <Switch value={landlordSignature} onValueChange={setLandlordSignature} trackColor={{ false: "#2C3445", true: "#10CDE9" }} thumbColor="#F2F8FF" />
            </View>
          </View>

          <VoiceFormFillCard
            label={t("lease")}
            workflowIntent="lease"
            sourceScreen="NewLease"
            triggerOpen={voiceTrigger}
            currentValues={{
              tenant_name: tenant,
              tenant_email: tenantEmail,
              tenant_phone: tenantPhone,
              landlord_name: landlord,
              property_address: address,
              property_type: propertyType,
              monthly_rent: rent,
              security_deposit: deposit,
              start_date: startDate,
              end_date: endDate,
              custom_terms: terms,
            }}
          />

          <Pressable style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
            {creating ? (
              <ActivityIndicator color="#EAF8FF" />
            ) : (
              <Text style={styles.submitText}>{t("preview_lease")}</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  header: { marginTop: responsiveHeight(0.7), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#F4F8FF", fontSize: 44 / 2, fontWeight: "700" },
  content: { paddingTop: responsiveHeight(1.8), paddingBottom: responsiveHeight(8), gap: responsiveHeight(1.4) },
  card: { borderRadius: 18, borderWidth: 1, borderColor: "#2B3342", backgroundColor: "#1A1D24", padding: responsiveWidth(4) },
  sectionTitle: { color: "#11CDE8", fontSize: 26 / 2, letterSpacing: 2, marginBottom: responsiveHeight(1) },
  promptBox: { borderRadius: 12, borderWidth: 1, borderColor: "#334056", backgroundColor: "#1A1D24", minHeight: responsiveHeight(8.2), padding: responsiveWidth(3), flexDirection: "row", alignItems: "flex-end", gap: responsiveWidth(2) },
  promptInput: { flex: 1, color: "#D8E2F2", fontSize: 17, minHeight: responsiveHeight(5) },
  generateBtn: { marginTop: responsiveHeight(1.2), borderRadius: 14, minHeight: responsiveHeight(6), backgroundColor: "#12CDEA", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: responsiveWidth(2) },
  generateText: { color: "#EAF9FF", fontSize: 20 / 2, fontWeight: "700" },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2), marginBottom: responsiveHeight(1) },
  blockTitle: { color: "#DCE5F2", fontSize: 20 / 2 },
  label: { color: "#A8B3C4", fontSize: 16 / 2, marginBottom: responsiveHeight(0.5), marginTop: responsiveHeight(0.2) },
  input: { minHeight: responsiveHeight(5.8), borderRadius: 10, borderWidth: 1, borderColor: "#334056", backgroundColor: "#1A1D24", color: "#EAF2FF", paddingHorizontal: responsiveWidth(3), fontSize: 16, marginBottom: responsiveHeight(0.8) },
  twoCol: { flexDirection: "row", gap: responsiveWidth(3) },
  col: { flex: 1 },
  textArea: { minHeight: responsiveHeight(13), borderRadius: 10, borderWidth: 1, borderColor: "#334056", backgroundColor: "#1A1D24", color: "#EAF2FF", paddingHorizontal: responsiveWidth(3), paddingTop: responsiveHeight(1), fontSize: 16, textAlignVertical: "top" },
  switchRow: { minHeight: responsiveHeight(6.2), borderRadius: 10, borderWidth: 1, borderColor: "#334056", paddingHorizontal: responsiveWidth(3), flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: responsiveHeight(0.8) },
  switchLabelWrap: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  switchText: { color: "#DCE5F2", fontSize: 17 },
  submitBtn: { minHeight: responsiveHeight(6.4), borderRadius: 14, backgroundColor: "#11CDE8", alignItems: "center", justifyContent: "center" },
  submitText: { color: "#EAF8FF", fontSize: 20 / 2, fontWeight: "700" },
});

export default NewLeaseScreen;
