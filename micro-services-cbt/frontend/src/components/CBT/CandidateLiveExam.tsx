"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  Timer,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Send,
  Award,
  AlignLeft,
  FileText,
  Check,
  Loader2,
  WifiOff,
  CloudUpload,
  LayoutGrid,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
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
  ExamRubric,
} from "@cbt/lib/cbtSessionManager";
import {
  deviceNow,
  hasQueuedSubmission,
  queueAnswer,
  queueSubmission,
  queueTelemetry,
  startCbtSync,
  subscribeSyncState,
  syncNow,
  warmOfflineCache,
  SUBMISSION_SYNCED_EVENT,
  type CbtSyncState,
} from "@cbt/lib/cbtOfflineSync";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-candidate.css";

/** Keys that pick options A–F, in on-screen order */
const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"];
const OBJECTIVE = new Set(["MCQ", "TRUE_FALSE", "MULTI_SELECT"]);
const TYPE_LABELS: Record<string, string> = {
  MCQ: "Multiple choice",
  TRUE_FALSE: "True / False",
  MULTI_SELECT: "Multiple answers",
  SHORT_ESSAY: "Short Answer",
  LONG_ESSAY: "Extended Essay",
};

/** Wall-clock and monotonic readings when this page started timing each attempt */
const clockBases = new Map<string, { wall: number; mono: number }>();

/**
 * Seconds left before the server deadline, on the server-corrected device
 * clock. Setting the device clock back while offline neither rewinds nor
 * pauses the countdown: within the page it also advances on the monotonic
 * clock, and the latest time seen is kept across reloads.
 */
