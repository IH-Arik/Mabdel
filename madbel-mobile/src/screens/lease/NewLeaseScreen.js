import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  House,
  Mic,
  PenLine,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react-native";
import {
  useMadbelCreateLeaseMutation,
  useMadbelGenerateLeaseDraftMutation,
  useMadbelUpdateLeaseMutation,
} from "../../redux/slices/madbelApiSlice";
import { useAppLanguage } from "../../context/LanguageContext";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import useKeyboard from "../../hooks/useKeyboard";

const SIGNING_PROVIDER = "docusign";

const toTrimmedString = (value) => String(value ?? "").trim();

const parseMoney = (value) => {
  const numeric = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isNaN(numeric) ? undefined : numeric;
};

const normalizeDate = (value) => {
  const trimmed = toTrimmedString(value);
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
};

const formatDateLabel = (value) => {
  const normalized = normalizeDate(value);
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const extractLeaseId = (response) =>
  response?.data?.id ||
  response?.data?.lease_id ||
  response?.data?._id ||
  response?.id ||
  response?.lease_id ||
  response?._id ||
  null;

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

const NewLeaseScreen = () => {
  const { t } = useAppLanguage();
  const tr = (key, fallback = key) => {
    const value = t?.(key);
    return value && value !== key ? value : fallback;
  };
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboard();
  const authToken = useSelector(
    (state) => state?.auth?.accessToken || state?.auth?.token,
  );

  const isEditMode = route?.params?.mode === "edit" || route?.params?.editing === true;
  const editingLeaseId = route?.params?.leaseId || route?.params?.lease?.id || route?.params?.lease?._id || null;
  const routePrefill = route?.params?.prefill || route?.params?.lease || {};

  const [voiceTrigger, setVoiceTrigger] = useState(0);
  const [tenantSignature, setTenantSignature] = useState(true);
  const [landlordSignature, setLandlordSignature] = useState(true);
  const [prompt, setPrompt] = useState(routePrefill.prompt || "");
  const [address, setAddress] = useState(
    routePrefill.property_address || "123 Skyview Terrace, Suite 402",
  );
  const [propertyType, setPropertyType] = useState(
    routePrefill.property_type || "apartment",
  );
  const [landlord, setLandlord] = useState(routePrefill.landlord_name || "");
  const [tenant, setTenant] = useState(routePrefill.tenant_name || "");
  const [tenantEmail, setTenantEmail] = useState(routePrefill.tenant_email || "");
  const [tenantPhone, setTenantPhone] = useState(routePrefill.tenant_phone || "");
  const [rent, setRent] = useState(
    routePrefill.monthly_rent != null ? String(routePrefill.monthly_rent) : "2500",
  );
  const [deposit, setDeposit] = useState(
    routePrefill.security_deposit != null
      ? String(routePrefill.security_deposit)
      : "5000",
  );
  const [startDate, setStartDate] = useState(routePrefill.start_date || "");
  const [endDate, setEndDate] = useState(routePrefill.end_date || "");
  const [terms, setTerms] = useState(routePrefill.custom_terms || "");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState("start");

  const [generateLeaseDraft, { isLoading: generating }] =
    useMadbelGenerateLeaseDraftMutation();
  const [createLease, { isLoading: creating }] = useMadbelCreateLeaseMutation();
  const [updateLease, { isLoading: updating }] = useMadbelUpdateLeaseMutation();

  useEffect(() => {
    const prefill = route?.params?.prefill;
    if (!prefill || typeof prefill !== "object" || !Object.keys(prefill).length) {
      return;
    }

    if (prefill.prompt) setPrompt(prefill.prompt);
    if (prefill.property_address) setAddress(prefill.property_address);
    if (prefill.property_type) setPropertyType(prefill.property_type);
    if (prefill.landlord_name) setLandlord(prefill.landlord_name);
    if (prefill.tenant_name) setTenant(prefill.tenant_name);
    if (prefill.tenant_email) setTenantEmail(prefill.tenant_email);
    if (prefill.tenant_phone) setTenantPhone(prefill.tenant_phone);
    if (prefill.monthly_rent != null) setRent(String(prefill.monthly_rent));
    if (prefill.security_deposit != null) setDeposit(String(prefill.security_deposit));
    if (prefill.start_date) setStartDate(prefill.start_date);
    if (prefill.end_date) setEndDate(prefill.end_date);
    if (prefill.custom_terms) setTerms(prefill.custom_terms);

    navigation.setParams?.({ prefill: undefined });
  }, [navigation, route?.params?.prefill]);

  const buildPayload = () => ({
    property_address: toTrimmedString(address),
    property_type: toTrimmedString(propertyType).toLowerCase(),
    landlord_name: toTrimmedString(landlord) || undefined,
    tenant_name: toTrimmedString(tenant) || undefined,
    tenant_email: toTrimmedString(tenantEmail) || undefined,
    tenant_phone: toTrimmedString(tenantPhone) || undefined,
    monthly_rent: parseMoney(rent),
    security_deposit: parseMoney(deposit),
    start_date: normalizeDate(startDate),
    end_date: normalizeDate(endDate),
    custom_terms: toTrimmedString(terms) || undefined,
    signing_provider:
      tenantSignature || landlordSignature ? SIGNING_PROVIDER : undefined,
    signature_fields: {
      tenant_signature: tenantSignature,
      landlord_signature: landlordSignature,
    },
  });

  const syncDraftIntoForm = (draft = {}) => {
    if (draft.property_address) setAddress(draft.property_address);
    if (draft.property_type) setPropertyType(draft.property_type);
    if (draft.landlord_name) setLandlord(draft.landlord_name);
    if (draft.tenant_name) setTenant(draft.tenant_name);
    if (draft.tenant_email) setTenantEmail(draft.tenant_email);
    if (draft.tenant_phone) setTenantPhone(draft.tenant_phone);
    if (draft.monthly_rent != null) setRent(String(draft.monthly_rent));
    if (draft.security_deposit != null) setDeposit(String(draft.security_deposit));
    if (draft.start_date) setStartDate(draft.start_date);
    if (draft.end_date) setEndDate(draft.end_date);
    if (draft.custom_terms) setTerms(draft.custom_terms);

    const signatureFields = draft.signature_fields || {};
    if (typeof signatureFields.tenant_signature === "boolean") {
      setTenantSignature(signatureFields.tenant_signature);
    } else if (typeof draft.tenant_signature === "boolean") {
      setTenantSignature(draft.tenant_signature);
    }

    if (typeof signatureFields.landlord_signature === "boolean") {
      setLandlordSignature(signatureFields.landlord_signature);
    } else if (typeof draft.landlord_signature === "boolean") {
      setLandlordSignature(draft.landlord_signature);
    }
  };

  const openCalendarForField = (field) => {
    setActiveDateField(field);
    setCalendarVisible(true);
  };

  const handleSelectDate = (selectedDate) => {
    if (activeDateField === "end") {
      setEndDate(selectedDate);
      return;
    }

    setStartDate(selectedDate);
  };

  const runGenerate = async () => {
    if (!toTrimmedString(prompt)) {
      Alert.alert(
        tr("prompt_required", "Prompt required"),
        tr(
          "please_add_a_prompt_to_generate_lease_draft",
          "Please add a prompt to generate lease draft.",
        ),
      );
      return;
    }

    try {
      const response = await generateLeaseDraft({
        prompt: toTrimmedString(prompt),
        ...buildPayload(),
      }).unwrap();
      syncDraftIntoForm(response?.data || response || {});
    } catch (error) {
      Alert.alert(
        tr("generate_failed", "Generate failed"),
        error?.data?.message || tr("could_not_generate_content_please_try_again", "Could not generate content. Please try again."),
      );
    }
  };

  const handleCreate = async () => {
    if (!authToken) {
      Alert.alert(tr("session_expired", "Session expired"), tr("please_login_again_to_continue", "Please login again to continue."), [
        {
          text: "OK",
          onPress: () => navigation.navigate("Auth"),
        },
      ]);
      return;
    }

    if (!toTrimmedString(address) || !toTrimmedString(tenant) || !toTrimmedString(rent)) {
      Alert.alert(
        tr("missing_fields", "Missing fields"),
        tr(
          "property_address_tenant_name_and_monthly_rent_are_",
          "Property address, tenant name, and monthly rent are required.",
        ),
      );
      return;
    }

    try {
      if (isEditMode && !editingLeaseId) {
        Alert.alert(
          tr("update_failed", "Update failed"),
          tr("lease_id_is_missing", "Lease id is missing."),
        );
        return;
      }

      const response = isEditMode
        ? await updateLease({
            lease_id: editingLeaseId,
            ...buildPayload(),
          }).unwrap()
        : await createLease(buildPayload()).unwrap();
      const createdLease = response?.data || response;
      const leaseId = extractLeaseId(createdLease);
      const signingUrl = resolveSigningUrl(response) || resolveSigningUrl(createdLease);
      const signingToken = resolveSigningToken(response) || resolveSigningToken(createdLease);

      if (!leaseId) {
        Alert.alert(
          isEditMode ? tr("update_failed", "Update failed") : tr("create_failed", "Create failed"),
          tr(
            "lease_was_created_but_lease_id_is_missing_in_respo",
            isEditMode
              ? "Lease was updated but lease id is missing in response."
              : "Lease was created but lease id is missing in response.",
          ),
        );
        return;
      }

      navigation.replace("LeasePreview", {
        leaseId,
        lease: createdLease,
      });

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
      if (
        error?.status === 401 ||
        error?.originalStatus === 401 ||
        error?.data?.message === "Not authenticated"
      ) {
        Alert.alert(tr("session_expired", "Session expired"), tr("please_login_again_to_continue", "Please login again to continue."), [
          {
            text: "OK",
            onPress: () => navigation.navigate("Auth"),
          },
        ]);
        return;
      }

      Alert.alert(
        isEditMode ? tr("update_failed", "Update failed") : tr("create_failed", "Create failed"),
        error?.data?.message || (isEditMode ? "Could not update lease." : "Could not create lease."),
      );
    }
  };

  const isBusy = generating || creating || updating;
  const footerBottomMargin =
    keyboardHeight > 0
      ? keyboardHeight + insets.bottom + responsiveHeight(1)
      : insets.bottom + responsiveHeight(5);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={34} color="#F5FAFF" />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditMode ? tr("edit_lease", "Edit Lease") : tr("new_lease", "New Lease")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* <View style={styles.card}>
            <Text style={styles.sectionTitle}>{tr("generate_lease_with_ai", "GENERATE LEASE WITH AI")}</Text>
            <View style={styles.promptBox}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                placeholder={tr("create_a_1_year_apartment_lease", "Create a 1-year apartment lease...")}
                placeholderTextColor="#66748C"
                multiline
                style={styles.promptInput}
              />
              <Pressable
                onPress={() => setVoiceTrigger((value) => value + 1)}
                hitSlop={10}
                style={styles.micButton}
              >
                <Mic size={22} color="#11CDE8" />
              </Pressable>
            </View>

            <Pressable
              style={styles.generateBtn}
              onPress={runGenerate}
              disabled={isBusy}
            >
              {generating ? (
                <ActivityIndicator color="#EAF9FF" />
              ) : (
                <>
                  <Sparkles size={20} color="#EAF9FF" />
                  <Text style={styles.generateText}>{tr("generate_lease", "Generate Lease")}</Text>
                </>
              )}
            </Pressable>
          </View> */}

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <House size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("property_details", "Property Details")}</Text>
            </View>
            <Text style={styles.label}>{tr("property_address", "Property Address")}</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={tr("property_address", "Property Address")}
              placeholderTextColor="#66748C"
              style={styles.input}
            />
            <Text style={styles.label}>{tr("property_type", "Property Type")}</Text>
            <TextInput
              value={propertyType}
              onChangeText={setPropertyType}
              placeholder={tr("property_type", "Property Type")}
              placeholderTextColor="#66748C"
              style={styles.input}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <Users size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("parties_info", "Parties Info")}</Text>
            </View>
            <Text style={styles.label}>{tr("landlord_full_name", "Landlord Full Name")}</Text>
            <TextInput
              value={landlord}
              onChangeText={setLandlord}
              placeholder={tr("e_g_john_doe", "e.g. John Doe")}
              placeholderTextColor="#66748C"
              style={styles.input}
            />
            <Text style={styles.label}>{tr("tenant_full_name", "Tenant Full Name")}</Text>
            <TextInput
              value={tenant}
              onChangeText={setTenant}
              placeholder={tr("e_g_jane_smith", "e.g. Jane Smith")}
              placeholderTextColor="#66748C"
              style={styles.input}
            />
            <Text style={styles.label}>{tr("tenant_email", "Tenant Email")}</Text>
            <TextInput
              value={tenantEmail}
              onChangeText={setTenantEmail}
              placeholder={tr("email_example_com", "email@example.com")}
              placeholderTextColor="#66748C"
              style={styles.input}
              autoCapitalize="none"
            />
            <Text style={styles.label}>{tr("tenant_phone", "Tenant Phone")}</Text>
            <TextInput
              value={tenantPhone}
              onChangeText={setTenantPhone}
              placeholder="+1 234 567 890"
              placeholderTextColor="#66748C"
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <Wallet size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("payment_details", "Payment Details")}</Text>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>{tr("monthly_rent", "Monthly Rent")}</Text>
                <TextInput
                  value={rent}
                  onChangeText={setRent}
                  placeholder="2500"
                  placeholderTextColor="#66748C"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>{tr("security_deposit", "Security Deposit")}</Text>
                <TextInput
                  value={deposit}
                  onChangeText={setDeposit}
                  placeholder="5000"
                  placeholderTextColor="#66748C"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <CalendarDays size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("lease_duration", "Lease Duration")}</Text>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>{tr("start_date", "Start Date")}</Text>
                <Pressable
                  onPress={() => openCalendarForField("start")}
                  style={[styles.input, styles.dateInput]}
                >
                  <Text
                    style={[
                      styles.dateValueText,
                      !startDate ? styles.datePlaceholderText : null,
                    ]}
                  >
                    {startDate ? (startDate) : tr("select_start_date", "Select start date")}
                  </Text>
                  <CalendarDays size={20} color="#90A0B8" />
                </Pressable>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>{tr("end_date", "End Date")}</Text>
                <Pressable
                  onPress={() => openCalendarForField("end")}
                  style={[styles.input, styles.dateInput]}
                >
                  <Text
                    style={[
                      styles.dateValueText,
                      !endDate ? styles.datePlaceholderText : null,
                    ]}
                  >
                    {endDate ? (endDate) : tr("select_end_date", "Select end date")}
                  </Text>
                  <CalendarDays size={20} color="#90A0B8" />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <PenLine size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("lease_terms", "Lease Terms")}</Text>
            </View>
            <TextInput
              value={terms}
              onChangeText={setTerms}
              placeholder={tr(
                "enter_custom_terms_or_use_ai_to_generate_legal_cla",
                "Enter custom terms or use AI to generate legal clauses...",
              )}
              placeholderTextColor="#66748C"
              multiline
              style={styles.textArea}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.rowTitle}>
              <PenLine size={20} color="#11CDE8" />
              <Text style={styles.blockTitle}>{tr("signature_fields", "Signature Fields")}</Text>
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}>
                <UserRoundIcon />
                <Text style={styles.switchText}>{tr("tenant_signature", "Tenant Signature")}</Text>
              </View>
              <Switch
                value={tenantSignature}
                onValueChange={setTenantSignature}
                trackColor={{ false: "#2C3445", true: "#10CDE9" }}
                thumbColor="#F2F8FF"
              />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLabelWrap}>
                <BuildingIcon />
                <Text style={styles.switchText}>{tr("landlord_signature", "Landlord Signature")}</Text>
              </View>
              <Switch
                value={landlordSignature}
                onValueChange={setLandlordSignature}
                trackColor={{ false: "#2C3445", true: "#10CDE9" }}
                thumbColor="#F2F8FF"
              />
            </View>
          </View>

          <VoiceFormFillCard
            label={tr("lease", "Lease")}
            workflowIntent="lease"
            sourceScreen="NewLease"
            triggerOpen={voiceTrigger}
            currentValues={{
              prompt,
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
              signature_fields: {
                tenant_signature: tenantSignature,
                landlord_signature: landlordSignature,
              },
            }}
          />

       
        </ScrollView>
   <Pressable
            style={[styles.submitBtn, { marginBottom: footerBottomMargin }]}
            onPress={handleCreate}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#EAF8FF" />
            ) : (
              <Text style={styles.submitText}>
                {isEditMode ? tr("save_changes", "Save Changes") : tr("preview_lease", "Preview Lease")}
              </Text>
            )}
          </Pressable>
        <SystemCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          selectedDate={activeDateField === "end" ? endDate : startDate}
          onSelectDate={handleSelectDate}
        />
      </View>
    </SafeAreaView>
  );
};

