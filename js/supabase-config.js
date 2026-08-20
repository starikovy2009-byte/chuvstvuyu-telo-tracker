import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm";

export const SUPABASE_URL = "https://sxkruqqrghunxfydvdfb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e7eJ_U4R0oLEvVQJ_A6wMw_e1bYiCuu";
const AUTH_STORAGE_KEY = "chuvstvuyu-telo:auth-session";
const REMEMBER_LOGIN_KEY = "chuvstvuyu-telo:remember-login";

let rememberLogin = window.localStorage.getItem(REMEMBER_LOGIN_KEY) === "1";

const authStorage = {
  getItem(key) {
    const storage = rememberLogin ? window.localStorage : window.sessionStorage;
    return storage.getItem(key);
  },
  setItem(key, value) {
    const storage = rememberLogin ? window.localStorage : window.sessionStorage;
    const otherStorage = rememberLogin ? window.sessionStorage : window.localStorage;
    storage.setItem(key, value);
    otherStorage.removeItem(key);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export function getRememberLogin() {
  return rememberLogin;
}

export function setRememberLogin(value) {
  const nextValue = Boolean(value);
  if (nextValue !== rememberLogin) {
    const source = rememberLogin ? window.localStorage : window.sessionStorage;
    const target = nextValue ? window.localStorage : window.sessionStorage;
    const authKeys = [];
    for (let index = 0; index < source.length; index += 1) {
      const key = source.key(index);
      if (key === AUTH_STORAGE_KEY || key?.startsWith(`${AUTH_STORAGE_KEY}-`)) authKeys.push(key);
    }
    authKeys.forEach((key) => {
      const storedValue = source.getItem(key);
      if (storedValue !== null) target.setItem(key, storedValue);
      source.removeItem(key);
    });
  }
  rememberLogin = nextValue;
  window.localStorage.setItem(REMEMBER_LOGIN_KEY, nextValue ? "1" : "0");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY
  },
  global: {
    fetch: (input, init = {}) => window.fetch(input, { ...init, cache: "no-store" })
  }
});
