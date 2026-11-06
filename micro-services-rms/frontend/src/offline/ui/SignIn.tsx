"use client";

import React, { useState } from "react";
import { ArrowRight, CloudUpload, FileSpreadsheet, Loader2, Printer, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { K12Error, registerSchool, signIn, suggestSubdomain } from "../storage/k12";
import type { K12Session } from "../storage/db";
import { useOnline } from "./util";
import { Brand } from "./Brand";
import "./rms-workspace.css";

type Mode = "signin" | "create";

const HEADINGS: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Sign in to ParaLearn Results", subtitle: "Use your school's ParaLearn account. After this, the app works without internet." },
  create: { title: "Create a school account", subtitle: "For schools not on ParaLearn yet. It takes a minute." },
};

/**
 * One-time sign-in with a ParaLearn school account, or creating one for schools not on
 * ParaLearn yet. Laid out like the standalone CBT's sign-in.
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
    <div className="rms-surface">
      <main className="rms-auth">
        <div className="rms-auth-head">
          <Brand />
          <h1>{HEADINGS[mode].title}</h1>
          <p>{HEADINGS[mode].subtitle}</p>
        </div>

        <div className="rms-auth-panel">
          {!online && (
            <p className="rms-notice">
              <WifiOff size={15} />
              You&apos;re offline. Connect once to {mode === "signin" ? "sign in" : "create your account"}; after that this app works without internet.
            </p>
          )}

          <form onSubmit={submit} className="rms-form">
            {mode === "create" && (
              <>
                <label className="rms-field">
                  School name
                  <input id="schoolName" className="rms-input" required value={form.schoolName} onChange={set("schoolName")} placeholder="e.g. Kings College Lagos" />
                </label>
                <div className="rms-form-grid">
                  <label className="rms-field">
                    Your first name
                    <input id="firstName" className="rms-input" required value={form.firstName} onChange={set("firstName")} autoComplete="given-name" />
                  </label>
                  <label className="rms-field">
                    Last name
                    <input id="lastName" className="rms-input" required value={form.lastName} onChange={set("lastName")} autoComplete="family-name" />
                  </label>
                </div>
              </>
            )}
            <label className="rms-field">
              School address
              <span className="rms-affix">
                <input
                  id="subdomain"
                  required
                  value={form.subdomain}
                  onChange={(e) => {
                    setAddressEdited(true);
                    setForm((f) => ({ ...f, subdomain: e.target.value }));
                  }}
                  placeholder="kings"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span>.pln.ng</span>
              </span>
              {mode === "create" && <small>Your school&apos;s ParaLearn address. You&apos;ll use it to sign in.</small>}
            </label>
            <label className="rms-field">
              Email address
              <input id="email" className="rms-input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" placeholder="you@school.com" />
            </label>
            <label className="rms-field">
              Password
              <input
                id="password"
                className="rms-input"
                type="password"
                required
                minLength={mode === "create" ? 8 : undefined}
                value={form.password}
                onChange={set("password")}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "create" && <small>At least 8 characters.</small>}
            </label>
            {mode === "create" && (
              <label className="rms-field">
                Phone <small>Optional</small>
                <input id="phone" className="rms-input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </label>
            )}
            {error && (
              <p role="alert" className="rms-error">
                {error}
              </p>
            )}
            <button type="submit" className="rms-button primary" disabled={busy || !online} style={{ width: "100%", minHeight: 44 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "signin" ? (busy ? "Signing in" : "Sign in") : busy ? "Creating account" : "Create account"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="rms-auth-switch">
            {mode === "signin" ? "School not on ParaLearn? " : "Already on ParaLearn? "}
            <button type="button" className="rms-link" onClick={() => switchMode(mode === "signin" ? "create" : "signin")}>
              {mode === "signin" ? "Create a school account" : "Sign in"}
            </button>
          </p>
        </div>

        <ul className="rms-auth-foot" aria-label="How it works">
          <li>
            <FileSpreadsheet size={14} />
            Open your result sheet
          </li>
          <li>
            <Printer size={14} />
            Print report cards offline
          </li>
          <li>
            <CloudUpload size={14} />
            Scores sync when online
          </li>
        </ul>
      </main>
    </div>
  );
}
