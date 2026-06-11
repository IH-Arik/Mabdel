import "./global.css";
import { StatusBar } from "expo-status-bar";
import { Camera } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootAppNavigator from "./src/root/RootAppNavigator";
import { NavigationContainer } from "@react-navigation/native";
import { FormProvider, useForm } from "react-hook-form";
import { store, persistor } from "./src/redux/store";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

export default function App() {
  // const methods = useForm({
  //   mode: "onChange",
  // });
  return (
    <SafeAreaProvider>
      {/* <FormProvider {...methods}> */}
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <NavigationContainer>
            <RootAppNavigator />
          </NavigationContainer>
        </PersistGate>
      </Provider>
      {/* </FormProvider> */}
    </SafeAreaProvider>
  );
}
