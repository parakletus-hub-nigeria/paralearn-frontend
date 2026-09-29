"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Timer,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Send,
  Wifi,
  Menu,
  X,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  loadCandidateSession,
  saveAnswerToSession,
  toggleQuestionFlag,
  recordProctoringViolation,
  saveCandidateSession,
  CandidateSession
} from "@/lib/cbtSessionManager";

export interface QuestionItem {
  id: string;
  prompt: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "ESSAY";
  marks: number;
  options: Array<{
    id: string;
    text: string;
    keyLabel?: string; // 'A', 'B', 'C', 'D'
  }>;
  explanation?: string;
}

interface CandidateLiveExamProps {
  examCode: string;
  examTitle?: string;
  questions?: QuestionItem[];
}

// Sample fallback questions if testing without backend payload
const DEFAULT_QUESTIONS: QuestionItem[] = [
  {
    id: "q1",
    prompt: "What is the primary function of chlorophyll in green plants?",
    type: "MCQ",
    marks: 2.0,
    options: [
      { id: "c1", text: "To absorb light energy for photosynthesis", keyLabel: "A" },
      { id: "c2", text: "To absorb water directly from the atmosphere", keyLabel: "B" },
      { id: "c3", text: "To release oxygen into the soil", keyLabel: "C" },
      { id: "c4", text: "To store starch in the plant stem", keyLabel: "D" },
    ],
  },
  {
    id: "q2",
    prompt: "A body of mass 4 kg is moving with a constant velocity of 10 m/s. Calculate its momentum.",
    type: "MCQ",
    marks: 2.0,
    options: [
      { id: "c1", text: "2.5 kg·m/s", keyLabel: "A" },
      { id: "c2", text: "40 kg·m/s", keyLabel: "B" },
      { id: "c3", text: "200 kg·m/s", keyLabel: "C" },
      { id: "c4", text: "14 kg·m/s", keyLabel: "D" },
    ],
  },
  {
    id: "q3",
    prompt: "Sound travels faster in solids than in gases due to higher density and molecular elasticity.",
    type: "TRUE_FALSE",
    marks: 1.0,
    options: [
      { id: "c1", text: "True", keyLabel: "A" },
      { id: "c2", text: "False", keyLabel: "B" },
    ],
  },
  {
    id: "q4",
    prompt: "Which of the following compounds is an unsaturated hydrocarbon?",
    type: "MCQ",
    marks: 2.0,
    options: [
      { id: "c1", text: "Methane (CH4)", keyLabel: "A" },
      { id: "c2", text: "Ethane (C2H6)", keyLabel: "B" },
      { id: "c3", text: "Ethene (C2H4)", keyLabel: "C" },
      { id: "c4", text: "Propane (C3H8)", keyLabel: "D" },
    ],
  },
  {
    id: "q5",
    prompt: "The Nigerian National Assembly consists of how many chambers?",
    type: "MCQ",
    marks: 1.0,
    options: [
      { id: "c1", text: "One chamber (Unicameral)", keyLabel: "A" },
      { id: "c2", text: "Two chambers (Senate and House of Representatives)", keyLabel: "B" },
      { id: "c3", text: "Three chambers", keyLabel: "C" },
      { id: "c4", text: "Four chambers", keyLabel: "D" },
    ],
  },
];

