import { russianAuthError } from "./auth.js";
import { todayMoscow } from "./dates.js";
import { supabase } from "./supabase-config.js";

const CLUB_ENTRY_FIELDS = "user_id, entry_date, warmup_done, mfr_done, workout_done, steps, water_done, sleep_hours";

function clubDataError(error, fallback) {
  const translated = russianAuthError(error, "");
  if (translated) return translated;
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  if (code === "42703" || message.includes("water_done") || message.includes("sleep_hours")) {
    return "В Supabase ещё нет полей воды и сна. Выполните миграцию 20260821_add_water_sleep_to_daily_entries.sql.";
  }
  if (code === "42501" || message.includes("row-level security")) {
    return "Supabase запретил чтение общих данных клуба. Проверьте существующие RLS-политики для memberships, profiles и daily_entries.";
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

  if (membershipError) throw new Error(clubDataError(membershipError, "Не удалось проверить доступ к данным клуба."));
  if (membership?.role !== "participant" || membership?.status !== "active") {
    throw new Error("Общие результаты доступны только действующему участнику клуба.");
  }
  return userResult.user;
}

export async function loadClubData() {
  const user = await requireActiveParticipant();
  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("user_id, approved_at, created_at")
    .eq("role", "participant")
    .eq("status", "active");

  if (membershipsError) throw new Error(clubDataError(membershipsError, "Не удалось загрузить состав клуба."));
  if (!(memberships || []).some((membership) => membership.user_id === user.id)) {
    throw new Error("Текущий участник не найден в действующем составе клуба.");
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const [profilesResult, entriesResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, created_at").in("id", userIds),
    supabase.from("daily_entries").select(CLUB_ENTRY_FIELDS).in("user_id", userIds).lte("entry_date", todayMoscow()).order("entry_date", { ascending: true })
  ]);

  if (profilesResult.error) throw new Error(clubDataError(profilesResult.error, "Не удалось загрузить имена участников."));
  if (entriesResult.error) throw new Error(clubDataError(entriesResult.error, "Не удалось загрузить результаты клуба."));

  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const membershipById = new Map(memberships.map((membership) => [membership.user_id, membership]));
  const activeIds = new Set(userIds);
  const profiles = userIds.map((userId) => {
    const source = profilesById.get(userId);
    const membership = membershipById.get(userId);
    return {
      id: userId,
      displayName: source?.display_name || "Участник клуба",
      avatarDataUrl: null,
      avatarPath: source?.avatar_path || null,
      status: "active",
      joinedAt: String(membership?.approved_at || membership?.created_at || source?.created_at || todayMoscow()).slice(0, 10)
    };
  });
  const dailyEntries = (entriesResult.data || [])
    .filter((entry) => activeIds.has(entry.user_id))
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
