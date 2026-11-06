"use client";

import React, { useState } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { K12Error, registerSchool, signIn, suggestSubdomain } from "../storage/k12";
import type { K12Session } from "../storage/db";
import { useOnline } from "./util";
import { Wordmark } from "./Wordmark";

type Mode = "signin" | "create";

function AddressField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white focus-within:ring-2 focus-within:ring-[var(--ring)]">
      <Input
        id="subdomain"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="kings"
        autoCapitalize="none"
        autoCorrect="off"
        className="border-0 shadow-none focus-visible:ring-0"
      />
      <span className="pr-3 text-sm text-[var(--text-secondary)]">.pln.ng</span>
    </div>
  );
}

/**
 * One-time sign-in with a ParaLearn school account, or creating one for schools not on
 * ParaLearn yet. Needs internet once; the app works offline after.
 */
export default function SignIn({ onSignedIn }: { onSignedIn: (s: K12Session) => void }) {
  const online = useOnline();
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ subdomain: "", email: "", password: "", schoolName: "", firstName: "", lastName: "", phone: "" });
  const [addressEdited, setAddressEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      [k]: value,
      // Suggest the school's address from its name until the user edits it
      ...(k === "schoolName" && !addressEdited ? { subdomain: suggestSubdomain(value) } : {}),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        onSignedIn(await signIn(form));
      } else {
        const { session, subdomain, changed } = await registerSchool(form);
        toast.success(
          changed
            ? `School account created. That address was taken, so yours is ${subdomain}.pln.ng.`
            : `School account created: ${subdomain}.pln.ng.`
        );
        onSignedIn(session);
      }
    } catch (err) {
      setError(err instanceof K12Error ? err.message : mode === "signin" ? "Couldn't sign in. Please try again." : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="grid min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[var(--violet-ink)] p-12 text-white lg:flex">
        <Wordmark inverted />
        <div className="max-w-md space-y-5">
          <h1 className="text-3xl font-extrabold leading-tight text-white">Report cards from your result sheet, even without internet.</h1>
          <ol className="space-y-3 text-sm text-white/85">
            <li><strong className="text-white">1.</strong> Sign in once, or create a free school account.</li>
            <li><strong className="text-white">2.</strong> Fill in our CSV template, or open your own Excel result sheet. Scores are totalled, graded and ranked on this laptop.</li>
            <li><strong className="text-white">3.</strong> Print the report cards. Scores are backed up to ParaLearn when you&apos;re online.</li>
          </ol>
        </div>
        <p className="text-xs text-white/60">rms.pln.ng · Works offline after the first sign-in</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">{mode === "signin" ? "Sign in with ParaLearn" : "Create a school account"}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {mode === "signin" ? "Use your school's ParaLearn account." : "For schools not on ParaLearn yet. It takes a minute."}
          </p>

          {!online && (
            <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--amber-tint)] px-3 py-2 text-sm text-amber-900">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              You&apos;re offline. Connect once to {mode === "signin" ? "sign in" : "create your account"}; after that this app works without internet.
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "create" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="schoolName">School name</Label>
                  <Input id="schoolName" required value={form.schoolName} onChange={set("schoolName")} placeholder="e.g. Kings College Lagos" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Your first name</Label>
                    <Input id="firstName" required value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" required value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="subdomain">School address</Label>
              <AddressField
                value={form.subdomain}
                onChange={(v) => {
                  setAddressEdited(true);
                  setForm((f) => ({ ...f, subdomain: v }));
                }}
              />
              {mode === "create" && <p className="text-xs text-[var(--text-secondary)]">Your school&apos;s ParaLearn address. You&apos;ll use it to sign in.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={mode === "create" ? 8 : undefined}
                value={form.password}
                onChange={set("password")}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "create" && <p className="text-xs text-[var(--text-secondary)]">At least 8 characters.</p>}
            </div>
            {mode === "create" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-[var(--crimson-signal)]">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || !online}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            {mode === "signin" ? "School not on ParaLearn? " : "Already on ParaLearn? "}
            <button
              type="button"
              className="font-semibold text-[var(--violet-ink)] hover:underline"
              onClick={() => switchMode(mode === "signin" ? "create" : "signin")}
            >
              {mode === "signin" ? "Create a school account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
