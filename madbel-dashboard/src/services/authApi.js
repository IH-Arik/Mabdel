import {
  apiRequest,
  apiRequestWithFallback,
  extractApiErrorMessage,
} from "./httpClient";

export const loginAdmin = async ({ email, password }) => {
  const endpointCandidates = [
    "/admin/login",
    "/auth/admin/login",
    "/api/v1/auth/admin/login",
    "/api/v1/auth/login",
    "/auth/login",
  ];
  const bodyCandidates = [
    { email, password, deviceId: "admin-console-web" },
    { email, password },
    { identifier: email, password },
    { username: email, password },
  ];

  let lastErrorMessage = "Login failed. Please try again.";

  for (const endpoint of endpointCandidates) {
    for (const body of bodyCandidates) {
      try {
        return await apiRequest(endpoint, {
          method: "POST",
          auth: false,
          body,
        });
      } catch (error) {
        const payloadMessage = extractApiErrorMessage(error?.payload);
        if (payloadMessage) lastErrorMessage = payloadMessage;

        if (error?.status !== 404 && error?.status !== 400) {
          throw error;
        }
      }
    }
  }

  throw new Error(lastErrorMessage);
};

export const changeAdminPassword = ({ currentPassword, newPassword }) => {
  return apiRequestWithFallback(["/admin/password", "/auth/admin/change-password"], {
    method: "PUT",
    body: { currentPassword, newPassword },
  });
};

export const logoutAdmin = () =>
  apiRequestWithFallback(["/admin/logout", "/auth/admin/logout"], {
    method: "POST",
  });

export const logoutAdminAllDevices = () =>
  apiRequestWithFallback(["/admin/logout-all", "/auth/admin/logout-all"], {
    method: "POST",
  });
