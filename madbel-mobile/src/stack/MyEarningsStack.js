import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import ProfileEarningsScreen from "../screens/profile/ProfileEarningsScreen";
import EventParticipantsScreen from "../screens/profile/EventParticipantsScreen";

const Stack = createNativeStackNavigator();

const MyEarningsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="MyEarningsHome"
    >
      <Stack.Screen name="MyEarningsHome" component={ProfileEarningsScreen} />
      <Stack.Screen name="EventParticipants" component={EventParticipantsScreen} />
    </Stack.Navigator>
  );
};

export default MyEarningsStack;
