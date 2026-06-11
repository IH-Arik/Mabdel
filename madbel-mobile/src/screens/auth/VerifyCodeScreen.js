// import {
//   View,
//   Text,
//   Pressable,
//   ScrollView,
//   KeyboardAvoidingView,
//   Platform,
//   TouchableWithoutFeedback,
//   Keyboard,
//   ActivityIndicator,
// } from "react-native";
// import React, { useRef } from "react";
// import { SafeAreaView } from "react-native-safe-area-context";
// import {
//   responsiveHeight,
//   responsiveWidth,
// } from "react-native-responsive-dimensions";
// import { Controller, useFormContext } from "react-hook-form";
// import { useNavigation } from "@react-navigation/native";
// import OTPTextInput from "react-native-otp-textinput";
// import { useVerifyCodeMutation } from "../../redux/slices/authSlice";
// const VerifyCodeScreen = () => {
//   const {
//     control,
//     formState: { errors },
//     handleSubmit,
//     // setValue,
//     setError,
//   } = useFormContext();
//   const navigation = useNavigation();
//   const otpRef = useRef(null);
//   const [verifyCode, { isLoading: verifyCodeLoading }] =
//     useVerifyCodeMutation();
//   const handleVerifyCode = async (data) => {
//     // setValue('credentials', data);
//     // console.log(data);

//     try {
//       // await verifyCode({
//       //   email: route?.params?.email,
//       //   code: data.otp,
//       // }).unwrap();
//       // // console.log('LINE AT 179', response);
      
//       navigation.navigate("AccountSuccess");
//       // }
//     } catch (error) {
//       // handle error
//       // console.log("LINE AT 54", error);

//       // setError("root", {
//       //   type: "registerVerifyCode",
//       //   message: error?.data?.message,
//       // });
//     }
//   };

//   return (
//     <KeyboardAvoidingView
//       style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center" }}
//       behavior={Platform.OS === "ios" ? "padding" : "height"}
//       //   keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
//     >
//       <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
//         <SafeAreaView
//           className="flex-1  justify-center"
//           style={{
//             padding: responsiveWidth(5),
//             gap: responsiveHeight(3),
//           }}
//         >
//           <ScrollView
//             contentContainerStyle={{
//               flexGrow: 1,
//               justifyContent: "center",
//               // alignItems: "center",
//               gap: responsiveHeight(3),
//             }}
//             keyboardShouldPersistTaps="handled"
//             showsVerticalScrollIndicator={false}
//           >
//             <View style={{ gap: responsiveHeight(1) }}>
//               <Text className=" text-2xl text-center font-bold">
//                 VERIFY OTP
//               </Text>
//               <Text className="text-subtext text-xl text-center">
//                 Enter the 4-digit code sent to your email.
//               </Text>
//             </View>

//             <View className="justify-center items-center">
//               <Controller
//                 control={control}
//                 name="otp"
//                 rules={{
//                   required: "Code is required",
//                   minLength: {
//                     value: 4,
//                     message: "Minimum length is 4 digits",
//                   },
//                 }}
//                 render={({
//                   field: { onChange, value },
//                   fieldState: { error },
//                 }) => (
//                   <>
//                     <OTPTextInput
//                       ref={otpRef}
//                       inputCount={4}
//                       handleTextChange={onChange}
//                       defaultValue={value}
//                       tintColor="#d1d5db"
//                       offTintColor="#d1d5db"
//                       textInputStyle={{
//                         borderWidth: 1,
//                         borderColor: "#d1d5db",

//                         width: responsiveWidth(12),
//                         height: responsiveHeight(6),
//                         fontSize: 18,
//                         textAlign: "center",
//                         borderRadius: 8,
//                         // ✅ No 3D shadow
//                         borderBottomWidth: 1,
//                       }}
//                       containerStyle={{
//                         width: responsiveWidth(80),
//                         justifyContent: "center",
//                         gap: 10,
//                       }}
//                     />
//                     {error && (
//                       <Text className="text-red-500 text-xs font-Regular">
//                         {error.message}
//                       </Text>
//                     )}
//                   </>
//                 )}
//               />
//             </View>
//             <Pressable
//               // onPress={handleSubmit(handleVerifyCode)}
//               onPress={(handleVerifyCode)}
//               className={`${
//                 verifyCodeLoading ? "bg-gray-500" : "bg-primary"
//               }  rounded-3xl `}
//               style={{
//                 padding: responsiveWidth(3),
//               }}
//               disabled={verifyCodeLoading}
//             >
//               {verifyCodeLoading ? (
//                 <ActivityIndicator color={"#edbe9c"} size={20} />
//               ) : (
//                 <Text className="text-white text-center font-bold text-lg">
//                   Verify
//                 </Text>
//               )}
//             </Pressable>
//             {errors?.root?.type === "registerVerifyCode" && (
//               <Text className="text-red-500 text-center">
//                 {errors?.root?.message}
//               </Text>
//             )}
//           </ScrollView>
//         </SafeAreaView>
//       </TouchableWithoutFeedback>
//     </KeyboardAvoidingView>
//   );
// };
// export default VerifyCodeScreen;



