"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/reduxToolKit/store";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { 
  Building2, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft,
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Sparkles, 
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSubdomainToStorage, extractSubdomainFromURL } from "@/lib/subdomainManager";
import { cbtApi } from "@/lib/cbtSessionManager";

export default function CbtAuthGateway() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const searchParams = useSearchParams();

  // Primary Tab: Independent Examiner vs School Staff SSO
  const [workspaceType, setWorkspaceType] = useState<"standalone" | "school">("standalone");

  // Secondary Tab for Independent Examiner: Login vs Register
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Examiner Login state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Examiner Registration state
  const [registerData, setRegisterData] = useState({
    fullName: "",
    centreName: "",
    email: "",
    password: "",
  });

  // School SSO state
  const [schoolData, setSchoolData] = useState({
    subdomain: "",
    email: "",
    password: "",
  });

  // Check URL parameters: e.g. /cbt/auth?mode=register
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "register" || mode === "signup") {
      setAuthMode("register");
      setWorkspaceType("standalone");
    } else if (mode === "school") {
      setWorkspaceType("school");
    }
  }, [searchParams]);

  // Auto-detect subdomain if arrived from {school}.pln.ng
  useEffect(() => {
    const detected = extractSubdomainFromURL();
    if (detected && detected !== "cbt" && detected !== "www") {
      setSchoolData((prev) => ({ ...prev, subdomain: detected }));
      setWorkspaceType("school");
    }
  }, []);

  // ── Mode 1: Returning Examiner Sign In ────────────────────────────────────
  const handleExaminerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const workspace = await cbtApi.examinerLogin(loginData.email.trim(), loginData.password);
      toast.success(`Welcome back, ${workspace.ownerName || workspace.name}!`);
      // Automatically signed in — redirect straight to CBT Workspace Hub
      router.push("/cbt");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in. Please verify your details.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Mode 2: New Examiner Registration with Automatic Sign-In ──────────────
  const handleExaminerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.fullName || !registerData.email) {
      toast.error("Please enter your name and email address.");
      return;
    }

    setIsLoading(true);
    try {
      const workspace = await cbtApi.registerStandaloneWorkspace({
        name: registerData.centreName.trim() || `${registerData.fullName}'s Exam Hall`,
        ownerName: registerData.fullName.trim(),
        email: registerData.email.trim(),
      });

      toast.success(
        `Exam Hall "${workspace.name}" provisioned with 30 Free Credits! Signed in automatically.`
      );
      // AUTOMATICALLY SIGNED IN — send directly into the CBT workspace!
      router.push("/cbt");
    } catch (err: any) {
      toast.error(err.message || "Failed to provision Exam Hall workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Mode 3: ParaLearn School SSO Login ────────────────────────────────────
  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData.email || !schoolData.password) {
      toast.error("Please provide both email/username and password.");
      return;
    }

    if (schoolData.subdomain) {
      saveSubdomainToStorage(schoolData.subdomain.trim().toLowerCase());
    }

    setIsLoading(true);
    try {
      const resultAction = await dispatch(
        loginUser({
          email: schoolData.email.trim(),
          password: schoolData.password,
          institutionType: "k12",
        })
      );

      if (loginUser.fulfilled.match(resultAction)) {
        toast.success("Authenticated with School Workspace!");
        router.push("/cbt");
      } else {
        const errorMsg = (resultAction.payload as string) || "Invalid school credentials.";
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("Authentication failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-[var(--foreground)]">
      
      {/* Brand Header */}
      <div className="mb-6 text-center space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--violet-tint)] text-[var(--violet-ink)] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ParaLearn Assessment Suite</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {workspaceType === "standalone"
            ? authMode === "login"
              ? "Examiner Sign In"
              : "Create Free Exam Hall"
            : "School Staff Sign In"}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          {workspaceType === "standalone"
            ? authMode === "login"
              ? "Access your tests, question banks, and live candidate monitor."
              : "Set up your independent testing centre in 60 seconds with 30 free candidates."
            : "Sign in with your registered ParaLearn school credentials."}
        </p>
      </div>

      {/* Back to CBT Portal Link */}
      <div className="w-full max-w-md mb-3 flex items-center justify-start">
        <Link
          href="/cbt"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#641bc4] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to CBT Portal</span>
        </Link>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
        
        {/* Workspace Type Selector */}
        <div className="p-2 bg-[var(--surface-muted)] border-b border-[var(--border-fine)]">
          <div className="grid grid-cols-2 gap-1 bg-white/60 p-1 rounded-[var(--radius-md)] border border-[var(--border-fine)]">
            <button
              type="button"
              onClick={() => setWorkspaceType("standalone")}
              className={`h-9 text-xs font-bold rounded-[var(--radius-sm)] transition-all flex items-center justify-center gap-1.5 ${
                workspaceType === "standalone"
                  ? "bg-white text-[var(--foreground)] shadow-xs border border-[var(--border-fine)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>Independent Examiner</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkspaceType("school")}
              className={`h-9 text-xs font-bold rounded-[var(--radius-sm)] transition-all flex items-center justify-center gap-1.5 ${
                workspaceType === "school"
                  ? "bg-white text-[var(--foreground)] shadow-xs border border-[var(--border-fine)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>School Account (SSO)</span>
            </button>
          </div>
        </div>

        {/* ── Standalone Examiner Flow ─────────────────────────────────────── */}
        {workspaceType === "standalone" && (
          <div>
            {/* Sub-Toggle: Login vs Register */}
            <div className="px-6 pt-5 pb-1 flex items-center justify-center">
              <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                    authMode === "login"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className={`px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                    authMode === "register"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
                  <span>Create Account</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Free</span>
                </button>
              </div>
            </div>

            {/* FORM A: Returning Examiner Login */}
            {authMode === "login" && (
              <form onSubmit={handleExaminerLogin} className="p-6 space-y-4">
                <div className="bg-[var(--surface-subtle)] border border-[var(--border-fine)] rounded-[var(--radius-md)] p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--violet-ink)] shrink-0 mt-0.5" />
                  <span>
                    Sign in to your Exam Hall to manage tests, questions, and view live results.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Examiner Email Address
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      required
                      placeholder="e.g. tutor@gmail.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] pl-9"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] pl-9 pr-10"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-sm font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? <span>Signing In...</span> : (
                    <>
                      <span>Sign In as Examiner</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode("register")}
                    className="text-xs text-slate-500 hover:text-[var(--violet-ink)] font-semibold transition-colors"
                  >
                    Don't have an exam hall yet? <span className="underline text-[var(--violet-ink)]">Create one for free</span>
                  </button>
                </div>
              </form>
            )}

            {/* FORM B: New Examiner Registration with Automatic Sign-In */}
            {authMode === "register" && (
              <form onSubmit={handleExaminerRegister} className="p-6 space-y-4">
                <div className="bg-[var(--emerald-tint)]/60 border border-[var(--emerald-signal)]/30 rounded-[var(--radius-md)] p-3 text-xs text-[#065f46] flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--emerald-signal)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Instant Auto-SignIn:</strong> You will be signed in automatically with <strong>30 free candidate credits</strong> immediately after clicking below.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Your Full Name
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Samuel Adekunle"
                    value={registerData.fullName}
                    onChange={(e) => setRegisterData({ ...registerData, fullName: e.target.value })}
                    className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Tutorial Centre / Brand Name
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Apex JAMB &amp; WAEC Academy (Optional)"
                    value={registerData.centreName}
                    onChange={(e) => setRegisterData({ ...registerData, centreName: e.target.value })}
                    className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="tutor@gmail.com"
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    Create Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 text-sm font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? <span>Provisioning &amp; Signing In...</span> : (
                    <>
                      <span>Create &amp; Sign In Automatically</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="text-xs text-slate-500 hover:text-[var(--violet-ink)] font-semibold transition-colors"
                  >
                    Already have an account? <span className="underline text-[var(--violet-ink)]">Sign in here</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── School Staff SSO Flow ─────────────────────────────────────────── */}
        {workspaceType === "school" && (
          <form onSubmit={handleSchoolSubmit} className="p-6 space-y-4">
            <div className="bg-[var(--surface-subtle)] border border-[var(--border-fine)] rounded-[var(--radius-md)] p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--violet-ink)] shrink-0 mt-0.5" />
              <span>
                Sign in with your registered ParaLearn school credentials. Classes and rosters are pre-synced.
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                School Subdomain
              </label>
              <div className="relative flex items-center">
                <Input
                  type="text"
                  placeholder="e.g. greenfield"
                  value={schoolData.subdomain}
                  onChange={(e) => setSchoolData({ ...schoolData, subdomain: e.target.value })}
                  className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] pr-20"
                />
                <span className="absolute right-3 text-xs font-mono text-[var(--text-secondary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded-[var(--radius-xs)] border border-[var(--border-fine)]">
                  .pln.ng
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Staff Email or Username
              </label>
              <Input
                type="text"
                required
                placeholder="teacher@school.com"
                value={schoolData.email}
                onChange={(e) => setSchoolData({ ...schoolData, email: e.target.value })}
                className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={schoolData.password}
                  onChange={(e) => setSchoolData({ ...schoolData, password: e.target.value })}
                  className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-sm font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <span>Signing In...</span> : (
                <>
                  <span>Sign In with School Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Footer Link to Candidate Exam Gate */}
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
