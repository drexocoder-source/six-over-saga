import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, BookOpen } from "lucide-react";

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
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  }
  async function signUp() {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created — you're in");
  }
  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-5 gradient-card border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-serif text-2xl">The&nbsp;Pavilion</div>
            <div className="kicker text-xs">Sign in to keep your league forever</div>
          </div>
        </div>

        <Button onClick={google} disabled={busy} variant="outline" className="w-full">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 border-t border-border" /> or <div className="flex-1 border-t border-border" />
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3 pt-3">
            <Field id="email-in" label="Email" type="email" value={email} onChange={setEmail} />
            <Field id="pw-in" label="Password" type="password" value={pw} onChange={setPw} />
            <Button onClick={signIn} disabled={busy || !email || !pw} className="w-full gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Sign in
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 pt-3">
            <Field id="email-up" label="Email" type="email" value={email} onChange={setEmail} />
            <Field id="pw-up" label="Password (min 6 chars)" type="password" value={pw} onChange={setPw} />
            <Button onClick={signUp} disabled={busy || !email || pw.length < 6} className="w-full gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Create account
            </Button>
          </TabsContent>
        </Tabs>

        <div className="text-[11px] text-muted-foreground text-center">
          Continuing without signing in? <Link to="/" className="underline">Browse first</Link> — your league will be claimed when you sign in.
        </div>
      </Card>
    </div>
  );
}

function Field({ id, label, value, onChange, type }: { id: string; label: string; value: string; onChange: (v: string) => void; type: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={type === "password" ? "current-password" : "email"} />
    </div>
  );
}
