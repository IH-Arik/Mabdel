import * as LegacyFileSystem from "expo-file-system/legacy";
import { Directory, File, Paths } from "expo-file-system";
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

  const baseDir =
    Paths.cache?.uri ||
    Paths.document?.uri ||
    LegacyFileSystem.cacheDirectory ||
    LegacyFileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error("Local file storage is unavailable.");
  }

  const downloadDir = new Directory(baseDir, "downloads");
  downloadDir.create({ intermediates: true, idempotent: true });

  const targetFile = new File(
    downloadDir,
    `${filePrefix}-${Date.now()}.pdf`
  );
  const result = await File.downloadFileAsync(normalizedUrl, targetFile, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/pdf",
      "ngrok-skip-browser-warning": "true",
    },
  });

  const localUri = result?.uri || targetFile.uri;
  if (!localUri) {
    throw new Error("PDF download did not return a file.");
  }

  return localUri;
};
