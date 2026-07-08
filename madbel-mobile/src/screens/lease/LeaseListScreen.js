import { useAppLanguage } from "../../context/LanguageContext";
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, FlatList, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { ChevronLeft, Plus, Search, CalendarDays, Eye, Trash2 } from "lucide-react-native";
import { useMadbelDeleteLeaseMutation, useMadbelListLeasesQuery } from "../../redux/slices/madbelApiSlice";

const formatRent = (lease) => {
  const { t } = useAppLanguage();
  const value = lease?.monthly_rent ?? lease?.rent_amount ?? lease?.monthly_rent_amount;
  if (value === undefined || value === null) return "--";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return `${value}/mo`;
  return `$${numeric.toLocaleString()}/mo`;
};

const formatDate = (value) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const leaseDuration = (lease) => {
  const start = lease?.start_date ? new Date(lease.start_date) : null;
  const end = lease?.end_date ? new Date(lease.end_date) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "--";
  const months = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
  return `${months} Months`;
};

const LeaseListScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const { data, isLoading, isFetching, error } = useMadbelListLeasesQuery({
    page: 1,
    page_size: 100,
    search: query.trim() || undefined,
  });
  const [deleteLease, { isLoading: deletingLease }] = useMadbelDeleteLeaseMutation();

  const leases = data?.data?.items || [];
  const filtered = useMemo(() => leases, [leases]);

  const onDelete = (item) => {
    Alert.alert(t("delete_lease"), t("are_you_sure_you_want_to_delete_this_lease"), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLease({ lease_id: item.id }).unwrap();
          } catch (e) {
            Alert.alert("Delete failed", e?.data?.message || "Could not delete lease.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()}>
              <ChevronLeft size={responsiveWidth(5)} color="#F5FAFF" />
            </Pressable>
            <Text style={styles.title}>{t("lease")}</Text>
          </View>
          <Pressable style={styles.newBtn} onPress={() => navigation.navigate("NewLease")}>
            <Plus size={22} color="#EAF9FF" />
            <Text style={styles.newBtnText}>{t("new")}</Text>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Search size={24} color="#11CDE8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search_by_tenant_or_property")}
            placeholderTextColor="#6A768B"
            style={styles.searchInput}
          />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#11CDE8" size="large" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{t("could_not_load_leases")}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.errorText}>{t("no_leases_found")}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.tenant}>{item.tenant_name || item.tenant || item.client_name || "Tenant"}</Text>
                <View style={styles.grid}>
                  <View>
                    <Text style={styles.key}>{t("property")}</Text>
                    <Text style={styles.value}>{item.property_address || item.property || "--"}</Text>
                  </View>
                  <View>
                    <Text style={styles.key}>{t("rent")}</Text>
                    <Text style={styles.rent}>{formatRent(item)}</Text>
                  </View>
                  <View>
                    <Text style={styles.key}>{t("duration")}</Text>
                    <Text style={styles.value}>{leaseDuration(item)}</Text>
                  </View>
                  <View>
                    <Text style={styles.key}>{t("created")}</Text>
                    <Text style={styles.value}>{formatDate(item.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.bottomRow}>
                  <View style={styles.dateRow}>
                    <CalendarDays size={20} color="#97A4B8" />
                    <Text style={styles.dateText}>{formatDate(item.start_date)}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable onPress={() => navigation.navigate("LeasePreview", { leaseId: item.id, lease: item })}>
                      <Eye size={24} color="#AAB5C4" />
                    </Pressable>
                    <Pressable onPress={() => onDelete(item)} disabled={deletingLease}>
                      <Trash2 size={24} color="#AAB5C4" />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
        )}
        {(isFetching && !isLoading) ? (
          <Text style={styles.refreshText}>{t("refreshing_leases")}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#010507" },
  container: { flex: 1, paddingHorizontal: responsiveWidth(4) },
  headerRow: { marginTop: responsiveHeight(0.8), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(2) },
  title: { color: "#F4F8FF", fontSize: responsiveWidth(5), fontWeight: "700" },
  newBtn: {
    minHeight: responsiveHeight(5.2),
    borderRadius: 18,
    backgroundColor: "#12CDEA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(4),
    gap: responsiveWidth(1.2),
  },
  newBtnText: { color: "#EAF9FF", fontSize: 18, fontWeight: "700" },
  search: {
    marginTop: responsiveHeight(1.7),
    minHeight: responsiveHeight(6.6),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A303C",
    backgroundColor: "#1A1D24",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: responsiveWidth(3.8),
    gap: responsiveWidth(2),
  },
  searchInput: { flex: 1, color: "#DCE5F2", fontSize: 18 },
  list: { paddingTop: responsiveHeight(1.6), paddingBottom: responsiveHeight(8), gap: responsiveHeight(1.5) },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2D3443",
    backgroundColor: "#1A1C22",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.6),
  },
  tenant: { color: "#F4F8FF", fontSize: 21, fontWeight: "700", marginBottom: responsiveHeight(1.4) },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: responsiveHeight(1.3) },
  key: { color: "#808DA2", fontSize: 15, fontWeight: "700", width: responsiveWidth(42) },
  value: { color: "#DCE4F3", fontSize: 17, width: responsiveWidth(42), marginTop: responsiveHeight(0.2) },
  rent: { color: "#11CDE8", fontSize: 17, width: responsiveWidth(42), marginTop: responsiveHeight(0.2), fontWeight: "700" },
  divider: { marginTop: responsiveHeight(1.3), marginBottom: responsiveHeight(1), height: 1, backgroundColor: "#283144" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.5) },
  dateText: { color: "#A1ADBE", fontSize: 17 },
  actions: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(5) },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: responsiveHeight(3) },
  errorText: { color: "#9FAEC4", fontSize: 16 },
  refreshText: { textAlign: "center", color: "#8BC9D9", marginBottom: responsiveHeight(0.7) },
});

export default LeaseListScreen;
