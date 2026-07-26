import React, { useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import { useFormContext } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import { Bot, Eye, EyeOff, LockKeyhole, MailIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLoginMutation } from "../../redux/slices/authSlice";
import ControllerTextInput from "../../components/ControllerTextInput";
import { responsiveScreenFontSize } from "react-native-responsive-dimensions";
import { useAppLanguage } from "../../context/LanguageContext";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  accent: "#14C6E4",
};

const LoginScreen = () => {
  const { t } = useAppLanguage();
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useFormContext();

  const navigation = useNavigation();
  const [isPasswordVisible, setPasswordVisible] = useState(false);

  const [login, { isLoading: loginLoading }] = useLoginMutation();

  const handleLogin = async (data) => {
    try {
      await login({
        email: data?.loginEmail,
        password: data?.loginPassword,
      }).unwrap();
    } catch (error) {
      setError("root", {
        type: "login",
        message: error?.data?.message || t("unable_to_login"),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.safeArea}>
          <LinearGradient
            colors={["#02080B", "#010406"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.screen}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroWrap}>
                <View style={styles.iconCard}>
                  <Bot size={42} color={colors.accent} strokeWidth={2.3} />
                </View>
                <Text style={styles.title}>{t("welcome_back")}</Text>
                <Text style={styles.subtitle}>{t("login_subtitle")}</Text>
              </View>

              <ControllerTextInput
                name="loginEmail"
                control={control}
                error={errors?.loginEmail?.message}
                label={t("email_address")}
                placeholder={t("enter_your_email")}
                type="email"
                keyboardType="email"
                leftIcon={<MailIcon color="#14C6E4" size={20} />}
                rules={{
                  required: t("email_is_required"),
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: t("enter_valid_email"),
                  },
                }}
              />

              <ControllerTextInput
                name="loginPassword"
                control={control}
                error={errors?.loginPassword?.message}
                label={t("password")}
                placeholder={t("enter_password")}
                type="password"
                secureTextEntry={!isPasswordVisible}
                leftIcon={<LockKeyhole color="#14C6E4" size={20} />}
                rightIcon={
                  isPasswordVisible ? (
                    <EyeOff color="#14C6E4" size={20} />
                  ) : (
                    <Eye color="#14C6E4" size={20} />
                  )
                }
                onPressToggle={() => setPasswordVisible((p) => !p)}
                rules={{
                  required: t("password_is_required"),
                  minLength: {
                    value: 8,
                    message: t("password_min_length"),
                  },
                }}
              />

              <Pressable
                onPress={() => navigation.navigate("ForgotPassword")}
                style={styles.forgotWrap}
              >
                <Text style={styles.link}>{t("forgot_password_question")}</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit(handleLogin)}
                style={[styles.primaryButton, loginLoading && styles.buttonDisabled]}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t("login")}</Text>
                )}
              </Pressable>

              {errors?.root && (
                <Text style={styles.errorTextCenter}>
                  {errors.root.message}
                </Text>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 22,
    gap: 10,
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 26,
    marginBottom: 16,
    gap: 12,
  },
  iconCard: {
    width: 130,
    height: 130,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,36,46,0.65)",
    borderWidth: 1,
    borderColor: "rgba(20,198,228,0.3)",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  forgotWrap: {
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 8,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 8,
    height: 56,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: {
    color: "#EAF5F8",
    fontSize: responsiveScreenFontSize(2),
    fontWeight: "700",
  },
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
});

export default LoginScreen;
