"use client";

import React, { useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { K12Error, signIn } from "../storage/k12";
import type { K12Session } from "../storage/db";
import { useOnline } from "./util";
import { Wordmark } from "./Wordmark";

/** One-time sign-in with the school's ParaLearn (K12) account; the app works offline after */
export default function SignIn({ onSignedIn }: { onSignedIn: (s: K12Session) => void }) {
  const online = useOnline();
  const [form, setForm] = useState({ subdomain: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSignedIn(await signIn(form));
    } catch (err) {
      setError(err instanceof K12Error ? err.message : "Couldn't sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[var(--violet-ink)] p-12 text-white lg:flex">
        <Wordmark inverted />
        <div className="max-w-md space-y-5">
          <h1 className="text-3xl font-extrabold leading-tight text-white">Report cards from your Excel sheet, even without internet.</h1>
          <ol className="space-y-3 text-sm text-white/85">
            <li><strong className="text-white">1.</strong> Sign in once with your school&apos;s ParaLearn account.</li>
            <li><strong className="text-white">2.</strong> Open the term&apos;s result sheet. Scores are totalled, graded and ranked on this laptop.</li>
            <li><strong className="text-white">3.</strong> Print the report cards. Scores reach ParaLearn when you&apos;re back online.</li>
          </ol>
        </div>
        <p className="text-xs text-white/60">rms.pln.ng · Works offline after the first sign-in</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">Sign in with ParaLearn</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Use the account you use on your school&apos;s ParaLearn portal.</p>

          {!online && (
            <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--amber-tint)] px-3 py-2 text-sm text-amber-900">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              You&apos;re offline. Connect once to sign in; after that this app works without internet.
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subdomain">School address</Label>
              <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white focus-within:ring-2 focus-within:ring-[var(--ring)]">
                <Input
                  id="subdomain"
                  required
                  value={form.subdomain}
                  onChange={set("subdomain")}
                  placeholder="kings"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="border-0 shadow-none focus-visible:ring-0"
                />
                <span className="pr-3 text-sm text-[var(--text-secondary)]">.pln.ng</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={form.password} onChange={set("password")} autoComplete="current-password" />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-[var(--crimson-signal)]">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !online}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
