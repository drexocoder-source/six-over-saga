// Auth context — wraps Supabase auth + league-claim flow.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./device";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listener FIRST, then getSession (Supabase pattern)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // On sign-in: claim any device-id league that has no owner yet.
      if (s?.user) {
        // Defer to avoid deadlocks inside the listener
        setTimeout(() => { void claimDeviceLeague(s.user.id); }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        setTimeout(() => { void claimDeviceLeague(data.session!.user.id); }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() { return useContext(Ctx); }

/** If a device-id league exists with no owner, claim it for this user. */
async function claimDeviceLeague(userId: string) {
  const deviceId = getDeviceId();
  // Find any league for this device that has no owner yet.
  const { data: lg } = await supabase
    .from("leagues")
    .select("id, owner_id")
    .eq("device_id", deviceId)
    .is("owner_id", null)
    .maybeSingle();
  if (lg && !lg.owner_id) {
    await supabase.from("leagues").update({ owner_id: userId }).eq("id", lg.id);
  }
}
