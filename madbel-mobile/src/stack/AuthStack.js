import { View, Text } from "react-native";
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NewPasswordSuccessScreen from "../screens/auth/NewPasswordSuccessScreen";
import LoginScreenWrapper from "../formWrapper/LoginScreenWrapper";
import RegisterScreenWrapper from "../formWrapper/RegisterScreenWrapper";
import ForgotPasswordVerifyCodeScreenWrapper from "../formWrapper/ForgotPasswordVerifyCodeScreenWrapper";
import NewPasswordScreenWrapper from "../formWrapper/NewPasswordScreenWrapper";
import ForgotPasswordScreenWrapper from "../formWrapper/ForgotPasswordScreenWrapper";
import VerifyCodeScreenWrapper from "../formWrapper/VerifyCodeScreenWrapper";
import AccountSuccessScreen from "../screens/auth/AccountSuccessScreen";
const Stack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreenWrapper} />
      <Stack.Screen name="Register" component={RegisterScreenWrapper} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreenWrapper}
      />
      <Stack.Screen
        name="ForgotPasswordVerifyCode"
        component={ForgotPasswordVerifyCodeScreenWrapper}
      />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreenWrapper} />
      <Stack.Screen name="NewPassword" component={NewPasswordScreenWrapper} />
      <Stack.Screen
        name="NewPasswordSuccess"
        component={NewPasswordSuccessScreen}
      />
      <Stack.Screen name="AccountSuccess" component={AccountSuccessScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
