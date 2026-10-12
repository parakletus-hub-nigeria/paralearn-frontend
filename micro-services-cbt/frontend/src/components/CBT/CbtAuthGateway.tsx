"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cbtApi, type ExaminerWorkspace, type WorkspaceChoice } from "@cbt/lib/cbtSessionManager";
import CbtBrand from "./CbtBrand";

type View = "signin" | "register" | "choose";

const MIN_PASSWORD_LENGTH = 8;

const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  signin: {
    title: "Sign in to ParaLearn CBT",
    subtitle: "Use your ParaLearn school account or your exam hall account.",
  },
  register: {
    title: "Create a free exam hall",
    subtitle: "For tutors and exam centres running their own tests.",
  },
  choose: {
    title: "Choose a workspace",
    subtitle: "This email opens more than one workspace.",
  },
};

const labelClass =
  "text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]";
const inputClass =
  "h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]";

export default function CbtAuthGateway() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    fullName: "",
    centreName: "",
    email: "",
    password: "",
  });
  const [selection, setSelection] = useState<{
    token: string;
    choices: WorkspaceChoice[];
  } | null>(null);

  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "register" || mode === "signup") setView("register");
    if (searchParams.get("expired")) {
      toast.info("Your session has ended. Please sign in again.");
    }
  }, [searchParams]);

  const enterWorkspace = (workspace: ExaminerWorkspace) => {
    toast.success(
      workspace.type === "INSTITUTION"
        ? `Signed in to ${workspace.name}`
        : `Welcome back, ${workspace.ownerName || workspace.name}!`
    );
    router.push("/cbt");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await cbtApi.signIn(signInData.email.trim(), signInData.password);
      if (result.status === "choose") {
        setSelection({ token: result.selectionToken, choices: result.choices });
        setView("choose");
      } else {
        enterWorkspace(result.workspace);
      }
    } catch (err: any) {
      toast.error(err.message || "Sign-in failed. Please check your details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoose = async (workspaceId: string) => {
    if (!selection) return;
    setIsLoading(true);
    try {
      enterWorkspace(await cbtApi.chooseWorkspace(selection.token, workspaceId));
    } catch (err: any) {
      toast.error(err.message || "Could not open that workspace.");
      setSelection(null);
      setView("signin");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setIsLoading(true);
    try {
      const workspace = await cbtApi.registerExamHall({
        name: registerData.centreName.trim() || `${registerData.fullName.trim()}'s Exam Hall`,
        ownerName: registerData.fullName.trim(),
        email: registerData.email.trim(),
        password: registerData.password,
      });
      toast.success(`Exam hall "${workspace.name}" is ready.`);
      router.push("/cbt");
    } catch (err: any) {
      toast.error(err.message || "Could not create your exam hall.");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="absolute right-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  const submitButton = (label: string, busyLabel: string) => (
    <Button
      type="submit"
      disabled={isLoading}
      className="w-full h-11 text-sm font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] flex items-center justify-center gap-2 mt-2"
    >
      {isLoading ? (
        <span>{busyLabel}</span>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </Button>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-3 sm:p-6 font-sans text-[var(--foreground)]">
      <div className="mb-6 text-center space-y-1">
        <div className="flex justify-center mb-7">
          <CbtBrand />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {HEADINGS[view].title}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          {HEADINGS[view].subtitle}
        </p>
      </div>

      <div className="w-full max-w-md mb-3 flex items-center justify-start">
        <Link
          href="/cbt"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#641bc4] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to CBT Portal</span>
        </Link>
      </div>

      <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
        {view === "signin" && (
          <form onSubmit={handleSignIn} className="p-6 space-y-4">
            <div className="bg-[var(--surface-subtle)] border border-[var(--border-fine)] rounded-[var(--radius-md)] p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--violet-ink)] shrink-0 mt-0.5" />
              <span>
                School staff sign in with their ParaLearn email and password, and go
                straight to their school&apos;s workspace.
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-email" className={labelClass}>
                Email address
              </label>
              <div className="relative">
                <Input
                  id="cbt-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@school.com"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  className={`${inputClass} pl-9`}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <Input
                  id="cbt-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={signInData.password}
                  onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                  className={`${inputClass} pl-9 pr-10`}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                {passwordToggle}
              </div>
            </div>

            {submitButton("Sign in", "Signing in...")}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setView("register")}
                className="text-xs text-slate-500 hover:text-[var(--violet-ink)] font-semibold transition-colors"
              >
                Running your own exams?{" "}
                <span className="underline text-[var(--violet-ink)]">
                  Create a free exam hall
                </span>
              </button>
            </div>
          </form>
        )}

        {view === "register" && (
          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div className="bg-[var(--emerald-tint)]/60 border border-[var(--emerald-signal)]/30 rounded-[var(--radius-md)] p-3 text-xs text-[#065f46] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--emerald-signal)] shrink-0 mt-0.5" />
              <span>
                School staff don&apos;t need an exam hall. Sign in with your ParaLearn
                account instead.
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-name" className={labelClass}>
                Your full name
              </label>
              <Input
                id="cbt-name"
                type="text"
                required
                placeholder="e.g. Samuel Adekunle"
                value={registerData.fullName}
                onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-centre" className={labelClass}>
                Tutorial centre / brand name
              </label>
              <Input
                id="cbt-centre"
                type="text"
                placeholder="e.g. Apex JAMB & WAEC Academy (optional)"
                value={registerData.centreName}
                onChange={(e) => setRegisterData({ ...registerData, centreName: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-register-email" className={labelClass}>
                Email address
              </label>
              <Input
                id="cbt-register-email"
                type="email"
                required
                autoComplete="email"
                placeholder="tutor@gmail.com"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cbt-register-password" className={labelClass}>
                Create password
              </label>
              <div className="relative">
                <Input
                  id="cbt-register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  className={`${inputClass} pr-10`}
                />
                {passwordToggle}
              </div>
            </div>

            {submitButton("Create exam hall", "Creating your exam hall...")}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setView("signin")}
                className="text-xs text-slate-500 hover:text-[var(--violet-ink)] font-semibold transition-colors"
              >
                Already have an account?{" "}
                <span className="underline text-[var(--violet-ink)]">Sign in</span>
              </button>
            </div>
          </form>
        )}

        {view === "choose" && selection && (
          <div className="p-6 space-y-3">
            {selection.choices.map((choice) => {
              const isSchool = choice.type === "INSTITUTION";
              const Icon = isSchool ? Building2 : UserCheck;
              return (
                <button
                  key={choice.workspaceId}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleChoose(choice.workspaceId)}
                  className="w-full text-left p-4 rounded-[var(--radius-md)] border border-[var(--border-fine)] hover:border-[var(--violet-ink)] hover:bg-[var(--surface-subtle)] transition-colors flex items-center gap-3 disabled:opacity-60"
                >
                  <Icon className="w-5 h-5 text-[var(--violet-ink)] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-[var(--foreground)] truncate">
                      {choice.name}
                    </span>
                    <span className="block text-xs text-[var(--text-secondary)]">
                      {isSchool
                        ? "School workspace, with your ParaLearn classes and students"
                        : "Your independent exam hall"}
                    </span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setSelection(null);
                setView("signin");
              }}
              className="w-full text-center pt-1 text-xs text-slate-500 hover:text-[var(--violet-ink)] font-semibold"
            >
              Use a different account
            </button>
          </div>
        )}

        <div className="bg-[var(--surface-subtle)] border-t border-[var(--border-fine)] px-6 py-3.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Taking an examination?</span>
          <a
            href="/take"
            className="font-bold text-[var(--violet-ink)] hover:underline flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Enter Exam Code &rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}
