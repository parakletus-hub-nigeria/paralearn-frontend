"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { 
  submitAssessment, 
  fetchAssessmentDetails,
  buildExamDeviceMeta,
} from "@/reduxToolKit/student/studentThunks";
import { 
  setAnswer, 
  incrementTabSwitch, 
  incrementWindowBlur,
  restoreSession,
  resetActiveSession,
  autoFlagQuestion,
} from "@/reduxToolKit/student/studentSlice";
import { loadSessionFromStorage } from "@/reduxToolKit/student/studentSlice";
import {
  ChevronLeft,
  ChevronRight,
  Timer,
  Grid,
  CheckCircle,
  Check,
  AlertTriangle,
  Menu,
  X,
  AlertCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Question types that expect a plain text answer (not a choice ID)
const OPEN_ENDED_TYPES = new Set(["ESSAY", "TEXT", "essay", "text"]);

const normalizeExamQuestion = (question: any, index: number) => ({
  ...question,
  id: question?.id || question?.questionId || `question-${index}`,
  type: question?.type || question?.questionType || "MCQ",
  questionType: question?.questionType || question?.type || "MCQ",
  prompt:
    question?.prompt ||
    question?.questionText ||
    question?.text ||
    `Question ${index + 1}`,
  choices: question?.choices || question?.options || [],
});

export default function LiveExamInterface() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentId = searchParams.get("assessmentId");

  const { currentAssessment, activeSession, loading, error } = useSelector((s: RootState) => s.student);
  const { user } = useSelector((s: RootState) => s.user);

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep a stable ref to onFinalSubmit so the timer callback always sees the latest version
  const onFinalSubmitRef = useRef<((reason?: "manual" | "timeout" | "malpractice") => Promise<void>) | undefined>(undefined);
  const currentQuestionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentAssessment?.questions && currentQuestionIdx < currentAssessment.questions.length) {
      currentQuestionIdRef.current = currentAssessment.questions[currentQuestionIdx]?.id || null;
    }
  }, [currentAssessment?.questions, currentQuestionIdx]);

  useEffect(() => {
    const questionCount = Array.isArray(currentAssessment?.questions)
      ? currentAssessment.questions.length
      : 0;
    if (questionCount > 0 && currentQuestionIdx >= questionCount) {
      setCurrentQuestionIdx(questionCount - 1);
    }
  }, [currentAssessment?.questions, currentQuestionIdx]);

  // -------------------------------------------------------------------------
  // Step 1: Restore session from localStorage in case of a page refresh
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!assessmentId) return;

    // Restore saved answers and startedAt from localStorage
    const saved = loadSessionFromStorage(assessmentId);
    if (saved) {
      dispatch(restoreSession(saved));
    }
  }, [dispatch, assessmentId]);

  // FIX #8: Guard against missing or blank assessmentId
  useEffect(() => {
    if (!assessmentId || assessmentId.trim() === "") return;
    if (
      currentAssessment?.id === assessmentId &&
      Array.isArray(currentAssessment.questions) &&
      currentAssessment.questions.length > 0
    ) {
      return;
    }
    dispatch(fetchAssessmentDetails(assessmentId));
  }, [dispatch, assessmentId, currentAssessment?.id, currentAssessment?.questions]);

  // -------------------------------------------------------------------------
  // Timer Logic — Secure against basic system clock manipulation
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Use Redux startedAt first, then submission startedAt
    const reliableStartedAt =
      activeSession.startedAt ||
      currentAssessment?.submissions?.[0]?.startedAt ||
      null;

    if (!currentAssessment?.durationMins || !reliableStartedAt) return;

    // We calculate the initial time offset once when the component mounts or regains focus.
    // Instead of using Date.now() on every tick (which can be manipulated by changing the PC clock),
    // we use a monotonic interval that strictly decrements the remaining seconds.
    const startedAtTime = new Date(reliableStartedAt).getTime();
    const durationMs = currentAssessment.durationMins * 60 * 1000;
    
    // Initial calculation (only vulnerable to clock manipulation exactly at page load)
    let remainingSeconds = Math.max(0, Math.floor((startedAtTime + durationMs - Date.now()) / 1000));
    setTimeLeft(remainingSeconds);

    const interval = setInterval(() => {
      remainingSeconds -= 1;
      
      if (remainingSeconds < 0) remainingSeconds = 0;
      setTimeLeft(remainingSeconds);

      // Trigger auto-submit at 3 seconds before zero to account for latency
      if (remainingSeconds <= 3) {
        clearInterval(interval);
        toast.info("Time is up! Submitting your exam automatically...", { id: "timeout-toast", duration: 5000 });
        onFinalSubmitRef.current?.("timeout");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession.startedAt, currentAssessment?.durationMins, currentAssessment?.submissions]);

  // -------------------------------------------------------------------------
  // Anti-Malpractice Listeners
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        dispatch(incrementTabSwitch(currentQuestionIdRef.current || undefined));
        toast.error("Malpractice Flagged: Tab switched. Your exam is being automatically submitted.", { id: "malpractice-toast", duration: 7000 });
        onFinalSubmitRef.current?.("malpractice");
      }
    };

    const handleBlur = () => {
      dispatch(incrementWindowBlur(currentQuestionIdRef.current || undefined));
      toast.warning(
        <div className="flex flex-col gap-1">
          <span className="font-bold">Malpractice Flag: Focus Lost</span>
          <span className="text-xs opacity-90">Leaving the exam window is strictly prohibited. This incident has been logged.</span>
        </div>,
        { duration: 6000 }
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (currentQuestionIdRef.current) dispatch(autoFlagQuestion(currentQuestionIdRef.current));
      toast.error("Context menu is disabled during the exam.");
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      if (currentQuestionIdRef.current) dispatch(autoFlagQuestion(currentQuestionIdRef.current));
      toast.error("Copy/Paste is disabled during the exam.");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // FIX #1: Type-aware answer serialization for submission
  // -------------------------------------------------------------------------
  const buildAnswersPayload = useCallback(() => {
    return (
      currentAssessment?.questions?.map((rawQuestion, index) => {
        const q = normalizeExamQuestion(rawQuestion, index);
        const val = activeSession.answers[q.id];
        if (val === undefined || val === null || val === "") return null;

        const isOpenEnded =
          OPEN_ENDED_TYPES.has(q.type) ||
          (q.questionType && OPEN_ENDED_TYPES.has(q.questionType));

        return {
          questionId: q.id,
          // Essay/TEXT → plain string; MCQ/MULTI_SELECT/TRUE_FALSE → { selected: choiceId }
          value: isOpenEnded
            ? val
            : { selected: val },
        };
      }).filter(Boolean) || []
    );
  }, [currentAssessment?.questions, activeSession.answers]);

  // -------------------------------------------------------------------------
  // Final Submit
  // -------------------------------------------------------------------------
  const onFinalSubmit = useCallback(async (reason: "manual" | "timeout" | "malpractice" = "manual") => {
    if (!assessmentId || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitModal(false);

    const reliableStartedAt =
      activeSession.startedAt ||
      currentAssessment?.submissions?.[0]?.startedAt ||
      new Date().toISOString();

    // Prevent 'Assessment submission window has closed' backend errors
    // by capping the finishedAt timestamp to the exact deadline minus 1 second
    let finishedAtTime = Date.now();
    if (currentAssessment?.durationMins && reliableStartedAt) {
      const deadlineTime = activeSession.deadline
        ? new Date(activeSession.deadline).getTime()
        : new Date(reliableStartedAt).getTime() + (currentAssessment.durationMins * 60 * 1000);
      if (finishedAtTime > deadlineTime) {
        finishedAtTime = deadlineTime - 1000;
      }
    }

    const deviceMeta = buildExamDeviceMeta();
    const startedAtMillis = new Date(reliableStartedAt).getTime() || Date.now();
    const clientSubmissionId = `exam-${assessmentId}-${deviceMeta.deviceId}-${startedAtMillis}`;

    const submissionData = {
      clientSubmissionId,
      startedAt: reliableStartedAt,
      finishedAt: new Date(finishedAtTime).toISOString(),
      submissionReason: reason,
      deviceMeta,
      antiMalpracticeData: {
        tabSwitchCount: activeSession.tabSwitchCount,
        windowBlurCount: activeSession.windowBlurCount,
        suspiciousActivity: activeSession.suspiciousActivity,
        autoFlaggedQuestions: activeSession.autoFlaggedQuestions,
      },
      answers: buildAnswersPayload(),
    };

    try {
      await dispatch(submitAssessment({ assessmentId, data: submissionData })).unwrap();
      dispatch(resetActiveSession());
      toast.success("Exam submitted successfully!");
      router.push("/student/dashboard");
    } catch (e: any) {
      setIsSubmitting(false);
      console.warn("[ExamSubmit] Submission error, saving offline:", e);
      
      // FIX: Save offline submission
      try {
         const offlineSubmission = {
           assessmentId,
           ...submissionData,
           capturedAt: new Date().toISOString(),
           savedAt: new Date().toISOString()
         };
         
         // Get existing offline submissions
         const existingRaw = localStorage.getItem("offline_submissions");
         const existing = existingRaw ? JSON.parse(existingRaw) : [];
         
         // Add new one
         existing.push(offlineSubmission);
         localStorage.setItem("offline_submissions", JSON.stringify(existing));
         
         // Tell redux we submitted so the UI exits
         dispatch(resetActiveSession());
         toast.success("No network connection. Your exam was saved offline and will sync automatically when you reconnect.", { duration: 8000 });
         router.push("/student/dashboard");
      } catch (storageErr) {
        toast.error("Critical Error: Failed to submit to server AND failed to save offline. Please do not close this window and alert the invigilator immediately.");
      }
    }
  }, [
    assessmentId,
    isSubmitting,
    activeSession,
    currentAssessment?.submissions,
    buildAnswersPayload,
    dispatch,
    router,
  ]);

  // FIX #4: Keep the ref up-to-date so the timer interval always calls the latest version
  useEffect(() => {
    onFinalSubmitRef.current = onFinalSubmit;
  }, [onFinalSubmit]);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // -------------------------------------------------------------------------
  // Loading / Guard states
  // -------------------------------------------------------------------------
  if (!assessmentId || assessmentId.trim() === "") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface-muted)" }}>
        <AlertTriangle className="w-16 h-16 mb-4" style={{ color: "var(--amber-signal)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Exam Link Invalid</h2>
        <p className="mb-6 max-w-md" style={{ color: "var(--foreground-muted)" }}>
          This exam link is missing its assessment ID. Please return to your dashboard and open the exam again.
        </p>
        <button onClick={() => router.push("/student/dashboard")} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Return to Dashboard</button>
      </div>
    );
  }

  if (loading && !currentAssessment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (error && !currentAssessment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface-muted)" }}>
        <AlertTriangle className="w-16 h-16 mb-4" style={{ color: "var(--crimson-signal)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Exam Could Not Load</h2>
        <p className="mb-6 max-w-md" style={{ color: "var(--foreground-muted)" }}>
          {typeof error === "string" ? error : "We could not load this exam. Please try again from your dashboard."}
        </p>
        <button onClick={() => router.push("/student/dashboard")} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Return to Dashboard</button>
      </div>
    );
  }

  if (!currentAssessment || !Array.isArray(currentAssessment.questions)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-muted)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  const questions = currentAssessment.questions
    .filter(Boolean)
    .map(normalizeExamQuestion);

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface-muted)" }}>
        <AlertTriangle className="w-16 h-16 mb-4" style={{ color: "var(--amber-signal)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>No Questions Available</h2>
        <p className="mb-6 max-w-md" style={{ color: "var(--foreground-muted)" }}>
          This exam has been published, but no questions are available for students yet. Please contact your teacher.
        </p>
        <button onClick={() => router.push("/student/dashboard")} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Return to Dashboard</button>
      </div>
    );
  }

  const safeCurrentQuestionIdx = Math.min(currentQuestionIdx, questions.length - 1);

  const isSubmitted =
    currentAssessment.status === "submitted" ||
    currentAssessment.submissions?.some(
      (s) => s.status === "submitted" && !!s.finishedAt
    );
  const isEnded = currentAssessment.status === "ended";

  if (isSubmitted || isEnded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface-muted)" }}>
        <AlertTriangle className="w-16 h-16 mb-4" style={{ color: "var(--crimson-signal)" }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Assessment Locked</h2>
        <p className="mb-6 max-w-md" style={{ color: "var(--foreground-muted)" }}>
          {isSubmitted
            ? "You have already submitted this assessment. You cannot modify your answers."
            : "This assessment has ended and is no longer active."}
        </p>
        <button onClick={() => router.push("/student/dashboard")} className="px-6 py-2 font-bold text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}>Return to Dashboard</button>
      </div>
    );
  }

  const currentQuestion = questions[safeCurrentQuestionIdx];
  const progressPercent = ((safeCurrentQuestionIdx + 1) / questions.length) * 100;
  const answeredCount = questions.filter((q) => activeSession.answers[q.id] !== undefined).length;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ background: "var(--surface-muted)", color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>

      {/* FIX #7: Custom submit confirmation modal (replaces window.confirm) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)" }}>
          <div className="p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center gap-4" style={{ background: "white", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            {isSubmitting ? (
              <>
                <div className="w-16 h-16 relative flex items-center justify-center mb-2">
                  <div className="absolute inset-0 rounded-full" style={{ border: "4px solid var(--border-fine)" }} />
                  <div className="absolute inset-0 rounded-full animate-spin" style={{ border: "4px solid var(--violet-ink)", borderTopColor: "transparent" }} />
                </div>
                <h3 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Submitting Exam</h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Please wait while your answers are being saved securely...</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--amber-tint)" }}>
                  <AlertCircle className="w-8 h-8" style={{ color: "var(--amber-signal)" }} />
                </div>
                <h3 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Submit Exam?</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                  You have answered <span className="font-bold" style={{ color: "var(--foreground)" }}>{answeredCount}</span> of{" "}
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>{questions.length}</span> questions.
                  {answeredCount < questions.length && (
                    <span className="block mt-1 font-semibold" style={{ color: "var(--amber-signal)" }}>
                      {questions.length - answeredCount} question(s) still unanswered.
                    </span>
                  )}
                  <span className="block mt-2">This action cannot be undone.</span>
                </p>
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => setShowSubmitModal(false)}
                    className="flex-1 py-3 font-semibold transition-colors"
                    style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-medium)", color: "var(--foreground)", background: "white" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-muted)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}
                  >
                    Continue Exam
                  </button>
                  <button
                    onClick={() => onFinalSubmit("manual")}
                    className="flex-1 py-3 font-semibold text-white transition-colors"
                    style={{ borderRadius: "var(--radius-lg)", background: "var(--foreground)", border: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Submit Now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 md:px-8 py-4 flex justify-between items-center h-20" style={{ background: "white", borderBottom: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-4 md:gap-6 overflow-hidden">
          <h1 className="text-lg font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] md:max-w-none" style={{ color: "var(--foreground)" }}>
            {currentAssessment.title}
          </h1>
          <div className="h-4 w-px hidden md:block" style={{ background: "var(--border-medium)" }}></div>
          <span className="text-sm font-medium hidden md:block" style={{ color: "var(--foreground-muted)" }}>{currentAssessment.category?.name || "General"}</span>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1" style={{ background: "var(--emerald-tint)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)" }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--emerald-signal)" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--emerald-signal)" }}>Safe Exam Active</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] md:text-xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: "var(--foreground-muted)" }}>Time Remaining</span>
            <div className="flex items-center space-x-2">
              <Timer className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
              <span className="text-lg md:text-xl font-bold font-mono tracking-widest" style={{ color: timeLeft !== null && timeLeft < 300 ? "var(--crimson-signal)" : "var(--foreground)" }}>
                {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
              </span>
            </div>
          </div>

          <div className="w-9 h-9 font-bold text-sm hidden sm:flex items-center justify-center" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}>
            {user?.firstName?.charAt(0) || "S"}
          </div>

          <button
            className="xl:hidden p-2"
            style={{ color: "var(--foreground)" }}
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 h-[calc(100vh-5rem)] overflow-hidden relative">

        {/* Main Question Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-12 flex justify-center relative" style={{ background: "white" }}>
          <div className="w-full max-w-4xl flex relative">

            {/* Left Progress Line (Desktop) */}
            <div className="absolute -left-6 top-0 bottom-0 w-1 rounded-full hidden lg:block" style={{ background: "var(--border-fine)" }}>
              <div
                className="w-full rounded-full transition-all duration-300 ease-in-out"
                style={{ height: `${progressPercent}%`, background: "var(--violet-ink)" }}
              ></div>
            </div>

            <div className="flex-1 flex flex-col min-h-[400px] md:min-h-[600px]">
              <div className="flex justify-between items-center mb-8 pb-4" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
                  Question {currentQuestionIdx + 1} of {questions.length}
                </span>
              </div>

              <div className="mb-6 md:mb-8">
                {activeSession.autoFlaggedQuestions?.includes(currentQuestion.id) && (
                  <div className="mb-6 flex items-center gap-3 p-4 rounded-xl animate-in fade-in slide-in-from-top-4 duration-500" style={{ background: "var(--amber-tint)", border: "1px solid var(--border-medium)" }}>
                    <div className="h-10 w-10 rounded-full flex items-center justify-center flex-none" style={{ background: "var(--amber-tint)" }}>
                      <AlertTriangle className="w-6 h-6 animate-pulse" style={{ color: "var(--amber-signal)" }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Malpractice Flagged</p>
                      <p className="text-xs font-medium" style={{ color: "var(--amber-signal)" }}>This question has been flagged for suspicious activity. Your response has been locked.</p>
                    </div>
                  </div>
                )}
                <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold leading-relaxed" style={{ color: "var(--foreground)" }}>
                  {currentQuestion.prompt || currentQuestion.questionText}
                </h2>
                {(currentQuestion.type === "MULTI_SELECT" || currentQuestion.questionType === "MULTI_SELECT") && (
                  <p className="text-[13px] font-bold mt-3 flex items-center gap-2 w-fit px-3 py-1.5 shadow-sm" style={{ color: "var(--violet-ink)", background: "var(--violet-tint)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)" }}>
                    <Check className="w-4 h-4" /> Please select ALL correct options
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 content-start mb-8 md:mb-12">
                {currentQuestion.type === "ESSAY" ? (
                  <textarea
                    value={activeSession.answers[currentQuestion.id] || ""}
                    disabled={activeSession.autoFlaggedQuestions?.includes(currentQuestion.id)}
                    onChange={(e) =>
                      dispatch(setAnswer({ questionId: currentQuestion.id, value: e.target.value }))
                    }
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--violet-ink)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                    placeholder="Type your essay answer here..."
                    className="col-span-1 sm:col-span-2 w-full min-h-[300px] p-5 text-lg font-medium resize-y outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ color: "var(--foreground)", background: "white", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", transition: "border-color 0.15s" }}
                  />
                ) : currentQuestion.type === "TEXT" ? (
                  <input
                    type="text"
                    value={activeSession.answers[currentQuestion.id] || ""}
                    disabled={activeSession.autoFlaggedQuestions?.includes(currentQuestion.id)}
                    onChange={(e) =>
                      dispatch(setAnswer({ questionId: currentQuestion.id, value: e.target.value }))
                    }
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--violet-ink)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                    placeholder="Type your short answer here..."
                    className="col-span-1 sm:col-span-2 w-full p-5 text-lg font-medium outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{ color: "var(--foreground)", background: "white", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", transition: "border-color 0.15s" }}
                  />
                ) : (
                  (currentQuestion.choices || currentQuestion.options || []).map((choice: any, idx: number) => {
                    const choiceId = choice.id || idx.toString();
                    const isMultiSelect =
                      currentQuestion.type === "MULTI_SELECT" ||
                      currentQuestion.questionType === "MULTI_SELECT";
                    const currentAnswer = activeSession.answers[currentQuestion.id];
                    let isSelected = false;

                    if (isMultiSelect) {
                      const arr = Array.isArray(currentAnswer)
                        ? currentAnswer
                        : currentAnswer
                        ? [currentAnswer]
                        : [];
                      isSelected = arr.includes(choiceId);
                    } else {
                      isSelected = currentAnswer === choiceId;
                    }

                    const letter = String.fromCharCode(65 + idx);
                    const isFlagged = activeSession.autoFlaggedQuestions?.includes(currentQuestion.id);

                    return (
                      <label
                        key={choiceId}
                        className={`group flex items-start h-fit p-4 md:p-5 shadow-sm relative transition-all duration-200 ${isFlagged ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      style={{
                        borderRadius: "var(--radius-lg)",
                        border: isSelected ? "1px solid var(--violet-ink)" : "1px solid var(--border-fine)",
                        background: isSelected ? "var(--violet-tint)" : "white",
                        boxShadow: isSelected ? "var(--shadow-card)" : "var(--shadow-card)",
                      }}
                      >
                        <input
                          type={isMultiSelect ? "checkbox" : "radio"}
                          name={`question-${currentQuestion.id}`}
                          className="hidden peer"
                          checked={isSelected}
                          disabled={isFlagged}
                          onChange={(e) => {
                            if (isMultiSelect) {
                              let arr = Array.isArray(currentAnswer)
                                ? [...currentAnswer]
                                : currentAnswer
                                ? [currentAnswer]
                                : [];
                              if (e.target.checked) {
                                if (!arr.includes(choiceId)) arr.push(choiceId);
                              } else {
                                arr = arr.filter((id: string) => id !== choiceId);
                              }
                              dispatch(setAnswer({ questionId: currentQuestion.id, value: arr }));
                            } else {
                              dispatch(setAnswer({ questionId: currentQuestion.id, value: choiceId }));
                            }
                          }}
                        />
                        <div
                          className="flex-shrink-0 w-8 h-8 font-bold flex items-center justify-center mr-4 text-sm transition-all"
                          style={{
                            borderRadius: isMultiSelect ? "var(--radius-sm)" : "50%",
                            background: isSelected ? "var(--violet-ink)" : "var(--surface-muted)",
                            color: isSelected ? "white" : "var(--foreground-muted)",
                            border: isSelected ? "none" : "1px solid var(--border-fine)",
                          }}
                        >
                          {isMultiSelect ? (isSelected ? <Check className="w-5 h-5" /> : letter) : letter}
                        </div>
                        <span className="text-base md:text-lg pt-0.5 pr-6" style={{ color: isSelected ? "var(--foreground)" : "var(--foreground-muted)", fontWeight: isSelected ? 600 : 400 }}>
                          {choice.text}
                        </span>
                        {isSelected && !isMultiSelect && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <CheckCircle className="w-6 h-6" style={{ color: "var(--violet-ink)" }} />
                          </div>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 mb-20 md:mb-0" style={{ borderTop: "1px solid var(--border-fine)" }}>
                <button
                  onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="flex items-center font-medium px-6 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-md)", border: "1px solid transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--border-fine)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <ChevronLeft className="mr-2 w-5 h-5" /> Previous
                </button>

                <button
                  onClick={() => {
                    if (currentQuestionIdx < questions.length - 1) {
                      setCurrentQuestionIdx((prev) => prev + 1);
                    } else {
                      setShowSubmitModal(true);
                    }
                  }}
                  className="font-medium px-8 py-3 text-white flex items-center transition-all active:scale-[0.99] text-base"
                  style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none", boxShadow: "var(--shadow-card)" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  {currentQuestionIdx === questions.length - 1 ? "Finish Exam" : "Next Question"}
                  {currentQuestionIdx < questions.length - 1 && <ChevronRight className="ml-2 w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar Navigator — intentionally dark for exam focus */}
        <aside
          className={`fixed inset-y-0 right-0 w-[320px] flex flex-col z-50 transition-transform duration-300 ease-in-out xl:relative xl:transform-none xl:flex ${isSidebarOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0"}`}
          style={{ background: "oklch(0.13 0.02 265)", borderLeft: "1px solid oklch(0.22 0.02 265)", boxShadow: "var(--shadow-dialog)" }}
        >
          <div className="p-8 pb-6 flex justify-between items-center" style={{ borderBottom: "1px solid oklch(0.25 0.02 265)" }}>
            <h3 className="text-xl font-semibold" style={{ color: "white" }}>Question Navigator</h3>
            <button className="xl:hidden" style={{ color: "white" }} onClick={() => setIsSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-8 py-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium" style={{ color: "oklch(0.6 0.02 265)" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.45 0.02 265)" }}></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "white", border: "1px solid oklch(0.4 0.02 265)" }}></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ border: "1px solid oklch(0.35 0.02 265)" }}></div>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--amber-signal)" }}></div>
                <span className="font-bold" style={{ color: "var(--amber-signal)" }}>Flagged</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-2 md:py-6">
            <div className="grid grid-cols-5 gap-3 content-start">
              {questions.map((q, idx) => {
                const isAnswered = activeSession.answers[q.id] !== undefined;
                const isCurrent = idx === currentQuestionIdx;
                const isFlagged = activeSession.autoFlaggedQuestions?.includes(q.id);

                const buttonStyle = isCurrent
                  ? { background: "white", color: "oklch(0.13 0.02 265)", fontWeight: 700, transform: "scale(1.1)", boxShadow: "0 0 0 4px oklch(0.25 0.02 265)" }
                  : isFlagged
                  ? { background: "var(--amber-tint)", color: "var(--amber-signal)", fontWeight: 700, border: "2px solid var(--amber-signal)" }
                  : isAnswered
                  ? { background: "oklch(0.35 0.02 265)", color: "oklch(0.85 0.01 265)" }
                  : { background: "transparent", color: "oklch(0.5 0.02 265)", border: "1px solid oklch(0.3 0.02 265)" };

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQuestionIdx(idx);
                      setIsSidebarOpen(false);
                    }}
                    className="w-10 h-10 text-xs font-medium flex items-center justify-center transition-all"
                    style={{ borderRadius: "50%", ...buttonStyle }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress summary */}
          <div className="px-8 py-4" style={{ borderTop: "1px solid oklch(0.25 0.02 265)" }}>
            <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.02 265)" }}>Progress</p>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.25 0.02 265)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%`, background: "var(--emerald-signal)" }}
              />
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "oklch(0.45 0.02 265)" }}>{answeredCount} / {questions.length} answered</p>
          </div>

          <div className="p-8" style={{ borderTop: "1px solid oklch(0.25 0.02 265)", background: "oklch(0.13 0.02 265)" }}>
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={isSubmitting}
              className="w-full font-medium py-3 text-sm uppercase tracking-wide transition-all disabled:opacity-60"
              style={{ background: "transparent", border: "1px solid oklch(0.3 0.02 265)", color: "white", borderRadius: "var(--radius-md)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "oklch(0.13 0.02 265)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "white"; }}
            >
              {isSubmitting ? "Submitting..." : "Finish Exam"}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full p-4 xl:hidden flex justify-between items-center z-40" style={{ background: "white", borderTop: "1px solid var(--border-fine)" }}>
        <span className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>{currentQuestionIdx + 1} / {questions.length}</span>
        <button
          className="font-bold flex items-center gap-2 text-sm"
          style={{ color: "var(--foreground)" }}
          onClick={() => setIsSidebarOpen(true)}
        >
          <Grid className="w-5 h-5" />
          All Questions
        </button>
      </div>

    </div>
  );
}
