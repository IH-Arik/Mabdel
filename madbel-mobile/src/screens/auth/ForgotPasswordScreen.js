import { useAppLanguage } from "../../context/LanguageContext";
import React from "react";
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
  ArrowLeft,
  Mail,
  MailIcon,
  SendHorizontal,
  ShieldAlert,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useForgotPasswordMutation } from "../../redux/slices/authSlice";
import { useDispatch } from "react-redux";
import { setResetEmail } from "../../redux/reducers/authReducer";
import ControllerTextInput from "../../components/ControllerTextInput";
import { responsiveHeight, responsiveScreenFontSize, responsiveWidth } from "react-native-responsive-dimensions";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#1D1F24",
  accent: "#14C6E4",
};

const ForgotPasswordScreen = () => {
  const { t } = useAppLanguage();
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useFormContext();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [forgotPassword, { isLoading: forgotPasswordLoading }] =
    useForgotPasswordMutation();

  const handleForgotPassword = async (data) => {
    try {
      dispatch(setResetEmail(data?.forgotEmail));
      await forgotPassword({ email: data?.forgotEmail }).unwrap();
      navigation.navigate("ForgotPasswordVerifyCode");
    } catch (error) {
      setError("root", {
        type: "forgotPassword",
        message: error?.data?.message || "Unable to send code.",
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
            {/* <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <ArrowLeft size={32} color={colors.textPrimary} strokeWidth={2.5} />
            </Pressable> */}

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroWrap}>
                <View style={styles.iconCard}>
                  <ShieldAlert
                    size={42}
                    color={colors.accent}
                    strokeWidth={2.1}
                  />
                </View>
                <Text style={styles.title}>{t("forgot_password")}</Text>
                <Text style={styles.subtitle}>{t("enter_your_email_address_to_receive_a_4digit_verif")}</Text>
              </View>


              <ControllerTextInput
                name="forgotEmail"
                control={control}
                error={errors?.forgotEmail?.message}
                label={t("email_address")}
                placeholder={t("enter_your_email")}
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
              {errors?.forgotEmail?.message && (
                <Text style={styles.errorText}>
                  {errors.forgotEmail.message}
                </Text>
              )}

              <Pressable
                onPress={handleSubmit(handleForgotPassword)}
                style={[
                  styles.primaryButton,
                  forgotPasswordLoading && styles.buttonDisabled,
                ]}
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <ActivityIndicator color="#EAF9FD" size={20} />
                ) : (
                  <View style={styles.buttonRow}>
                    <Text style={styles.primaryButtonText}>{t("send_verification_code")}</Text>
                    <SendHorizontal
                      size={24}
                      color="#EAF5F8"
                      strokeWidth={2.3}
                    />
                  </View>
                )}
              </Pressable>

               <View style={styles.footerRow}>
                <Text style={styles.footerText}>{t("remember_your_password")}</Text>
                <Pressable onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.link}>{t("back_to_login")}</Text>
                </Pressable>
              </View>

              {errors?.root?.type === "forgotPassword" && (
                <Text style={styles.errorTextCenter}>
                  {errors?.root?.message}
                </Text>
              )}
             
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
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  content: {
    flexGrow: 1,
    paddingBottom: 30,
    gap: 10,
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 26,
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
    lineHeight: 15,
    textAlign: "center",
  },
  fieldLabel: {
    color: "#C9CFD5",
    fontSize: 17,
    letterSpacing: 2,
    marginBottom: 4,
  },
  inputWrap: {
    height: 76,
    borderRadius: 20,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 34 / 2,
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
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#EAF5F8",
    fontSize: responsiveScreenFontSize(2),
    fontWeight: "700",
  },
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 10,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: responsiveHeight(2),
    marginBottom: 12,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ForgotPasswordScreen;
