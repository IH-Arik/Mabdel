import { useAppLanguage } from "../../context/LanguageContext";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Controller, useFormContext } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import {
  Eye,
  EyeOff,
  RotateCcw,
  CircleCheck,
  LockKeyhole,
} from "lucide-react-native";
import { useSelector } from "react-redux";
import { LinearGradient } from "expo-linear-gradient";
import { useResetPasswordMutation } from "../../redux/slices/authSlice";
import ControllerTextInput from "../../components/ControllerTextInput";
import {
  responsiveFontSize,
  responsiveHeight,
} from "react-native-responsive-dimensions";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#02080B",
  cardBorder: "#2D3645",
  accent: "#14C6E4",
};

const NewPasswordScreen = () => {
  const { t } = useAppLanguage();
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
    getValues,
    watch,
  } = useFormContext();
  const navigation = useNavigation();
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isPasswordVisible2, setPasswordVisible2] = useState(false);
  const [resetPassword, { isLoading: resetPasswordLoading }] =
    useResetPasswordMutation();

  const forgotEmail = useSelector((state) => state.auth.forgotEmail);
  const forgotOtp = useSelector((state) => state.auth.forgotOtp);

  const newPassword = watch("newPassword");
  const confirmPassword = watch("newConfirmPassword");

  const handleResetPassword = async (data) => {
    try {
      await resetPassword({
        email: forgotEmail,
        resetToken: forgotOtp,
        newPassword: data?.newPassword,
        confirmPassword: data?.newConfirmPassword,
      }).unwrap();
      navigation.navigate("NewPasswordSuccess");
    } catch (error) {
      setError("root", {
        type: "resetPassword",
        message: error?.data?.message || "Unable to update password.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          <LinearGradient colors={["#02080B", "#010406"]} style={styles.screen}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroWrap}>
                <View style={styles.iconCard}>
                  <RotateCcw
                    size={42}
                    color={colors.accent}
                    strokeWidth={2.1}
                  />
                </View>
                <Text style={styles.title}>{t("set_new_password")}</Text>
                <Text style={styles.subtitle}>{t("protect_your_smartflow_productivity_hub_with_a_hig")}</Text>
              </View>

              <ControllerTextInput
                name="newPassword"
                control={control}
                error={errors?.newPassword?.message}
                label={t("new_password")}
                placeholder={t("enter_new_password")}
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
                  required: "New Password is required",
                  minLength: {
                    value: 8,
                    message: "New Password must be at least 8 characters",
                  },
                }}
              />



              <ControllerTextInput
                name="newConfirmPassword"
                control={control}
                error={errors?.newConfirmPassword?.message}
                label={t("confirm_password")}
                placeholder={t("enter_confirm_password")}
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
                  required: "Confirm password is required",
                  validate: (value) =>
                    value === getValues("newPassword") ||
                    "Passwords do not match",
                }}
              />

  

              <Pressable
                onPress={handleSubmit(handleResetPassword)}
                style={[
                  styles.primaryButton,
                  resetPasswordLoading && styles.buttonDisabled,
                ]}
                disabled={resetPasswordLoading}
              >
                {resetPasswordLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <Text style={styles.primaryButtonText}>{t("update_password")}</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate("Login")}
                style={styles.backWrap}
              >
                <Text style={styles.backLink}>{t("back_to_log_in")}</Text>
              </Pressable>

              {errors?.root?.type === "resetPassword" && (
                <Text style={styles.errorTextCenter}>
                  {errors?.root?.message}
                </Text>
              )}

              {/* <Text style={styles.terms}>
                By setting a password, you agree to our
                <Text style={styles.link}>{t("terms_of_service")}</Text>
                and
                <Text style={styles.link}>{t("privacy_policy")}</Text>
              </Text> */}
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  content: {
    flexGrow: 1,
    paddingBottom: 30,
    gap: responsiveHeight(2),
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 30,
    marginBottom: 18,
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
    fontSize: 56 / 2,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 32 / 2,
    textAlign: "center",
  },
  fieldLabel: {
    color: "#A9B0C9",
    fontSize: 18,
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 6,
  },
  inputWrap: { position: "relative" },
  input: {
    height: 76,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    color: colors.textPrimary,
    fontSize: 22 / 2,
    paddingHorizontal: 18,
    paddingRight: 56,
  },
  inputRightIcon: {
    position: "absolute",
    right: 14,
    height: 76,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBorder: { borderColor: "#FF5D6E" },
  errorText: {
    color: "#FF5D6E",
    fontSize: 12,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 18,
    height: 78,
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
    fontSize: responsiveFontSize(2),
    fontWeight: "700",
  },
  backWrap: {
    alignItems: "center",
    marginTop: 16,
  },
  backLink: {
    color: "#D0D6DD",
    textDecorationLine: "underline",
    fontSize: 22 / 2,
  },
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 10,
  },
  terms: {
    textAlign: "center",
    marginTop: "auto",
    marginBottom: 16,
    color: colors.textSecondary,
    lineHeight: 26,
    fontSize: 18 / 2,
  },
  link: {
    color: colors.accent,
  },
});

export default NewPasswordScreen;