import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Controller, useFormContext } from "react-hook-form";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVerifyCodeMutation } from "../../redux/slices/authSlice";

const colors = {
  bg: "#02080B",
  textPrimary: "#F3F6F8",
  textSecondary: "#9AA4AE",
  card: "#1D1F24",
  accent: "#14C6E4",
};

const padTime = (v) => `${v}`.padStart(2, "0");

const VerifyCodeScreen = () => {
  const {
    control,
    formState: { errors },
    handleSubmit,
    setError,
  } = useFormContext();
  const navigation = useNavigation();
  const route = useRoute();
  const email = route?.params?.email;
  const inputRef = useRef(null);

  const [secondsLeft, setSecondsLeft] = useState(45);
  const [verifyCode, { isLoading: verifyLoading }] = useVerifyCodeMutation();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleVerify = async (data) => {
    try {
      await verifyCode({
        email,
        otp: data?.otp,
      }).unwrap();
      navigation.navigate("AccountSuccess");
    } catch (error) {
      setError("root", {
        type: "registerVerifyCode",
        message: error?.data?.message || "Invalid verification code.",
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={["#02080B", "#010406"]} style={styles.screen}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={32} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.heroWrap}>
              <View style={styles.iconCard}>
                <ShieldCheck size={42} color={colors.accent} strokeWidth={2.1} />
              </View>
              <Text style={styles.title}>Verify Identity</Text>
              <Text style={styles.subtitle}>
                Enter the 4-digit code sent to your email
              </Text>
            </View>

            <Controller
              control={control}
              name="otp"
              rules={{
                required: "Code is required",
                minLength: {
                  value: 4,
                  message: "Enter the full 4-digit code",
                },
              }}
              render={({ field: { onChange, value = "" } }) => {
                const digits = `${value}`.replace(/\D/g, "").slice(0, 4);
                return (
                  <Pressable onPress={() => inputRef.current?.focus()}>
                    <View style={styles.otpRow}>
                      {[0, 1, 2, 3].map((idx) => {
                        const active = idx === digits.length && digits.length < 4;
                        const hasValue = Boolean(digits[idx]);
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.otpBox,
                              active && styles.otpBoxActive,
                              hasValue && styles.otpBoxFilled,
                            ]}
                          >
                            <Text style={styles.otpText}>
                              {digits[idx] ? digits[idx] : "-"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <TextInput
                      ref={inputRef}
                      value={digits}
                      onChangeText={(text) =>
                        onChange(text.replace(/\D/g, "").slice(0, 4))
                      }
                      keyboardType="number-pad"
                      maxLength={4}
                      style={styles.hiddenInput}
                    />
                  </Pressable>
                );
              }}
            />

            {errors?.otp?.message && (
              <Text style={styles.errorText}>{errors?.otp?.message}</Text>
            )}

            <View style={styles.timerRow}>
              <Clock3 size={28 / 2} color="#A3A9AF" strokeWidth={2.2} />
              <Text style={styles.timerText}>Resend code in</Text>
              <Text style={styles.timerStrong}>00:{padTime(secondsLeft)}</Text>
            </View>

            <Pressable
              onPress={handleSubmit(handleVerify)}
              style={[styles.primaryButton, verifyLoading && styles.buttonDisabled]}
              disabled={verifyLoading}
            >
              {verifyLoading ? (
                <ActivityIndicator color="#EAF9FD" size={20} />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm</Text>
              )}
            </Pressable>

            {errors?.root?.type === "registerVerifyCode" && (
              <Text style={styles.errorTextCenter}>{errors?.root?.message}</Text>
            )}

            <Pressable
              onPress={() => {
                if (secondsLeft === 0) {
                  setSecondsLeft(45);
                }
              }}
              style={styles.bottomHintWrap}
            >
              <Text style={styles.bottomHint}>I didn’t receive a code</Text>
            </Pressable>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
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
  },
  heroWrap: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 24,
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
  otpRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  otpBox: {
    width: 86,
    height: 86,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxActive: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  otpBoxFilled: {
    backgroundColor: "#202227",
  },
  otpText: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "600",
  },
  hiddenInput: {
    opacity: 0,
    width: 1,
    height: 1,
    position: "absolute",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  timerText: {
    color: colors.textSecondary,
    fontSize: 22 / 2,
  },
  timerStrong: {
    color: colors.textPrimary,
    fontSize: 22 / 2,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  primaryButton: {
    marginTop: "auto",
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
  errorText: {
    color: "#FF5D6E",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  errorTextCenter: {
    color: "#FF5D6E",
    textAlign: "center",
    marginTop: 10,
  },
  bottomHintWrap: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  bottomHint: {
    color: colors.textSecondary,
    fontSize: 22 / 2,
  },
});

export default VerifyCodeScreen;
