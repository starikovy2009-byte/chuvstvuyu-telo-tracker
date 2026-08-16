import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/+esm";

export const SUPABASE_URL = "https://sxkruqqrghunxfydvdfb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e7eJ_U4R0oLEvVQJ_A6wMw_e1bYiCuu";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: window.sessionStorage,
    storageKey: "chuvstvuyu-telo:auth-session"
  },
  global: {
    fetch: (input, init = {}) => window.fetch(input, { ...init, cache: "no-store" })
  }
});
