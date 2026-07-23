import { apiRequest, createPath } from "./httpClient";

export const getAboutUs = async () => {
  const res = await apiRequest("/admin/settings/content", { query: { type: "about-us" } });
  const data = res?.data ?? res ?? "";
  return { content: typeof data === "string" ? data : (data?.content ?? "") };
};

export const upsertAboutUs = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body: { type: "about-us", content: body.content || "" }
  });

export const getPrivacyPolicy = async () => {
  const res = await apiRequest("/admin/settings/content", { query: { type: "privacy-policy" } });
  const data = res?.data ?? res ?? "";
  return { content: typeof data === "string" ? data : (data?.content ?? "") };
};

export const upsertPrivacyPolicy = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body: { type: "privacy-policy", content: body.content || "" }
  });

export const getTermsAndConditions = async () => {
  const res = await apiRequest("/admin/settings/content", { query: { type: "terms-and-conditions" } });
  const data = res?.data ?? res ?? "";
  return { content: typeof data === "string" ? data : (data?.content ?? "") };
};

export const upsertTermsAndConditions = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body: { type: "terms-and-conditions", content: body.content || "" }
  });

export const getSmsMessagingPolicy = async () => {
  const res = await apiRequest("/admin/settings/content", { query: { type: "sms-messaging-policy" } });
  const data = res?.data ?? res ?? "";
  return { content: typeof data === "string" ? data : (data?.content ?? "") };
};

export const upsertSmsMessagingPolicy = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body: { type: "sms-messaging-policy", content: body.content || "" }
  });

export const getAcceptableUsePolicy = async () => {
  const res = await apiRequest("/admin/settings/content", { query: { type: "acceptable-use-policy" } });
  const data = res?.data ?? res ?? "";
  return { content: typeof data === "string" ? data : (data?.content ?? "") };
};

export const upsertAcceptableUsePolicy = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body: { type: "acceptable-use-policy", content: body.content || "" }
  });

export const getPageBySlug = ({ slug }) =>
  apiRequest(createPath("/cms/pages/:slug", { slug }), { auth: false });

export const getTermsOfServicePage = () =>
  apiRequest("/cms/pages/terms-of-service", { auth: false });

export const getCmsPrivacyPolicyPage = () =>
  apiRequest("/cms/pages/privacy-policy", { auth: false });

export const getCmsAboutUsPage = () =>
  apiRequest("/cms/pages/about-us", { auth: false });

export const adminListPages = (query = {}) =>
  apiRequest("/cms/admin/pages", { query });

export const adminCreatePage = (body) =>
  apiRequest("/cms/admin/pages", { method: "POST", body });

export const adminUpdatePage = ({ slug, body }) =>
  apiRequest(createPath("/cms/admin/pages/:slug", { slug }), {
    method: "PATCH",
    body,
  });

export const adminDeletePage = ({ slug }) =>
  apiRequest(createPath("/cms/admin/pages/:slug", { slug }), {
    method: "DELETE",
  });
