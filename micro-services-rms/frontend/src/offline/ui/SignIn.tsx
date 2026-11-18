"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CloudUpload, Eye, EyeOff, FileSpreadsheet, Loader2, Printer, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { K12Error, registerSchool, signIn, suggestSubdomain } from "../storage/k12";
import type { K12Session } from "../storage/db";
import { useOnline } from "./util";
import { Brand } from "./Brand";
import "./rms-workspace.css";
import "./rms-landing.css";

type Mode = "signin" | "create";

const HEADINGS: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Sign in to ParaLearn Results", subtitle: "Use your school's ParaLearn account. After this, the app works without internet." },
  create: { title: "Create a school account", subtitle: "For schools not on ParaLearn yet. It takes a minute." },
};

/**
 * One-time sign-in with a ParaLearn school account, or creating one for schools not on
 * ParaLearn yet. Laid out like the standalone CBT's sign-in.
 */
export default function SignIn({
  onSignedIn,
  initialMode = "signin",
  onBack,
}: {
  onSignedIn: (s: K12Session) => void;
  /** Which tab to open on: the landing page links straight to "create" */
  initialMode?: Mode;
  /** Back to the landing page; absent when signing in again to send scores, or in the installed app */
  onBack?: () => void;
}) {
  const online = useOnline();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ subdomain: "", email: "", password: "", schoolName: "", firstName: "", lastName: "", phone: "" });
  const [addressEdited, setAddressEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="rms-surface rms-signin">
      <div className="rms-signin-top">
        <Brand />
        {onBack && (
          <button type="button" className="rms-signin-back" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden />
            Back
          </button>
        )}
      </div>

      <main className="rms-signin-card">
        <div className="rms-signin-tabs" role="tablist" aria-label="Account">
          {(["signin", "create"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`rms-tab-${m}`}
              aria-selected={mode === m}
              aria-controls="rms-signin-panel"
              onClick={() => switchMode(m)}
            >
              {m === "signin" ? "Sign in" : "Create school account"}
            </button>
          ))}
        </div>

        <div className="rms-signin-body" role="tabpanel" id="rms-signin-panel" aria-labelledby={`rms-tab-${mode}`}>
          <h1>{HEADINGS[mode].title}</h1>
          <p>{HEADINGS[mode].subtitle}</p>

          {!online && (
            <p className="rms-notice">
              <WifiOff size={15} aria-hidden />
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
              School&apos;s ParaLearn address
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
              <small>{mode === "create" ? "Your school's web address on ParaLearn. You'll use it to sign in." : "The first part of your school's ParaLearn web address, e.g. kings for kings.pln.ng."}</small>
            </label>
            <label className="rms-field">
              Email address
              <input id="email" className="rms-input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" placeholder="you@school.com" />
            </label>
            <label className="rms-field">
              Password
              <span className="rms-affix">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "create" ? 8 : undefined}
                value={form.password}
                onChange={set("password")}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="rms-signin-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
              </button>
              </span>
              {mode === "create" && <small>At least 8 characters.</small>}
            </label>
            {mode === "create" && (
              <label className="rms-field">
                <span>
                  Phone <small>(optional)</small>
                </span>
                <input id="phone" className="rms-input" type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </label>
            )}
            {error && (
              <p role="alert" className="rms-error">
                <AlertCircle size={15} aria-hidden />
                {error}
              </p>
            )}
            <button type="submit" className="rms-button primary" disabled={busy || !online} style={{ width: "100%", minHeight: 46 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "signin" ? (busy ? "Signing in" : "Sign in") : busy ? "Creating account" : "Create account"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

      </main>

      <ul className="rms-signin-steps" aria-label="How it works">
        <li>
          <FileSpreadsheet size={14} aria-hidden />
          Open your result sheet
        </li>
        <li>
          <Printer size={14} aria-hidden />
          Print report cards offline
        </li>
        <li>
          <CloudUpload size={14} aria-hidden />
          Scores sent when online
        </li>
      </ul>
    </div>
  );
}
