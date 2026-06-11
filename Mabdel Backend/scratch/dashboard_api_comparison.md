# Dashboard & Backend API Mapping Report

## 1. Backend এ Dashboard/Admin এর জন্য কি কি API আছে:
FastAPI ব্যাকএন্ডে টোটাল **৩১টি** অ্যাডমিন/ড্যাশবোর্ড রিলেটেড এপিআই রুট ডিক্লেয়ার করা আছে:

| Method | Backend API Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/admin/admins` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/ai/logs` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/ai/stats` | Admin feature |
| `POST` | `/api/v1/dashboard/admin/auth/forgot-password` | Admin Auth |
| `POST` | `/api/v1/dashboard/admin/auth/reset-password` | Admin Auth |
| `POST` | `/api/v1/dashboard/admin/auth/verify-otp` | Admin Auth |
| `POST` | `/api/v1/dashboard/admin/change-password` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/chats` | Admin Chat Support |
| `GET` | `/api/v1/dashboard/admin/chats/{user_id}/messages` | Admin Chat Support |
| `POST` | `/api/v1/dashboard/admin/chats/{user_id}/messages` | Admin Chat Support |
| `POST` | `/api/v1/dashboard/admin/create-admin` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/earnings` | Earnings & Invoices |
| `GET` | `/api/v1/dashboard/admin/earnings/transactions` | Earnings & Invoices |
| `GET` | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}` | Earnings & Invoices |
| `GET` | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}/invoice` | Earnings & Invoices |
| `POST` | `/api/v1/dashboard/admin/logout` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/profile` | Admin feature |
| `PATCH` | `/api/v1/dashboard/admin/profile` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/profile` | Admin feature |
| `PATCH` | `/api/v1/dashboard/admin/profile` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/reports` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/settings` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/settings/content` | Admin feature |
| `POST` | `/api/v1/dashboard/admin/settings/content` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/subscriptions` | Admin feature |
| `POST` | `/api/v1/dashboard/admin/subscriptions` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/summary` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/users` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/users-growth` | Admin feature |
| `GET` | `/api/v1/dashboard/admin/users/{user_id}` | Admin feature |
| `PATCH` | `/api/v1/dashboard/admin/users/{user_id}/status` | Admin feature |
| `GET` | `/api/v1/dashboard/notifications/` | Admin feature |
| `GET` | `/api/v1/dashboard/notifications/unread-count` | Admin feature |
| `POST` | `/api/v1/dashboard/notifications/{notification_id}/read` | Admin feature |
| `GET` | `/api/v1/dashboard/super/global-growth` | Super Admin feature |
| `GET` | `/api/v1/dashboard/super/platform-summary` | Super Admin feature |
| `POST` | `/api/v1/dashboard/webhooks/stripe` | Admin feature |

## 2. Dashboard (`madbel-dashboard`) এ কি কি API রিকোয়েস্ট ডিক্লেয়ার করা আছে:
ড্যাশবোর্ড ফ্রন্টএন্ডের `services/` ফোল্ডারে বিভিন্ন ফাইল অনুযায়ী মোট এপিআই রিকোয়েস্টের তালিকা এবং ব্যাকএন্ডের সাথে তাদের ম্যাপিং স্ট্যাটাস নিচে দেওয়া হলো:

