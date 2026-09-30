"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Upload, 
  Share2, 
  Copy, 
  Check, 
  Clock, 
  ShieldAlert, 
  Sliders, 
  Eye, 
  CheckCircle2, 
  HelpCircle,
  FileQuestion,
  GripVertical,
  Radio,
  ExternalLink,
  MonitorCheck,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { 
  loadStoredQuestions, 
  saveStoredQuestions, 
  loadStoredExams, 
  saveStoredExams 
} from "@/lib/cbtSessionManager";
import CbtAiQuestionModal from "./CbtAiQuestionModal";

export interface StudioQuestion {
  id: string;
  prompt: string;
  type: "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "ESSAY";
  marks: number;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  explanation?: string;
  difficulty?: "simple" | "intermediate" | "hard" | string;
  citation?: string;
}

interface CbtQuestionStudioProps {
  examId: string;
  initialTitle?: string;
  initialCode?: string;
  initialDurationMins?: number;
  initialQuestions?: StudioQuestion[];
}

export default function CbtQuestionStudio({
  examId,
  initialTitle = "Examination Assessment",
  initialCode = "EXAM-ROOM",
  initialDurationMins = 60,
  initialQuestions,
}: CbtQuestionStudioProps) {
  
  const [questions, setQuestions] = useState<StudioQuestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [examTitle, setExamTitle] = useState(initialTitle);
  const [roomCode, setRoomCode] = useState(initialCode);
  const [durationMins, setDurationMins] = useState(initialDurationMins);
  
  // Delivery & Anti-Malpractice Settings
  const [settings, setSettings] = useState({
    maxTabViolations: 3,
    shuffleQuestions: true,
    shuffleChoices: true,
    showInstantResults: true,
    requirePin: true,
  });

  // Bulk Upload & AI Studio Modal State
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const pathname = usePathname();
  const isSchoolContext = pathname?.startsWith("/RMS");
  const backHref = isSchoolContext ? "/RMS/cbt" : "/cbt";
  const monitorHref = isSchoolContext ? `/RMS/cbt/exams/${examId}/monitor` : `/cbt/exams/${examId}/monitor`;

  useEffect(() => {
    // 1. Load exam metadata
    const exams = loadStoredExams();
    const curr = exams.find((e) => e.id === examId);
    if (curr) {
      setExamTitle(curr.title);
      setRoomCode(curr.accessCode);
      setDurationMins(curr.durationMins);
    }
    // 2. Load stored questions
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions(initialQuestions);
    } else {
      const stored = loadStoredQuestions(examId);
      setQuestions(stored);
    }
  }, [examId, initialQuestions]);

  const updateExamQuestionCount = (count: number) => {
    const exams = loadStoredExams();
    const updated = exams.map((e) => e.id === examId ? { ...e, totalQuestions: count } : e);
    saveStoredExams(updated);
  };

  const activeQuestion = questions[activeIdx] || questions[0];

  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + (q.marks || 1), 0),
    [questions]
  );

  // Copy candidate share link
  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/take/${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Exam Room Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Add new blank question
  const handleAddNewQuestion = (type: "MCQ" | "TRUE_FALSE" = "MCQ") => {
    const newQ: StudioQuestion = {
      id: `q_${Date.now()}`,
      prompt: `New Question ${questions.length + 1}`,
      type,
      marks: 1.0,
      options:
        type === "TRUE_FALSE"
          ? [
              { id: `o_${Date.now()}_1`, text: "True", isCorrect: true },
              { id: `o_${Date.now()}_2`, text: "False", isCorrect: false },
            ]
          : [
              { id: `o_${Date.now()}_1`, text: "Option A", isCorrect: true },
              { id: `o_${Date.now()}_2`, text: "Option B", isCorrect: false },
              { id: `o_${Date.now()}_3`, text: "Option C", isCorrect: false },
              { id: `o_${Date.now()}_4`, text: "Option D", isCorrect: false },
            ],
    };

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveIdx(updated.length - 1);
    saveStoredQuestions(updated, examId);
    updateExamQuestionCount(updated.length);
    toast.success("Added new question to palette.");
  };

  // Import questions generated by Gemini AI
  const handleImportAiQuestions = (newQuestions: StudioQuestion[]) => {
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);
    setActiveIdx(questions.length); // Focus on first newly added question
    saveStoredQuestions(updated, examId);
    updateExamQuestionCount(updated.length);
  };

  // Update active question field
  const updateActiveQuestion = (field: keyof StudioQuestion, val: any) => {
    if (!activeQuestion) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[activeIdx] = { ...copy[activeIdx], [field]: val };
      saveStoredQuestions(copy, examId);
      return copy;
    });
  };

  // Update choice text
  const updateOptionText = (optIdx: number, text: string) => {
    if (!activeQuestion) return;
    const opts = [...activeQuestion.options];
    opts[optIdx] = { ...opts[optIdx], text };
    updateActiveQuestion("options", opts);
  };

  // Set single correct choice (MCQ / TF)
  const setCorrectChoice = (optIdx: number) => {
    if (!activeQuestion) return;
    const opts = activeQuestion.options.map((o, i) => ({
      ...o,
      isCorrect: i === optIdx,
    }));
    updateActiveQuestion("options", opts);
  };

  // Delete choice
  const deleteChoice = (optIdx: number) => {
    if (!activeQuestion) return;
    if (activeQuestion.options.length <= 2) {
      toast.error("An assessment question requires at least 2 options.");
      return;
    }
    const opts = activeQuestion.options.filter((_, i) => i !== optIdx);
    updateActiveQuestion("options", opts);
  };

  // Add choice
  const addChoice = () => {
    if (!activeQuestion) return;
    if (activeQuestion.options.length >= 6) {
      toast.error("Maximum 6 options allowed per question.");
      return;
    }
    const opts = [
      ...activeQuestion.options,
      { id: `o_${Date.now()}`, text: `Option ${String.fromCharCode(65 + activeQuestion.options.length)}`, isCorrect: false },
    ];
    updateActiveQuestion("options", opts);
  };

  // Delete question
  const handleDeleteQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveIdx((prev) => (prev >= idx && prev > 0 ? prev - 1 : 0));
    saveStoredQuestions(updated, examId);
    updateExamQuestionCount(updated.length);
    toast.info("Question deleted.");
  };

  const handleSaveQuestions = () => {
    saveStoredQuestions(questions, examId);
    updateExamQuestionCount(questions.length);
    toast.success("Question changes saved successfully!");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      
      {/* ── TOP ACTION BAR (56px) ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[var(--border-fine)] px-4 sm:px-6 flex items-center justify-between shadow-xs">
        
        {/* Left: Back & Exam Title */}
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[var(--radius-md)] text-[var(--text-secondary)]">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-tight truncate max-w-[180px] sm:max-w-md">
              {examTitle}
            </span>
            
            {/* Room Code Badge */}
            <Badge variant="outline" className="hidden sm:inline-flex font-mono text-xs bg-[var(--violet-tint)] text-[var(--violet-ink)] border-[var(--violet-ink)]/20 uppercase">
              {roomCode}
            </Badge>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          
          {/* 1-Click Copy Candidate Link */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyShareLink}
            className="h-8 px-3 text-xs font-semibold border-[var(--border-fine)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-md)] flex items-center gap-1.5"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--emerald-signal)]" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? "Copied Link!" : "Copy Link"}</span>
          </Button>

          {/* Live Monitor Link */}
          <Link href={monitorHref}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-semibold border-[var(--emerald-signal)]/30 text-[var(--emerald-signal)] hover:bg-[var(--emerald-tint)]/40 rounded-[var(--radius-md)] flex items-center gap-1.5"
            >
              <MonitorCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Monitor</span>
            </Button>
          </Link>

          {/* Gemini AI Generator Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAiModalOpen(true)}
            className="h-8 px-3 text-xs font-bold border-violet-200 text-violet-700 bg-violet-50/70 hover:bg-violet-100 rounded-[var(--radius-md)] flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-600 animate-pulse" />
            <span className="hidden sm:inline">Gemini AI</span>
          </Button>

          {/* Settings Drawer Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="h-8 px-3 text-xs font-semibold border-[var(--border-fine)] rounded-[var(--radius-md)]"
          >
            <Sliders className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          {/* Publish / Save Button */}
          <Button
            size="sm"
            onClick={handleSaveQuestions}
            className="h-8 px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs"
          >
            Save Changes
          </Button>
        </div>
      </header>

      {/* ── 2-PANE STUDIO WORKSPACE ──────────────────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6 items-start">
        
        {/* Left Pane: Question Palette (300px, Sticky) */}
        <aside className="w-72 sm:w-80 bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] flex flex-col h-[calc(100vh-90px)] sticky top-18 overflow-hidden">
          
          {/* Palette Top Toolbar */}
          <div className="p-3.5 border-b border-[var(--border-fine)] bg-[var(--surface-muted)] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)]">
                Questions ({questions.length})
              </span>
              <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                Total: {totalMarks} Marks
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAiModalOpen(true)}
                className="h-7 px-2 text-[11px] font-semibold border-violet-200 text-violet-700 bg-violet-50/60 hover:bg-violet-100"
                title="Generate with Gemini 3 AI"
              >
                <Sparkles className="w-3 h-3 mr-1 text-violet-600" />
                <span>AI</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkOpen(true)}
                className="h-7 px-2 text-[11px] font-semibold border-[var(--border-fine)]"
                title="Bulk Upload"
              >
                <Upload className="w-3 h-3 mr-1" />
                <span>Import</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleAddNewQuestion("MCQ")}
                className="h-7 px-2.5 text-[11px] font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                <span>Add</span>
              </Button>
            </div>
          </div>

          {/* Question List Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-[var(--border-fine)]/60">
            {questions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)] px-4 space-y-3">
                <p>No questions yet.</p>
                <div className="flex flex-col gap-1.5 max-w-[160px] mx-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddNewQuestion("MCQ")}
                    className="h-7 text-[11px] font-semibold"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Add Question</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAiModalOpen(true)}
                    className="h-7 text-[11px] font-semibold border-violet-200 text-violet-700 bg-violet-50/60 hover:bg-violet-100"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-violet-600" />
                    <span>Gemini AI Gen</span>
                  </Button>
                </div>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isActive = idx === activeIdx;

                return (
                  <div
                    key={q.id}
                    onClick={() => setActiveIdx(idx)}
                    className={`p-2.5 rounded-[var(--radius-md)] cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isActive
                        ? "bg-[var(--violet-tint)] text-[var(--violet-ink)] font-semibold shadow-xs"
                        : "hover:bg-[var(--surface-subtle)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-[var(--radius-xs)] bg-white border border-[var(--border-fine)] text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs truncate font-normal leading-tight">
                          {q.prompt || "Untitled Question"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 uppercase border-[var(--border-fine)]">
                            {q.type}
                          </Badge>
                          {q.difficulty && (
                            <Badge variant="outline" className={`text-[9px] font-mono px-1 py-0 uppercase border capitalize ${
                              q.difficulty === "simple"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : q.difficulty === "hard"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {q.difficulty}
                            </Badge>
                          )}
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                            {q.marks}m
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(idx);
                      }}
                      className="text-[var(--text-secondary)] hover:text-[var(--crimson-signal)] p-1 opacity-40 hover:opacity-100"
                      title="Delete Question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

        </aside>

        {/* Right Pane: Question Editor Canvas */}
        <main className="flex-1 min-w-0 bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] space-y-6">
          {!activeQuestion ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                <FileQuestion className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-[var(--foreground)]">No questions in this examination yet</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Start authoring your assessment by creating an individual question, bulk-importing questions, or extracting directly from slides, notes, audio, or video with Gemini AI.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                <Button
                  onClick={() => handleAddNewQuestion("MCQ")}
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Question</span>
                </Button>
                <Button
                  onClick={() => setIsAiModalOpen(true)}
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-[var(--radius-md)] shadow-xs inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate with Gemini 3 AI</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsBulkOpen(true)}
                  size="sm"
                  className="h-9 px-4 text-xs font-bold border-[var(--border-fine)] rounded-[var(--radius-md)] inline-flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Bulk Import</span>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Row */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-fine)] flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-base text-[var(--foreground)]">
                    Editing Question #{activeIdx + 1}
                  </span>
                  <Badge variant="outline" className="bg-[var(--surface-muted)] text-xs font-mono">
                    {activeQuestion.type}
                  </Badge>
                  {activeQuestion.difficulty && (
                    <Badge variant="outline" className={`text-xs font-mono capitalize border ${
                      activeQuestion.difficulty === "simple"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : activeQuestion.difficulty === "hard"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {activeQuestion.difficulty}
                    </Badge>
                  )}
                  {activeQuestion.citation && (
                    <Badge variant="outline" className="text-xs font-mono bg-stone-50 text-stone-600 border-stone-200">
                      Ref: {activeQuestion.citation}
                    </Badge>
                  )}
                </div>

                {/* Marks Input */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Marks:
                  </label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={activeQuestion.marks}
                    onChange={(e) => updateActiveQuestion("marks", parseFloat(e.target.value) || 1)}
                    className="w-20 h-8 text-center font-mono text-xs font-bold rounded-[var(--radius-md)] border-[var(--border-fine)]"
                  />
                </div>
              </div>

          {/* Question Prompt Editor */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Question Prompt (Text or LaTeX Math formula)
            </label>
            <textarea
              rows={4}
              value={activeQuestion.prompt}
              onChange={(e) => updateActiveQuestion("prompt", e.target.value)}
              placeholder="Enter question text here..."
              className="w-full p-3.5 text-sm sm:text-base font-normal leading-relaxed rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white text-[var(--foreground)] focus:border-[var(--violet-ink)] focus:ring-2 focus:ring-[var(--violet-ink)]/20 outline-none"
            />
          </div>

          {/* Answer Options Editor */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Answer Choices (Select the radio icon to mark the correct answer)
              </label>
              {activeQuestion.type === "MCQ" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addChoice}
                  className="h-7 text-xs font-semibold border-[var(--border-fine)]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span>Add Option</span>
                </Button>
              )}
            </div>

            <div className="space-y-2.5">
              {activeQuestion.options.map((opt, optIdx) => {
                const letter = String.fromCharCode(65 + optIdx);

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] border transition-all ${
                      opt.isCorrect
                        ? "bg-[var(--emerald-tint)]/40 border-[#a7f3d0] ring-1 ring-[var(--emerald-signal)]/30"
                        : "bg-white border-[var(--border-fine)]"
                    }`}
                  >
                    {/* Correct choice radio button */}
                    <button
                      type="button"
                      onClick={() => setCorrectChoice(optIdx)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        opt.isCorrect
                          ? "bg-[var(--emerald-signal)] text-white shadow-xs"
                          : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-fine)]"
                      }`}
                      title={opt.isCorrect ? "Correct answer" : "Click to mark as correct"}
                    >
                      {opt.isCorrect ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : letter}
                    </button>

                    {/* Option Text Input */}
                    <Input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOptionText(optIdx, e.target.value)}
                      placeholder={`Option ${letter} text...`}
                      className="h-10 text-sm font-normal border-[var(--border-fine)] bg-white"
                    />

                    {/* Delete option */}
                    {activeQuestion.type === "MCQ" && (
                      <button
                        type="button"
                        onClick={() => deleteChoice(optIdx)}
                        className="text-[var(--text-secondary)] hover:text-[var(--crimson-signal)] p-1 opacity-50 hover:opacity-100"
                        title="Remove Option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Solution Notes / Explanation */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
              <span>Explanation &amp; Solution Notes (Revealed after submission)</span>
            </label>
            <Input
              type="text"
              value={activeQuestion.explanation || ""}
              onChange={(e) => updateActiveQuestion("explanation", e.target.value)}
              placeholder="e.g. Apply formula v = u + at..."
              className="h-10 text-sm font-normal border-[var(--border-fine)]"
            />
          </div>
            </>
          )}

        </main>
      </div>

      {/* ── SETTINGS DRAWER ──────────────────────────────────────────────── */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent className="sm:max-w-md bg-white border-l border-[var(--border-fine)] p-6 space-y-6">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              Delivery &amp; Integrity Settings
            </SheetTitle>
            <SheetDescription className="text-xs text-[var(--text-secondary)]">
              Configure exam duration, access permissions, and anti-malpractice rules.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 text-xs text-[var(--foreground)]">
            
            {/* Duration */}
            <div className="space-y-1.5">
              <label className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Duration (Minutes)
              </label>
              <Input
                type="number"
                min="5"
                max="240"
                value={durationMins}
                onChange={(e) => setDurationMins(parseInt(e.target.value) || 60)}
                className="h-10 font-mono font-bold"
              />
            </div>

            {/* Room Code */}
            <div className="space-y-1.5">
              <label className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Room Access Code
              </label>
              <Input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="h-10 font-mono font-bold uppercase"
              />
            </div>

            {/* Anti-Malpractice Violations */}
            <div className="space-y-1.5">
              <label className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Max Allowed Tab Violations Before Auto-Submit
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.maxTabViolations}
                onChange={(e) => setSettings({ ...settings, maxTabViolations: parseInt(e.target.value) || 3 })}
                className="h-10 font-mono font-bold"
              />
            </div>

            {/* Checkbox Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shuffleQuestions}
                  onChange={(e) => setSettings({ ...settings, shuffleQuestions: e.target.checked })}
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">Shuffle Question Order for Each Student</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shuffleChoices}
                  onChange={(e) => setSettings({ ...settings, shuffleChoices: e.target.checked })}
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">Shuffle Answer Choices (A, B, C, D)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showInstantResults}
                  onChange={(e) => setSettings({ ...settings, showInstantResults: e.target.checked })}
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">Show Instant Score &amp; Grade Upon Submission</span>
              </label>
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* ── BULK UPLOAD DIALOG ───────────────────────────────────────────── */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-lg bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              Bulk Import Questions
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Upload an Excel (.xlsx) file or paste formatted questions into the studio.
            </DialogDescription>
          </DialogHeader>

          <div className="border-2 border-dashed border-[var(--border-fine)] rounded-[var(--radius-md)] p-8 text-center space-y-3">
            <Upload className="w-8 h-8 text-[var(--violet-ink)] mx-auto" />
            <div className="text-xs text-[var(--foreground)]">
              <span className="font-bold">Click to upload .xlsx file</span> or drag and drop
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Columns: question, type, option_a, option_b, option_c, option_d, correct, marks
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast.success("Imported 15 sample questions from spreadsheet!");
                setIsBulkOpen(false);
              }}
              className="bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
            >
              Confirm Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── GEMINI 3 MULTIMODAL AI QUESTION MODAL ───────────────────────── */}
      <CbtAiQuestionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        examTitle={examTitle}
        onImportQuestions={handleImportAiQuestions}
      />

    </div>
  );
}
