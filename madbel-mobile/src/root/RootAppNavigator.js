import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BeginScreen from "../screens/auth/BeginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import AuthStack from "../stack/AuthStack";
import BottomNavigator from "../stack/BottomTabNavigator";
import { useSelector } from "react-redux";
import NotificationScreen from "../screens/NotificaitonsScreen";
import IncomingCallScreen from "../screens/call/IncomingCallScreen";
import ActiveCallScreen from "../screens/call/ActiveCallScreen";
import AiCallScreen from "../screens/call/AiCallScreen";

const Stack = createNativeStackNavigator();

const RootAppNavigator = () => {
  const accessToken = useSelector(
    (state) => state?.auth?.accessToken || state?.auth?.token,
  );
  const authUser = useSelector((state) => state?.auth?.user);
  const isAuthenticated =
    (typeof accessToken === "string" && accessToken.trim().length > 0) ||
    Boolean(authUser);

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? "BottomNavigator" : "Begin"}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="BottomNavigator" component={BottomNavigator} />
          <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
          <Stack.Screen name="ActiveCall" component={ActiveCallScreen} />
          <Stack.Screen name="AiCall" component={AiCallScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Begin" component={BeginScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Auth" component={AuthStack} />
        </>
      )}
      {isAuthenticated && (
        <Stack.Screen name="Notification" component={NotificationScreen} />
      )}
    </Stack.Navigator>
  );
};

export default RootAppNavigator;
