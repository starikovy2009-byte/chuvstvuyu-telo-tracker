import { russianAuthError } from "./auth.js";
import { compareDates, endOfMonth, parseDate, toDateString, todayMoscow } from "./dates.js";
import { supabase } from "./supabase-config.js";

const ENTRY_FIELDS = "user_id, entry_date, warmup_done, mfr_done, workout_done, steps";

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || toDateString(parseDate(value)) !== value) {
    throw new Error("Указана некорректная дата отметки.");
  }
}

function normalizeSteps(value) {
  const steps = value === "" || value === null || value === undefined ? 0 : Number(value);
  if (!Number.isInteger(steps) || steps < 0 || steps > 200000) {
    throw new Error("Введите количество шагов от 0 до 200000.");
  }
  return steps;
}

function dailyEntryError(error, fallback) {
  const translated = russianAuthError(error, "");
  if (translated) return translated;
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  if (code === "42501" || message.includes("row-level security")) {
    return "Supabase запретил доступ к daily_entries. Проверьте, что существующие RLS-политики разрешают участнику читать, создавать и изменять только свои строки.";
  }
  if (code === "23502" || message.includes("null value")) {
    return "База не заполнила обязательное служебное поле. Проверьте настройки по умолчанию или триггер для id, points и временных меток.";
  }
  if (code === "23505" || message.includes("duplicate key")) {
    return "Запись этого дня уже существует. Нажмите «Попробовать снова», чтобы обновить её.";
  }
  if (code === "PGRST116" || message.includes("multiple (or no) rows")) {
    return "Для выбранного дня найдено несколько записей. Нужна проверка данных daily_entries в Supabase.";
  }
  return code ? `${fallback} Код Supabase: ${code}.` : fallback;
}

async function requireActiveParticipant() {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error(russianAuthError(userError, "Сеанс завершён. Войдите в аккаунт ещё раз."));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", userResult.user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(russianAuthError(membershipError, "Не удалось проверить доступ к дневнику."));
  }
  if (membership?.role !== "participant" || membership?.status !== "active") {
    throw new Error("Сохранять отметки может только действующий участник клуба.");
  }
  return userResult.user;
}

function toClientEntry(row, userId) {
  if (!row || row.user_id !== userId) {
    throw new Error("Supabase вернул запись другого участника. Данные не были использованы.");
  }
  return {
    profileId: userId,
    localDate: row.entry_date,
    warmup: Boolean(row.warmup_done),
    mfr: Boolean(row.mfr_done),
    workout: Boolean(row.workout_done),
    steps: Number(row.steps || 0)
  };
}

async function loadEntryForUser(userId, entryDate) {
  const { data, error } = await supabase
    .from("daily_entries")
    .select(ENTRY_FIELDS)
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .maybeSingle();

  if (error) {
    throw new Error(dailyEntryError(error, "Не удалось перечитать сохранённую отметку."));
  }
  return data ? toClientEntry(data, userId) : null;
}

export async function loadDailyEntriesForMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month) || toDateString(parseDate(`${month}-01`)).slice(0, 7) !== month) {
    throw new Error("Указан некорректный месяц.");
  }
  const user = await requireActiveParticipant();
  const start = `${month}-01`;
  const end = endOfMonth(month);
  const { data, error } = await supabase
    .from("daily_entries")
    .select(ENTRY_FIELDS)
    .eq("user_id", user.id)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  if (error) {
    throw new Error(dailyEntryError(error, "Не удалось загрузить отметки за выбранный месяц."));
  }
  return (data || []).map((row) => toClientEntry(row, user.id));
}

export async function saveDailyEntry(entryDate, values) {
  validateDate(entryDate);
  if (compareDates(entryDate, todayMoscow()) > 0) {
    throw new Error("Будущий день нельзя заполнить заранее.");
  }
  const user = await requireActiveParticipant();
  const payload = {
    user_id: user.id,
    entry_date: entryDate,
    warmup_done: Boolean(values.warmup),
    mfr_done: Boolean(values.mfr),
    workout_done: Boolean(values.workout),
    steps: normalizeSteps(values.steps)
  };

  const existingEntry = await loadEntryForUser(user.id, entryDate);
  const mutableValues = {
    warmup_done: payload.warmup_done,
    mfr_done: payload.mfr_done,
    workout_done: payload.workout_done,
    steps: payload.steps
  };
  let error;
  if (existingEntry) {
    ({ error } = await supabase
      .from("daily_entries")
      .update(mutableValues)
      .eq("user_id", user.id)
      .eq("entry_date", entryDate));
  } else {
    ({ error } = await supabase
      .from("daily_entries")
      .insert(payload));
  }

  if (error) {
    throw new Error(dailyEntryError(error, "Не удалось сохранить отметку дня."));
  }
  const savedEntry = await loadEntryForUser(user.id, entryDate);
  if (!savedEntry) {
    throw new Error("Отметка отправлена, но Supabase не вернул сохранённую запись. Попробуйте ещё раз.");
  }
  return savedEntry;
}
