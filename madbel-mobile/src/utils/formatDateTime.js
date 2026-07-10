const hasTimeZoneSuffix = (value) => /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);

export const parseServerDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = /T\d{2}:\d{2}/.test(text) && !hasTimeZoneSuffix(text) ? `${text}Z` : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatMeetingDateTime = (startValue, endValue) => {
  const start = parseServerDateTime(startValue);
  const end = parseServerDateTime(endValue);
  if (!start || !end) return "-";

  const datePart = start.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const startPart = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endPart = end.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} • ${startPart} - ${endPart}`;
};

export const formatMeetingTime = (value) => {
  const date = parseServerDateTime(value);
  if (!date) return "-";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
