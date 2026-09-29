"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { 
  Building2, 
  UserCheck, 
  ArrowRight, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Sparkles, 
  HelpCircle,
  KeyRound,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveSubdomainToStorage, extractSubdomainFromURL } from "@/lib/subdomainManager";

export default function CbtAuthGateway() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"school" | "standalone">("school");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Tab 1: School SSO state
  const [schoolData, setSchoolData] = useState({
    subdomain: "",
    email: "",
    password: "",
  });

  // Tab 2: Standalone Tutor/Centre state
  const [tutorData, setTutorData] = useState({
    fullName: "",
    centreName: "",
    email: "",
    password: "",
  });

  // Auto-detect subdomain if arrived from {school}.pln.ng
  useEffect(() => {
    const detected = extractSubdomainFromURL();
    if (detected && detected !== "cbt" && detected !== "www") {
      setSchoolData((prev) => ({ ...prev, subdomain: detected }));
    }
  }, []);

  // Handle Mode 1: ParaLearn School SSO Login
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
        router.push("/RMS/cbt");
      } else {
        const errorMsg = (resultAction.payload as string) || "Invalid credentials. Please verify your details.";
        toast.error(errorMsg);
      }
    } catch (err) {
      toast.error("Authentication failed. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Mode 2: Standalone Tutor / Tutorial Centre Registration / Login
  const handleStandaloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorData.fullName || !tutorData.email || !tutorData.password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);
    try {
      // Create lightweight standalone hall workspace in client storage
      const workspace = {
        id: `hall_${Date.now()}`,
        name: tutorData.centreName.trim() || `${tutorData.fullName}'s Exam Hall`,
        ownerName: tutorData.fullName.trim(),
        ownerEmail: tutorData.email.trim(),
        credits: 30, // 30 Free candidates tier
        type: "STANDALONE_HALL",
        createdAt: new Date().toISOString(),
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("paralearn_cbt_standalone_workspace", JSON.stringify(workspace));
        localStorage.setItem("paralearn_cbt_user_type", "STANDALONE_TUTOR");
      }

      toast.success(`Exam Hall "${workspace.name}" provisioned with 30 Free Credits!`);
      router.push("/RMS/cbt");
    } catch (err) {
      toast.error("Failed to provision Exam Hall workspace.");
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Examiner &amp; Staff Access
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
          Manage CBT exams, author question banks, and monitor live test rooms.
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
        
        {/* Tab Segmented Control */}
        <div className="p-2 bg-[var(--surface-muted)] border-b border-[var(--border-fine)]">
          <div className="grid grid-cols-2 gap-1 bg-white/60 p-1 rounded-[var(--radius-md)] border border-[var(--border-fine)]">
            <button
              type="button"
              onClick={() => setActiveTab("school")}
              className={`h-9 text-xs font-bold rounded-[var(--radius-sm)] transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "school"
                  ? "bg-white text-[var(--foreground)] shadow-xs border border-[var(--border-fine)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>School Account</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("standalone")}
              className={`h-9 text-xs font-bold rounded-[var(--radius-sm)] transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "standalone"
                  ? "bg-white text-[var(--foreground)] shadow-xs border border-[var(--border-fine)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>Independent Tutor</span>
            </button>
          </div>
        </div>

        {/* Tab 1: ParaLearn School SSO */}
        {activeTab === "school" && (
          <form onSubmit={handleSchoolSubmit} className="p-6 space-y-4">
            <div className="bg-[var(--surface-subtle)] border border-[var(--border-fine)] rounded-[var(--radius-md)] p-3 text-xs text-[var(--text-secondary)] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--violet-ink)] shrink-0 mt-0.5" />
              <span>
                Sign in with your registered ParaLearn school credentials. Your classes, subjects, and student roster are pre-synced.
              </span>
            </div>

            {/* Subdomain Input */}
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

            {/* Staff Email / ID */}
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

            {/* Password */}
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

        {/* Tab 2: Independent Examiner / Tutor Registration */}
        {activeTab === "standalone" && (
          <form onSubmit={handleStandaloneSubmit} className="p-6 space-y-4">
            <div className="bg-[var(--emerald-tint)]/60 border border-[var(--emerald-signal)]/30 rounded-[var(--radius-md)] p-3 text-xs text-[#065f46] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--emerald-signal)] shrink-0 mt-0.5" />
              <span>
                <strong>Self-Serve Testing Hall:</strong> No school setup required. Start creating tests and generate candidate PINs in 2 minutes. (30 Free candidates included).
              </span>
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Your Full Name
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Samuel Adekunle"
                value={tutorData.fullName}
                onChange={(e) => setTutorData({ ...tutorData, fullName: e.target.value })}
                className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
              />
            </div>

            {/* Centre / Brand Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Tutorial Centre / Brand Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Apex JAMB &amp; WAEC Academy (Optional)"
                value={tutorData.centreName}
                onChange={(e) => setTutorData({ ...tutorData, centreName: e.target.value })}
                className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Email Address
              </label>
              <Input
                type="email"
                required
                placeholder="tutor@gmail.com"
                value={tutorData.email}
                onChange={(e) => setTutorData({ ...tutorData, email: e.target.value })}
                className="h-10 text-sm font-medium rounded-[var(--radius-md)] border-[var(--border-fine)]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Create password"
                  value={tutorData.password}
                  onChange={(e) => setTutorData({ ...tutorData, password: e.target.value })}
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
              {isLoading ? <span>Creating Workspace...</span> : (
                <>
                  <span>Create Free Exam Hall</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* Footer Link to Student Exam Gate */}
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
