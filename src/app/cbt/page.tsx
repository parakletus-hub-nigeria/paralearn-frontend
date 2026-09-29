"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  KeyRound, 
  Building2, 
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  Zap,
  PlusCircle,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  BookOpen,
  Code2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getExaminerSession, clearExaminerSession, ExaminerWorkspace } from "@/lib/cbtSessionManager";

export default function CbtPortalPage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");
  const [examiner, setExaminer] = useState<ExaminerWorkspace | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Sample default active exam for newly signed in examiner
  const [exams, setExams] = useState([
    {
      id: "jamb_mock_demo",
      title: "JAMB UTME 2026 Mock — General Paper",
      accessCode: "JAMB-MOCK-26",
      durationMins: 60,
      totalQuestions: 40,
      isPublished: true,
      enrolledCandidates: 14,
    },
  ]);

  useEffect(() => {
    const session = getExaminerSession();
    if (session) {
      setExaminer(session);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) return;
    router.push(`/take/${encodeURIComponent(examCode.trim().toUpperCase())}`);
  };

  const handleSignOut = () => {
    clearExaminerSession();
    setExaminer(null);
    toast.info("Signed out of Examiner Workspace.");
  };

  const copyRoomLink = (code: string) => {
    const url = `${window.location.origin}/take/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success(`Copied room link: ${url}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      
      {/* Top Navigation */}
      <header className="h-16 border-b border-[var(--border-fine)] px-6 lg:px-12 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Link href="/cbt" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--violet-ink)] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              PL
            </div>
            <span className="font-bold text-base tracking-tight text-[var(--foreground)]">
              ParaLearn CBT
            </span>
          </Link>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-mono px-2 bg-[var(--violet-tint)] text-[var(--violet-ink)] border-0">
            Assessment Engine
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cbt/api-docs"
            className="text-xs font-semibold text-slate-600 hover:text-[var(--violet-ink)] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Developer API</span>
          </Link>

          {examiner ? (
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hidden sm:inline-block">
                {examiner.credits} Free Credits
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="h-9 px-3 text-xs font-semibold text-slate-600 hover:text-red-600 hover:border-red-200 border-[var(--border-fine)] rounded-[var(--radius-md)] flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/cbt/auth?mode=login">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3.5 text-xs font-bold border-[var(--border-fine)] text-[var(--foreground)] rounded-[var(--radius-md)]"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/cbt/auth?mode=register">
                <Button
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs"
                >
                  Create Exam Hall
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── LOGGED-IN EXAMINER DASHBOARD VIEW ───────────────────────────────── */}
      {examiner ? (
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
          
          {/* Welcome Banner */}
          <div className="bg-white border border-[var(--border-fine)] rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-[#641bc4] border border-violet-100">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Active Examiner Workspace</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {examiner.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Managed by {examiner.ownerName} &bull; {examiner.ownerEmail}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Candidate Credits</span>
                <span className="text-2xl font-black text-emerald-600 font-mono">{examiner.credits}</span>
              </div>
              <Link href={`/cbt/exams/${exams[0].id}`}>
                <Button className="h-10 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl flex items-center gap-1.5 shadow-sm">
                  <PlusCircle className="w-4 h-4" />
                  <span>Author Questions</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Total Exams</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">1</p>
            </div>
            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Questions in Bank</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">40</p>
            </div>
            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Completed Sessions</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">14</p>
            </div>
            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Anti-Cheat Status</span>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-1 mt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Active</span>
              </p>
            </div>
          </div>

          {/* Active Examinations List */}
          <div className="bg-white border border-[var(--border-fine)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Exam Rooms</h2>
                <p className="text-xs text-slate-500">Share room access codes with candidates to begin live testing.</p>
              </div>
              <Link href={`/cbt/exams/${exams[0].id}/monitor`}>
                <Button variant="outline" size="sm" className="h-9 text-xs font-bold border-slate-200 text-slate-700 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-[#641bc4]" />
                  <span>Live Proctoring Monitor</span>
                </Button>
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {exams.map((exam) => (
                <div key={exam.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{exam.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>Room Code: <strong className="text-[#641bc4]">{exam.accessCode}</strong></span>
                      <span>&bull;</span>
                      <span>{exam.durationMins} mins</span>
                      <span>&bull;</span>
                      <span>{exam.totalQuestions} questions</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyRoomLink(exam.accessCode)}
                      className="h-8 text-xs font-semibold border-slate-200 text-slate-700 flex items-center gap-1.5"
                    >
                      {copiedCode === exam.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode === exam.accessCode ? "Copied Link" : "Copy Student Link"}</span>
                    </Button>

                    <Link href={`/take/${exam.accessCode}`}>
                      <Button size="sm" className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1">
                        <span>Launch Test</span>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      ) : (
        /* ── GUEST / UNLOGGED HERO PORTAL VIEW ───────────────────────────────── */
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 lg:py-20 flex flex-col items-center text-center space-y-10">
          
          {/* Value Proposition Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border-fine)] text-xs text-[var(--text-secondary)]">
            <Zap className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
            <span>High-Throughput &bull; Real-Time Proctoring &bull; Instant Results</span>
          </div>

          {/* Hero Title */}
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-tight">
              Computer-Based Testing built for precision and speed.
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              Take school exams, run tutorial centre mock tests, or author assessments with zero lag. Used by K-12 schools, JAMB prep academies, and independent tutors across Nigeria.
            </p>
          </div>

          {/* 2 Entry Gates (Candidate Box vs Examiner Box) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left">
            
            {/* Box 1: Candidate Quick Enter */}
            <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 sm:p-7 shadow-[var(--shadow-card)] space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--violet-tint)] text-[var(--violet-ink)] flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                  Taking an Exam?
                </h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Enter your Room Code to join your scheduled test. No prior account registration required for walk-in candidates.
                </p>
              </div>

              <form onSubmit={handleJoin} className="space-y-3 pt-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. JAMB-MOCK-26"
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                  className="w-full h-11 px-3.5 text-center text-sm font-mono font-bold tracking-wider uppercase rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white text-[var(--foreground)] focus:border-[var(--violet-ink)] focus:ring-2 focus:ring-[var(--violet-ink)]/20 outline-none"
                />
                <Button
                  type="submit"
                  disabled={!examCode.trim()}
                  className="w-full h-11 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs flex items-center justify-center gap-2"
                >
                  <span>Enter Exam Room</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            </div>

            {/* Box 2: Examiner / School / Tutor Access */}
            <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 sm:p-7 shadow-[var(--shadow-card)] space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--emerald-tint)] text-[#065f46] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[var(--emerald-signal)]" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                  Examiners &amp; Tutors
                </h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Sign in to your Exam Hall or register a new workspace. Automatic sign-in with 30 free candidate credits on registration.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Link href="/cbt/auth?mode=login" className="block w-full">
                  <Button
                    variant="outline"
                    className="w-full h-11 text-xs font-bold border-[var(--border-fine)] hover:bg-[var(--surface-muted)] text-[var(--foreground)] rounded-[var(--radius-md)] flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4 text-[var(--violet-ink)]" />
                    <span>Examiner Sign In</span>
                  </Button>
                </Link>

                <Link href="/cbt/auth?mode=register" className="block w-full">
                  <Button
                    className="w-full h-11 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-[var(--radius-md)] flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Create Free Exam Hall (30 Credits) &rarr;</span>
                  </Button>
                </Link>
              </div>
            </div>

          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl pt-8 border-t border-[var(--border-fine)] text-left">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--foreground)]">
                <ShieldCheck className="w-4 h-4 text-[var(--emerald-signal)]" />
                <span>Anti-Cheating Guard</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Real-time tab switch, window blur, and device fingerprint detection with automatic timeout enforcement.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--foreground)]">
                <Clock className="w-4 h-4 text-[var(--violet-ink)]" />
                <span>Offline Resilience</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Local answer caching ensures network drops during exams never lose student progress.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--foreground)]">
                <BarChart3 className="w-4 h-4 text-[var(--cobalt-signal)]" />
                <span>Instant Scoring &amp; Sync</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Auto-grades MCQs instantly and seamlessly syncs results directly to school report cards.
              </p>
            </div>
          </div>

        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border-fine)] py-6 text-center text-xs text-[var(--text-secondary)] bg-white">
        &copy; {new Date().getFullYear()} ParaLearn CBT Assessment Engine &bull; pln.ng &bull; cbt.pln.ng
      </footer>

    </div>
  );
}
