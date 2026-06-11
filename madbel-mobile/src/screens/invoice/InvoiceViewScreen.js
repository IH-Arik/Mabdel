import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { Download, Share2, PenLine } from "lucide-react-native";
import {
  useMadbelGetBusinessProfileQuery,
  useMadbelGetInvoiceQuery,
  useMadbelShareInvoiceMutation,
} from "../../redux/slices/madbelApiSlice";
import {
  formatCurrency,
  formatInvoiceDate,
  getInvoiceId,
  getPublicInvoicePdfUrl,
  shareInvoiceLink,
} from "./invoiceUtils";

const InvoiceViewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const invoiceId = getInvoiceId(route.params?.invoice);
  const { data: invoiceResponse, isLoading } = useMadbelGetInvoiceQuery(
    { invoice_id: invoiceId },
    { skip: !invoiceId },
  );
  const { data: businessProfileResponse } = useMadbelGetBusinessProfileQuery();
  const [shareInvoice, { isLoading: sharingInvoice }] = useMadbelShareInvoiceMutation();
  const [resolvingShareLink, setResolvingShareLink] = React.useState(false);
  const [resolvingDownloadLink, setResolvingDownloadLink] = React.useState(false);
  const [cachedShareUrl, setCachedShareUrl] = React.useState(null);

  const invoice = invoiceResponse?.data || route.params?.invoice || null;
  const businessProfile = businessProfileResponse?.data;

  const ensureShareUrl = async () => {
    if (cachedShareUrl) return cachedShareUrl;
    if (invoice?.share_url) {
      setCachedShareUrl(invoice.share_url);
      return invoice.share_url;
    }
    if (!invoiceId) return null;

    const response = await shareInvoice({
      invoice_id: invoiceId,
      channel: "link",
    }).unwrap();
    const resolvedUrl = response?.data?.share_url || response?.share_url || null;
    if (resolvedUrl) {
      setCachedShareUrl(resolvedUrl);
    }
    return resolvedUrl;
  };

  const handleShareInvoice = async () => {
    try {
      setResolvingShareLink(true);
      const shareUrl = await ensureShareUrl();
      if (!shareUrl) {
        Alert.alert("Share unavailable", "Could not generate a share link.");
        return;
      }

      await shareInvoiceLink(shareUrl);
    } catch (error) {
      Alert.alert("Share failed", error?.data?.message || "Could not share the invoice.");
    } finally {
      setResolvingShareLink(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setResolvingDownloadLink(true);
      const shareUrl = await ensureShareUrl();
      const pdfUrl = getPublicInvoicePdfUrl(shareUrl);

      if (!pdfUrl) {
        Alert.alert("PDF unavailable", "Could not generate the invoice PDF link.");
        return;
      }

      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (!canOpen) {
        Alert.alert("Open failed", "This device cannot open the PDF link.");
        return;
      }

      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert("Download failed", error?.data?.message || "Could not open the invoice PDF.");
    } finally {
      setResolvingDownloadLink(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Invoice</Text>
          <Pressable
            style={styles.editBtn}
            onPress={() => navigation.navigate("CreateInvoice", { invoice })}
          >
            <PenLine size={20} color="#14C9E7" />
            <Text style={styles.editText}>Edit Invoice</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {isLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color="#14C9E7" />
            </View>
          ) : invoice ? (
          <View style={styles.paper}>
            <View style={styles.paperHeader}>
              <View>
                <View style={styles.logoBadge}>
                  {businessProfile?.logo_url ? (
                    <Image source={{ uri: businessProfile.logo_url }} style={styles.logoImage} />
                  ) : (
                    <Text style={styles.logoBolt}>⚡</Text>
                  )}
                </View>
                <Text style={styles.brand}>
                  {businessProfile?.business_name || "Madbel AI"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.invoiceLabel}>INVOICE</Text>
                <Text style={styles.invoiceCode}>
                  #{invoice?.invoice_number || invoice?.id || "INV"}
                </Text>
                <Text style={styles.invoiceDate}>
                  {formatInvoiceDate(invoice?.issue_date)}
                </Text>
              </View>
            </View>

            <View style={styles.billRow}>
              <View style={{ width: "52%" }}>
                <Text style={styles.metaLabel}>BILL TO</Text>
                <Text style={styles.metaMain}>{invoice?.client_name || "Client"}</Text>
                {invoice?.billing_address ? (
                  <Text style={styles.metaSub}>{invoice.billing_address}</Text>
                ) : null}
                {invoice?.client_email ? (
                  <Text style={styles.metaSub}>{invoice.client_email}</Text>
                ) : null}
              </View>

              <View style={{ width: "42%" }}>
                <Text style={styles.metaLabel}>DUE DATE</Text>
                <Text style={styles.metaMain}>{formatInvoiceDate(invoice?.due_date)}</Text>
              </View>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeadText, { width: "52%" }]}>DESCRIPTION</Text>
              <Text style={[styles.tableHeadText, { width: "16%", textAlign: "center" }]}>QTY</Text>
              <Text style={[styles.tableHeadText, { width: "32%", textAlign: "right" }]}>AMOUNT</Text>
            </View>

            {(invoice?.items || []).map((item) => (
              <View key={item.id || item.description} style={styles.tableRow}>
                <View style={{ width: "52%" }}>
                  <Text style={styles.rowMain}>{item.description}</Text>
                  {item.details ? <Text style={styles.rowSub}>{item.details}</Text> : null}
                </View>
                <Text style={[styles.rowQty, { width: "16%" }]}>{item.quantity}</Text>
                <Text style={[styles.rowAmount, { width: "32%" }]}>
                  {formatCurrency(item.line_total, invoice?.currency)}
                </Text>
              </View>
            ))}

            <View style={styles.totalWrap}>
              <Text style={styles.signatureText}>Signature Of Customer</Text>

              <View style={styles.totalCol}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalMeta}>Subtotal</Text>
                  <Text style={styles.totalMetaStrong}>
                    {formatCurrency(invoice?.subtotal, invoice?.currency)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalMeta}>Tax ({invoice?.tax_rate || 0}%)</Text>
                  <Text style={styles.totalMetaStrong}>
                    {formatCurrency(invoice?.tax_amount, invoice?.currency)}
                  </Text>
                </View>
                <View style={[ styles.totalFinalRow]}>
                  <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
                  <Text style={styles.totalDueValue}>
                    {formatCurrency(invoice?.total_amount, invoice?.currency)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          ) : (
            <View style={styles.loaderWrap}>
              <Text style={styles.emptyText}>Invoice not found.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomActions}>
          <Pressable
            style={styles.downloadBtn}
            onPress={handleDownloadPdf}
            disabled={resolvingDownloadLink}
          >
            <Download size={26} color="#0B1320" />
            <Text style={styles.downloadText}>
              {resolvingDownloadLink ? "Preparing..." : "Download PDF"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.shareBtn}
            onPress={handleShareInvoice}
            disabled={sharingInvoice || resolvingShareLink}
          >
            <Share2 size={24} color="#14C9E7" />
            <Text style={styles.shareText}>
              {sharingInvoice || resolvingShareLink ? "Sharing..." : "Share Invoice"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, paddingTop: responsiveHeight(0.8) },
  header: {
    paddingHorizontal: responsiveWidth(4.2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(1.2),
  },
  headerTitle: { color: "#F2F7FD", fontSize: 30, fontWeight: "700" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.2) },
  editText: { color: "#14C9E7", fontSize: 18 },
  content: { paddingHorizontal: responsiveWidth(4.2), paddingBottom: responsiveHeight(1.6) },
  paper: {
    backgroundColor: "#F4F5F7",
    borderRadius: 20,
    padding: responsiveWidth(5),
  },
  paperHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logoBadge: {
    width: responsiveWidth(18),
    height: responsiveWidth(18),
    borderRadius: responsiveWidth(9),
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoBolt: { color: "#fff", fontSize: 28 },
  logoImage: { width: "100%", height: "100%" },
  brand: { marginTop: responsiveHeight(0.7), color: "#10182A", fontSize: 26, fontWeight: "700" },
  invoiceLabel: { color: "#14C9E7", fontSize: 28, fontWeight: "700" },
  invoiceCode: { color: "#69758B", fontSize: 20, marginTop: responsiveHeight(0.2) },
  invoiceDate: { color: "#69758B", fontSize: 18 },
  billRow: {
    marginTop: responsiveHeight(1.6),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: { color: "#98A3B4", fontSize: 16, fontWeight: "700" },
  metaMain: { color: "#10182A", fontSize: 22, fontWeight: "700", marginTop: responsiveHeight(0.35) },
  metaSub: { color: "#69758B", fontSize: 16, marginTop: responsiveHeight(0.08) },
  tableHeader: {
    marginTop: responsiveHeight(2),
    paddingTop: responsiveHeight(0.8),
    borderTopWidth: 1,
    borderTopColor: "#D8DCE3",
    flexDirection: "row",
  },
  tableHeadText: { color: "#98A3B4", fontSize: 16, fontWeight: "700" },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: responsiveHeight(1.4),
  },
  rowMain: { color: "#111A2C", fontSize: 20, fontWeight: "700" },
  rowSub: { color: "#8C97AA", fontSize: 16, marginTop: responsiveHeight(0.1), lineHeight: 20 },
  rowQty: { color: "#293349", fontSize: 18, textAlign: "center" },
  rowAmount: { color: "#111A2C", fontSize: 18, fontWeight: "700", textAlign: "right" },
  totalWrap: {
    marginTop: responsiveHeight(2.2),
    paddingTop: responsiveHeight(1.3),
    borderTopWidth: 1,
    borderTopColor: "#D8DCE3",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureText: { color: "#69758B", fontSize: 18, width: "40%", lineHeight: 24 },
  totalCol: { width: "48%", gap: responsiveHeight(0.5) },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalMeta: { color: "#69758B", fontSize: 18 },
  totalMetaStrong: { color: "#10182A", fontSize: 18, fontWeight: "700" },
  totalFinalRow: {
    marginTop: responsiveHeight(0.4),
    borderTopWidth: 1,
    borderTopColor: "#D8DCE3",
    paddingTop: responsiveHeight(0.6),
  },
  totalDueLabel: { color: "#10182A", fontSize: 22, fontWeight: "700" },
  totalDueValue: { color: "#14C9E7", fontSize: 24, fontWeight: "800" },
  bottomActions: {
    paddingHorizontal: responsiveWidth(4.2),
    paddingTop: responsiveHeight(1.2),
    paddingBottom: responsiveHeight(2),
    borderTopWidth: 1,
    borderTopColor: "#1F293B",
    gap: responsiveHeight(1),
    marginBottom: responsiveHeight(10),
  },
  downloadBtn: {
    minHeight: responsiveHeight(7.8),
    borderRadius: 18,
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: responsiveWidth(2),
  },
  downloadText: { color: "#0B1320", fontSize: 20, fontWeight: "700" },
  shareBtn: {
    minHeight: responsiveHeight(7.8),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: responsiveWidth(2),
    backgroundColor: "transparent",
  },
  shareText: { color: "#14C9E7", fontSize: 20, fontWeight: "700" },
  loaderWrap: {
    minHeight: responsiveHeight(60),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9FB0C3",
    fontSize: 16,
  },
});

export default InvoiceViewScreen;
