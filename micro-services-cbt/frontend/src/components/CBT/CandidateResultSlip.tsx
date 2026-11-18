"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  LogOut,
  MessageSquare,
  Printer,
  ShieldCheck,
} from "lucide-react";
import CbtBrand from "./CbtBrand";
import { loadCandidateSession, clearCandidateSession, CandidateSession } from "@cbt/lib/cbtSessionManager";
import { useGetResultSlipQuery } from "@cbt/store/cbtMicroserviceApi";
import { startCbtSync } from "@cbt/lib/cbtOfflineSync";
import "./cbt-workspace.css";
import "./cbt-candidate.css";

interface CandidateResultSlipProps {
  examCode: string;
}

/** Same scale the server uses */
function waecGrade(pct: number) {
  if (pct >= 75) return "A1";
  if (pct >= 70) return "B2";
  if (pct >= 65) return "B3";
  if (pct >= 60) return "C4";
  if (pct >= 55) return "C5";
  if (pct >= 50) return "C6";
  if (pct >= 45) return "D7";
  if (pct >= 40) return "E8";
  return "F9";
}

function gradeTone(grade: string) {
  if (grade.startsWith("A") || grade.startsWith("B")) return "is-good";
  if (grade.startsWith("C")) return "is-mid";
  if (grade.startsWith("D") || grade.startsWith("E")) return "is-low";
  return "is-fail";
}

const OBJECTIVE_TYPES = new Set(["MCQ", "TRUE_FALSE", "MULTI_SELECT"]);

/** "18 Nov 2026, 11:35 am": day first, as Nigerian schools write dates */
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

