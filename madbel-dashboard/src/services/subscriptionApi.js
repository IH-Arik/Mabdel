import { apiRequest } from "./httpClient";

export const getSubscriptionStatus = () =>
  apiRequest("/subscription/status");

export const startTrial = () =>
  apiRequest("/subscription/start-trial", { method: "POST" });

export const completeOnboarding = () =>
  apiRequest("/subscription/complete-onboarding", { method: "POST" });

export const activateSubscription = () =>
  apiRequest("/subscription/activate", { method: "POST" });
