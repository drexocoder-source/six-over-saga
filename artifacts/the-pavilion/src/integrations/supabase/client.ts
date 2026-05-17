import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Point the Supabase JS client at our own Replit API server.
// The proxy routes /rest, /auth, /functions to our Express API.
const REPLIT_BASE = typeof window !== "undefined" ? window.location.origin : "http://localhost";

// Retrieve or generate a stable device ID for anonymous league ownership.
function getDeviceId(): string {
  const KEY = "ipl_t2_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const supabase = createClient<Database>(
  REPLIT_BASE,
  "anon",
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "apikey": "anon",
        // Sent on every request so the server can authorize anonymous league mutations.
        "x-device-id": typeof window !== "undefined" ? getDeviceId() : "",
      },
    },
  }
);
