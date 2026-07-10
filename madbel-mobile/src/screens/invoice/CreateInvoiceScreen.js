import { useAppLanguage } from "../../context/LanguageContext";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ChevronLeft,
  CalendarDays,
  PlusCircle,
  Trash2,
  PenLine,
} from "lucide-react-native";
import { useForm } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import {
  useMadbelCreateInvoiceMutation,
  useMadbelUpdateInvoiceMutation,
} from "../../redux/slices/madbelApiSlice";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";
import {
  buildInvoicePayload,
  formatCurrency,
  formatInvoiceDate,
  getInvoiceId,
} from "./invoiceUtils";

const normalizePrefillItems = (items = []) =>
  Array.isArray(items) && items.length
    ? items.map((item) => ({
        description: item?.description || "",
        details: item?.details || "",
        quantity: String(item?.quantity ?? 1),
        unit_price: String(item?.unit_price ?? 0),
      }))
    : [];


const CreateInvoiceScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const route = useRoute();
  const prefill = route?.params?.prefill || {};
  const editingInvoice = route?.params?.invoice;
  const prefillPrompt = route?.params?.prefillPrompt || "";

  const initialItems = useMemo(() => {
    if (Array.isArray(editingInvoice?.items) && editingInvoice.items.length) {
      return editingInvoice.items.map((item) => ({
        description: item?.description || "",
        details: item?.details || "",
        quantity: String(item?.quantity ?? 1),
        unit_price: String(item?.unit_price ?? 0),
      }));
    }

    return normalizePrefillItems(prefill?.items);
  }, [editingInvoice?.items, prefill?.items]);

  const { control, getValues, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      clientName: editingInvoice?.client_name || prefill?.client_name || "",
      dueDate: editingInvoice?.due_date || prefill?.due_date || "",
      email: editingInvoice?.client_email || prefill?.client_email || "",
    },
  });

  const [invoiceItems, setInvoiceItems] = useState(initialItems);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [newItem, setNewItem] = useState({
    description: "",
    details: "",
    quantity: "",
    unit_price: "",
  });
  const [createInvoice, { isLoading: creatingInvoice }] = useMadbelCreateInvoiceMutation();
  const [updateInvoice, { isLoading: updatingInvoice }] = useMadbelUpdateInvoiceMutation();

  const dueDate = watch("dueDate");
  const isSaving = creatingInvoice || updatingInvoice;

  const totalAmount = invoiceItems.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const price =
      Number(String(item?.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0;
    if (qty <= 0 || price < 0) return sum;
    return sum + qty * price;
  }, 0);

  const closeItemModal = () => {
    setEditingItemIndex(null);
    setNewItem({
      description: "",
      details: "",
      quantity: "",
      unit_price: "",
    });
    setItemModalVisible(false);
  };

  const handleAddItem = () => {
    const description = newItem.description.trim();
    const quantity = Number(newItem.quantity || 0);
    const unitPrice =
      Number(String(newItem.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0;

    if (!description) {
      Alert.alert(t("missing_item"), t("please_enter_an_item_description"));
      return;
    }
    if (!quantity || quantity <= 0) {
      Alert.alert(t("invalid_quantity"), t("quantity_must_be_greater_than_0"));
      return;
    }
    if (unitPrice < 0) {
      Alert.alert(t("invalid_price"), t("price_cannot_be_negative"));
      return;
    }

    const normalizedItem = {
      description,
      details: newItem.details?.trim() || "",
      quantity: String(quantity),
      unit_price: String(unitPrice),
    };

    if (editingItemIndex !== null) {
      setInvoiceItems((prev) =>
        prev.map((item, index) => (index === editingItemIndex ? normalizedItem : item)),
      );
    } else {
      setInvoiceItems((prev) => [...prev, normalizedItem]);
    }

    closeItemModal();
  };

  const handleRemoveItem = (indexToRemove) => {
    setInvoiceItems((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEditItem = (item, index) => {
    setEditingItemIndex(index);
    setNewItem({
      description: item?.description || "",
      details: item?.details || "",
      quantity: String(item?.quantity ?? "0"),
      unit_price: String(item?.unit_price ?? ""),
    });
    setItemModalVisible(true);
  };

  const applyAiPrefill = (prefillData = {}, transcript = "") => {
    const nextClientName = prefillData?.client_name || prefillData?.customer_name;
    const nextEmail = prefillData?.client_email || prefillData?.email;
    const nextDueDate = prefillData?.due_date || prefillData?.payment_due_date;

    if (nextClientName) {
      setValue("clientName", nextClientName, { shouldDirty: true, shouldValidate: true });
    }
    if (nextEmail) {
      setValue("email", nextEmail, { shouldDirty: true, shouldValidate: true });
    }
    if (nextDueDate) {
      setValue("dueDate", nextDueDate, { shouldDirty: true, shouldValidate: true });
    }

    if (Array.isArray(prefillData?.items) && prefillData.items.length) {
      setInvoiceItems(
        prefillData.items.map((item) => ({
          description: item?.description || "",
          details: item?.details || "",
          quantity: String(item?.quantity ?? 0),
          unit_price: String(item?.unit_price ?? 0),
        })),
      );
    }
  };

  useEffect(() => {
    if (editingInvoice) return;
    const p = route?.params?.prefill;
    if (!p || typeof p !== "object" || !Object.keys(p).length) return;
    applyAiPrefill(p, route?.params?.prefillPrompt || "");
    navigation.setParams?.({ prefill: undefined, prefillPrompt: undefined });
  }, [route?.params?.prefill]);

  const onCreate = async (values) => {
    try {
      if (!invoiceItems.length) {
        Alert.alert(t("no_items"), t("please_add_at_least_one_item"));
        return;
      }

      const payload = buildInvoicePayload({
        ...values,
        items: invoiceItems.map((item) => ({
          description: item.description,
          details: item.details || undefined,
          quantity: Number(item.quantity || 1),
          unit_price:
            Number(String(item.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0,
        })),
      });

      const invoiceId = getInvoiceId(editingInvoice);
      const response = invoiceId
        ? await updateInvoice({ invoice_id: invoiceId, ...payload }).unwrap()
        : await createInvoice(payload).unwrap();

      const invoice = response?.data;
      navigation.replace("InvoiceDetails", { invoice });
    } catch (error) {
      Alert.alert(t("invoice_failed"), error?.data?.message || t("could_not_save_the_invoice"));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">

    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={responsiveWidth(5)} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {editingInvoice ? t("edit_invoice") : t("create_invoice")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <ControllerTextInput
            name="clientName"
            control={control}
            label={t("client_name")}
            placeholder={t("enter_name")}
            placeholderTextColor="#6D7B93"
            labelStyle={styles.label}
            // inputStyle={styles.input}
          />

          <View>
            <View style={styles.rowTitle}>
              <Text style={styles.label}>{t("items")}</Text>
              <Pressable
                style={styles.addItemRow}
                onPress={() => {
                  setEditingItemIndex(null);
                  setItemModalVisible(true);
                }}
              >
                <PlusCircle size={responsiveWidth(5)} color="#14C9E7" />
                <Text style={styles.addItemText}>{t("add_item")}</Text>
              </Pressable>
            </View>

            {invoiceItems.map((item, index) => (
              <View key={`${item.description}-${index}`} style={styles.itemCard}>
                <View style={styles.itemCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                    {item.details ? (
                      <Text style={styles.itemDetails}>{item.details}</Text>
                    ) : null}
                  </View>
                  <View style={styles.itemActionRow}>
                    <Pressable
                      style={styles.editItemBtn}
                      onPress={() => handleEditItem(item, index)}
                    >
                      <PenLine size={16} color="#14C9E7" />
                    </Pressable>
                    <Pressable
                      style={styles.removeItemBtn}
                      onPress={() => handleRemoveItem(index)}
                    >
                      <Trash2 size={18} color="#FC4C58" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.qtyPriceRow}>
                  <View style={{ width: "32%" }}>
                    <Text style={styles.smallLabel}>{t("qty")}</Text>
                    <Text style={styles.itemMetricText}>{item.quantity}</Text>
                  </View>

                  <View style={{ width: "63%" }}>
                    <Text style={styles.smallLabel}>{t("price")}</Text>
                    <Text style={styles.itemMetricText}>
                      {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View>
            <Text style={styles.label}>{t("date")}</Text>
            <Pressable
              style={[styles.input, styles.dateInput]}
              onPress={() => setCalendarVisible(true)}
            >
              <Text
                style={[
                  styles.dateValueText,
                  !dueDate ? styles.datePlaceholderText : null,
                ]}
              >
                {dueDate ? formatInvoiceDate(dueDate) : t("select_due_date")}
              </Text>
              <CalendarDays size={24} color="#90A0B8" />
            </Pressable>
          </View>

          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>{t("total_amount")}</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.autoCalculated}>
                {dueDate ? `${t("due")} ${formatInvoiceDate(dueDate)}` : t("due_date_not_set")}
              </Text>
            </View>
          </View>

          <ControllerTextInput
            name="email"
            control={control}
            label={t("client_email")}
            placeholder={t("client_example_com")}
            // inputStyle={styles.input}
            placeholderTextColor="#6D7B93"
          />

          <VoiceFormFillCard
            label={t("invoice")}
            workflowIntent="invoice"
            sourceScreen="CreateInvoice"
            currentValues={{
              client_name: getValues("clientName") || "",
              client_email: getValues("email") || "",
              due_date: getValues("dueDate") || "",
              items: invoiceItems.map((item) => ({
                description: item?.description || "",
                quantity: Number(item?.quantity ?? 0),
                unit_price: Number(String(item?.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0,
              })),
            }}
          />
        </ScrollView>

        <SystemCalendarModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          selectedDate={dueDate}
          onSelectDate={(selected) =>
            setValue("dueDate", selected, { shouldDirty: true, shouldValidate: true })
          }
        />

        <Modal
          visible={itemModalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeItemModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingItemIndex !== null ? t("edit_item") : t("add_item")}
              </Text>

              <View style={styles.modalField}>
                <Text style={styles.smallLabel}>{t("description")}</Text>
                <ControllerTextInput
                  name="add_item_description"
                  control={control}
                  value={newItem.description}
                  onChangeText={(text) =>
                    setNewItem((prev) => ({ ...prev, description: text }))
                  }
                  // inputStyle={styles.input}
                  placeholder={t("item_description")}
                  placeholderTextColor="#6D7B93"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.smallLabel}>{t("details_optional")}</Text>
                <ControllerTextInput
                  name="add_item_details"
                  control={control}
                  value={newItem.details}
                  onChangeText={(text) =>
                    setNewItem((prev) => ({ ...prev, details: text }))
                  }
                  // inputStyle={styles.input}
                  placeholder={t("extra_details")}
                  placeholderTextColor="#6D7B93"
                />
              </View>

              <View style={styles.qtyPriceRow}>
                <View style={{ width: "32%" }}>
                  <Text style={styles.smallLabel}>{t("qty")}</Text>
                  <ControllerTextInput
                    name="add_item_qty"
                    control={control}
                    value={newItem.quantity}
                    onChangeText={(text) =>
                      setNewItem((prev) => ({ ...prev, quantity: text }))
                    }
                    // inputStyle={styles.input}
                    placeholderTextColor="#6D7B93"
                  />
                </View>
                <View style={{ width: "63%" }}>
                  <Text style={styles.smallLabel}>{t("price")}</Text>
                  <ControllerTextInput
                    name="add_item_price"
                    control={control}
                    value={newItem.unit_price}
                    onChangeText={(text) =>
                      setNewItem((prev) => ({ ...prev, unit_price: text }))
                    }
                    // inputStyle={styles.input}
                    placeholderTextColor="#6D7B93"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={closeItemModal}>
                  <Text style={styles.modalCancelText}>{t("cancel")}</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleAddItem}>
                  <Text style={styles.modalSaveText}>
                    {editingItemIndex !== null ? t("update") : t("add")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Pressable
          style={[styles.createBtn, isSaving ? styles.createBtnDisabled : null]}
          onPress={handleSubmit(onCreate)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#EAF8FF" />
          ) : (
            <Text style={styles.createText}>
              {editingInvoice ? t("save") : t("create_invoice")}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>

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
    marginBottom: responsiveHeight(1.6),
  },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F2F7FD", fontSize: responsiveWidth(5), fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  content: { gap: responsiveHeight(1.2), paddingBottom: responsiveHeight(2) },
  label: { color: "#B7C2D3", fontSize: responsiveWidth(4), marginBottom: responsiveHeight(1.5) },
  smallLabel: { color: "#8090A8", fontSize: 14, marginBottom: responsiveHeight(0.5) },
  input: {
    minHeight: responsiveHeight(7),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3142",
    backgroundColor: "#23262E",
    color: "#EAF0F6",
    fontSize: 22,
    paddingHorizontal: responsiveWidth(4.5),
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateValueText: {
    color: "#EAF0F6",
    fontSize: 22,
  },
  datePlaceholderText: {
    color: "#6D7B93",
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(0.4),
  },
  addItemRow: { flexDirection: "row", alignItems: "center", gap: responsiveWidth(1.2) },
  addItemText: { color: "#14C9E7", fontSize: responsiveWidth(4), fontWeight: "500" },
  itemCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2B3142",
    backgroundColor: "#23262E",
    padding: responsiveWidth(3.5),
    gap: responsiveHeight(1),
    marginTop: responsiveHeight(0.9),
  },
  itemCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: responsiveWidth(2.5),
  },
  itemDescription: {
    color: "#EAF0F6",
    fontSize: 20,
    fontWeight: "600",
  },
  itemDetails: {
    color: "#90A0B8",
    fontSize: 14,
    marginTop: responsiveHeight(0.4),
  },
  itemActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: responsiveWidth(2),
  },
  editItemBtn: {
    width: responsiveWidth(9),
    height: responsiveWidth(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1C4450",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#132D36",
  },
  removeItemBtn: {
    width: responsiveWidth(9),
    height: responsiveWidth(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3A2228",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22161A",
  },
  qtyPriceRow: { flexDirection: "row", justifyContent: "space-between" },
  itemMetricText: {
    color: "#EAF0F6",
    fontSize: 18,
    fontWeight: "500",
    marginTop: responsiveHeight(0.2),
  },
  totalWrap: {
    marginTop: responsiveHeight(1),
    paddingTop: responsiveHeight(1.2),
    borderTopWidth: 1,
    borderTopColor: "#273246",
  },
  totalLabel: { color: "#8E9CB2", fontSize: responsiveWidth(4), letterSpacing: 1.2 },
  totalRow: {
    marginTop: responsiveHeight(0.8),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  totalAmount: { color: "#14C9E7", fontSize: responsiveWidth(7), fontWeight: "700" },
  autoCalculated: { color: "#8795AD", fontSize: 16 },
  createBtn: {
    minHeight: responsiveHeight(8.2),
    borderRadius: 18,
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#14C9E7",
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 7,
    marginBottom: responsiveHeight(4),
  },
  createText: { color: "#EAF8FF", fontSize: 19, fontWeight: "600" },
  createBtnDisabled: {
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    paddingHorizontal: responsiveWidth(5),
  },
  modalCard: {
    backgroundColor: "#111723",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2B3142",
    padding: responsiveWidth(4.5),
    gap: responsiveHeight(1.2),
  },
  modalTitle: {
    color: "#F2F7FD",
    fontSize: 24,
    fontWeight: "700",
  },
  modalField: {
    gap: responsiveHeight(0.4),
  },
  modalActions: {
    marginTop: responsiveHeight(0.8),
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: responsiveWidth(2.8),
  },
  modalCancelBtn: {
    minHeight: responsiveHeight(5.6),
    borderRadius: 14,
    paddingHorizontal: responsiveWidth(5),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A4358",
    backgroundColor: "#1A2232",
  },
  modalCancelText: {
    color: "#C7D3E5",
    fontSize: 16,
    fontWeight: "600",
  },
  modalSaveBtn: {
    minHeight: responsiveHeight(5.6),
    borderRadius: 14,
    paddingHorizontal: responsiveWidth(6.5),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14C9E7",
  },
  modalSaveText: {
    color: "#0B1320",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default CreateInvoiceScreen;
