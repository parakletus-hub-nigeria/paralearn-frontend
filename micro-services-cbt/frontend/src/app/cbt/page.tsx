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
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function CbtPortalPage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) return;
    router.push(`/take/${encodeURIComponent(examCode.trim().toUpperCase())}`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      
      {/* Top Navigation */}
      <header className="h-16 border-b border-[var(--border-fine)] px-6 lg:px-12 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--violet-ink)] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            PL
          </div>
          <span className="font-bold text-base tracking-tight text-[var(--foreground)]">
            ParaLearn CBT
          </span>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-mono px-2 bg-[var(--violet-tint)] text-[var(--violet-ink)] border-0">
            Assessment Engine
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/RMS/cbt" className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] hidden sm:block">
            Dashboard
          </Link>
          <Link href="/cbt/auth">
            <Button size="sm" className="h-9 px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs">
              Examiner Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
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
                Sign in with your ParaLearn school account or create a self-serve Exam Hall for your tutorial centre. Includes 30 free candidates.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link href="/cbt/auth" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full h-11 text-xs font-bold border-[var(--border-fine)] hover:bg-[var(--surface-muted)] text-[var(--foreground)] rounded-[var(--radius-md)] flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-[var(--violet-ink)]" />
                  <span>ParaLearn School SSO</span>
                </Button>
              </Link>

              <Link href="/cbt/auth" className="block w-full">
                <Button
                  className="w-full h-11 text-xs font-bold bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-white rounded-[var(--radius-md)] flex items-center justify-center gap-2 shadow-xs"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Create Free Exam Hall &rarr;</span>
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

      {/* Footer */}
      <footer className="border-t border-[var(--border-fine)] py-6 text-center text-xs text-[var(--text-secondary)] bg-white">
        &copy; {new Date().getFullYear()} ParaLearn CBT Assessment Engine &bull; pln.ng &bull; cbt.pln.ng
      </footer>

    </div>
  );
}
