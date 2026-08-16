const CLUB_TIMEZONE = "Europe/Moscow";

export function todayMoscow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateString, amount) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateString(date);
}

export function addMonths(monthString, amount) {
  const [year, month] = monthString.split("-").map(Number);
  return toDateString(new Date(Date.UTC(year, month - 1 + amount, 1))).slice(0, 7);
}

export function compareDates(left, right) {
  return left.localeCompare(right);
}

export function startOfWeek(dateString) {
  const date = parseDate(dateString);
  const weekday = date.getUTCDay();
  const shift = weekday === 0 ? -6 : 1 - weekday;
  return addDays(dateString, shift);
}

export function endOfWeek(dateString) {
  return addDays(startOfWeek(dateString), 6);
}

export function startOfMonth(monthOrDate) {
  return `${monthOrDate.slice(0, 7)}-01`;
}

export function endOfMonth(monthOrDate) {
  const month = monthOrDate.slice(0, 7);
  return addDays(`${addMonths(month, 1)}-01`, -1);
}

export function daysBetween(start, end) {
  const output = [];
  for (let cursor = start; compareDates(cursor, end) <= 0; cursor = addDays(cursor, 1)) {
    output.push(cursor);
  }
  return output;
}

export function diffDays(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 86400000);
}

export function monthGrid(monthString) {
  const first = `${monthString}-01`;
  const firstWeekday = parseDate(first).getUTCDay();
  const leading = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const monthEnd = endOfMonth(monthString);
  const dates = Array.from({ length: leading }, () => null);
  dates.push(...daysBetween(first, monthEnd));
  while (dates.length % 7 !== 0) dates.push(null);
  return dates;
}

export function formatDate(dateString, options = {}) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: options.year ? "numeric" : undefined,
    weekday: options.weekday ? "long" : undefined
  }).format(parseDate(dateString));
}

export function formatMonth(monthString) {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  }).format(parseDate(`${monthString}-01`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function clampDate(dateString, minimum, maximum) {
  if (compareDates(dateString, minimum) < 0) return minimum;
  if (compareDates(dateString, maximum) > 0) return maximum;
  return dateString;
}

export { CLUB_TIMEZONE };