function secondsLeft(session: CandidateSession): number {
  const key = `paralearn_cbt_clock_${session.attemptId || session.examCode}`;
  let latestSeen = 0;
  try {
    latestSeen = Number(localStorage.getItem(key) || 0);
  } catch {}

  let base = clockBases.get(key);
  if (!base) {
    base = { wall: Math.max(deviceNow(session), latestSeen), mono: performance.now() };
    clockBases.set(key, base);
  }
  const now = Math.max(
    deviceNow(session),
    latestSeen,
    base.wall + (performance.now() - base.mono),
  );
  try {
    localStorage.setItem(key, String(now));
  } catch {}
  return Math.max(0, Math.floor((new Date(session.deadline).getTime() - now) / 1000));
}

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

  // Session state from local storage
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isRubricDialogOpen, setIsRubricDialogOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  // Tab-switch warning the candidate must acknowledge (shown on return to the page)
  const [violationNotice, setViolationNotice] = useState<{ count: number; max: number } | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<"synced" | "saving">("synced");

  // Connection and outbox status for the header chip
  const [syncState, setSyncState] = useState<CbtSyncState>({ online: true, pending: 0 });

  // Submission state: guards against double submits (timer + button + malpractice).
  // "queued" = submitted on this device, waiting for a connection to send it.
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "queued" | "failed">("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const submittingRef = useRef(false);
  // Essay text typed but not yet past the autosave debounce
  const pendingEssayRef = useRef<{ questionId: string; text: string } | null>(null);

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
  const isFlagged = currentQ
    ? session?.flaggedQuestionIds.includes(currentQ.id) || false
    : false;

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
      toast.error(
        "No active CBT attempt was found. Please start from the exam lobby.",
      );
      router.replace(`/take/${encodeURIComponent(examCode)}`);
      return;
    }

    if (active.status === "submitted" || active.status === "disqualified") {
      router.replace(`/take/${encodeURIComponent(examCode)}/results`);
      return;
    }

    setSession(active);
    sessionRef.current = active;

    const diffSecs = secondsLeft(active);
    setSecondsRemaining(diffSecs);

    // A submission waiting for a connection picks up where it left off; so does
    // an exam reopened after its time ran out (the timer never starts at 0)
    if (active.pendingSubmit) {
      handleFinalSubmit(active.pendingSubmit.reason);
    } else if (diffSecs === 0) {
      handleFinalSubmit("timeout");
    }
  }, [examCode, router]);

  // 2. High-precision countdown timer
  useEffect(() => {
    if (!session || secondsRemaining <= 0) return;

    // Recomputed from the deadline each tick, so a sleeping device catches up
    const timer = setInterval(() => {
      const current = sessionRef.current;
      if (!current) return;
      const left = secondsLeft(current);
      setSecondsRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        handleFinalSubmit("timeout");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  // 3. Tab-switch & Malpractice detection listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && sessionRef.current && !submittingRef.current) {
        const { violationCount, session: updated } = recordProctoringViolation(
          examCode,
          sessionRef.current.candidatePin,
          "tab_switch",
          activeQuestionIdx,
        );

        if (updated) {
          setSession(updated);
          void queueTelemetry(updated, "tab_switch", activeQuestionIdx);
        }

        if (violationCount < maxTabViolations) {
          setViolationNotice({ count: violationCount, max: maxTabViolations });
        }

        if (violationCount >= maxTabViolations) {
          handleFinalSubmit("malpractice");
        }
      }
    };

    // Only tab switches count. A tab switch also fires window blur, so counting blur
    // too recorded two violations per switch and disqualified candidates early.
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [examCode, activeQuestionIdx, maxTabViolations]);

  // 4. Keyboard Navigation Hook (Linear-Style Speed for MCQ)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentQ) return;
      // Leave browser shortcuts (Ctrl+C, Cmd+P...) and open dialogs alone
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isSubmitDialogOpen || isRubricDialogOpen || violationNotice || submittingRef.current) return;
      // Don't intercept if student is in an open text input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
        goToNext();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") {
        goToPrev();
      } else if (e.key.toLowerCase() === "f") {
        handleToggleFlag();
      } else if (OPTION_KEYS.includes(e.key.toLowerCase())) {
        const option = currentQ.options?.[OPTION_KEYS.indexOf(e.key.toLowerCase())];
        if (option && OBJECTIVE.has(currentQ.type)) {
          e.preventDefault();
          if (currentQ.type === "MULTI_SELECT") toggleChoice(option.id);
          else selectChoice(option.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQ, activeQuestionIdx, session, isSubmitDialogOpen, isRubricDialogOpen, violationNotice]);

  // Actions
  const selectChoice = (choiceId: string) => {
    if (!session || !currentQ || submittingRef.current) return;
    setSyncStatus("saving");
    const updated = saveAnswerToSession(
      examCode,
      session.candidatePin,
      currentQ.id,
      choiceId,
    );
    if (updated) {
      setSession(updated);
      void queueAnswer(updated, currentQ.id, choiceId);
      setTimeout(() => setSyncStatus("synced"), 150);
    }
  };

  // Essay Text Autosave with Debounce (300ms)
  const handleEssayChange = (text: string) => {
    if (submittingRef.current) return;
    setEssayDraft(text);
    setSyncStatus("saving");
    if (currentQ) pendingEssayRef.current = { questionId: currentQ.id, text };

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (!sessionRef.current) return;
      if (!currentQ) return;
      const updated = saveAnswerToSession(
        examCode,
        sessionRef.current.candidatePin,
        currentQ.id,
        text,
      );
      if (updated) {
        setSession(updated);
        void queueAnswer(updated, currentQ.id, text);
        setSyncStatus("synced");
      }
      pendingEssayRef.current = null;
    }, 300);
  };

  // Multiple-answer questions: add or remove one option
  const toggleChoice = (choiceId: string) => {
    if (!session || !currentQ || submittingRef.current) return;
    const current = session.answers[currentQ.id];
    const chosen = Array.isArray(current) ? current : current ? [String(current)] : [];
    const next = chosen.includes(choiceId) ? chosen.filter((id) => id !== choiceId) : [...chosen, choiceId];
    setSyncStatus("saving");
    const updated = saveAnswerToSession(examCode, session.candidatePin, currentQ.id, next);
    if (updated) {
      setSession(updated);
      void queueAnswer(updated, currentQ.id, next);
      setTimeout(() => setSyncStatus("synced"), 150);
    }
  };

  const handleToggleFlag = () => {
    if (!session || !currentQ) return;
    const { session: updated } = toggleQuestionFlag(
      examCode,
      session.candidatePin,
      currentQ.id,
    );
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
    return questions.some(
      (q) => q.type === "SHORT_ESSAY" || q.type === "LONG_ESSAY",
    );
  }, [questions]);

  // Once the server has scored the submission, show the result; otherwise
  // reflect whether it is waiting for a connection or was rejected
  // Both the submit handler and the sync event call this; only the first should announce and redirect
  const finishedRef = useRef(false);
  const finishIfSynced = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const latest = loadCandidateSession(examCode, current.candidatePin);
    if (!latest) return;

    if (latest.status !== "in_progress") {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const reason = current.pendingSubmit?.reason;
      if (latest.status === "disqualified" || reason === "malpractice") {
        toast.error("Exam locked due to repeated malpractice violations.");
      } else if (reason === "timeout") {
        toast.warning("Time limit expired. Your exam was automatically submitted.");
      } else {
        toast.success("Examination submitted successfully.");
      }
      router.replace(`/take/${encodeURIComponent(examCode)}/results`);
      return;
    }

    sessionRef.current = latest;
    setSession(latest);
    if (latest.pendingSubmit?.error) {
      setSubmitState("failed");
      setSubmitError(latest.pendingSubmit.error);
    } else if (latest.pendingSubmit) {
      setSubmitState("queued");
    }
  }, [examCode, router]);

  // Final submit: the answer sheet is locked in on this device and queued for
  // the server. Online it is sent and scored straight away; offline it waits
  // in the outbox and is sent when the device reconnects.
  const handleFinalSubmit = async (
    reason: "manual" | "timeout" | "malpractice" = "manual",
  ) => {
    const current = sessionRef.current;
    if (!current || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitDialogOpen(false);
    setSubmitState("sending");
    setSubmitError("");

    // Include an essay answer still waiting on its autosave
    const answers = { ...current.answers };
    if (pendingEssayRef.current) {
      answers[pendingEssayRef.current.questionId] = pendingEssayRef.current.text;
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
      pendingEssayRef.current = null;
    }

    if (!current.attemptId) {
      submittingRef.current = false;
      setSubmitState("failed");
      setSubmitError(
        "This exam session was not registered with the server. Please ask your examiner for help.",
      );
      return;
    }

    const pending: CandidateSession = {
      ...current,
      answers,
      pendingSubmit: current.pendingSubmit
        ? { ...current.pendingSubmit, error: undefined }
        : {
            reason,
            since: new Date().toISOString(),
            submittedAt: new Date(deviceNow(current)).toISOString(),
          },
    };
    saveCandidateSession(pending);
    sessionRef.current = pending;
    setSession(pending);

    try {
      if (!(await hasQueuedSubmission(current.attemptId))) {
        await queueSubmission(pending, answers);
      }
      await syncNow();
    } catch (err) {
      console.warn("[CBT Live] Could not queue the submission:", err);
    }
    finishIfSynced();
  };

  const retrySubmission = () => {
    submittingRef.current = false;
    handleFinalSubmit(sessionRef.current?.pendingSubmit?.reason || "manual");
  };

  // Start syncing, save this exam for offline use and track the connection
  useEffect(() => {
    startCbtSync();
    void warmOfflineCache(examCode);
    return subscribeSyncState(setSyncState);
  }, [examCode]);

  // While online, check with the server for extra time, a lock, or an
  // examiner submitting the attempt from the monitor
  useEffect(() => {
    const check = async () => {
      const current = sessionRef.current;
      if (!current?.attemptId || submittingRef.current || !navigator.onLine) return;
      try {
        const res = await fetch(`/api/cbt/attempts/${encodeURIComponent(current.attemptId)}/status`, {
          headers: current.attemptToken ? { "x-attempt-token": current.attemptToken } : {},
          cache: "no-store",
        });
        if (!res.ok) return;
        const remote = await res.json();
        if (remote.status === "in_progress" && remote.deadline && remote.deadline !== current.deadline) {
          const gained = Math.round(
            (new Date(remote.deadline).getTime() - new Date(current.deadline).getTime()) / 60000,
          );
          const updated = { ...current, deadline: remote.deadline };
          saveCandidateSession(updated);
          sessionRef.current = updated;
          setSession(updated);
          setSecondsRemaining(secondsLeft(updated));
          if (gained > 0) {
            toast.info(`Your examiner gave you ${gained} extra minute${gained === 1 ? "" : "s"}.`);
          }
        } else if (remote.status === "disqualified") {
          handleFinalSubmit("malpractice");
        } else if (remote.status === "submitted") {
          handleFinalSubmit("manual");
        }
      } catch {
        // Offline or the server is unreachable: the next check will try again
      }
    };
    const timer = setInterval(check, 20000);
    void check();
    return () => clearInterval(timer);
  }, []);

  // The submission was sent from the queue (possibly by another tab or the worker)
  useEffect(() => {
    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.attemptId && detail.attemptId === sessionRef.current?.attemptId) {
        finishIfSynced();
      }
    };
    window.addEventListener(SUBMISSION_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(SUBMISSION_SYNCED_EVENT, onSynced);
  }, [finishIfSynced]);

  // Timer formatting (mm:ss)
  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Counts
  const answeredCount = Object.keys(session?.answers || {}).filter(
    (k) =>
      session?.answers[k] && session.answers[k].toString().trim().length > 0,
  ).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = session?.flaggedQuestionIds.length || 0;

  // Essay word count stats
  const essayWordCount = useMemo(() => {
    if (!essayDraft || !essayDraft.trim()) return 0;
    return essayDraft.trim().split(/\s+/).filter(Boolean).length;
  }, [essayDraft]);

  const essayCharCount = essayDraft.length;

  if (!session) {
    return (
      <div className="cbt-surface cand-center">
        <div className="cand-card" role="status">
          <Loader2 size={26} className="cand-spin text-[var(--violet-ink)]" aria-hidden />
          <p>Opening your exam…</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0 || !currentQ) {
    return (
      <div className="cbt-surface cand-center">
        <div className="cand-card">
          <AlertTriangle size={32} className="text-amber-700" aria-hidden />
          <h1>Exam session unavailable</h1>
          <p>
            This page needs an exam you started from the lobby. Return to the lobby and start the
            exam again.
          </p>
          <button
            type="button"
            onClick={() => router.replace(`/take/${encodeURIComponent(examCode)}`)}
            className="cand-btn primary w-full"
          >
            Return to lobby
          </button>
        </div>
      </div>
    );
  }

  const isAnsweredAt = (idx: number) => {
    const value = session.answers[questions[idx].id];
    return Boolean(value && value.toString().trim().length > 0);
  };
  const isFlaggedAt = (idx: number) => session.flaggedQuestionIds.includes(questions[idx].id);

  /** Moves to the next question after the current one that matches, wrapping round */
  const jumpTo = (matches: (idx: number) => boolean) => {
    for (let step = 1; step <= questions.length; step++) {
      const idx = (activeQuestionIdx + step) % questions.length;
      if (matches(idx)) {
        openQuestion(idx);
        return;
      }
    }
  };

  // On phones the navigator sits below the question, so bring the question back into view
  const openQuestion = (idx: number) => {
    setActiveQuestionIdx(idx);
    setIsMobilePaletteOpen(false);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      document.getElementById("cand-question")?.scrollIntoView({ block: "start" });
    }
  };

  const timerTone =
    secondsRemaining < 60 ? "is-critical" : secondsRemaining < 300 ? "is-low" : "";
  // Said once per band (5 minutes, 1 minute), inline and to screen readers
  const timeNotice =
    secondsRemaining <= 0
      ? null
      : secondsRemaining <= 60
        ? { tone: "is-critical", text: "Less than a minute left. Your exam submits by itself when the timer reaches 00:00." }
        : secondsRemaining <= 300
          ? { tone: "is-low", text: "5 minutes left. Your answers are saved. Use the time to check unanswered and flagged questions." }
          : null;
  const unansweredNumbers = questions
    .map((_, idx) => idx)
    .filter((idx) => !isAnsweredAt(idx));
  const answeredPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isObjective = OBJECTIVE.has(currentQ.type);
  // F flags the question, so option keys stop at E
  const lastOptionKey = OPTION_KEYS[Math.min(currentQ.options?.length || 0, 5) - 1]?.toUpperCase();
  const saveChip = !syncState.online
    ? { tone: "is-warn", icon: <WifiOff size={14} aria-hidden />, text: "Offline: answers saved on this device" }
    : syncState.pending > 0 || syncStatus === "saving"
      ? { tone: "is-violet", icon: <CloudUpload size={14} aria-hidden />, text: "Saving…" }
      : { tone: "is-ok", icon: <CheckCircle2 size={14} aria-hidden />, text: "All answers saved" };

  const wordCountTone =
    currentQ.minWords && essayWordCount < currentQ.minWords
      ? "low"
      : currentQ.maxWords && essayWordCount > currentQ.maxWords && currentQ.type === "SHORT_ESSAY"
        ? "over"
        : "ok";

  // Word count with its guideline, in words as well as colour
  const wordCountNote =
    wordCountTone === "low"
      ? "below the minimum"
      : wordCountTone === "over"
        ? "over the limit"
        : currentQ.minWords || currentQ.maxWords
          ? "within the guideline"
          : "";
  const pendingReason = session.pendingSubmit?.reason;
  const minutesLeft = Math.floor(secondsRemaining / 60);
  const goToQuestionFromDialog = (idx: number) => {
    setIsSubmitDialogOpen(false);
    openQuestion(idx);
  };

  return (
    <div className="cbt-surface cand-page cand-live">
      {/* ── Header: who, saved state, time, submit ── */}
      <header className="cand-live-bar">
        <div className="cand-live-left">
          <span className="cand-brand-slot">
            <CbtBrand />
          </span>
          <span className="cand-divider" aria-hidden />
          <span className="cand-person" title={`${session.candidateName} · ${session.candidatePin}`}>
            <UserRound size={18} aria-hidden />
            <strong>{session.candidateName}</strong>
            {session.candidatePin && <span>{session.candidatePin}</span>}
          </span>
        </div>
        <div className="cand-live-right">
          <span
            role="status"
            className={`cand-chip cand-save-chip ${saveChip.tone} ${syncState.online && syncState.pending === 0 ? "is-quiet" : ""}`}
          >
            {saveChip.icon}
            {saveChip.text}
          </span>
          <span className={`cand-timer ${timerTone}`} role="timer" aria-label={`Time remaining ${formatTimer(secondsRemaining)}`}>
            <Timer size={18} aria-hidden />
            {formatTimer(secondsRemaining)}
          </span>
          <button
            type="button"
            onClick={() => setIsSubmitDialogOpen(true)}
            className="cand-btn cand-submit"
          >
            <Send size={16} aria-hidden />
            <span className="hidden sm:inline">Submit exam</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      {/* Time warnings: shown inline and announced once per band */}
      <div className="cand-time-live" aria-live="polite">
        {timeNotice && (
          <p className={`cand-time-notice ${timeNotice.tone}`}>
            <AlertTriangle size={16} aria-hidden />
            {timeNotice.text}
          </p>
        )}
      </div>

      <div className="cand-live-title">
        <h1>
          <span>{resolvedExamTitle}</span>
          <span className="cand-chip is-violet cand-mono">{examCode.toUpperCase()}</span>
        </h1>
        <p>
          {answeredCount} of {questions.length} answered
          {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
        </p>
      </div>

      <div className="cand-live-grid">
        {/* ── Question ── */}
        <main id="cand-question" className="cand-question cand-card">
          <div className="cand-q-head">
            <div className="cand-q-title">
              {currentQ.section && <p className="cand-q-section">{currentQ.section}</p>}
              <h2>
                Question {activeQuestionIdx + 1}
                <small>of {questions.length}</small>
              </h2>
              <p className="cand-q-meta">
                {TYPE_LABELS[currentQ.type] || currentQ.type}
                <span aria-hidden>·</span>
                <span className="cand-mono">
                  {currentQ.marks} {currentQ.marks === 1 ? "mark" : "marks"}
                </span>
              </p>
              {currentQ.rubric && (
                <button
                  type="button"
                  onClick={() => setIsRubricDialogOpen(true)}
                  className="cand-inline-link"
                >
                  <Award size={14} aria-hidden />
                  How this is marked
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleToggleFlag}
              aria-pressed={isFlagged}
              className={`cand-btn cand-flag ${isFlagged ? "is-on" : ""}`}
            >
              <Bookmark size={16} className={isFlagged ? "fill-current" : ""} aria-hidden />
              {isFlagged ? "Flagged" : "Flag for review"}
              <span className="cand-kbd">F</span>
            </button>
          </div>

          <div className="cand-prompt">{currentQ.prompt}</div>

          {/* ── Multiple choice, true/false and multiple answers ── */}
          {isObjective && currentQ.options && (
            <div
              className="cand-options"
              role={currentQ.type === "MULTI_SELECT" ? "group" : "radiogroup"}
              aria-label="Answer options"
            >
              {currentQ.type === "MULTI_SELECT" && (
                <p className="cand-options-note">Select all that apply.</p>
              )}
              {currentQ.options.map((opt, idx) => {
                const isMulti = currentQ.type === "MULTI_SELECT";
                const isSelected = isMulti
                  ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id)
                  : selectedAnswer === opt.id;
                // Letters follow the on-screen order, so they match the keyboard after shuffling
                const keyLabel = OPTION_KEYS[idx]?.toUpperCase() || String(idx + 1);
                const choose = () => (isMulti ? toggleChoice(opt.id) : selectChoice(opt.id));

                return (
                  <div
                    key={opt.id}
                    role={isMulti ? "checkbox" : "radio"}
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={choose}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        choose();
                      }
                    }}
                    className={`cand-option ${isMulti ? "is-multi" : ""}`}
                  >
                    <span className="cand-option-key">{keyLabel}</span>
                    <span className="cand-option-text">
                      {opt.text}
                      {isSelected && !isMulti && (
                        <span className="cand-option-chosen">Your answer</span>
                      )}
                    </span>
                    <span className="cand-option-tick" aria-hidden>
                      {isSelected && <Check size={15} strokeWidth={3} />}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Short answer and essay ── */}
          {(currentQ.type === "SHORT_ESSAY" || currentQ.type === "LONG_ESSAY") && (
            <div className="cand-essay">
              <div className="cand-essay-meta">
                <label htmlFor="cand-essay-input">
                  {currentQ.type === "SHORT_ESSAY" ? (
                    <AlignLeft size={15} aria-hidden />
                  ) : (
                    <FileText size={15} aria-hidden />
                  )}
                  {currentQ.type === "SHORT_ESSAY" ? "Short answer" : "Essay"}
                  {currentQ.type === "SHORT_ESSAY" && currentQ.minWords && currentQ.maxWords ? (
                    <small>
                      {currentQ.minWords} to {currentQ.maxWords} words
                    </small>
                  ) : currentQ.type === "LONG_ESSAY" && currentQ.minWords ? (
                    <small>at least {currentQ.minWords} words</small>
                  ) : null}
                </label>
                <span className={`cand-count ${wordCountTone}`} aria-live="off">
                  {essayWordCount} {essayWordCount === 1 ? "word" : "words"}
                  {wordCountNote && <span className="cand-count-note">, {wordCountNote}</span>}
                </span>
              </div>
              <textarea
                id="cand-essay-input"
                rows={currentQ.type === "SHORT_ESSAY" ? 6 : 14}
                value={essayDraft}
                onChange={(e) => handleEssayChange(e.target.value)}
                aria-label={currentQ.type === "SHORT_ESSAY" ? "Your answer" : "Your essay"}
                placeholder={
                  currentQ.type === "SHORT_ESSAY"
                    ? "Type your answer here."
                    : "Write your essay here. Plan your points, then write them out in paragraphs."
                }
              />
              <div className="cand-essay-foot">
                <span>
                  {syncStatus === "saving"
                    ? "Saving…"
                    : !syncState.online
                      ? "Saved on this device. It will be sent when you're back online."
                      : syncState.pending > 0
                        ? "Saved on this device. Sending to the exam server…"
                        : "Saved and sent to the exam server."}
                </span>
                <span className="cand-mono">{essayCharCount} characters</span>
              </div>
            </div>
          )}

          <div className="cand-q-nav">
            <button
              type="button"
              disabled={activeQuestionIdx === 0}
              onClick={goToPrev}
              className="cand-btn"
            >
              <ChevronLeft size={18} aria-hidden />
              Previous
              <span className="cand-kbd">P</span>
            </button>

            <span className="cand-q-nav-hint">
              {isObjective ? "Your choice saves as soon as you pick it" : "Your answer saves as you type"}
            </span>

            {activeQuestionIdx < questions.length - 1 ? (
              <button type="button" onClick={goToNext} className="cand-btn primary">
                Next
                <span className="cand-kbd">N</span>
                <ChevronRight size={18} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSubmitDialogOpen(true)}
                className="cand-btn primary"
              >
                Review and submit
                <Send size={16} aria-hidden />
              </button>
            )}
          </div>

          <p className="cand-hotkeys" aria-label="Keyboard shortcuts">
            {isObjective && lastOptionKey && (
              <span>
                <span className="cand-kbd">A</span>
                <span aria-hidden>to</span>
                <span className="cand-kbd">{lastOptionKey}</span> choose
              </span>
            )}
            <span>
              <span className="cand-kbd">N</span> next
            </span>
            <span>
              <span className="cand-kbd">P</span> previous
            </span>
            <span>
              <span className="cand-kbd">F</span> flag
            </span>
          </p>
        </main>

        {/* ── Navigator ── */}
        <aside
          id="cand-navigator"
          className={`cand-navigator cand-card ${isMobilePaletteOpen ? "is-open" : ""}`}
          aria-labelledby="navigator-title"
        >
          <div className="cand-nav-head">
            <h2 id="navigator-title">
              <LayoutGrid size={18} aria-hidden />
              Questions
            </h2>
            <span className="cand-nav-pct cand-mono">{answeredPct}% done</span>
          </div>
          <div
            className="cand-progress"
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
          >
            <span style={{ transform: `scaleX(${answeredPct / 100})` }} />
          </div>
          <dl className="cand-counts">
            <div className="is-answered">
              <dt>Answered</dt>
              <dd>{answeredCount}</dd>
            </div>
            <div className={unansweredCount > 0 ? "is-open" : ""}>
              <dt>Unanswered</dt>
              <dd>{unansweredCount}</dd>
            </div>
            <div className="is-flagged">
              <dt>Flagged</dt>
              <dd>{flaggedCount}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            aria-expanded={isMobilePaletteOpen}
            aria-controls="cand-question-grid"
            className="cand-btn cand-nav-toggle"
          >
            {isMobilePaletteOpen ? "Hide question numbers" : "Show all question numbers"}
            <ChevronDown
              size={16}
              aria-hidden
              className={isMobilePaletteOpen ? "rotate-180" : ""}
            />
          </button>

          <div id="cand-question-grid" className="cand-grid">
            {questions.map((q, idx) => {
              const answered = isAnsweredAt(idx);
              const flagged = isFlaggedAt(idx);
              const current = idx === activeQuestionIdx;
              const state = [
                answered ? "answered" : "not answered",
                flagged ? "flagged" : "",
                current ? "current" : "",
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => openQuestion(idx)}
                  aria-label={`Question ${idx + 1}, ${state}`}
                  aria-current={current ? "step" : undefined}
                  className={`cand-cell ${flagged ? "is-flagged" : answered ? "is-answered" : ""} ${current ? "is-current" : ""}`}
                >
                  {idx + 1}
                  {flagged && <Bookmark size={10} className="cand-cell-flag fill-current" aria-hidden />}
                  {q.type !== "MCQ" && (
                    <span className="cand-cell-type" aria-hidden>
                      {q.type === "SHORT_ESSAY"
                        ? "S"
                        : q.type === "LONG_ESSAY"
                          ? "E"
                          : q.type === "MULTI_SELECT"
                            ? "M"
                            : "TF"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="cand-jump">
            <button
              type="button"
              className="cand-btn"
              disabled={unansweredCount === 0}
              onClick={() => jumpTo((idx) => !isAnsweredAt(idx))}
            >
              Next unanswered
            </button>
            <button
              type="button"
              className="cand-btn"
              disabled={flaggedCount === 0}
              onClick={() => jumpTo(isFlaggedAt)}
            >
              <Bookmark size={14} aria-hidden />
              Next flagged
            </button>
          </div>

          <div className="cand-legend" aria-hidden>
            <span>
              <i className="is-answered" /> Answered
            </span>
            <span>
              <i /> Not answered
            </span>
            <span>
              <i className="is-flagged" /> Flagged
            </span>
            <span>
              <i className="is-current" /> Current
            </span>
          </div>
        </aside>
      </div>

      {/* ── How a written question is marked ── */}
      <Dialog open={isRubricDialogOpen} onOpenChange={setIsRubricDialogOpen}>
        <DialogContent className="cbt-dialog cand-dialog max-w-lg">
          <DialogHeader>
            <DialogTitle className="cand-dialog-title">
              <Award size={20} className="text-amber-700" aria-hidden />
              {currentQ.rubric?.name || "How this question is marked"}
            </DialogTitle>
            <DialogDescription className="cand-dialog-lead">
              Your examiner marks this answer against these points, out of{" "}
              {currentQ.rubric?.totalMarks || currentQ.marks} marks.
            </DialogDescription>
          </DialogHeader>

          <ul className="cand-rubric">
            {currentQ.rubric?.criteria?.map((crit, idx) => (
              <li key={crit.id || idx}>
                <div className="cand-rubric-head">
                  <strong>{crit.title}</strong>
                  <span className="cand-mono">up to {crit.maxMarks}</span>
                </div>
                {crit.description && <p>{crit.description}</p>}
                {crit.levels && crit.levels.length > 0 && (
                  <dl className="cand-rubric-levels">
                    {crit.levels.map((lvl, lIdx) => (
                      <div key={lIdx}>
                        <dt>
                          {lvl.label} <span className="cand-mono">({lvl.points})</span>
                        </dt>
                        <dd>{lvl.descriptor}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>

          <div className="cand-dialog-actions">
            <button type="button" className="cand-btn primary" onClick={() => setIsRubricDialogOpen(false)}>
              Back to the question
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Submit confirmation ── */}
      <AlertDialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <AlertDialogContent className="cbt-dialog cand-dialog max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="cand-dialog-title">Submit your exam?</AlertDialogTitle>
            <AlertDialogDescription className="cand-dialog-lead">
              You have answered <strong>{answeredCount}</strong> of{" "}
              <strong>{questions.length}</strong> questions
              {secondsRemaining > 60 ? `, with ${minutesLeft} minutes left` : ""}. Once you submit,
              you can&apos;t change your answers.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="cand-submit-summary">
            {unansweredCount > 0 ? (
              <div className="cand-submit-row is-open">
                <AlertTriangle size={18} aria-hidden />
                <div>
                  <strong>
                    {unansweredCount} not answered
                  </strong>
                  <p>
                    Question{unansweredNumbers.length === 1 ? "" : "s"}{" "}
                    {unansweredNumbers.slice(0, 12).map((idx) => idx + 1).join(", ")}
                    {unansweredNumbers.length > 12 ? ` and ${unansweredNumbers.length - 12} more` : ""}
                  </p>
                  <button
                    type="button"
                    className="cand-inline-link"
                    onClick={() => goToQuestionFromDialog(unansweredNumbers[0])}
                  >
                    Go to question {unansweredNumbers[0] + 1}
                  </button>
                </div>
              </div>
            ) : (
              <div className="cand-submit-row is-done">
                <CheckCircle2 size={18} aria-hidden />
                <div>
                  <strong>Every question has an answer</strong>
                </div>
              </div>
            )}
            {flaggedCount > 0 && (
              <div className="cand-submit-row is-flagged">
                <Bookmark size={18} aria-hidden />
                <div>
                  <strong>{flaggedCount} flagged for review</strong>
                  <p>Flags are only for you. Flagged answers are still submitted.</p>
                </div>
              </div>
            )}
            {hasEssayQuestions && (
              <p className="cand-submit-note">
                Objective questions are scored straight away. Your examiner marks the written
                answers.
              </p>
            )}
          </div>

          <AlertDialogFooter className="cand-dialog-actions">
            <AlertDialogCancel className="cand-btn">Back to exam</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFinalSubmit("manual")} className="cand-btn primary">
              <Send size={16} aria-hidden />
              Submit exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Tab-switch warning: must be acknowledged ── */}
      <AlertDialog
        open={Boolean(violationNotice) && submitState === "idle"}
        onOpenChange={(open) => !open && setViolationNotice(null)}
      >
        <AlertDialogContent className="cbt-dialog cand-dialog is-warning max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="cand-dialog-title">
              <ShieldAlert size={22} aria-hidden />
              You left the exam page
            </AlertDialogTitle>
            <AlertDialogDescription className="cand-dialog-lead">
              This is warning <strong>{violationNotice?.count}</strong> of{" "}
              <strong>{violationNotice?.max}</strong>. Your examiner can see it.{" "}
              {violationNotice && violationNotice.max - violationNotice.count === 1
                ? "If you leave once more, your exam is submitted automatically and locked."
                : `After ${violationNotice ? violationNotice.max - violationNotice.count : 0} more, your exam is submitted automatically and locked.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="cand-dialog-actions">
            <AlertDialogAction className="cand-btn primary" onClick={() => setViolationNotice(null)}>
              Return to exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Submission progress / failure ── */}
      {submitState !== "idle" && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cand-overlay-title"
          aria-live="assertive"
          className="cand-overlay"
        >
          <div>
            {submitState === "sending" && (
              <>
                <Loader2 size={32} className="cand-spin text-[var(--violet-ink)]" aria-hidden />
                <h2 id="cand-overlay-title">
                  {pendingReason === "timeout" ? "Time is up. Submitting your exam…" : "Submitting your exam…"}
                </h2>
                <p>
                  {pendingReason === "malpractice"
                    ? `You left the exam page ${maxTabViolations} times, so your exam is being submitted and locked. Keep this page open.`
                    : "Keep this page open. Your answers are already saved on this device."}
                </p>
              </>
            )}
            {submitState === "queued" && (
              <>
                <CheckCircle2 size={32} className="text-emerald-700" aria-hidden />
                <h2 id="cand-overlay-title">Your exam is submitted on this device</h2>
                <p>
                  {syncState.online
                    ? "We're sending it to the exam server now."
                    : "You're offline. Your answers are saved here and will be sent automatically when you reconnect."}
                </p>
                <p className="cand-overlay-small">
                  Your result appears once it has been sent. If you close this page, open this exam
                  link again on this device when you&apos;re online.
                </p>
                <button
                  type="button"
                  onClick={() => syncNow().then(finishIfSynced)}
                  disabled={!syncState.online}
                  className="cand-btn primary"
                >
                  {syncState.online ? "Send now" : "Waiting for a connection"}
                </button>
              </>
            )}
            {submitState === "failed" && (
              <>
                <AlertTriangle size={32} className="text-[var(--crimson-ink)]" aria-hidden />
                <h2 id="cand-overlay-title">Submission not accepted</h2>
                <p>{submitError}</p>
                <p className="cand-overlay-small">Your answers are still saved on this device.</p>
                <button type="button" onClick={retrySubmission} className="cand-btn primary">
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
