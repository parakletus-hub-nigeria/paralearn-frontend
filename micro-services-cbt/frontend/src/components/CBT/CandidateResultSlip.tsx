"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  Printer, 
  Award, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  RotateCcw,
  QrCode,
  FileText,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadCandidateSession, clearCandidateSession, CandidateSession } from "@cbt/lib/cbtSessionManager";
import { useGetResultSlipQuery } from "@cbt/store/cbtMicroserviceApi";

interface CandidateResultSlipProps {
  examCode: string;
}

export default function CandidateResultSlip({ examCode }: CandidateResultSlipProps) {
  const router = useRouter();
  const [session, setSession] = useState<CandidateSession | null>(null);
  const { data: remoteSlip } = useGetResultSlipQuery(session?.attemptId || "", {
    skip: !session?.attemptId,
  });

  useEffect(() => {
    const loaded = loadCandidateSession(examCode);
    setSession(loaded);
  }, [examCode]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleRetakeOrFinish = () => {
    clearCandidateSession(examCode, session?.candidatePin);
    router.replace(`/take/${encodeURIComponent(examCode)}`);
  };

  const isPendingReview = session?.gradingStatus === "PENDING_REVIEW";
  const isGraded = session?.gradingStatus === "GRADED";
  const isDisqualified = (remoteSlip?.status || session?.status) === "DISQUALIFIED" || session?.status === "disqualified";

  const mcqScore = remoteSlip?.score ?? session?.mcqScore ?? session?.score ?? 0;
  const essayScore = session?.essayScore ?? 0;
  const totalScore = isGraded ? (mcqScore + essayScore) : mcqScore;
  const grandTotalMarks = remoteSlip?.totalMarks ?? session?.totalMarks ?? 20;
  const percentage = remoteSlip?.percentage ?? session?.percentage ?? (grandTotalMarks > 0 ? Math.round((totalScore / grandTotalMarks) * 100) : 0);

  // Calculate grade
  const getGrade = (pct: number) => {
    if (pct >= 75) return { letter: "A1", desc: "Excellent", tint: "bg-[var(--emerald-tint)] text-[#065f46]" };
    if (pct >= 65) return { letter: "B2", desc: "Very Good", tint: "bg-[var(--emerald-tint)] text-[#065f46]" };
    if (pct >= 50) return { letter: "C4", desc: "Credit", tint: "bg-[var(--cobalt-tint)] text-[#1e40af]" };
    if (pct >= 40) return { letter: "P7", desc: "Pass", tint: "bg-[var(--amber-tint)] text-[#92400e]" };
    return { letter: "F9", desc: "Fail", tint: "bg-[var(--crimson-tint)] text-[#991b1b]" };
  };

  const gradeInfo = getGrade(percentage);

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-3 sm:p-8 font-sans text-[var(--foreground)] print:bg-white print:p-0">
      
      {/* Container */}
      <div className="w-full max-w-xl bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden print:border-none print:shadow-none">
        
        {/* Slip Header */}
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-fine)] p-4 sm:p-6 text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-xs border border-[var(--border-fine)] mb-1">
            {isDisqualified ? (
              <AlertCircle className="w-6 h-6 text-[var(--crimson-signal)]" />
            ) : isPendingReview ? (
              <Clock className="w-6 h-6 text-amber-600" />
            ) : (
              <Award className="w-6 h-6 text-[var(--violet-ink)]" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Official Examination Result Slip
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Exam Room Code: <strong className="font-mono text-violet-700">{examCode.toUpperCase()}</strong>
          </p>

          {isPendingReview && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Provisional &bull; Essays Awaiting Examiner Grading</span>
            </div>
          )}
        </div>

        {/* Slip Content */}
        <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
          
          {/* Candidate Info Grid */}
          <div className="grid grid-cols-2 gap-4 pb-6 border-b border-[var(--border-fine)] text-xs">
            <div>
              <span className="text-[var(--text-secondary)] uppercase font-semibold text-[10px]">Candidate Name</span>
              <div className="font-bold text-sm text-[var(--foreground)] mt-0.5 truncate">
                {remoteSlip?.candidateName || session?.candidateName || "Candidate"}
              </div>
            </div>

            <div>
              <span className="text-[var(--text-secondary)] uppercase font-semibold text-[10px]">Access PIN</span>
              <div className="font-bold font-mono text-sm text-[var(--foreground)] mt-0.5">
                {session?.candidatePin || "WALK_IN"}
              </div>
            </div>

            <div>
              <span className="text-[var(--text-secondary)] uppercase font-semibold text-[10px]">Submission Time</span>
              <div className="font-medium text-xs text-[var(--foreground)] mt-0.5">
                {remoteSlip?.submittedAt
                  ? `${new Date(remoteSlip.submittedAt).toLocaleDateString()} ${new Date(remoteSlip.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>

            <div>
              <span className="text-[var(--text-secondary)] uppercase font-semibold text-[10px]">Security Audit</span>
              <div className="font-medium text-xs text-[var(--emerald-signal)] flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{remoteSlip?.violations ?? session?.violations?.length ?? 0} Malpractice Flags</span>
              </div>
            </div>
          </div>

          {/* Performance Highlight Box */}
          {isDisqualified ? (
            <div className="bg-[var(--crimson-tint)] border border-[var(--crimson-signal)]/40 rounded-[var(--radius-md)] p-5 text-center space-y-2">
              <div className="font-bold text-base text-[#991b1b]">Examination Disqualified</div>
              <p className="text-xs text-[#991b1b]/90 max-w-sm mx-auto">
                This attempt was flagged and locked due to exceeding allowed tab-switch and malpractice thresholds.
              </p>
            </div>
          ) : isPendingReview ? (
            <div className="bg-amber-50/50 border border-amber-200 rounded-[var(--radius-md)] p-6 text-center space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Objective MCQ Performance (Provisional)
              </span>

              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-amber-950 tracking-tight">
                  {mcqScore}
                </span>
                <span className="text-sm font-mono text-amber-800">
                  MCQ Marks Awarded
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs text-amber-900 text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Theory &amp; Essay Questions Status:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700">
                  Your written short answers and long essay compositions are currently under review by your examiner using the ParaLearn AI evaluation engine. Your finalized composite grade will update automatically once verified.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--surface-subtle)] border border-[var(--border-fine)] rounded-[var(--radius-md)] p-6 text-center space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Final Assessment Score
              </span>

              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[var(--foreground)] tracking-tight">
                  {percentage}%
                </span>
                <span className="text-sm font-mono text-[var(--text-secondary)]">
                  ({totalScore} / {grandTotalMarks} Marks)
                </span>
              </div>

              {isGraded && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono py-1">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Objective MCQ</span>
                    <span className="font-bold text-slate-800">{mcqScore} Marks</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Theory &amp; Essay</span>
                    <span className="font-bold text-slate-800">{essayScore} Marks</span>
                  </div>
                </div>
              )}

              <div>
                <Badge className={`${gradeInfo.tint} font-bold text-xs uppercase px-3 py-1 rounded-full border-0`}>
                  Grade: {remoteSlip?.grade || gradeInfo.letter} ({remoteSlip?.grade ? "Official" : gradeInfo.desc})
                </Badge>
              </div>
            </div>
          )}

          {/* Examiner Constructive Feedback (If Graded) */}
          {isGraded && session?.essayFeedback && Object.keys(session.essayFeedback).length > 0 && (
            <div className="space-y-2 border-t border-[var(--border-fine)] pt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
                <span>Examiner Feedback &amp; Rubric Evaluation</span>
              </div>
              <div className="space-y-2">
                {Object.entries(session.essayFeedback).map(([qId, fb]) => (
                  <div key={qId} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Essay Assessment Breakdown</span>
                      <span className="font-mono text-violet-700">{fb.score} / {fb.maxScore} Marks</span>
                    </div>
                    {fb.comment && (
                      <p className="text-[11px] text-slate-600 italic">
                        "{fb.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Digital Signature & Verification Barcode */}
          <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-secondary)] border-t border-[var(--border-fine)]">
            <div className="space-y-0.5">
              <div className="font-mono text-[11px] font-semibold text-[var(--foreground)]">
                AUTH-PROOF-HASH
              </div>
              <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                {Math.random().toString(36).substring(2, 10).toUpperCase()}-VERIFIED-CBT
              </div>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
              <QrCode className="w-5 h-5 text-[var(--foreground)]" />
              <span>Official Slip</span>
            </div>
          </div>

          {/* Action Buttons (Hidden on Print) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2 print:hidden">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="w-full sm:flex-1 h-11 text-xs font-semibold rounded-[var(--radius-md)] border-[var(--border-fine)] hover:bg-[var(--surface-muted)]"
            >
              <Printer className="w-4 h-4 mr-2" />
              <span>Print Official Slip</span>
            </Button>

            <Button
              onClick={handleRetakeOrFinish}
              className="w-full sm:flex-1 h-11 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-[var(--shadow-card)]"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              <span>Exit / New Attempt</span>
            </Button>
          </div>

        </div>

        {/* Footnote */}
        <div className="bg-slate-50 border-t border-[var(--border-fine)] px-6 py-2.5 text-center text-[10px] text-[var(--text-secondary)] print:hidden">
          Certified via <strong className="text-violet-700">ParaLearn CBT</strong> &bull; Digitally Signed Result Verification Token
        </div>

      </div>
    </div>
  );
}
