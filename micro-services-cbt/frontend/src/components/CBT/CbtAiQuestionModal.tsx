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
  RotateCcw 
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

export default function CbtAiQuestionModal({
  isOpen,
  onClose,
  examTitle,
  onImportQuestions,
}: CbtAiQuestionModalProps) {
  // Mode: "setup" (configure upload/prompt) | "review" (inspect generated questions)
  const [step, setStep] = useState<"setup" | "generating" | "review">("setup");
  const [sourceType, setSourceType] = useState<"file" | "text">("file");

  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notesText, setNotesText] = useState("");
  const [subject, setSubject] = useState(examTitle || "");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("balanced");
  const [questionCount, setQuestionCount] = useState<number>(10);
  
  // Generation feedback
  const [loadingMessage, setLoadingMessage] = useState("Extracting content and context with Gemini 3...");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Max 40MB
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
    setLoadingMessage("Parsing document / media context with Gemini 3...");

    // Stagger loading messages for friendly UX
    const timer1 = setTimeout(() => {
      setLoadingMessage("Ingesting concepts and calibrating Bloom's taxonomy...");
    }, 2500);

    const timer2 = setTimeout(() => {
      setLoadingMessage("Synthesizing psychometric distractors & answer keys...");
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
        marks: q.marks || 1.0,
        options: q.options || [],
        explanation: q.explanation || "",
        difficulty: q.difficulty || difficulty,
        citation: q.citation || "",
      }));

      if (questionsList.length === 0) {
        throw new Error("No questions were generated. Please try again with more detailed content.");
      }

      setGeneratedQuestions(questionsList);
      // Select all by default
      setSelectedQuestionIds(new Set(questionsList.map((q) => q.id)));
      setStep("review");
      toast.success(`Generated ${questionsList.length} questions successfully with Gemini 3!`);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-stone-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-stone-900">
                  AI Question Studio
                </DialogTitle>
                <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-violet-200 text-[10px] font-mono uppercase tracking-wide">
                  Powered by Gemini 3
                </Badge>
              </div>
              <DialogDescription className="text-xs text-stone-500">
                Parse lecture notes, slide decks, or audio/video to generate tuned CBT questions.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body Content based on Step */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "setup" && (
            <div className="space-y-6">
              
              {/* Source Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  1. Choose Source Content Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSourceType("file")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      sourceType === "file"
                        ? "border-violet-600 bg-violet-50/40 ring-2 ring-violet-500/20"
                        : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-violet-100 text-violet-700 shrink-0">
                      <FileUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">Upload Media / Document</h4>
                      <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                        PDF notes, PowerPoint slides, MP3 audio lectures, or MP4 class video.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceType("text")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      sourceType === "text"
                        ? "border-violet-600 bg-violet-50/40 ring-2 ring-violet-500/20"
                        : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">Paste Lecture Notes</h4>
                      <p className="text-[11px] text-stone-500 leading-snug mt-0.5">
                        Paste summaries, transcripts, lesson plans, or markdown syllabi.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Source Input Area */}
              {sourceType === "file" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    2. Attach File
                  </label>
                  
                  {!selectedFile ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-200 hover:border-violet-400 bg-stone-50/50 hover:bg-violet-50/30 rounded-xl p-6 text-center cursor-pointer transition-all"
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
                        Click to upload or drag & drop lecture file
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
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || "Document"}
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
                    rows={6}
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

              {/* Difficulty Tuning Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    3. Tune Difficulty Level (Bloom's Taxonomy)
                  </label>
                </div>
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
                    4. Number of Questions
                  </label>
                  <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                    {questionCount} Questions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20, 25, 30].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
          )}

          {/* Generating Step */}
          {step === "generating" && (
            <div className="py-16 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 animate-pulse opacity-20 blur-md" />
                <div className="relative w-20 h-20 rounded-2xl bg-white border border-violet-200 flex items-center justify-center text-violet-600 shadow-lg">
                  <BrainCircuit className="w-10 h-10 animate-spin text-violet-600 [animation-duration:6s]" />
                </div>
              </div>

              <div className="space-y-2 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-stone-900">
                  Gemini 3 Multimodal Ingestion
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  {loadingMessage}
                </p>
              </div>

              <div className="w-48 h-1.5 bg-stone-100 rounded-full mx-auto overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-violet-600 to-indigo-600 animate-[shimmer_1.5s_infinite]" />
              </div>
            </div>
          )}

          {/* Review Step */}
          {step === "review" && (
            <div className="space-y-4">
              
              {/* Review summary toolbar */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    {selectedQuestionIds.size} of {generatedQuestions.length} Selected
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">
                    {difficulty} Mode
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
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono font-bold text-stone-400">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1.5">
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

                          {/* Options */}
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
        <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
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
