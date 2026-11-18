"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Clock,
  FileText,
  Hash,
  ListChecks,
  Loader2,
  ShieldAlert,
  UserRound,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-candidate.css";
import {
  saveCandidateSession,
  loadCandidateSession,
  loadStoredExams,
  loadStoredQuestions,
} from "@cbt/lib/cbtSessionManager";
import { startCbtSync, warmOfflineCache } from "@cbt/lib/cbtOfflineSync";
import {
  useGetExamByCodeQuery,
  useStartAttemptMutation,
} from "@cbt/store/cbtMicroserviceApi";

interface ExamMetadata {
  code: string;
  title: string;
  institutionName: string;
  durationMins: number;
  questionCount: number;
  totalMarks: number;
  instructions: string;
  requiresPin: boolean;
  maxTabViolations: number;
  isPublished: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

/** "2:05 PM" today, "18 Nov, 2:05 PM" on another day */
function formatWhen(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date(now).toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

/** "in 44 minutes", "in 2 hours", for a start time that hasn't come yet */
function timeUntil(iso: string, now = Date.now()) {
  const mins = Math.ceil((new Date(iso).getTime() - now) / 60000);
  if (mins <= 1) return "in less than a minute";
  if (mins < 60) return `in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `in about ${hours} hour${hours === 1 ? "" : "s"}` : `on ${new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}`;
}

/** Whether candidates can start now, and why not */
function availabilityOf(meta: ExamMetadata, now = Date.now()) {
  if (!meta.isPublished) {
    return { open: false, message: "This exam isn't open yet. Check with your examiner." };
  }
  if (meta.startsAt && now < new Date(meta.startsAt).getTime()) {
    return {
      open: false,
      message: `This exam opens ${new Date(meta.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`,
    };
  }
  if (meta.endsAt && now > new Date(meta.endsAt).getTime()) {
    return { open: false, message: "This exam has closed." };
  }
  return { open: true, message: "" };
}

interface CandidateLobbyProps {
  examCode: string;
}

function CandidatePinInput({
  value,
  onChange,
  length = 6,
  invalid = false,
}: {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  invalid?: boolean;
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
    <div className={`cand-pin ${length === 6 ? "is-six" : ""} ${invalid ? "is-invalid" : ""}`}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          maxLength={1}
          aria-label={`PIN character ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          autoCapitalize="characters"
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}

/** The server is the only source of exam details for candidates */
function getInitialExamMetadata(_code: string): ExamMetadata | null {
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

  // Registers the offline worker early and sends anything left from an earlier visit
  useEffect(() => {
    startCbtSync();
  }, []);

  const [metadata, setMetadata] = useState<ExamMetadata | null>(() =>
    getInitialExamMetadata(normalizedExamCode),
  );

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [candidatePin, setCandidatePin] = useState("");
  const [externalAttemptId, setExternalAttemptId] = useState("");
  const [isResuming, setIsResuming] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  // A PIN from the examiner's list identifies the student, so they aren't asked for their name
  const [enrolledName, setEnrolledName] = useState<string | null>(null);
  const [pinLookup, setPinLookup] = useState<"idle" | "checking" | "found" | "unknown">("idle");

  // Parse URL launch parameters (e.g. ?pin=849201&name=Amara&attemptId=...); a student id comes only from the roster
  useEffect(() => {
    if (!searchParams) return;
    const queryPin = searchParams.get("pin");
    const queryName = searchParams.get("name");
    const queryEmail = searchParams.get("email");
    const queryAttemptId = searchParams.get("attemptId");

    if (queryPin) setCandidatePin(queryPin.trim().toUpperCase());
    if (queryName) setCandidateName(queryName.trim());
    if (queryEmail) setCandidateEmail(queryEmail.trim());
    if (queryAttemptId) setExternalAttemptId(queryAttemptId.trim());
  }, [searchParams]);

  // Re-checks the exam window as time passes, so Start turns on by itself when the exam opens
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(tick);
  }, []);
  const [newCode, setNewCode] = useState("");

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
        totalMarks: remoteExam.totalMarks,
        instructions:
          remoteExam.instructions ||
          "Answer all questions. Your responses are saved continuously and submitted when time expires.",
        requiresPin: remoteExam.accessType === "ROSTER_ONLY",
        maxTabViolations: remoteExam.maxTabViolations,
        isPublished: remoteExam.isPublished !== false,
        startsAt: remoteExam.startsAt || null,
        endsAt: remoteExam.endsAt || null,
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

  useEffect(() => {
    const code = metadata?.code;
    const pin = candidatePin.trim();
    if (!code || !/^\d{6}$/.test(pin)) {
      setEnrolledName(null);
      setPinLookup("idle");
      return;
    }
    const controller = new AbortController();
    setPinLookup("checking");
    fetch(`/api/cbt/exams/code/${encodeURIComponent(code)}/candidate?pin=${encodeURIComponent(pin)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          setEnrolledName(null);
          setPinLookup("unknown");
          return;
        }
        const { candidateName: name } = await res.json();
        setEnrolledName(name);
        setCandidateName(name);
        setPinLookup("found");
      })
      .catch(() => {
        // Offline or aborted: the student can still type their name
        if (!controller.signal.aborted) setPinLookup("idle");
      });
    return () => controller.abort();
  }, [metadata?.code, candidatePin]);

  const clearEnrolled = () => {
    setEnrolledName(null);
    setCandidateName("");
    setCandidatePin("");
    setPinLookup("idle");
  };

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metadata) return;

    if (metadata.requiresPin && candidatePin.length < 4) {
      toast.error("Please enter the access PIN issued by your examiner");
      return;
    }

    if (metadata.requiresPin && pinLookup === "unknown") {
      toast.error("That PIN isn't on this exam's list. Check the PIN on your exam slip.");
      return;
    }

    if (!candidateName.trim() && !(metadata.requiresPin && pinLookup !== "found")) {
      toast.error("Please enter your full name to proceed");
      return;
    }

    setIsVerifying(true);

    try {
      // Attempts must exist on the server so they can be submitted and graded —
      // never fall back to a local-only session.
      const started: any = await startAttempt({
        accessCode: metadata.code,
        // Enrolled candidates are admitted by PIN under the name on the examiner's list
        candidateName:
          enrolledName || candidateName.trim() || (metadata.requiresPin ? "Enrolled candidate" : ""),
        candidatePin: candidatePin.trim() || undefined,
        email: candidateEmail.trim() || undefined,
        phone: candidatePhone.trim() || undefined,
        externalAttemptId: externalAttemptId.trim() || undefined,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }).unwrap();

      const now = new Date();
      const serverNow = started.serverNow ? new Date(started.serverNow).getTime() : NaN;
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

      // On rejoin keep this device's flags; the tab-switch count comes from the server
      const previous = loadCandidateSession(metadata.code, started.candidatePin);
      const serverViolations = Number(started.violations) || 0;

      // Initialize persistent local candidate session
      saveCandidateSession({
        attemptId: started.attemptId,
        attemptToken: started.attemptToken,
        showResultAfter: started.showResultAfter !== false,
        instructions: started.instructions || null,
        examId: started.examId,
        examTitle: started.examTitle,
        examCode: metadata.code,
        candidateName: started.candidateName,
        candidatePin: started.candidatePin,
        studentId: started.studentId || undefined,
        startedAt: now.toISOString(),
        durationMins: started.durationMins,
        deadline: started.deadline,
        clockOffsetMs: Number.isFinite(serverNow) ? serverNow - now.getTime() : 0,
        answers: restoredAnswers as Record<string, string | string[]>,
        flaggedQuestionIds: started.isResumed ? previous?.flaggedQuestionIds || [] : [],
        questions: started.questions,
        maxTabViolations: started.maxTabViolations,
        violations: Array.from({ length: serverViolations }, (_, i) =>
          previous?.violations?.[i] || { type: "tab_switch", timestamp: started.serverNow, questionIdx: 0 },
        ),
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

      // Everything the exam needs is now on the device; save the pages for offline use
      void warmOfflineCache(metadata.code);
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
    const lookupMessage: string | undefined = (examLookupError as any)?.data?.message;
    const genericLookup = !lookupMessage || /not found/i.test(lookupMessage);
    return (
      <div className="cbt-surface cand-page">
        <header className="cand-topbar">
          <CbtBrand />
        </header>
        <main className="cand-center-main">
          <div className="cand-card cand-message" role={notFound ? "alert" : "status"}>
            {notFound ? (
              <>
                <span className="cand-message-icon is-bad" aria-hidden>
                  <XCircle size={26} />
                </span>
                <h1>We couldn&apos;t find that exam</h1>
                <p>
                  {genericLookup ? (
                    <>
                      No open exam uses the code{" "}
                      <strong className="cand-mono">{normalizedExamCode}</strong>.
                    </>
                  ) : (
                    lookupMessage
                  )}
                </p>
                {genericLookup && (
                <p className="cand-message-help">
                  Check the code on your hall slip or exam message, or ask your examiner.
                </p>
                )}
                <form
                  className="cand-code-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = newCode.trim().toUpperCase();
                    if (code) router.push(`/take/${encodeURIComponent(code)}`);
                  }}
                >
                  <label htmlFor="cand-new-code" className="sr-only">
                    Exam code
                  </label>
                  <input
                    id="cand-new-code"
                    className="cand-input is-code"
                    placeholder="Exam code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  />
                  <button type="submit" className="cand-btn primary" disabled={!newCode.trim()}>
                    Try this code
                    <ArrowRight size={17} aria-hidden />
                  </button>
                </form>
              </>
            ) : (
              <>
                <Loader2 size={26} className="cand-spin text-[var(--violet-ink)]" aria-hidden />
                <p>
                  Opening exam room <span className="cand-mono">{normalizedExamCode}</span>
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  const availability = availabilityOf(metadata, now);
  const startsLater = Boolean(
    metadata.isPublished && metadata.startsAt && now < new Date(metadata.startsAt).getTime(),
  );
  const hasClosed = Boolean(
    metadata.isPublished && metadata.endsAt && now > new Date(metadata.endsAt).getTime(),
  );
  // Closed or unpublished: nothing to fill in. Opening later: details can be entered while waiting.
  const blocked = !availability.open && !startsLater;
  const windowChip = !metadata.isPublished
    ? { tone: "is-warn", text: "Not open yet" }
    : startsLater
      ? { tone: "is-warn", text: `Opens ${formatWhen(metadata.startsAt as string, now)}` }
      : hasClosed
        ? { tone: "is-bad", text: "Closed" }
        : metadata.endsAt
          ? { tone: "is-ok", text: `Open until ${formatWhen(metadata.endsAt, now)}` }
          : { tone: "is-ok", text: "Open now" };
  const online = diagnostics.connection !== "error";
  const detailsLabel = metadata.requiresPin ? "Your PIN" : "Your details";
  const pinInvalid = pinLookup === "unknown" && metadata.requiresPin;

  const welcome = enrolledName && (
    <div className="cand-welcome" role="status">
      <div className="cand-welcome-person">
        <span className="cand-avatar" aria-hidden>
          <UserRound size={20} />
        </span>
        <div className="min-w-0">
          <p>Welcome</p>
          <strong>{enrolledName}</strong>
        </div>
      </div>
      <button type="button" onClick={clearEnrolled} className="cand-link">
        Not you?
      </button>
    </div>
  );

  // Access PIN: required for roster exams; for walk-ins it is the participant ID used to rejoin
  const pinField =
    metadata.requiresPin || isResuming ? (
      <div className="cand-field" role="group" aria-labelledby="cand-pin-label">
        <div className="cand-field-row">
          <span id="cand-pin-label">{metadata.requiresPin ? "Access PIN" : "Participant ID"}</span>
          <small>
            {metadata.requiresPin
              ? "On your hall slip or exam message"
              : "Restored from this device"}
          </small>
        </div>
        <CandidatePinInput
          value={candidatePin}
          onChange={(val) => setCandidatePin(val)}
          length={metadata.requiresPin ? 6 : Math.max(7, candidatePin.length)}
          invalid={pinInvalid}
        />
        {pinLookup === "checking" && (
          <p className="cand-hint" role="status">
            <Loader2 size={14} className="cand-spin" aria-hidden />
            Checking your PIN…
          </p>
        )}
        {pinInvalid && (
          <p className="cand-hint bad" role="alert">
            <AlertTriangle size={14} aria-hidden />
            That PIN isn&apos;t on this exam&apos;s list. Check the PIN on your hall slip, or ask
            your examiner.
          </p>
        )}
      </div>
    ) : (
      <details className="cand-rejoin">
        <summary>Rejoining? Enter your participant ID</summary>
        <input
          type="text"
          aria-label="Participant ID"
          placeholder="e.g. P7KQ2MX"
          value={candidatePin}
          onChange={(e) => setCandidatePin(e.target.value.toUpperCase())}
          className="cand-input is-code"
        />
      </details>
    );

  const nameField = (
    <label className="cand-field" htmlFor="candidate-full-name">
      Full name
      <input
        type="text"
        required
        id="candidate-full-name"
        autoComplete="name"
        placeholder="e.g. Daniel Olawale"
        value={candidateName}
        onChange={(e) => setCandidateName(e.target.value)}
        className="cand-input"
      />
    </label>
  );

  const contactFields = (
    <details className="cand-rejoin cand-contact">
      <summary>Add your email or phone (optional)</summary>
      <div className="cand-two">
        <label className="cand-field">
          Email
          <input
            type="email"
            aria-label="Email (optional)"
            autoComplete="email"
            placeholder="you@example.com"
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
            className="cand-input"
          />
        </label>
        <label className="cand-field">
          Phone
          <input
            type="tel"
            aria-label="Phone (optional)"
            autoComplete="tel"
            placeholder="080..."
            value={candidatePhone}
            onChange={(e) => setCandidatePhone(e.target.value)}
            className="cand-input"
          />
        </label>
      </div>
    </details>
  );

  // Why the exam can't be started, and what to do about it
  const stateNotice = !metadata.isPublished ? (
    <section className="cand-state-card is-warn" role="status" aria-labelledby="cand-state-title">
      <Clock size={22} aria-hidden />
      <div>
        <h2 id="cand-state-title">This exam isn&apos;t open yet</h2>
        <p>
          Your examiner hasn&apos;t opened it. Wait until they tell you to start, then check again.
        </p>
        <button type="button" className="cand-btn" onClick={() => window.location.reload()}>
          Check again
        </button>
      </div>
    </section>
  ) : hasClosed ? (
    <section className="cand-state-card is-bad" role="status" aria-labelledby="cand-state-title">
      <XCircle size={22} aria-hidden />
      <div>
        <h2 id="cand-state-title">This exam has closed</h2>
        <p>
          It closed {metadata.endsAt ? `at ${formatWhen(metadata.endsAt, now)}` : "earlier"}. If you
          think this is a mistake, speak to your examiner.
        </p>
        <button type="button" className="cand-btn" onClick={() => router.push("/take")}>
          Enter a different code
        </button>
      </div>
    </section>
  ) : startsLater ? (
    <section className="cand-state-card is-info" role="status" aria-labelledby="cand-state-title">
      <Clock size={22} aria-hidden />
      <div>
        <h2 id="cand-state-title">
          Opens {timeUntil(metadata.startsAt as string, now)}
        </h2>
        <p>
          The exam starts at {formatWhen(metadata.startsAt as string, now)}. You can enter your
          details now. Start turns on by itself when the exam opens.
        </p>
      </div>
    </section>
  ) : null;

  return (
    <div className="cbt-surface cand-page">
      <header className="cand-topbar">
        <CbtBrand />
        <span className={`cand-chip ${online ? "is-ok" : "is-warn"}`} role="status">
          {online ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <main className="cand-lobby">
        <ol className="cand-steps" aria-label="Your progress">
          <li className="is-done">
            <span className="cand-step-mark" aria-hidden>
              <Check size={15} strokeWidth={3} />
            </span>
            <span className="cand-step-text">
              <small>Step 1</small>
              <strong>
                Code <span className="cand-mono">{metadata.code}</span>
              </strong>
            </span>
          </li>
          <li className="cand-step-line is-done" aria-hidden />
          <li className="is-current" aria-current="step">
            <span className="cand-step-mark" aria-hidden>
              2
            </span>
            <span className="cand-step-text">
              <small>Step 2</small>
              <strong>{detailsLabel}</strong>
            </span>
          </li>
          <li className="cand-step-line" aria-hidden />
          <li>
            <span className="cand-step-mark" aria-hidden>
              3
            </span>
            <span className="cand-step-text">
              <small>Step 3</small>
              <strong>Examination</strong>
            </span>
          </li>
        </ol>

        <header className="cand-exam-head" aria-labelledby="exam-title">
          {metadata.institutionName && (
            <p className="cand-exam-school">
              <Building2 size={15} aria-hidden />
              {metadata.institutionName}
            </p>
          )}
          <h1 id="exam-title">{metadata.title}</h1>
          <div className="cand-exam-facts">
            <span>
              <Clock size={15} aria-hidden />
              {metadata.durationMins} minutes
            </span>
            <span>
              <ListChecks size={15} aria-hidden />
              {metadata.questionCount} question{metadata.questionCount === 1 ? "" : "s"}
            </span>
            {metadata.totalMarks > 0 && (
              <span>
                <Hash size={15} aria-hidden />
                {metadata.totalMarks} marks
              </span>
            )}
            <span className={`cand-chip ${windowChip.tone}`}>
              <span className="cand-dot" aria-hidden />
              {windowChip.text}
            </span>
          </div>
        </header>

        <form onSubmit={handleStartExam} className={`cand-lobby-grid ${blocked ? "is-blocked" : ""}`}>
          {stateNotice && <div className="cand-area-state">{stateNotice}</div>}

          {!blocked && (
            <section className="cand-panel cand-card cand-area-details" aria-labelledby="candidate-details">
              <div className="cand-panel-head">
                <h2 id="candidate-details">
                  {metadata.requiresPin ? "Enter your access PIN" : "Your details"}
                </h2>
                <p className="cand-panel-lead">
                  {metadata.requiresPin
                    ? "Type the 6-digit PIN your examiner gave you. Your name appears once the PIN is recognised."
                    : "Enter your name as you want it on your result slip. No account is needed."}
                </p>
              </div>

              {metadata.requiresPin ? (
                <>
                  {pinField}
                  {welcome}
                </>
              ) : (
                <>
                  {welcome || nameField}
                  {!isResuming && !enrolledName && contactFields}
                  {pinField}
                </>
              )}
            </section>
          )}

          <section className="cand-notes cand-area-notes" aria-labelledby="exam-rules">
            <div className="cand-notes-block">
              <h2>
                <FileText size={17} aria-hidden />
                Instructions
              </h2>
              <p className="cand-instructions">{metadata.instructions}</p>
            </div>
            <div className="cand-rules">
              <h2 id="exam-rules">
                <ShieldAlert size={17} aria-hidden />
                Stay on the exam page
              </h2>
              <p>
                Switching to another tab or app, or minimising the browser, is recorded. After{" "}
                <strong>
                  {metadata.maxTabViolations} switch{metadata.maxTabViolations === 1 ? "" : "es"}
                </strong>
                , your exam is submitted automatically and locked.
              </p>
            </div>
          </section>

          {!blocked && (
            <section className="cand-start cand-area-start" aria-label="Start the exam">
              <button
                type="submit"
                disabled={isVerifying || !availability.open}
                className="cand-btn primary"
                aria-describedby="cand-start-note"
              >
                {isVerifying ? (
                  <>
                    <Loader2 size={18} className="cand-spin" aria-hidden />
                    Preparing exam room…
                  </>
                ) : startsLater ? (
                  <>
                    <Clock size={18} aria-hidden />
                    Opens {formatWhen(metadata.startsAt as string, now)}
                  </>
                ) : (
                  <>
                    Start examination
                    <ArrowRight size={18} aria-hidden />
                  </>
                )}
              </button>
              <p id="cand-start-note" className={`cand-start-status ${online ? "" : "bad"}`} role="status">
                {!online ? (
                  <>
                    <AlertTriangle size={14} aria-hidden />
                    You&apos;re offline. Connect to the internet to start.
                  </>
                ) : (
                  <>
                    <Clock size={14} aria-hidden />
                    The {metadata.durationMins}-minute timer starts when you press Start. Answers
                    save on this device as you go.
                  </>
                )}
              </p>
              {diagnostics.visibilityApi === "error" && (
                <p className="cand-start-status bad">
                  <AlertTriangle size={14} aria-hidden />
                  This browser can&apos;t detect tab switches. Use an up-to-date browser.
                </p>
              )}
            </section>
          )}
        </form>
      </main>
    </div>
  );
}
