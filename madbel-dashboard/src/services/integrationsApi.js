import { apiRequest } from "./httpClient";

export const getIntegrationCatalog = () => apiRequest("/smartflow/integrations/catalog");

export const startIntegrationOAuth = (platform) =>
  apiRequest(`/smartflow/integrations/${platform}/oauth/start`);

export const disconnectIntegration = (platform) =>
  apiRequest(`/smartflow/integrations/${platform}`, { method: "DELETE" });