export default function CandidateResultSlip({ examCode }: CandidateResultSlipProps) {
  const router = useRouter();
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [pendingReviewPoll, setPendingReviewPoll] = useState(0);
  // Finish deletes this device's copy, so it asks first
  const [confirmLeave, setConfirmLeave] = useState(false);
  const { data: remoteSlip } = useGetResultSlipQuery(
    { attemptId: session?.attemptId || "", token: session?.attemptToken },
    { skip: !session?.attemptId, pollingInterval: pendingReviewPoll },
  );

  useEffect(() => {
    startCbtSync();
    const loaded = loadCandidateSession(examCode);
    const base = `/take/${encodeURIComponent(examCode)}`;
    // Only a finished attempt has a result slip
    if (!loaded) {
      router.replace(base);
      return;
    }
    if (loaded.status === "in_progress") {
      router.replace(`${base}/live`);
      return;
    }
    setSession(loaded);
  }, [examCode, router]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleFinish = () => {
    clearCandidateSession(examCode, session?.candidatePin);
    router.replace("/take");
  };

  const status = String(remoteSlip?.status || session?.status || "").toUpperCase();
  const isDisqualified = status === "DISQUALIFIED";
  const resultsWithheld = Boolean(remoteSlip?.resultsWithheld) || session?.showResultAfter === false;
  const gradingStatus = remoteSlip?.gradingStatus || session?.gradingStatus;
  const isPendingReview = !resultsWithheld && gradingStatus === "PENDING_REVIEW";
  const isGraded = gradingStatus === "GRADED";

  // Keep checking while essays are being marked, so the final result appears by itself
  useEffect(() => {
    setPendingReviewPoll(isPendingReview ? 30000 : 0);
  }, [isPendingReview]);

  const breakdown = remoteSlip?.resultSlip?.breakdown;
  const objectiveScore = breakdown?.mcqScore ?? session?.mcqScore ?? 0;
  const essayScore = breakdown?.essayScore ?? session?.essayScore ?? 0;
  const totalScore = remoteSlip?.score ?? session?.score ?? 0;
  const grandTotalMarks = remoteSlip?.totalMarks ?? session?.totalMarks ?? 0;
  const percentage =
    remoteSlip?.percentage ??
    session?.percentage ??
    (grandTotalMarks > 0 ? Math.round((totalScore / grandTotalMarks) * 100) : 0);
  const grade = remoteSlip?.grade || waecGrade(percentage);
  const feedback = remoteSlip?.examinerFeedback;
  const submittedAt = remoteSlip?.submittedAt || session?.pendingSubmit?.submittedAt;
  const violationCount = remoteSlip?.violations ?? session?.violations?.length ?? 0;

  if (!session) {
    return (
      <div className="cbt-surface cand-center">
        <div className="cand-card">
          <Loader2 size={28} className="animate-spin text-[var(--violet-ink)]" aria-hidden />
          <p>Loading your result…</p>
        </div>
      </div>
    );
  }

  // Marks available per part, from the questions this device was given
  const objectiveMax = (session.questions || [])
    .filter((q) => OBJECTIVE_TYPES.has(q.type))
    .reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const writtenMax = (session.questions || [])
    .filter((q) => !OBJECTIVE_TYPES.has(q.type))
    .reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const counts = breakdown && breakdown.totalQuestions > 0 ? breakdown : null;
  const showScore = !isDisqualified && !resultsWithheld;
  const examTitle = remoteSlip?.examTitle || session.examTitle || "Examination";
  const candidateName = remoteSlip?.candidateName || session.candidateName || "Candidate";
  const timeSpent = remoteSlip?.timeSpentMins;
  const feedbackItems = Object.entries(feedback?.byQuestion || {}).filter(([, text]) => text);
  const questionNumber = (qId: string) => {
    const idx = (session.questions || []).findIndex((q) => q.id === qId);
    return idx >= 0 ? idx + 1 : null;
  };
  const schoolName: string | undefined = remoteSlip?.workspaceName || remoteSlip?.institutionName;
  // Roster PINs are 6 digits; walk-ins get a participant ID
  const idLabel = /^\d{6}$/.test(session.candidatePin || "") ? "Access PIN" : "Participant ID";
  const showGrade = grandTotalMarks > 0;

  const statusChip = isDisqualified
    ? { tone: "is-bad", text: "Locked" }
    : resultsWithheld
      ? { tone: "", text: "Submitted" }
      : isPendingReview
        ? { tone: "is-warn", text: "Provisional" }
        : { tone: "is-ok", text: "Final result" };

  return (
    <div className="cbt-surface cand-page">
      <main className="cand-slip">
        <article className="cand-slip-card cand-card" aria-labelledby="slip-title">
          <div className="cand-slip-brand">
            <CbtBrand />
            <span>Result slip</span>
          </div>
          <header className="cand-slip-head">
            <div className="min-w-0">
              {schoolName && <p className="cand-slip-school">{schoolName}</p>}
              <h1 id="slip-title">{examTitle}</h1>
              <p>
                Exam code <span className="cand-mono font-semibold">{examCode.toUpperCase()}</span>
              </p>
            </div>
            <span className={`cand-chip ${statusChip.tone}`}>
              <span className="cand-dot" aria-hidden />
              {statusChip.text}
            </span>
          </header>

          <dl className="cand-slip-details">
            <div>
              <dt>Candidate</dt>
              <dd>{candidateName}</dd>
            </div>
            <div>
              <dt>{idLabel}</dt>
              <dd className="cand-mono">{session.candidatePin}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>
                {submittedAt ? formatDateTime(submittedAt) : "Not recorded"}
                {timeSpent ? (
                  <span className="block text-xs font-normal text-[var(--text-secondary)]">
                    {timeSpent} min used
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Tab switches</dt>
              <dd className={violationCount > 0 ? "warn" : "ok"}>
                {violationCount > 0 ? (
                  <AlertCircle size={14} className="inline -mt-0.5 mr-1" aria-hidden />
                ) : (
                  <ShieldCheck size={14} className="inline -mt-0.5 mr-1" aria-hidden />
                )}
                {violationCount === 0 ? "None" : `${violationCount} recorded`}
              </dd>
            </div>
          </dl>

          {isDisqualified ? (
            <section className="cand-state is-bad" role="status">
              <h2>
                <AlertCircle size={18} aria-hidden />
                This attempt was locked
              </h2>
              <p>
                The exam was submitted automatically after too many tab switches. Speak to your
                examiner if you think this is a mistake.
              </p>
            </section>
          ) : resultsWithheld ? (
            <section className="cand-state is-neutral" role="status">
              <h2>
                <CheckCircle2 size={18} aria-hidden />
                Your exam has been submitted
              </h2>
              <p>Your examiner will release results later. Keep this slip as proof of submission.</p>
            </section>
          ) : isPendingReview ? (
            <>
              <section className="cand-score">
                <div className="cand-score-main">
                  <span className="cand-eyebrow">Objective score so far</span>
                  <div className="cand-score-figure">
                    <strong>{objectiveScore}</strong>
                    {objectiveMax > 0 && <span>of {objectiveMax} marks</span>}
                  </div>
                </div>
              </section>
              <section className="cand-state is-pending" role="status">
                <h2>
                  <Clock size={18} aria-hidden />
                  Written answers are being marked
                </h2>
                <p>
                  Your examiner is marking your written answers. This page updates by itself when
                  your final result is ready.
                </p>
              </section>
            </>
          ) : (
            <section className="cand-score">
              <div className="cand-score-main">
                <span className="cand-eyebrow">Final score</span>
                <div className="cand-score-figure">
                  <strong>{percentage}%</strong>
                  <span>
                    {totalScore} of {grandTotalMarks} marks
                  </span>
                </div>
              </div>
              {showGrade && (
                <div className={`cand-grade ${gradeTone(grade)}`}>
                  <small>Grade</small>
                  <strong>{grade}</strong>
                </div>
              )}
            </section>
          )}

          {showScore && (objectiveMax > 0 || writtenMax > 0 || counts) && (
            <section className="cand-breakdown" aria-label="Score breakdown">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Part</th>
                    <th scope="col">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {(objectiveMax > 0 || writtenMax === 0) && (
                    <tr>
                      <td>
                        Objective questions
                        {counts && (
                          <span className="block text-xs text-[var(--text-secondary)]">
                            {counts.correctCount} correct · {counts.wrongCount} wrong ·{" "}
                            {counts.unansweredCount} not answered
                          </span>
                        )}
                      </td>
                      <td className="cand-mono">
                        {objectiveScore}
                        {objectiveMax > 0 ? ` / ${objectiveMax}` : ""}
                      </td>
                    </tr>
                  )}
                  {writtenMax > 0 && (
                    <tr>
                      <td>Written answers</td>
                      {isPendingReview ? (
                        <td className="is-pending">Being marked</td>
                      ) : (
                        <td className="cand-mono">
                          {essayScore} / {writtenMax}
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {showScore && (feedback?.comment || feedbackItems.length > 0) && (
            <section className="cand-feedback" aria-labelledby="examiner-feedback">
              <h2 id="examiner-feedback">
                <MessageSquare size={16} aria-hidden />
                Examiner feedback
              </h2>
              {feedback?.comment && <blockquote>{feedback.comment}</blockquote>}
              {feedbackItems.map(([qId, text], idx) => {
                const number = questionNumber(qId);
                return (
                  <blockquote key={qId}>
                    <strong>{number ? `Question ${number}` : `Written answer ${idx + 1}`}</strong>
                    {String(text)}
                  </blockquote>
                );
              })}
            </section>
          )}

          <footer className="cand-slip-foot">
            <span>
              <FileText size={13} className="inline -mt-0.5 mr-1" aria-hidden />
              Attempt reference{" "}
              <span className="cand-mono font-semibold text-[var(--foreground)]">
                {(session.attemptId || "").slice(-12).toUpperCase() || "None"}
              </span>
            </span>
            <span>Generated by ParaLearn CBT on {formatDateTime(new Date().toISOString())}</span>
          </footer>
        </article>

        {confirmLeave ? (
          <section className="cand-leave print:hidden" role="alertdialog" aria-labelledby="cand-leave-title">
            <h2 id="cand-leave-title">Leave this page?</h2>
            <p>
              You won&apos;t be able to open this slip again on this device. Print it first if you
              need a copy.
            </p>
            <div className="cand-slip-actions">
              <button type="button" onClick={() => setConfirmLeave(false)} className="cand-btn">
                Stay on this page
              </button>
              <button type="button" onClick={handlePrint} className="cand-btn">
                <Printer size={16} aria-hidden />
                Print slip
              </button>
              <button type="button" onClick={handleFinish} className="cand-btn primary">
                <LogOut size={16} aria-hidden />
                Yes, leave
              </button>
            </div>
          </section>
        ) : (
          <div className="cand-slip-actions print:hidden">
            <button type="button" onClick={handlePrint} className="cand-btn">
              <Printer size={16} aria-hidden />
              Print slip
            </button>
            <button type="button" onClick={() => setConfirmLeave(true)} className="cand-btn primary">
              <LogOut size={16} aria-hidden />
              Finish and leave
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