const UserRoundIcon = () => <Users size={18} color="#AAB7CA" />;

const BuildingIcon = () => <Building2 size={18} color="#AAB7CA" />;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#010507",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4),
  },
  header: {
    marginTop: responsiveHeight(0.7),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: responsiveWidth(11.2),
    height: responsiveWidth(11.2),
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#F4F8FF",
    fontSize: responsiveWidth(3.9),
    fontWeight: "700",
  },
  headerSpacer: {
    width: responsiveWidth(11.2),
  },
  content: {
    paddingTop: responsiveHeight(1.8),
    paddingBottom: responsiveHeight(14),
    gap: responsiveHeight(1.4),
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3342",
    backgroundColor: "#1A1D24",
    padding: responsiveWidth(4),
  },
  sectionTitle: {
    color: "#11CDE8",
    fontSize: responsiveWidth(3.4),
    letterSpacing: 2,
    marginBottom: responsiveHeight(1),
  },
  promptBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334056",
    backgroundColor: "#1A1D24",
    minHeight: responsiveHeight(8.2),
    padding: responsiveWidth(3),
    flexDirection: "row",
    alignItems: "flex-end",
    gap: responsiveWidth(2),
  },
  promptInput: {
    flex: 1,
    color: "#D8E2F2",
    fontSize: responsiveWidth(4.1),
    minHeight: responsiveHeight(5),
  },
  micButton: {
    padding: 2,
  },
  generateBtn: {
    marginTop: responsiveHeight(1.2),
    borderRadius: 14,
    minHeight: responsiveHeight(6),
    backgroundColor: "#12CDEA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: responsiveWidth(2),
  },
  generateText: {
    color: "#EAF9FF",
    fontSize: responsiveWidth(3.8),
    fontWeight: "700",
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
    marginBottom: responsiveHeight(1),
  },
  blockTitle: {
    color: "#DCE5F2",
    fontSize: responsiveWidth(3.8),
    fontWeight: "600",
  },
  label: {
    color: "#A8B3C4",
    fontSize: responsiveWidth(3.3),
    marginBottom: responsiveHeight(0.5),
    marginTop: responsiveHeight(0.2),
  },
  input: {
    minHeight: responsiveHeight(5.8),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334056",
    backgroundColor: "#1A1D24",
    color: "#EAF2FF",
    paddingHorizontal: responsiveWidth(3),
    fontSize: responsiveWidth(3.8),
    marginBottom: responsiveHeight(0.8),
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: responsiveWidth(2),
  },
  dateValueText: {
    flex: 1,
    color: "#EAF2FF",
    fontSize: responsiveWidth(3.8),
  },
  datePlaceholderText: {
    color: "#66748C",
  },
  twoCol: {
    flexDirection: "row",
    gap: responsiveWidth(3),
  },
  col: {
    flex: 1,
  },
  textArea: {
    minHeight: responsiveHeight(13),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334056",
    backgroundColor: "#1A1D24",
    color: "#EAF2FF",
    paddingHorizontal: responsiveWidth(3),
    paddingTop: responsiveHeight(1),
    fontSize: responsiveWidth(3.8),
  },
  switchRow: {
    minHeight: responsiveHeight(6.2),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334056",
    paddingHorizontal: responsiveWidth(3),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: responsiveHeight(0.8),
  },
  switchLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  switchText: {
    color: "#DCE5F2",
    fontSize: responsiveWidth(3.7),
  },
  submitBtn: {
    minHeight: responsiveHeight(6.4),
    borderRadius: 14,
    backgroundColor: "#11CDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#EAF8FF",
    fontSize: responsiveWidth(3.8),
    fontWeight: "700",
  },
});

export default NewLeaseScreen;
