import { useAppLanguage } from "../../context/LanguageContext";
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronDown, ChevronUp, Mail, MessageCircle, Phone } from "lucide-react-native";
import { responsiveHeight, responsiveWidth } from "react-native-responsive-dimensions";
import { useNavigation } from "@react-navigation/native";

const FAQ_ITEMS = [
  {
    id: "1",
    question: "How do I make an AI-powered call?",
    answer:
      "Go to the Calls tab, tap the dial icon, and select 'AI Call'. The AI agent will handle the conversation on your behalf using your configured settings.",
  },
  // {
  //   id: "2",
  //   question: "How do I create a group or event?",
  //   answer:
  //     "From the Home screen, tap 'Create Activity' or 'Create Event'. Fill in the details and invite participants. You can manage your hosted events from Profile > Hosted Events.",
  // },
  {
    id: "3",
    question: "How do I connect my social accounts?",
    answer:
      "Go to Home > Social Integrations. You can connect Facebook, Instagram, and other platforms to manage posts from one place.",
  },
  {
    id: "4",
    question: "How do I reset my password?",
    answer:
      "Log out and tap 'Forgot Password' on the login screen. Enter your email and follow the OTP verification steps to set a new password.",
  },
  {
    id: "5",
    question: "Why is my call recording not showing a transcript?",
    answer:
      "Transcription is processed after the call ends. It may take up to a few minutes. Ensure your call had audio and was longer than 5 seconds.",
  },
];

const FaqItem = ({ item }) => {
  const { t } = useAppLanguage();
  const [open, setOpen] = useState(false);
  return (
    <Pressable style={styles.faqCard} onPress={() => setOpen((prev) => !prev)}>
      <View style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        {open ? <ChevronUp size={18} color="#9AA6B3" /> : <ChevronDown size={18} color="#9AA6B3" />}
      </View>
      {open && <Text style={styles.faqAnswer}>{item.answer}</Text>}
    </Pressable>
  );
};

const ProfileSupportScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();
  const [message, setMessage] = useState("");

  const handleSendEmail = () => {
    if (!message.trim()) {
      Alert.alert(t("empty_message"), t("please_describe_your_issue_before_sending"));
      return;
    }
    Linking.openURL(
      `mailto:support@mabdel.com?subject=Support Request&body=${encodeURIComponent(message)}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
            <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
          </Pressable>
          <Text style={styles.title}>{t("help_support")}</Text>
          <View style={styles.spacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>{t("contact_us")}</Text>

          <View style={styles.contactRow}>
            <Pressable
              style={styles.contactCard}
              onPress={() => Linking.openURL("mailto:support@mabdel.com")}
            >
              <Mail size={22} color="#17b4c9" />
              <Text style={styles.contactLabel}>{t("email")}</Text>
            </Pressable>
            <Pressable
              style={styles.contactCard}
              onPress={() => Linking.openURL("tel:+18001234567")}
            >
              <Phone size={22} color="#17b4c9" />
              <Text style={styles.contactLabel}>{t("call_us")}</Text>
            </Pressable>
            {/* <Pressable
              style={styles.contactCard}
              onPress={() => navigation.navigate("SingleChat")}
            >
              <MessageCircle size={22} color="#17b4c9" />
              <Text style={styles.contactLabel}>{t("live_chat")}</Text>
            </Pressable> */}
          </View>

          <Text style={styles.sectionTitle}>{t("send_a_message")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("describe_your_issue")}
            placeholderTextColor="#5A6478"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
          <Pressable style={styles.sendBtn} onPress={handleSendEmail}>
            <Text style={styles.sendText}>{t("send_message")}</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>{t("faq")}</Text>
          <View style={{ gap: responsiveHeight(1.2) }}>
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.id} item={item} />
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#020406" },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.4),
  },
  iconWrap: { width: responsiveWidth(9), alignItems: "flex-start" },
  title: { color: "#F8FAFC", fontSize: 25, fontWeight: "700" },
  spacer: { width: responsiveWidth(9) },
  scroll: { paddingBottom: responsiveHeight(4), gap: responsiveHeight(1.6) },
  sectionTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    marginTop: responsiveHeight(1.5),
    marginBottom: responsiveHeight(0.6),
  },
  contactRow: {
    flexDirection: "row",
    gap: responsiveWidth(3),
  },
  contactCard: {
    flex: 1,
    backgroundColor: "#1B1C21",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#212530",
    alignItems: "center",
    paddingVertical: responsiveHeight(2),
    gap: responsiveHeight(0.8),
  },
  contactLabel: { color: "#F2F4F7", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "#1B1C21",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#212530",
    color: "#F2F4F7",
    padding: responsiveWidth(4),
    fontSize: 14,
    minHeight: responsiveHeight(12),
  },
  sendBtn: {
    backgroundColor: "#17b4c9",
    borderRadius: 14,
    paddingVertical: responsiveHeight(1.8),
    alignItems: "center",
  },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  faqCard: {
    backgroundColor: "#1B1C21",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#212530",
    paddingHorizontal: responsiveWidth(4.4),
    paddingVertical: responsiveHeight(1.6),
  },
  faqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: { color: "#F2F4F7", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  faqAnswer: { color: "#9AA6B3", fontSize: 14, marginTop: responsiveHeight(1), lineHeight: 22 },
});

export default ProfileSupportScreen;
