import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileHomeScreen from "../screens/profile/ProfileHomeScreen";
import ProfileEditScreenWrapper from "../formWrapper/ProfileEditScreenWrapper";
import ProfileChangePasswordScreenWrapper from "../formWrapper/ProfileChangePasswordScreenWrapper";
import ProfileTermsScreen from "../screens/profile/ProfileTermsScreen";
import ProfilePrivacyScreen from "../screens/profile/ProfilePrivacyScreen";
import ProfileSubscriptionScreen from "../screens/profile/ProfileSubscriptionScreen";
import ProfileAboutScreen from "../screens/profile/ProfileAboutScreen";
import MyEarningsStack from "./MyEarningsStack";
import HostedActivitiesScreen from "../screens/profile/HostedActivitiesScreen";
import HostedEventsScreen from "../screens/profile/HostedEventsScreen";
import ProfileAccountSettingsScreen from "../screens/profile/ProfileAccountSettingsScreen";
import ProfileNotificationScreen from "../screens/profile/ProfileNotificationScreen";
import ProfileBusinessScreen from "../screens/profile/ProfileBusinessScreen";
import ProfileBusinessEditScreen from "../screens/profile/ProfileBusinessEditScreen";
import ProfileSupportScreen from "../screens/profile/ProfileSupportScreen";
import ProfileVoiceHistoryScreen from "../screens/profile/ProfileVoiceHistoryScreen";

const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="ProfileHome"
    >
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreenWrapper} />
      <Stack.Screen
        name="ProfileChangePassword"
        component={ProfileChangePasswordScreenWrapper}
      />
      <Stack.Screen name="ProfileTerms" component={ProfileTermsScreen} />
      <Stack.Screen name="ProfilePrivacy" component={ProfilePrivacyScreen} />
      <Stack.Screen name="ProfileAbout" component={ProfileAboutScreen} />
      <Stack.Screen
        name="ProfileAccountSettings"
        component={ProfileAccountSettingsScreen}
      />
      <Stack.Screen
        name="ProfileNotification"
        component={ProfileNotificationScreen}
      />
      <Stack.Screen name="ProfileBusiness" component={ProfileBusinessScreen} />
      <Stack.Screen
        name="ProfileBusinessEdit"
        component={ProfileBusinessEditScreen}
      />
      <Stack.Screen
        name="ProfileSupport"
        component={ProfileSupportScreen}
        initialParams={{
          conversation: {
            name: "Live Support",
            avatar: "https://robohash.org/support.png",
          },
        }}
      />
      <Stack.Screen
        name="ProfileVoiceHistory"
        component={ProfileVoiceHistoryScreen}
      />

      <Stack.Screen name="ProfileEarnings" component={MyEarningsStack} />
      <Stack.Screen
        name="ProfileHostedActivities"
        component={HostedActivitiesScreen}
      />
      <Stack.Screen
        name="ProfileHostedEvents"
        component={HostedEventsScreen}
      />
      <Stack.Screen
        name="ProfileSubscription"
        component={ProfileSubscriptionScreen}
      />
    </Stack.Navigator>
  );
};

export default HomeStack;