### 📂 File: `activitiesApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `approveAdminActivity` | `POST` | `/admin/activities/:id/approve` | None | ❌ Missing in Backend |
| `cancelAdminActivity` | `POST` | `/admin/activities/:id/cancel` | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel` | ⚠️ Prefix Mismatch |
| `deleteAdminActivity` | `DELETE` | `/admin/activities/:id` | None | ❌ Missing in Backend |
| `getAdminActivityById` | `GET` | `/admin/activities/:id` | None | ❌ Missing in Backend |
| `listAdminActivities` | `GET` | `/admin/activities` | None | ❌ Missing in Backend |
| `searchAdminActivities` | `GET` | `/admin/activities/search` | None | ❌ Missing in Backend |

### 📂 File: `adminApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `addUserNote` | `POST` | `/admin/users/:id/notes` | None | ❌ Missing in Backend |
| `approveActivity` | `POST` | `/admin/activities/:id/approve` | None | ❌ Missing in Backend |
| `blockUser` | `POST` | `/admin/users/:id/block` | None | ❌ Missing in Backend |
| `blockUser` | `POST` | `/admin/users/:id/ban` | None | ❌ Missing in Backend |
| `cancelActivity` | `POST` | `/admin/activities/:id/cancel` | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel` | ⚠️ Prefix Mismatch |
| `createAdmin` | `POST` | `/admin/create-admin` | `/api/v1/dashboard/admin/create-admin` | ⚠️ Prefix Mismatch |
| `deleteActivity` | `DELETE` | `/admin/activities/:id` | None | ❌ Missing in Backend |
| `getActivityById` | `GET` | `/admin/activities/:id` | None | ❌ Missing in Backend |
| `getAiLogs` | `GET` | `/admin/ai/logs` | `/api/v1/dashboard/admin/ai/logs` | ⚠️ Prefix Mismatch |
| `getAiStats` | `GET` | `/admin/ai/stats` | `/api/v1/dashboard/admin/ai/stats` | ⚠️ Prefix Mismatch |
| `getDashboardAnalytics` | `GET` | `/admin/dashboard/analytics` | None | ❌ Missing in Backend |
| `getDashboardAnalytics` | `GET` | `/dashboard/analytics` | None | ❌ Missing in Backend |
| `getDashboardNotificationPreview` | `GET` | `/admin/dashboard/notifications/preview` | None | ❌ Missing in Backend |
| `getDashboardOverview` | `GET` | `/admin/dashboard/overview` | None | ❌ Missing in Backend |
| `getDashboardOverview` | `GET` | `/dashboard/overview` | None | ❌ Missing in Backend |
| `getMyProfile` | `GET` | `/admin/profile` | `/api/v1/dashboard/admin/profile` | ⚠️ Prefix Mismatch |
| `getMyProfile` | `GET` | `/admin/settings/profile` | None | ❌ Missing in Backend |
| `getSettingsContent` | `GET` | `/admin/settings/content` | `/api/v1/dashboard/admin/settings/content` | ⚠️ Prefix Mismatch |
| `getSettingsSecurity` | `GET` | `/admin/settings/security` | None | ❌ Missing in Backend |
| `getSubscriptionById` | `POST` | `/admin/subscriptions/:id` | None | ❌ Missing in Backend |
| `getSubscriptionFees` | `GET` | `/admin/subscriptions/fees` | None | ❌ Missing in Backend |
| `getSuperGlobalGrowth` | `GET` | `/super/global-growth` | `/api/v1/dashboard/super/global-growth` | ⚠️ Prefix Mismatch |
| `getSuperPlatformSummary` | `GET` | `/super/platform-summary` | `/api/v1/dashboard/super/platform-summary` | ⚠️ Prefix Mismatch |
| `getUnreadNotificationCount` | `GET` | `/admin/notifications/unread-count` | `/api/v1/dashboard/notifications/unread-count` | ⚠️ Prefix Mismatch |
| `getUnreadNotificationCount` | `GET` | `/admin/notifications` | None | ❌ Missing in Backend |
| `getUserById` | `GET` | `/admin/users/:id` | `/api/v1/dashboard/admin/users/{user_id}` | ⚠️ Prefix Mismatch |
| `getUserGrowth` | `GET` | `/admin/users-growth` | `/api/v1/dashboard/admin/users-growth` | ⚠️ Prefix Mismatch |
| `listActivities` | `GET` | `/admin/activities` | None | ❌ Missing in Backend |
| `listAdminNotifications` | `POST` | `/admin/notifications` | None | ❌ Missing in Backend |
| `listAdmins` | `GET` | `/admin/admins` | `/api/v1/dashboard/admin/admins` | ⚠️ Prefix Mismatch |
| `listBlockedUsers` | `GET` | `/admin/users/blocked` | None | ❌ Missing in Backend |
| `listEvents` | `GET` | `/admin/events` | None | ❌ Missing in Backend |
| `listRecentUsers` | `GET` | `/admin/dashboard/recent-users` | None | ❌ Missing in Backend |
| `listSubscriptions` | `GET` | `/admin/subscriptions` | `/api/v1/dashboard/admin/subscriptions` | ⚠️ Prefix Mismatch |
| `listUsers` | `GET` | `/admin/users` | `/api/v1/dashboard/admin/users` | ⚠️ Prefix Mismatch |
| `listUsersSafe` | `GET` | `/admin/users/search` | None | ❌ Missing in Backend |
| `markAllNotificationsRead` | `PATCH` | `/admin/notifications/read-all` | None | ❌ Missing in Backend |
| `markNotificationRead` | `PATCH` | `/admin/notifications/:id/read` | `/api/v1/smartflow/notifications/{notification_id}/read` | ⚠️ Prefix Mismatch |
| `searchActivities` | `DELETE` | `/admin/activities/search` | None | ❌ Missing in Backend |
| `searchSubscriptions` | `POST` | `/admin/subscriptions/search` | None | ❌ Missing in Backend |
| `unblockUser` | `POST` | `/admin/users/:id/unblock` | None | ❌ Missing in Backend |
| `unblockUser` | `POST` | `/admin/users/:id/unban` | None | ❌ Missing in Backend |
| `updateActivityStatus` | `PATCH` | `/admin/activities/:id/status` | `/api/v1/dashboard/admin/users/{user_id}/status` | ⚠️ Prefix Mismatch |
| `updateEventStatus` | `PATCH` | `/admin/events/:id/status` | `/api/v1/dashboard/admin/users/{user_id}/status` | ⚠️ Prefix Mismatch |
| `updateMyProfile` | `PUT` | `/admin/profile` | None | ❌ Missing in Backend |
| `updateMyProfile` | `PUT` | `/admin/settings/profile` | None | ❌ Missing in Backend |
| `updateSettingsContent` | `POST` | `/admin/settings/content` | `/api/v1/dashboard/admin/settings/content` | ⚠️ Prefix Mismatch |
| `updateSettingsSecurity` | `PUT` | `/admin/settings/security` | None | ❌ Missing in Backend |
| `updateSettingsSecurity` | `PUT` | `/admin/password` | None | ❌ Missing in Backend |
| `updateSubscriptionFees` | `PATCH` | `/admin/subscriptions/fees` | None | ❌ Missing in Backend |
| `updateUserStatus` | `GET` | `/admin/users/:id/status` | None | ❌ Missing in Backend |
| `updateUserStatus` | `PATCH` | `/admin/users/:id` | None | ❌ Missing in Backend |
| `updateUserStatus` | `PATCH` | `/admin/users/:id/status` | `/api/v1/dashboard/admin/users/{user_id}/status` | ⚠️ Prefix Mismatch |

### 📂 File: `adsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `createAd` | `POST` | `/admin/ads` | None | ❌ Missing in Backend |
| `createAd` | `POST` | `/ads/admin` | None | ❌ Missing in Backend |
| `deleteAd` | `DELETE` | `/admin/ads/:id` | None | ❌ Missing in Backend |
| `deleteAd` | `DELETE` | `/ads/admin/:id` | None | ❌ Missing in Backend |
| `listAds` | `GET` | `/admin/ads` | None | ❌ Missing in Backend |
| `listAds` | `GET` | `/ads/admin` | None | ❌ Missing in Backend |
| `updateAd` | `PATCH` | `/admin/ads/:id` | None | ❌ Missing in Backend |
| `updateAd` | `PATCH` | `/ads/admin/:id` | None | ❌ Missing in Backend |
| `updateAd` | `PUT` | `/admin/ads/:id` | None | ❌ Missing in Backend |

