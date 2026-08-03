import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "madbel.auth.accessToken";
const REFRESH_TOKEN_KEY = "madbel.auth.refreshToken";
const LEGACY_ACCESS_TOKEN_KEY = "accessToken";
const LEGACY_REFRESH_TOKEN_KEY = "refreshToken";

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

export const readStoredAuthTokens = async () => {
  const [secureAccessToken, secureRefreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  const secureTokens = {
    accessToken: isNonEmptyString(secureAccessToken)
      ? secureAccessToken.trim()
      : null,
    refreshToken: isNonEmptyString(secureRefreshToken)
      ? secureRefreshToken.trim()
      : null,
  };

  if (secureTokens.accessToken || secureTokens.refreshToken) {
    return secureTokens;
  }

  const [legacyAccessToken, legacyRefreshToken] = await Promise.all([
    AsyncStorage.getItem(LEGACY_ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(LEGACY_REFRESH_TOKEN_KEY),
  ]);

  const migratedTokens = {
    accessToken: isNonEmptyString(legacyAccessToken)
      ? legacyAccessToken.trim()
      : null,
    refreshToken: isNonEmptyString(legacyRefreshToken)
      ? legacyRefreshToken.trim()
      : null,
  };

  if (migratedTokens.accessToken || migratedTokens.refreshToken) {
    await saveStoredAuthTokens(migratedTokens);
    await Promise.all([
      AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY),
      AsyncStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY),
    ]);
  }

  return migratedTokens;
};

export const saveStoredAuthTokens = async ({
  accessToken,
  refreshToken,
} = {}) => {
  const tasks = [];

  if (isNonEmptyString(accessToken)) {
    tasks.push(SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken.trim()));
  }

  if (isNonEmptyString(refreshToken)) {
    tasks.push(SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken.trim()));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};

export const clearStoredAuthTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
};
