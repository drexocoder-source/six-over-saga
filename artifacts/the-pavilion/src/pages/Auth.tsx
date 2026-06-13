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
import { Loader2, Trophy, User, KeyRound, AtSign } from "lucide-react";

function makeEmail(username: string) {
  return `${username.trim().toLowerCase()}@thepavilion.app`;
}

export default function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  const [signInUsername, setSignInUsername] = useState("");
  const [signInPw, setSignInPw] = useState("");

  const [signUpName, setSignUpName] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPw, setSignUpPw] = useState("");

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  async function signIn() {
    if (!signInUsername || !signInPw) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: makeEmail(signInUsername),
      password: signInPw,
    });
    setBusy(false);
    if (error) {
      toast.error("Wrong username or password. Please try again.");
    } else {
      toast.success("Welcome back!");
    }
  }

  async function signUp() {
    const uname = signUpUsername.trim().toLowerCase();
    if (!signUpName || !uname || signUpPw.length < 6) return;
    if (!/^[a-z0-9_]+$/.test(uname)) {
      toast.error("Username can only contain letters, numbers and underscores.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: makeEmail(uname),
      password: signUpPw,
      options: {
        data: { display_name: signUpName.trim(), username: uname },
        emailRedirectTo: undefined,
      },
    });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        toast.error("That username is already taken. Try a different one.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(`Account created! Welcome, ${signUpName.trim()}.`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, action: () => void) {
    if (e.key === "Enter") action();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
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
          <p className="text-xs text-muted-foreground">Create an account to keep your league across devices, forever.</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          {/* ── SIGN IN ── */}
          <TabsContent value="signin" className="space-y-4 pt-5">
            <Field
              id="si-username"
              label="Username"
              icon={<AtSign className="w-4 h-4" />}
              type="text"
              value={signInUsername}
              onChange={setSignInUsername}
              autoComplete="username"
              placeholder="your_username"
              onKeyDown={(e) => handleKeyDown(e, signIn)}
            />
            <Field
              id="si-pw"
              label="Password"
              icon={<KeyRound className="w-4 h-4" />}
              type="password"
              value={signInPw}
              onChange={setSignInPw}
              autoComplete="current-password"
              placeholder="••••••••"
              onKeyDown={(e) => handleKeyDown(e, signIn)}
            />
            <Button
              onClick={signIn}
              disabled={busy || !signInUsername || !signInPw}
              className="w-full gradient-primary text-primary-foreground font-semibold tracking-wide mt-1"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign in
            </Button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-[11px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
                Forgot password?
              </Link>
            </div>
          </TabsContent>

          {/* ── SIGN UP ── */}
          <TabsContent value="signup" className="space-y-4 pt-5">
            <Field
              id="su-name"
              label="Your Name"
              icon={<User className="w-4 h-4" />}
              type="text"
              value={signUpName}
              onChange={setSignUpName}
              autoComplete="name"
              placeholder="e.g. Rohit Sharma"
            />
            <Field
              id="su-username"
              label="Username"
              icon={<AtSign className="w-4 h-4" />}
              type="text"
              value={signUpUsername}
              onChange={(v) => setSignUpUsername(v.replace(/\s/g, "_").toLowerCase())}
              autoComplete="username"
              placeholder="e.g. rohit_ipl"
              hint="Letters, numbers, underscores only"
            />
            <Field
              id="su-pw"
              label="Password"
              icon={<KeyRound className="w-4 h-4" />}
              type="password"
              value={signUpPw}
              onChange={setSignUpPw}
              autoComplete="new-password"
              placeholder="Min 6 characters"
              onKeyDown={(e) => handleKeyDown(e, signUp)}
            />
            <Button
              onClick={signUp}
              disabled={busy || !signUpName || !signUpUsername || signUpPw.length < 6}
              className="w-full gradient-primary text-primary-foreground font-semibold tracking-wide mt-1"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create account
            </Button>
          </TabsContent>
        </Tabs>

        <div className="rule" />
        <div className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1 w-full">
          <Link to="/" className="hover:text-foreground">Continue without an account →</Link>
        </div>
      </Card>
    </div>
  );
}

function Field({
  id, label, icon, value, onChange, type, autoComplete, placeholder, hint, onKeyDown,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon}{label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="bg-input/60"
        onKeyDown={onKeyDown}
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
