import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BeginScreen from "../screens/auth/BeginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import AuthStack from "../stack/AuthStack";
import BottomNavigator from "../stack/BottomTabNavigator";
import SubscriptionTrialScreen from "../screens/auth/SubscriptionTrialScreen";
import { useSelector } from "react-redux";
import NotificationScreen from "../screens/NotificaitonsScreen";
import IncomingCallScreen from "../screens/call/IncomingCallScreen";
import ActiveCallScreen from "../screens/call/ActiveCallScreen";
import AiCallScreen from "../screens/call/AiCallScreen";
import * as Notifications from "expo-notifications";
import { useMadbelRegisterPushTokenMutation } from "../redux/slices/madbelApiSlice";

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

  const [trialChecked, setTrialChecked] = useState(false);
  const [showTrial, setShowTrial] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setTrialChecked(false);
      setShowTrial(false);
      return;
    }
    // redux-persist rehydrates authUser before first render, so this is synchronous —
    // no API call, no network dependency, no black screen risk.
    const status = authUser?.subscription_status;
    const trialEndsAt = authUser?.trial_ends_at;
    const hasAccess =
      status === "active" ||
      (status === "trial" &&
        trialEndsAt &&
        new Date(trialEndsAt) > new Date());
    setShowTrial(!hasAccess);
    setTrialChecked(true);
  }, [isAuthenticated]);

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

  // Block navigator mount for one tick until the subscription check useEffect fires.
  // This ensures initialRouteName is correct before the auth stack first renders.
  if (isAuthenticated && !trialChecked) {
    return <View style={{ flex: 1, backgroundColor: "#02080B" }} />;
  }

  const authInitialRoute = showTrial ? "SubscriptionTrial" : "BottomNavigator";

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? authInitialRoute : "Begin"}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="SubscriptionTrial" component={SubscriptionTrialScreen} />
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
