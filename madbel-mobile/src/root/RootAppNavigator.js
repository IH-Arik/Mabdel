import React, { useEffect } from "react";
import { Platform } from "react-native";
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
import * as Notifications from "expo-notifications";
import { useMadbelRegisterPushTokenMutation } from "../redux/slices/madbelApiSlice";
import { SafeAreaView } from "react-native-safe-area-context";
import PublicSigningScreen from "../screens/signing/PublicSigningScreen";

const Stack = createNativeStackNavigator();

const RootAppNavigator = () => {
  const accessToken = useSelector(
    (state) => state?.auth?.accessToken || state?.auth?.token,
  );
  
  console.log('LINE AT 22' , accessToken);
  
  const authUser = useSelector((state) => state?.auth?.user);
  const isAuthenticated =
    (typeof accessToken === "string" && accessToken.trim().length > 0) ||
    Boolean(authUser);

  const [registerPushToken] = useMadbelRegisterPushTokenMutation();

  useEffect(() => {
    if (!isAuthenticated) return;

    const registerToken = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        // projectId is required in expo-notifications 0.28+.
        // Use Constants.expoConfig.extra.eas.projectId if available, else skip.
        let projectId;
        try {
          const Constants = require("expo-constants").default;
          projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ||
            Constants?.easConfig?.projectId ||
            Constants?.manifest?.extra?.eas?.projectId;
        } catch (_) {}

        const tokenData = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getDevicePushTokenAsync();

        const token = tokenData?.data;
        if (!token) return;

        await registerPushToken({
          token,
          platform: Platform.OS,
          device_id: `${Platform.OS}-${String(token).slice(-8)}`,
        }).unwrap();
      } catch (err) {
      }
    };

    registerToken();
  }, [isAuthenticated]);




  return (
    // <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>

    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? "BottomNavigator"
        : "Begin"}
    >
      {/* <Stack.Screen name="PublicSigning" component={PublicSigningScreen} /> */}
      {isAuthenticated ? (
        <>
          {/* <Stack.Screen name="SubscriptionTrial" component={SubscriptionTrialScreen} /> */}

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
    // </SafeAreaView>

  );
};

export default RootAppNavigator;
