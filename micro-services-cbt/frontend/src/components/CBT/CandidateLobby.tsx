"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Wifi,
  Clock,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  User,
  KeyRound,
  Laptop,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import {
  saveCandidateSession,
  loadCandidateSession,
} from "@cbt/lib/cbtSessionManager";
import {
  useGetExamByCodeQuery,
  useStartAttemptMutation,
} from "@cbt/store/cbtMicroserviceApi";
import { BUSI_QUESTIONS_STATIC } from "@cbt/lib/busiQuestions";

interface ExamMetadata {
  code: string;
  title: string;
  institutionName: string;
  durationMins: number;
  questionCount: number;
  instructions: string;
  requiresPin: boolean;
  maxTabViolations: number;
}

interface CandidateLobbyProps {
  examCode: string;
}

function CandidatePinInput({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (val: string) => void;
  length?: number;
}) {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const clean = char.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    if (!clean) {
      const arr = value.split("");
      arr[index] = "";
      onChange(arr.join(""));
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, length);
      onChange(pasted);
      const nextIndex = Math.min(pasted.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
      return;
    }

    const arr = value.padEnd(length, " ").split("");
    arr[index] = clean;
    const newVal = arr.join("").trimEnd();
    onChange(newVal);

    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-1.5 sm:gap-2 max-w-full justify-between sm:justify-start">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-9 h-10 min-w-0 sm:w-11 sm:h-11 text-center font-mono font-bold text-base sm:text-lg rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white text-[var(--foreground)] focus:border-[var(--violet-ink)] focus:ring-2 focus:ring-[var(--violet-ink)]/20 outline-none transition-all shadow-xs"
        />
      ))}
    </div>
  );
}

function getInitialExamMetadata(code: string): ExamMetadata | null {
  const normalized = (code || "").trim().toUpperCase();
  if (normalized === "BUSI-7642") {
    return {
      code: "BUSI-7642",
      title: "Business Development Assessment - 1",
      institutionName: "Parakletus Internship Program",
      durationMins: 90,
      questionCount: 30,
      instructions:
        "Answer all questions. Your responses are saved continuously and submitted when time expires.",
      requiresPin: false,
      maxTabViolations: 3,
    };
  }
  if (typeof window !== "undefined") {
    try {
      const stored = loadStoredExams();
      const localExam = stored.find(
        (e) => e.accessCode?.trim().toUpperCase() === normalized,
      );
      if (localExam) {
        const storedQuestions = loadStoredQuestions(localExam.id);
        return {
          code: localExam.accessCode,
          title: localExam.title,
          institutionName: "ParaLearn Assessment Center",
          durationMins: localExam.durationMins || 60,
          questionCount:
            storedQuestions.length || localExam.totalQuestions || 0,
          instructions:
            "Answer all questions. Your responses are saved continuously and submitted when time expires.",
          requiresPin: false,
          maxTabViolations: localExam.maxTabViolations ?? 3,
        };
      }
    } catch {}
  }
  return null;
}

