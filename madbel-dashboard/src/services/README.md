# Services Coverage (Stone Academy Admin Backend – Admin APIs)

This frontend now includes service functions for the provided admin collection endpoints.

## Auth
- `loginAdmin`
- `logoutAdmin`
- `logoutAdminAllDevices`
- `changeAdminPassword`

## Dashboard + Users + Settings + Notifications
- `getDashboardOverview`
- `getDashboardAnalytics`
- `listRecentUsers`
- `getDashboardNotificationPreview`
- `listUsers`
- `listUsersSafe`
- `searchUsers`
- `listBlockedUsers`
- `getUserById`
- `blockUser`
- `unblockUser`
- `addUserNote`
- `updateUserStatus`
- `listAdminNotifications`
- `markNotificationRead`
- `markAllNotificationsRead`
- `getUnreadNotificationCount`
- `getMyProfile`
- `updateMyProfile`
- `getSettingsProfile`
- `updateSettingsProfile`
- `getSettingsSecurity`
- `updateSettingsSecurity`

## Subscriptions
- `listSubscriptions`
- `getSubscriptionFees`
- `updateSubscriptionFees`
- `getSubscriptionById`
- `searchSubscriptions`

## Earnings
- `listEarningTransactions`
- `getEarningTransactionById`
- `generateEarningInvoice`

## Categories
- `createCategory`
- `listCategories`
- `updateCategory`
- `deleteCategory`

## Ads
- `listAds`
- `createAd`
- `updateAd`
- `deleteAd`
- `updateAdStatus`

## Activities
- `listAdminActivities`
- `getAdminActivityById`
- `approveAdminActivity`
- `cancelAdminActivity`
- `deleteAdminActivity`
- `searchAdminActivities`

## Event Creators
- `listEventCreators`
- `getEventCreatorById`
- `payoutEventCreator`

## Reports
- `listAdminReports`
- `resolveAdminReport`
- `dismissAdminReport`
- `updateAdminReportStatus`

## Admin Chat
- `listThreads`
- `ensureAdminThread`
- `listThreadMessages`
- `sendThreadMessage`
- `markThreadSeen`
