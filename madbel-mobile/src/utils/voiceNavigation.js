const SCREEN_ROUTE_MAP = {
  HomeActivity: { tab: "Home", screen: "HomeActivity" },
  CreateInvoice: { tab: "Home", screen: "CreateInvoice" },
  Invoices: { tab: "Home", screen: "InvoiceList" },
  InvoiceList: { tab: "Home", screen: "InvoiceList" },
  BulkMessaging: { tab: "Home", screen: "BulkMessaging" },
  CreateBulkMessage: { tab: "Home", screen: "BulkMessaging" },
  CreateCalendarEvent: { tab: "Home", screen: "CreateMeetingSchedule" },
  CreateMeetingSchedule: { tab: "Home", screen: "CreateMeetingSchedule" },
  ScheduleMeeting: { tab: "Home", screen: "CreateMeetingSchedule" },
  Calendar: { tab: "Home", screen: "ScheduleMeeting" },
  Contacts: { tab: "Home", screen: "Contacts" },
  AddContact: { tab: "Home", screen: "AddContact" },
  Leases: { tab: "Home", screen: "LeaseList" },
  LeaseList: { tab: "Home", screen: "LeaseList" },
  CreateLease: { tab: "Home", screen: "NewLease" },
  NewLease: { tab: "Home", screen: "NewLease" },
  Agreements: { tab: "Home", screen: "AgreementList" },
  AgreementList: { tab: "Home", screen: "AgreementList" },
  CreateAgreement: { tab: "Home", screen: "AgreementCreate" },
  AgreementCreate: { tab: "Home", screen: "AgreementCreate" },
  AllChat: { tab: "Chat", screen: "AllChat" },
  SingleChat: { tab: "Chat", screen: "SingleChat" },
  GroupsHome: { tab: "Community", screen: "GroupsHome" },
  CreateGroup: { tab: "Community", screen: "CreateGroup" },
  ProfileHome: { tab: "Profile", screen: "ProfileHome" },
  ProfileEdit: { tab: "Profile", screen: "ProfileEdit" },
  ProfileBusiness: { tab: "Profile", screen: "ProfileBusiness" },
  ProfileVoiceHistory: { tab: "Profile", screen: "ProfileVoiceHistory" },
  CallHistory: { tab: "Profile", screen: "ProfileVoiceHistory" },
  MicConversation: { tab: "Shop", screen: "MicConversation" },
};

const PATH_ROUTE_MAP = {
  "": { tab: "Home", screen: "HomeActivity" },
  home: { tab: "Home", screen: "HomeActivity" },
  "home/activity": { tab: "Home", screen: "HomeActivity" },
  invoices: { tab: "Home", screen: "InvoiceList" },
  invoice: { tab: "Home", screen: "InvoiceList" },
  "invoice/list": { tab: "Home", screen: "InvoiceList" },
  "invoices/create": { tab: "Home", screen: "CreateInvoice" },
  "invoice/create": { tab: "Home", screen: "CreateInvoice" },
  "create-invoice": { tab: "Home", screen: "CreateInvoice" },
  "bulk-messages": { tab: "Home", screen: "BulkMessaging" },
  "bulk-message": { tab: "Home", screen: "BulkMessaging" },
  "bulk-messaging": { tab: "Home", screen: "BulkMessaging" },
  "bulk-messages/create": { tab: "Home", screen: "BulkMessaging" },
  calendar: { tab: "Home", screen: "ScheduleMeeting" },
  "calendar/events": { tab: "Home", screen: "ScheduleMeeting" },
  "calendar/events/create": { tab: "Home", screen: "CreateMeetingSchedule" },
  "meetings/create": { tab: "Home", screen: "CreateMeetingSchedule" },
  "schedule-meeting": { tab: "Home", screen: "CreateMeetingSchedule" },
  contacts: { tab: "Home", screen: "Contacts" },
  "contacts/create": { tab: "Home", screen: "AddContact" },
  "add-contact": { tab: "Home", screen: "AddContact" },
  leases: { tab: "Home", screen: "LeaseList" },
  lease: { tab: "Home", screen: "LeaseList" },
  "leases/create": { tab: "Home", screen: "NewLease" },
  "lease/create": { tab: "Home", screen: "NewLease" },
  "create-lease": { tab: "Home", screen: "NewLease" },
  agreements: { tab: "Home", screen: "AgreementList" },
  agreement: { tab: "Home", screen: "AgreementList" },
  "agreements/create": { tab: "Home", screen: "AgreementCreate" },
  "agreement/create": { tab: "Home", screen: "AgreementCreate" },
  "create-agreement": { tab: "Home", screen: "AgreementCreate" },
  chat: { tab: "Chat", screen: "AllChat" },
  conversations: { tab: "Chat", screen: "AllChat" },
  "groups/create": { tab: "Community", screen: "CreateGroup" },
  groups: { tab: "Community", screen: "GroupsHome" },
  profile: { tab: "Profile", screen: "ProfileHome" },
  "profile/edit": { tab: "Profile", screen: "ProfileEdit" },
  "profile/business": { tab: "Profile", screen: "ProfileBusiness" },
  "profile/voice-history": { tab: "Profile", screen: "ProfileVoiceHistory" },
  "voice-history": { tab: "Profile", screen: "ProfileVoiceHistory" },
  calls: { tab: "Profile", screen: "ProfileVoiceHistory" },
  "ai/chat": { tab: "Shop", screen: "MicConversation" },
  chatbot: { tab: "Shop", screen: "MicConversation" },
};

