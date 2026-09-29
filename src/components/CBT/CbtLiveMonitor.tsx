"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Users, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle2, 
  MoreVertical, 
  Search,
  PlusCircle,
  XCircle,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface CandidateLiveStatus {
  id: string;
  name: string;
  pin: string;
  answeredCount: number;
  totalQuestions: number;
  timeRemainingMins: number;
  violations: number;
  status: "active" | "flagged" | "locked" | "submitted";
  lastActive: string;
}

const MOCK_LIVE_CANDIDATES: CandidateLiveStatus[] = [
  {
    id: "c1",
    name: "Daniel Olawale",
    pin: "849201",
    answeredCount: 42,
    totalQuestions: 50,
    timeRemainingMins: 18,
    violations: 0,
    status: "active",
    lastActive: "Just now",
  },
  {
    id: "c2",
    name: "Amina Bello",
    pin: "732049",
    answeredCount: 49,
    totalQuestions: 50,
    timeRemainingMins: 12,
    violations: 2,
    status: "flagged",
    lastActive: "10s ago",
  },
  {
    id: "c3",
    name: "Chinedu Eze",
    pin: "918342",
    answeredCount: 14,
    totalQuestions: 50,
    timeRemainingMins: 45,
    violations: 3,
    status: "locked",
    lastActive: "2m ago",
  },
  {
    id: "c4",
    name: "Sarah Johnson",
    pin: "629104",
    answeredCount: 50,
    totalQuestions: 50,
    timeRemainingMins: 0,
    violations: 0,
    status: "submitted",
    lastActive: "Finished",
  },
  {
    id: "c5",
    name: "Ibrahim Musa",
    pin: "518290",
    answeredCount: 36,
    totalQuestions: 50,
    timeRemainingMins: 22,
    violations: 1,
    status: "active",
    lastActive: "5s ago",
  },
];

interface CbtLiveMonitorProps {
  examId: string;
  examTitle?: string;
  roomCode?: string;
}

