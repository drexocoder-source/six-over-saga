import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Point the Supabase JS client at our own Replit API server.
// The proxy routes /rest, /auth, /functions to our Express API.
const REPLIT_BASE = typeof window !== "undefined" ? window.location.origin : "http://localhost";

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
      },
    },
  }
);
