import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/bits";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AfScripts" },
      { name: "description", content: "Sign in to AfScripts to sync your library, presets and settings across devices." },
      { property: "og:title", content: "Sign in — AfScripts" },
      { property: "og:description", content: "Sync your AfScripts library, presets and settings across devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error("Your account was created, but sign-in did not complete. Please sign in with your email and password.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success("Signed in — your data will sync");
      navigate({ to: "/settings" });
    } catch (err) {
      toast.error(mode === "up" ? "Sign up failed" : "Sign in failed", { description: (err as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto mt-6 w-full max-w-sm rounded-lg border bg-card p-6">
      <div className="mb-5 flex items-center gap-3"><Logo /><div><h1 className="font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1><p className="text-xs text-muted-foreground">Sync your library, presets and settings.</p></div></div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          </form>
          <Button variant="ghost" disabled={busy} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Create one" : "Already have an account? Sign in"}
          </Button>
    </div>
  );
}
