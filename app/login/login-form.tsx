"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ confirmationError }: { confirmationError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(confirmationError ?? "");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const credentials = { email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") };
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
      }
      // Recheck the new cookie and room on the server.
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>{mode === "signin" ? "Sign in" : "Create an account"}</h2>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required disabled={pending} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 6 : undefined} required disabled={pending} />
        {error && <p className="error" role="alert">{error} Please try again.</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button type="submit" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? (mode === "signin" ? "Signing in…" : "Creating account…") : (mode === "signin" ? "Sign in" : "Sign up")}
        </button>
      </form>
      <button className="secondary" type="button" disabled={pending} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>
        {mode === "signin" ? "Create an account" : "Back to sign in"}
      </button>
    </section>
  );
}
