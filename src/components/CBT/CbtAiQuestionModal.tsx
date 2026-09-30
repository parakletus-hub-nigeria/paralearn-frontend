"use client";

import React, { useState, useRef } from "react";
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Music, 
  Video, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Layers, 
  ChevronRight, 
  CheckCircle2, 
  HelpCircle, 
  BookOpen, 
  BrainCircuit, 
  FileUp, 
  RotateCcw,
  Award,
  AlignLeft,
  Radio
} from "lucide-react";
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
import { toast } from "sonner";
import { StudioQuestion } from "./CbtQuestionStudio";

interface CbtAiQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  examTitle: string;
  onImportQuestions: (questions: StudioQuestion[]) => void;
}

export type DifficultyLevel = "simple" | "intermediate" | "hard" | "balanced";
export type AssessmentFormatMode = "hybrid" | "pure_mcq" | "pure_essay";

export default function CbtAiQuestionModal({
  isOpen,
  onClose,
  examTitle,
  onImportQuestions,
}: CbtAiQuestionModalProps) {
  // Mode: "setup" (configure upload/prompt) | "generating" | "review" (inspect generated questions)
  const [step, setStep] = useState<"setup" | "generating" | "review">("setup");
  const [sourceType, setSourceType] = useState<"file" | "text">("file");

  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notesText, setNotesText] = useState("");
  const [subject, setSubject] = useState(examTitle || "");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("balanced");
  const [formatMode, setFormatMode] = useState<AssessmentFormatMode>("hybrid");
  const [questionCount, setQuestionCount] = useState<number>(10);
  
  // Generation feedback
  const [loadingMessage, setLoadingMessage] = useState("Extracting content and context with ParaLearn AI...");
  const [generatedQuestions, setGeneratedQuestions] = useState<StudioQuestion[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Difficulty descriptions
  const difficultyProfiles = [
    {
      id: "simple",
      title: "Simple",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Direct factual recall, core definitions, and foundational laws.",
      dotColor: "bg-emerald-500",
    },
    {
      id: "intermediate",
      title: "Intermediate",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Concept application, scenario problems, and cause-effect reasoning.",
      dotColor: "bg-amber-500",
    },
    {
      id: "hard",
      title: "Hard",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      description: "Deep synthesis, multi-step critical thinking, and nuanced edge cases.",
      dotColor: "bg-rose-500",
    },
    {
      id: "balanced",
      title: "Balanced Mix",
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
      description: "Progressive psychometric curve: 35% Simple, 45% Intermediate, 20% Hard.",
      dotColor: "bg-violet-500",
    },
  ];

  // Assessment Format descriptions
  const formatOptions = [
    {
      id: "hybrid",
      title: "Hybrid Assessment (Recommended)",
      icon: <Layers className="w-4 h-4 text-violet-600" />,
      description: "Blend of MCQs (~70%), Short Answers (~20%), and Long Essays (~10%) with automated rubrics.",
    },
    {
      id: "pure_mcq",
      title: "Pure Multiple Choice (MCQ)",
      icon: <Radio className="w-4 h-4 text-emerald-600" />,
      description: "100% Objective questions with single correct choice and psychometric distractors.",
    },
    {
      id: "pure_essay",
      title: "Pure Theory & Essays",
      icon: <FileText className="w-4 h-4 text-blue-600" />,
      description: "Short conceptual definitions and extended analytical essays with benchmark rubrics.",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 40 * 1024 * 1024) {
        toast.error("File is too large. Please select a file under 40MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 40 * 1024 * 1024) {
        toast.error("File is too large. Maximum size is 40MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const getFileIcon = (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".m4a") || name.endsWith(".ogg")) {
      return <Music className="w-8 h-8 text-indigo-500" />;
    }
    if (name.endsWith(".mp4") || name.endsWith(".webm") || name.endsWith(".mov")) {
      return <Video className="w-8 h-8 text-rose-500" />;
    }
    if (name.endsWith(".pptx") || name.endsWith(".ppt")) {
      return <FileSpreadsheet className="w-8 h-8 text-amber-500" />;
    }
    return <FileText className="w-8 h-8 text-violet-500" />;
  };

  const handleGenerate = async () => {
    if (sourceType === "file" && !selectedFile) {
      toast.error("Please choose a file (notes, slides, audio, or video) to extract from.");
      return;
    }
    if (sourceType === "text" && !notesText.trim()) {
      toast.error("Please paste or type notes to generate questions from.");
      return;
    }

    setStep("generating");
    setLoadingMessage("Parsing document / media context with ParaLearn AI...");

    const timer1 = setTimeout(() => {
      setLoadingMessage("Ingesting concepts, calibrating rubrics & taxonomy...");
    }, 2500);

    const timer2 = setTimeout(() => {
      setLoadingMessage("Synthesizing questions, model answers & scoring criteria...");
    }, 5500);

    try {
      const formData = new FormData();
      if (sourceType === "file" && selectedFile) {
        formData.append("file", selectedFile);
      }
      if (sourceType === "text" || notesText.trim()) {
        formData.append("notes", notesText);
      }
      formData.append("subject", subject || examTitle || "Assessment");
      formData.append("difficulty", difficulty);
      formData.append("formatMode", formatMode);
      formData.append("count", questionCount.toString());

      const res = await fetch("/api/cbt/ai/generate-questions", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate questions.");
      }

      const questionsList: StudioQuestion[] = (data.questions || []).map((q: any) => ({
        id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        prompt: q.prompt,
        type: q.type || "MCQ",
        section: q.section,
        marks: q.marks || (q.type === "LONG_ESSAY" ? 15 : q.type === "SHORT_ESSAY" ? 5 : 1.0),
        options: q.options || [],
        explanation: q.explanation || "",
        difficulty: q.difficulty || difficulty,
        citation: q.citation || "",
        minWords: q.minWords,
        maxWords: q.maxWords,
        modelAnswer: q.modelAnswer,
        keyTerms: q.keyTerms,
        rubric: q.rubric,
      }));

      if (questionsList.length === 0) {
        throw new Error("No questions were generated. Please try again with more detailed content.");
      }

      setGeneratedQuestions(questionsList);
      // Select all by default
      setSelectedQuestionIds(new Set(questionsList.map((q) => q.id)));
      setStep("review");
      toast.success(`Generated ${questionsList.length} questions successfully with ParaLearn AI!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred during AI generation.");
      setStep("setup");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
    }
  };

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedQuestionIds(new Set(generatedQuestions.map((q) => q.id)));
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds(new Set());
  };

  const handleImport = () => {
    const chosen = generatedQuestions.filter((q) => selectedQuestionIds.has(q.id));
    if (chosen.length === 0) {
      toast.error("Please select at least one question to import.");
      return;
    }

    onImportQuestions(chosen);
    toast.success(`Imported ${chosen.length} questions into your exam palette!`);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setStep("setup");
    setSelectedFile(null);
    setNotesText("");
    setGeneratedQuestions([]);
    setSelectedQuestionIds(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-white border border-stone-200 rounded-2xl p-0 overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <DialogHeader className="p-6 border-b border-stone-100 bg-stone-50/50 flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </span>
              <DialogTitle className="text-base font-bold text-stone-900 tracking-tight">
                Author Assessment with ParaLearn AI
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono border-violet-200 text-violet-700 bg-violet-50">
                Multimodal &bull; Hybrid Assessment
              </Badge>
            </div>
            <DialogDescription className="text-xs text-stone-500">
              Extract context from slides, notes, audio, or video and author MCQs, Short Essays, and Long Essays with automated rubrics.
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "generating" ? (
            <div className="py-20 text-center space-y-4 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto border border-violet-200 shadow-inner">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-stone-900">
                  ParaLearn AI Assessment Engine
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {loadingMessage}
                </p>
              </div>
            </div>
          ) : step === "setup" ? (
            <div className="space-y-6">
              
              {/* 1. Source Type Segmented Control */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  1. Select Source Material Format
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSourceType("file")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      sourceType === "file"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <FileUp className="w-4 h-4 text-violet-600" />
                    <span>Upload Document, Slides, Audio or Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType("text")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      sourceType === "text"
                        ? "bg-white text-stone-900 shadow-xs"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Paste Text Notes or Lecture Transcript</span>
                  </button>
                </div>
              </div>

              {/* 2. File Upload / Text Area */}
              {sourceType === "file" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    2. Upload Lecture Material
                  </label>
                  {!selectedFile ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-200 hover:border-violet-400 bg-stone-50/50 hover:bg-violet-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.txt,.docx,.md,.pptx,.ppt,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov"
                        onChange={handleFileChange}
                      />
                      <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-stone-800">
                        Click to upload or drag &amp; drop lecture file
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1 max-w-sm mx-auto">
                        Supports Documents (PDF, Word, TXT), Slides (PPTX), Audio (MP3, WAV), and Video (MP4) up to 40MB.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-violet-200 bg-violet-50/30 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileIcon(selectedFile)}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; {selectedFile.type || "Document"}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="h-8 w-8 p-0 text-stone-400 hover:text-rose-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    2. Lecture Content or Transcript
                  </label>
                  <Textarea
                    rows={5}
                    placeholder="Paste lecture transcript, class notes, or topic overview here..."
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="text-xs leading-relaxed rounded-xl border-stone-200 focus:border-violet-500"
                  />
                </div>
              )}

              {/* Subject / Context */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Subject / Topic Context
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics 101 - Laws of Motion, Thermodynamics"
                  className="h-9 text-xs rounded-xl border-stone-200 focus:border-violet-500"
                />
              </div>

              {/* Assessment Format Mixture (Creative Freedom) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  3. Assessment Question Format Composition
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {formatOptions.map((opt) => {
                    const isSelected = formatMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormatMode(opt.id as AssessmentFormatMode)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 shadow-xs"
                            : "border-stone-200 hover:bg-stone-50/70"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            {opt.icon}
                            <span>{opt.title}</span>
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Difficulty Tuning Control */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  4. Tune Difficulty Level (Bloom's Taxonomy)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {difficultyProfiles.map((p) => {
                    const isSelected = difficulty === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDifficulty(p.id as DifficultyLevel)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-violet-600 bg-violet-50/60 ring-2 ring-violet-500/20 shadow-xs"
                            : "border-stone-200 hover:bg-stone-50/70"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${p.dotColor}`} />
                            {p.title}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                        </div>
                        <p className="text-[10px] text-stone-500 leading-tight">
                          {p.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Count Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    5. Number of Questions
                  </label>
                  <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                    {questionCount} Questions
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {[5, 10, 15, 20, 25, 30].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        questionCount === num
                          ? "bg-stone-900 text-white border-stone-900 shadow-xs"
                          : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* Review Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    {selectedQuestionIds.size} of {generatedQuestions.length} Selected
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">
                    {difficulty} Mode
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase bg-violet-50 text-violet-700 border-violet-200">
                    {formatMode.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-7 px-2 text-[11px] font-semibold text-stone-600 hover:text-stone-900"
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="h-7 px-2 text-[11px] font-semibold text-stone-600 hover:text-stone-900"
                  >
                    Deselect All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("setup")}
                    className="h-7 px-2 text-[11px] font-semibold border-stone-200"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Re-tune
                  </Button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {generatedQuestions.map((q, idx) => {
                  const isChecked = selectedQuestionIds.has(q.id);
                  const diffColor = 
                    q.difficulty === "simple" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : q.difficulty === "hard"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";

                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? "border-violet-300 bg-white shadow-xs"
                          : "border-stone-200 bg-stone-50/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleQuestionSelection(q.id)}
                            className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                        </div>

                        <div className="flex-1 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-mono font-bold text-stone-400">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Format Badge */}
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] font-mono uppercase border ${
                                  q.type === "LONG_ESSAY"
                                    ? "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                                    : q.type === "SHORT_ESSAY"
                                    ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {q.type === "LONG_ESSAY" ? "Long Essay" : q.type === "SHORT_ESSAY" ? "Short Essay" : q.type}
                              </Badge>

                              {q.section && (
                                <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                                  {q.section}
                                </Badge>
                              )}

                              <Badge variant="outline" className="text-[10px] font-mono text-stone-700">
                                {q.marks} Marks
                              </Badge>

                              {q.citation && (
                                <Badge variant="outline" className="text-[10px] font-mono bg-stone-100 text-stone-600 border-stone-200">
                                  Ref: {q.citation}
                                </Badge>
                              )}

                              <Badge variant="outline" className={`text-[10px] font-mono capitalize border ${diffColor}`}>
                                {q.difficulty}
                              </Badge>
                            </div>
                          </div>

                          {/* Question Prompt */}
                          <p className="text-xs font-bold text-stone-900 leading-snug">
                            {q.prompt}
                          </p>

                          {/* Options for MCQ / TRUE_FALSE */}
                          {(q.type === "MCQ" || q.type === "TRUE_FALSE") && q.options && q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                              {q.options.map((opt, oIdx) => (
                                <div
                                  key={opt.id}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] border flex items-center justify-between ${
                                    opt.isCorrect
                                      ? "bg-emerald-50/70 border-emerald-300 text-emerald-800 font-semibold"
                                      : "bg-stone-50 border-stone-200 text-stone-600"
                                  }`}
                                >
                                  <span className="truncate">
                                    <span className="font-mono text-stone-400 mr-1.5">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    {opt.text}
                                  </span>
                                  {opt.isCorrect && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Short Essay Details */}
                          {q.type === "SHORT_ESSAY" && (
                            <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-amber-900 font-semibold">
                                <span>Word Guideline: {q.minWords || 20}–{q.maxWords || 100} words</span>
                                {q.keyTerms && q.keyTerms.length > 0 && (
                                  <span>Key Concepts: {q.keyTerms.join(", ")}</span>
                                )}
                              </div>
                              {q.modelAnswer && (
                                <p className="text-[11px] text-slate-700 italic">
                                  <strong>Benchmark Answer: </strong>{q.modelAnswer}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Long Essay Rubric Details */}
                          {q.type === "LONG_ESSAY" && (
                            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-xs space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-blue-900 font-bold">
                                <span className="flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{q.rubric?.name || "Marking Rubric"}</span>
                                </span>
                                <span>Min: {q.minWords || 150} words &bull; Max: {q.maxWords || 800} words</span>
                              </div>

                              {q.rubric?.criteria && q.rubric.criteria.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                  {q.rubric.criteria.map((crit, cIdx) => (
                                    <div key={crit.id || cIdx} className="bg-white p-2 rounded border border-blue-200 text-[10px]">
                                      <div className="flex justify-between font-bold text-slate-800">
                                        <span>{crit.title}</span>
                                        <span className="font-mono text-blue-700">{crit.maxMarks}m</span>
                                      </div>
                                      <p className="text-slate-500 line-clamp-1 mt-0.5">{crit.description}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.modelAnswer && (
                                <p className="text-[11px] text-slate-700 italic">
                                  <strong>Expected Arguments: </strong>{q.modelAnswer}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="mt-2 text-[11px] text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-100 leading-relaxed">
                              <span className="font-bold text-stone-700">Rationale: </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-xs font-semibold text-stone-600 hover:text-stone-900"
          >
            Cancel
          </Button>

          {step === "setup" && (
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              className="h-8 px-4 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xs rounded-xl inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Questions</span>
            </Button>
          )}

          {step === "review" && (
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              className="h-8 px-4 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs rounded-xl inline-flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Import {selectedQuestionIds.size} Questions to Exam</span>
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
