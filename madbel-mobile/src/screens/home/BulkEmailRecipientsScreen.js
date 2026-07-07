import { useAppLanguage } from "../../context/LanguageContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ArrowLeft, X } from "lucide-react-native";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import {
  useMadbelListContactsQuery,
  useMadbelValidateBulkRecipientsMutation,
} from "../../redux/slices/madbelApiSlice";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeRecipients = (values) => {
  const { t } = useAppLanguage();
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const BulkEmailRecipientsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const tabBarHeight = useBottomTabBarHeight();

  const incomingRecipients = route?.params?.recipients;
  const [recipients, setRecipients] = useState(() =>
    normalizeRecipients(incomingRecipients),
  );
  const [inputValue, setInputValue] = useState("");
  const [validateRecipients, { isLoading: validatingRecipients }] =
    useMadbelValidateBulkRecipientsMutation();
  const {
    data: contactsResponse,
    isLoading: contactsLoading,
    isFetching: contactsFetching,
  } = useMadbelListContactsQuery({
    page: 1,
    page_size: 50,
  });

  const contacts = contactsResponse?.data?.items || [];
  const contactsWithEmail = contacts.filter((contact) => contact?.email).slice(0, 20);

  useEffect(() => {
    setRecipients(normalizeRecipients(incomingRecipients));
  }, [incomingRecipients]);

  const parsedInputEmails = useMemo(() => {
    return inputValue
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [inputValue]);

  const validRecipients = recipients.filter((email) => emailRegex.test(email));

  const pushInputEmails = () => {
    if (!parsedInputEmails.length) return;
    setRecipients((prev) => {
      const set = new Set(prev);
      parsedInputEmails.forEach((email) => set.add(email));
      return Array.from(set);
    });
    setInputValue("");
  };

  const addRecipient = (email) => {
    if (!email) return;
    setRecipients((prev) => {
      const set = new Set(prev);
      set.add(String(email).trim());
      return Array.from(set).filter(Boolean);
    });
  };

  const handleContinue = async () => {
    pushInputEmails();
    const nextRecipients = [
      ...new Set(
        [...recipients, ...parsedInputEmails]
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];

    try {
      const response = await validateRecipients({
        channel: "email",
        recipient_emails: nextRecipients,
      }).unwrap();
      const payload = response?.data || {};
      const validTargets = (payload?.recipients || [])
        .map((item) => item?.email)
        .filter(Boolean);

      navigation.navigate("BulkMessaging", {
        recipients: validTargets.length ? validTargets : nextRecipients,
        validCount: payload?.valid_count || 0,
        invalidEntries: payload?.invalid_entries || [],
        duplicateEntries: payload?.duplicate_entries || [],
      });
    } catch (error) {
      Alert.alert(
        "Validation failed",
        error?.data?.message || "Could not validate recipients.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={responsiveWidth(7.2)} color="#F4F8FF" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("add_recipients")}</Text>
          <View style={styles.rightSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + responsiveHeight(14) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.chipWrap}>
              {recipients.map((email) => {
                const isValid = emailRegex.test(email);
                return (
                  <View key={email} style={[styles.emailChip, !isValid && styles.invalidChip]}>
                    <Text
                      style={[styles.emailChipText, !isValid && styles.invalidChipText]}
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                    <Pressable
                      onPress={() => setRecipients((prev) => prev.filter((item) => item !== email))}
                      hitSlop={8}
                    >
                      <X
                        size={responsiveWidth(5)}
                        color={isValid ? "#A8B4CC" : "#FF5B5B"}
                        strokeWidth={2.2}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={pushInputEmails}
              placeholder={t("type_email")}
              placeholderTextColor="#7B8498"
              style={styles.input}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.hintText}>
              Valid emails: {validRecipients.length} / {Math.max(recipients.length, 1)}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.contactsHeaderRow}>
              <Text style={styles.contactsTitle}>{t("add_from_contacts")}</Text>
              {contactsFetching ? <ActivityIndicator color="#87D9E9" size="small" /> : null}</View>

            {contactsLoading ? (
              <View style={styles.contactsStateRow}>
                <ActivityIndicator color="#12D0ED" />
              </View>
            ) : contactsWithEmail.length ? (
              contactsWithEmail.map((contact) => {
                const email = String(contact.email || "").trim();
                const selected = recipients.includes(email);
                return (
                  <Pressable
                    key={contact.id}
                    style={[styles.contactRow, selected && styles.contactRowSelected]}
                    onPress={() => addRecipient(email)}
                  >
                    <View style={styles.contactNameWrap}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {contact.name || "Unnamed"}
                      </Text>
                      <Text style={styles.contactEmail} numberOfLines={1}>
                        {email}
                      </Text>
                    </View>
                    <Text style={[styles.addText, selected && styles.addedText]}>
                      {selected ? "Added" : "Add"}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.contactsStateRow}>
                <Text style={styles.emptyStateText}>{t("no_contacts_found")}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.bottomCtaWrap, { bottom: tabBarHeight + responsiveHeight(1.2) }]}>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            {validatingRecipients ? (
              <ActivityIndicator color="#DFF8FF" />
            ) : (
              <Text style={styles.continueBtnText}>{t("continue")}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#010507",
  },
  screen: {
    flex: 1,
    backgroundColor: "#010507",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: responsiveWidth(3.8),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: responsiveHeight(1),
  },
  backBtn: {
    width: responsiveWidth(11.2),
    height: responsiveWidth(11.2),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F2F7FF",
    fontSize: responsiveWidth(3.6),
    fontWeight: "700",
  },
  rightSpacer: {
    width: responsiveWidth(11.2),
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: responsiveWidth(4.8),
    paddingTop: responsiveHeight(2),
  },
  card: {
    borderRadius: responsiveWidth(5.2),
    backgroundColor: "#1D1E23",
    paddingHorizontal: responsiveWidth(4.2),
    paddingVertical: responsiveHeight(2),
    borderWidth: 1,
    borderColor: "#2C3038",
    marginBottom: responsiveHeight(1.4),
  },
  chipWrap: {
    gap: responsiveHeight(1.2),
    marginBottom: responsiveHeight(1.8),
  },
  emailChip: {
    minHeight: responsiveHeight(5.8),
    borderRadius: responsiveWidth(8),
    paddingHorizontal: responsiveWidth(4),
    borderWidth: 1,
    borderColor: "#2D3A5A",
    backgroundColor: "#0E121D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  invalidChip: {
    borderColor: "#FF5B5B",
  },
  emailChipText: {
    flex: 1,
    color: "#E8EDF7",
    fontSize: responsiveWidth(3.2),
    marginRight: responsiveWidth(2),
  },
  invalidChipText: {
    color: "#FFC7C7",
  },
  input: {
    color: "#EAF2FF",
    fontSize: responsiveWidth(4.2),
    paddingHorizontal: responsiveWidth(1),
    paddingVertical: responsiveHeight(0.6),
    marginTop: responsiveHeight(0.4),
  },
  hintText: {
    marginTop: responsiveHeight(0.8),
    color: "#7B8498",
    fontSize: responsiveWidth(2.8),
  },
  contactsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(0.8),
  },
  contactsTitle: {
    color: "#E8EDF7",
    fontSize: responsiveWidth(3.3),
    fontWeight: "600",
  },
  contactsStateRow: {
    minHeight: responsiveHeight(8),
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    color: "#8EA1BD",
    fontSize: responsiveWidth(3),
  },
  contactRow: {
    minHeight: responsiveHeight(6.4),
    borderRadius: responsiveWidth(5),
    borderWidth: 1,
    borderColor: "#2D3A5A",
    backgroundColor: "#0E121D",
    paddingHorizontal: responsiveWidth(3.4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: responsiveHeight(0.8),
  },
  contactRowSelected: {
    borderColor: "#16CAE7",
    backgroundColor: "#102635",
  },
  contactNameWrap: {
    flex: 1,
    marginRight: responsiveWidth(2),
  },
  contactName: {
    color: "#E8EDF7",
    fontSize: responsiveWidth(3.2),
    fontWeight: "600",
  },
  contactEmail: {
    color: "#8EA1BD",
    fontSize: responsiveWidth(2.9),
    marginTop: responsiveHeight(0.15),
  },
  addText: {
    color: "#14C9E7",
    fontSize: responsiveWidth(3),
    fontWeight: "700",
  },
  addedText: {
    color: "#67E6FF",
  },
  bottomCtaWrap: {
    position: "absolute",
    left: responsiveWidth(4.8),
    right: responsiveWidth(4.8),
  },
  continueBtn: {
    height: responsiveHeight(7),
    borderRadius: responsiveWidth(12),
    backgroundColor: "#18C6E3",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#18C6E3",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  continueBtnText: {
    color: "#DFF8FF",
    fontSize: responsiveWidth(4.2),
    fontWeight: "700",
  },
});

export default BulkEmailRecipientsScreen;
