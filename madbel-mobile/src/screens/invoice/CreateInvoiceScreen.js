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
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  ChevronLeft,
  CalendarDays,
  Mic,
  PlusCircle,
  Trash2,
  PenLine,
} from "lucide-react-native";
import { useForm } from "react-hook-form";
import ControllerTextInput from "../../components/ControllerTextInput";
import SystemCalendarModal from "../../components/SystemCalendarModal";
import {
  useMadbelCreateInvoiceMutation,
  useMadbelAiChatMutation,
  useMadbelAiWorkflowPrefillMutation,
  useMadbelUpdateInvoiceMutation,
} from "../../redux/slices/madbelApiSlice";
import {
  buildInvoicePayload,
  formatCurrency,
  formatInvoiceDate,
  getInvoiceId,
} from "./invoiceUtils";

const normalizePrefillItems = (items = []) => {
  if (Array.isArray(items) && items.length) {
    return items.map((item) => ({
      description: item?.description || "",
      details: item?.details || "",
      quantity: String(item?.quantity ?? 1),
      unit_price: String(item?.unit_price ?? 0),
    }));
  }

  return [];
};

const buildWorkflowPrefillBody = (transcript, currentValues = {}) => ({
  transcript,
  workflow_intent: "invoice",
  current_values: currentValues,
});

const extractStructuredInvoiceData = (responsePayload = {}) => {
  const payload = responsePayload?.data || responsePayload || {};
  const possibleStructured =
    payload?.prefill ||
    payload?.workflow?.output ||
    payload?.invoice_data ||
    payload?.fields ||
    payload?.structured_data ||
    payload?.workflowPrefill?.prefill ||
    null;

  if (possibleStructured && typeof possibleStructured === "object") {
    return possibleStructured;
  }

  const rawText =
    payload?.response ||
    payload?.ai_response ||
    payload?.text ||
    payload?.message ||
    "";
  const maybeJsonStart = String(rawText).indexOf("{");
  const maybeJsonEnd = String(rawText).lastIndexOf("}");

  if (maybeJsonStart >= 0 && maybeJsonEnd > maybeJsonStart) {
    return JSON.parse(String(rawText).slice(maybeJsonStart, maybeJsonEnd + 1));
  }

  return null;
};

