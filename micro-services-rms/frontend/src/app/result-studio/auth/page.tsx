"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RmsWordmark } from "@rms/components/ResultStudio/RmsShell";
import { rmsErrorMessage, useLoginMutation, useSignupMutation } from "@rms/store/rmsApi";
import { useRmsHref } from "@rms/lib/rmsPaths";

type Mode = "login" | "signup";

function RmsAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const href = useRmsHref();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ name: "", schoolName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [login, { isLoading: isLoggingIn }] = useLoginMutation();
  const [signup, { isLoading: isSigningUp }] = useSignupMutation();
  const busy = isLoggingIn || isSigningUp;
  const expired = searchParams?.get("expired") === "1";

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = form.email.trim().toLowerCase();
    try {
      if (mode === "login") {
        await login({ email, password: form.password }).unwrap();
      } else {
        if (form.password.length < 8) {
          setError("Use at least 8 characters for the password.");
          return;
        }
        await signup({
          name: form.name.trim(),
          schoolName: form.schoolName.trim(),
          email,
          password: form.password,
        }).unwrap();
        toast.success("School workspace created.");
      }
      router.replace(href("/"));
    } catch (err) {
      setError(
        rmsErrorMessage(err, mode === "login" ? "Couldn't sign in. Check your email and password." : "Couldn't create the account.")
      );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between bg-[var(--violet-ink)] p-12 text-white">
        <RmsWordmark inverted className="text-base" />
        <div className="max-w-md space-y-5">
          <h1 className="text-3xl font-extrabold leading-tight text-white">Upload your result sheet. Get every report card.</h1>
          <ol className="space-y-3 text-sm text-white/85">
            <li><strong className="text-white">1.</strong> Upload the term&apos;s Excel sheet, one tab per class.</li>
            <li><strong className="text-white">2.</strong> We total the scores, grade each subject and rank every student.</li>
            <li><strong className="text-white">3.</strong> Download printable report cards, per student or as a class booklet.</li>
          </ol>
        </div>
        <p className="text-xs text-white/60">rms.pln.ng · ParaLearn Result Management</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <RmsWordmark />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {mode === "login" ? "Sign in to your school" : "Create your school workspace"}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {mode === "login" ? "Welcome back." : "It takes a minute. You can add your logo and motto after."}
          </p>

          {expired && mode === "login" && (
            <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--amber-tint)] px-3 py-2 text-sm text-amber-900">
              Your session ended. Please sign in again.
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="schoolName">School name</Label>
                  <Input id="schoolName" required value={form.schoolName} onChange={set("schoolName")} placeholder="e.g. Kings College Lagos" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" required value={form.name} onChange={set("name")} autoComplete="name" />
                </div>
              </>
            )}
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
                value={form.password}
                onChange={set("password")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-[var(--crimson-signal)]">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            {mode === "login" ? "New school? " : "Already have an account? "}
            <button
              type="button"
              className="font-semibold text-[var(--violet-ink)] hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Create a workspace" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function RmsAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <RmsAuthContent />
    </Suspense>
  );
}
