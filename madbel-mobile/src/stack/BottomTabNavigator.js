/* eslint-disable react/no-unstable-nested-components */
import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Home,
  Mic,
  UsersRound,
  Settings,
  MessageSquareMore,
} from "lucide-react-native";

import HomeStack from "./HomeStack";
import ChatStack from "./ChatStack";
import CommunityStack from "./CommunityStack";
import ProfileStack from "./ProfileStack";
import MicStack from "./MicStack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppLanguage } from "../context/LanguageContext";

const Tab = createBottomTabNavigator();

const TabIcon = ({ icon: Icon, focused }) => (
  <Icon
    color={focused ? "#17CBE8" : "#5D6A7A"}
    size={23}
    strokeWidth={2.1}
  />
);

const MicTabIcon = ({ focused }) => (
  <View style={[styles.micOuter, focused && styles.micOuterFocused]}>
    {focused ? (
      <>
        <View style={styles.micHaloOuter} />
        <View style={styles.micHaloMiddle} />
        <View style={styles.micHaloInner} />
        <View style={styles.micHaloCore} />
      </>
    ) : null}
    <LinearGradient
      colors={focused ? ["#1AD3EF", "#17BCD9"] : ["#2A3B4F", "#233345"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.micInner, focused && styles.micInnerFocused]}
    >
      <Mic
        color={focused ? "#EAF9FF" : "#A9BED5"}
        size={28}
        strokeWidth={2.6}
      />
    </LinearGradient>
  </View>
);

const BottomNavigator = () => {
  const { t } = useAppLanguage();

  return (
    // <SafeAreaView className="flex-1 bg-[#020406]">

    <View style={styles.root}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarActiveTintColor: "#17CBE8",
          tabBarInactiveTintColor: "#5D6A7A",
          tabBarHideOnKeyboard: true,
          animation: "shift",
          sceneStyle: styles.scene,
          height: 100,
          backgroundColor: "red",
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={({ route }) => {
            const focusedRouteName =
              getFocusedRouteNameFromRoute(route) ?? "HomeActivity";
            const shouldHideTabBar = [
              "BulkEmailRecipients",
              "BulkMessaging",
            ].includes(focusedRouteName);

            return {
              tabBarStyle: shouldHideTabBar
                ? { display: "none" }
                : styles.tabBar,
              tabBarLabel: t("home"),
              tabBarIcon: ({ focused }) => (
                <TabIcon icon={Home} focused={focused} />
              ),
            };
          }}
        />

        <Tab.Screen
          name="Chat"
          component={ChatStack}
          options={{
            tabBarLabel: t("messages"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={ MessageSquareMore } focused={focused} />
            ),
          }}
        />

        <Tab.Screen
          name="Shop"
          component={MicStack}
          options={{
            tabBarLabel: t("ai"),
            tabBarIcon: ({ focused }) => <MicTabIcon focused={focused} />,
          }}
        />

        <Tab.Screen
          name="Community"
          component={CommunityStack}
          options={{
            tabBarLabel: t("groups"),
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={UsersRound} focused={focused} />
            ),
          }}
        />

        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={({ route }) => {
            const focusedRouteName = getFocusedRouteNameFromRoute(route) ?? "ProfileHome";
            const shouldHideTabBar = focusedRouteName !== "ProfileHome";
            return {
              tabBarStyle: shouldHideTabBar ? { display: "none" } : styles.tabBar,
              tabBarLabel: t("settings"),
              tabBarIcon: ({ focused }) => (
                <TabIcon icon={Settings} focused={focused} />
              ),
            };
          }}
        />
      </Tab.Navigator>
    </View>
    // {/* </SafeAreaView> */}

  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020406",
  },
  scene: {
    backgroundColor: "#020406",
  },
  tabBar: {
    height: 84,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: "#132234",
    borderTopWidth: 1,
    borderTopColor: "rgba(95,125,157,0.35)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 20,
  },
  tabLabel: {
    fontSize: 11,
    marginBottom: 0,
    marginTop: -2,
    fontWeight: "500",
  },
  micOuter: {
    marginTop: -29,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F1A2B",
    borderWidth: 5,
    borderColor: "#132234",
    position: "relative",
  },
  micOuterFocused: {
    // Keep focused style deterministic on device GPUs.
    elevation: 0,
  },
  micHaloOuter: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(30, 212, 236, 0.16)",
  },
  micHaloMiddle: {
    position: "absolute",
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(30, 212, 236, 0.2)",
  },
  micHaloInner: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(30, 212, 236, 0.26)",
  },
  micHaloCore: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(30, 212, 236, 0.24)",
  },
  micInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    justifyContent: "center",
    alignItems: "center",
  },
  micInnerFocused: {
    elevation: 0,
  },
});

export default BottomNavigator;
