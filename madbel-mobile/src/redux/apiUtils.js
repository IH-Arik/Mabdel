export const API_BASE_URL =
  "https://energize-dyslexic-frisbee.ngrok-free.dev";

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const isFormData = (value) =>
  typeof FormData !== "undefined" && value instanceof FormData;

export const compactObject = (value = {}) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null) return false;
      if (typeof entryValue === "string") return entryValue.trim().length > 0;
      return true;
    }),
  );

const normalizeRequestArg = (arg, pathParams) => {
  if (arg === undefined || arg === null) return {};

  if (!isPlainObject(arg)) {
    if (pathParams.length === 1) return { [pathParams[0]]: arg };
    return { value: arg };
  }

  return arg;
};

const resolvePath = (path, params = {}) =>
  path.replace(/\{([^}]+)\}/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });

const appendFormValue = (formData, key, value) => {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((entry) => appendFormValue(formData, key, entry));
    return;
  }

  if (isPlainObject(value) && value.uri) {
    formData.append(key, {
      uri: value.uri,
      type: value.type || value.mimeType || "application/octet-stream",
      name: value.name || value.fileName || `${key}-${Date.now()}`,
    });
    return;
  }

  if (isPlainObject(value)) {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
};

export const toFormData = (payload) => {
  if (isFormData(payload)) return payload;

  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    appendFormValue(formData, key, value);
  });
  return formData;
};

export const buildApiRequest =
  ({
    path,
    method = "GET",
    pathParams = [],
    queryParams = [],
    hasBody = false,
    multipart = false,
    skipAuth = false,
  }) =>
  (arg) => {
    const rawArg = arg;
    const input = normalizeRequestArg(arg, pathParams);
    const pathValues = { ...input, ...(input.pathParams || {}) };
    const queryValues = compactObject({
      ...(input.query || {}),
      ...(input.params || {}),
    });

    queryParams.forEach((key) => {
      if (input[key] !== undefined) queryValues[key] = input[key];
    });

    const request = {
      url: resolvePath(path, pathValues),
      method,
    };

    const params = compactObject(queryValues);
    if (Object.keys(params).length > 0) {
      request.params = params;
    }

    if (skipAuth) {
      request.headers = { "x-skip-auth": "true" };
    }

    if (hasBody) {
      const explicitBody =
        isFormData(rawArg) || (!isPlainObject(rawArg) && pathParams.length === 0)
          ? rawArg
          : input.body ?? input.payload ?? input.data;
      const reservedKeys = new Set([
        ...pathParams,
        ...queryParams,
        "body",
        "data",
        "params",
        "pathParams",
        "payload",
        "query",
      ]);
      const inferredBody = Object.fromEntries(
        Object.entries(input).filter(([key]) => !reservedKeys.has(key)),
      );
      const body = explicitBody !== undefined ? explicitBody : inferredBody;
      request.body = multipart ? toFormData(body) : body;
    }

    return request;
  };

export const getApiData = (response) => response?.data ?? response;

export const getAuthTokens = (response) => {
  const data = getApiData(response) || {};

  return {
    accessToken:
      data.accessToken || data.access_token || data.token || data.access || null,
    refreshToken:
      data.refreshToken || data.refresh_token || data.refresh || null,
    user: data.user || data.profile || response?.user || null,
  };
};