### 📂 File: `authApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `changeAdminPassword` | `PUT` | `/admin/password` | None | ❌ Missing in Backend |
| `changeAdminPassword` | `PUT` | `/auth/admin/change-password` | None | ❌ Missing in Backend |
| `loginAdmin` | `GET` | `/admin/login` | None | ❌ Missing in Backend |
| `loginAdmin` | `GET` | `/auth/admin/login` | None | ❌ Missing in Backend |
| `loginAdmin` | `GET` | `/api/v1/auth/admin/login` | None | ❌ Missing in Backend |
| `loginAdmin` | `GET` | `/api/v1/auth/login` | `/api/v1/auth/login` | ✅ Matched |
| `loginAdmin` | `GET` | `/auth/login` | `/api/v1/auth/login` | ✅ Matched |
| `logoutAdmin` | `POST` | `/admin/logout` | `/api/v1/dashboard/admin/logout` | ⚠️ Prefix Mismatch |
| `logoutAdmin` | `POST` | `/auth/admin/logout` | `/api/v1/dashboard/admin/logout` | ⚠️ Prefix Mismatch |
| `logoutAdminAllDevices` | `POST` | `/admin/logout-all` | None | ❌ Missing in Backend |
| `logoutAdminAllDevices` | `POST` | `/auth/admin/logout-all` | None | ❌ Missing in Backend |

### 📂 File: `categoriesApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `createCategory` | `POST` | `/admin/categories` | None | ❌ Missing in Backend |
| `deleteCategory` | `DELETE` | `/admin/categories/:id` | None | ❌ Missing in Backend |
| `updateCategory` | `PATCH` | `/admin/categories/:id` | None | ❌ Missing in Backend |

### 📂 File: `chatApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `listThreads` | `GET` | `/admin/chats` | `/api/v1/dashboard/admin/chats` | ⚠️ Prefix Mismatch |

### 📂 File: `cmsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `adminDeletePage` | `DELETE` | `/cms/admin/pages/:slug` | None | ❌ Missing in Backend |
| `adminListPages` | `POST` | `/cms/admin/pages` | None | ❌ Missing in Backend |
| `adminUpdatePage` | `POST` | `/cms/admin/pages/:slug` | None | ❌ Missing in Backend |
| `getAboutUs` | `GET` | `/admin/settings/content` | `/api/v1/dashboard/admin/settings/content` | ⚠️ Prefix Mismatch |
| `getCmsAboutUsPage` | `GET` | `/cms/pages/about-us` | None | ❌ Missing in Backend |
| `getCmsPrivacyPolicyPage` | `GET` | `/cms/pages/privacy-policy` | None | ❌ Missing in Backend |
| `getPageBySlug` | `GET` | `/cms/pages/:slug` | `/api/v1/content/pages/{slug}` | ⚠️ Prefix Mismatch |
| `getTermsOfServicePage` | `GET` | `/cms/pages/terms-of-service` | None | ❌ Missing in Backend |
| `upsertAboutUs` | `POST` | `/admin/settings/content` | `/api/v1/dashboard/admin/settings/content` | ⚠️ Prefix Mismatch |