const CreateInvoiceScreen = () => {
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
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [voicePrompt, setVoicePrompt] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const [createInvoice, { isLoading: creatingInvoice }] = useMadbelCreateInvoiceMutation();
  const [updateInvoice, { isLoading: updatingInvoice }] = useMadbelUpdateInvoiceMutation();
  const [workflowPrefill, { isLoading: processingWorkflowPrefill }] =
    useMadbelAiWorkflowPrefillMutation();
  const [aiChat, { isLoading: processingVoice }] = useMadbelAiChatMutation();

  const dueDate = watch("dueDate");
  const isSaving = creatingInvoice || updatingInvoice;

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results?.[0]?.transcript;
    if (text) {
      setVoicePrompt(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecordingVoice(false);
  });

  useEffect(
    () => () => {
      ExpoSpeechRecognitionModule.stop();
    },
    [],
  );

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
      Alert.alert("Missing item", "Please enter an item description.");
      return;
    }
    if (!quantity || quantity <= 0) {
      Alert.alert("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }
    if (unitPrice < 0) {
      Alert.alert("Invalid price", "Price cannot be negative.");
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
      quantity: String(item?.quantity ?? "Nan"),
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

    const hasPrefill =
      Object.keys(prefill || {}).length > 0 || Boolean(prefillPrompt?.trim());

    if (!hasPrefill) return;

    applyAiPrefill(prefill, prefillPrompt);

    navigation.setParams?.({
      prefill: undefined,
      prefillPrompt: undefined,
    });
  }, [editingInvoice, navigation, prefill, prefillPrompt]);

  const handleProcessVoiceCommand = async () => {
    const transcript = voicePrompt.trim();
    if (!transcript) {
      Alert.alert("Missing command", "Please enter a command for invoice generation.");
      return;
    }

    try {
      const currentValues = {
        client_name: getValues("clientName")?.trim() || "",
        client_email: getValues("email")?.trim() || "",
        due_date: getValues("dueDate") || "",
        items: invoiceItems.map((item) => ({
          description: item?.description || "",
          details: item?.details || "",
          quantity: Number(item?.quantity ?? 0),
          unit_price:
            Number(String(item?.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0,
        })),
      };

      const workflowRequestBody = buildWorkflowPrefillBody(transcript, currentValues);
      const workflowResponse = await workflowPrefill(workflowRequestBody).unwrap();
      const workflowPayload = workflowResponse?.data || workflowResponse || {};

      const chatResponse = await aiChat({
        content: transcript,
        response_mode: "text",
        voice_id: null,
      }).unwrap();

      const parsedJson =
        extractStructuredInvoiceData(workflowPayload) ||
        extractStructuredInvoiceData(chatResponse) ||
        workflowPayload?.prefill ||
        chatResponse?.data?.workflow?.output ||
        null;

      if (!parsedJson || typeof parsedJson !== "object") {
        throw new Error("No structured invoice data found in AI response.");
      }

      applyAiPrefill(parsedJson, transcript);
      setVoiceModalVisible(false);
      Alert.alert("Invoice updated", "Form filled from AI response.");
    } catch (error) {
      console.log("Invoice voice processing error:", error);
      Alert.alert(
        "Voice parse failed",
        error?.data?.message || error?.message || "Could not process your command.",
      );
    }
  };

  const startVoiceRecording = useCallback(async () => {
    try {
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Permission required",
          "Microphone permission is required for voice input.",
        );
        return;
      }

      setVoicePrompt("");
      setIsRecordingVoice(true);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
      });
    } catch (error) {
      setIsRecordingVoice(false);
      Alert.alert(
        "Voice unavailable",
        error?.message || "Could not start voice recording.",
      );
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsRecordingVoice(false);
  }, []);

  const openVoiceModal = useCallback(() => {
    setVoiceModalVisible(true);
    startVoiceRecording();
  }, [startVoiceRecording]);

  const onCreate = async (values) => {
    try {
      if (!invoiceItems.length) {
        Alert.alert("No items", "Please add at least one item.");
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
      console.log("Invoice save error: LINE AT 205", error);
      Alert.alert(
        "Invoice failed",
        error?.data?.message || "Could not save the invoice.",
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
          <Text style={styles.headerTitle}>
            {editingInvoice ? "Edit Invoice" : "Create Invoice"}
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
            label="Client Name"
            placeholder="Enter name"
            placeholderTextColor="#6D7B93"
            labelStyle={styles.label}
            inputStyle={styles.input}
          />

          <View>
            <View style={styles.rowTitle}>
              <Text style={styles.label}>Items</Text>
              <Pressable
                style={styles.addItemRow}
                onPress={() => {
                  setEditingItemIndex(null);
                  setItemModalVisible(true);
                }}
              >
                <PlusCircle size={22} color="#14C9E7" />
                <Text style={styles.addItemText}>Add Item</Text>
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
                    <Text style={styles.smallLabel}>QTY</Text>
                    <Text style={styles.itemMetricText}>{item.quantity}</Text>
                  </View>

                  <View style={{ width: "63%" }}>
                    <Text style={styles.smallLabel}>PRICE</Text>
                    <Text style={styles.itemMetricText}>
                      {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View>
            <Text style={styles.label}>Date</Text>
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
                {dueDate ? formatInvoiceDate(dueDate) : "Select due date"}
              </Text>
              <CalendarDays size={24} color="#90A0B8" />
            </Pressable>
          </View>

          <View style={styles.totalWrap}>
            <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.autoCalculated}>
                {dueDate ? `Due ${formatInvoiceDate(dueDate)}` : "Due date not set"}
              </Text>
            </View>
          </View>

          <ControllerTextInput
            name="email"
            control={control}
            label="Client Email"
            placeholder="client@example.com"
            inputStyle={styles.input}
            placeholderTextColor="#6D7B93"
          />

          <View style={styles.micWrap}>
            <Pressable style={styles.micCircle} onPress={openVoiceModal}>
              <Mic size={40} color="#EAF8FF" />
            </Pressable>
            <Text style={styles.micText}>Tap mic to fill invoice via AI chat</Text>
          </View>
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
                {editingItemIndex !== null ? "Edit Item" : "Add Item"}
              </Text>

              <View style={styles.modalField}>
                <Text style={styles.smallLabel}>DESCRIPTION</Text>
                <ControllerTextInput
                  name="add_item_description"
                  control={control}
                  value={newItem.description}
                  onChangeText={(text) =>
                    setNewItem((prev) => ({ ...prev, description: text }))
                  }
                  inputStyle={styles.input}
                  placeholder="Item description"
                  placeholderTextColor="#6D7B93"
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.smallLabel}>DETAILS (OPTIONAL)</Text>
                <ControllerTextInput
                  name="add_item_details"
                  control={control}
                  value={newItem.details}
                  onChangeText={(text) =>
                    setNewItem((prev) => ({ ...prev, details: text }))
                  }
                  inputStyle={styles.input}
                  placeholder="Extra details"
                  placeholderTextColor="#6D7B93"
                />
              </View>

              <View style={styles.qtyPriceRow}>
                <View style={{ width: "32%" }}>
                  <Text style={styles.smallLabel}>QTY</Text>
                  <ControllerTextInput
                    name="add_item_qty"
                    control={control}
                    value={newItem.quantity}
                    onChangeText={(text) =>
                      setNewItem((prev) => ({ ...prev, quantity: text }))
                    }
                    inputStyle={styles.input}
                    placeholderTextColor="#6D7B93"
                  />
                </View>
                <View style={{ width: "63%" }}>
                  <Text style={styles.smallLabel}>PRICE</Text>
                  <ControllerTextInput
                    name="add_item_price"
                    control={control}
                    value={newItem.unit_price}
                    onChangeText={(text) =>
                      setNewItem((prev) => ({ ...prev, unit_price: text }))
                    }
                    inputStyle={styles.input}
                    placeholderTextColor="#6D7B93"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={closeItemModal}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleAddItem}>
                  <Text style={styles.modalSaveText}>
                    {editingItemIndex !== null ? "Update" : "Add"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={voiceModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVoiceModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Invoice Command</Text>
              <TextInput
                value={voicePrompt}
                onChangeText={setVoicePrompt}
                placeholder='e.g. "Create invoice for Jamil $250 website design due May 30"'
                placeholderTextColor="#6D7B93"
                multiline
                style={styles.voiceInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    stopVoiceRecording();
                    setVoiceModalVisible(false);
                  }}
                  disabled={processingWorkflowPrefill || processingVoice}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                  disabled={processingWorkflowPrefill || processingVoice}
                >
                  <Text style={styles.modalCancelText}>
                    {isRecordingVoice ? "Stop" : "Record"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.modalSaveBtn}
                  onPress={handleProcessVoiceCommand}
                  disabled={processingWorkflowPrefill || processingVoice}
                >
                  {processingWorkflowPrefill || processingVoice ? (
                    <ActivityIndicator color="#0B1320" />
                  ) : (
                    <Text style={styles.modalSaveText}>Process</Text>
                  )}
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
              {editingInvoice ? "Save Invoice" : "Create Invoice"}
            </Text>
          )}
        </Pressable>
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
    marginBottom: responsiveHeight(1.6),
  },
  iconWrap: { width: responsiveWidth(8) },
  headerTitle: { color: "#F2F7FD", fontSize: 32, fontWeight: "700" },
  headerSpacer: { width: responsiveWidth(8) },
  content: { gap: responsiveHeight(1.2), paddingBottom: responsiveHeight(2) },
  label: { color: "#B7C2D3", fontSize: 22, marginBottom: responsiveHeight(1.5) },
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
  addItemText: { color: "#14C9E7", fontSize: 18, fontWeight: "500" },
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
  totalLabel: { color: "#8E9CB2", fontSize: 20, letterSpacing: 1.2 },
  totalRow: {
    marginTop: responsiveHeight(0.8),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  totalAmount: { color: "#14C9E7", fontSize: 30, fontWeight: "700" },
  autoCalculated: { color: "#8795AD", fontSize: 16 },
  micWrap: { alignItems: "center", marginTop: responsiveHeight(0.4) },
  micCircle: {
    width: responsiveWidth(24),
    height: responsiveWidth(24),
    borderRadius: responsiveWidth(12),
    backgroundColor: "#14C9E7",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#14C9E7",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  micText: {
    marginTop: responsiveHeight(1),
    color: "#14C9E7",
    fontSize: 18,
  },
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
    marginBottom: responsiveHeight(9),
  },
  createText: { color: "#EAF8FF", fontSize: 24, fontWeight: "600" },
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
  voiceInput: {
    minHeight: responsiveHeight(11),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3142",
    backgroundColor: "#1A2232",
    color: "#EAF0F6",
    fontSize: 16,
    paddingHorizontal: responsiveWidth(3.5),
    paddingVertical: responsiveHeight(1),
    textAlignVertical: "top",
  },
});

export default CreateInvoiceScreen;
