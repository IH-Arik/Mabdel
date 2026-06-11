import { createNativeStackNavigator } from "@react-navigation/native-stack";
import GroupsHomeScreen from "../screens/community/GroupsHomeScreen";
import CreateGroupScreen from "../screens/community/CreateGroupScreen";
import GroupSettingScreen from "../screens/community/GroupSettingScreen";
import GroupChatScreen from "../screens/community/GroupChatScreen";
const Stack = createNativeStackNavigator();

const CommunityStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="GroupsHome"
    >
      <Stack.Screen name="GroupsHome" component={GroupsHomeScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="GroupSetting" component={GroupSettingScreen} />
    </Stack.Navigator>
  );
};

export default CommunityStack;
