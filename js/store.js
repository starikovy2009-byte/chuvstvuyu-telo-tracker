import { createDemoState } from "./seed.js";
import { dailyScore } from "./scoring.js";
import { todayMoscow } from "./dates.js";

export const STORAGE_KEY = "chuvstvuyu-telo:v1";

let state;
const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uuid(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function validateName(value) {
  const name = normalizeName(value);
  if (name.length < 2 || name.length > 60) return "Введите имя длиной от 2 до 60 символов";
  if (!/^[A-Za-zА-Яа-яЁё -]+$/u.test(name)) return "Используйте буквы, пробел или дефис";
  return "";
}

export function validateParticipantFullName(value) {
  const error = validateName(value);
  if (error) return error;
  if (normalizeName(value).split(" ").length < 2) return "Укажите имя и фамилию через пробел";
  return "";
}

export function validateState(candidate) {
  if (!candidate || candidate.version !== 1) throw new Error("Неподдерживаемая версия резервной копии");
  if (!Array.isArray(candidate.profiles) || !Array.isArray(candidate.dailyEntries)) throw new Error("В резервной копии нет списка профилей или записей");
  candidate.profiles.forEach((profile) => {
    if (!profile.id || validateName(profile.displayName)) throw new Error("В резервной копии найден некорректный профиль");
    if (!['active', 'removed'].includes(profile.status)) throw new Error("В резервной копии найден неизвестный статус профиля");
  });
  candidate.dailyEntries.forEach((entry) => {
    if (!entry.profileId || !/^\d{4}-\d{2}-\d{2}$/.test(entry.localDate)) throw new Error("В резервной копии найдена некорректная запись дня");
    if (entry.steps !== null && (!Number.isInteger(Number(entry.steps)) || Number(entry.steps) < 0 || Number(entry.steps) > 200000)) throw new Error("В резервной копии найдено некорректное количество шагов");
  });
  return true;
}

function safeSave() {
  try {
    const storedState = clone(state);
    storedState.session = { mode: "guest", activeProfileId: null };
    storedState.profiles.forEach((profile) => delete profile.role);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  } catch (error) {
    console.error("Не удалось сохранить локальные данные", error);
    throw new Error("Не удалось сохранить данные в этом браузере");
  }
}

function emit() {
  listeners.forEach((listener) => listener(getState()));
}

function commit(mutator) {
  const draft = clone(state);
  mutator(draft);
  validateState(draft);
  state = draft;
  safeSave();
  emit();
  return getState();
}

export function initializeStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      validateState(parsed);
      state = parsed;
    } else {
      state = createDemoState();
      safeSave();
    }
  } catch (error) {
    console.warn("Локальные данные повреждены, загружен демонстрационный набор", error);
    state = createDemoState();
    safeSave();
  }
  state.session = { mode: "guest", activeProfileId: null };
  state.profiles.forEach((profile) => delete profile.role);
  safeSave();
  return getState();
}

export function getState() {
  return clone(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createProfile(displayName, avatarDataUrl = null) {
  const error = validateName(displayName);
  if (error) throw new Error(error);
  const now = new Date().toISOString();
  const joinedAt = todayMoscow();
  const profile = {
    id: uuid("profile"),
    displayName: normalizeName(displayName),
    avatarDataUrl,
    status: "active",
    joinedAt,
    removedAt: null,
    createdAt: now,
    updatedAt: now,
    demo: false
  };
  commit((draft) => {
    draft.profiles.push(profile);
  });
  return profile;
}

export function ensureAuthenticatedProfile(userId, displayName, joinedAt = todayMoscow()) {
  const error = validateName(displayName);
  if (error) throw new Error(error);
  const safeJoinedAt = /^\d{4}-\d{2}-\d{2}$/.test(joinedAt) ? joinedAt : todayMoscow();
  const now = new Date().toISOString();
  commit((draft) => {
    let profile = draft.profiles.find((item) => item.id === userId);
    if (!profile) {
      profile = {
        id: userId,
        displayName: normalizeName(displayName),
        avatarDataUrl: null,
        status: "active",
        joinedAt: safeJoinedAt,
        removedAt: null,
        createdAt: now,
        updatedAt: now,
        demo: false,
        authenticatedProfile: true
      };
      draft.profiles.push(profile);
    } else {
      profile.displayName = normalizeName(displayName);
      profile.status = "active";
      profile.removedAt = null;
      profile.authenticatedProfile = true;
      profile.updatedAt = now;
    }
  });
  return getState().profiles.find((profile) => profile.id === userId);
}

export function updateProfile(profileId, changes) {
  if (changes.displayName !== undefined) {
    const error = validateName(changes.displayName);
    if (error) throw new Error(error);
  }
  return commit((draft) => {
    const profile = draft.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Профиль не найден");
    if (changes.displayName !== undefined) profile.displayName = normalizeName(changes.displayName);
    if (changes.avatarDataUrl !== undefined) profile.avatarDataUrl = changes.avatarDataUrl;
    profile.updatedAt = new Date().toISOString();
  });
}

export function upsertEntry(profileId, localDate, values) {
  const steps = values.steps === "" ? null : Number(values.steps);
  if (steps !== null && (!Number.isInteger(steps) || steps < 0 || steps > 200000)) throw new Error("Введите количество шагов от 0 до 200000");
  const profile = state.profiles.find((item) => item.id === profileId);
  if (!profile || profile.status !== "active") throw new Error("Действующий профиль не найден");
  if (localDate > todayMoscow()) throw new Error("Будущий день нельзя заполнить заранее");
  if (localDate < profile.joinedAt) throw new Error("Эта дата раньше вступления в клуб");
  const now = new Date().toISOString();
  commit((draft) => {
    let entry = draft.dailyEntries.find((item) => item.profileId === profileId && item.localDate === localDate);
    if (!entry) {
      entry = { id: uuid("entry"), profileId, localDate, createdAt: now };
      draft.dailyEntries.push(entry);
    }
    Object.assign(entry, {
      warmup: Boolean(values.warmup),
      mfr: Boolean(values.mfr),
      workout: Boolean(values.workout),
      steps,
      updatedAt: now
    });
    dailyScore(entry);
  });
}

export function removeProfile(profileId) {
  return commit((draft) => {
    const profile = draft.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Профиль не найден");
    profile.status = "removed";
    profile.removedAt = new Date().toISOString();
    profile.updatedAt = profile.removedAt;
    if (draft.session.activeProfileId === profileId) draft.session = { mode: "guest", activeProfileId: null };
  });
}

export function restoreProfile(profileId) {
  return commit((draft) => {
    const profile = draft.profiles.find((item) => item.id === profileId);
    if (!profile) throw new Error("Профиль не найден");
    profile.status = "active";
    profile.removedAt = null;
    profile.updatedAt = new Date().toISOString();
  });
}

export function replaceState(candidate) {
  validateState(candidate);
  state = clone(candidate);
  state.session = { mode: "guest", activeProfileId: null };
  state.profiles.forEach((profile) => delete profile.role);
  safeSave();
  emit();
}

export function resetDemoState() {
  state = createDemoState();
  state.session = { mode: "guest", activeProfileId: null };
  state.profiles.forEach((profile) => delete profile.role);
  safeSave();
  emit();
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}
