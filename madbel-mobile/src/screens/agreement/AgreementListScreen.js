import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, Plus, Search, Eye, Trash2, Signature, UserRound, Building2, Shield, Phone, FileText } from "lucide-react-native";
import {
  useMadbelDeleteAgreementMutation,
  useMadbelListAgreementsQuery,
  useMadbelSendAgreementForSignatureMutation,
} from "../../redux/slices/madbelApiSlice";

const STATUS_MAP = {
  pending_signature: { label: "PENDING SIGNATURE", bg: "#3A3512", border: "#776800", color: "#F5D728" },
  signed: { label: "SIGNED", bg: "#0F3426", border: "#1B6F4D", color: "#37E088" },
  expired: { label: "EXPIRED", bg: "#3A1920", border: "#703341", color: "#FF5E74" },
  draft: { label: "DRAFT", bg: "#253041", border: "#40506A", color: "#9EC4FF" },
  cancelled: { label: "CANCELLED", bg: "#372A2F", border: "#635059", color: "#E5B9C7" },
};

const iconForType = (type) => {
  const typeStr = String(type || "").toLowerCase();
  if (typeStr.includes("lease")) return Building2;
  if (typeStr.includes("legal") || typeStr.includes("nda")) return Shield;
  if (typeStr.includes("vendor")) return Phone;
  return UserRound;
};

const formatDate = (value) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const AgreementListScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const {
    data,
    isLoading,
    isFetching,
    error,
  } = useMadbelListAgreementsQuery({
    page: 1,
    page_size: 100,
    search: query.trim() || undefined,
  });
  const [deleteAgreement, { isLoading: deletingAgreement }] = useMadbelDeleteAgreementMutation();
  const [sendForSignature, { isLoading: sendingSignature }] =
    useMadbelSendAgreementForSignatureMutation();

  const agreements = data?.data?.items || [];
  const filtered = useMemo(() => agreements, [agreements]);

  const handleDelete = (agreement) => {
    Alert.alert(t("delete_agreement"), t("are_you_sure_you_want_to_delete_this_agreement"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAgreement({ agreement_id: agreement.id }).unwrap();
          } catch (err) {
            Alert.alert("Delete failed", err?.data?.message || "Could not delete agreement.");
          }
        },
      },
    ]);
  };

  const handleSend = async (agreement) => {
    try {
      await sendForSignature({
        agreement_id: agreement.id,
        recipient_name: agreement.client_name,
        recipient_email: agreement.client_email,
        channel: "email",
      }).unwrap();
      Alert.alert(t("sent"), t("agreement_sent_for_signature"));
    } catch (err) {
      Alert.alert("Send failed", err?.data?.message || "Could not send agreement for signature.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()}>
              <ChevronLeft size={responsiveWidth(5)} color="#F8FAFC" />
            </Pressable>
            <Text style={styles.headerTitle}>{t("agreement")}</Text>
          </View>
          <Pressable style={styles.newBtn} onPress={() => navigation.navigate("AgreementCreate")}>
            <Plus size={24} color="#EAF9FF" />
            <Text style={styles.newBtnText}>{t("new")}</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search size={26} color="#11CDE8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search_agreements")}
            placeholderTextColor="#626F86"
            style={styles.searchInput}
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#14C9E7" size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.metaText}>{t("could_not_load_agreements")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.metaText}>{t("no_agreements_found")}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const statusKey = String(item.status || "draft").toLowerCase();
              const status = STATUS_MAP[statusKey] || STATUS_MAP.draft;
              const MetaIcon = iconForType(item.agreement_type || item.agreement_type_label);
              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={[styles.statusPill, { backgroundColor: status.bg, borderColor: status.border }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <UserRound size={22} color="#7C4DFF" />
                    <Text style={styles.metaTextRow}>{item.client_name || item.client_email || item.client_phone || "--"}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <MetaIcon size={22} color="#A2ADB9" />
                    <Text style={styles.metaTextRow}>{item.agreement_type_label || item.agreement_type || "Agreement"}</Text>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.bottomRow}>
                    <Text style={styles.dateText}>{formatDate(item.sent_at || item.created_at)}</Text>
                    <View style={styles.actions}>
                      <Pressable onPress={() => navigation.navigate("AgreementPreview", { agreementId: item.id, agreement: item })}>
                        <Eye size={25} color="#9AA6B5" />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(item)} disabled={deletingAgreement}>
                        <Trash2 size={25} color="#9AA6B5" />
                      </Pressable>
                      {(statusKey === "pending_signature" || statusKey === "draft") ? (
                        <Pressable onPress={() => handleSend(item)} disabled={sendingSignature}>
                          <Signature size={25} color="#12D0ED" />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => navigation.navigate("AgreementPreview", { agreementId: item.id, agreement: item })}
                        >
                          <FileText size={25} color="#12D0ED" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}
        {(isFetching && !isLoading) ? (
          <Text style={styles.refresh}>{t("refreshing_agreements")}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  headerRow: {
    marginTop: responsiveHeight(0.7),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  headerTitle: { color: "#F4F8FF", fontSize: responsiveWidth(5), fontWeight: "700" },
  newBtn: {
    minHeight: responsiveHeight(5.2),
    borderRadius: 20,
    backgroundColor: "#12CDEA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(1.4),
  },
  newBtnText: { color: "#EAF9FF", fontSize: responsiveWidth(4), fontWeight: "700" },
  searchBox: {
    marginTop: responsiveHeight(1.8),
    minHeight: responsiveHeight(6.7),
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#2A303C",
    backgroundColor: "#1A1D24",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(2.5),
  },
  searchInput: { flex: 1, color: "#DCE5F2", fontSize: 20 },
  listContent: { paddingTop: responsiveHeight(1.8), paddingBottom: responsiveHeight(10), gap: responsiveHeight(1.4) },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#515765",
    backgroundColor: "#1B1D23",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.6),
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: responsiveWidth(3) },
  cardTitle: { flex: 1, color: "#F4F7FD", fontWeight: "700", fontSize: 20 },
  statusPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: responsiveWidth(2.3), paddingVertical: responsiveHeight(0.5) },
  statusText: { fontSize: 13, fontWeight: "700" },
  metaRow: { marginTop: responsiveHeight(1), flexDirection: "row", alignItems: "center", gap: responsiveWidth(2.1) },
  metaTextRow: { color: "#C3CEDD", fontSize: 20 },
  separator: { marginTop: responsiveHeight(1.2), marginBottom: responsiveHeight(1), height: 1, backgroundColor: "#293244" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateText: { color: "#9EA8B7", fontSize: 19 },
  actions: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(5) },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: responsiveHeight(3) },
  metaText: { color: "#9EA9BD", fontSize: 16 },
  refresh: { color: "#88C4D3", textAlign: "center", marginBottom: responsiveHeight(0.5) },
});

export default AgreementListScreen;
