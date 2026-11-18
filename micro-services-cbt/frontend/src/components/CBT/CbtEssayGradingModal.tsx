"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AlertCircle,
  BookOpen,
  Check,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import "./cbt-monitor.css";
import {
  RubricCriterion,
  ExamRubric,
  CandidateSession,
} from "@cbt/lib/cbtSessionManager";

interface CbtEssayGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateSession: CandidateSession;
  questionId: string;
  questionPrompt: string;
  questionType: "SHORT_ESSAY" | "LONG_ESSAY";
  questionMarks: number;
  modelAnswer?: string;
  keyTerms?: string[];
  rubric?: ExamRubric;
  onGraded: (updatedSession: CandidateSession) => void | Promise<void>;
  /** Render inside the page (the monitor's Essay marking tab) instead of as a dialog */
  inline?: boolean;
  /** Where the queue stands, e.g. "3 more after this one", shown beside Approve */
  queueNote?: string;
}

export default function CbtEssayGradingModal({
  isOpen,
  onClose,
  candidateSession,
  questionId,
  questionPrompt,
  questionType,
  questionMarks,
  modelAnswer,
  keyTerms,
  rubric,
  onGraded,
  inline = false,
  queueNote,
}: CbtEssayGradingModalProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const studentAnswer = (candidateSession.answers[questionId] as string) || "";
  const studentWordCount = studentAnswer.trim()
    ? studentAnswer.trim().split(/\s+/).length
    : 0;

  // Criteria list to evaluate
  const criteriaList: RubricCriterion[] = useMemo(() => {
    if (rubric && rubric.criteria && rubric.criteria.length > 0) {
      return rubric.criteria;
    }
    // Default criteria split the question's marks 50/30/20 in half marks and add up to them exactly
    const toHalf = (x: number) => Math.round(x * 2) / 2;
    const half = toHalf(questionMarks * 0.5);
    const third = Math.min(questionMarks - half, toHalf(questionMarks * 0.3));
    const remaining = questionMarks - half - third;

    return [
      {
        id: "c1",
        title: "Content Accuracy & Understanding",
        maxMarks: half,
        description: "Grasp of core principles and depth of relevant ideas.",
      },
      {
        id: "c2",
        title: "Structure, Coherence & Flow",
        maxMarks: third,
        description: "Logical progression, paragraphing, and clarity.",
      },
      {
        id: "c3",
        title: "Technical Diction & Mechanics",
        maxMarks: remaining,
        description: "Appropriate subject vocabulary, spelling, and grammar.",
      },
    ].filter((c) => c.maxMarks > 0);
  }, [rubric, questionMarks]);

  // Evaluated Scores State
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionFeedback, setCriterionFeedback] = useState<
    Record<string, string>
  >({});
  const [overallComment, setOverallComment] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<string[]>([]);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  // Initialize or load existing feedback
  useEffect(() => {
    const existing = candidateSession.essayFeedback?.[questionId];
    if (existing) {
      if (existing.rubricScores) {
        setScores(existing.rubricScores);
      } else {
        // Only the total was saved: spread it over the criteria so re-saving keeps it
        let left = Number(existing.score) || 0;
        const spread: Record<string, number> = {};
        criteriaList.forEach((c) => {
          spread[c.id] = Math.min(c.maxMarks, left);
          left -= spread[c.id];
        });
        setScores(spread);
      }
      setOverallComment(existing.comment || "");
    } else {
      // Default to 0
      const initialScores: Record<string, number> = {};
      criteriaList.forEach((c) => {
        initialScores[c.id] = 0;
      });
      setScores(initialScores);
    }
  }, [candidateSession, questionId, criteriaList]);

  // Current Total Awarded
  const currentTotalAwarded = useMemo(() => {
    return Object.values(scores).reduce(
      (sum, val) => sum + (Number(val) || 0),
      0,
    );
  }, [scores]);

  // 1-Click AI Grading Assistance
  const handleAiGrade = async () => {
    if (!studentAnswer.trim()) {
      toast.error("Candidate submitted an empty response. Awarding 0 marks.");
      const zeroScores: Record<string, number> = {};
      criteriaList.forEach((c) => (zeroScores[c.id] = 0));
      setScores(zeroScores);
      setOverallComment("No written answer was provided by the candidate.");
      return;
    }

    setIsAiGrading(true);
    try {
      const res = await fetch("/api/cbt/ai/grade-essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionPrompt,
          studentResponse: studentAnswer,
          modelAnswer,
          keyTerms,
          rubricCriteria: criteriaList,
          maxMarks: questionMarks,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to grade essay with ParaLearn AI.",
        );
      }

      const evalData = data.evaluation;
      const newScores: Record<string, number> = {};
      const newFeedback: Record<string, string> = {};

      if (Array.isArray(evalData.criteriaScores)) {
        evalData.criteriaScores.forEach((cs: any) => {
          newScores[cs.criterionId] = cs.score ?? 0;
          if (cs.feedback) newFeedback[cs.criterionId] = cs.feedback;
        });
      }

      setScores(newScores);
      setCriterionFeedback(newFeedback);
      setOverallComment(evalData.overallComment || "");
      setStrengths(evalData.strengths || []);
      setAreasForImprovement(evalData.areasForImprovement || []);

      toast.success(
        "Suggested marks are filled in. Check them before you approve.",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to score with AI.");
    } finally {
      setIsAiGrading(false);
    }
  };

  const handleScoreChange = (criterionId: string, val: number, max: number) => {
    const clamped = Math.min(Math.max(val, 0), max);
    setScores((prev) => ({ ...prev, [criterionId]: clamped }));
  };

  // Approve & Finalize
  const handleApproveAndSave = async () => {
    const updatedFeedback = {
      ...(candidateSession.essayFeedback || {}),
      [questionId]: {
        score: currentTotalAwarded,
        maxScore: questionMarks,
        comment: overallComment,
        rubricScores: scores,
      },
    };

    // Calculate total essay score across all graded essays
    const totalEssayScore = Object.values(updatedFeedback).reduce(
      (sum, item) => sum + (item.score || 0),
      0,
    );

    const mcqScore = candidateSession.mcqScore || 0;
    const finalScore = mcqScore + totalEssayScore;
    const totalMarks = candidateSession.totalMarks || questionMarks + 10;
    const percentage =
      totalMarks > 0 ? Math.round((finalScore / totalMarks) * 100) : 0;

    const updatedSession: CandidateSession = {
      ...candidateSession,
      essayScore: totalEssayScore,
      score: finalScore,
      percentage,
      essayFeedback: updatedFeedback,
      gradingStatus: "GRADED",
    };

    setIsSaving(true);
    try {
      await onGraded(updatedSession);
      toast.success(`Marks saved: ${currentTotalAwarded} / ${questionMarks}.`);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.data?.message ||
          err?.message ||
          "Could not save the grade to the CBT backend.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Inline: each script that opens takes focus, so marking continues from the keyboard
  useEffect(() => {
    if (inline) titleRef.current?.focus();
  }, [inline]);

  // Ctrl+Enter (or Cmd+Enter) approves from anywhere in the form
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isSaving) {
      e.preventDefault();
      handleApproveAndSave();
    }
  };

  const Title = inline ? "h2" : DialogTitle;
  const Description = inline ? "p" : DialogDescription;

  const header = (
    <div className="cbt-grade-head">
      <div className="cbt-grade-who">
        <Title
          className="cbt-grade-title"
          ref={titleRef}
          tabIndex={inline ? -1 : undefined}
        >
          {candidateSession.candidateName}
          <span className="cbt-grade-pin">
            PIN {candidateSession.candidatePin}
          </span>
        </Title>
        <Description className="cbt-grade-sub">
          {questionType === "LONG_ESSAY" ? "Essay" : "Short answer"} ·{" "}
          {questionMarks} marks. Mark against the rubric, or let ParaLearn AI
          suggest marks for you to check.
        </Description>
      </div>
      <button
        type="button"
        className="cbt-icon"
        onClick={onClose}
        aria-label={inline ? "Close this script" : "Close"}
        title={inline ? "Close this script" : "Close"}
      >
        <X size={17} />
      </button>
    </div>
  );

  const body = (
    <div className="cbt-grade-body">
      <section className="cbt-grade-question">
        <div className="cbt-grade-label">
          <span>Question</span>
          <span className="cbt-grade-marks">{questionMarks} marks</span>
        </div>
        <p className="cbt-grade-prompt">{questionPrompt}</p>
        {modelAnswer && (
          <>
            <button
              type="button"
              onClick={() => setShowModelAnswer(!showModelAnswer)}
              className="cbt-grade-link"
              aria-expanded={showModelAnswer}
            >
              <BookOpen size={14} aria-hidden />
              {showModelAnswer ? "Hide model answer" : "Show model answer"}
            </button>
            {showModelAnswer && (
              <p className="cbt-grade-model">{modelAnswer}</p>
            )}
          </>
        )}
      </section>

      <section>
        <div className="cbt-grade-label">
          <span>
            <FileText size={14} aria-hidden />
            Candidate&apos;s answer
          </span>
          <span className="cbt-grade-num">
            {studentWordCount} words · {studentAnswer.length} characters
          </span>
        </div>
        <div className="cbt-grade-answer">
          {studentAnswer || <em>No answer submitted.</em>}
        </div>
      </section>

      <section className="cbt-grade-ai">
        <div>
          <strong>
            <Sparkles size={15} aria-hidden />
            Suggest marks with ParaLearn AI
          </strong>
          <p>
            Reads the answer against the rubric and fills in marks and comments.
            Nothing is saved until you approve.
          </p>
        </div>
        <button
          type="button"
          className="cbt-button"
          disabled={isAiGrading}
          onClick={handleAiGrade}
        >
          {isAiGrading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {isAiGrading ? "Reading the answer…" : "Suggest marks"}
        </button>
      </section>

      <section>
        <div className="cbt-grade-label">
          <span>Rubric ({criteriaList.length})</span>
          <span className="cbt-grade-num">
            Awarded <b>{currentTotalAwarded}</b> / {questionMarks}
          </span>
        </div>
        <ul className="cbt-grade-criteria">
          {criteriaList.map((crit) => {
            const currentScore = scores[crit.id] ?? 0;
            const feedbackText = criterionFeedback[crit.id] || "";
            const inputId = `crit-${questionId}-${crit.id}`;
            return (
              <li key={crit.id}>
                <div className="cbt-grade-crit-row">
                  <label htmlFor={inputId}>
                    <strong>{crit.title}</strong>
                    {crit.description && <small>{crit.description}</small>}
                  </label>
                  <span className="cbt-grade-score">
                    <input
                      id={inputId}
                      type="number"
                      min="0"
                      max={crit.maxMarks}
                      step="0.5"
                      value={currentScore}
                      onChange={(e) =>
                        handleScoreChange(
                          crit.id,
                          parseFloat(e.target.value) || 0,
                          crit.maxMarks,
                        )
                      }
                    />
                    <span>/ {crit.maxMarks}</span>
                  </span>
                </div>
                {feedbackText && (
                  <p className="cbt-grade-note">
                    <Sparkles size={13} aria-hidden />
                    {feedbackText}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <label className="cbt-grade-label" htmlFor={`comment-${questionId}`}>
          <span>
            <MessageSquare size={14} aria-hidden />
            Comment for the candidate
          </span>
          <span className="cbt-grade-num">Shown on their result slip</span>
        </label>
        <Textarea
          id={`comment-${questionId}`}
          rows={3}
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
          placeholder="What they did well, and one thing to work on."
          className="cbt-grade-comment"
        />
      </section>

      {(strengths.length > 0 || areasForImprovement.length > 0) && (
        <div className="cbt-grade-notes">
          {strengths.length > 0 && (
            <div className="emerald">
              <strong>
                <ThumbsUp size={14} aria-hidden />
                Strengths
              </strong>
              <ul>
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {areasForImprovement.length > 0 && (
            <div className="amber">
              <strong>
                <AlertCircle size={14} aria-hidden />
                To improve
              </strong>
              <ul>
                {areasForImprovement.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="cbt-grade-foot">
      <button type="button" className="cbt-button" onClick={onClose}>
        {inline ? "Close" : "Cancel"}
      </button>
      {queueNote && <span className="cbt-grade-queue">{queueNote}</span>}
      <div className="cbt-grade-total">
        <span>Total</span>
        <strong>
          {currentTotalAwarded} <small>/ {questionMarks}</small>
        </strong>
      </div>
      <button
        type="button"
        className="cbt-button cbt-grade-approve"
        onClick={handleApproveAndSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Check size={16} />
        )}
        {isSaving ? "Saving…" : "Approve marks"}
        {!isSaving && (
          <kbd className="cbt-grade-kbd" aria-hidden>
            Ctrl ↵
          </kbd>
        )}
      </button>
    </div>
  );

  if (inline) {
    return (
      <section
        className="cbt-grade cbt-grade-inline"
        aria-label={`Marking ${candidateSession.candidateName}`}
        onKeyDown={onKeyDown}
      >
        {header}
        {body}
        {footer}
      </section>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="cbt-dialog cbt-grade cbt-grade-dialog max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
        onKeyDown={onKeyDown}
      >
        {header}
        {body}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
