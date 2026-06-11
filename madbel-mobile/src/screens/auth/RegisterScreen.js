import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,

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
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  MailIcon,
  User2,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRegisterMutation } from "../../redux/slices/authSlice";
import ControllerTextInput from "../../components/ControllerTextInput";
import { SafeAreaView } from "react-native-safe-area-context";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#1D1F24",
  accent: "#14C6E4",
};

const RegisterScreen = () => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
    clearErrors,
  } = useFormContext();
  const navigation = useNavigation();
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [register, { isLoading: registerLoading }] = useRegisterMutation();
  const togglePasswordVisibility = () => {
    setPasswordVisible((prev) => !prev);
  };

  const handleRegister = async (data) => {
    // if (!termsAccepted) {
    //   setError("root", {
    //     type: "register",
    //     message: "Please accept Terms & Conditions to continue.",
    //   });
    //   return;
    // }

    try {
      await register({
        fullName: data?.fullName,
        email: data?.regEmail,
        password: data?.regPassword,
      }).unwrap();

      navigation.navigate("VerifyCode", {
        email: data?.regEmail,
      });
    } catch (error) {
      setError("root", {
        type: "register",
        message: error?.data?.message || "Unable to create account.",
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
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Join Mabdel’s AI business assistant.
                </Text>
              </View>

              <ControllerTextInput
                name="fullName"
                control={control}
                error={errors?.fullName?.message}
                label="Full Name"
                placeholder="Enter your full name"
                type="text"
                // keyboardType="email-address"
                leftIcon={<User2 color="#14C6E4" size={20} />}
                rules={{
                  required: "Full Name is required",
                  //   pattern: {
                  //     value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  //     message: "Enter a valid email address",
                  //   },
                }}
              />
              <ControllerTextInput
                name="regEmail"
                control={control}
                error={errors?.regEmail?.message}
                label="Email Address"
                placeholder="Enter your email"
                type="email"
                keyboardType="email-address"
                leftIcon={<MailIcon color="#14C6E4" size={20} />}
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                }}
              />
              <ControllerTextInput
                name="regPassword"
                control={control}
                error={errors?.regPassword?.message}
                label="Password"
                placeholder="Enter your password"
                type="password"
                keyboardType="password"
                secureTextEntry={!isPasswordVisible}
                leftIcon={<LockKeyhole color="#14C6E4" size={20} />}
                rightIcon={
                  isPasswordVisible ? (
                    <EyeOff color="#14C6E4" size={20} />
                  ) : (
                    <Eye color="#14C6E4" size={20} />
                  )
                }
                onPressToggle={togglePasswordVisibility}
                rules={{
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                }}
              />

              <Pressable
                style={styles.termsRow}
                onPress={() => {
                  setTermsAccepted((prev) => !prev);
                  if (errors?.root?.type === "register") {
                    clearErrors("root");
                  }
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    termsAccepted && styles.checkboxActive,
                  ]}
                >
                  {termsAccepted && (
                    <Check size={16} color="#021016" strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.termsText}>I agree to the</Text>
                <Text style={styles.link}>Terms & Conditions</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit(handleRegister)}
                style={[
                  styles.primaryButton,
                  registerLoading && styles.buttonDisabled,
                ]}
                disabled={registerLoading}
              >
                {registerLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign Up</Text>
                )}
              </Pressable>

              {/* <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.googleButton}>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable> */}

              {errors?.root?.type === "register" && (
                <Text style={styles.errorTextCenter}>
                  {errors?.root?.message}
                </Text>
              )}

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Pressable onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.link}>Log In</Text>
                </Pressable>
              </View>
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const FieldLabel = ({ label }) => (
  <Text style={styles.fieldLabel}>{label}</Text>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 52,
    gap: 10,
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 18,
    marginBottom: 18,
    gap: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 62 / 2,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 24 / 2,
    lineHeight: 34 / 2,
    textAlign: "center",
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 22 / 2,
    fontWeight: "500",
    marginTop: 12,
    marginBottom: 4,
  },
  inputWrap: { position: "relative" },
  input: {
    height: 76,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "transparent",
    color: colors.textPrimary,
    fontSize: 20 / 2,
    paddingHorizontal: 18,
  },
  inputWithRight: { paddingRight: 56 },
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
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "#272E3A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  termsText: {
    color: colors.textPrimary,
    fontSize: 20 / 2,
  },
  link: {
    color: colors.accent,
    fontSize: 20 / 2,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 8,
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    marginBottom: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A3038",
  },
  dividerText: {
    color: "#C2C7CC",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  googleButton: {
    height: 78,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  googleG: {
    fontSize: 24,
    fontWeight: "700",
    color: "#EA4335",
  },
  googleText: {
    color: colors.textPrimary,
    fontSize: 22 / 2,
    fontWeight: "600",
  },
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 10,
  },
  footerRow: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 22 / 2,
  },
});

export default RegisterScreen;
