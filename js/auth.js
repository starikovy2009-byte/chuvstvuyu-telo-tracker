import { supabase } from "./supabase-config.js";

function appRedirectUrl() {
  return new URL("index.html", document.baseURI).href;
}

function recoveryRedirectUrl() {
  const url = new URL("index.html", document.baseURI);
  url.searchParams.set("recovery", "1");
  return url.href;
}

export function russianAuthError(error, fallback = "Не удалось выполнить действие. Попробуйте ещё раз.") {
  if (!navigator.onLine) return "Нет подключения к интернету. Проверьте сеть и попробуйте ещё раз.";
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Неверный email или пароль.";
  if (message.includes("email not confirmed")) return "Сначала подтвердите email по ссылке из письма.";
  if (message.includes("user already registered")) return "Аккаунт с таким email уже существует. Попробуйте войти.";
  if (message.includes("password") && (message.includes("weak") || message.includes("characters"))) return "Пароль должен содержать не меньше 10 символов.";
  if (message.includes("rate limit") || message.includes("too many")) return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) return "Не удалось связаться с сервером. Проверьте интернет и повторите попытку.";
  return fallback;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(russianAuthError(error));
  return data;
}

export async function signUp(displayName, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: appRedirectUrl()
    }
  });
  if (error) throw new Error(russianAuthError(error));
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: recoveryRedirectUrl() });
  if (error) throw new Error(russianAuthError(error));
}

export async function updateRecoveredPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(russianAuthError(error, "Не удалось сохранить новый пароль. Откройте свежую ссылку из письма и попробуйте снова."));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(russianAuthError(error, "Не удалось завершить сеанс. Обновите страницу и попробуйте ещё раз."));
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(russianAuthError(error, "Не удалось проверить вход."));
  return data.session;
}

export function observeAuth(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    window.setTimeout(() => callback(event, session), 0);
  }).data.subscription;
}

export async function loadAccount(user) {
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_path, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("user_id, role, status, approved_at, removed_at, created_at").eq("user_id", user.id).maybeSingle()
  ]);
  if (profileResult.error) throw new Error(russianAuthError(profileResult.error, "Не удалось загрузить профиль."));
  if (membershipResult.error) throw new Error(russianAuthError(membershipResult.error, "Не удалось проверить членство в клубе."));
  if (!profileResult.data || !membershipResult.data) {
    throw new Error("Профиль ещё не создан полностью. Подождите несколько секунд и нажмите «Проверить ещё раз».");
  }
  return { user, profile: profileResult.data, membership: membershipResult.data };
}

export function clearRecoveryAddress() {
  const clean = new URL(window.location.href);
  clean.hash = "";
  clean.searchParams.delete("type");
  clean.searchParams.delete("code");
  clean.searchParams.delete("recovery");
  window.history.replaceState({}, "", `${clean.pathname}${clean.search}${clean.hash}`);
}
