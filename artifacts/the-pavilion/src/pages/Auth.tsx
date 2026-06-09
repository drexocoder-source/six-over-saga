import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, BookOpen, Trophy } from "lucide-react";

export default function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  async function signIn() {
    if (!email || !pw) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  }
  async function signUp() {
    if (!email || pw.length < 6) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created — check your email to confirm");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
      {/* Stadium glow backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-accent/10 to-transparent" />
      </div>

      <Card className="w-full max-w-md p-7 space-y-6 gradient-card border-border/60 premium-border relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-primary/15 ring-1 ring-primary/40 mb-2">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <div className="kicker text-primary">Season Pass</div>
          <h1 className="font-serif-display text-4xl text-foreground tracking-tight">The Pavilion</h1>
          <p className="text-xs text-muted-foreground">Sign in to keep your league across devices, forever.</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3 pt-4">
            <Field id="email-in" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field id="pw-in" label="Password" type="password" value={pw} onChange={setPw} autoComplete="current-password" />
            <Button onClick={signIn} disabled={busy || !email || !pw} className="w-full gradient-primary text-primary-foreground font-semibold tracking-wide">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Sign in
            </Button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-[11px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
                Forgot password?
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 pt-4">
            <Field id="email-up" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field id="pw-up" label="Password (min 6 chars)" type="password" value={pw} onChange={setPw} autoComplete="new-password" />
            <Button onClick={signUp} disabled={busy || !email || pw.length < 6} className="w-full gradient-primary text-primary-foreground font-semibold tracking-wide">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Create account
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              We'll email you a confirmation link. After confirming, sign in to claim your league.
            </p>
          </TabsContent>
        </Tabs>

        <div className="rule" />
        <div className="text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
          <BookOpen className="w-3 h-3" />
          <Link to="/" className="hover:text-foreground">Continue without an account</Link>
        </div>
      </Card>
    </div>
  );
}

function Field({ id, label, value, onChange, type, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; type: string; autoComplete: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="bg-input/60" />
    </div>
  );
}
