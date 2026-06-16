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

export const changeAdminPassword = async ({ currentPassword, newPassword }) => {
  const body = { currentPassword, newPassword };
  for (const method of ["POST", "PUT"]) {
    try {
      return await apiRequestWithFallback(
        ["/admin/password", "/auth/admin/change-password"],
        { method, body }
      );
    } catch (error) {
      if (error?.status !== 405 && error?.status !== 404) throw error;
    }
  }
  throw new Error("Change password failed.");
};

export const logoutAdmin = () =>
  apiRequestWithFallback(["/admin/logout", "/auth/admin/logout"], {
    method: "POST",
  }).catch((error) => {
    if (error?.status === 405 || error?.status === 404) {
      return apiRequestWithFallback(["/admin/logout", "/auth/admin/logout"], {
        method: "PUT",
      });
    }
    throw error;
  });

export const logoutAdminAllDevices = () =>
  apiRequestWithFallback(["/admin/logout-all", "/auth/admin/logout-all"], {
    method: "POST",
  });

export const forgotPassword = ({ email }) =>
  apiRequest("/auth/admin/forgot-password", {
    method: "POST",
    auth: false,
    body: { email },
  });

export const verifyOtp = ({ email, otp }) =>
  apiRequest("/auth/admin/verify-otp", {
    method: "POST",
    auth: false,
    body: { email, otp },
  });

export const resetPassword = ({ email, otp, newPassword }) =>
  apiRequest("/auth/admin/reset-password", {
    method: "POST",
    auth: false,
    body: { email, otp, newPassword },
  });
