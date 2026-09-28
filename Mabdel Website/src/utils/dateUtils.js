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

// The pickers in the calendar form work in the same zone the app displays (CST/CDT), not the
// browser's own - otherwise "10:00" typed by someone in Dhaka would show as 22:00 the day before.
const cstWallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CST_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function cstWallClock(ms) {
  const parts = Object.fromEntries(cstWallClockFormatter.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// { date: 'YYYY-MM-DD', time: 'HH:mm' } as it reads on a Chicago wall clock.
export function cstDateParts(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const wall = cstWallClock(date.getTime());
  const pad = (number) => String(number).padStart(2, '0');
  return { date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`, time: `${pad(wall.hour)}:${pad(wall.minute)}` };
}

// The real instant for "YYYY-MM-DD" + "HH:mm" read on a Chicago wall clock (DST-aware).
export function cstWallTimeToDate(dateString, timeString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  const [hour, minute] = String(timeString || '').split(':').map(Number);
  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) return null;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant) => {
    const wall = cstWallClock(instant);
    return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - instant;
  };
  let instant = wallAsUtc - offsetAt(wallAsUtc);
  instant = wallAsUtc - offsetAt(instant);
  return new Date(instant);
}
