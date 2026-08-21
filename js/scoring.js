import { addDays, compareDates, diffDays, startOfWeek, todayMoscow } from "./dates.js";
import { sleepGoalMet, STEPS_GOAL } from "./daily-entry-values.js";

export function dailyScore(entry) {
  if (!entry) return 0;
  return Number(Boolean(entry.warmup))
    + Number(Boolean(entry.mfr))
    + Number(Boolean(entry.workout))
    + Number(Number(entry.steps || 0) >= STEPS_GOAL)
    + Number(Boolean(entry.water))
    + Number(sleepGoalMet(entry.sleepHours));
}

export function entriesForProfile(entries, profileId) {
  return entries.filter((entry) => entry.profileId === profileId);
}

export function entriesInPeriod(entries, profileId, start, end) {
  return entries.filter((entry) => entry.profileId === profileId
    && compareDates(entry.localDate, start) >= 0
    && compareDates(entry.localDate, end) <= 0);
}

export function totalScore(entries) {
  return entries.reduce((sum, entry) => sum + dailyScore(entry), 0);
}

export function profileScore(entries, profileId, start = "0000-01-01", end = "9999-12-31") {
  return totalScore(entriesInPeriod(entries, profileId, start, end));
}

export function activeDays(entries, profileId) {
  return entriesForProfile(entries, profileId).filter((entry) => dailyScore(entry) > 0).length;
}

export function currentStreak(entries, profileId, today = todayMoscow()) {
  const completed = new Set(entriesForProfile(entries, profileId)
    .filter((entry) => dailyScore(entry) > 0)
    .map((entry) => entry.localDate));
  let cursor = completed.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function latestEntry(entries, profileId) {
  return entriesForProfile(entries, profileId)
    .slice()
    .sort((a, b) => b.localDate.localeCompare(a.localDate))[0] || null;
}

export function practiceStats(entries, profileId) {
  const own = entriesForProfile(entries, profileId);
  return {
    totalEntries: own.length,
    warmup: own.filter((entry) => entry.warmup).length,
    mfr: own.filter((entry) => entry.mfr).length,
    workout: own.filter((entry) => entry.workout).length,
    steps: own.filter((entry) => Number(entry.steps || 0) >= STEPS_GOAL).length,
    water: own.filter((entry) => entry.water).length,
    sleep: own.filter((entry) => sleepGoalMet(entry.sleepHours)).length
  };
}

export function membershipDays(joinedAt, today = todayMoscow()) {
  return Math.max(1, diffDays(joinedAt, today) + 1);
}

export function bestDailyScore(entries, profileId) {
  return Math.max(0, ...entriesForProfile(entries, profileId).map(dailyScore));
}

export function currentWeekRange(today = todayMoscow()) {
  const start = startOfWeek(today);
  return { start, end: addDays(start, 6) };
}
