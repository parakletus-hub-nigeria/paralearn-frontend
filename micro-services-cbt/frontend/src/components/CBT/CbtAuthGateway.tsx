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
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  LogIn,
  UserPlus,
  Repeat,
  User,
  School,
} from "lucide-react";
import { toast } from "sonner";
import { cbtApi, type ExaminerWorkspace, type WorkspaceChoice } from "@cbt/lib/cbtSessionManager";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-auth.css";

type View = "signin" | "register" | "choose";

const MIN_PASSWORD_LENGTH = 8;

const HEADINGS: Record<View, { title: string; subtitle: string }> = {
  signin: {
    title: "Sign in to ParaLearn CBT",
    subtitle:
      "School staff use their ParaLearn email and password. Tutors and exam centres use their exam hall account.",
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


export default function CbtAuthGateway() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Shown inside the form as well as in the toast, so the reason stays next to the fields
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
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
      const message = err.message || "Sign-in failed. Please check your details.";
      setFormError(message);
      toast.error(message);
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
      const message = err.message || "Could not open that workspace.";
      toast.error(message);
      setSelection(null);
      setView("signin");
      setFormError(`${message} Sign in again to choose a workspace.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (registerData.password.length < MIN_PASSWORD_LENGTH) {
      const message = `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
      setFormError(message);
      toast.error(message);
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
      const message = err.message || "Could not create your exam hall.";
      setFormError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };


  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      className="cbt-auth-eye"
    >
      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  const switchView = (next: View) => {
    setFormError(null);
    setSelection(null);
    setView(next);
  };

  const errorNote = formError ? (
    <p className="cbt-auth-error" role="alert">
      <AlertCircle size={16} aria-hidden />
      <span>{formError}</span>
    </p>
  ) : null;

  const submitButton = (label: string, busyLabel: string) => (
    <button type="submit" disabled={isLoading} aria-busy={isLoading} className="cbt-button primary cbt-auth-submit">
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>{busyLabel}</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight size={16} />
        </>
      )}
    </button>
  );

  const tabs: Array<{ view: View; label: string; icon: typeof LogIn }> = [
    { view: "signin", label: "Sign in", icon: LogIn },
    { view: "register", label: "Create hall", icon: UserPlus },
  ];
  if (view === "choose") tabs.push({ view: "choose", label: "Choose workspace", icon: Repeat });

  return (
    <div className="cbt-surface cbt-auth">
      <div className="cbt-auth-bg" aria-hidden />
      <header className="cbt-auth-header">
        <CbtBrand />
        <nav aria-label="Other entrances">
          <Link href="/cbt" className="cbt-auth-back">
            <ArrowLeft size={15} aria-hidden />
            <span>ParaLearn CBT home</span>
          </Link>
          <Link href="/take" className="cbt-button">
            <KeyRound size={15} aria-hidden />
            Candidate entrance
          </Link>
        </nav>
      </header>

      <main className="cbt-auth-main">
        <div className="cbt-auth-card">
          <div className="cbt-auth-tabs" role="tablist" aria-label="Examiner access">
            {tabs.map(({ view: v, label, icon: Icon }) => (
              <button
                key={v}
                id={`cbt-auth-tab-${v}`}
                type="button"
                role="tab"
                aria-selected={view === v}
                aria-controls="cbt-auth-panel"
                className={view === v ? "is-active" : ""}
                disabled={v === "choose"}
                onClick={() => {
                  if (v === "choose") return;
                  switchView(v);
                }}
              >
                <Icon size={15} aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div
            className="cbt-auth-body"
            id="cbt-auth-panel"
            role="tabpanel"
            aria-labelledby={`cbt-auth-tab-${view}`}
          >
            <p className="cbt-auth-eyebrow">Examiner and invigilator portal</p>
            <h1>{HEADINGS[view].title}</h1>
            <p className="cbt-auth-sub">{HEADINGS[view].subtitle}</p>

            {view === "signin" && (
              <form onSubmit={handleSignIn} className="cbt-auth-form">
                <div className="cbt-auth-field">
                  <label htmlFor="cbt-email">Email address</label>
                  <div className="cbt-auth-input">
                    <Mail size={17} aria-hidden />
                    <input
                      id="cbt-email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="you@school.com"
                      value={signInData.email}
                      onChange={(e) => {
                        setFormError(null);
                        setSignInData({ ...signInData, email: e.target.value });
                      }}
                    />
                  </div>
                </div>

                <div className="cbt-auth-field">
                  <label htmlFor="cbt-password">Password</label>
                  <div className="cbt-auth-input">
                    <Lock size={17} aria-hidden />
                    <input
                      id="cbt-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={signInData.password}
                      onChange={(e) => {
                        setFormError(null);
                        setSignInData({ ...signInData, password: e.target.value });
                      }}
                    />
                    {passwordToggle}
                  </div>
                </div>

                {errorNote}
                {submitButton("Sign in to workspace", "Signing in...")}
              </form>
            )}

            {view === "register" && (
              <form onSubmit={handleRegister} className="cbt-auth-form">
                <div className="cbt-auth-note is-info">
                  <Info size={17} aria-hidden />
                  <p>
                    School staff don&apos;t need an exam hall.{" "}
                    <button type="button" className="cbt-auth-inline-link" onClick={() => switchView("signin")}>
                      Sign in with your ParaLearn account
                    </button>{" "}
                    instead.
                  </p>
                </div>

                <div className="cbt-auth-field">
                  <label htmlFor="cbt-name">Your full name</label>
                  <div className="cbt-auth-input">
                    <User size={17} aria-hidden />
                    <input
                      id="cbt-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="e.g. Samuel Adekunle"
                      value={registerData.fullName}
                      onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cbt-auth-field">
                  <label htmlFor="cbt-centre">
                    Tutorial centre or brand name <small>Optional</small>
                  </label>
                  <div className="cbt-auth-input">
                    <School size={17} aria-hidden />
                    <input
                      id="cbt-centre"
                      type="text"
                      placeholder="e.g. Apex JAMB & WAEC Academy"
                      value={registerData.centreName}
                      onChange={(e) => setRegisterData({ ...registerData, centreName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cbt-auth-field">
                  <label htmlFor="cbt-register-email">Email address</label>
                  <div className="cbt-auth-input">
                    <Mail size={17} aria-hidden />
                    <input
                      id="cbt-register-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="tutor@gmail.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cbt-auth-field">
                  <label htmlFor="cbt-register-password">Create password</label>
                  <div className="cbt-auth-input">
                    <Lock size={17} aria-hidden />
                    <input
                      id="cbt-register-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      autoComplete="new-password"
                      aria-describedby="cbt-register-password-hint"
                      placeholder="Create a password"
                      value={registerData.password}
                      onChange={(e) => {
                        setFormError(null);
                        setRegisterData({ ...registerData, password: e.target.value });
                      }}
                    />
                    {passwordToggle}
                  </div>
                  <p
                    id="cbt-register-password-hint"
                    className={`cbt-auth-hint ${
                      registerData.password.length >= MIN_PASSWORD_LENGTH ? "is-met" : ""
                    }`}
                  >
                    {registerData.password.length >= MIN_PASSWORD_LENGTH ? (
                      <CheckCircle2 size={14} aria-hidden />
                    ) : null}
                    At least {MIN_PASSWORD_LENGTH} characters
                  </p>
                </div>

                {errorNote}
                {submitButton("Create exam hall", "Creating your exam hall...")}
              </form>
            )}

            {view === "choose" && selection && (
              <div className="cbt-auth-choices">
                {selection.choices.map((choice) => {
                  const isSchool = choice.type === "INSTITUTION";
                  const Icon = isSchool ? Building2 : UserCheck;
                  return (
                    <button
                      key={choice.workspaceId}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleChoose(choice.workspaceId)}
                      className="cbt-auth-choice"
                    >
                      <span className="cbt-auth-choice-icon">
                        <Icon size={18} aria-hidden />
                      </span>
                      <span className="cbt-auth-choice-text">
                        <strong>{choice.name}</strong>
                        <small>
                          {isSchool
                            ? "School workspace, with your ParaLearn classes and students"
                            : "Your independent exam hall"}
                        </small>
                      </span>
                      <ArrowRight size={16} aria-hidden />
                    </button>
                  );
                })}
                <button type="button" onClick={() => switchView("signin")} className="cbt-auth-link">
                  Use a different account
                </button>
              </div>
            )}
          </div>

          {view !== "choose" && (
            <div className="cbt-auth-foot">
              {view === "signin" ? (
                <>
                  <span>Running your own mock exams without a school?</span>
                  <button type="button" className="cbt-auth-link" onClick={() => switchView("register")}>
                    Create a free exam hall
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  <span>Already have an account?</span>
                  <button type="button" className="cbt-auth-link" onClick={() => switchView("signin")}>
                    Sign in
                    <ArrowRight size={14} aria-hidden />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="cbt-auth-candidate" aria-label="For candidates">
          <span className="cbt-auth-candidate-icon">
            <KeyRound size={18} aria-hidden />
          </span>
          <p>
            <strong>Are you a student or candidate?</strong>
            No account or password needed. You only need the exam code from your examiner.
          </p>
          <Link href="/take" className="cbt-button">
            Enter exam code
            <ArrowRight size={15} aria-hidden />
          </Link>
        </aside>
      </main>

      <footer className="cbt-auth-footer">
        <span>&copy; {new Date().getFullYear()} ParaLearn CBT</span>
        <Link href="/cbt/api-docs">Developer API</Link>
      </footer>
    </div>
  );
}
