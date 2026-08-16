import { russianAuthError } from "./auth.js";
import { supabase } from "./supabase-config.js";

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

  if (membershipError) {
    throw new Error(russianAuthError(membershipError, "Не удалось проверить права тренера."));
  }
  if (membership?.role !== "coach" || membership?.status !== "active") {
    throw new Error("Действие доступно только действующему тренеру клуба.");
  }

  return userResult.user;
}

export async function loadPendingMemberships() {
  await requireActiveCoach();

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("user_id, created_at")
    .eq("role", "participant")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error(russianAuthError(membershipsError, "Не удалось загрузить заявки на вступление."));
  }
  if (!memberships?.length) return [];

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(russianAuthError(profilesError, "Не удалось загрузить имена участников."));
  }

  const namesById = new Map((profiles || []).map((profile) => [profile.id, profile.display_name]));
  return memberships.map((membership) => ({
    userId: membership.user_id,
    displayName: namesById.get(membership.user_id) || "Участник без имени",
    createdAt: membership.created_at
  }));
}

export async function loadParticipantMemberships() {
  await requireActiveCoach();

  const { data: memberships, error: membershipsError } = await supabase
    .from("memberships")
    .select("user_id, status, approved_at, removed_at, created_at")
    .eq("role", "participant")
    .in("status", ["active", "removed"])
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error(russianAuthError(membershipsError, "Не удалось загрузить действующих и удалённых участников."));
  }
  if (!memberships?.length) return [];

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, created_at")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(russianAuthError(profilesError, "Не удалось загрузить профили участников."));
  }

  const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id);
    return {
      userId: membership.user_id,
      displayName: profile?.display_name || "Участник без имени",
      status: membership.status,
      joinedAt: String(membership.approved_at || membership.created_at || profile?.created_at || "").slice(0, 10),
      removedAt: membership.removed_at
    };
  });
}

async function updatePendingMembership(userId, changes, expectedStatus, fallback) {
  await requireActiveCoach();

  const { data, error } = await supabase
    .from("memberships")
    .update(changes)
    .eq("user_id", userId)
    .eq("role", "participant")
    .eq("status", "pending")
    .select("user_id, status, approved_at, removed_at")
    .maybeSingle();

  if (error) throw new Error(russianAuthError(error, fallback));
  if (!data) {
    throw new Error("Заявка уже обработана или у вас больше нет прав на это действие. Обновите список.");
  }
  if (data.status !== expectedStatus) {
    throw new Error("Supabase не подтвердил новый статус заявки. Обновите список и попробуйте ещё раз.");
  }
  return data;
}

export async function approvePendingMembership(userId) {
  const approvedAt = new Date().toISOString();
  const membership = await updatePendingMembership(userId, {
    status: "active",
    approved_at: approvedAt,
    removed_at: null
  }, "active", "Не удалось принять участника в клуб.");
  if (!membership.approved_at || membership.removed_at !== null) {
    throw new Error("Заявка изменилась не полностью. Обновите список и повторите принятие.");
  }
}

export async function rejectPendingMembership(userId) {
  await updatePendingMembership(userId, {
    status: "removed",
    removed_at: new Date().toISOString()
  }, "removed", "Не удалось отклонить заявку.");
}

async function updateExistingParticipant(userId, currentStatus, changes, expectedStatus, fallback) {
  await requireActiveCoach();

  const { data, error } = await supabase
    .from("memberships")
    .update(changes)
    .eq("user_id", userId)
    .eq("role", "participant")
    .eq("status", currentStatus)
    .select("user_id, status, approved_at, removed_at")
    .maybeSingle();

  if (error) throw new Error(russianAuthError(error, fallback));
  if (!data) {
    throw new Error("Статус участника уже изменился или у тренера больше нет прав на это действие. Обновите страницу.");
  }
  if (data.status !== expectedStatus) {
    throw new Error("Supabase не подтвердил новый статус участника. Обновите страницу и попробуйте ещё раз.");
  }
  return data;
}

export async function removeActiveParticipant(userId) {
  const membership = await updateExistingParticipant(userId, "active", {
    status: "removed",
    removed_at: new Date().toISOString()
  }, "removed", "Не удалось удалить участника из клуба.");
  if (!membership.removed_at) {
    throw new Error("Статус изменён не полностью: дата удаления не установлена.");
  }
}

export async function restoreRemovedParticipant(userId) {
  const membership = await updateExistingParticipant(userId, "removed", {
    status: "active",
    approved_at: new Date().toISOString(),
    removed_at: null
  }, "active", "Не удалось вернуть участника в клуб.");
  if (!membership.approved_at || membership.removed_at !== null) {
    throw new Error("Статус изменён не полностью: доступ участника не восстановлен.");
  }
}
