import { russianAuthError } from "./auth.js";
import { todayMoscow } from "./dates.js";
import { supabase } from "./supabase-config.js";

const ENTRY_FIELDS = "user_id, entry_date, warmup_done, mfr_done, workout_done, steps, water_done, sleep_hours";
const ENTRY_PAGE_SIZE = 1000;

function coachDataError(error, fallback) {
  const translated = russianAuthError(error, "");
  if (translated) return translated;
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  if (code === "42703" || message.includes("water_done") || message.includes("sleep_hours")) {
    return "В Supabase ещё нет полей воды и сна. Выполните миграцию 20260821_add_water_sleep_to_daily_entries.sql.";
  }
  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "Supabase запретил тренеру читать результаты участников. Выполните SQL-файл supabase/rls-coach-results.sql.";
  }
  return code ? `${fallback} Код Supabase: ${code}.` : fallback;
}

async function requireActiveCoach() {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error(russianAuthError(userError, "Сеанс завершён. Войдите в аккаунт тренера ещё раз."));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("user_id", userResult.user.id)
    .maybeSingle();

  if (membershipError) throw new Error(coachDataError(membershipError, "Не удалось проверить права тренера."));
  if (membership?.role !== "coach" || membership?.status !== "active") {
    throw new Error("Результаты участников доступны только действующему тренеру клуба.");
  }
}

async function loadAllEntries(userIds) {
  const rows = [];
  for (let from = 0; ; from += ENTRY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("daily_entries")
      .select(ENTRY_FIELDS)
      .in("user_id", userIds)
      .lte("entry_date", todayMoscow())
      .order("entry_date", { ascending: true })
      .order("user_id", { ascending: true })
      .range(from, from + ENTRY_PAGE_SIZE - 1);

    if (error) throw new Error(coachDataError(error, "Не удалось загрузить отметки участников."));
    rows.push(...(data || []));
    if (!data || data.length < ENTRY_PAGE_SIZE) return rows;
  }
}

export async function loadCoachClubData() {
  await requireActiveCoach();

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("user_id, status, approved_at, removed_at, created_at")
    .eq("role", "participant")
    .in("status", ["active", "removed"])
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error(coachDataError(membershipsError, "Не удалось загрузить состав клуба."));
  }
  if (!memberships?.length) return { profiles: [], dailyEntries: [] };

  const userIds = memberships.map((membership) => membership.user_id);
  const [profilesResult, entries] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, created_at").in("id", userIds),
    loadAllEntries(userIds)
  ]);

  if (profilesResult.error) {
    throw new Error(coachDataError(profilesResult.error, "Не удалось загрузить профили участников."));
  }

  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const allowedIds = new Set(userIds);
  const profiles = memberships.map((membership) => {
    const source = profilesById.get(membership.user_id);
    return {
      id: membership.user_id,
      displayName: source?.display_name || "Участник без имени",
      avatarDataUrl: null,
      avatarPath: source?.avatar_path || null,
      status: membership.status,
      joinedAt: String(membership.approved_at || membership.created_at || source?.created_at || todayMoscow()).slice(0, 10),
      removedAt: membership.removed_at,
      authenticatedProfile: true,
      demo: false
    };
  });
  const dailyEntries = entries
    .filter((entry) => allowedIds.has(entry.user_id))
    .map((entry) => ({
      profileId: entry.user_id,
      localDate: entry.entry_date,
      warmup: Boolean(entry.warmup_done),
      mfr: Boolean(entry.mfr_done),
      workout: Boolean(entry.workout_done),
      steps: Number(entry.steps || 0),
      water: Boolean(entry.water_done),
      sleepHours: entry.sleep_hours === null || entry.sleep_hours === undefined ? null : Number(entry.sleep_hours)
    }));

  return { profiles, dailyEntries };
}