### 📂 File: `earningsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `generateEarningInvoice` | `POST` | `/admin/earnings/transactions/:id/invoice` | None | ❌ Missing in Backend |
| `getEarningTransactionById` | `GET` | `/admin/earnings/transactions/:id` | `/api/v1/dashboard/admin/earnings/transactions/{trx_id}` | ⚠️ Prefix Mismatch |
| `listEarningTransactions` | `GET` | `/admin/earnings/transactions` | `/api/v1/dashboard/admin/earnings/transactions` | ⚠️ Prefix Mismatch |
| `listEarningTransactions` | `GET` | `/billing/admin/transactions` | None | ❌ Missing in Backend |

### 📂 File: `eventCreatorsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `getEventCreatorById` | `GET` | `/admin/event-creators/:id` | None | ❌ Missing in Backend |
| `getEventCreatorById` | `GET` | `/admin/event-creators/premium/:id` | None | ❌ Missing in Backend |
| `listEventCreators` | `GET` | `/admin/event-creators` | None | ❌ Missing in Backend |
| `listEventCreators` | `GET` | `/admin/event-creators/premium` | None | ❌ Missing in Backend |
| `payoutEventCreator` | `POST` | `/admin/event-creators/:id/payout` | None | ❌ Missing in Backend |

### 📂 File: `notificationsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `getNotificationsPreview` | `GET` | `/admin/notifications` | None | ❌ Missing in Backend |
| `markNotificationsRead` | `POST` | `/admin/notifications/read` | None | ❌ Missing in Backend |

### 📂 File: `reportsApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `applyAdminReportAction` | `POST` | `/admin/reports/:reportId/action` | `/api/v1/calls/{call_sid}/action` | ⚠️ Prefix Mismatch |
| `dismissAdminReport` | `POST` | `/admin/reports/:reportId/dismiss` | None | ❌ Missing in Backend |
| `listAdminReports` | `GET` | `/admin/reports` | `/api/v1/dashboard/admin/reports` | ⚠️ Prefix Mismatch |
| `listAdminReports` | `GET` | `/reports/admin` | None | ❌ Missing in Backend |
| `resolveAdminReport` | `POST` | `/admin/reports/:reportId/resolve` | None | ❌ Missing in Backend |
| `resolveAdminReport` | `PATCH` | `/reports/admin/:reportId/status` | `/api/v1/dashboard/admin/users/{user_id}/status` | ⚠️ Prefix Mismatch |

### 📂 File: `shopApi.js`
| Function Name | Method | Called Path | Matched Backend Route | Status |
| :--- | :--- | :--- | :--- | :--- |
| `addCartItem` | `POST` | `/shop/cart/items` | None | ❌ Missing in Backend |
| `adminCreateProduct` | `POST` | `/shop/admin/products` | None | ❌ Missing in Backend |
| `adminDeleteProduct` | `DELETE` | `/shop/admin/products/:productId` | None | ❌ Missing in Backend |
| `adminListProducts` | `GET` | `/shop/admin/products` | None | ❌ Missing in Backend |
| `adminListProductsTable` | `GET` | `/shop/admin/products/table` | None | ❌ Missing in Backend |
| `adminToggleProductStatus` | `PATCH` | `/shop/admin/products/:productId/status` | `/api/v1/dashboard/admin/users/{user_id}/status` | ⚠️ Prefix Mismatch |
| `adminUpdateProduct` | `PATCH` | `/shop/admin/products/:productId` | None | ❌ Missing in Backend |
| `checkout` | `POST` | `/shop/checkout` | None | ❌ Missing in Backend |
| `createShopProduct` | `POST` | `/shop/products` | None | ❌ Missing in Backend |
| `deleteShopProduct` | `DELETE` | `/shop/products/:id` | None | ❌ Missing in Backend |
| `getCart` | `DELETE` | `/shop/cart` | None | ❌ Missing in Backend |
| `getShopProduct` | `POST` | `/shop/products/:id` | None | ❌ Missing in Backend |
| `listShopProducts` | `GET` | `/shop/products` | None | ❌ Missing in Backend |
| `removeCartItem` | `DELETE` | `/shop/cart/items/:productId` | None | ❌ Missing in Backend |
| `updateCartItem` | `POST` | `/shop/cart/items/:productId` | None | ❌ Missing in Backend |

