import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
import { CheckCircle2 } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

const NewPasswordSuccessScreen = () => {
  const { t } = useAppLanguage();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#02080B", "#010406"]} style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.iconCard}>
            <CheckCircle2 size={52} color="#14C6E4" strokeWidth={2.3} />
          </View>

          <Text style={styles.title}>{t("password_updated")}</Text>
          <Text style={styles.subtitle}>{t("your_password_has_been_reset_successfully_you_can_")}</Text>

          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t("back_to_log_in")}</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#02080B",
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  iconCard: {
    width: 132,
    height: 132,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,36,46,0.65)",
    borderWidth: 1,
    borderColor: "rgba(20,198,228,0.3)",
    marginBottom: 4,
  },
  title: {
    color: "#F3F6F8",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#9AA4AE",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
    marginBottom: 14,
  },
  primaryButton: {
    width: "100%",
    height: 78,
    borderRadius: 22,
    backgroundColor: "#14C6E4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#14C6E4",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  primaryButtonText: {
    color: "#EAF5F8",
    fontSize: 24 / 2,
    fontWeight: "700",
  },
});

export default NewPasswordSuccessScreen;
