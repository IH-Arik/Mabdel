import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AllChatScreen from "../screens/chat/AllChatScreen";
import SingleChatScreen from "../screens/chat/SingleChatScreen";
import MicConversationScreen from "../screens/chat/MicConversationScreen";
import UnifiedConversationsScreen from "../screens/chat/UnifiedConversationsScreen";
const Stack = createNativeStackNavigator();

const ChatStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="AllChat"
    >
      <Stack.Screen name="AllChat" component={AllChatScreen} />
      <Stack.Screen name="UnifiedConversations" component={UnifiedConversationsScreen} />
      <Stack.Screen name="SingleChat" component={SingleChatScreen} />
      <Stack.Screen name="MicConversation" component={MicConversationScreen} />
    </Stack.Navigator>
  );
};

export default ChatStack;
