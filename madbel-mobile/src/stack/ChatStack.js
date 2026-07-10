import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AllChatScreen from "../screens/chat/AllChatScreen";
import SingleChatScreen from "../screens/chat/SingleChatScreen";
import MicConversationScreen from "../screens/chat/MicConversationScreen";
import UnifiedConversationsScreen from "../screens/chat/UnifiedConversationsScreen";
import GroupChatScreen from "../screens/community/GroupChatScreen";
import GroupSettingScreen from "../screens/community/GroupSettingScreen";
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
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="GroupSetting" component={GroupSettingScreen} />
      <Stack.Screen name="MicConversation" component={MicConversationScreen} />
    </Stack.Navigator>
  );
};

export default ChatStack;
