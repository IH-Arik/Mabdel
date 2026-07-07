import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { ChevronLeft, SendHorizontal, Trash2 } from "lucide-react-native";
import {
  useMadbelDeleteInvoiceMutation,
  useMadbelGetInvoiceQuery,
  useMadbelGetInvoiceTimelineQuery,
  useMadbelSendInvoiceReminderMutation,
} from "../../redux/slices/madbelApiSlice";
import {
  formatCurrency,
  formatTimelineDate,
  getInvoiceId,
  getInvoiceStatusMeta,
} from "./invoiceUtils";

const InvoiceDetailsScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const invoiceId = getInvoiceId(route.params?.invoice);
  const { data: invoiceResponse, isLoading } = useMadbelGetInvoiceQuery(
    { invoice_id: invoiceId },
    { skip: !invoiceId },
  );
  const { data: timelineResponse, isFetching: timelineLoading } =
    useMadbelGetInvoiceTimelineQuery(
      { invoice_id: invoiceId },
      { skip: !invoiceId },
    );
  const [sendReminder, { isLoading: sendingReminder }] =
    useMadbelSendInvoiceReminderMutation();
  const [deleteInvoice, { isLoading: deletingInvoice }] =
    useMadbelDeleteInvoiceMutation();

  const invoice = invoiceResponse?.data || route.params?.invoice || null;
  const timeline = timelineResponse?.data || invoice?.timeline || [];
  const statusMeta = getInvoiceStatusMeta(invoice?.status);

  const handleReminder = async () => {
    if (!invoiceId) return;

    try {
      await sendReminder({ invoice_id: invoiceId, channel: "email" }).unwrap();
      Alert.alert(t("reminder_sent"), t("the_invoice_reminder_was_sent_successfully"));
    } catch (error) {
      Alert.alert(
        "Reminder failed",
        error?.data?.message || "Could not send the reminder.",
      );
    }
  };

  const handleDelete = async () => {
    if (!invoiceId) return;

    try {
      await deleteInvoice({ invoice_id: invoiceId }).unwrap();
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Delete failed",
        error?.data?.message || "Could not delete the invoice.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={34} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("invoice_details")}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#14C9E7" />
          </View>
        ) : invoice ? (
        <>


        <FlatList
  data={timeline}
  keyExtractor={(item, index) =>
    item.id?.toString() || `${item.event_type}-${index}`
  }
  ListHeaderComponent={
    <>
      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <Text style={styles.invoiceId}>{invoice.invoice_number}</Text>

          <View
            style={[
              styles.sentBadge,
              {
                backgroundColor: statusMeta.backgroundColor,
                borderColor: statusMeta.borderColor,
              },
            ]}
          >
            <Text style={[styles.sentText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <Text style={styles.clientName}>{invoice.client_name}</Text>
        <Text style={styles.amountLabel}>{t("total_amount")}</Text>
        <Text style={styles.amount}>
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </Text>
      </View>

      <Text style={styles.progressTitle}>{t("progress")}</Text>
    </>
  }
  renderItem={({ item, index }) => (
    <View style={styles.timelineRow}>
      <View
        style={[
          styles.timelineDot,
          // index === 0 ? styles.timelineDotActive : null,
        ]}
      />

      <View style={{ flex: 1 }}>
        <Text style={styles.timelineMain}>{item.title}</Text>
        <Text style={styles.timelineSub}>
          {formatTimelineDate(item.created_at)}
          {item.channel ? ` • via ${item.channel}` : ""}
        </Text>
      </View>
    </View>
  )}
  ListEmptyComponent={
    !timelineLoading ? (
      <Text style={styles.timelineEmpty}>{t("no_timeline_events_yet")}</Text>
    ) : null
  }
  contentContainerStyle={styles.timelineContent}
  showsVerticalScrollIndicator={false}
/>

        <View style={styles.bottomActions}>
          <Pressable
            style={styles.sendBtn}
            onPress={handleReminder}
            disabled={sendingReminder}
          >
            <SendHorizontal size={26} color="#EAF8FF" />
            <Text style={styles.sendBtnText}>
              {sendingReminder ? "Sending..." : "Send Reminder"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.viewBtn}
            onPress={() => navigation.navigate("InvoiceView", { invoice })}
          >
            <Text style={styles.viewBtnText}>{t("view")}</Text>
          </Pressable>

          <Pressable
            style={styles.deleteBtn}
            onPress={handleDelete}
            disabled={deletingInvoice}
          >
            <Trash2 size={30} color="#FC4C58" />
          </Pressable>
        </View>
        </>
        ) : (
          <View style={styles.loaderWrap}>
            <Text style={styles.timelineEmpty}>{t("invoice_not_found")}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(4.2),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: responsiveHeight(2.2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2),
  },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F2F7FD", fontSize: 28, fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A3142",
    backgroundColor: "#23242A",
    paddingHorizontal: responsiveWidth(4),
    paddingVertical: responsiveHeight(2),
  },
  summaryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invoiceId: { color: "#14C9E7", fontSize: 20 },
  sentBadge: {
    minWidth: responsiveWidth(17),
    minHeight: responsiveHeight(4.6),
    borderRadius: 999,
    backgroundColor: "#2D4B27",
    borderWidth: 1,
    borderColor: "#4D863D",
    alignItems: "center",
    justifyContent: "center",
  },
  sentText: { fontSize: 16, fontWeight: "700" },
  clientName: { color: "#F3F7FC", fontSize: 26, fontWeight: "600", marginTop: responsiveHeight(0.7) },
  amountLabel: { color: "#8F9BB0", fontSize: 20, marginTop: responsiveHeight(1.8) },
  amount: { color: "#14C9E7", fontSize: 30, fontWeight: "700", marginTop: responsiveHeight(0.2) },
  progressTitle: {
    marginTop: responsiveHeight(2.2),
    color: "#A7B1C3",
    fontSize: 22,
    fontWeight: "700",
  },
  // timelineWrap: { marginTop: responsiveHeight(1.6), gap: responsiveHeight(2) },
  timelineWrap: {
  marginVertical: responsiveHeight(1.6),
  height: responsiveHeight(34), // fixed scrollable area
  position: "relative",
},
  // timelineLine: {
  //   position: "absolute",
  //   left: responsiveWidth(3),
  //   top: responsiveHeight(1.8),
  //   bottom: responsiveHeight(2.4),
  //   width: 2,
  //   backgroundColor: "#1F2A3D",
  // },
  timelineLine: {
  position: "absolute",
  left: responsiveWidth(3),
  top: responsiveHeight(1.8),
  bottom: responsiveHeight(1),
  width: 2,
  backgroundColor: "#1F2A3D",
},
  timelineRow: { flexDirection: "row", gap: responsiveWidth(3), alignItems: "flex-start" },
  timelineDot: {
    width: responsiveWidth(7),
    height: responsiveWidth(7),
    borderRadius: responsiveWidth(3.5),
    backgroundColor: "#5E6C84",
  },
  timelineDotActive: {
    backgroundColor: "#14C9E7",
    shadowColor: "#14C9E7",
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 5,
  },
  timelineMain: { color: "#F2F6FB", fontSize: 20, fontWeight: "500" },
  timelineSub: { color: "#8A98AF", fontSize: 14, marginTop: responsiveHeight(0.2) },
  bottomActions: {
    marginTop: "auto",
    flexDirection: "row",
    gap: responsiveWidth(2),
    alignItems: "center",
    marginBottom: responsiveHeight(8),
  },
  sendBtn: {
    flex: 1,
    minHeight: responsiveHeight(8),
    borderRadius: 16,
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: responsiveWidth(1.5),
  },
  sendBtnText: { color: "#EAF8FF", fontSize: 18, fontWeight: "600" },
  viewBtn: {
    width: responsiveWidth(22),
    minHeight: responsiveHeight(8),
    borderRadius: 16,
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnText: { color: "#EAF8FF", fontSize: 18, fontWeight: "600" },
  deleteBtn: {
    width: responsiveWidth(18),
    minHeight: responsiveHeight(8),
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3A2228",
    backgroundColor: "#22161A",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineEmpty: {
    color: "#96A4BA",
    fontSize: 14,
    textAlign: "center",
  },
});

export default InvoiceDetailsScreen;
