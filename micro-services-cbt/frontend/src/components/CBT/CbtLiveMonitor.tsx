"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Eye,
  Award,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  loadStoredCandidates,
  loadStoredQuestions,
  loadCandidateSession,
  CandidateSession,
} from "@cbt/lib/cbtSessionManager";
import CbtEssayGradingModal from "./CbtEssayGradingModal";
import {
  AttemptReviewPayload,
  useGetLiveMonitorQuery,
  useLazyGetAttemptReviewQuery,
  useManualGradeAttemptMutation,
  useSubmitAttemptMutation,
} from "@cbt/store/cbtMicroserviceApi";

export interface CandidateLiveStatus {
  id: string;
  name: string;
  pin: string;
  answeredCount: number;
  totalQuestions: number;
  timeRemainingMins: number;
  violations: number;
  status: "registered" | "active" | "flagged" | "locked" | "submitted";
  gradingStatus?: "AUTO_SCORED" | "PENDING_REVIEW" | "GRADED";
  score?: number;
  totalMarks?: number;
  lastActive: string;
  attemptId?: string | null;
}

interface CbtLiveMonitorProps {
  examId: string;
  examTitle?: string;
  roomCode?: string;
}

export default function CbtLiveMonitor({
  examId,
  examTitle = "Examination Room Monitor",
  roomCode = "",
}: CbtLiveMonitorProps) {
  const [candidates, setCandidates] = useState<CandidateLiveStatus[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "flagged" | "locked" | "active" | "review"
  >("all");
  const [monitorMeta, setMonitorMeta] = useState({
    title: examTitle,
    code: roomCode,
  });

  // Selected candidate and question for essay grading modal
  const [gradingSession, setGradingSession] = useState<CandidateSession | null>(
    null,
  );
  const [gradingQuestion, setGradingQuestion] = useState<any | null>(null);

  // Load questions to detect essay questions
  const [questions, setQuestions] = useState<any[]>([]);
  const {
    data: monitorData,
    isFetching: isLoadingMonitor,
    error: monitorError,
    refetch: refetchMonitor,
  } = useGetLiveMonitorQuery(examId, {
    skip: !examId,
    pollingInterval: 5000,
  });
  const [fetchAttemptReview, { isFetching: isFetchingReview }] =
    useLazyGetAttemptReviewQuery();
  const [manualGradeAttempt, { isLoading: isSavingGrade }] =
    useManualGradeAttemptMutation();
  const [submitAttempt] = useSubmitAttemptMutation();

  const mapParticipantStatus = (
    participant: any,
  ): CandidateLiveStatus["status"] => {
    const status =
      participant.attemptStatus ||
      participant.status ||
      participant.rosterStatus;
    if (status === "DISQUALIFIED") return "locked";
    if (status === "SUBMITTED") return "submitted";
    if (status === "IN_PROGRESS" || status === "STARTED") return "active";
    return "registered" as CandidateLiveStatus["status"];
  };

  const mapMonitorParticipant = (
    participant: any,
    totalQuestions: number,
  ): CandidateLiveStatus => {
    const status = mapParticipantStatus(participant);
    const deadline = participant.deadline
      ? new Date(participant.deadline).getTime()
      : 0;
    const isFinished = status === "submitted" || status === "locked";
    return {
      id:
        participant.id ||
        participant.attemptId ||
        participant.candidateId ||
        participant.candidatePin,
      attemptId: participant.attemptId || participant.id || null,
      name: participant.candidateName || participant.name || "Candidate",
      pin: participant.candidatePin || participant.pin || "",
      answeredCount: participant.answeredCount ?? 0,
      totalQuestions: participant.totalQuestions ?? totalQuestions,
      timeRemainingMins:
        isFinished || !deadline
          ? 0
          : Math.max(0, Math.ceil((deadline - Date.now()) / 60000)),
      violations: participant.violations ?? 0,
      status,
      gradingStatus:
        status === "submitted" || status === "locked"
          ? participant.gradingStatus === "PENDING_REVIEW"
            ? "PENDING_REVIEW"
            : participant.gradingStatus ||
                (participant.grade || participant.score !== null
                  ? "GRADED"
                  : "PENDING_REVIEW")
          : undefined,
      score: participant.score ?? undefined,
      totalMarks: participant.totalMarks ?? monitorData?.exam?.totalMarks,
      lastActive:
        status === "registered"
          ? "Not started"
          : status === "submitted"
            ? "Submitted"
            : participant.startedAt
              ? "In progress"
              : "Just now",
    };
  };

  useEffect(() => {
    if (monitorData) {
      const totalQuestions = monitorData.exam?.totalQuestions ?? 0;
      const remoteParticipants =
        monitorData.participants || monitorData.candidates || [];
      setMonitorMeta({
        title: monitorData.exam?.title || examTitle,
        code: monitorData.exam?.accessCode || roomCode,
      });
      setCandidates(
        remoteParticipants.map((participant: any) =>
          mapMonitorParticipant(participant, totalQuestions),
        ),
      );
      return;
    }

    const qList = loadStoredQuestions(examId);
    setQuestions(qList);

    const stored = loadStoredCandidates();
    const matching = stored.filter(
      (c) => !roomCode || c.roomCode.toUpperCase() === roomCode.toUpperCase(),
    );

    // Also check active candidate session in this browser for instant test feedback
    const activeAttempt = loadCandidateSession(roomCode);
    const list: CandidateLiveStatus[] = [];

    if (activeAttempt) {
      const isFinished =
        activeAttempt.status === "submitted" ||
        activeAttempt.status === "disqualified";
      list.push({
        id: `local_${activeAttempt.candidatePin}`,
        name: activeAttempt.candidateName,
        pin: activeAttempt.candidatePin,
        answeredCount: Object.keys(activeAttempt.answers || {}).length,
        totalQuestions: activeAttempt.questions?.length || qList.length,
        timeRemainingMins: isFinished
          ? 0
          : Math.max(
              0,
              Math.ceil(
                (new Date(activeAttempt.deadline).getTime() - Date.now()) /
                  60000,
              ),
            ),
        violations: activeAttempt.violations?.length || 0,
        status: isFinished ? "submitted" : "active",
        gradingStatus:
          activeAttempt.gradingStatus ||
          (isFinished ? "PENDING_REVIEW" : undefined),
        score: activeAttempt.score,
        totalMarks: activeAttempt.totalMarks,
        lastActive: isFinished ? "Submitted" : "Just now",
      });
    }

    if (matching.length > 0) {
      matching.forEach((c) => {
        if (!list.some((existing) => existing.pin === c.pin)) {
          list.push({
            id: c.id,
            name: c.name,
            pin: c.pin,
            answeredCount: c.status === "COMPLETED" ? qList.length : 0,
            totalQuestions: qList.length,
            timeRemainingMins: 0,
            violations: 0,
            status: c.status === "COMPLETED" ? "submitted" : "active",
            gradingStatus:
              c.status === "COMPLETED" ? "PENDING_REVIEW" : undefined,
            lastActive: c.status === "COMPLETED" ? "Finished" : "Just now",
          });
        }
      });
    }

    setCandidates(list);
  }, [roomCode, examId, monitorData]);

  // Open Essay Grading for a Candidate
  const buildSessionFromReview = (
    review: AttemptReviewPayload,
  ): CandidateSession => {
    const answers = review.questions.reduce<Record<string, string | string[]>>(
      (acc, question) => {
        const raw = question.answer;
        if (Array.isArray(raw)) {
          acc[question.id] = raw.map(String);
        } else if (raw && typeof raw === "object") {
          acc[question.id] = JSON.stringify(raw);
        } else {
          acc[question.id] = raw == null ? "" : String(raw);
        }
        return acc;
      },
      {},
    );

    const essayFeedback = review.questions.reduce<
      CandidateSession["essayFeedback"]
    >((acc, question) => {
      if (question.type === "ESSAY" && question.marksAwarded !== undefined) {
        return {
          ...(acc || {}),
          [question.id]: {
            score: question.marksAwarded || 0,
            maxScore: question.marks,
          },
        };
      }
      return acc;
    }, undefined);

    return {
      attemptId: review.attemptId,
      examId: review.examId,
      examTitle: review.examTitle,
      examCode: review.accessCode,
      candidateName: review.candidateName,
      candidatePin: review.candidatePin,
      studentId: review.studentId || undefined,
      startedAt: review.submittedAt || new Date().toISOString(),
      durationMins: 0,
      deadline: review.submittedAt || new Date().toISOString(),
      answers,
      flaggedQuestionIds: [],
      questions: review.questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type === "ESSAY" ? "LONG_ESSAY" : question.type,
        marks: question.marks,
        options: question.options,
      })),
      violations: [],
      status: review.status === "DISQUALIFIED" ? "disqualified" : "submitted",
      gradingStatus: "PENDING_REVIEW",
      score: review.score,
      totalMarks: review.totalMarks,
      percentage: review.percentage,
      essayFeedback,
    };
  };

  const handleOpenEssayGrading = async (candidate: CandidateLiveStatus) => {
    if (candidate.attemptId) {
      try {
        const review = await fetchAttemptReview(candidate.attemptId).unwrap();
        const essays = review.questions.filter((q) => q.type === "ESSAY");
        // Open the next essay that still needs marks, so multi-essay exams can be fully graded
        const essayQ =
          essays.find((q) => q.marksAwarded === undefined || q.marksAwarded === null) ||
          essays[0];
        if (!essayQ) {
          toast.info(
            "This exam does not have an essay question available for manual review.",
          );
          return;
        }

        setGradingSession(buildSessionFromReview(review));
        setGradingQuestion({
          ...essayQ,
          type: "LONG_ESSAY",
        });
        return;
      } catch (err: any) {
        toast.error(
          err?.data?.message ||
            err?.message ||
            "Could not load this attempt for grading.",
        );
        return;
      }
    }

    const session = loadCandidateSession(roomCode);
    if (!session) {
      toast.error(`No submitted attempt found for PIN ${candidate.pin}.`);
      return;
    }

    const essayQ = questions.find(
      (q) =>
        q.type === "SHORT_ESSAY" ||
        q.type === "LONG_ESSAY" ||
        q.type === "ESSAY",
    );
    if (!essayQ) {
      toast.info(
        "This exam does not have an essay question available for manual review.",
      );
      return;
    }

    setGradingSession(session);
    setGradingQuestion(essayQ);
  };

  const handleManualGradeSaved = async (updatedSession: CandidateSession) => {
    const gradedQuestionId = gradingQuestion?.id;
    const attemptId = updatedSession.attemptId;
    const awarded = gradedQuestionId
      ? (updatedSession.essayFeedback?.[gradedQuestionId]?.score ??
        updatedSession.essayScore ??
        0)
      : (updatedSession.essayScore ?? 0);

    if (attemptId && gradedQuestionId) {
      const review = await manualGradeAttempt({
        attemptId,
        answers: [{ questionId: gradedQuestionId, marksAwarded: awarded }],
      }).unwrap();

      setCandidates((prev) =>
        prev.map((c) =>
          c.pin === review.candidatePin
            ? {
                ...c,
                gradingStatus: "GRADED",
                score: review.score,
                totalMarks: review.totalMarks,
              }
            : c,
        ),
      );
      refetchMonitor();
      return;
    }

    setCandidates((prev) =>
      prev.map((c) =>
        c.pin === updatedSession.candidatePin
          ? {
              ...c,
              gradingStatus: "GRADED",
              score: updatedSession.score,
              totalMarks: updatedSession.totalMarks,
            }
          : c,
      ),
    );
  };

  // Force submit candidate attempt — submits on the server with the answers saved so far
  const handleForceSubmit = async (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate?.attemptId) {
      toast.error("This candidate has not started the exam yet.");
      return;
    }
    try {
      await submitAttempt({
        attemptId: candidate.attemptId,
        autoSubmitted: true,
      }).unwrap();
      toast.success("Attempt submitted with the answers saved so far.");
      refetchMonitor();
    } catch (err: any) {
      toast.error(
        err?.data?.message || "Could not submit this attempt. Please try again.",
      );
    }
  };

  // Add 5 minutes grace
  const handleAddFiveMins = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? {
              ...c,
              timeRemainingMins: c.timeRemainingMins + 5,
              status: c.status === "locked" ? "active" : c.status,
            }
          : c,
      ),
    );
    toast.success("Added +5 minutes extension to candidate session.");
  };

  // Unlock disqualified attempt
  const handleUnlockCandidate = (candidateId: string) => {
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId ? { ...c, status: "active", violations: 2 } : c,
      ),
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
    if (filter === "review")
      return (
        matchesSearch &&
        (c.gradingStatus === "PENDING_REVIEW" || c.status === "submitted")
      );
    return matchesSearch;
  });

  const activeCount = candidates.filter((c) => c.status === "active").length;
  const registeredCount = candidates.filter(
    (c) => c.status === "registered",
  ).length;
  const flaggedCount = candidates.filter((c) => c.violations > 0).length;
  const lockedCount = candidates.filter((c) => c.status === "locked").length;
  const reviewCount = candidates.filter(
    (c) => c.gradingStatus === "PENDING_REVIEW" || c.status === "submitted",
  ).length;

  const pathname = usePathname();
  const isSchoolContext = pathname?.startsWith("/RMS");
  const backHref = isSchoolContext
    ? `/RMS/cbt/exams/${examId}`
    : `/cbt/exams/${examId}`;

  return (
    <div className="cbt-monitor min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      {/* ── HEADER (56px) ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[var(--border-fine)] px-2.5 sm:px-6 flex items-center justify-between shadow-xs gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--text-secondary)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-[var(--foreground)]">
              {monitorMeta.title}
            </span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex font-mono text-xs bg-[var(--violet-tint)] text-[var(--violet-ink)] uppercase"
            >
              Room: {monitorMeta.code || roomCode}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-[var(--emerald-tint)] text-[#065f46] font-mono text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border-0">
            <span
              className={`w-2 h-2 rounded-full ${monitorError ? "bg-amber-600" : "bg-[var(--emerald-signal)]"}`}
            />
            <span>
              {isLoadingMonitor
                ? "Updating"
                : monitorError
                  ? "Connection interrupted"
                  : "Updated every 5s"}
            </span>
          </Badge>
        </div>
      </header>

      {/* ── MAIN MONITOR BOARD ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="cbt-eyebrow">Examination / Invigilation</span>
            <h1 className="text-2xl font-bold">Candidate monitor</h1>
          </div>
          <button
            className="cbt-button"
            disabled={isLoadingMonitor}
            onClick={() => refetchMonitor()}
          >
            <RotateCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Metric Summary Ribbon */}
        <div className="cbt-monitor-metrics grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Active Candidates
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--foreground)] mt-1">
              {activeCount}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              {registeredCount} not started
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Submissions to review
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-blue-700 mt-1">
              {reviewCount}
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
        <div className="flex flex-col xl:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-3" />
            <Input
              type="text"
              placeholder="Search candidate name or PIN..."
              aria-label="Search candidates by name or PIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs border-[var(--border-fine)] rounded-[var(--radius-md)]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
            {(["all", "active", "review", "flagged", "locked"] as const).map(
              (tab) => (
                <button
                  key={tab}
                  aria-pressed={filter === tab}
                  onClick={() => setFilter(tab)}
                  className={`h-8 px-3 rounded-[var(--radius-md)] text-xs font-semibold capitalize transition-all shrink-0 ${
                    filter === tab
                      ? "bg-[var(--violet-ink)] text-white shadow-xs"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab === "review" ? `Submissions (${reviewCount})` : tab}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Live Candidate Table (Desktop) & Cards (Mobile) */}
        <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--surface-muted)] border-b border-[var(--border-fine)] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Candidate &amp; PIN</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Time Left</th>
                  <th className="py-3 px-4">Violations</th>
                  <th className="py-3 px-4">Grading Status</th>
                  <th className="py-3 px-4 text-right">Invigilator Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-fine)] text-xs font-medium">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="space-y-3 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-[var(--foreground)]">
                            No active candidates in hall
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Students sitting for this examination room will
                            appear here in real-time with their progress, timer,
                            and anti-cheat event stream.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((c) => {
                    const pct =
                      c.totalQuestions > 0
                        ? Math.round((c.answeredCount / c.totalQuestions) * 100)
                        : 0;

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-[var(--surface-subtle)] transition-colors"
                      >
                        {/* Name & PIN */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[var(--foreground)]">
                            {c.name}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-secondary)]">
                            PIN: {c.pin}
                          </div>
                        </td>

                        {/* Progress */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span>
                                {c.answeredCount}/{c.totalQuestions}
                              </span>
                              <span className="text-[var(--text-secondary)]">
                                {pct}%
                              </span>
                            </div>
                            <div className="w-28 bg-[var(--surface-muted)] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[var(--violet-ink)] h-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Time */}
                        <td className="py-3.5 px-4 font-mono">
                          {c.status === "registered" ? (
                            <span className="text-[var(--text-secondary)]">
                              Not started
                            </span>
                          ) : c.status === "submitted" ? (
                            <span className="text-[var(--text-secondary)]">
                              Submitted
                            </span>
                          ) : (
                            <span className="text-[var(--foreground)] font-semibold">
                              {c.timeRemainingMins}m remaining
                            </span>
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

                        {/* Status / Grading Status */}
                        <td className="py-3.5 px-4">
                          {c.gradingStatus === "PENDING_REVIEW" ? (
                            <Badge className="bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[10px]">
                              Essays Pending Review
                            </Badge>
                          ) : c.gradingStatus === "GRADED" ? (
                            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[10px]">
                              Graded: {c.score}/{c.totalMarks || 100}m
                            </Badge>
                          ) : c.status === "registered" ? (
                            <Badge className="bg-slate-100 text-slate-600 font-semibold text-[10px] border-0">
                              Registered
                            </Badge>
                          ) : c.status === "active" ? (
                            <Badge className="bg-[var(--emerald-tint)] text-[#065f46] font-semibold text-[10px] border-0">
                              Active
                            </Badge>
                          ) : c.status === "locked" ? (
                            <Badge className="bg-[var(--crimson-tint)] text-[#991b1b] font-semibold text-[10px] border-0">
                              Locked
                            </Badge>
                          ) : (
                            <Badge className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold text-[10px] border-0">
                              Submitted
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {c.status === "registered" ? (
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              Waiting for candidate
                            </span>
                          ) : c.status === "submitted" ||
                            c.gradingStatus === "PENDING_REVIEW" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEssayGrading(c)}
                              disabled={isFetchingReview || isSavingGrade}
                              className="h-7 text-[11px] border-violet-200 text-violet-700 bg-violet-50/60 hover:bg-violet-100 font-bold rounded-[var(--radius-md)] inline-flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3 text-violet-600" />
                              <span>
                                {c.gradingStatus === "GRADED"
                                  ? "Edit Grade"
                                  : "Grade Essays"}
                              </span>
                            </Button>
                          ) : c.status === "locked" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnlockCandidate(c.id)}
                              className="h-7 text-[11px] border-[var(--amber-signal)] text-[var(--amber-signal)] hover:bg-[var(--amber-tint)] font-semibold rounded-[var(--radius-md)]"
                            >
                              Forgive &amp; Unlock
                            </Button>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Candidate Card Feed (< md) */}
          <div className="md:hidden divide-y divide-[var(--border-fine)]">
            {filteredCandidates.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-[var(--foreground)]">
                  No active candidates in hall
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Students taking this exam will appear here in real-time.
                </p>
              </div>
            ) : (
              filteredCandidates.map((c) => {
                const pct =
                  c.totalQuestions > 0
                    ? Math.round((c.answeredCount / c.totalQuestions) * 100)
                    : 0;

                return (
                  <div key={c.id} className="p-4 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-[var(--foreground)]">
                          {c.name}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--text-secondary)]">
                          PIN: {c.pin}
                        </div>
                      </div>
                      <div>
                        {c.gradingStatus === "PENDING_REVIEW" ? (
                          <Badge className="bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[10px]">
                            Essays Pending
                          </Badge>
                        ) : c.gradingStatus === "GRADED" ? (
                          <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[10px]">
                            Graded
                          </Badge>
                        ) : c.status === "registered" ? (
                          <Badge className="bg-slate-100 text-slate-600 font-semibold text-[10px] border-0">
                            Registered
                          </Badge>
                        ) : c.status === "active" ? (
                          <Badge className="bg-[var(--emerald-tint)] text-[#065f46] font-semibold text-[10px] border-0">
                            Active
                          </Badge>
                        ) : c.status === "locked" ? (
                          <Badge className="bg-[var(--crimson-tint)] text-[#991b1b] font-semibold text-[10px] border-0">
                            Locked
                          </Badge>
                        ) : (
                          <Badge className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold text-[10px] border-0">
                            Finished
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Time */}
                    <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[var(--text-secondary)]">
                          Answered: {c.answeredCount}/{c.totalQuestions} ({pct}
                          %)
                        </span>
                        <span className="font-semibold text-slate-800">
                          {c.status === "registered"
                            ? "Not started"
                            : c.status === "submitted"
                              ? "Submitted"
                              : `${c.timeRemainingMins}m left`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[var(--violet-ink)] h-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Invigilator Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      {c.status === "registered" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="w-full h-8 text-xs border-slate-200 text-slate-500 rounded-lg"
                        >
                          Waiting for candidate
                        </Button>
                      ) : c.status === "submitted" ||
                        c.gradingStatus === "PENDING_REVIEW" ? (
                        <Button
                          size="sm"
                          onClick={() => handleOpenEssayGrading(c)}
                          disabled={isFetchingReview || isSavingGrade}
                          className="w-full h-8 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Grade Essays (AI Assist)</span>
                        </Button>
                      ) : c.status === "locked" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUnlockCandidate(c.id)}
                          className="w-full h-8 text-xs border-[var(--amber-signal)] text-[var(--amber-signal)] hover:bg-[var(--amber-tint)] font-semibold rounded-lg"
                        >
                          Forgive &amp; Unlock
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddFiveMins(c.id)}
                            className="flex-1 h-8 text-xs border-[var(--border-fine)] text-[var(--foreground)] rounded-lg"
                          >
                            +5 Mins
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleForceSubmit(c.id)}
                            className="flex-1 h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            Force Submit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ── EXAMINER ESSAY GRADING MODAL ─────────────────────────────────── */}
      {gradingSession && gradingQuestion && (
        <CbtEssayGradingModal
          isOpen={!!gradingSession}
          onClose={() => setGradingSession(null)}
          candidateSession={gradingSession}
          questionId={gradingQuestion.id}
          questionPrompt={gradingQuestion.prompt}
          questionType={gradingQuestion.type || "SHORT_ESSAY"}
          questionMarks={gradingQuestion.marks || 5}
          modelAnswer={gradingQuestion.modelAnswer}
          keyTerms={gradingQuestion.keyTerms}
          rubric={gradingQuestion.rubric}
          onGraded={handleManualGradeSaved}
        />
      )}
    </div>
  );
}
