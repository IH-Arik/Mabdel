import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQueryWithReauth.js";

export const baseApi = createApi({
  reducerPath: "baseApi",
  tagTypes: [
    "GetAllEvents",
    "GetAllActivities",
    "UserProfile",
    "Conversations",
    "Messages",
    "GroupConversations",
    "SearchUsers",
    "MadbelCompatibility",
    "MadbelAuthentication",
    "MadbelAppConfig",
    "MadbelOnboarding",
    "MadbelContent",
    "MadbelAI",
    "MadbelInvoices",
    "MadbelEmail",
    "MadbelCalendar",
    "MadbelGroups",
    "MadbelCalls",
    "MadbelPermissions",
    "MadbelSmartFlow",
    "MadbelHealth",
    "MadbelTwilio",
  ],
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
