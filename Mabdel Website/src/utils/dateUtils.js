// All dates/times across the app are displayed in US Central Time (CST/CDT),
// regardless of the viewer's own browser timezone. 'America/Chicago' is used
// (not a fixed 'CST' offset) so daylight-saving transitions stay correct.
export const CST_TIME_ZONE = 'America/Chicago';

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function formatCstDate(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    timeZone: CST_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatCstTime(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: CST_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

export function formatCstDateTime(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: CST_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

// For date-ONLY values (due_date, issue_date, date_of_birth, etc.) that the
// backend sends as a plain "YYYY-MM-DD" string with no time-of-day meaning.
// JS parses those as UTC midnight, so formatting them in America/Chicago
// (which is behind UTC) would roll the calendar date back by one day for
// every visitor. Format in UTC instead so the date shown always matches
// exactly what was stored, regardless of viewer or server timezone.
export function formatCalendarDate(value, options = {}) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}
