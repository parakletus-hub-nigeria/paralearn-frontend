"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function TakeRootPage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) return;
    router.push(`/take/${encodeURIComponent(examCode.trim().toUpperCase())}`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 sm:p-6 font-sans text-[var(--foreground)]">
      <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6 text-center">
        
        {/* Brand Icon */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--violet-tint)] text-[var(--violet-ink)] border border-[var(--violet-ink)]/20 mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Enter Examination Room
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Enter the unique exam room code provided by your school, tutor, or tutorial centre.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4 pt-2">
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Room / Assessment Code
            </label>
            <Input
              type="text"
              required
              autoFocus
              placeholder="e.g. JAMB-MOCK-26"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value.toUpperCase())}
              className="h-12 text-center text-lg font-mono font-bold tracking-widest uppercase rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
            />
          </div>

          <Button
            type="submit"
            disabled={!examCode.trim()}
            className="w-full h-12 text-base font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] flex items-center justify-center gap-2"
          >
            <span>Proceed to Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>

        <div className="pt-4 border-t border-[var(--border-fine)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Are you an examiner?</span>
          <Link href="/cbt" className="font-semibold text-[var(--violet-ink)] hover:underline">
            Manage Exams &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
}
