"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  CloudOff,
  Copy,
  CopyPlus,
  EyeOff,
  FileQuestion,
  FileText,
  KeyRound,
  Layers,
  Loader2,
  MonitorCheck,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  loadStoredQuestions,
  saveStoredQuestions,
  hasUnsavedQuestions,
  setUnsavedQuestions,
  loadStoredExams,
  saveStoredExams,
  getExaminerSession,
  CbtQuestionType,
  ExamRubric,
  loadStoredRubrics,
} from "@cbt/lib/cbtSessionManager";
import CbtAiQuestionModal from "./CbtAiQuestionModal";
import CbtRubricUploadModal from "./CbtRubricUploadModal";
import CbtExamSettingsSheet from "./CbtExamSettingsSheet";
import CbtBulkImportDialog from "./CbtBulkImportDialog";
import "./cbt-studio.css";
import {
  CbtQuestionType as ServiceQuestionType,
  useAttachQuestionsMutation,
  useBulkCreateQuestionsMutation,
  useCreateCbtExamMutation,
  useGetCbtExamQuery,
  useUpdateCbtExamMutation,
  useUpdateQuestionMutation,
} from "@cbt/store/cbtMicroserviceApi";

export interface StudioQuestion {
  id: string;
  prompt: string;
  type: CbtQuestionType | "MULTI_SELECT";
  marks: number;
  section?: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  minWords?: number;
  maxWords?: number;
  modelAnswer?: string;
  keyTerms?: string[];
  rubric?: ExamRubric;
  explanation?: string;
  difficulty?: "simple" | "intermediate" | "hard" | string;
  citation?: string;
}

const TYPE_OPTIONS: Array<{ value: CbtQuestionType | "MULTI_SELECT"; label: string }> = [
  { value: "MCQ", label: "Multiple choice (one answer)" },
  { value: "MULTI_SELECT", label: "Multiple choice (several answers)" },
  { value: "TRUE_FALSE", label: "True or false" },
  { value: "SHORT_ESSAY", label: "Short answer" },
  { value: "LONG_ESSAY", label: "Essay / theory" },
];

interface CbtQuestionStudioProps {
  examId: string;
  initialTitle?: string;
  initialCode?: string;
  initialDurationMins?: number;
  initialQuestions?: StudioQuestion[];
}

