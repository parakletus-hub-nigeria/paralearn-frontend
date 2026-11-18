"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Lock,
  MonitorPlay,
  PencilRuler,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Ticket,
  Unlock,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import {
  getExaminerSession,
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
  useExtendAttemptMutation,
  useReinstateAttemptMutation,
} from "@cbt/store/cbtMicroserviceApi";

import CbtReportCardPanel from "./CbtReportCardPanel";
import CbtAnswerSheetDialog from "./CbtAnswerSheetDialog";
import "./cbt-monitor.css";

export interface CandidateLiveStatus {
  id: string;
  name: string;
  pin: string;
  /** Registration or student number, when the roster has one */
  studentId?: string;
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
  /** Submitted offline and received after the deadline */
  syncedLate?: boolean;
}

interface CbtLiveMonitorProps {
  examId: string;
  examTitle?: string;
  roomCode?: string;
}

export default function CbtLiveMonitor({
  examId,
  examTitle = "Candidate monitor",
  roomCode = "",
}: CbtLiveMonitorProps) {
  const [candidates, setCandidates] = useState<CandidateLiveStatus[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "flagged" | "locked" | "active" | "review"
  >("all");
  const [isSchoolWorkspace, setIsSchoolWorkspace] = useState(false);
  useEffect(() => {
    setIsSchoolWorkspace(getExaminerSession()?.type === "INSTITUTION");
  }, []);
  const [monitorMeta, setMonitorMeta] = useState({
    title: examTitle,
    code: roomCode,
  });

  // Selected candidate and question for essay grading modal
  const [gradingSession, setGradingSession] = useState<CandidateSession | null>(
    null,
  );
  const [gradingQuestion, setGradingQuestion] = useState<any | null>(null);
  // Live hall or essay marking; marking shows the grading form in the page, not over the hall
  const [view, setView] = useState<"hall" | "marking">("hall");
  const [markingId, setMarkingId] = useState<string | null>(null);
  // The next essay to open once the grading window closes (exams with several essays)
  const nextGradingRef = useRef<{ session: any; question: any } | null>(null);
  // Set when marks are approved, so closing the form opens the next candidate in the queue
  const advanceRef = useRef(false);
  // The queue as it was when the form was last drawn (state updates from a save land a render later)
  const pendingRef = useRef<CandidateLiveStatus[]>([]);
  const [sort, setSort] = useState<"attention" | "name" | "progress">(
    "attention",
  );
  // While the examiner's pointer or focus is on the list, rows keep their place between updates
  const [holdOrder, setHoldOrder] = useState(false);
  // Phones: while a script is open the queue folds away so the essay comes first
  const [queueOpen, setQueueOpen] = useState(false);
  const orderRef = useRef<string[]>([]);

  // Load questions to detect essay questions
  const [questions, setQuestions] = useState<any[]>([]);
  const {
    data: monitorData,
    fulfilledTimeStamp: monitorUpdatedAt,
    isFetching: isLoadingMonitor,
    isLoading: isFirstLoad,
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
  const [extendAttempt] = useExtendAttemptMutation();
  const [reinstateAttempt] = useReinstateAttemptMutation();
  const [answerSheet, setAnswerSheet] = useState<AttemptReviewPayload | null>(
    null,
  );
  const examNotFound = (monitorError as any)?.status === 404;

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
      studentId: participant.studentId || participant.regNo || undefined,
      answeredCount: participant.answeredCount ?? 0,
      totalQuestions: participant.totalQuestions ?? totalQuestions,
      timeRemainingMins:
        isFinished || !deadline
          ? 0
          : Math.max(0, Math.ceil((deadline - Date.now()) / 60000)),
      violations: participant.violations ?? 0,
      syncedLate: Boolean(participant.syncedLate),
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
            comment: question.feedback || undefined,
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
          essays.find(
            (q) => q.marksAwarded === undefined || q.marksAwarded === null,
          ) || essays[0];
        if (!essayQ) {
          // Nothing to mark by hand: show the marked answer sheet
          setAnswerSheet(review);
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
    // Once these marks save, the grading panel moves on to the next script by itself
    advanceRef.current = true;
    const gradedQuestionId = gradingQuestion?.id;
    const attemptId = updatedSession.attemptId;
    const awarded = gradedQuestionId
      ? (updatedSession.essayFeedback?.[gradedQuestionId]?.score ??
        updatedSession.essayScore ??
        0)
      : (updatedSession.essayScore ?? 0);

    if (attemptId && gradedQuestionId) {
      let review: Awaited<ReturnType<ReturnType<typeof manualGradeAttempt>["unwrap"]>>;
      try {
        review = await manualGradeAttempt({
          attemptId,
          answers: [
            {
              questionId: gradedQuestionId,
              marksAwarded: awarded,
              feedback:
                updatedSession.essayFeedback?.[gradedQuestionId]?.comment || "",
            },
          ],
        }).unwrap();
      } catch (err) {
        // Not saved: closing the panel now should just close it, not move on to the next script
        advanceRef.current = false;
        throw err;
      }

      // The attempt is only graded once every essay has marks
      const essays = review.questions.filter((q) => q.type === "ESSAY");
      const remaining = essays.filter(
        (q) => q.marksAwarded === undefined || q.marksAwarded === null,
      );
      const status =
        review.gradingStatus ||
        (remaining.length ? "PENDING_REVIEW" : "GRADED");
      setCandidates((prev) =>
        prev.map((c) =>
          c.pin === review.candidatePin
            ? {
                ...c,
                gradingStatus: status,
                score: review.score,
                totalMarks: review.totalMarks,
              }
            : c,
        ),
      );
      if (remaining.length > 0) {
        nextGradingRef.current = {
          session: buildSessionFromReview(review),
          question: { ...remaining[0], type: "LONG_ESSAY" },
        };
        toast.info(
          `${review.candidateName}: essay ${essays.length - remaining.length + 1} of ${essays.length} next.`,
        );
      }
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
    if (
      !confirm(
        `Submit ${candidate.name}'s exam now with the answers saved so far?`,
      )
    )
      return;
    try {
      await submitAttempt({
        attemptId: candidate.attemptId,
        autoSubmitted: true,
      }).unwrap();
      toast.success("Attempt submitted with the answers saved so far.");
      refetchMonitor();
    } catch (err: any) {
      toast.error(
        err?.data?.message ||
          "Could not submit this attempt. Please try again.",
      );
    }
  };

  // Give a writing candidate 5 more minutes; their device picks it up within 20s
  const handleAddFiveMins = async (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate?.attemptId) return;
    try {
      await extendAttempt({
        attemptId: candidate.attemptId,
        minutes: 5,
      }).unwrap();
      toast.success(`Gave ${candidate.name} 5 more minutes.`);
      refetchMonitor();
    } catch (err: any) {
      toast.error(
        err?.data?.message || "Couldn't add time for this candidate.",
      );
    }
  };

  // Reopen an attempt locked for tab switching; the candidate rejoins from the lobby
  const handleUnlockCandidate = async (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate?.attemptId) return;
    if (
      !confirm(
        `Let ${candidate.name} continue? Their tab-switch count resets and their answers are kept.`,
      )
    )
      return;
    try {
      await reinstateAttempt(candidate.attemptId).unwrap();
      toast.success(
        `${candidate.name} can continue. Ask them to rejoin from the exam lobby with their name and PIN ${candidate.pin}.`,
        { duration: 8000 },
      );
      refetchMonitor();
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't reopen this attempt.");
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.pin.includes(search) ||
      (c.studentId || "").toLowerCase().includes(search.toLowerCase());

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

  /** Lower is more urgent: the order an invigilator should look at the hall in */
  const urgency = (c: CandidateLiveStatus) => {
    if (c.status === "locked") return 0;
    if (c.status === "active" && c.timeRemainingMins <= 1) return 1;
    if (c.status === "active" && c.violations > 0) return 2;
    if (c.status === "active" && c.timeRemainingMins <= 5) return 3;
    if (c.status === "active") return 4;
    if (c.gradingStatus === "PENDING_REVIEW") return 5;
    if (c.status === "registered") return 6;
    return 7;
  };

  const pctOf = (c: CandidateLiveStatus) =>
    c.totalQuestions > 0
      ? Math.round((c.answeredCount / c.totalQuestions) * 100)
      : 0;

  const bySort = [...filteredCandidates].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "progress")
      return pctOf(a) - pctOf(b) || a.name.localeCompare(b.name);
    return (
      urgency(a) - urgency(b) ||
      (a.status === "active" ? a.timeRemainingMins - b.timeRemainingMins : 0) ||
      a.name.localeCompare(b.name)
    );
  });
  // Rows don't jump under the pointer: while held, keep the last order and add newcomers at the end
  let visibleCandidates = bySort;
  if (holdOrder && orderRef.current.length) {
    const place = new Map(orderRef.current.map((id, i) => [id, i]));
    visibleCandidates = [...filteredCandidates].sort(
      (a, b) =>
        (place.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (place.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  } else {
    orderRef.current = bySort.map((c) => c.id);
  }
  const orderDiffers =
    holdOrder && visibleCandidates.some((c, i) => bySort[i]?.id !== c.id);

  const holdHandlers = {
    onPointerEnter: () => setHoldOrder(true),
    onPointerLeave: () => setHoldOrder(false),
    onFocus: () => setHoldOrder(true),
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null))
        setHoldOrder(false);
    },
  };

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
  const listHref = isSchoolContext ? "/RMS/cbt" : "/cbt";
  const backHref = isSchoolContext
    ? `/RMS/cbt/exams/${examId}`
    : `/cbt/exams/${examId}`;
  const candidatesHref = `/cbt/candidates?examId=${encodeURIComponent(examId)}`;

  const submittedCount = candidates.filter(
    (c) => c.status === "submitted",
  ).length;
  const essaysPending = candidates.filter(
    (c) => c.gradingStatus === "PENDING_REVIEW",
  );
  pendingRef.current = essaysPending;
  const markedCandidates = candidates.filter(
    (c) => c.gradingStatus === "GRADED" || c.gradingStatus === "AUTO_SCORED",
  );
  const total = candidates.length;
  const share = (n: number, of: number) =>
    of > 0 ? Math.round((n / of) * 100) : 0;
  const roomCodeShown = monitorMeta.code || roomCode;
  const hasData = Boolean(monitorData) || candidates.length > 0;

  const updatedAt = monitorUpdatedAt
    ? new Date(monitorUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  // From the hall: open the marking tab on this candidate
  const startMarking = (candidate: CandidateLiveStatus) => {
    setView("marking");
    setMarkingId(candidate.id);
    handleOpenEssayGrading(candidate);
  };

  const openMarkingTab = () => {
    setView("marking");
    // Nothing open yet: start on the first script waiting for marks
    if (!gradingSession && !isFetchingReview && essaysPending[0]) {
      setMarkingId(essaysPending[0].id);
      handleOpenEssayGrading(essaysPending[0]);
    }
  };

  const closeGrading = () => {
    const next = nextGradingRef.current;
    const advance = advanceRef.current;
    nextGradingRef.current = null;
    advanceRef.current = false;
    if (next) {
      setGradingSession(next.session);
      setGradingQuestion(next.question);
      return;
    }
    // Marks were just approved: go straight to the next candidate waiting
    const following = advance
      ? pendingRef.current.find((c) => c.id !== markingId)
      : undefined;
    setGradingSession(null);
    if (following) {
      setMarkingId(following.id);
      handleOpenEssayGrading(following);
    } else {
      setMarkingId(null);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCodeShown);
      toast.success(`Room code ${roomCodeShown} copied.`);
    } catch {
      toast.error("Couldn't copy. Select the code and copy it instead.");
    }
  };

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "C";

  const tone = (c: CandidateLiveStatus) =>
    c.status === "locked"
      ? "crimson"
      : c.status === "active" && c.timeRemainingMins <= 1
        ? "crimson"
        : c.violations > 0 && c.status === "active"
          ? "amber"
          : c.status === "submitted"
            ? "emerald"
            : c.status === "registered"
              ? "muted"
              : "violet";

  const rowClass = (c: CandidateLiveStatus) =>
    c.status === "locked"
      ? "is-locked"
      : urgency(c) === 1
        ? "is-urgent"
        : undefined;

  const timeCell = (c: CandidateLiveStatus) => {
    if (c.status === "registered")
      return <span className="cbt-mon-quiet">Not started</span>;
    if (c.status === "locked")
      return (
        <span className="cbt-mon-time is-crimson">
          <Lock size={13} aria-hidden />
          Locked
        </span>
      );
    if (c.status === "submitted") {
      if (c.gradingStatus === "PENDING_REVIEW")
        return <span className="cbt-mon-chip amber">Essays to mark</span>;
      if (c.score !== undefined)
        return (
          <span className="cbt-mon-time">
            <CheckCircle2 size={13} aria-hidden className="cbt-mon-ok" />
            {c.score}/{c.totalMarks || 100}
          </span>
        );
      return <span className="cbt-mon-quiet">Submitted</span>;
    }
    const mins = c.timeRemainingMins;
    const level = mins <= 1 ? "is-crimson" : mins <= 5 ? "is-amber" : "";
    return (
      <span className={`cbt-mon-time ${level}`}>
        <Clock size={13} aria-hidden />
        {mins <= 0 ? "Time up" : `${mins}m left`}
      </span>
    );
  };

  // Only exceptions get colour; a clean record stays quiet so the problems stand out
  const integrityCell = (c: CandidateLiveStatus) => (
    <div className="cbt-mon-integrity">
      {c.violations === 0 ? (
        <span className="cbt-mon-quiet">None</span>
      ) : (
        <span
          className={`cbt-mon-chip ${c.status === "locked" ? "crimson" : "amber"}`}
        >
          <ShieldAlert size={13} aria-hidden />
          {c.violations} tab {c.violations === 1 ? "switch" : "switches"}
        </span>
      )}
      {c.syncedLate && (
        <span
          className="cbt-mon-chip cobalt"
          title="Submitted while offline and received after the deadline. Check the submission time before accepting."
        >
          Synced late
        </span>
      )}
    </div>
  );

  const actionsCell = (c: CandidateLiveStatus) => {
    if (c.status === "registered")
      return <span className="cbt-mon-quiet">Waiting to start</span>;
    if (c.status === "submitted" || c.gradingStatus === "PENDING_REVIEW") {
      const pending = c.gradingStatus === "PENDING_REVIEW";
      const graded = c.gradingStatus === "GRADED";
      return (
        <button
          className={`cbt-button ${pending ? "primary" : ""}`}
          onClick={() => startMarking(c)}
          disabled={isFetchingReview || isSavingGrade}
        >
          {pending || graded ? <PenLine size={15} /> : <Eye size={15} />}
          {pending ? "Mark essays" : graded ? "Edit marks" : "View answers"}
        </button>
      );
    }
    if (c.status === "locked")
      return (
        <button
          className="cbt-button cbt-mon-warn"
          onClick={() => handleUnlockCandidate(c.id)}
        >
          <Unlock size={15} />
          Unlock
        </button>
      );
    return (
      <>
        <button
          className="cbt-button"
          onClick={() => handleAddFiveMins(c.id)}
          aria-label={`Give ${c.name} 5 more minutes`}
        >
          <Plus size={15} />5 mins
        </button>
        <button
          className="cbt-button cbt-mon-danger"
          onClick={() => handleForceSubmit(c.id)}
          aria-label={`Submit ${c.name}'s exam now`}
        >
          <Send size={15} />
          Submit now
        </button>
      </>
    );
  };

  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  const emptyHall = (() => {
    if (!hasData && isFirstLoad)
      return (
        <div
          className="cbt-mon-skeleton"
          aria-busy="true"
          aria-label="Loading the hall"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      );
    if (candidates.length === 0 && monitorError)
      return (
        <div className="cbt-mon-empty">
          <WifiOff size={24} aria-hidden />
          <h2>Can&apos;t load the hall</h2>
          <p>
            The monitor couldn&apos;t reach the server. Check this
            computer&apos;s connection; it tries again every 5 seconds.
            Candidates keep writing either way.
          </p>
          <button className="cbt-button" onClick={() => refetchMonitor()}>
            <RotateCcw size={15} />
            Try again now
          </button>
        </div>
      );
    if (candidates.length === 0)
      return (
        <div className="cbt-mon-empty">
          <Users size={24} aria-hidden />
          <h2>No one has joined yet</h2>
          <p>
            Candidates appear here the moment they enter the room code
            {roomCodeShown ? (
              <>
                {" "}
                <strong className="cbt-mon-code">{roomCodeShown}</strong>
              </>
            ) : null}{" "}
            at the candidate entrance, with their progress, time left and tab
            switches.
          </p>
          <div className="cbt-mon-empty-actions">
            {roomCodeShown && (
              <button className="cbt-button" onClick={copyRoomCode}>
                <Copy size={15} />
                Copy room code
              </button>
            )}
            {!isSchoolContext && (
              <Link className="cbt-button" href={candidatesHref}>
                <Ticket size={15} />
                Issue PINs
              </Link>
            )}
            <Link className="cbt-button" href="/take" target="_blank">
              Candidate entrance
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      );
    return (
      <div className="cbt-mon-empty">
        <Search size={24} aria-hidden />
        <h2>No candidates match</h2>
        <p>Nobody in this hall fits that search and filter.</p>
        <button className="cbt-button" onClick={clearFilters}>
          Clear search and filter
        </button>
      </div>
    );
  })();

  const filters = [
    { id: "all", label: "All", count: total },
    { id: "active", label: "Writing", count: activeCount },
    { id: "flagged", label: "Flagged", count: flaggedCount },
    { id: "review", label: "Submitted", count: reviewCount },
    { id: "locked", label: "Locked", count: lockedCount },
  ] as const;

  const liveText = monitorError
    ? updatedAt
      ? `Can't reach the server. Showing the hall as of ${updatedAt}; retrying every 5 seconds.`
      : "Can't reach the server. Retrying every 5 seconds."
    : !monitorData && isFirstLoad
      ? "Loading the hall…"
      : updatedAt
        ? `Live. Updates every 5 seconds, last at ${updatedAt}`
        : "Live. Updates every 5 seconds";

  const marked = markedCandidates.length;
  const toMarkTotal = essaysPending.length + marked;

  return (
    <div className="cbt-mon">
      <div className="cbt-mon-head">
        <div className="cbt-mon-heading">
          <Link href={listHref} className="cbt-mon-back">
            <ArrowLeft size={15} aria-hidden />
            Examinations
          </Link>
          <div className="cbt-mon-titleline">
            <h1>{monitorMeta.title}</h1>
            {roomCodeShown && (
              <button
                type="button"
                className="cbt-mon-code"
                onClick={copyRoomCode}
                title="Copy room code"
                aria-label={`Room code ${roomCodeShown}. Copy`}
              >
                Room {roomCodeShown}
                <Copy size={12} aria-hidden />
              </button>
            )}
          </div>
          <p
            className={`cbt-mon-live ${monitorError ? "is-down" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span className="cbt-mon-dot" aria-hidden />
            {liveText}
          </p>
        </div>
        <div className="cbt-mon-actions">
          <Link href={backHref} className="cbt-button">
            <PencilRuler size={15} />
            Edit questions
          </Link>
          <a
            className="cbt-button"
            href={`/api/cbt/sync/export-csv/${encodeURIComponent(examId)}`}
            download
          >
            <Download size={15} />
            Download CSV
          </a>
          <button
            className="cbt-button"
            disabled={isLoadingMonitor}
            onClick={() => refetchMonitor()}
            aria-label="Refresh now"
            title="Refresh now"
          >
            <RotateCcw
              size={15}
              className={isLoadingMonitor ? "animate-spin" : undefined}
            />
          </button>
        </div>
      </div>

      <div className="cbt-mon-tabs" role="tablist" aria-label="Monitor views">
        <button
          role="tab"
          id="cbt-mon-tab-hall"
          aria-selected={view === "hall"}
          aria-controls="cbt-mon-panel"
          onClick={() => setView("hall")}
        >
          <MonitorPlay size={16} aria-hidden />
          Live hall
          <span className="cbt-mon-count">
            {activeCount}
            <span className="cbt-mon-count-word"> writing</span>
          </span>
        </button>
        <button
          role="tab"
          id="cbt-mon-tab-marking"
          aria-selected={view === "marking"}
          aria-controls="cbt-mon-panel"
          onClick={openMarkingTab}
        >
          <ClipboardCheck size={16} aria-hidden />
          Essay marking
          <span
            className={`cbt-mon-count ${essaysPending.length ? "is-amber" : ""}`}
          >
            {essaysPending.length}
            <span className="cbt-mon-count-word"> to mark</span>
          </span>
        </button>
      </div>

      {examNotFound && (
        <div className="cbt-notice" role="alert">
          This exam wasn't found in your workspace. It may have been deleted, or
          you're signed in to a different workspace.
        </div>
      )}

      <div
        id="cbt-mon-panel"
        role="tabpanel"
        aria-labelledby={
          view === "hall" ? "cbt-mon-tab-hall" : "cbt-mon-tab-marking"
        }
      >
        {view === "hall" ? (
          <>
            {total > 0 && (
              <dl className="cbt-mon-summary" aria-label="Hall summary">
                <div>
                  <dt>Writing now</dt>
                  <dd>{activeCount}</dd>
                  <small>
                    {registeredCount
                      ? `${registeredCount} not started`
                      : "Everyone has started"}
                  </small>
                </div>
                <div className={flaggedCount ? "is-amber" : undefined}>
                  <dt>Flagged</dt>
                  <dd>{flaggedCount}</dd>
                  <small className={lockedCount ? "is-crimson" : undefined}>
                    {lockedCount ? `${lockedCount} locked` : "None locked"}
                  </small>
                </div>
                <div className={essaysPending.length ? "is-violet" : undefined}>
                  <dt>Essays to mark</dt>
                  <dd>{essaysPending.length}</dd>
                  <small>{marked} marked</small>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>
                    {submittedCount}
                    <span> / {total}</span>
                  </dd>
                  <span
                    className="cbt-mon-meter emerald"
                    role="img"
                    aria-label={`${share(submittedCount, total)}% of candidates submitted`}
                  >
                    <i style={{ width: `${share(submittedCount, total)}%` }} />
                  </span>
                </div>
              </dl>
            )}

            <div className="cbt-mon-board">
              {total > 0 && (
                <div className="cbt-mon-toolbar">
                  <label className="cbt-mon-search">
                    <Search size={16} aria-hidden />
                    <input
                      type="search"
                      placeholder="Search name, PIN or reg no"
                      aria-label="Search candidates by name, PIN or registration number"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div
                    className="cbt-mon-filters"
                    role="group"
                    aria-label="Filter candidates"
                  >
                    {filters.map((f) => (
                      <button
                        key={f.id}
                        aria-pressed={filter === f.id}
                        onClick={() => setFilter(f.id)}
                      >
                        {f.label}
                        <span>{f.count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="cbt-mon-sort">
                    <span>Order</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                    >
                      <option value="attention">Needs attention first</option>
                      <option value="name">Name</option>
                      <option value="progress">Least progress first</option>
                    </select>
                  </label>
                </div>
              )}

              {visibleCandidates.length === 0 ? (
                emptyHall
              ) : (
                <div className="cbt-mon-list" {...holdHandlers}>
                  <table className="cbt-mon-table">
                    <thead>
                      <tr>
                        <th scope="col">Candidate</th>
                        <th scope="col">Progress</th>
                        <th scope="col">Status</th>
                        <th scope="col">Tab switches</th>
                        <th scope="col" className="is-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCandidates.map((c) => {
                        const pct = pctOf(c);
                        return (
                          <tr key={c.id} className={rowClass(c)}>
                            <td>
                              <div className="cbt-mon-person">
                                <span
                                  className={`cbt-mon-avatar ${tone(c)}`}
                                  aria-hidden
                                >
                                  {initials(c.name)}
                                </span>
                                <div>
                                  <strong>{c.name}</strong>
                                  <small>
                                    <span>PIN {c.pin || "none"}</span>
                                    {c.studentId && <span>{c.studentId}</span>}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="cbt-mon-progress">
                                <span>
                                  {c.answeredCount}/{c.totalQuestions}
                                  <em>{pct}%</em>
                                </span>
                                <span
                                  className={`cbt-mon-meter ${tone(c)}`}
                                  aria-hidden
                                >
                                  <i style={{ width: `${pct}%` }} />
                                </span>
                              </div>
                            </td>
                            <td>{timeCell(c)}</td>
                            <td>{integrityCell(c)}</td>
                            <td>
                              <div className="cbt-mon-row-actions">
                                {actionsCell(c)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <ul className="cbt-mon-cards">
                    {visibleCandidates.map((c) => {
                      const pct = pctOf(c);
                      return (
                        <li key={c.id} className={rowClass(c)}>
                          <div className="cbt-mon-person">
                            <span
                              className={`cbt-mon-avatar ${tone(c)}`}
                              aria-hidden
                            >
                              {initials(c.name)}
                            </span>
                            <div>
                              <strong>{c.name}</strong>
                              <small>
                                <span>PIN {c.pin || "none"}</span>
                                {c.studentId && <span>{c.studentId}</span>}
                              </small>
                            </div>
                            <div className="cbt-mon-card-time">
                              {timeCell(c)}
                            </div>
                          </div>
                          {c.status !== "registered" && (
                            <div className="cbt-mon-progress">
                              <span>
                                {c.answeredCount}/{c.totalQuestions} answered
                                <em>{pct}%</em>
                              </span>
                              <span
                                className={`cbt-mon-meter ${tone(c)}`}
                                aria-hidden
                              >
                                <i style={{ width: `${pct}%` }} />
                              </span>
                            </div>
                          )}
                          {(c.violations > 0 || c.syncedLate) &&
                            integrityCell(c)}
                          <div className="cbt-mon-row-actions">
                            {actionsCell(c)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {total > 0 && (
                <p className="cbt-mon-foot">
                  <span>
                    Showing {visibleCandidates.length} of {total} candidates
                  </span>
                  {orderDiffers && (
                    <span className="cbt-mon-held">
                      Order paused while you work on the list
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Report cards: school workspaces only */}
            {isSchoolWorkspace && <CbtReportCardPanel examId={examId} />}
          </>
        ) : (
          <div className="cbt-mon-marking">
            <aside
              className={`cbt-mon-queue ${gradingSession && !queueOpen ? "is-folded" : ""}`}
              aria-label="Candidates to mark"
            >
              {toMarkTotal > 0 && (
                <div className="cbt-mon-queue-progress">
                  <span>
                    <strong>{marked}</strong> of {toMarkTotal} marked
                    {gradingSession && (
                      <button
                        type="button"
                        className="cbt-mon-queue-toggle"
                        aria-expanded={queueOpen}
                        onClick={() => setQueueOpen((v) => !v)}
                      >
                        {queueOpen ? "Hide list" : "Show list"}
                      </button>
                    )}
                  </span>
                  <span
                    className="cbt-mon-meter emerald"
                    role="img"
                    aria-label={`${share(marked, toMarkTotal)}% marked`}
                  >
                    <i style={{ width: `${share(marked, toMarkTotal)}%` }} />
                  </span>
                </div>
              )}
              <h2>
                To mark <span>{essaysPending.length}</span>
              </h2>
              {essaysPending.length === 0 ? (
                <p className="cbt-mon-quiet">
                  {marked > 0
                    ? "Every script is marked."
                    : "No essays waiting. Submitted scripts with essay answers show up here."}
                </p>
              ) : (
                <ul>
                  {essaysPending.map((c) => (
                    <li key={c.id}>
                      <button
                        aria-current={markingId === c.id ? "true" : undefined}
                        disabled={isFetchingReview}
                        onClick={() => {
                          setMarkingId(c.id);
                          handleOpenEssayGrading(c);
                        }}
                      >
                        <span className="cbt-mon-avatar amber" aria-hidden>
                          {initials(c.name)}
                        </span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>PIN {c.pin}</small>
                        </span>
                        <PenLine size={15} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {markedCandidates.length > 0 && (
                <>
                  <h2>
                    Marked <span>{markedCandidates.length}</span>
                  </h2>
                  <ul>
                    {markedCandidates.map((c) => (
                      <li key={c.id}>
                        <button
                          aria-current={markingId === c.id ? "true" : undefined}
                          disabled={isFetchingReview}
                          onClick={() => {
                            setMarkingId(c.id);
                            handleOpenEssayGrading(c);
                          }}
                        >
                          <span className="cbt-mon-avatar emerald" aria-hidden>
                            {initials(c.name)}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {c.score !== undefined
                                ? `${c.score}/${c.totalMarks || 100}`
                                : `PIN ${c.pin}`}
                            </small>
                          </span>
                          <Eye size={15} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>

            <div className="cbt-mon-grader">
              {gradingSession && gradingQuestion ? (
                <CbtEssayGradingModal
                  // A fresh form for each essay
                  key={`${gradingSession.attemptId}:${gradingQuestion.id}`}
                  inline
                  isOpen
                  onClose={closeGrading}
                  candidateSession={gradingSession}
                  questionId={gradingQuestion.id}
                  questionPrompt={gradingQuestion.prompt}
                  questionType={gradingQuestion.type || "SHORT_ESSAY"}
                  questionMarks={gradingQuestion.marks || 5}
                  modelAnswer={gradingQuestion.modelAnswer}
                  keyTerms={gradingQuestion.keyTerms}
                  rubric={gradingQuestion.rubric}
                  onGraded={handleManualGradeSaved}
                  queueNote={
                    essaysPending.length > 1
                      ? `${essaysPending.length - 1} more after this one`
                      : undefined
                  }
                />
              ) : isFetchingReview ? (
                <div className="cbt-mon-empty" aria-busy="true">
                  <RotateCcw size={24} className="animate-spin" aria-hidden />
                  <h2>Opening the script…</h2>
                </div>
              ) : essaysPending.length === 0 && marked > 0 ? (
                <div className="cbt-mon-empty">
                  <CheckCircle2 size={24} aria-hidden className="cbt-mon-ok" />
                  <h2>All essays are marked</h2>
                  <p>
                    Scores are final on each candidate&apos;s result slip. Open
                    a name under Marked to change marks.
                  </p>
                </div>
              ) : (
                <div className="cbt-mon-empty">
                  <FileText size={24} aria-hidden />
                  <h2>
                    {essaysPending.length
                      ? "Choose a candidate to mark"
                      : "Nothing to mark yet"}
                  </h2>
                  <p>
                    {essaysPending.length
                      ? "Their essay answer opens here with the marking rubric. ParaLearn AI can suggest marks; you approve the final score."
                      : "Essay answers arrive here as candidates submit. Objective questions are marked automatically."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CbtAnswerSheetDialog
        review={answerSheet}
        onClose={() => setAnswerSheet(null)}
      />
    </div>
  );
}
