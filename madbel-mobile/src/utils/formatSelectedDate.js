export const formatSelectedDate = (selectedDate) => {
  if (!selectedDate) return "Select Date";

  // If selectedDate is already a string, return it
  if (typeof selectedDate === "string") {
    return selectedDate;
  }

  // If it's a Date object, format it
  return selectedDate.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
