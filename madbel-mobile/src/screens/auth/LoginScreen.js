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
import { useFormContext, Controller } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import { Bot, Eye, EyeOff, LockKeyhole, MailIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLoginMutation } from "../../redux/slices/authSlice";
import { SafeAreaView } from "react-native-safe-area-context";
import ControllerTextInput from "../../components/ControllerTextInput";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#1D1F24",
  cardBorder: "#2A3240",
  accent: "#14C6E4",
};

const LoginScreen = () => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useFormContext();
  const navigation = useNavigation();
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [login, { isLoading: loginLoading }] = useLoginMutation();
  const togglePasswordVisibility = () => {
    setPasswordVisible((prev) => !prev);
  };

  const handleLogin = async (data) => {
    try {
      await login({
        email: data?.loginEmail,
        password: data?.loginPassword,
      }).unwrap();
      navigation.navigate("BottomNavigator");
    } catch (error) {
      setError("root", {
        type: "login",
        message: error?.data?.message || "Unable to login.",
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
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Login to your Mabdel AI business assistant
                </Text>
              </View>

              <ControllerTextInput
                name="loginEmail"
                control={control}
                error={errors?.loginEmail?.message}
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
                name="loginPassword"
                control={control}
                error={errors?.loginPassword?.message}
                label="Password"
                placeholder="Enter password"
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
                onPress={() => navigation.navigate("ForgotPassword")}
                style={styles.forgotWrap}
              >
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>

              <Pressable
                onPress={handleSubmit(handleLogin)}
                style={[
                  styles.primaryButton,
                  loginLoading && styles.buttonDisabled,
                ]}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <Text style={styles.primaryButtonText}>Login</Text>
                )}
              </Pressable>

              {errors?.root?.type === "login" && (
                <Text style={styles.errorTextCenter}>
                  {errors?.root?.message}
                </Text>
              )}

              {/* Google OAuth — not yet implemented
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable style={styles.googleButton}>
                <Image
                  source={require("../../../assets/images/google_icon.png")}
                  style={{ width: 24, height: 24 }}
                />
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable>
              */}

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don’t have an account?</Text>
                <Pressable onPress={() => navigation.navigate("Register")}>
                  <Text style={styles.link}>Sign Up</Text>
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
    fontSize: 56 / 2,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 21 / 2,
    lineHeight: 30 / 2,
    textAlign: "center",
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: 22 / 2,
    fontWeight: "500",
    marginTop: 8,
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
  inputWithRight: {
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
  forgotWrap: {
    alignItems: "flex-end",
    marginTop: 4,
    marginBottom: 8,
  },
  link: {
    color: colors.accent,
    fontSize: 19 / 2,
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
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
  footerRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 21 / 2,
  },
});

export default LoginScreen;