export default function CandidateLiveExam({
  examCode,
  examTitle = "Online Assessment Examination",
  questions = DEFAULT_QUESTIONS,
}: CandidateLiveExamProps) {
  const router = useRouter();

  // Session state from local storage
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving">("synced");

  // Keep ref to avoid stale closures in listeners
  const sessionRef = useRef<CandidateSession | null>(null);
  sessionRef.current = session;

  const currentQ = questions[activeQuestionIdx] || questions[0];
  const selectedAnswer = session?.answers[currentQ.id];
  const isFlagged = session?.flaggedQuestionIds.includes(currentQ.id) || false;

  // 1. Initialize or restore session
  useEffect(() => {
    let active = loadCandidateSession(examCode);
    if (!active) {
      // Create session on the fly if user directly opened live route
      active = {
        examCode: examCode.toUpperCase(),
        candidateName: "Walk-in Candidate",
        candidatePin: "DEFAULT",
        startedAt: new Date().toISOString(),
        durationMins: 60,
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        answers: {},
        flaggedQuestionIds: [],
        violations: [],
        status: "in_progress",
      };
      saveCandidateSession(active);
    }

    if (active.status === "submitted" || active.status === "disqualified") {
      router.replace(`/take/${encodeURIComponent(examCode)}/results`);
      return;
    }

    setSession(active);

    // Calculate remaining seconds
    const deadlineTime = new Date(active.deadline).getTime();
    const now = Date.now();
    const diffSecs = Math.max(0, Math.floor((deadlineTime - now) / 1000));
    setSecondsRemaining(diffSecs);
  }, [examCode, router]);

  // 2. High-precision countdown timer
  useEffect(() => {
    if (!session || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  // 3. Tab-switch & Malpractice detection listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionRef.current) {
        const { violationCount, session: updated } = recordProctoringViolation(
          examCode,
          sessionRef.current.candidatePin,
          "tab_switch",
          activeQuestionIdx
        );

        if (updated) setSession(updated);

        toast.error(`Malpractice Alert: Tab switch detected! (Violation ${violationCount} of 3)`, {
          duration: 4000,
          icon: <ShieldAlert className="w-5 h-5 text-[var(--crimson-signal)]" />,
        });

        if (violationCount >= 3) {
          handleFinalSubmit("malpractice");
        }
      }
    };

    const handleWindowBlur = () => {
      if (sessionRef.current) {
        // Increment window blur telemetry
        recordProctoringViolation(
          examCode,
          sessionRef.current.candidatePin,
          "window_blur",
          activeQuestionIdx
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [examCode, activeQuestionIdx]);

  // 4. Keyboard Navigation Hook (Linear-Style Speed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if student is in an open text input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const key = e.key.toUpperCase();

      // 1. Next / Previous
      if (key === "N" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (key === "P" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (key === "F") {
        e.preventDefault();
        handleToggleFlag();
      }

      // 2. Choice selection: A, B, C, D
      if (["A", "B", "C", "D"].includes(key) && currentQ.options) {
        const keyIndex = ["A", "B", "C", "D"].indexOf(key);
        if (currentQ.options[keyIndex]) {
          e.preventDefault();
          selectChoice(currentQ.options[keyIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQ, activeQuestionIdx, session]);

  // Actions
  const selectChoice = (choiceId: string) => {
    if (!session) return;
    setSyncStatus("saving");
    const updated = saveAnswerToSession(examCode, session.candidatePin, currentQ.id, choiceId);
    if (updated) {
      setSession(updated);
      setTimeout(() => setSyncStatus("synced"), 150);
    }
  };

  const handleToggleFlag = () => {
    if (!session) return;
    const { session: updated } = toggleQuestionFlag(examCode, session.candidatePin, currentQ.id);
    if (updated) setSession(updated);
  };

  const goToNext = () => {
    if (activeQuestionIdx < questions.length - 1) {
      setActiveQuestionIdx((i) => i + 1);
    }
  };

  const goToPrev = () => {
    if (activeQuestionIdx > 0) {
      setActiveQuestionIdx((i) => i - 1);
    }
  };

  const handleFinalSubmit = (reason: "manual" | "timeout" | "malpractice" = "manual") => {
    if (!session) return;

    // Calculate score
    let totalScore = 0;
    let maxScore = 0;

    questions.forEach((q) => {
      maxScore += q.marks;
      const userChoice = session.answers[q.id];
      // For MCQ/TF, first option is treated as correct in default mock
      const correctOption = q.options[0]?.id;
      if (userChoice && userChoice === correctOption) {
        totalScore += q.marks;
      }
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    const completedSession: CandidateSession = {
      ...session,
      status: reason === "malpractice" ? "disqualified" : "submitted",
      score: totalScore,
      totalMarks: maxScore,
      percentage,
    };

    saveCandidateSession(completedSession);

    if (reason === "timeout") {
      toast.warning("Time limit expired. Your exam was automatically submitted.");
    } else if (reason === "malpractice") {
      toast.error("Exam locked due to repeated malpractice violations.");
    } else {
      toast.success("Examination submitted successfully!");
    }

    router.replace(`/take/${encodeURIComponent(examCode)}/results`);
  };

  // Timer formatting (mm:ss)
  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Counts
  const answeredCount = Object.keys(session?.answers || {}).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = session?.flaggedQuestionIds.length || 0;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)] select-none">
      
      {/* ── STICKY HUD HEADER (56px) ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[var(--border-fine)] px-4 sm:px-6 flex items-center justify-between shadow-[var(--shadow-card)]">
        {/* Left: Exam Info & Progress */}
        <div className="flex items-center gap-3">
          <div className="font-bold text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-md">
            {examTitle}
          </div>
          <Badge 
            variant="outline"
            className="hidden sm:inline-flex bg-[var(--surface-muted)] text-[var(--foreground)] border-[var(--border-fine)] text-xs font-mono"
          >
            Question {activeQuestionIdx + 1} of {questions.length}
          </Badge>
        </div>

        {/* Center: Timer Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-pill)] font-mono text-sm font-bold border transition-colors ${
              secondsRemaining < 60
                ? "bg-[var(--crimson-tint)] border-[var(--crimson-signal)] text-[#991b1b] animate-pulse"
                : secondsRemaining < 300
                ? "bg-[var(--amber-tint)] border-[var(--amber-signal)] text-[#92400e]"
                : "bg-[var(--surface-muted)] border-[var(--border-fine)] text-[var(--foreground)]"
            }`}
          >
            <Timer className="w-4 h-4 shrink-0" />
            <span className="tabular-nums">{formatTimer(secondsRemaining)}</span>
          </div>

          {/* Sync chip */}
          <div className="hidden md:flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-medium">
            <span className={`w-2 h-2 rounded-full ${syncStatus === "synced" ? "bg-[var(--emerald-signal)]" : "bg-[var(--amber-signal)]"}`} />
            <span>{syncStatus === "synced" ? "Synced" : "Saving..."}</span>
          </div>
        </div>

        {/* Right: Actions & Palette Mobile Toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsSubmitDialogOpen(true)}
            className="h-9 px-4 text-xs font-bold bg-[var(--foreground)] hover:bg-[var(--foreground)]/90 text-white rounded-[var(--radius-md)]"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            <span>Submit Exam</span>
          </Button>

          {/* Mobile Palette Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            className="lg:hidden h-9 w-9 border-[var(--border-fine)]"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (2-Column Grid) ───────────────────────────────── */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Question Canvas */}
        <main className="flex-1 min-w-0 bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-5 sm:p-8 shadow-[var(--shadow-card)] space-y-6">
          
          {/* Question Header & Meta */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-fine)]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-[var(--foreground)]">
                Question {activeQuestionIdx + 1}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                ({currentQ.marks} {currentQ.marks === 1 ? "Mark" : "Marks"})
              </span>
            </div>

            {/* Flag Review Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFlag}
              className={`h-8 px-3 text-xs font-semibold rounded-[var(--radius-md)] border transition-all ${
                isFlagged
                  ? "bg-[var(--amber-tint)] border-[var(--amber-signal)] text-[#92400e]"
                  : "bg-white border-[var(--border-fine)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 mr-1.5 ${isFlagged ? "fill-current" : ""}`} />
              <span>{isFlagged ? "Flagged for Review" : "Flag for Review"}</span>
              <Kbd className="ml-1.5 hidden sm:inline-flex">F</Kbd>
            </Button>
          </div>

          {/* Question Prompt */}
          <div className="text-base sm:text-lg leading-relaxed text-[var(--foreground)] font-medium">
            {currentQ.prompt}
          </div>

          {/* Option Choices */}
          <div className="space-y-3 pt-2">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedAnswer === opt.id;
              const keyLabel = opt.keyLabel || ["A", "B", "C", "D"][idx] || String(idx + 1);

              return (
                <div
                  key={opt.id}
                  onClick={() => selectChoice(opt.id)}
                  className={`w-full min-h-[56px] p-3.5 sm:p-4 rounded-[var(--radius-md)] border text-left cursor-pointer transition-all flex items-center gap-3.5 ${
                    isSelected
                      ? "bg-[var(--violet-tint)] border-[var(--violet-ink)] text-[var(--foreground)] shadow-xs ring-1 ring-[var(--violet-ink)]"
                      : "bg-white border-[var(--border-fine)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] hover:border-[var(--border-medium)]"
                  }`}
                >
                  {/* Key Label Badge */}
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[var(--violet-ink)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {keyLabel}
                  </span>

                  {/* Choice Text */}
                  <span className="flex-1 text-sm sm:text-base font-normal leading-snug">
                    {opt.text}
                  </span>

                  {/* Keyboard shortcut hint */}
                  <Kbd className="hidden sm:inline-flex opacity-40">{keyLabel}</Kbd>
                </div>
              );
            })}
          </div>

          {/* Bottom Navigation Toolbar */}
          <div className="pt-6 border-t border-[var(--border-fine)] flex items-center justify-between">
            <Button
              variant="outline"
              disabled={activeQuestionIdx === 0}
              onClick={goToPrev}
              className="h-11 px-4 sm:px-5 font-semibold text-xs sm:text-sm bg-[var(--surface-muted)] hover:bg-[var(--surface-muted)]/80 text-[var(--foreground)] border-[var(--border-fine)] rounded-[var(--radius-md)]"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Previous</span>
              <Kbd className="ml-2 hidden sm:inline-flex">P</Kbd>
            </Button>

            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
              Use keyboard keys <Kbd>A</Kbd>-<Kbd>D</Kbd> to select
            </span>

            {activeQuestionIdx < questions.length - 1 ? (
              <Button
                onClick={goToNext}
                className="h-11 px-4 sm:px-5 font-bold text-xs sm:text-sm bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)]"
              >
                <span>Next Question</span>
                <Kbd className="ml-2 hidden sm:inline-flex bg-white/20 text-white">N</Kbd>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => setIsSubmitDialogOpen(true)}
                className="h-11 px-5 font-bold text-xs sm:text-sm bg-[var(--emerald-signal)] hover:bg-[var(--emerald-signal)]/90 text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)]"
              >
                <span>Review &amp; Submit</span>
                <Send className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </main>

        {/* Right Column: Question Palette Grid (300px, Sticky) */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-40 w-72 sm:w-80 bg-white border-l lg:border border-[var(--border-fine)] lg:rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-dialog)] lg:shadow-[var(--shadow-card)] flex flex-col transition-transform ${
            isMobilePaletteOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-fine)] mb-4">
            <h3 className="font-bold text-sm tracking-tight text-[var(--foreground)]">
              Question Palette
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobilePaletteOpen(false)}
              className="lg:hidden h-7 w-7"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Palette Grid (5 columns, 44x44px target) */}
          <div className="flex-1 overflow-y-auto max-h-[380px] grid grid-cols-5 gap-2 pr-1">
            {questions.map((q, idx) => {
              const isAnswered = !!session?.answers[q.id];
              const isCurrent = idx === activeQuestionIdx;
              const hasFlag = session?.flaggedQuestionIds.includes(q.id);

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setActiveQuestionIdx(idx);
                    setIsMobilePaletteOpen(false);
                  }}
                  className={`h-11 w-full rounded-[var(--radius-md)] font-mono text-xs font-bold relative transition-all flex items-center justify-center ${
                    isCurrent
                      ? "ring-2 ring-[var(--violet-ink)] shadow-xs"
                      : ""
                  } ${
                    isAnswered
                      ? "bg-[var(--emerald-tint)] text-[#065f46] border border-[#a7f3d0]"
                      : "bg-white text-[var(--text-secondary)] border border-[var(--border-fine)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <span>{idx + 1}</span>

                  {/* Flag indicator dot */}
                  {hasFlag && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--amber-signal)] ring-1 ring-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Palette Legend */}
          <div className="pt-4 border-t border-[var(--border-fine)] mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-[var(--radius-xs)] bg-[var(--emerald-tint)] border border-[#a7f3d0]" />
                <span>Answered</span>
              </div>
              <span className="font-mono font-bold text-[var(--foreground)]">{answeredCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-[var(--radius-xs)] bg-white border border-[var(--border-fine)]" />
                <span>Unanswered</span>
              </div>
              <span className="font-mono font-bold text-[var(--foreground)]">{unansweredCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-[var(--radius-xs)] bg-[var(--amber-tint)] border border-[var(--amber-signal)]/40 relative">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber-signal)] absolute top-0.5 right-0.5" />
                </span>
                <span>Flagged</span>
              </div>
              <span className="font-mono font-bold text-[var(--foreground)]">{flaggedCount}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── SUBMIT CONFIRMATION ALERT DIALOG ─────────────────────────────── */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent className="max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Confirm Exam Submission
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[var(--text-secondary)] space-y-3 pt-2">
              <p>
                Are you sure you want to end your examination session? Once submitted, answers cannot be altered.
              </p>
              
              <div className="bg-[var(--surface-muted)] p-3.5 rounded-[var(--radius-md)] border border-[var(--border-fine)] text-xs text-[var(--foreground)] grid grid-cols-3 gap-2 text-center font-mono">
                <div>
                  <div className="text-[var(--text-secondary)] uppercase text-[10px]">Answered</div>
                  <div className="text-base font-bold text-[var(--emerald-signal)]">{answeredCount}</div>
                </div>
                <div>
                  <div className="text-[var(--text-secondary)] uppercase text-[10px]">Unanswered</div>
                  <div className="text-base font-bold text-[var(--crimson-signal)]">{unansweredCount}</div>
                </div>
                <div>
                  <div className="text-[var(--text-secondary)] uppercase text-[10px]">Flagged</div>
                  <div className="text-base font-bold text-[var(--amber-signal)]">{flaggedCount}</div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-10 px-4 text-xs font-semibold rounded-[var(--radius-md)] border-[var(--border-fine)]">
              Return to Exam
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleFinalSubmit("manual")}
              className="h-10 px-5 text-xs font-bold bg-[var(--emerald-signal)] hover:bg-[var(--emerald-signal)]/90 text-white rounded-[var(--radius-md)]"
            >
              Confirm Final Submission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
