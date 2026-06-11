import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MicConversationScreen from "../screens/chat/MicConversationScreen";
import MicListeningScreen from "../screens/chat/MicListeningScreen";

const Stack = createNativeStackNavigator();

const MicStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MicListening">
      <Stack.Screen name="MicListening" component={MicListeningScreen} />
      <Stack.Screen name="MicConversation" component={MicConversationScreen} />
    </Stack.Navigator>
  );
};

export default MicStack;
