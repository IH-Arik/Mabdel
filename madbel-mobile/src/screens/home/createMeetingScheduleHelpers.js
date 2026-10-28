export const REMINDER_TO_MINUTES = {
  "10 min": 10,
  "30 min": 30,
  "1 hr": 60,
  "2 hr": 120,
  "1 day": 1440,
};

export const mergeDateAndTime = (dateISO, timeValue, useUTC = false) => {
  if (!(timeValue instanceof Date)) return null;
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return null;
  if (useUTC) {
    date.setUTCHours(timeValue.getUTCHours(), timeValue.getUTCMinutes(), 0, 0);
  } else {
    date.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
  }
  return date;
};
