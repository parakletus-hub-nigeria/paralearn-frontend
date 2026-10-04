"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Award,
  Check,
  X,
  Loader2,
  BookOpen,
  Edit3,
  MessageSquare,
  ThumbsUp,
  AlertCircle,
  HelpCircle,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RubricCriterion,
  ExamRubric,
  CandidateSession,
  saveCandidateSession
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
}: CbtEssayGradingModalProps) {
  const studentAnswer = (candidateSession.answers[questionId] as string) || "";
  const studentWordCount = studentAnswer.trim() ? studentAnswer.trim().split(/\s+/).length : 0;

  // Criteria list to evaluate
  const criteriaList: RubricCriterion[] = useMemo(() => {
    if (rubric && rubric.criteria && rubric.criteria.length > 0) {
      return rubric.criteria;
    }
    // Default 3 criteria
    const half = Math.ceil(questionMarks * 0.5);
    const third = Math.floor(questionMarks * 0.3);
    const remaining = Math.max(1, questionMarks - half - third);

    return [
      { id: "c1", title: "Content Accuracy & Understanding", maxMarks: half, description: "Grasp of core principles and depth of relevant ideas." },
      { id: "c2", title: "Structure, Coherence & Flow", maxMarks: third, description: "Logical progression, paragraphing, and clarity." },
      { id: "c3", title: "Technical Diction & Mechanics", maxMarks: remaining, description: "Appropriate subject vocabulary, spelling, and grammar." },
    ];
  }, [rubric, questionMarks]);

  // Evaluated Scores State
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionFeedback, setCriterionFeedback] = useState<Record<string, string>>({});
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
    return Object.values(scores).reduce((sum, val) => sum + (Number(val) || 0), 0);
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
        throw new Error(data.error || "Failed to grade essay with ParaLearn AI.");
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

      toast.success("ParaLearn AI suggested scores & feedback generated! Review and adjust before approval.");
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
      0
    );

    const mcqScore = candidateSession.mcqScore || 0;
    const finalScore = mcqScore + totalEssayScore;
    const totalMarks = candidateSession.totalMarks || (questionMarks + 10);
    const percentage = totalMarks > 0 ? Math.round((finalScore / totalMarks) * 100) : 0;

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
      saveCandidateSession(updatedSession);
      await onGraded(updatedSession);
      toast.success(`Essay grade approved: ${currentTotalAwarded} / ${questionMarks} Marks!`);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Could not save the grade to the CBT backend.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/70 flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                <Award className="w-4 h-4 text-amber-600" />
              </span>
              <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                Examiner Essay Evaluation &amp; Grading
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono bg-white text-slate-700">
                {candidateSession.candidateName} &bull; PIN: {candidateSession.candidatePin}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Score candidate response against marking rubrics, with 1-click ParaLearn AI grading assistance.
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Question Prompt Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Question Prompt ({questionType === "LONG_ESSAY" ? "Comprehensive Essay" : "Short Answer"})
              </span>
              <Badge variant="outline" className="font-mono text-xs font-bold text-violet-700 bg-violet-50 border-violet-200">
                Total: {questionMarks} Marks
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              {questionPrompt}
            </p>

            {/* Model Answer Toggle */}
            {modelAnswer && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowModelAnswer(!showModelAnswer)}
                  className="text-xs font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{showModelAnswer ? "Hide Benchmark Model Answer" : "View Benchmark Model Answer"}</span>
                </button>
                {showModelAnswer && (
                  <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <strong>Model Answer: </strong>
                    {modelAnswer}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Student Response Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Candidate's Submitted Response</span>
              </label>
              <span className="text-xs font-mono text-slate-500 font-semibold">
                {studentWordCount} words &bull; {studentAnswer.length} chars
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white min-h-[120px] text-sm text-slate-900 leading-relaxed whitespace-pre-wrap select-text font-normal shadow-2xs">
              {studentAnswer || <span className="text-slate-400 italic">No response submitted by candidate.</span>}
            </div>
          </div>

          {/* 1-Click AI Assist Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900">
                <Sparkles className="w-4 h-4 text-violet-600 animate-pulse" />
                <span>1-Click ParaLearn AI Grading Assistance</span>
              </div>
              <p className="text-[11px] text-violet-700 leading-tight">
                Analyzes student's text against the rubric, autofilling criteria scores and constructive feedback comments.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={isAiGrading}
              onClick={handleAiGrade}
              className="bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold px-3.5 h-9 rounded-xl shadow-xs shrink-0 flex items-center gap-1.5"
            >
              {isAiGrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Response...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Score with ParaLearn AI</span>
                </>
              )}
            </Button>
          </div>

          {/* Rubric Criteria Scoring List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Marking Rubric Criteria ({criteriaList.length} Items)
              </label>
              <div className="text-xs font-mono font-bold">
                Awarded: <span className="text-emerald-700">{currentTotalAwarded}</span> / {questionMarks} Marks
              </div>
            </div>

            <div className="space-y-3">
              {criteriaList.map((crit) => {
                const currentScore = scores[crit.id] ?? 0;
                const feedbackText = criterionFeedback[crit.id] || "";

                return (
                  <div key={crit.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{crit.title}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">{crit.description}</p>
                      </div>

                      {/* Score Input */}
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-semibold text-slate-500">Score:</label>
                        <Input
                          type="number"
                          min="0"
                          max={crit.maxMarks}
                          step="0.5"
                          value={currentScore}
                          onChange={(e) => handleScoreChange(crit.id, parseFloat(e.target.value) || 0, crit.maxMarks)}
                          className="w-16 h-8 text-center font-mono font-bold text-xs"
                        />
                        <span className="text-xs font-mono text-slate-500">/ {crit.maxMarks}m</span>
                      </div>
                    </div>

                    {/* Criterion Feedback */}
                    {feedbackText && (
                      <p className="text-[11px] text-violet-700 bg-violet-50/70 p-2 rounded-lg border border-violet-100">
                        <strong>AI Observation: </strong>{feedbackText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Constructive Feedback */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
              <span>Examiner Constructive Commentary (Shared with candidate on Result Slip)</span>
            </label>
            <Textarea
              rows={3}
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Provide constructive feedback highlighting student strengths and concrete recommendations for improvement..."
              className="text-xs leading-relaxed rounded-xl border-slate-200"
            />
          </div>

          {/* Strengths & Improvements tags if available */}
          {(strengths.length > 0 || areasForImprovement.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {strengths.length > 0 && (
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1">
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Key Strengths</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-emerald-700 space-y-0.5">
                    {strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {areasForImprovement.length > 0 && (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1">
                  <span className="font-bold text-amber-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Areas for Improvement</span>
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-amber-700 space-y-0.5">
                    {areasForImprovement.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold text-slate-600"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Awarded</span>
              <span className="text-sm font-mono font-bold text-slate-900">
                {currentTotalAwarded} / {questionMarks} Marks
              </span>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleApproveAndSave}
              disabled={isSaving}
              className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
              <span>{isSaving ? "Saving Grade..." : "Approve & Finalize Grade"}</span>
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
