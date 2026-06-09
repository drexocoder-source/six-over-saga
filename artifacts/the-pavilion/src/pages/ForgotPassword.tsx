import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, BookOpen, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setSent(true); toast.success("Reset link sent — check your inbox"); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-5 gradient-card border-border/60 premium-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-serif-display text-2xl">Reset password</div>
            <div className="kicker text-xs">We'll email you a secure link</div>
          </div>
        </div>

        {sent ? (
          <div className="text-sm text-muted-foreground p-3 rounded-md bg-secondary/50 border border-border">
            ✉️ Check <span className="text-foreground">{email}</span> for a reset link. It expires in 1 hour.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-reset">Email</Label>
              <Input id="email-reset" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <Button onClick={send} disabled={busy || !email} className="w-full gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Send reset link
            </Button>
          </div>
        )}

        <Link to="/auth" className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </Card>
    </div>
  );
}
