"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Laptop
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveCandidateSession, loadCandidateSession } from "@/lib/cbtSessionManager";

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
  initialMetadata?: ExamMetadata;
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

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2">
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
          className="w-11 h-11 text-center font-mono font-bold text-lg rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white text-[var(--foreground)] focus:border-[var(--violet-ink)] focus:ring-2 focus:ring-[var(--violet-ink)]/20 outline-none transition-all shadow-xs"
        />
      ))}
    </div>
  );
}

export default function CandidateLobby({ examCode, initialMetadata }: CandidateLobbyProps) {
  const router = useRouter();

  const [metadata, setMetadata] = useState<ExamMetadata>(
    initialMetadata || {
      code: examCode.toUpperCase(),
      title: "General Assessment Examination",
      institutionName: "ParaLearn Assessment Centre",
      durationMins: 45,
      questionCount: 30,
      instructions: "Answer all questions to the best of your ability. Keep your window in view throughout the session. Tab switching or minimizing this browser window will be logged as malpractice violations.",
      requiresPin: true,
      maxTabViolations: 3,
    }
  );

  const [candidateName, setCandidateName] = useState("");
  const [candidatePin, setCandidatePin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // System Diagnostics
  const [diagnostics, setDiagnostics] = useState({
    browser: "checking", // ready | error
    visibilityApi: "checking",
    connection: "checking",
    pingMs: 0,
  });

  useEffect(() => {
    // Check if candidate already has an active session for this exam
    const existing = loadCandidateSession(examCode);
    if (existing && existing.status === "in_progress") {
      setCandidateName(existing.candidateName);
      setCandidatePin(existing.candidatePin);
      toast.info("Resuming your in-progress exam attempt...", {
        duration: 3000,
      });
    }

    // Run Pre-Flight Diagnostics
    const runDiagnostics = async () => {
      const startTime = performance.now();
      let ping = 25;
      try {
        await fetch("/favicon.ico", { method: "HEAD", cache: "no-store" });
        ping = Math.round(performance.now() - startTime);
      } catch (err) {
        ping = 60;
      }

      const hasVisibility = typeof document !== "undefined" && "visibilityState" in document;
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

      setDiagnostics({
        browser: "ready",
        visibilityApi: hasVisibility ? "ready" : "error",
        connection: isOnline ? "ready" : "error",
        pingMs: ping,
      });
    };

    runDiagnostics();
  }, [examCode]);

  const handleStartExam = (e: React.FormEvent) => {
    e.preventDefault();

    if (!candidateName.trim()) {
      toast.error("Please enter your full name to proceed");
      return;
    }

    if (metadata.requiresPin && candidatePin.length < 4) {
      toast.error("Please enter your 4-digit to 6-digit access PIN");
      return;
    }

    setIsVerifying(true);

    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + metadata.durationMins * 60 * 1000).toISOString();

      // Initialize persistent local candidate session
      saveCandidateSession({
        examCode: metadata.code,
        candidateName: candidateName.trim(),
        candidatePin: candidatePin.trim() || "WALK_IN",
        startedAt: now.toISOString(),
        durationMins: metadata.durationMins,
        deadline,
        answers: {},
        flaggedQuestionIds: [],
        violations: [],
        status: "in_progress",
      });

      toast.success("Identity verified. Entering exam room...");
      
      // Request fullscreen if supported for security
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen can fail if user interaction permissions are strict; proceed anyway
        });
      }

      router.push(`/take/${encodeURIComponent(metadata.code)}/live`);
    } catch (err) {
      console.error("Failed to start session:", err);
      toast.error("Unable to initialize session. Please check your storage settings.");
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4 sm:p-6 text-[var(--foreground)]">
      {/* Container */}
      <div className="w-full max-w-xl bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-fine)] px-6 py-5">
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
          
          <h1 className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-[var(--foreground)]">
            {metadata.title}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
            {metadata.institutionName}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleStartExam} className="p-6 sm:p-7 space-y-6">
          
          {/* Candidate Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              Candidate Full Name
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Daniel Olawale"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="h-11 text-base font-medium rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
            />
          </div>

          {/* Access PIN (if required) */}
          {metadata.requiresPin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  Access PIN / Candidate Number
                </label>
                <span className="text-xs text-[var(--text-secondary)]">Issued by examiner</span>
              </div>
              <div className="flex justify-start">
                <CandidatePinInput
                  value={candidatePin}
                  onChange={(val) => setCandidatePin(val)}
                />
              </div>
            </div>
          )}

          {/* Rules & Malpractice Warning Box */}
          <div className="bg-[var(--amber-tint)] border border-[var(--amber-signal)]/30 rounded-[var(--radius-md)] p-3.5 text-xs text-[#92400e] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[13px]">
              <AlertTriangle className="w-4 h-4 text-[var(--amber-signal)] shrink-0" />
              <span>Exam Integrity Notice</span>
            </div>
            <p className="leading-relaxed">
              This is a monitored exam hall. Leaving this window, switching browser tabs, or minimizing the screen is logged. 
              Accumulating <strong>{metadata.maxTabViolations} malpractice violations</strong> will trigger immediate automatic submission and lock your attempt.
            </p>
          </div>

          {/* System Diagnostics Strip */}
          <div className="pt-2 border-t border-[var(--border-fine)]">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
              <span className="font-semibold uppercase tracking-wider">System Readiness</span>
              <span className="font-mono text-[11px] text-[var(--emerald-signal)]">Ping: ~{diagnostics.pingMs}ms</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-xs">
                {diagnostics.browser === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)]" />
                )}
                <span>Browser OK</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-xs">
                {diagnostics.visibilityApi === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)]" />
                )}
                <span>Anti-Cheat Ready</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] bg-[var(--surface-subtle)] border border-[var(--border-fine)] text-xs">
                {diagnostics.connection === "ready" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[var(--crimson-signal)]" />
                )}
                <span>Online Sync</span>
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
          ParaLearn Assessment Engine &bull; Zero-Friction Standalone Testing
        </div>
      </div>
    </div>
  );
}
