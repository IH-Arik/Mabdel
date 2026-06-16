import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/home/HomeScreen";
import CreateActivityScreenWrapper from "../formWrapper/CreateActivityScreenWrapper";

import BulkEmailRecipientsScreen from "../screens/home/BulkEmailRecipientsScreen";
import BulkMessagingScreen from "../screens/home/BulkMessagingScreen";
import InvoiceListScreen from "../screens/invoice/InvoiceListScreen";
import CreateInvoiceScreen from "../screens/invoice/CreateInvoiceScreen";
import InvoiceDetailsScreen from "../screens/invoice/InvoiceDetailsScreen";
import InvoiceViewScreen from "../screens/invoice/InvoiceViewScreen";
import ContactsScreen from "../screens/home/ContactsScreen";
import AddContactScreen from "../screens/home/AddContactScreen";
import ScheduleMeetingScreen from "../screens/home/ScheduleMeetingScreen";
import CreateMeetingScheduleScreen from "../screens/home/CreateMeetingScheduleScreen";
import MeetingDetailsScreen from "../screens/home/MeetingDetailsScreen";
import SocialIntegrationsScreen from "../screens/home/SocialIntegrationsScreen";
import GoogleReviewsScreen from "../screens/home/GoogleReviewsScreen";
import AgreementListScreen from "../screens/agreement/AgreementListScreen";
import AgreementCreateScreen from "../screens/agreement/AgreementCreateScreen";
import AgreementPreviewScreen from "../screens/agreement/AgreementPreviewScreen";
import LeaseListScreen from "../screens/lease/LeaseListScreen";
import NewLeaseScreen from "../screens/lease/NewLeaseScreen";
import LeasePreviewScreen from "../screens/lease/LeasePreviewScreen";
import CreatePostScreen from "../screens/home/CreatePostScreen";
import CallHistoryScreen from "../screens/call/CallHistoryScreen";
import CallAnalysisScreen from "../screens/call/CallAnalysisScreen";

const Stack = createNativeStackNavigator();

const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeActivity"
    >
      <Stack.Screen name="HomeActivity" component={HomeScreen} />

      <Stack.Screen name="BulkEmailRecipients" component={BulkEmailRecipientsScreen} />
      <Stack.Screen name="BulkMessaging" component={BulkMessagingScreen} />
      <Stack.Screen name="InvoiceList" component={InvoiceListScreen} />
      <Stack.Screen name="AgreementList" component={AgreementListScreen} />
      <Stack.Screen name="AgreementCreate" component={AgreementCreateScreen} />
      <Stack.Screen name="AgreementPreview" component={AgreementPreviewScreen} />
      <Stack.Screen name="LeaseList" component={LeaseListScreen} />
      <Stack.Screen name="NewLease" component={NewLeaseScreen} />
      <Stack.Screen name="LeasePreview" component={LeasePreviewScreen} />
      <Stack.Screen name="CreateInvoice" component={CreateInvoiceScreen} />
      <Stack.Screen name="InvoiceDetails" component={InvoiceDetailsScreen} />
      <Stack.Screen name="InvoiceView" component={InvoiceViewScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="AddContact" component={AddContactScreen} />
      <Stack.Screen name="ScheduleMeeting" component={ScheduleMeetingScreen} />
      <Stack.Screen
        name="CreateMeetingSchedule"
        component={CreateMeetingScheduleScreen}
      />
      <Stack.Screen name="MeetingDetails" component={MeetingDetailsScreen} />
      <Stack.Screen
        name="SocialIntegrations"
        component={SocialIntegrationsScreen}
      />
      <Stack.Screen name="GoogleReviews" component={GoogleReviewsScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="CallAnalysis" component={CallAnalysisScreen} />
    </Stack.Navigator>
  );
};

export default HomeStack;
