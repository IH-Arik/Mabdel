import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Search, ReceiptText } from "lucide-react-native";
import { useForm, useWatch } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import { useMadbelListInvoicesQuery } from "../../redux/slices/madbelApiSlice";
import {
  formatCurrency,
  formatInvoiceDate,
  getInvoiceStatusMeta,
} from "./invoiceUtils";

const InvoiceListScreen = () => {
  const navigation = useNavigation();
  const { control } = useForm({
    defaultValues: { search: "" },
  });
  const search = useWatch({ control, name: "search" });
  const {
    data: invoicesResponse,
    isLoading,
    isFetching,
    error,
  } = useMadbelListInvoicesQuery({
    search: search?.trim() || undefined,
  });

  const invoiceData = invoicesResponse?.data;
  const invoices = invoiceData?.items || [];
  const summary = invoiceData?.summary;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <ReceiptText size={34} color="#14C9E7" strokeWidth={2.1} />
            <Text style={styles.title}>Invoices</Text>
          </View>

          <Pressable
            style={styles.newBtn}
            onPress={() => navigation.navigate("CreateInvoice")}
          >
            <Text style={styles.newBtnText}>+ New Invoice</Text>
          </Pressable>
        </View>

        <ControllerTextInput
          name="search"
          control={control}
          placeholder="Search client or invoice ID"
          placeholderTextColor="#6D7B93"
          leftIcon={<Search size={34} color="#14C9E7" />}
          inputStyle={styles.searchInput}
        />

        <View style={styles.outstandingCard}>
          <Text style={styles.outstandingLabel}>TOTAL OUTSTANDING</Text>
          <View style={styles.outstandingRow}>
            <Text style={styles.outstandingAmount}>
              {formatCurrency(summary?.total_outstanding, "USD")}
            </Text>
            <Text style={styles.outstandingMeta}>
              {summary?.total_invoices || 0} invoices created
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#14C9E7" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>Could not load invoices right now.</Text>
          </View>
        ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.stateText}>
                {search?.trim() ? "No invoices matched that search." : "No invoices yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.invoiceCard}
              onPress={() => navigation.navigate("InvoiceDetails", { invoice: item })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{item.client_name}</Text>
                <Text style={styles.invoiceId}>{item.invoice_number}</Text>
                <Text style={styles.dueDate}>{`Due: ${formatInvoiceDate(item.due_date)}`}</Text>
              </View>
              <View style={styles.cardRight}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: getInvoiceStatusMeta(item.status).backgroundColor,
                      borderColor: getInvoiceStatusMeta(item.status).borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getInvoiceStatusMeta(item.status).color },
                    ]}
                  >
                    {getInvoiceStatusMeta(item.status).label}
                  </Text>
                </View>
                <Text style={styles.amount}>
                  {formatCurrency(item.total_amount, item.currency)}
                </Text>
              </View>
            </Pressable>
          )}
        />
        )}

        {isFetching && !isLoading ? (
          <Text style={styles.fetchingText}>Refreshing invoices...</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.2),
    paddingTop: responsiveHeight(1.2),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.8),
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2.3),
  },
  title: {
    color: "#F2F7FD",
    fontSize: 30,
    fontWeight: "500",
  },
  newBtn: {
    minHeight: responsiveHeight(6),
    borderRadius: 22,
    backgroundColor: "#14C9E7",
    paddingHorizontal: responsiveWidth(5),
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#14C9E7",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  newBtnText: {
    color: "#EAF8FF",
    fontSize: 18,
    fontWeight: "600",
  },
  searchInput: {
    minHeight: responsiveHeight(7),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3142",
    backgroundColor: "#23262E",
    color: "#EAF0F6",
    fontSize: 22,
    paddingLeft: responsiveWidth(14),
    paddingRight: responsiveWidth(4.5),
  },
  outstandingCard: {
    marginTop: responsiveHeight(1),
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#14C9E7",
    backgroundColor: "#0D2931",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(1.6),
  },
  outstandingLabel: {
    color: "#14C9E7",
    fontSize: 18,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  outstandingRow: {
    marginTop: responsiveHeight(0.8),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  outstandingAmount: {
    color: "#F4F8FD",
    fontSize: 30,
    fontWeight: "500",
  },
  outstandingMeta: {
    color: "#9CA9BD",
    fontSize: 14,
  },
  listContent: {
    gap: responsiveHeight(1.3),
    paddingTop: responsiveHeight(1.4),
    paddingBottom: responsiveHeight(3),
  },
  invoiceCard: {
    minHeight: responsiveHeight(11),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A3142",
    backgroundColor: "#23242A",
    paddingHorizontal: responsiveWidth(4.4),
    paddingVertical: responsiveHeight(1.5),
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: responsiveWidth(2),
  },
  clientName: {
    color: "#F4F8FD",
    fontSize: 24,
    fontWeight: "600",
  },
  invoiceId: {
    color: "#98A6BD",
    fontSize: 18,
    marginTop: responsiveHeight(0.1),
  },
  dueDate: {
    color: "#8D9BB2",
    fontSize: 16,
    marginTop: responsiveHeight(1),
  },
  cardRight: {
    alignItems: "flex-end",
    gap: responsiveHeight(0.7),
  },
  statusPill: {
    minHeight: responsiveHeight(3.8),
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: responsiveWidth(3),
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  amount: {
    color: "#F4F8FD",
    fontSize: 26,
    fontWeight: "500",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: responsiveHeight(4),
  },
  stateText: {
    color: "#A8B6C8",
    fontSize: 16,
    textAlign: "center",
  },
  fetchingText: {
    color: "#7E8CA4",
    fontSize: 13,
    textAlign: "center",
    marginTop: responsiveHeight(1),
  },
});

export default InvoiceListScreen;
