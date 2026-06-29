import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useFormContext } from "react-hook-form";
import { useNavigation } from "@react-navigation/native";
import { Bot, Eye, EyeOff, LockKeyhole, MailIcon } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useLoginMutation,
  useGoogleLoginMutation,
} from "../../redux/slices/authSlice";
import { SafeAreaView } from "react-native-safe-area-context";
import ControllerTextInput from "../../components/ControllerTextInput";
import { googleSignIn } from "../../utils/googleAuth";
import { responsiveScreenFontSize } from "react-native-responsive-dimensions";

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const [login, { isLoading: loginLoading }] = useLoginMutation();
  const [googleLogin] = useGoogleLoginMutation();

  const isAnyLoading = loginLoading || googleLoading;

  const handleLogin = async (data) => {
    try {
      await login({
        email: data?.loginEmail,
        password: data?.loginPassword,
      }).unwrap();
      // No navigate() call — RootAppNavigator re-renders automatically
      // when setCredentials flips isAuthenticated to true
    } catch (error) {
      setError("root", {
        type: "login",
        message: error?.data?.message || "Unable to login.",
      });
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const idToken = await googleSignIn();
      await googleLogin({ id_token: idToken }).unwrap();
      // No navigate() call — same pattern as handleLogin
    } catch (error) {
      if (error?.code === "SIGN_IN_CANCELLED") return;
      console.log('LINE AT 78' , error);
      
      setError("root", {
        type: "google",
        message:
          error?.data?.message ||
          error?.message ||
          "Google sign-in failed. Please try again.",
      });
    } finally {
      setGoogleLoading(false);
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
              {/* Hero */}
              <View style={styles.heroWrap}>
                <View style={styles.iconCard}>
                  <Bot size={42} color={colors.accent} strokeWidth={2.3} />
                </View>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Login to your Mabdel AI business assistant
                </Text>
              </View>

              {/* Email */}
              <ControllerTextInput
                name="loginEmail"
                control={control}
                error={errors?.loginEmail?.message}
                label="Email Address"
                placeholder="Enter your email"
                type="email"
                keyboardType="email"
                leftIcon={<MailIcon color="#14C6E4" size={20} />}
                rules={{
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                }}
              />

              {/* Password */}
              <ControllerTextInput
                name="loginPassword"
                control={control}
                error={errors?.loginPassword?.message}
                label="Password"
                placeholder="Enter password"
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
                  required: "Password is required",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                }}
              />

              {/* Forgot */}
              <Pressable
                onPress={() => navigation.navigate("ForgotPassword")}
                style={styles.forgotWrap}
              >
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>

              {/* Login button */}
              <Pressable
                onPress={handleSubmit(handleLogin)}
                style={[
                  styles.primaryButton,
                  isAnyLoading && styles.buttonDisabled,
                ]}
                disabled={isAnyLoading}
              >
                {loginLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <Text style={styles.primaryButtonText}>Login</Text>
                )}
              </Pressable>

              {/* Error */}
              {errors?.root && (
                <Text style={styles.errorTextCenter}>
                  {errors.root.message}
                </Text>
              )}

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google button */}
              <Pressable
                onPress={handleGoogleLogin}
                disabled={isAnyLoading}
                style={[
                  styles.googleButton,
                  isAnyLoading && styles.buttonDisabled,
                ]}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.textPrimary} size={20} />
                ) : (
                  <>
                    <Image
                      source={require("../../../assets/images/google_icon.png")}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              {/* Footer */}
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Don't have an account?</Text>
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2A3038",
  },
  dividerText: {
    color: "#C2C7CC",
    fontSize: 13,
    fontWeight: "600",
  },
  googleButton: {
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  googleText: {
    color: colors.textPrimary,
    fontSize: 15,
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
    fontSize: 13,
  },
});

export default LoginScreen;
