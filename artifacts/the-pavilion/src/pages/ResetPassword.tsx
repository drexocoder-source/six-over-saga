import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically; verify a session exists.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) toast.error("Reset link expired — request a new one");
      setReady(true);
    }, 250);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    if (pw !== pw2) { toast.error("Passwords don't match"); return; }
    if (pw.length < 6) { toast.error("Min 6 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); nav("/", { replace: true }); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-5 gradient-card border-border/60 premium-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-serif-display text-2xl">Set a new password</div>
            <div className="kicker text-xs">Choose something strong</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw1">New password</Label>
            <Input id="pw1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirm</Label>
            <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <Button onClick={save} disabled={busy || !ready || !pw || !pw2} className="w-full gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Update password
          </Button>
        </div>
      </Card>
    </div>
  );
}