export default function CbtQuestionStudio({
  examId,
  initialTitle = "",
  initialCode = "",
  initialDurationMins = 60,
  initialQuestions,
}: CbtQuestionStudioProps) {
  const [questions, setQuestions] = useState<StudioQuestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [examTitle, setExamTitle] = useState(initialTitle);
  const [roomCode, setRoomCode] = useState(initialCode);
  const [durationMins, setDurationMins] = useState(initialDurationMins);

  // Palette category filter
  const [paletteFilter, setPaletteFilter] = useState<
    "ALL" | "MCQ" | "SHORT_ESSAY" | "LONG_ESSAY"
  >("ALL");

  // Delivery & Anti-Malpractice Settings
  const [settings, setSettings] = useState({
    maxTabViolations: 3,
    shuffleQuestions: true,
    shuffleChoices: true,
    showInstantResults: true,
    requirePin: true,
  });

  // Modal States
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [serviceSyncedAt, setServiceSyncedAt] = useState<string | null>(null);

  // After a failed save, incomplete questions are marked in the list and the editor
  const [showErrors, setShowErrors] = useState(false);

  // Focus follows the work: a new or next question puts the cursor in its text,
  // and a failed save puts it on the field that needs attention
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusRequest, setFocusRequest] = useState<{
    target: "prompt" | "option";
    index: number;
    at: number;
  } | null>(null);
  useEffect(() => {
    if (!focusRequest) return;
    const el =
      focusRequest.target === "prompt"
        ? promptRef.current
        : optionRefs.current[focusRequest.index] || optionRefs.current[0];
    el?.focus();
  }, [focusRequest]);
  // Phones and tablets would pop the keyboard up on every Next, so only fine pointers get auto-focus
  const finePointer = () =>
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  const focusPrompt = (always = false) => {
    if (always || finePointer()) setFocusRequest({ target: "prompt", index: 0, at: Date.now() });
  };
  // The Add menu hands focus back to its button when it closes; after adding a question
  // the cursor should be in the new question's text instead
  const focusAfterMenu = useRef(false);
  const focusOption = (index: number) =>
    setFocusRequest({ target: "option", index: Math.max(0, index), at: Date.now() });

  const pathname = usePathname();
  const isSchoolContext = pathname?.startsWith("/RMS");
  const backHref = isSchoolContext ? "/RMS/cbt" : "/cbt";
  const monitorHref = isSchoolContext
    ? `/RMS/cbt/exams/${examId}/monitor`
    : `/cbt/exams/${examId}/monitor`;
  const {
    data: serviceExam,
    isFetching: isLoadingExam,
    error: examLoadError,
    refetch: retryLoadExam,
  } = useGetCbtExamQuery(examId, {
    skip: !examId,
  });
  const [bulkCreateQuestions, { isLoading: isCreatingQuestions }] =
    useBulkCreateQuestionsMutation();
  const [updateQuestion, { isLoading: isUpdatingQuestion }] =
    useUpdateQuestionMutation();
  const [attachQuestions, { isLoading: isAttachingQuestions }] =
    useAttachQuestionsMutation();
  const [updateCbtExam, { isLoading: isTogglingPublish }] =
    useUpdateCbtExamMutation();
  const [createCbtExam] = useCreateCbtExamMutation();
  const isSavingQuestions =
    isCreatingQuestions || isUpdatingQuestion || isAttachingQuestions;
  const [localPublished, setLocalPublished] = useState<boolean>(true);
  const isPublished = serviceExam
    ? Boolean(serviceExam?.isPublished)
    : localPublished;

  // Only IDs the backend returned are persisted; manual, AI and imported drafts carry local IDs
  const persistedIdSet = useMemo(
    () =>
      new Set(
        (serviceExam?.questions || []).map(
          (item) => item.question?.id || item.questionId,
        ),
      ),
    [serviceExam],
  );

  const isObjective = (type: StudioQuestion["type"]) =>
    type === "MCQ" || type === "TRUE_FALSE" || type === "MULTI_SELECT";

  // Older exams stored every essay as "ESSAY"; treat those as long essays
  const normalizeQuestionFromService = (q: any): StudioQuestion => ({
    id: q.id,
    prompt: q.prompt || "",
    type: q.type === "ESSAY" ? "LONG_ESSAY" : q.type || "MCQ",
    marks: q.marks || 1,
    options: Array.isArray(q.options) ? q.options : [],
    explanation: q.explanation || "",
    section: q.section,
    minWords: q.minWords,
    maxWords: q.maxWords,
    modelAnswer: q.modelAnswer || "",
    keyTerms: Array.isArray(q.keyTerms) ? q.keyTerms : [],
    rubric: q.rubric || undefined,
  });

  // Drafts kept on this device; older ones used "ESSAY" for long essays
  const normalizeStoredQuestions = (stored: any[]): StudioQuestion[] =>
    stored.map((q: any) => ({
      ...q,
      type: q.type === "ESSAY" ? "LONG_ESSAY" : q.type || "MCQ",
      options: q.options || [],
      marks: q.marks || 1,
    }));

  // The editor opens once the server copy has arrived (or failed to), so nothing
  // typed before it lands can be overwritten by it
  const questionsReady = !examId || Boolean(serviceExam) || Boolean(examLoadError);

  // Every edit is kept on this device and marked unsaved until Save succeeds
  const saveDraft = (draft: StudioQuestion[]) => {
    saveStoredQuestions(draft, examId);
    setUnsavedQuestions(examId, true);
  };

  // Everything the editor holds goes to the server, so nothing is lost on reload
  const toServiceQuestionPayload = (
    q: StudioQuestion,
    workspaceId: string,
  ) => ({
    workspaceId,
    prompt: q.prompt.trim(),
    type: q.type as ServiceQuestionType,
    marks: Number(q.marks) || 1,
    section: q.section?.trim() || null,
    options: isObjective(q.type)
      ? (q.options || []).map((option, index) => ({
          id: option.id || `opt_${index + 1}`,
          text: option.text || "",
          isCorrect: Boolean(option.isCorrect),
          keyLabel: String.fromCharCode(65 + index),
        }))
      : [],
    explanation: q.explanation?.trim() || null,
    minWords: isObjective(q.type) ? null : q.minWords || null,
    maxWords: isObjective(q.type) ? null : q.maxWords || null,
    modelAnswer: isObjective(q.type) ? null : q.modelAnswer?.trim() || null,
    keyTerms: isObjective(q.type) ? null : q.keyTerms || [],
    rubric: q.type === "LONG_ESSAY" || q.type === "SHORT_ESSAY" ? q.rubric || null : null,
  });

  useEffect(() => {
    if (serviceExam) {
      setExamTitle(serviceExam.title || initialTitle);
      setRoomCode(serviceExam.accessCode || initialCode);
      setDurationMins(serviceExam.durationMins || initialDurationMins);
      setSettings((prev) => ({
        ...prev,
        maxTabViolations: serviceExam.maxTabViolations ?? prev.maxTabViolations,
        shuffleQuestions: serviceExam.shuffleQuestions ?? prev.shuffleQuestions,
        shuffleChoices: serviceExam.shuffleChoices ?? prev.shuffleChoices,
        showInstantResults: serviceExam.showResultAfter ?? prev.showInstantResults,
      }));
      // Unsaved edits on this device win over the server copy until they are saved,
      // so a refetch (after publishing or saving settings) or a reload never wipes them
      if (hasUnsavedQuestions(examId)) {
        setQuestions((current) =>
          current.length > 0 ? current : normalizeStoredQuestions(loadStoredQuestions(examId)),
        );
        return;
      }
      const serviceQuestions = (serviceExam.questions || [])
        .slice()
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
        .map((item) => normalizeQuestionFromService(item.question));

      setQuestions(serviceQuestions);
      saveStoredQuestions(serviceQuestions, examId);
      updateExamQuestionCount(serviceQuestions.length);
      setServiceSyncedAt(new Date().toISOString());
      return;
    }

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
      setQuestions(normalizeStoredQuestions(loadStoredQuestions(examId)));
    }
  }, [examId, initialQuestions, serviceExam]);

  const updateExamQuestionCount = (count: number) => {
    const exams = loadStoredExams();
    const updated = exams.map((e) =>
      e.id === examId ? { ...e, totalQuestions: count } : e,
    );
    saveStoredExams(updated);
  };

  const activeQuestion = questions[activeIdx] || questions[0];

  const totalMarks = useMemo(
    () => questions.reduce((sum, q) => sum + (q.marks || 1), 0),
    [questions],
  );

  // Question counts by format
  const formatCounts = useMemo(() => {
    const mcq = questions.filter(
      (q) => q.type === "MCQ" || q.type === "TRUE_FALSE" || q.type === "MULTI_SELECT",
    ).length;
    const shortEssay = questions.filter((q) => q.type === "SHORT_ESSAY").length;
    const longEssay = questions.filter((q) => q.type === "LONG_ESSAY").length;
    return { mcq, shortEssay, longEssay, total: questions.length };
  }, [questions]);

  // Filtered questions for palette
  const filteredQuestions = useMemo(() => {
    if (paletteFilter === "ALL") return questions;
    if (paletteFilter === "MCQ")
      return questions.filter(
        (q) => q.type === "MCQ" || q.type === "TRUE_FALSE" || q.type === "MULTI_SELECT",
      );
    if (paletteFilter === "SHORT_ESSAY")
      return questions.filter((q) => q.type === "SHORT_ESSAY");
    if (paletteFilter === "LONG_ESSAY")
      return questions.filter((q) => q.type === "LONG_ESSAY");
    return questions;
  }, [questions, paletteFilter]);

  // Copy candidate share link
  const handleCopyShareLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/take/${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Candidate link copied.");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Add new blank question. `like` carries the section and marks over when adding "another one like this"
  const handleAddNewQuestion = (
    type: CbtQuestionType = "MCQ",
    like?: { section?: string; marks?: number },
  ) => {
    if (!questionsReady) return;
    let newQ: StudioQuestion;
    const newId = `q_${Date.now()}`;

    if (type === "SHORT_ESSAY") {
      newQ = {
        id: newId,
        prompt: "",
        type: "SHORT_ESSAY",
        marks: 5.0,
        section: "Section B: Theory & Short Answers",
        options: [],
        minWords: 20,
        maxWords: 100,
        modelAnswer: "",
        keyTerms: [],
      };
    } else if (type === "LONG_ESSAY") {
      newQ = {
        id: newId,
        prompt: "",
        type: "LONG_ESSAY",
        marks: 15.0,
        section: "Section C: Extended Essay",
        options: [],
        minWords: 150,
        maxWords: 800,
        modelAnswer: "",
      };
    } else if (type === "TRUE_FALSE") {
      newQ = {
        id: newId,
        prompt: "",
        type: "TRUE_FALSE",
        marks: 1.0,
        section: "Section A: Multiple Choice",
        options: [
          { id: `o_${Date.now()}_1`, text: "True", isCorrect: true },
          { id: `o_${Date.now()}_2`, text: "False", isCorrect: false },
        ],
      };
    } else {
      // Standard MCQ
      newQ = {
        id: newId,
        prompt: "",
        type: "MCQ",
        marks: 1.0,
        section: "Section A: Multiple Choice",
        options: [
          { id: `o_${Date.now()}_1`, text: "", isCorrect: true },
          { id: `o_${Date.now()}_2`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_3`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_4`, text: "", isCorrect: false },
        ],
      };
    }

    if (like?.section) newQ.section = like.section;
    if (like?.marks) newQ.marks = like.marks;

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveIdx(updated.length - 1);
    // The new question must be visible in the list, whatever filter was on
    setPaletteFilter("ALL");
    saveDraft(updated);
    updateExamQuestionCount(updated.length);
    focusPrompt();
  };

  // Change type of current active question
  const handleChangeQuestionType = (newType: StudioQuestion["type"]) => {
    if (!activeQuestion) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const curr = copy[activeIdx];
      let updatedQ: StudioQuestion = { ...curr, type: newType };

      if ((newType === "MCQ" || newType === "MULTI_SELECT") && (!curr.options || curr.options.length < 2 || curr.type === "TRUE_FALSE")) {
        updatedQ.options = [
          { id: `o_${Date.now()}_1`, text: "", isCorrect: true },
          { id: `o_${Date.now()}_2`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_3`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_4`, text: "", isCorrect: false },
        ];
        updatedQ.marks = 1.0;
      } else if (newType === "MCQ") {
        // A single-answer question keeps only the first correct option
        const first = Math.max(0, curr.options.findIndex((o) => o.isCorrect));
        updatedQ.options = curr.options.map((o, i) => ({ ...o, isCorrect: i === first }));
      } else if (newType === "TRUE_FALSE") {
        updatedQ.options = [
          { id: `o_${Date.now()}_1`, text: "True", isCorrect: true },
          { id: `o_${Date.now()}_2`, text: "False", isCorrect: false },
        ];
        updatedQ.marks = 1.0;
      } else if (newType === "SHORT_ESSAY") {
        updatedQ.marks =
          updatedQ.marks && updatedQ.marks > 1 ? updatedQ.marks : 5.0;
        updatedQ.minWords = updatedQ.minWords || 20;
        updatedQ.maxWords = updatedQ.maxWords || 100;
        if (!updatedQ.section) updatedQ.section = "Section B: Short Answers";
      } else if (newType === "LONG_ESSAY") {
        updatedQ.marks =
          updatedQ.marks && updatedQ.marks >= 10 ? updatedQ.marks : 15.0;
        updatedQ.minWords = updatedQ.minWords || 150;
        updatedQ.maxWords = updatedQ.maxWords || 800;
        if (!updatedQ.section) updatedQ.section = "Section C: Long Essay";
      }

      copy[activeIdx] = updatedQ;
      saveDraft(copy);
      return copy;
    });
    toast.info(`Question ${activeIdx + 1} is now: ${typeLabel(newType).toLowerCase()}.`);
  };

  // Import questions generated by ParaLearn AI
  const handleImportAiQuestions = (newQuestions: StudioQuestion[]) => {
    if (!questionsReady) {
      toast.error("This exam's questions are still loading. Try again in a moment.");
      return;
    }
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);
    setActiveIdx(questions.length); // Focus on first newly added question
    saveDraft(updated);
    updateExamQuestionCount(updated.length);
  };

  // Apply custom or institutional rubric
  const handleApplyRubric = (rubric: ExamRubric, applyToAllEssays: boolean) => {
    setQuestions((prev) => {
      const copy = prev.map((q, idx) => {
        if (
          idx === activeIdx ||
          (applyToAllEssays &&
            (q.type === "LONG_ESSAY" || q.type === "SHORT_ESSAY"))
        ) {
          return {
            ...q,
            rubric: rubric,
            marks: rubric.totalMarks > 0 ? rubric.totalMarks : q.marks,
          };
        }
        return q;
      });
      saveDraft(copy);
      return copy;
    });
    setIsRubricModalOpen(false);
    toast.success(`Rubric "${rubric.name}" attached (${rubric.totalMarks} marks).`);
  };

  // Update active question field
  const updateActiveQuestion = (field: keyof StudioQuestion, val: any) => {
    if (!activeQuestion) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[activeIdx] = { ...copy[activeIdx], [field]: val };
      saveDraft(copy);
      return copy;
    });
  };

  // Update choice text
  const updateOptionText = (optIdx: number, text: string) => {
    if (!activeQuestion || !activeQuestion.options) return;
    const opts = [...activeQuestion.options];
    opts[optIdx] = { ...opts[optIdx], text };
    updateActiveQuestion("options", opts);
  };

  // Mark the correct choice: one for MCQ / True-False, any number (at least one) for multiple answers
  const setCorrectChoice = (optIdx: number) => {
    if (!activeQuestion || !activeQuestion.options) return;
    if (activeQuestion.type === "MULTI_SELECT") {
      const opts = activeQuestion.options.map((o, i) =>
        i === optIdx ? { ...o, isCorrect: !o.isCorrect } : o,
      );
      if (!opts.some((o) => o.isCorrect)) {
        toast.error("A multiple-answer question needs at least one correct option.");
        return;
      }
      updateActiveQuestion("options", opts);
      return;
    }
    const opts = activeQuestion.options.map((o, i) => ({
      ...o,
      isCorrect: i === optIdx,
    }));
    updateActiveQuestion("options", opts);
  };

  // Delete choice
  const deleteChoice = (optIdx: number) => {
    if (!activeQuestion || !activeQuestion.options) return;
    if (activeQuestion.options.length <= 2) {
      toast.error("An assessment question requires at least 2 options.");
      return;
    }
    let opts = activeQuestion.options.filter((_, i) => i !== optIdx);
    // Never leave a question without a correct answer
    if (!opts.some((o) => o.isCorrect)) opts = opts.map((o, i) => ({ ...o, isCorrect: i === 0 }));
    updateActiveQuestion("options", opts);
  };

  // Add choice
  const addChoice = () => {
    if (!activeQuestion) return;
    const currentOpts = activeQuestion.options || [];
    if (currentOpts.length >= 6) {
      toast.error("Maximum 6 options allowed per question.");
      return;
    }
    const opts = [
      ...currentOpts,
      { id: `o_${Date.now()}`, text: "", isCorrect: false },
    ];
    updateActiveQuestion("options", opts);
  };

  // Delete question, with Undo instead of a confirmation so writing stays fast
  const handleDeleteQuestion = (idx: number) => {
    const removed = questions[idx];
    if (!removed) return;
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    // Stay at the same position (the question that moved up), or the new last one
    setActiveIdx(Math.max(0, Math.min(idx, updated.length - 1)));
    saveDraft(updated);
    updateExamQuestionCount(updated.length);
    // Focus leaves the Delete button, so a second Enter can't delete the next question too
    focusPrompt(true);
    toast(`Question ${idx + 1} deleted.`, {
      duration: 8000,
      action: { label: "Undo", onClick: () => restoreQuestion(removed, idx) },
    });
  };

  const restoreQuestion = (q: StudioQuestion, idx: number) => {
    setQuestions((prev) => {
      if (prev.some((p) => p.id === q.id)) return prev;
      const copy = [...prev];
      copy.splice(Math.min(idx, copy.length), 0, q);
      saveDraft(copy);
      updateExamQuestionCount(copy.length);
      return copy;
    });
    setPaletteFilter("ALL");
    setActiveIdx(idx);
  };

  // What stops a question from being saved, if anything
  const problemIn = (q: StudioQuestion): "prompt" | "options" | null => {
    if (!q.prompt.trim()) return "prompt";
    if (isObjective(q.type) && (!q.options?.length || q.options.some((o) => !o.text.trim())))
      return "options";
    return null;
  };

  const handleSaveQuestions = async () => {
    const storedExams = loadStoredExams();
    const storedExam = storedExams.find((e) => e.id === examId);
    const examinerSession = getExaminerSession();
    const workspaceId =
      serviceExam?.workspaceId ||
      serviceExam?.workspace?.id ||
      storedExam?.workspaceId ||
      examinerSession?.id ||
      "default";

    // Every question needs its text, and objective questions need every option filled in.
    // Take the examiner straight to the first one that doesn't, and mark the rest in the list.
    const firstInvalid = questions.findIndex((q) => problemIn(q));
    if (firstInvalid !== -1) {
      const bad = questions[firstInvalid];
      const problem = problemIn(bad);
      const others = questions.filter((q) => problemIn(q)).length - 1;
      setShowErrors(true);
      setPaletteFilter("ALL");
      setActiveIdx(firstInvalid);
      if (problem === "prompt") focusPrompt(true);
      else focusOption((bad.options || []).findIndex((o) => !o.text.trim()));
      toast.error(
        `Nothing was saved. Question ${firstInvalid + 1} ${
          problem === "prompt" ? "has no question text" : "has an empty answer choice"
        }${others > 0 ? `, and ${others} more ${others === 1 ? "question needs" : "questions need"} attention` : ""}.`,
      );
      return;
    }

    saveDraft(questions);
    updateExamQuestionCount(questions.length);

    try {
      // Auto-sync exam shell to cloud/backend if not synced yet
      if (!serviceExam && storedExam) {
        try {
          await createCbtExam({
            id: storedExam.id,
            workspaceId,
            title: storedExam.title || examTitle,
            accessCode: storedExam.accessCode || roomCode,
            durationMins: storedExam.durationMins || durationMins,
            totalQuestions: questions.length,
            maxTabViolations: settings.maxTabViolations,
            shuffleQuestions: settings.shuffleQuestions,
            shuffleChoices: settings.shuffleChoices,
            showResultAfter: settings.showInstantResults,
            isPublished: false,
          }).unwrap();
        } catch (err) {
          console.warn(
            "[CBT Studio] Cloud sync of exam shell will retry:",
            err,
          );
        }
      }

      const existingQuestions = questions.filter((q) =>
        persistedIdSet.has(q.id),
      );
      const newQuestions = questions.filter((q) => !persistedIdSet.has(q.id));

      await Promise.all(
        existingQuestions.map((q) => {
          const { workspaceId: _ws, ...payload } = toServiceQuestionPayload(q, workspaceId);
          return updateQuestion({ id: q.id, ...(payload as any) }).unwrap();
        }),
      );

      // Swap each draft's local ID for its server ID (bulk create returns questions in input order)
      const serverIdByLocalId = new Map<string, string>();
      if (newQuestions.length > 0) {
        const created = await bulkCreateQuestions({
          workspaceId,
          questions: newQuestions.map((q) =>
            toServiceQuestionPayload(q, workspaceId),
          ),
        }).unwrap();
        (created.questions || []).forEach((serverQuestion, idx) => {
          serverIdByLocalId.set(newQuestions[idx].id, serverQuestion.id);
        });
      }

      const syncedQuestions = questions.map((q) => ({
        ...q,
        id: serverIdByLocalId.get(q.id) || q.id,
      }));
      setQuestions(syncedQuestions);
      saveStoredQuestions(syncedQuestions, examId);

      // Attach replaces the exam's question list, so this also applies studio order and deletions
      await attachQuestions({
        examId,
        questionIds: syncedQuestions.map((q) => q.id),
      }).unwrap();

      setUnsavedQuestions(examId, false);
      setIsDirty(false);
      setShowErrors(false);
      setServiceSyncedAt(new Date().toISOString());
      toast.success("Questions saved.");
    } catch (error: any) {
      console.warn("[CBT Studio] Saving to the server failed:", error);
      toast.error(
        error?.data?.message
          ? `Not saved: ${error.data.message}`
          : "Couldn't reach the server. Your changes are kept on this device; press Save again when you're online.",
      );
    }
  };

  const handleTogglePublish = async () => {
    if (!serviceExam) {
      const stored = loadStoredExams();
      const nextState = !isPublished;
      const updated = stored.map((e) =>
        e.id === examId ? { ...e, isPublished: nextState } : e,
      );
      saveStoredExams(updated);
      setLocalPublished(nextState);
      toast.success(
        nextState
          ? `Exam room published. Students can now join with code ${roomCode}.`
          : "Exam room closed. Students can no longer join with this code.",
      );
      return;
    }
    if (!isPublished) {
      if (persistedIdSet.size === 0) {
        toast.error("Save at least one question before publishing.");
        return;
      }
      if (questions.some((q) => !persistedIdSet.has(q.id))) {
        toast.error(
          "Some questions aren't saved yet. Press Save, then publish.",
        );
        return;
      }
    }

    try {
      await updateCbtExam({ id: examId, isPublished: !isPublished }).unwrap();
      setLocalPublished(!isPublished);
      toast.success(
        isPublished
          ? "Exam room closed. Students can no longer join with this code."
          : `Exam room published. Students can now join with code ${roomCode}.`,
      );
    } catch (error: any) {
      const reason = error?.data?.message;
      toast.error(
        `Couldn't update the exam room${reason ? `: ${Array.isArray(reason) ? reason.join("; ") : reason}` : "."}`,
      );
    }
  };

  // ── Studio helpers (layout only; every save still goes through handleSaveQuestions) ──

  // True while this device holds edits the server hasn't received yet
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    setIsDirty(hasUnsavedQuestions(examId));
  }, [questions, examId]);

  // Insert a copy right after the current question; it gets a local ID, so Save creates it on the server
  const handleDuplicateQuestion = () => {
    if (!activeQuestion) return;
    const stamp = Date.now();
    const copyQ: StudioQuestion = {
      ...activeQuestion,
      id: `q_${stamp}`,
      options: (activeQuestion.options || []).map((o, i) => ({
        ...o,
        id: `o_${stamp}_${i + 1}`,
      })),
      keyTerms: activeQuestion.keyTerms ? [...activeQuestion.keyTerms] : undefined,
    };
    const updated = [
      ...questions.slice(0, activeIdx + 1),
      copyQ,
      ...questions.slice(activeIdx + 1),
    ];
    setQuestions(updated);
    setActiveIdx(activeIdx + 1);
    saveDraft(updated);
    updateExamQuestionCount(updated.length);
    focusPrompt();
    toast.success(`Question ${activeIdx + 1} copied as question ${activeIdx + 2}.`);
  };

  // Save sends questions in this order (attach replaces the exam's list), so moving here reorders the exam
  const moveQuestion = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setQuestions(updated);
    setActiveIdx(target);
    saveDraft(updated);
  };

  const goToQuestion = (idx: number) =>
    setActiveIdx(Math.max(0, Math.min(questions.length - 1, idx)));

  const isLastQuestion = questions.length > 0 && activeIdx >= questions.length - 1;

  // Writing a paper is mostly "next, next, next": at the last question, Next becomes
  // "add another like this one" (same type, section and marks)
  const addLikeCurrent = () => {
    const current = questions[activeIdx];
    const type: CbtQuestionType =
      !current || current.type === "MULTI_SELECT" ? "MCQ" : (current.type as CbtQuestionType);
    handleAddNewQuestion(type, current ? { section: current.section, marks: current.marks } : undefined);
  };
  const advance = () => {
    if (!questions.length) return;
    if (isLastQuestion) addLikeCurrent();
    else {
      goToQuestion(activeIdx + 1);
      focusPrompt();
    }
  };

  // Keyboard: Ctrl/Cmd+S saves, Ctrl/Cmd+Enter goes to the next question (or adds one at the end),
  // Alt+Up/Down moves between questions. The ref keeps the listener on the latest state.
  const shortcuts = useRef({ save: () => {}, next: () => {}, down: () => {}, prev: () => {} });
  shortcuts.current = {
    save: () => {
      if (isSavingQuestions || !questionsReady) return;
      if (serviceExam && !isDirty) {
        toast("Everything is already saved.");
        return;
      }
      handleSaveQuestions();
    },
    next: () => questionsReady && advance(),
    down: () => {
      if (!isLastQuestion) {
        goToQuestion(activeIdx + 1);
        focusPrompt();
      }
    },
    prev: () => {
      if (activeIdx > 0) {
        goToQuestion(activeIdx - 1);
        focusPrompt();
      }
    },
  };
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    const onKey = (e: KeyboardEvent) => {
      // Dialogs and menus handle their own keys
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        shortcuts.current.save();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        shortcuts.current.next();
      } else if (e.altKey && !mod && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        // On a Mac, Option+arrow moves the cursor by paragraph inside text, so leave it alone there
        const t = e.target as HTMLElement | null;
        if (isMac && t?.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (e.key === "ArrowDown") shortcuts.current.down();
        else shortcuts.current.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Set after mount so the server and browser render the same text first
  const [modKey, setModKey] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setModKey("⌘");
  }, []);

  const typeLabel = (type: StudioQuestion["type"]) =>
    TYPE_OPTIONS.find((t) => t.value === type)?.label || type;

  const typeTag = (type: StudioQuestion["type"]) =>
    type === "LONG_ESSAY"
      ? { label: "Essay", tone: "is-long" }
      : type === "SHORT_ESSAY"
        ? { label: "Short answer", tone: "is-short" }
        : type === "TRUE_FALSE"
          ? { label: "True/False", tone: "is-mcq" }
          : type === "MULTI_SELECT"
            ? { label: "Multi-answer", tone: "is-mcq" }
            : { label: "MCQ", tone: "is-mcq" };

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const promptWords = activeQuestion?.prompt.trim()
    ? activeQuestion.prompt.trim().split(/\s+/).length
    : 0;

  const isEssay =
    activeQuestion?.type === "SHORT_ESSAY" || activeQuestion?.type === "LONG_ESSAY";
  const criteriaTotal = (activeQuestion?.rubric?.criteria || []).reduce(
    (sum, c) => sum + (Number(c.maxMarks) || 0),
    0,
  );

  const statusPill = serviceExam
    ? isPublished
      ? { tone: "is-live", text: "Published · candidates can join" }
      : { tone: "is-draft", text: "Draft · candidates can't join yet" }
    : examLoadError
      ? { tone: "is-local", text: "Draft on this computer" }
      : { tone: "is-local", text: "Loading exam…" };

  // Save leads while there is something to save; once everything is saved, Publish leads
  const saveLeads = isDirty || !serviceExam;
  const activeProblem = activeQuestion && showErrors ? problemIn(activeQuestion) : null;
  const incompleteCount = showErrors ? questions.filter((q) => problemIn(q)).length : 0;

  const addFromMenu = (type: CbtQuestionType) => {
    focusAfterMenu.current = finePointer();
    handleAddNewQuestion(type);
  };

  const addMenu = (align: "start" | "end" = "end", compact = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`cbt-button ${compact ? "" : "primary"} qs-add`}
          disabled={!questionsReady}
        >
          <Plus size={15} />
          Add
          <ChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="cbt-dialog w-60 text-[13px] font-medium"
        onCloseAutoFocus={(e) => {
          if (!focusAfterMenu.current) return;
          focusAfterMenu.current = false;
          e.preventDefault();
          promptRef.current?.focus();
        }}
      >
        <DropdownMenuItem onClick={() => addFromMenu("MCQ")} className="cursor-pointer">
          <Radio className="w-4 h-4 mr-2 text-[var(--violet-ink)]" />
          Multiple choice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addFromMenu("TRUE_FALSE")} className="cursor-pointer">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-700" />
          True or false
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addFromMenu("SHORT_ESSAY")} className="cursor-pointer">
          <AlignLeft className="w-4 h-4 mr-2 text-amber-700" />
          Short answer (20 to 100 words)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => addFromMenu("LONG_ESSAY")} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2 text-[var(--violet-ink)]" />
          Essay / theory
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsAiModalOpen(true)} className="cursor-pointer">
          <Sparkles className="w-4 h-4 mr-2 text-[var(--violet-ink)]" />
          Generate with ParaLearn AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsBulkOpen(true)} className="cursor-pointer">
          <Upload className="w-4 h-4 mr-2 text-slate-500" />
          Import from Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderListItem = (q: StudioQuestion, idx: number, inSheet = false) => {
    const isActive = idx === activeIdx;
    const tag = typeTag(q.type);
    const incomplete = showErrors && problemIn(q);
    return (
      <li
        key={q.id}
        className={`qs-item ${isActive ? "is-active" : ""} ${incomplete ? "is-incomplete" : ""}`}
      >
        <button
          type="button"
          className="qs-item-select"
          aria-current={isActive ? "true" : undefined}
          onClick={() => {
            setActiveIdx(idx);
            if (inSheet) setIsMobilePaletteOpen(false);
          }}
        >
          <span className="qs-item-top">
            <span className="qs-item-num">Q{pad2(idx + 1)}</span>
            <span className="qs-item-marks">
              {q.marks} {q.marks === 1 ? "mark" : "marks"}
            </span>
          </span>
          <span className={`qs-item-stem ${q.prompt.trim() ? "" : "is-empty"}`}>
            {q.prompt.trim() || "No question text yet"}
          </span>
          <span className="qs-item-tags">
            <span className={`qs-tag ${tag.tone}`}>{tag.label}</span>
            {q.rubric && <span className="qs-tag is-rubric">Rubric</span>}
            {incomplete && (
              <span className="qs-tag is-error">
                <AlertCircle size={12} aria-hidden />
                Incomplete
              </span>
            )}
            {q.section && <span className="qs-item-section">{q.section}</span>}
          </span>
        </button>
        {isActive && questions.length > 1 && (
          <div className="qs-item-order" aria-label="Move this question">
            <button
              type="button"
              className="qs-mini"
              onClick={() => moveQuestion(idx, -1)}
              disabled={idx === 0}
              aria-label="Move question up"
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              className="qs-mini"
              onClick={() => moveQuestion(idx, 1)}
              disabled={idx === questions.length - 1}
              aria-label="Move question down"
              title="Move down"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </li>
    );
  };

  const filters: Array<{ key: typeof paletteFilter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: formatCounts.total },
    { key: "MCQ", label: "Objective", count: formatCounts.mcq },
    { key: "SHORT_ESSAY", label: "Short", count: formatCounts.shortEssay },
    { key: "LONG_ESSAY", label: "Essay", count: formatCounts.longEssay },
  ];

  const minWordsDefault = activeQuestion?.type === "LONG_ESSAY" ? 150 : 20;
  const maxWordsDefault = activeQuestion?.type === "LONG_ESSAY" ? 800 : 100;

  return (
    <div className="cbt-studio qs">
      {/* ── EXAM STRIP ───────────────────────────────────────────────────── */}
      <section className="qs-head" aria-label="Examination">
        <div className="qs-head-main">
          <div className="qs-head-title">
            <Link href={backHref} className="qs-back">
              <ArrowLeft size={15} />
              Examinations
            </Link>
            <h1 title={examTitle || undefined}>
              {examTitle || (examLoadError ? "Exam not loaded" : "Loading exam…")}
            </h1>
            {roomCode && (
              <span className="qs-code" title="Exam access code">
                <KeyRound size={12} aria-hidden />
                {roomCode}
              </span>
            )}
          </div>
          <div className="qs-head-facts">
            <span className={`qs-pill ${statusPill.tone}`}>{statusPill.text}</span>
            <span className="qs-facts-text">
              <strong>{questions.length}</strong> {questions.length === 1 ? "question" : "questions"}
              <span aria-hidden> · </span>
              <strong>{totalMarks}</strong> marks
              <span aria-hidden> · </span>
              <strong>{durationMins}</strong> minutes
            </span>
          </div>
        </div>
        <div className="qs-head-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="cbt-button">
                <Wrench size={15} />
                Tools
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="cbt-dialog w-64 text-[13px] font-medium">
              <DropdownMenuItem onClick={() => setIsAiModalOpen(true)} className="cursor-pointer">
                <Sparkles className="w-4 h-4 mr-2 text-[var(--violet-ink)]" />
                ParaLearn AI question generator
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsBulkOpen(true)} className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2 text-slate-500" />
                Import questions from Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsRubricModalOpen(true)} className="cursor-pointer">
                <Award className="w-4 h-4 mr-2 text-amber-700" />
                Marking rubrics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="cursor-pointer">
                <Sliders className="w-4 h-4 mr-2 text-slate-500" />
                Exam settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyShareLink} className="cursor-pointer">
                {copiedLink ? (
                  <Check className="w-4 h-4 mr-2 text-emerald-700" />
                ) : (
                  <Copy className="w-4 h-4 mr-2 text-slate-500" />
                )}
                {copiedLink ? "Link copied" : "Copy candidate link"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={monitorHref} className="cursor-pointer flex items-center">
                  <MonitorCheck className="w-4 h-4 mr-2 text-emerald-700" />
                  Open live monitor
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className={`cbt-button ${saveLeads ? "primary" : "qs-saved"}`}
            onClick={handleSaveQuestions}
            disabled={isSavingQuestions || !questionsReady || !saveLeads}
            title={`Save (${modKey}+S)`}
          >
            {isSavingQuestions ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saveLeads ? (
              <Save size={15} />
            ) : (
              <Check size={15} />
            )}
            {isSavingQuestions ? "Saving…" : saveLeads ? "Save changes" : "Saved"}
          </button>
          {serviceExam && (
            <button
              type="button"
              className={`cbt-button ${!isPublished && !saveLeads && persistedIdSet.size > 0 ? "qs-publish" : ""}`}
              onClick={handleTogglePublish}
              disabled={isTogglingPublish || isSavingQuestions}
              title={!isPublished && saveLeads ? "Save your changes first, then publish" : undefined}
            >
              {isTogglingPublish ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isPublished ? (
                <EyeOff size={15} />
              ) : (
                <Rocket size={15} />
              )}
              {isTogglingPublish ? "Updating…" : isPublished ? "Unpublish" : "Publish exam"}
            </button>
          )}
        </div>
        {examLoadError && (
          <div className="qs-load-note" role="status">
            <CloudOff size={16} aria-hidden />
            <span>
              Couldn&apos;t reach the CBT service. Anything you write stays on this computer until you
              save while online.
            </span>
            <button type="button" className="qs-link" onClick={() => retryLoadExam()} disabled={isLoadingExam}>
              {isLoadingExam ? "Trying…" : "Try again"}
            </button>
          </div>
        )}
      </section>

      {/* ── TWO PANES ────────────────────────────────────────────────────── */}
      <div className="qs-body">
        {/* Question list (wide screens) */}
        <aside className="qs-list" aria-label="Questions in this exam">
          <div className="qs-list-head">
            <div className="qs-list-title">
              <h2>
                Questions <span className="qs-count-badge">{questions.length}</span>
              </h2>
              {addMenu("end")}
            </div>
            {questions.length > 0 && (
              <div className="qs-filters" role="group" aria-label="Filter by question type">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={paletteFilter === f.key}
                    onClick={() => setPaletteFilter(f.key)}
                  >
                    {f.label}
                    <small>{f.count}</small>
                  </button>
                ))}
              </div>
            )}
            {incompleteCount > 0 && (
              <p className="qs-list-alert" role="status">
                <AlertCircle size={14} aria-hidden />
                {incompleteCount} {incompleteCount === 1 ? "question needs" : "questions need"} finishing before you can save
              </p>
            )}
          </div>
          {!questionsReady ? (
            <ul className="qs-items" aria-busy="true" aria-label="Loading questions">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="qs-item qs-skeleton-item" aria-hidden>
                  <span className="qs-skel" style={{ width: "30%" }} />
                  <span className="qs-skel" style={{ width: "92%" }} />
                  <span className="qs-skel" style={{ width: "64%" }} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="qs-items">
              {filteredQuestions.length === 0 ? (
                <li className="qs-list-empty">
                  {questions.length === 0 ? (
                    "Questions you add appear here."
                  ) : (
                    <>
                      No {filters.find((f) => f.key === paletteFilter)?.label.toLowerCase()} questions yet.
                      <button type="button" className="qs-link" onClick={() => setPaletteFilter("ALL")}>
                        Show all questions
                      </button>
                    </>
                  )}
                </li>
              ) : (
                filteredQuestions.map((q) =>
                  renderListItem(
                    q,
                    questions.findIndex((orig) => orig.id === q.id),
                  ),
                )
              )}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <div className="qs-editor">
          {/* Narrow screens: step through questions, or open the full list */}
          {questions.length > 0 && (
            <div className="qs-switcher">
              <button
                type="button"
                className="qs-mini"
                onClick={() => goToQuestion(activeIdx - 1)}
                disabled={activeIdx === 0}
                aria-label="Previous question"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="qs-switcher-open"
                onClick={() => setIsMobilePaletteOpen(true)}
              >
                <Layers size={15} aria-hidden />
                Question <span>{activeIdx + 1} of {questions.length}</span>
                {incompleteCount > 0 && (
                  <span className="qs-tag is-error">{incompleteCount} incomplete</span>
                )}
                <ChevronDown size={14} aria-hidden />
              </button>
              <button
                type="button"
                className="qs-mini"
                onClick={() => goToQuestion(activeIdx + 1)}
                disabled={isLastQuestion}
                aria-label="Next question"
              >
                <ChevronRight size={18} />
              </button>
              {addMenu("end", true)}
            </div>
          )}

          {!questionsReady ? (
            <div className="qs-sheet" aria-busy="true" aria-label="Loading this exam's questions">
              <div className="qs-skeleton-editor" aria-hidden>
                <span className="qs-skel" style={{ width: "28%", height: 22 }} />
                <span className="qs-skel" style={{ width: "100%", height: 110 }} />
                <span className="qs-skel" style={{ width: "100%", height: 42 }} />
                <span className="qs-skel" style={{ width: "100%", height: 52 }} />
                <span className="qs-skel" style={{ width: "100%", height: 52 }} />
              </div>
            </div>
          ) : !activeQuestion ? (
            examLoadError ? (
              <div className="qs-sheet qs-empty" role="alert">
                <span className="qs-empty-icon is-warn">
                  <CloudOff size={24} />
                </span>
                <h2>This exam couldn&apos;t be loaded</h2>
                <p>
                  The CBT service didn&apos;t respond, so its questions aren&apos;t shown. Check the
                  connection and try again. You can also start writing here; it stays on this computer
                  until you save while online.
                </p>
                <div className="qs-empty-actions">
                  <button
                    type="button"
                    className="cbt-button primary"
                    onClick={() => retryLoadExam()}
                    disabled={isLoadingExam}
                  >
                    {isLoadingExam ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    Try again
                  </button>
                  <button type="button" className="cbt-button" onClick={() => handleAddNewQuestion("MCQ")}>
                    <Plus size={15} />
                    Write a question anyway
                  </button>
                </div>
              </div>
            ) : (
              <div className="qs-sheet qs-empty">
                <span className="qs-empty-icon">
                  <FileQuestion size={24} />
                </span>
                <h2>No questions in this exam yet</h2>
                <p>
                  Write them one by one, import a spreadsheet, or let ParaLearn AI draft a set from your
                  notes for you to check.
                </p>
                <div className="qs-empty-actions">
                  <button type="button" className="cbt-button primary" onClick={() => handleAddNewQuestion("MCQ")}>
                    <Plus size={15} />
                    Write the first question
                  </button>
                  <button type="button" className="cbt-button" onClick={() => setIsBulkOpen(true)}>
                    <Upload size={15} />
                    Import from Excel
                  </button>
                  <button type="button" className="cbt-button" onClick={() => setIsAiModalOpen(true)}>
                    <Sparkles size={15} />
                    Generate with AI
                  </button>
                </div>
                <p className="qs-empty-tip">
                  Tip: press <kbd>{modKey}</kbd> <kbd>Enter</kbd> at the last question to add the next one.
                </p>
              </div>
            )
          ) : (
            <>
              <div className="qs-sheet">
                {/* Heading */}
                <div className="qs-sheet-head">
                  <h2>
                    Question {activeIdx + 1}
                    <span className="qs-of"> of {questions.length}</span>
                  </h2>
                  {!persistedIdSet.has(activeQuestion.id) && (
                    <span className="qs-tag is-new">Not saved yet</span>
                  )}
                  {activeProblem && (
                    <span className="qs-tag is-error">
                      <AlertCircle size={12} aria-hidden />
                      Incomplete
                    </span>
                  )}
                </div>

                {/* Question text first: it's what the examiner came to write */}
                <div className="qs-block is-first">
                  <div className="qs-label-row">
                    <label htmlFor="qs-prompt" className="qs-label">
                      Question text
                    </label>
                    <span className="qs-hint">Candidates see this exactly as written</span>
                  </div>
                  <textarea
                    id="qs-prompt"
                    ref={promptRef}
                    className="qs-textarea"
                    rows={activeQuestion.type === "LONG_ESSAY" ? 6 : 4}
                    value={activeQuestion.prompt}
                    onChange={(e) => updateActiveQuestion("prompt", e.target.value)}
                    placeholder="Type the question, problem or case study…"
                    aria-invalid={activeProblem === "prompt" || undefined}
                    aria-describedby={activeProblem === "prompt" ? "qs-prompt-error" : undefined}
                  />
                  <div className="qs-stem-foot">
                    {activeProblem === "prompt" ? (
                      <span id="qs-prompt-error" className="qs-field-error">
                        <AlertCircle size={13} aria-hidden />
                        Write the question before saving.
                      </span>
                    ) : (
                      <span />
                    )}
                    <span>
                      {promptWords} {promptWords === 1 ? "word" : "words"}
                    </span>
                  </div>

                  <div className="qs-fields">
                    <label className="qs-field">
                      <span className="qs-label">Type</span>
                      <select
                        className="qs-control"
                        value={activeQuestion.type}
                        onChange={(e) =>
                          handleChangeQuestionType(e.target.value as StudioQuestion["type"])
                        }
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="qs-field">
                      <span className="qs-label">Section</span>
                      <input
                        className="qs-control"
                        list="qs-section-suggestions"
                        value={activeQuestion.section || ""}
                        onChange={(e) => updateActiveQuestion("section", e.target.value)}
                        placeholder="e.g. Section A: Multiple Choice"
                      />
                      <datalist id="qs-section-suggestions">
                        <option value="Section A: Multiple Choice" />
                        <option value="Section B: Short Answers" />
                        <option value="Section C: Long Essay" />
                      </datalist>
                    </label>
                    <label className="qs-field">
                      <span className="qs-label">Marks</span>
                      <span className="qs-unit">
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          className="qs-control is-num"
                          value={activeQuestion.marks}
                          onChange={(e) =>
                            updateActiveQuestion("marks", parseFloat(e.target.value) || 1)
                          }
                        />
                        <span>marks</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Objective: answer choices */}
                {isObjective(activeQuestion.type) && (
                  <section className="qs-block" aria-labelledby="qs-choices-title">
                    <div className="qs-block-title">
                      <div>
                        <h3 id="qs-choices-title">Answer choices</h3>
                        <p>
                          {activeQuestion.type === "MULTI_SELECT"
                            ? "Select the letter of every correct answer."
                            : activeQuestion.type === "TRUE_FALSE"
                              ? "Select the letter of the correct answer."
                              : "Select the letter of the correct answer. Enter moves to the next option."}
                        </p>
                      </div>
                      {activeQuestion.type !== "TRUE_FALSE" && (
                        <button
                          type="button"
                          className="cbt-button"
                          onClick={() => {
                            addChoice();
                            focusOption(activeQuestion.options?.length || 0);
                          }}
                          disabled={(activeQuestion.options?.length || 0) >= 6}
                          title={(activeQuestion.options?.length || 0) >= 6 ? "Six options is the most allowed" : undefined}
                        >
                          <Plus size={14} />
                          Add option
                        </button>
                      )}
                    </div>
                    <div className="qs-options">
                      {activeQuestion.options?.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const emptyError = activeProblem === "options" && !opt.text.trim();
                        return (
                          <div
                            key={opt.id}
                            className={`qs-option ${opt.isCorrect ? "is-correct" : ""} ${emptyError ? "is-invalid" : ""}`}
                          >
                            <button
                              type="button"
                              className="qs-option-key"
                              onClick={() => setCorrectChoice(optIdx)}
                              aria-pressed={opt.isCorrect}
                              aria-label={
                                opt.isCorrect
                                  ? `Option ${letter} is correct`
                                  : `Mark option ${letter} as correct`
                              }
                              title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                            >
                              {opt.isCorrect ? <Check size={15} strokeWidth={3} /> : letter}
                            </button>
                            <input
                              ref={(el) => {
                                optionRefs.current[optIdx] = el;
                              }}
                              className="qs-control"
                              value={opt.text}
                              onChange={(e) => updateOptionText(optIdx, e.target.value)}
                              onKeyDown={(e) => {
                                if (
                                  e.key !== "Enter" ||
                                  e.shiftKey ||
                                  e.ctrlKey ||
                                  e.metaKey ||
                                  e.nativeEvent.isComposing
                                )
                                  return;
                                e.preventDefault();
                                const count = activeQuestion.options?.length || 0;
                                if (optIdx < count - 1) optionRefs.current[optIdx + 1]?.focus();
                                else if (activeQuestion.type !== "TRUE_FALSE" && count < 6) {
                                  addChoice();
                                  focusOption(optIdx + 1);
                                }
                              }}
                              placeholder={`Option ${letter}`}
                              aria-label={`Option ${letter} text`}
                              aria-invalid={emptyError || undefined}
                              readOnly={activeQuestion.type === "TRUE_FALSE"}
                            />
                            {opt.isCorrect && <span className="qs-correct-label">Correct</span>}
                            {activeQuestion.type !== "TRUE_FALSE" && (
                              <button
                                type="button"
                                className="qs-mini is-danger"
                                onClick={() => deleteChoice(optIdx)}
                                aria-label={`Remove option ${letter}`}
                                title="Remove option"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {activeProblem === "options" && (
                      <p className="qs-field-error" style={{ marginTop: 8 }}>
                        <AlertCircle size={13} aria-hidden />
                        Fill in every option, or remove the empty ones.
                      </p>
                    )}
                  </section>
                )}

                {/* Essays: expected answer, model answer, rubric */}
                {isEssay && (
                  <section className="qs-block" aria-labelledby="qs-length-title">
                    <div className="qs-block-title">
                      <div>
                        <h3 id="qs-length-title">Expected answer</h3>
                        <p>Candidates see the word range while they write.</p>
                      </div>
                    </div>
                    <div className="qs-pair">
                      <label className="qs-field">
                        <span className="qs-label">Fewest words</span>
                        <span className="qs-unit">
                          <input
                            type="number"
                            min={activeQuestion.type === "LONG_ESSAY" ? 50 : 5}
                            className="qs-control is-num"
                            value={activeQuestion.minWords || minWordsDefault}
                            onChange={(e) =>
                              updateActiveQuestion("minWords", parseInt(e.target.value, 10) || minWordsDefault)
                            }
                          />
                          <span>words</span>
                        </span>
                      </label>
                      <label className="qs-field">
                        <span className="qs-label">Most words</span>
                        <span className="qs-unit">
                          <input
                            type="number"
                            min={activeQuestion.type === "LONG_ESSAY" ? 100 : 20}
                            className="qs-control is-num"
                            value={activeQuestion.maxWords || maxWordsDefault}
                            onChange={(e) =>
                              updateActiveQuestion("maxWords", parseInt(e.target.value, 10) || maxWordsDefault)
                            }
                          />
                          <span>words</span>
                        </span>
                      </label>
                    </div>
                    {activeQuestion.type === "SHORT_ESSAY" && (
                      <label className="qs-field" style={{ marginTop: 14 }}>
                        <span className="qs-label">Key terms the answer should use</span>
                        <input
                          className="qs-control"
                          value={activeQuestion.keyTerms?.join(", ") || ""}
                          onChange={(e) => {
                            const terms = e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean);
                            updateActiveQuestion("keyTerms", terms);
                          }}
                          placeholder="Separate with commas, e.g. Chloroplasts, Stomata, ATP"
                        />
                      </label>
                    )}
                    <label className="qs-field" style={{ marginTop: 14 }}>
                      <span className="qs-label">Model answer</span>
                      <span className="qs-hint">What ParaLearn AI and examiners mark against.</span>
                      <textarea
                        className="qs-textarea"
                        rows={activeQuestion.type === "LONG_ESSAY" ? 6 : 4}
                        value={activeQuestion.modelAnswer || ""}
                        onChange={(e) => updateActiveQuestion("modelAnswer", e.target.value)}
                        placeholder={
                          activeQuestion.type === "LONG_ESSAY"
                            ? "Outline the expected argument: main points, working, evidence and conclusion…"
                            : "e.g. Photosynthesis is the process by which green plants turn light energy into chemical energy…"
                        }
                      />
                    </label>
                  </section>
                )}

                {isEssay && (
                  <section className="qs-block" aria-labelledby="qs-rubric-title">
                    <div className="qs-block-title">
                      <div>
                        <h3 id="qs-rubric-title">
                          {activeQuestion.rubric?.name || "Marking rubric"}
                        </h3>
                        <p>
                          {activeQuestion.rubric
                            ? `${activeQuestion.rubric.criteria?.length || 0} criteria`
                            : "Optional. Mark this answer by criteria instead of a single score."}
                        </p>
                      </div>
                      <button type="button" className="cbt-button" onClick={() => setIsRubricModalOpen(true)}>
                        <Award size={14} />
                        {activeQuestion.rubric ? "Change rubric" : "Attach rubric"}
                      </button>
                    </div>
                    {activeQuestion.rubric?.criteria && activeQuestion.rubric.criteria.length > 0 && (
                      <>
                        <p
                          className={`qs-rubric-check ${
                            criteriaTotal === activeQuestion.marks ? "is-even" : "is-off"
                          }`}
                          role="status"
                        >
                          {criteriaTotal === activeQuestion.marks ? (
                            <CheckCircle2 size={15} aria-hidden />
                          ) : (
                            <AlertCircle size={15} aria-hidden />
                          )}
                          <span>
                            Criteria add up to{" "}
                            <strong>
                              {criteriaTotal} of {activeQuestion.marks}
                            </strong>{" "}
                            marks.{" "}
                            {criteriaTotal === activeQuestion.marks
                              ? "That matches the question."
                              : criteriaTotal > activeQuestion.marks
                                ? `That's ${criteriaTotal - activeQuestion.marks} more than the question is worth.`
                                : `That's ${activeQuestion.marks - criteriaTotal} short of what the question is worth.`}
                          </span>
                        </p>
                        <ol className="qs-criteria">
                          {activeQuestion.rubric.criteria.map((crit, cIdx) => (
                            <li key={crit.id || cIdx} className="qs-criterion">
                              <div className="qs-criterion-top">
                                <span>
                                  {cIdx + 1}. {crit.title}
                                </span>
                                <span className="qs-criterion-marks">
                                  {crit.maxMarks} {Number(crit.maxMarks) === 1 ? "mark" : "marks"}
                                </span>
                              </div>
                              {crit.description && <p>{crit.description}</p>}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </section>
                )}

                {/* Explanation shown after review */}
                <section className="qs-block" aria-labelledby="qs-explain-title">
                  <div className="qs-block-title">
                    <div>
                      <h3 id="qs-explain-title">
                        Explanation <span className="qs-optional">Optional</span>
                      </h3>
                      <p>Shown to candidates when they review the exam.</p>
                    </div>
                  </div>
                  <textarea
                    className="qs-textarea"
                    rows={2}
                    value={activeQuestion.explanation || ""}
                    onChange={(e) => updateActiveQuestion("explanation", e.target.value)}
                    aria-labelledby="qs-explain-title"
                    placeholder="e.g. The key formula, the working, and the mistake most candidates make…"
                  />
                </section>
              </div>

              {/* Sticky action bar */}
              <div className="qs-actionbar">
                <div className="qs-save-state" role="status">
                  {isSavingQuestions ? (
                    <span className="is-dirty">
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      Saving…
                    </span>
                  ) : isDirty ? (
                    <span className="is-dirty">
                      <CircleDot size={14} aria-hidden />
                      Not saved yet: kept on this computer
                    </span>
                  ) : (
                    <span className="is-saved">
                      <CheckCircle2 size={14} aria-hidden />
                      All changes saved
                    </span>
                  )}
                  <span className="qs-keys" aria-hidden>
                    <kbd>{modKey}</kbd>
                    <kbd>S</kbd> save
                    <kbd>{modKey}</kbd>
                    <kbd>Enter</kbd> next
                  </span>
                </div>
                <div className="qs-actionbar-buttons">
                  <button type="button" className="cbt-button qs-quiet" onClick={handleDuplicateQuestion}>
                    <CopyPlus size={15} />
                    <span className="qs-btn-label">Duplicate</span>
                  </button>
                  <button
                    type="button"
                    className="cbt-button qs-danger"
                    onClick={() => handleDeleteQuestion(activeIdx)}
                    aria-label={`Delete question ${activeIdx + 1}`}
                  >
                    <Trash2 size={15} />
                    <span className="qs-btn-label">Delete</span>
                  </button>
                  <button
                    type="button"
                    className="cbt-button primary qs-next"
                    onClick={advance}
                    title={
                      isLastQuestion
                        ? `Adds a ${typeLabel(activeQuestion.type).toLowerCase()} question in the same section (${modKey}+Enter)`
                        : `${modKey}+Enter`
                    }
                  >
                    {isLastQuestion ? (
                      <>
                        <Plus size={15} />
                        Add next question
                      </>
                    ) : (
                      <>
                        Next question
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SETTINGS DRAWER ──────────────────────────────────────────────── */}
      <CbtExamSettingsSheet
        exam={serviceExam}
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      {/* ── BULK UPLOAD DIALOG ───────────────────────────────────────────── */}
      <CbtBulkImportDialog
        open={isBulkOpen}
        onOpenChange={setIsBulkOpen}
        onImport={handleImportAiQuestions}
      />

      {/* ── QUESTION LIST SHEET (small screens) ──────────────────────────── */}
      <Sheet open={isMobilePaletteOpen} onOpenChange={setIsMobilePaletteOpen}>
        <SheetContent
          side="bottom"
          className="cbt-dialog h-[80vh] bg-white border-t border-[var(--border-fine)] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="p-4 border-b border-[var(--border-fine)] flex flex-row items-center justify-between shrink-0">
            <div>
              <SheetTitle className="text-base font-bold text-[var(--foreground)]">
                Questions ({questions.length})
              </SheetTitle>
              <SheetDescription className="text-xs text-[var(--text-secondary)] font-mono">
                {totalMarks} marks allocated
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5 pr-6">{addMenu("end")}</div>
          </SheetHeader>
          <ul className="qs-items" style={{ background: "transparent" }}>
            {questions.length === 0 ? (
              <li className="qs-list-empty">No questions yet. Use Add to write the first one.</li>
            ) : (
              questions.map((q, idx) => renderListItem(q, idx, true))
            )}
          </ul>
        </SheetContent>
      </Sheet>

      {/* ── PARALEARN AI QUESTION GENERATION MODAL ───────────────────────── */}
      <CbtAiQuestionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        examTitle={examTitle}
        onImportQuestions={handleImportAiQuestions}
      />

      {/* ── CUSTOM RUBRIC UPLOAD & TEMPLATE MODAL ────────────────────────── */}
      <CbtRubricUploadModal
        isOpen={isRubricModalOpen}
        onClose={() => setIsRubricModalOpen(false)}
        examId={examId}
        targetQuestionId={activeQuestion?.id}
        questionTotalMarks={activeQuestion?.marks}
        onApplyRubric={handleApplyRubric}
      />
    </div>
  );
}