export default function CandidateLobby({ examCode }: CandidateLobbyProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedExamCode = examCode.trim().toUpperCase();
  const {
    data: remoteExam,
    isLoading: isLoadingExam,
    error: examLookupError,
  } = useGetExamByCodeQuery(normalizedExamCode);
  const [startAttempt] = useStartAttemptMutation();

  const [metadata, setMetadata] = useState<ExamMetadata | null>(() =>
    getInitialExamMetadata(normalizedExamCode),
  );

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [candidatePin, setCandidatePin] = useState("");
  const [studentId, setStudentId] = useState("");
  const [externalAttemptId, setExternalAttemptId] = useState("");
  const [isResuming, setIsResuming] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Parse URL launch parameters (e.g. ?pin=849201&name=Amara&studentId=...&attemptId=...)
  useEffect(() => {
    if (!searchParams) return;
    const queryPin = searchParams.get("pin");
    const queryName = searchParams.get("name");
    const queryEmail = searchParams.get("email");
    const queryStudentId = searchParams.get("studentId");
    const queryAttemptId = searchParams.get("attemptId");

    if (queryPin) setCandidatePin(queryPin.trim().toUpperCase());
    if (queryName) setCandidateName(queryName.trim());
    if (queryEmail) setCandidateEmail(queryEmail.trim());
    if (queryStudentId) setStudentId(queryStudentId.trim());
    if (queryAttemptId) setExternalAttemptId(queryAttemptId.trim());
  }, [searchParams]);

  // System Diagnostics
  const [diagnostics, setDiagnostics] = useState({
    browser: "checking", // ready | error
    visibilityApi: "checking",
    connection: "checking",
  });

  useEffect(() => {
    if (remoteExam) {
      setMetadata({
        code: remoteExam.accessCode,
        title: remoteExam.title,
        institutionName: remoteExam.workspaceName,
        durationMins: remoteExam.durationMins,
        questionCount: remoteExam.totalQuestions,
        instructions:
          remoteExam.instructions ||
          "Answer all questions. Your responses are saved continuously and submitted when time expires.",
        requiresPin: remoteExam.accessType === "ROSTER_ONLY",
        maxTabViolations: remoteExam.maxTabViolations,
      });
      return;
    }

    const fallback = getInitialExamMetadata(normalizedExamCode);
    if (fallback) {
      setMetadata(fallback);
    }
  }, [remoteExam, normalizedExamCode]);

  useEffect(() => {
    // Participant already started this exam on this device: reuse their issued PIN to resume
    const existing = loadCandidateSession(normalizedExamCode);
    if (existing && existing.status === "in_progress") {
      setCandidateName(existing.candidateName);
      setCandidatePin(existing.candidatePin);
      setIsResuming(true);
      toast.info("Resuming your in-progress exam attempt...", {
        duration: 3000,
      });
    }

    // Run Pre-Flight Diagnostics
    const runDiagnostics = () => {
      const hasVisibility =
        typeof document !== "undefined" && "visibilityState" in document;
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;

      setDiagnostics({
        browser: "ready",
        visibilityApi: hasVisibility ? "ready" : "error",
        connection: isOnline ? "ready" : "error",
      });
    };

    runDiagnostics();
    window.addEventListener("online", runDiagnostics);
    window.addEventListener("offline", runDiagnostics);
    return () => {
      window.removeEventListener("online", runDiagnostics);
      window.removeEventListener("offline", runDiagnostics);
    };
  }, [normalizedExamCode]);

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata) return;

    if (!candidateName.trim()) {
      toast.error("Please enter your full name to proceed");
      return;
    }

    if (metadata.requiresPin && candidatePin.length < 4) {
      toast.error("Please enter the access PIN issued by your examiner");
      return;
    }

    setIsVerifying(true);

    try {
      let started: any;
      try {
        started = await startAttempt({
          accessCode: metadata.code,
          candidateName: candidateName.trim(),
          candidatePin: candidatePin.trim() || undefined,
          email: candidateEmail.trim() || undefined,
          phone: candidatePhone.trim() || undefined,
          studentId: studentId.trim() || undefined,
          externalAttemptId: externalAttemptId.trim() || undefined,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }).unwrap();
      } catch (apiErr: any) {
        console.warn(
          "[Candidate Lobby] Microservice attempt start unreachable, generating local session:",
          apiErr,
        );
        const stored = loadStoredExams();
        const localExam = stored.find(
          (e) =>
            e.accessCode?.trim().toUpperCase() === metadata.code.toUpperCase(),
        );
        let storedQuestions = localExam
          ? loadStoredQuestions(localExam.id)
          : [];
        if (
          metadata.code.toUpperCase() === "BUSI-7642" &&
          storedQuestions.length === 0
        ) {
          storedQuestions = BUSI_QUESTIONS_STATIC;
        }
        const generatedPin =
          candidatePin.trim() ||
          Math.floor(100000 + Math.random() * 900000).toString();
        const durationMins = metadata.durationMins || 60;
        const now = new Date();
        const deadline = new Date(
          now.getTime() + durationMins * 60 * 1000,
        ).toISOString();

        started = {
          isResumed: false,
          attemptId:
            externalAttemptId.trim() ||
            `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          examId: localExam?.id || metadata.code,
          examTitle: metadata.title,
          candidateName: candidateName.trim(),
          candidatePin: generatedPin,
          studentId: studentId.trim() || undefined,
          durationMins: durationMins,
          deadline: deadline,
          remainingSeconds: durationMins * 60,
          violations: 0,
          maxTabViolations: metadata.maxTabViolations || 3,
          questions: storedQuestions,
          restoredAnswers: {},
        };
      }

      const now = new Date();
      const restoredAnswers = Object.fromEntries(
        Object.entries(started.restoredAnswers || {}).map(
          ([questionId, value]) => {
            if (value && typeof value === "object" && "selected" in value) {
              return [questionId, (value as any).selected];
            }
            return [questionId, value];
          },
        ),
      );

      // Initialize persistent local candidate session
      saveCandidateSession({
        attemptId: started.attemptId,
        examId: started.examId,
        examTitle: started.examTitle,
        examCode: metadata.code,
        candidateName: started.candidateName,
        candidatePin: started.candidatePin,
        studentId: started.studentId || studentId.trim() || undefined,
        startedAt: now.toISOString(),
        durationMins: started.durationMins,
        deadline: started.deadline,
        answers: restoredAnswers as Record<string, string | string[]>,
        flaggedQuestionIds: [],
        questions: started.questions,
        maxTabViolations: started.maxTabViolations,
        violations: [],
        status: "in_progress",
      });

      if (started.isResumed) {
        toast.success("Session restored. Returning to exam room...");
      } else {
        toast.success(
          `Entering exam room. Your participant ID is ${started.candidatePin}. Keep it in case you need to rejoin.`,
          {
            duration: 8000,
          },
        );
      }

      router.push(`/take/${encodeURIComponent(metadata.code)}/live`);
    } catch (err: any) {
      console.error("Failed to start session:", err);
      const message =
        err?.data?.message ||
        err?.message ||
        "Unable to start your session. Please check your details and try again.";
      toast.error(message);
      setIsVerifying(false);
    }
  };

  if (!metadata) {
    if (normalizedExamCode === "BUSI-7642") {
      const fb = getInitialExamMetadata("BUSI-7642");
      if (fb) {
        setMetadata(fb);
        return null;
      }
    }
    const notFound = Boolean(examLookupError) && !isLoadingExam;
    const lookupMessage = (examLookupError as any)?.data?.message;
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 sm:p-6 text-[var(--foreground)]">
        <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-6 sm:p-8 text-center space-y-4">
          {notFound ? (
            <>
              <XCircle className="w-10 h-10 mx-auto text-[var(--crimson-signal)]" />
              <h1 className="text-lg font-bold">Exam room unavailable</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {lookupMessage ||
                  `We couldn't open exam room "${normalizedExamCode}". Check the code with your examiner and try again.`}
              </p>
              <Button
                type="button"
                onClick={() => router.push("/take")}
                className="w-full h-11 bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)]"
              >
                Enter a different code
              </Button>
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              Loading exam room {normalizedExamCode}...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cbt-surface flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="mb-8">
        <CbtBrand />
      </div>
      <ol
        className="flex flex-wrap justify-center gap-6 text-xs text-slate-600 mb-8"
        aria-label="Candidate journey"
      >
        <li>1. Exam code</li>
        <li aria-current="step" className="font-bold text-violet-800">
          2. Your details
        </li>
        <li>3. Examination</li>
      </ol>
      {/* Container */}
      <div className="w-full max-w-xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="border-b border-[var(--border-fine)] py-5">
          <div className="flex items-center justify-between mb-2">
            <Badge
              variant="outline"
              className="bg-[var(--violet-tint)] text-[var(--violet-ink)] border-[var(--violet-ink)]/20 font-mono text-xs uppercase tracking-wider"
            >
              Room Code: {metadata.code}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
              <Clock className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>{metadata.durationMins} Minutes</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2 max-w-full truncate">
            <Laptop className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <span className="truncate">
              Exam Centre: <strong>{metadata.institutionName}</strong>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-[var(--foreground)]">
            {metadata.title}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            Room Code:{" "}
            <strong className="font-mono text-violet-700">
              {metadata.code}
            </strong>{" "}
            &bull; Duration: {metadata.durationMins} Mins
          </p>

          {metadata.code === "BUSI-7642" && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Assessment Window:{" "}
                <strong>
                  Sunday, Oct 4, 2026 &bull; 8:00 AM – 10:00 PM WAT
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleStartExam} className="py-6 space-y-6">
          {/* Candidate Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="candidate-full-name"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              Candidate Full Name
            </label>
            <Input
              type="text"
              required
              id="candidate-full-name"
              autoComplete="name"
              placeholder="e.g. Daniel Olawale"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="h-11 text-base font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
            />
          </div>

          {/* Participant contact details */}
          {!isResuming && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  Email{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </label>
                <Input
                  type="email"
                  aria-label="Email (optional)"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="h-11 text-base rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  Phone{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </label>
                <Input
                  type="tel"
                  aria-label="Phone (optional)"
                  autoComplete="tel"
                  placeholder="080..."
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                  className="h-11 text-base rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
                />
              </div>
            </div>
          )}

          {/* Access PIN: required for roster exams, optional for walk-ins rejoining */}
          {metadata.requiresPin || isResuming ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  {metadata.requiresPin
                    ? "Access PIN / Candidate Number"
                    : "Participant ID"}
                </label>
                <span className="text-xs text-[var(--text-secondary)]">
                  {metadata.requiresPin
                    ? "Issued by examiner"
                    : "Restored from this device"}
                </span>
              </div>
              <div className="flex justify-start">
                <CandidatePinInput
                  value={candidatePin}
                  onChange={(val) => setCandidatePin(val)}
                  length={
                    metadata.requiresPin ? 6 : Math.max(7, candidatePin.length)
                  }
                />
              </div>
            </div>
          ) : (
            <details className="text-xs text-[var(--text-secondary)]">
              <summary className="cursor-pointer font-semibold">
                Rejoining? Enter your participant ID
              </summary>
              <div className="pt-2">
                <Input
                  type="text"
                  placeholder="e.g. P7KQ2MX"
                  value={candidatePin}
                  onChange={(e) =>
                    setCandidatePin(e.target.value.toUpperCase())
                  }
                  className="h-10 font-mono uppercase rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
                />
              </div>
            </details>
          )}

          <section
            className="border-t border-slate-200 pt-5"
            aria-labelledby="exam-instructions"
          >
            <h2 id="exam-instructions" className="text-sm font-bold mb-2">
              Examination instructions
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
              {metadata.instructions}
            </p>
          </section>

          {/* Rules & Malpractice Warning Box */}
          <div className="bg-[var(--amber-tint)] border border-[var(--amber-signal)]/30 rounded-[var(--radius-md)] p-3.5 text-xs text-[#92400e] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[13px]">
              <AlertTriangle className="w-4 h-4 text-[var(--amber-signal)] shrink-0" />
              <span>Exam Integrity Notice</span>
            </div>
            <p className="leading-relaxed">
              This is a monitored exam hall. Leaving this window, switching
              browser tabs, or minimizing the screen is logged. Accumulating{" "}
              <strong>
                {metadata.maxTabViolations} malpractice violations
              </strong>{" "}
              will trigger immediate automatic submission and lock your attempt.
            </p>
          </div>

          {/* System Diagnostics Strip */}
          <div className="pt-2 border-t border-[var(--border-fine)]">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
              <span className="font-semibold uppercase tracking-wider">
                System Readiness
              </span>
              <span className="text-[11px] text-slate-600">
                {diagnostics.connection === "ready"
                  ? "Device online"
                  : "Device offline"}
              </span>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-[11px] sm:text-xs">
                {diagnostics.browser === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)] shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)] shrink-0" />
                )}
                <span className="truncate">Browser OK</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-[11px] sm:text-xs">
                {diagnostics.visibilityApi === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)] shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)] shrink-0" />
                )}
                <span className="truncate">Anti-Cheat</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 sm:p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-[11px] sm:text-xs">
                {diagnostics.connection === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)] shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)] shrink-0" />
                )}
                <span>
                  {diagnostics.connection === "ready" ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Submit CTA Button */}
          <Button
            type="submit"
            disabled={isVerifying}
            className="w-full h-12 text-base font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)] transition-all flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <span>Preparing Exam Room...</span>
            ) : (
              <>
                <span>Start Examination Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Footer info */}
        <div className="bg-[var(--surface-subtle)] border-t border-[var(--border-fine)] px-6 py-3 text-center text-[11px] text-[var(--text-secondary)]">
          Powered by <strong className="text-violet-700">ParaLearn CBT</strong>{" "}
          &bull; Secure Standalone Assessment Engine
        </div>
      </div>
    </div>
  );
}
