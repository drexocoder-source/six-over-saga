import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Point at our own Express API which mimics PostgREST / Supabase Auth.
// Falls back to window.location.origin so it works in dev and production.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080");

const SUPABASE_PUBLISHABLE_KEY = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
) || "anon";

function getDeviceId(): string {
  const KEY = "ipl_t2_device_id";
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
  db: { schema: "public" },
  global: {
    headers: {
      "x-device-id": getDeviceId(),
    },
  },
});
