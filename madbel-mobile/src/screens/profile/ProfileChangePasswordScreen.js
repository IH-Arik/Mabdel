import React, { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useFormContext } from "react-hook-form";
import { Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useChangePasswordMutation } from "../../redux/slices/authSlice";
import ControllerTextInput from "../../components/ControllerTextInput";
import VoiceFormFillCard from "../../components/VoiceFormFillCard";

const ProfileChangePasswordScreen = () => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    watch,
    setError,
  } = useFormContext();

  const navigation = useNavigation();
  const newPasswordValue = watch("newPassword");
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] =
    useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const [changePassword, { isLoading: changePasswordLoading }] =
    useChangePasswordMutation();

  const handleChangePassword = async (data) => {
    if (data?.newPassword !== data?.confirmPassword) {
      setError("confirmPassword", {
        type: "validate",
        message: "Confirmed Password must match New Password",
      });
      return;
    }

    try {
      await changePassword({
        currentPassword: data?.currentPassword,
        newPassword: data?.newPassword,
        confirmPassword: data?.confirmPassword,
      }).unwrap();

      navigation.goBack();
    } catch (error) {
      setError("root", {
        type: "changePassword",
        message: error?.data?.message || "Failed to change password.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020406" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Pressable style={styles.iconWrap} onPress={() => navigation.goBack()}>
                <ChevronLeft size={35} color="#F8FAFC" strokeWidth={2.3} />
              </Pressable>
              <Text style={styles.title}>Change Password</Text>
              <View style={styles.spacer} />
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ControllerTextInput
                name="currentPassword"
                control={control}
                error={errors?.currentPassword?.message}
                rules={{
                  required: "Current Password is required",
                  minLength: {
                    value: 8,
                    message: "Current Password must be at least 8 characters",
                  },
                }}
                label="Current Password"
                placeholder="******"
                secureTextEntry={!isCurrentPasswordVisible}
                placeholderTextColor="#8493A8"
                inputStyle={styles.input}
                inputWrapperStyle={styles.inputWrap}
                labelStyle={styles.label}
                errorTextStyle={styles.errorText}
                rightIcon={
                  isCurrentPasswordVisible ? (
                    <EyeOff color="#DDE8F4" size={28} />
                  ) : (
                    <Eye color="#DDE8F4" size={28} />
                  )
                }
                onPressToggle={() =>
                  setIsCurrentPasswordVisible((prev) => !prev)
                }
              />

              <ControllerTextInput
                name="newPassword"
                control={control}
                error={errors?.newPassword?.message}
                rules={{
                  required: "New Password is required",
                  minLength: {
                    value: 8,
                    message: "New Password must be at least 8 characters",
                  },
                }}
                label="New Password"
                placeholder="******"
                secureTextEntry={!isNewPasswordVisible}
                placeholderTextColor="#8493A8"
                inputStyle={styles.input}
                inputWrapperStyle={styles.inputWrap}
                labelStyle={styles.label}
                errorTextStyle={styles.errorText}
                rightIcon={
                  isNewPasswordVisible ? (
                    <EyeOff color="#DDE8F4" size={28} />
                  ) : (
                    <Eye color="#DDE8F4" size={28} />
                  )
                }
                onPressToggle={() => setIsNewPasswordVisible((prev) => !prev)}
              />

              <ControllerTextInput
                name="confirmPassword"
                control={control}
                error={errors?.confirmPassword?.message}
                rules={{
                  required: "Confirmed Password is required",
                  minLength: {
                    value: 8,
                    message: "Confirmed Password must be at least 8 characters",
                  },
                  validate: (value) =>
                    value === newPasswordValue ||
                    "Confirmed Password must match New Password",
                }}
                label="Confirmed Password"
                placeholder="******"
                secureTextEntry={!isConfirmPasswordVisible}
                placeholderTextColor="#8493A8"
                inputStyle={styles.input}
                inputWrapperStyle={styles.inputWrap}
                labelStyle={styles.label}
                errorTextStyle={styles.errorText}
                rightIcon={
                  isConfirmPasswordVisible ? (
                    <EyeOff color="#DDE8F4" size={28} />
                  ) : (
                    <Eye color="#DDE8F4" size={28} />
                  )
                }
                onPressToggle={() =>
                  setIsConfirmPasswordVisible((prev) => !prev)
                }
              />
              <VoiceFormFillCard
                label="password form"
                workflowIntent="profile"
                sourceScreen="ProfileChangePassword"
              />
            </ScrollView>

            <Pressable
              onPress={handleSubmit(handleChangePassword)}
              style={[styles.saveBtn, changePasswordLoading ? styles.saveBtnDisabled : null]}
              disabled={changePasswordLoading}
            >
              {changePasswordLoading ? (
                <ActivityIndicator color="#E8F4FA" size={22} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>

            {errors?.root?.type === "changePassword" && (
              <Text style={styles.errorTextCenter}>{errors?.root?.message}</Text>
            )}
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020406",
  },
  container: {
    flex: 1,
    paddingHorizontal: responsiveWidth(5),
    paddingTop: responsiveHeight(0.8),
    paddingBottom: responsiveHeight(2.2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: responsiveHeight(2.2),
  },
  iconWrap: {
    width: responsiveWidth(9),
    alignItems: "flex-start",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 52 / 2,
    fontWeight: "700",
  },
  spacer: {
    width: responsiveWidth(9),
  },
  scrollContent: {
    gap: responsiveHeight(1.8),
    paddingBottom: responsiveHeight(2),
  },
  label: {
    color: "#F1F4F8",
    // fontSize: 54 / 2,
    fontWeight: "500",
    marginBottom: responsiveHeight(0.7),
  },
  inputWrap: {
    // minHeight: responsiveHeight(7.8),
    borderWidth: 2,
    borderColor: "#12C9EB",
    borderRadius: 18,
    paddingHorizontal: responsiveWidth(4.5),
    backgroundColor: "#020406",
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: "#EAF0F6",
    // fontSize: 46 / 2,
    paddingRight: responsiveWidth(3),
    backgroundColor: "transparent",
    borderWidth: 0,
    // height: responsiveHeight(7.8),
  },
  errorText: {
    color: "#F87171",
    marginTop: responsiveHeight(0.6),
    fontSize: 13,
  },
  saveBtn: {
    minHeight: responsiveHeight(8.2),
    marginBottom: responsiveHeight(8.2),
    borderRadius: 18,
    backgroundColor: "#15C8E3",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#15C8E3",
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 9,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: "#E8F4FA",
    fontSize: 56 / 2,
    fontWeight: "600",
  },
  errorTextCenter: {
    color: "#F87171",
    textAlign: "center",
    marginTop: responsiveHeight(1),
  },
});

export default ProfileChangePasswordScreen;
