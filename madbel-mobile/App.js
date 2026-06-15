import "./global.css";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootAppNavigator from "./src/root/RootAppNavigator";
import { NavigationContainer } from "@react-navigation/native";
import { store, persistor } from "./src/redux/store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { LanguageProvider } from "./src/context/LanguageContext";
import * as Notifications from "expo-notifications";

// Show notifications as banners even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const navigationRef = useRef(null);
  const notificationResponseListener = useRef(null);
  const notificationReceivedListener = useRef(null);

  useEffect(() => {
    // Handle a notification tap (app in background/killed).
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data || {};
        if (data.notification_type === "incoming_call" && navigationRef.current) {
          navigationRef.current.navigate("IncomingCall", {
            callSid: data.call_sid || null,
            callerNumber: data.caller_number || null,
            callerName: data.caller_name || null,
          });
        }
      });

    // Handle a notification received while app is in the foreground.
    notificationReceivedListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data || {};
        if (data.notification_type === "incoming_call" && navigationRef.current) {
          navigationRef.current.navigate("IncomingCall", {
            callSid: data.call_sid || null,
            callerNumber: data.caller_number || null,
            callerName: data.caller_name || null,
          });
        }
      });

    return () => {
      notificationResponseListener.current?.remove();
      notificationReceivedListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <LanguageProvider>
            <NavigationContainer ref={navigationRef}>
              <RootAppNavigator />
            </NavigationContainer>
          </LanguageProvider>
        </PersistGate>
      </Provider>
    </SafeAreaProvider>
  );
}
