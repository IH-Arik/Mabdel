import "./global.css";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import VoiceProvider from "./src/voice/VoiceProvider";
import RootAppNavigator from "./src/root/RootAppNavigator";
import { NavigationContainer } from "@react-navigation/native";
import { store, persistor } from "./src/redux/store";
import { Provider, useDispatch, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { LanguageProvider } from "./src/context/LanguageContext";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { readStoredAuthTokens } from "./src/redux/authStorage";
import { setCredentials } from "./src/redux/reducers/authReducer";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be controlled by a previous reload.
});

// Show notifications as banners even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const linking = {
  prefixes: ["madbel://"],
  config: {
    screens: {
      PublicSigning: "sign/:documentType/:signatureToken",
    },
  },
};

const AuthBootstrapper = ({ onReady }) => {
  const dispatch = useDispatch();
  const persistedUser = useSelector((state) => state?.auth?.user);

  useEffect(() => {
    let isMounted = true;

    const hydrateAuth = async () => {
      try {
        const tokens = await readStoredAuthTokens();
        if (!isMounted) return;

        if (tokens.accessToken || tokens.refreshToken) {
          dispatch(
            setCredentials({
              accessToken: tokens.accessToken || undefined,
              refreshToken: tokens.refreshToken || undefined,
              user: persistedUser || undefined,
            }),
          );
        }
      } finally {
        if (isMounted) {
          onReady();
        }
      }
    };

    hydrateAuth();

    return () => {
      isMounted = false;
    };
  }, [dispatch, onReady, persistedUser]);

  return null;
};

export default function App() {
  const navigationRef = useRef(null);
  const queuedNotification = useRef(null);
  const handledNotification = useRef(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const notificationResponseListener = useRef(null);
  const notificationReceivedListener = useRef(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isPersistReady, setIsPersistReady] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const handleCallNotification = (notification) => {
    const data = notification?.request?.content?.data || {};
    if (data.notification_type !== "incoming_call") return;
    const id = notification.request.identifier;
    if (handledNotification.current === id) return;
    if (!navigationRef.current?.isReady() || !store.getState().auth?.accessToken) {
      queuedNotification.current = notification;
      return;
    }
    handledNotification.current = id;
    queuedNotification.current = null;
    // Backend notifications are call alerts, never proof of a native media leg.
    // The SDK's own active-call stream navigates with nativeCallId when it arrives.
    navigationRef.current.navigate("IncomingCall", {
      callSid: data.call_sid || null, callerNumber: data.caller_number || null,
      callerName: data.caller_name || null,
    });
  };

  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => handleCallNotification(response.notification));
    notificationReceivedListener.current = Notifications.addNotificationReceivedListener(handleCallNotification);
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleCallNotification(response.notification);
    }).catch(() => {});
    return () => {
      notificationResponseListener.current?.remove();
      notificationReceivedListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (isLayoutReady && isPersistReady && isAuthReady) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore hide errors if the splash was already dismissed.
      });
    }
  }, [isLayoutReady, isPersistReady, isAuthReady]);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={() => {
        setIsLayoutReady(true);
      }}
    >
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate
            loading={null}
            persistor={persistor}
            onBeforeLift={() => setIsPersistReady(true)}
          >
            <LanguageProvider>
              <AuthBootstrapper onReady={() => setIsAuthReady(true)} />
              {isAuthReady ? (
                <VoiceProvider navigationRef={navigationRef} navigationReady={navigationReady}>
                <NavigationContainer ref={navigationRef} linking={linking} onReady={() => { setNavigationReady(true); if (queuedNotification.current) handleCallNotification(queuedNotification.current); }}>
                  <RootAppNavigator />
                </NavigationContainer>
                </VoiceProvider>
              ) : null}
            </LanguageProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </View>
  );
}