export default function CbtLiveMonitor({
  examId,
  examTitle = "SS2 Physics Mid-Term Examination",
  roomCode = "PHY-2026-T1",
}: CbtLiveMonitorProps) {
  
  const [candidates, setCandidates] = useState<CandidateLiveStatus[]>(MOCK_LIVE_CANDIDATES);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged" | "locked" | "active">("all");

  // Force submit candidate attempt
  const handleForceSubmit = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, status: "submitted", timeRemainingMins: 0 } : c
      )
    );
    toast.success("Attempt force-submitted for grading.");
  };

  // Add 5 minutes grace
  const handleAddFiveMins = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, timeRemainingMins: c.timeRemainingMins + 5, status: c.status === "locked" ? "active" : c.status }
          : c
      )
    );
    toast.success("Added +5 minutes extension to candidate session.");
  };

  // Unlock disqualified attempt
  const handleUnlockCandidate = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, status: "active", violations: 2 } : c
      )
    );
    toast.info("Attempt unlocked with 1 violation forgiven.");
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.pin.includes(search);
    
    if (filter === "flagged") return matchesSearch && c.violations > 0;
    if (filter === "locked") return matchesSearch && c.status === "locked";
    if (filter === "active") return matchesSearch && c.status === "active";
    return matchesSearch;
  });

  const activeCount = candidates.filter((c) => c.status === "active").length;
  const flaggedCount = candidates.filter((c) => c.violations > 0).length;
  const lockedCount = candidates.filter((c) => c.status === "locked").length;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      
      {/* ── HEADER (56px) ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[var(--border-fine)] px-4 sm:px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link href={`/RMS/cbt/exams/${examId}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--text-secondary)]">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-[var(--foreground)]">
              Invigilation Monitor: {examTitle}
            </span>
            <Badge variant="outline" className="hidden sm:inline-flex font-mono text-xs bg-[var(--violet-tint)] text-[var(--violet-ink)] uppercase">
              Room: {roomCode}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-[var(--emerald-tint)] text-[#065f46] font-mono text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border-0">
            <span className="w-2 h-2 rounded-full bg-[var(--emerald-signal)] animate-pulse" />
            <span>Telemetry: Live</span>
          </Badge>
        </div>
      </header>

      {/* ── MAIN MONITOR BOARD ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Metric Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Active Candidates
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--foreground)] mt-1">
              {activeCount}
            </div>
          </div>

          <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--amber-signal)]">
              Flagged (Tab Switches)
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--amber-signal)] mt-1">
              {flaggedCount}
            </div>
          </div>

          <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--crimson-signal)]">
              Locked / Disqualified
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--crimson-signal)] mt-1">
              {lockedCount}
            </div>
          </div>

          <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--emerald-signal)]">
              Completed Submissions
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--emerald-signal)] mt-1">
              {candidates.filter((c) => c.status === "submitted").length}
            </div>
          </div>
        </div>

        {/* Action & Filter Bar */}
        <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-3" />
            <Input
              type="text"
              placeholder="Search candidate name or PIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs border-[var(--border-fine)] rounded-[var(--radius-md)]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(["all", "active", "flagged", "locked"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`h-8 px-3 rounded-[var(--radius-md)] text-xs font-semibold capitalize transition-all ${
                  filter === tab
                    ? "bg-[var(--violet-ink)] text-white shadow-xs"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

        </div>

        {/* Live Candidate Table */}
        <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-fine)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Candidate &amp; PIN</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Time Left</th>
                  <th className="py-3 px-4">Violations</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Invigilator Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-fine)] text-xs font-medium">
                {filteredCandidates.map((c) => {
                  const pct = Math.round((c.answeredCount / c.totalQuestions) * 100);

                  return (
                    <tr key={c.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                      
                      {/* Name & PIN */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-[var(--foreground)]">{c.name}</div>
                        <div className="font-mono text-[11px] text-[var(--text-secondary)]">PIN: {c.pin}</div>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-[var(--surface-muted)] h-2 rounded-full overflow-hidden border border-[var(--border-fine)]">
                            <div
                              className="bg-[var(--violet-ink)] h-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            {c.answeredCount}/{c.totalQuestions} ({pct}%)
                          </span>
                        </div>
                      </td>

                      {/* Time Left */}
                      <td className="py-3.5 px-4 font-mono font-semibold">
                        {c.status === "submitted" ? (
                          <span className="text-[var(--text-secondary)]">Submitted</span>
                        ) : (
                          <span>{c.timeRemainingMins} mins</span>
                        )}
                      </td>

                      {/* Violations */}
                      <td className="py-3.5 px-4">
                        {c.violations === 0 ? (
                          <span className="text-[var(--emerald-signal)] flex items-center gap-1 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>0 Clean</span>
                          </span>
                        ) : (
                          <Badge className="bg-[var(--amber-tint)] text-[#92400e] border border-[var(--amber-signal)]/30 font-mono text-[10px]">
                            ⚠️ {c.violations} Tab Switches
                          </Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {c.status === "active" && (
                          <Badge className="bg-[var(--emerald-tint)] text-[#065f46] font-semibold text-[10px] border-0">
                            Active
                          </Badge>
                        )}
                        {c.status === "flagged" && (
                          <Badge className="bg-[var(--amber-tint)] text-[#92400e] font-semibold text-[10px] border-0">
                            Flagged
                          </Badge>
                        )}
                        {c.status === "locked" && (
                          <Badge className="bg-[var(--crimson-tint)] text-[#991b1b] font-semibold text-[10px] border-0">
                            Locked
                          </Badge>
                        )}
                        {c.status === "submitted" && (
                          <Badge className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold text-[10px] border-0">
                            Finished
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        {c.status === "locked" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlockCandidate(c.id)}
                            className="h-7 text-[11px] border-[var(--amber-signal)] text-[var(--amber-signal)] hover:bg-[var(--amber-tint)] font-semibold rounded-[var(--radius-md)]"
                          >
                            Forgive &amp; Unlock
                          </Button>
                        ) : c.status !== "submitted" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddFiveMins(c.id)}
                              className="h-7 text-[11px] border-[var(--border-fine)] text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-[var(--radius-md)]"
                            >
                              +5 Mins
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleForceSubmit(c.id)}
                              className="h-7 text-[11px] border-[var(--crimson-signal)]/30 text-[var(--crimson-signal)] hover:bg-[var(--crimson-tint)] rounded-[var(--radius-md)]"
                            >
                              Force Submit
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-[var(--text-secondary)]">No action needed</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </main>

    </div>
  );
}
