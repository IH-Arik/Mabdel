import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Contacts from "expo-contacts";
import { Check, Search, X } from "lucide-react-native";
import { useMadbelCreateContactMutation } from "../redux/slices/madbelApiSlice";

const PhoneContactsImportModal = ({ visible, onClose, onImported }) => {
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [query, setQuery] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [debugError, setDebugError] = useState(null);
  const waitingForSettings = useRef(false);

  const [createContact] = useMadbelCreateContactMutation();

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setDebugError(null);
    try {
      const { status: existing } = await Contacts.getPermissionsAsync();

      let finalStatus = existing;
      if (existing !== "granted") {
        const { status: requested } = await Contacts.requestPermissionsAsync();
        finalStatus = requested;
      }

      if (finalStatus !== "granted") {
        setDebugError(`Permission status: "${finalStatus}". Tap "Open Settings" to grant access.`);
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
      });
      const valid = data.filter((c) => c.name && c.name.trim().length > 0);
      setDeviceContacts(valid);
    } catch (e) {
      setDebugError("Error: " + (e?.message || JSON.stringify(e)));
    } finally {
      setLoadingContacts(false);
    }
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setQuery("");
      setImportProgress(null);
      loadContacts();
    }
  }, [visible, loadContacts]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && waitingForSettings.current) {
        waitingForSettings.current = false;
        loadContacts();
      }
    });
    return () => sub.remove();
  }, [visible, loadContacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return deviceContacts;
    return deviceContacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phoneNumbers?.[0]?.number?.includes(q)
    );
  }, [deviceContacts, query]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleImport = async () => {
    const toImport = deviceContacts.filter((c) => selected.has(c.id));
    if (toImport.length === 0) {
      Alert.alert("No contacts selected", "Please select at least one contact.");
      return;
    }

    let done = 0;
    let failed = 0;
    setImportProgress({ done: 0, total: toImport.length });

    for (const c of toImport) {
      const phone = c.phoneNumbers?.[0]?.number?.replace(/\s+/g, "") || undefined;
      const email = c.emails?.[0]?.email || undefined;
      const firstName = c.firstName || c.name?.split(" ")?.[0] || "";
      const lastName =
        c.lastName || c.name?.split(" ")?.slice(1).join(" ") || "";
      try {
        await createContact({
          name: c.name.trim(),
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          phone,
          email,
        }).unwrap();
        done++;
      } catch {
        failed++;
      }
      setImportProgress({ done: done + failed, total: toImport.length });
    }

    setImportProgress(null);
    const msg =
      failed > 0
        ? `Imported ${done} contact${done !== 1 ? "s" : ""}. ${failed} failed (may already exist).`
        : `Successfully imported ${done} contact${done !== 1 ? "s" : ""}.`;
    Alert.alert("Import complete", msg);
    if (done > 0) onImported?.();
    onClose();
  };

  const renderItem = ({ item }) => {
    const isSelected = selected.has(item.id);
    const phone = item.phoneNumbers?.[0]?.number || "";
    return (
      <Pressable
        style={[styles.contactRow, isSelected && styles.contactRowSelected]}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Check size={14} color="#020406" strokeWidth={3} />}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.name}
          </Text>
          {phone ? (
            <Text style={styles.contactPhone} numberOfLines={1}>
              {phone}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const allFilteredSelected =
    filtered.length > 0 && selected.size === filtered.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={26} color="#F3F9FF" />
            </Pressable>
            <Text style={styles.title}>Import from Phone</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Search size={16} color="#8FC9D7" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search..."
              placeholderTextColor="#7FA6B3"
              style={styles.searchInput}
            />
          </View>

          {/* Select all row */}
          {!loadingContacts && filtered.length > 0 && (
            <Pressable style={styles.selectAllRow} onPress={toggleAll}>
              <View
                style={[
                  styles.checkbox,
                  allFilteredSelected && styles.checkboxChecked,
                ]}
              >
                {allFilteredSelected && (
                  <Check size={14} color="#020406" strokeWidth={3} />
                )}
              </View>
              <Text style={styles.selectAllText}>
                {allFilteredSelected ? "Deselect all" : "Select all"} (
                {filtered.length})
              </Text>
            </Pressable>
          )}

          {/* List */}
          {loadingContacts ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#12D0ED" size="large" />
              <Text style={styles.stateText}>Loading contacts...</Text>
            </View>
          ) : debugError ? (
            <View style={styles.centerState}>
              <Text style={[styles.stateText, { color: "#FF6B6B", marginBottom: 20, textAlign: "center" }]}>
                {debugError}
              </Text>
              <Pressable
                style={styles.importBtn}
                onPress={() => {
                  waitingForSettings.current = true;
                  Linking.openSettings();
                }}
              >
                <Text style={styles.importBtnText}>Open Settings</Text>
              </Pressable>
              <Pressable
                style={[styles.importBtn, { marginTop: 10, backgroundColor: "#1B3A44" }]}
                onPress={loadContacts}
              >
                <Text style={[styles.importBtnText, { color: "#12D0ED" }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filtered}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Text style={styles.stateText}>
                    {query.trim()
                      ? "No matches found."
                      : "No contacts on device."}
                  </Text>
                </View>
              }
            />
          )}

          {/* Import button */}
          {!loadingContacts && (
            <View style={styles.footer}>
              {importProgress ? (
                <View style={styles.progressWrap}>
                  <ActivityIndicator color="#12D0ED" />
                  <Text style={styles.progressText}>
                    Importing {importProgress.done}/{importProgress.total}...
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.importBtn,
                    selected.size === 0 && styles.importBtnDisabled,
                  ]}
                  onPress={handleImport}
                  disabled={selected.size === 0}
                >
                  <Text style={styles.importBtnText}>
                    Import {selected.size > 0 ? `(${selected.size})` : ""}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: { flex: 1, backgroundColor: "#020406", paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 8,
  },
  closeBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#F4FAFF", fontSize: 20, fontWeight: "700" },
  searchWrap: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "#1B1B1F",
    borderWidth: 1,
    borderColor: "#283544",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: "#CFE6EE", fontSize: 15, marginLeft: 8 },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
    gap: 10,
  },
  selectAllText: { color: "#8FC9D7", fontSize: 14 },
  listContent: { gap: 8, paddingBottom: 24 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2C3744",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  contactRowSelected: {
    borderColor: "#12D0ED",
    backgroundColor: "#0E2830",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#3A5060",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#12D0ED", borderColor: "#12D0ED" },
  contactInfo: { flex: 1 },
  contactName: { color: "#F5F9FF", fontSize: 15, fontWeight: "600" },
  contactPhone: { color: "#88C6D4", fontSize: 13, marginTop: 2 },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  stateText: { color: "#95A4B9", fontSize: 15 },
  footer: { paddingVertical: 16 },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
  },
  progressText: { color: "#8FC9D7", fontSize: 15 },
  importBtn: {
    backgroundColor: "#12D0ED",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  importBtnDisabled: { backgroundColor: "#1B3A44", opacity: 0.6 },
  importBtnText: { color: "#020406", fontSize: 16, fontWeight: "700" },
});

export default PhoneContactsImportModal;
