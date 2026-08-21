export const MAX_DAILY_SCORE = 6;
export const STEPS_GOAL = 7000;
export const SLEEP_GOAL_HOURS = 7;

export function parseSleepHours(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d{1,2}(?:\.[05])?$/.test(normalized)) return Number.NaN;
  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24 || !Number.isInteger(hours * 2)) {
    return Number.NaN;
  }
  return hours;
}

export function normalizeSleepHours(value) {
  const hours = parseSleepHours(value);
  if (Number.isNaN(hours)) {
    throw new Error("Введите часы сна от 0 до 24 с шагом 0,5, например 7 или 7,5.");
  }
  return hours;
}

export function sleepGoalMet(value) {
  const hours = parseSleepHours(value);
  return Number.isFinite(hours) && hours >= SLEEP_GOAL_HOURS;
}

export function formatSleepHours(value) {
  const hours = parseSleepHours(value);
  if (!Number.isFinite(hours)) return "—";
  return String(hours).replace(".", ",");
}

export function sanitizeSleepInput(value, previousValue = "") {
  const normalized = String(value || "").replace(".", ",");
  if (normalized === "") return "";
  if (!/^\d{1,2}(?:,[05]?)?$/.test(normalized)) return previousValue;
  const completeValue = normalized.endsWith(",") ? normalized.slice(0, -1) : normalized;
  if (completeValue && Number(completeValue.replace(",", ".")) > 24) return previousValue;
  return normalized;
}