const normalizePath = (path) => {
  if (!path || typeof path !== "string") return "";

  return path
    .replace(/^https?:\/\/[^/]+/i, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/^\/+|\/+$/g, "")
    .replace(/^api\/v\d+\//i, "")
    .replace(/^smartflow\//i, "")
    .toLowerCase();
};

const getRouteFromPath = (path) => {
  const normalizedPath = normalizePath(path);
  if (PATH_ROUTE_MAP[normalizedPath]) return PATH_ROUTE_MAP[normalizedPath];

  const routeName = path
    ?.split("?")[0]
    ?.split("#")[0]
    ?.split("/")
    ?.filter(Boolean)
    ?.pop();

  return SCREEN_ROUTE_MAP[routeName] || null;
};

export const getVoiceRedirectTarget = (voiceResult) => {
  const navigation = voiceResult?.navigation;
  if (!navigation || !navigation.should_redirect) {
    return null;
  }

  const screen = navigation.screen;
  const path = navigation.path;

  // Strict Validation: Screen or path must match SCREEN_ROUTE_MAP or PATH_ROUTE_MAP
  let target = null;
  if (screen && SCREEN_ROUTE_MAP[screen]) {
    target = SCREEN_ROUTE_MAP[screen];
  } else if (path) {
    target = getRouteFromPath(path);
  }

  if (!target) return null;

  return {
    ...target,
    requestedScreen: screen,
    requestedPath: path,
    params: {
      ...(navigation.params || {}),
      prefillPrompt:
        navigation.params?.prefill_prompt ||
        voiceResult?.transcript ||
        voiceResult?.workflow?.prompt,
      prefill: voiceResult?.prefill || voiceResult?.workflowPrefill?.prefill,
      missingFields:
        voiceResult?.missing_fields || voiceResult?.workflowPrefill?.missing_fields,
      voiceResult,
      workflow: voiceResult?.workflow,
      navigationHint: navigation,
    },
  };
};

export const redirectFromVoiceResult = (navigation, voiceResult) => {
  const target = getVoiceRedirectTarget(voiceResult);
  if (!target) return false;

  const parent = navigation.getParent?.();
  const payload = {
    screen: target.screen,
    params: target.params,
  };

  if (parent) {
    parent.navigate(target.tab, payload);
    return true;
  }

  navigation.navigate("BottomNavigator", {
    screen: target.tab,
    params: payload,
  });
  return true;
};
