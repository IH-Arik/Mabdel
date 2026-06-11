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
import { Eye, EyeOff, RotateCcw, CircleCheck } from "lucide-react-native";
import { useSelector } from "react-redux";
import { LinearGradient } from "expo-linear-gradient";
import { useResetPasswordMutation } from "../../redux/slices/authSlice";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#02080B",
  cardBorder: "#2D3645",
  accent: "#14C6E4",
};

const NewPasswordScreen = () => {
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
                  <RotateCcw size={42} color={colors.accent} strokeWidth={2.1} />
                </View>
                <Text style={styles.title}>Set new Password</Text>
                <Text style={styles.subtitle}>
                  Protect your SmartFlow productivity hub with a high-fidelity
                  password.
                </Text>
              </View>

              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <Controller
                control={control}
                name="newPassword"
                rules={{
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                }}
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="SecurePass2024!"
                      placeholderTextColor="#777F88"
                      secureTextEntry={!isPasswordVisible}
                      style={[styles.input, errors?.newPassword && styles.errorBorder]}
                    />
                    <Pressable
                      onPress={() => setPasswordVisible((prev) => !prev)}
                      style={styles.inputRightIcon}
                    >
                      {isPasswordVisible ? (
                        <EyeOff size={28} color="#A9AFBD" />
                      ) : (
                        <Eye size={28} color="#A9AFBD" />
                      )}
                    </Pressable>
                  </View>
                )}
              />
              {errors?.newPassword?.message && (
                <Text style={styles.errorText}>{errors.newPassword.message}</Text>
              )}

              <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
              <Controller
                control={control}
                name="newConfirmPassword"
                rules={{
                  required: "Confirm password is required",
                  validate: (value) =>
                    value === getValues("newPassword") || "Passwords do not match",
                }}
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="SecurePass2024!"
                      placeholderTextColor="#777F88"
                      secureTextEntry={!isPasswordVisible2}
                      style={[
                        styles.input,
                        errors?.newConfirmPassword && styles.errorBorder,
                      ]}
                    />
                    <Pressable
                      onPress={() => setPasswordVisible2((prev) => !prev)}
                      style={styles.inputRightIcon}
                    >
                      {confirmPassword && confirmPassword === newPassword ? (
                        <CircleCheck size={30} color="#1AD89A" />
                      ) : isPasswordVisible2 ? (
                        <EyeOff size={28} color="#A9AFBD" />
                      ) : (
                        <Eye size={28} color="#A9AFBD" />
                      )}
                    </Pressable>
                  </View>
                )}
              />
              {errors?.newConfirmPassword?.message && (
                <Text style={styles.errorText}>{errors.newConfirmPassword.message}</Text>
              )}

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
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate("Login")}
                style={styles.backWrap}
              >
                <Text style={styles.backLink}>Back to Log In</Text>
              </Pressable>

              {errors?.root?.type === "resetPassword" && (
                <Text style={styles.errorTextCenter}>{errors?.root?.message}</Text>
              )}

              <Text style={styles.terms}>
                By setting a password, you agree to our
                <Text style={styles.link}> Terms of Service </Text>
                and
                <Text style={styles.link}> Privacy Policy.</Text>
              </Text>
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
    fontSize: 21 / 2,
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
    fontSize: 24 / 2,
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
