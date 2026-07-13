import { Linking, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { API_BASE_URL } from "../redux/apiUtils";

export const normalizeProtectedFileUrl = (value) => {
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const pathWithQuery = `${parsed.pathname || ""}${parsed.search || ""}`;
      return `${API_BASE_URL}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
    } catch {
      return value;
    }
  }

  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

export const downloadAndOpenProtectedPdf = async ({
  url,
  accessToken,
  filePrefix = "document",
}) => {
  const normalizedUrl = normalizeProtectedFileUrl(url);
  if (!normalizedUrl) {
    throw new Error("PDF URL is unavailable.");
  }
  if (!accessToken) {
    throw new Error("Authentication token is missing.");
  }

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("Local file storage is unavailable.");
  }

  const targetUri = `${baseDir}${filePrefix}-${Date.now()}.pdf`;
  const result = await FileSystem.downloadAsync(normalizedUrl, targetUri, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/pdf",
      "ngrok-skip-browser-warning": "true",
    },
  });

  const localUri = result?.uri || targetUri;
  if (!localUri) {
    throw new Error("PDF download did not return a file.");
  }

  let openUri = localUri;
  if (
    Platform.OS === "android" &&
    typeof FileSystem.getContentUriAsync === "function"
  ) {
    openUri = await FileSystem.getContentUriAsync(localUri);
  }

  await Linking.openURL(openUri);
  return localUri;
};
