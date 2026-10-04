"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  RotateCcw,
  BookOpen,
  Award,
  AlignLeft,
  FileText,
  Tag,
  Check
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadCandidateSession,
  saveAnswerToSession,
  toggleQuestionFlag,
  recordProctoringViolation,
  saveCandidateSession,
  CandidateSession,
  CbtQuestionType,
  ExamRubric
} from "@cbt/lib/cbtSessionManager";
import {
  useBufferAnswerMutation,
  useSubmitAttemptMutation,
} from "@cbt/store/cbtMicroserviceApi";

export interface QuestionItem {
  id: string;
  prompt: string;
  type: CbtQuestionType | "MULTI_SELECT";
  marks: number;
  section?: string;
  options?: Array<{
    id: string;
    text: string;
    keyLabel?: string; // 'A', 'B', 'C', 'D'
    isCorrect?: boolean;
  }>;
  minWords?: number;
  maxWords?: number;
  rubric?: ExamRubric;
  explanation?: string;
}

interface CandidateLiveExamProps {
  examCode: string;
  examTitle?: string;
  questions?: QuestionItem[];
}

export default function CandidateLiveExam({
  examCode,
  examTitle = "Online Assessment Examination",
  questions: initialQuestions = [],
}: CandidateLiveExamProps) {
  const router = useRouter();
  const [bufferAnswer] = useBufferAnswerMutation();
  const [submitAttempt] = useSubmitAttemptMutation();

  // Session state from local storage
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isRubricDialogOpen, setIsRubricDialogOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving">("synced");

  // Keep ref to avoid stale closures in listeners
  const sessionRef = useRef<CandidateSession | null>(null);
  sessionRef.current = session;

  const questions = useMemo<QuestionItem[]>(() => {
    const delivered = session?.questions;
    if (delivered && delivered.length > 0) {
      return delivered.map((q) => ({
        ...q,
        type: q.type === "ESSAY" ? "LONG_ESSAY" : q.type,
        options: q.options || [],
      })) as QuestionItem[];
    }
    return initialQuestions;
  }, [initialQuestions, session?.questions]);

  const resolvedExamTitle = session?.examTitle || examTitle;
  const maxTabViolations = session?.maxTabViolations ?? 3;
  const currentQ = questions[activeQuestionIdx] || questions[0];
  const selectedAnswer = currentQ ? session?.answers[currentQ.id] : undefined;
  const isFlagged = currentQ ? session?.flaggedQuestionIds.includes(currentQ.id) || false : false;

  // Local draft state for essay inputs (for smooth typing without re-render delays)
  const [essayDraft, setEssayDraft] = useState<string>("");
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync draft whenever current question changes
  useEffect(() => {
    if (!currentQ) return;
    const existing = session?.answers[currentQ.id];
    setEssayDraft(typeof existing === "string" ? existing : "");
  }, [currentQ?.id, session?.answers]);

  // 1. Initialize or restore session
  useEffect(() => {
    const active = loadCandidateSession(examCode);
    if (!active) {
      toast.error("No active CBT attempt was found. Please start from the exam lobby.");
      router.replace(`/take/${encodeURIComponent(examCode)}`);
      return;
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

        toast.error(`Malpractice Alert: Tab switch detected! (Violation ${violationCount} of ${maxTabViolations})`, {
          duration: 4000,
          icon: <ShieldAlert className="w-5 h-5 text-[var(--crimson-signal)]" />,
        });

        if (violationCount >= maxTabViolations) {
          handleFinalSubmit("malpractice");
        }
      }
    };

    const handleWindowBlur = () => {
      if (sessionRef.current) {
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
  }, [examCode, activeQuestionIdx, maxTabViolations]);

  // 4. Keyboard Navigation Hook (Linear-Style Speed for MCQ)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQ) return;
      // Don't intercept if student is in an open text input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
        goToNext();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") {
        goToPrev();
      } else if (e.key.toLowerCase() === "f") {
        handleToggleFlag();
      } else if (["a", "b", "c", "d"].includes(e.key.toLowerCase())) {
        if (currentQ.type === "MCQ" && currentQ.options && currentQ.options.length > 0) {
          const keyIndex = ["a", "b", "c", "d"].indexOf(e.key.toLowerCase());
          if (currentQ.options[keyIndex]) {
            e.preventDefault();
            selectChoice(currentQ.options[keyIndex].id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQ, activeQuestionIdx, session]);

  // Actions
  const selectChoice = (choiceId: string) => {
    if (!session || !currentQ) return;
    setSyncStatus("saving");
    const updated = saveAnswerToSession(examCode, session.candidatePin, currentQ.id, choiceId);
    if (updated) {
      setSession(updated);
      if (updated.attemptId) {
        bufferAnswer({
          attemptId: updated.attemptId,
          questionId: currentQ.id,
          selectedVal: choiceId,
        }).catch(() => {});
      }
      setTimeout(() => setSyncStatus("synced"), 150);
    }
  };

  // Essay Text Autosave with Debounce (300ms)
  const handleEssayChange = (text: string) => {
    setEssayDraft(text);
    setSyncStatus("saving");

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (!sessionRef.current) return;
      if (!currentQ) return;
      const updated = saveAnswerToSession(examCode, sessionRef.current.candidatePin, currentQ.id, text);
      if (updated) {
        setSession(updated);
        if (updated.attemptId) {
          bufferAnswer({
            attemptId: updated.attemptId,
            questionId: currentQ.id,
            selectedVal: text,
          }).catch(() => {});
        }
        setSyncStatus("synced");
      }
    }, 300);
  };

  const handleToggleFlag = () => {
    if (!session || !currentQ) return;
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

  // Check if exam contains essay questions
  const hasEssayQuestions = useMemo(() => {
    return questions.some((q) => q.type === "SHORT_ESSAY" || q.type === "LONG_ESSAY");
  }, [questions]);

  // Final Submit Handler
  const handleFinalSubmit = async (reason: "manual" | "timeout" | "malpractice" = "manual") => {
    if (!session) return;

    if (session.attemptId) {
      try {
        const resultSlip = await submitAttempt({
          attemptId: session.attemptId,
          finalAnswers: session.answers,
          autoSubmitted: reason === "timeout" || reason === "malpractice",
        }).unwrap();

        const completedSession: CandidateSession = {
          ...session,
          status: reason === "malpractice" ? "disqualified" : "submitted",
          gradingStatus: "AUTO_SCORED",
          score: resultSlip.score,
          totalMarks: resultSlip.totalMarks,
          percentage: resultSlip.percentage,
        };

        saveCandidateSession(completedSession);

        if (reason === "timeout") {
          toast.warning("Time limit expired. Your exam was automatically submitted.");
        } else if (reason === "malpractice") {
          toast.error("Exam locked due to repeated malpractice violations.");
        } else {
          toast.success("Examination submitted successfully.");
        }

        router.replace(`/take/${encodeURIComponent(examCode)}/results`);
        return;
      } catch (err: any) {
        const message = err?.data?.message || err?.message || "Submission could not reach the CBT microservice. Your answers remain saved locally.";
        toast.error(message);
        if (reason === "manual") return;
      }
    }

    let mcqScore = 0;
    let mcqTotalMarks = 0;
    let grandTotalMarks = 0;

    questions.forEach((q) => {
      grandTotalMarks += q.marks;
      if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
        mcqTotalMarks += q.marks;
        const userChoice = session.answers[q.id];
        // Find correct option
        const correctOpt = q.options?.find((o) => o.isCorrect) || q.options?.[0];
        if (userChoice && correctOpt && userChoice === correctOpt.id) {
          mcqScore += q.marks;
        }
      }
    });

    const isPendingReview = hasEssayQuestions;
    const percentage = isPendingReview
      ? (mcqTotalMarks > 0 ? Math.round((mcqScore / mcqTotalMarks) * 100) : 0)
      : (grandTotalMarks > 0 ? Math.round((mcqScore / grandTotalMarks) * 100) : 0);

    const completedSession: CandidateSession = {
      ...session,
      status: reason === "malpractice" ? "disqualified" : "submitted",
      gradingStatus: isPendingReview ? "PENDING_REVIEW" : "AUTO_SCORED",
      score: mcqScore,
      totalMarks: grandTotalMarks,
      mcqScore: mcqScore,
      essayScore: 0,
      percentage: percentage,
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
  const answeredCount = Object.keys(session?.answers || {}).filter(
    (k) => session?.answers[k] && session.answers[k].toString().trim().length > 0
  ).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = session?.flaggedQuestionIds.length || 0;

  // Essay word count stats
  const essayWordCount = useMemo(() => {
    if (!essayDraft || !essayDraft.trim()) return 0;
    return essayDraft.trim().split(/\s+/).filter(Boolean).length;
  }, [essayDraft]);

  const essayCharCount = essayDraft.length;

  if (!session || questions.length === 0 || !currentQ) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-6 shadow-[var(--shadow-card)]">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--amber-signal)]" />
          <h1 className="text-lg font-bold text-[var(--foreground)]">Exam session unavailable</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            This page needs a live CBT attempt from the microservice. Return to the lobby and start the exam again.
          </p>
          <Button
            onClick={() => router.replace(`/take/${encodeURIComponent(examCode)}`)}
            className="mt-5 bg-[var(--violet-ink)] text-white hover:bg-[var(--violet-hover)]"
          >
            Return to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)] select-none">
      
      {/* ── STICKY HUD HEADER (56px) ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 min-h-16 bg-white border-b border-[var(--border-fine)] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Exam Info & Progress */}
        <div className="flex items-center gap-3">
          <div className="font-bold text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-md">
            {resolvedExamTitle}
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
            aria-label="Toggle question navigator"
            aria-expanded={isMobilePaletteOpen}
            className="lg:hidden h-9 w-9 border-[var(--border-fine)]"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE (2-Column Grid) ───────────────────────────────── */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex gap-6 lg:gap-8 items-start">
        
        {/* Left Column: Question Canvas */}
        <main className="flex-1 min-w-0 bg-white p-5 sm:p-8 space-y-6">
          
          {/* Question Header & Meta */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-fine)] flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-base sm:text-lg text-[var(--foreground)]">
                Question {activeQuestionIdx + 1}
              </span>

              {/* Format Badge */}
              <Badge 
                variant="outline"
                className={`text-xs font-mono uppercase px-2 py-0.5 border ${
                  currentQ.type === "LONG_ESSAY"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : currentQ.type === "SHORT_ESSAY"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                {currentQ.type === "LONG_ESSAY" ? "Extended Essay" : currentQ.type === "SHORT_ESSAY" ? "Short Answer" : currentQ.type}
              </Badge>

              <span className="text-xs text-[var(--text-secondary)] font-mono">
                ({currentQ.marks} {currentQ.marks === 1 ? "Mark" : "Marks"})
              </span>

              {/* Rubric View Button for candidates */}
              {currentQ.rubric && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRubricDialogOpen(true)}
                  className="h-7 px-2.5 text-xs font-semibold border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md flex items-center gap-1"
                >
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>View Scoring Rubric</span>
                </Button>
              )}
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

          {/* Section Indicator */}
          {currentQ.section && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200/60 w-fit">
              <Tag className="w-3.5 h-3.5 text-violet-600" />
              <span>{currentQ.section}</span>
            </div>
          )}

          {/* Question Prompt */}
          <div className="text-base sm:text-lg leading-relaxed text-[var(--foreground)] font-medium select-text">
            {currentQ.prompt}
          </div>

          {/* ── CONDITIONAL CANVAS: MCQs & TRUE/FALSE ── */}
          {(currentQ.type === "MCQ" || currentQ.type === "TRUE_FALSE") && currentQ.options && (
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
          )}

          {/* ── CONDITIONAL CANVAS: SHORT ESSAY (20 - 100 words) ── */}
          {currentQ.type === "SHORT_ESSAY" && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlignLeft className="w-3.5 h-3.5 text-amber-600" />
                  <span>Short Answer Response</span>
                  {currentQ.minWords && currentQ.maxWords && (
                    <span className="text-[11px] text-slate-400">
                      (Guideline: {currentQ.minWords}–{currentQ.maxWords} words)
                    </span>
                  )}
                </span>
                <span className={`font-mono text-xs font-bold ${
                  currentQ.minWords && essayWordCount < currentQ.minWords
                    ? "text-amber-600"
                    : currentQ.maxWords && essayWordCount > currentQ.maxWords
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}>
                  {essayWordCount} words &bull; {essayCharCount} characters
                </span>
              </div>

              <textarea
                rows={5}
                value={essayDraft}
                onChange={(e) => handleEssayChange(e.target.value)}
                placeholder="Type your concise response here. Be precise and address key definitions, principles, or derivations..."
                className="w-full p-4 text-sm sm:text-base font-normal leading-relaxed rounded-[var(--radius-md)] border border-slate-300 bg-white text-[var(--foreground)] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none select-text resize-y"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Autosaved continuously to session and cloud backup.</span>
                {syncStatus === "saving" && <span className="text-amber-600 font-medium">Saving keystrokes...</span>}
              </div>
            </div>
          )}

          {/* ── CONDITIONAL CANVAS: LONG ESSAY (150 - 800 words) ── */}
          {currentQ.type === "LONG_ESSAY" && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Comprehensive Essay Canvas</span>
                  {currentQ.minWords && (
                    <span className="text-[11px] text-slate-400">
                      (Minimum required: {currentQ.minWords} words)
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-bold ${
                    currentQ.minWords && essayWordCount < currentQ.minWords
                      ? "text-amber-600"
                      : "text-emerald-700"
                  }`}>
                    {essayWordCount} words &bull; {essayCharCount} chars
                  </span>
                </div>
              </div>

              <textarea
                rows={12}
                value={essayDraft}
                onChange={(e) => handleEssayChange(e.target.value)}
                placeholder="Craft your comprehensive essay here. Structure your arguments clearly with introductory thesis, body paragraphs, and concluding synthesis..."
                className="w-full p-4 text-sm sm:text-base font-normal leading-relaxed rounded-[var(--radius-md)] border border-slate-300 bg-white text-[var(--foreground)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none select-text resize-y"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Your writing is automatically persisted across browser refreshes.</span>
                {syncStatus === "saving" && <span className="text-blue-600 font-medium">Syncing essay...</span>}
              </div>
            </div>
          )}

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

            {currentQ.type === "MCQ" ? (
              <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
                Use keyboard keys <Kbd>A</Kbd>-<Kbd>D</Kbd> to select
              </span>
            ) : (
              <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
                Press Next to save &amp; continue
              </span>
            )}

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

        {/* Mobile Backdrop Overlay (< lg) */}
        {isMobilePaletteOpen && (
          <div
            onClick={() => setIsMobilePaletteOpen(false)}
            className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-2xs transition-opacity"
          />
        )}

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

          {/* Palette Grid (5 columns) */}
          <div className="flex-1 overflow-y-auto max-h-[380px] grid grid-cols-5 gap-2 pr-1">
            {questions.map((q, idx) => {
              const answerVal = session?.answers[q.id];
              const isAnswered = answerVal && answerVal.toString().trim().length > 0;
              const isCurrent = idx === activeQuestionIdx;
              const hasFlag = session?.flaggedQuestionIds.includes(q.id);

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setActiveQuestionIdx(idx);
                    setIsMobilePaletteOpen(false);
                  }}
                  className={`h-11 w-full rounded-[var(--radius-md)] font-mono text-xs font-bold relative transition-all flex flex-col items-center justify-center ${
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
                  {q.type !== "MCQ" && (
                    <span className="text-[8px] uppercase tracking-tighter opacity-70">
                      {q.type === "SHORT_ESSAY" ? "S" : q.type === "LONG_ESSAY" ? "L" : "TF"}
                    </span>
                  )}

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

      {/* ── CANDIDATE SCORING RUBRIC DIALOG ──────────────────────────────── */}
      <Dialog open={isRubricDialogOpen} onOpenChange={setIsRubricDialogOpen}>
        <DialogContent className="max-w-lg bg-white border border-slate-200 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>{currentQ.rubric?.name || "Marking Rubric Criteria"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              This question will be scored by examiners according to the following academic rubric (Total: {currentQ.rubric?.totalMarks || currentQ.marks} Marks).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {currentQ.rubric?.criteria?.map((crit, idx) => (
              <div key={crit.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between font-bold text-xs text-slate-800">
                  <span>{crit.title}</span>
                  <Badge variant="outline" className="font-mono text-amber-700 bg-amber-50 border-amber-200">
                    Max: {crit.maxMarks} Marks
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {crit.description}
                </p>
                {crit.levels && crit.levels.length > 0 && (
                  <div className="pt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                    {crit.levels.map((lvl, lIdx) => (
                      <div key={lIdx} className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="font-semibold text-slate-700">{lvl.label} ({lvl.points}m): </span>
                        <span className="text-slate-500">{lvl.descriptor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => setIsRubricDialogOpen(false)}
              className="bg-slate-900 text-white"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUBMIT CONFIRMATION ALERT DIALOG ─────────────────────────────── */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent className="max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Confirm Exam Submission
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[var(--text-secondary)] pt-2">
              Are you sure you want to end your examination session? Once submitted, answers cannot be altered.
            </AlertDialogDescription>
            <div className="space-y-3 pt-2">
              {hasEssayQuestions && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-md text-xs text-amber-800">
                  <strong>Notice:</strong> This examination includes essay questions. Your objective questions will be scored immediately, while your essays will be submitted for examiner and AI evaluation.
                </div>
              )}

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
            </div>
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

      {/* ── FOOTER WATERMARK ─────────────────────────────────────────────── */}
      <footer className="py-3 px-4 border-t border-[var(--border-fine)] bg-white/60 text-center text-[11px] text-[var(--text-secondary)]">
        Powered by <strong className="text-violet-700">ParaLearn CBT</strong> &bull; High-Concurrency Assessment Engine
      </footer>

    </div>
  );
}
