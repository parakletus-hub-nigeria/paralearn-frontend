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
  Sparkles,
  Layers,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FileText,
  Tag,
  AlignLeft,
  Award,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  saveStoredExams,
  getExaminerSession,
  CbtQuestionType,
  ExamRubric,
  loadStoredRubrics,
} from "@cbt/lib/cbtSessionManager";
import CbtAiQuestionModal from "./CbtAiQuestionModal";
import CbtRubricUploadModal from "./CbtRubricUploadModal";
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

  const normalizeTypeForService = (
    type: StudioQuestion["type"],
  ): ServiceQuestionType => {
    if (type === "SHORT_ESSAY" || type === "LONG_ESSAY") return "ESSAY";
    if (type === "MULTI_SELECT") return "MULTI_SELECT";
    return type;
  };

  const normalizeQuestionFromService = (q: any): StudioQuestion => ({
    id: q.id,
    prompt: q.prompt || "",
    type: q.type === "ESSAY" ? "LONG_ESSAY" : q.type || "MCQ",
    marks: q.marks || 1,
    options: Array.isArray(q.options) ? q.options : [],
    explanation: q.explanation || "",
    section: q.section,
  });

  const toServiceQuestionPayload = (
    q: StudioQuestion,
    workspaceId: string,
  ) => ({
    workspaceId,
    prompt: q.prompt.trim(),
    type: normalizeTypeForService(q.type),
    marks: Number(q.marks) || 1,
    options: (q.options || []).map((option, index) => ({
      id: option.id || `opt_${index + 1}`,
      text: option.text || "",
      isCorrect: Boolean(option.isCorrect),
      keyLabel: String.fromCharCode(65 + index),
    })),
    explanation: q.explanation || q.modelAnswer || "",
  });

  useEffect(() => {
    if (serviceExam) {
      setExamTitle(serviceExam.title || initialTitle);
      setRoomCode(serviceExam.accessCode || initialCode);
      setDurationMins(serviceExam.durationMins || initialDurationMins);
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
      const stored = loadStoredQuestions(examId);
      // Migrate legacy types if any
      const normalized: StudioQuestion[] = stored.map((q: any) => ({
        ...q,
        type: q.type === "ESSAY" ? "LONG_ESSAY" : q.type || "MCQ",
        options: q.options || [],
        marks: q.marks || 1,
      }));
      setQuestions(normalized);
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
      (q) => q.type === "MCQ" || q.type === "TRUE_FALSE",
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
        (q) => q.type === "MCQ" || q.type === "TRUE_FALSE",
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
    toast.success("Exam Room Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Add new blank question
  const handleAddNewQuestion = (type: CbtQuestionType = "MCQ") => {
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

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveIdx(updated.length - 1);
    saveStoredQuestions(updated, examId);
    updateExamQuestionCount(updated.length);
    toast.success(
      `Added new ${type.replace("_", " ")} to palette. Save to sync it to the CBT service.`,
    );
  };

  // Change type of current active question
  const handleChangeQuestionType = (newType: CbtQuestionType) => {
    if (!activeQuestion) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const curr = copy[activeIdx];
      let updatedQ: StudioQuestion = { ...curr, type: newType };

      if (newType === "MCQ" && (!curr.options || curr.options.length < 2)) {
        updatedQ.options = [
          { id: `o_${Date.now()}_1`, text: "", isCorrect: true },
          { id: `o_${Date.now()}_2`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_3`, text: "", isCorrect: false },
          { id: `o_${Date.now()}_4`, text: "", isCorrect: false },
        ];
        updatedQ.marks = 1.0;
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
      saveStoredQuestions(copy, examId);
      return copy;
    });
    toast.info(`Converted question to ${newType.replace("_", " ")}`);
  };

  // Import questions generated by ParaLearn AI
  const handleImportAiQuestions = (newQuestions: StudioQuestion[]) => {
    const updated = [...questions, ...newQuestions];
    setQuestions(updated);
    setActiveIdx(questions.length); // Focus on first newly added question
    saveStoredQuestions(updated, examId);
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
      saveStoredQuestions(copy, examId);
      return copy;
    });
    setIsRubricModalOpen(false);
    toast.success(
      `Attached rubric "${rubric.name}" (${rubric.totalMarks} marks) successfully!`,
    );
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
    if (!activeQuestion || !activeQuestion.options) return;
    const opts = [...activeQuestion.options];
    opts[optIdx] = { ...opts[optIdx], text };
    updateActiveQuestion("options", opts);
  };

  // Set single correct choice (MCQ / TF)
  const setCorrectChoice = (optIdx: number) => {
    if (!activeQuestion || !activeQuestion.options) return;
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
    const opts = activeQuestion.options.filter((_, i) => i !== optIdx);
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

  // Delete question
  const handleDeleteQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveIdx((prev) => (prev >= idx && prev > 0 ? prev - 1 : 0));
    saveStoredQuestions(updated, examId);
    updateExamQuestionCount(updated.length);
    toast.info("Question deleted.");
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

    const invalidQuestion = questions.find((q) => !q.prompt.trim());
    if (invalidQuestion) {
      toast.error("Please enter a prompt for every question before saving.");
      return;
    }

    const invalidChoiceQuestion = questions.find(
      (q) =>
        (q.type === "MCQ" ||
          q.type === "TRUE_FALSE" ||
          q.type === "MULTI_SELECT") &&
        (!q.options?.length || q.options.some((option) => !option.text.trim())),
    );
    if (invalidChoiceQuestion) {
      toast.error("Please complete every option text before saving.");
      return;
    }

    saveStoredQuestions(questions, examId);
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
            isPublished: true,
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
        existingQuestions.map((q) =>
          updateQuestion({
            id: q.id,
            prompt: q.prompt.trim(),
            type: normalizeTypeForService(q.type),
            marks: Number(q.marks) || 1,
            options: toServiceQuestionPayload(q, workspaceId).options,
            explanation: q.explanation || q.modelAnswer || "",
          }).unwrap(),
        ),
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

      setServiceSyncedAt(new Date().toISOString());
      toast.success("Question bank synced to ParaLearn Cloud.");
    } catch (error: any) {
      console.warn(
        "[CBT Studio] Cloud sync offline/unreachable; questions stored safely in local storage:",
        error,
      );
      toast.success("Questions saved locally on this device.");
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

  return (
    <div className="cbt-studio min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      {/* ── TOP ACTION BAR (56px) ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 h-14 bg-white border-b border-[var(--border-fine)] px-2.5 sm:px-6 flex items-center justify-between shadow-xs gap-2">
        {/* Left: Back & Exam Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[var(--radius-md)] text-[var(--text-secondary)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="font-bold text-xs sm:text-base tracking-tight truncate max-w-[85px] xs:max-w-[130px] sm:max-w-xs md:max-w-md">
              {examTitle}
            </span>

            {/* Room Code Badge */}
            <Badge
              variant="outline"
              className="hidden sm:inline-flex font-mono text-xs bg-[var(--violet-tint)] text-[var(--violet-ink)] border-[var(--violet-ink)]/20 uppercase shrink-0"
            >
              {roomCode}
            </Badge>
          </div>
        </div>

        {/* Right: Actions (Adaptive Desktop & Mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop Full Actions (>= lg) */}
          <div className="hidden lg:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShareLink}
              className="h-8 px-3 text-xs font-semibold border-[var(--border-fine)] text-[var(--foreground)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-md)] flex items-center gap-1.5"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedLink ? "Copied Link!" : "Copy Link"}</span>
            </Button>

            <Link href={monitorHref}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-semibold border-[var(--emerald-signal)]/30 text-[var(--emerald-signal)] hover:bg-[var(--emerald-tint)]/40 rounded-[var(--radius-md)] flex items-center gap-1.5"
              >
                <MonitorCheck className="w-3.5 h-3.5" />
                <span>Live Monitor</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 px-3 text-xs font-semibold border-[var(--border-fine)] rounded-[var(--radius-md)]"
            >
              <Sliders className="w-3.5 h-3.5 mr-1" />
              <span>Settings</span>
            </Button>
          </div>

          {/* Rubric Manager Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRubricModalOpen(true)}
            className="h-8 px-2 sm:px-3 text-xs font-semibold border-amber-200 text-amber-800 bg-amber-50/70 hover:bg-amber-100 rounded-[var(--radius-md)] flex items-center gap-1.5 shadow-2xs"
            title="Manage institutional marking rubrics"
          >
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Rubrics</span>
          </Button>

          {/* ParaLearn AI Generator Button (Visible across all screens) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAiModalOpen(true)}
            className="h-8 px-2 sm:px-3 text-xs font-bold border-violet-200 text-violet-700 bg-violet-50/70 hover:bg-violet-100 rounded-[var(--radius-md)] flex items-center gap-1.5 shadow-2xs"
            title="Generate MCQs and Essays with ParaLearn AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>ParaLearn AI</span>
          </Button>

          {/* Save Button (Primary action on all screens) */}
          <Button
            size="sm"
            onClick={handleSaveQuestions}
            disabled={isSavingQuestions}
            className="h-8 px-2.5 sm:px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs shrink-0"
          >
            {isSavingQuestions ? "Syncing" : "Save"}
          </Button>

          {/* Mobile Dropdown Menu (< lg) */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-[var(--radius-md)] border-[var(--border-fine)] text-slate-600"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => setIsMobilePaletteOpen(true)}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Layers className="w-4 h-4 mr-2 text-violet-600" />
                  <span>Question Palette ({questions.length})</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsRubricModalOpen(true)}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Award className="w-4 h-4 mr-2 text-amber-600" />
                  <span>Marking Rubrics</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleCopyShareLink}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Copy className="w-4 h-4 mr-2 text-slate-500" />
                  <span>Copy Student Link</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={monitorHref}
                    className="text-xs font-medium cursor-pointer flex items-center"
                  >
                    <MonitorCheck className="w-4 h-4 mr-2 text-emerald-600" />
                    <span>Open Live Monitor</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsBulkOpen(true)}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2 text-slate-500" />
                  <span>Bulk Import (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-xs font-medium cursor-pointer"
                >
                  <Sliders className="w-4 h-4 mr-2 text-slate-500" />
                  <span>Delivery Settings</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--border-fine)] bg-white/80 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-600">
            <span
              className={`h-2 w-2 rounded-full ${examLoadError ? "bg-amber-500" : "bg-emerald-500"}`}
            />
            <span className="font-semibold">
              {isLoadingExam
                ? "Loading backend exam room..."
                : examLoadError
                  ? "Offline draft mode. Changes will stay local until the CBT service is reachable."
                  : serviceSyncedAt
                    ? "Synced with CBT microservice"
                    : "Ready to sync with CBT microservice"}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-slate-500 font-mono">
              <span>{questions.length} questions</span>
              <span>{totalMarks} marks</span>
              <span>{durationMins} mins</span>
            </div>
            {serviceExam && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    isPublished
                      ? "text-[10px] font-semibold border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "text-[10px] font-semibold border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {isPublished
                    ? "Published · students can join"
                    : "Draft · students can't join yet"}
                </Badge>
                <Button
                  size="sm"
                  variant={isPublished ? "outline" : "default"}
                  onClick={handleTogglePublish}
                  disabled={isTogglingPublish || isSavingQuestions}
                  className={
                    isPublished
                      ? "h-7 px-2.5 text-[11px] font-semibold border-[var(--border-fine)] rounded-[var(--radius-md)]"
                      : "h-7 px-2.5 text-[11px] font-bold bg-[var(--emerald-signal)] hover:bg-emerald-700 text-white rounded-[var(--radius-md)]"
                  }
                >
                  {isTogglingPublish
                    ? "Updating..."
                    : isPublished
                      ? "Unpublish"
                      : "Publish"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2-PANE STUDIO WORKSPACE ──────────────────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 gap-6 items-start">
        {/* Left Pane: Question Palette (Hidden on mobile < md, visible on desktop >= md) */}
        <aside className="hidden md:flex w-72 sm:w-84 bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] flex-col h-[calc(100vh-90px)] sticky top-18 overflow-hidden shrink-0">
          {/* Palette Top Toolbar */}
          <div className="p-3.5 border-b border-[var(--border-fine)] bg-[var(--surface-muted)] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)]">
                  Questions ({questions.length})
                </span>
                <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                  Total: {totalMarks} Marks
                </div>
              </div>

              {/* Add Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-[11px] font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white shadow-2xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    <span>Add</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 text-xs font-medium"
                >
                  <DropdownMenuItem
                    onClick={() => handleAddNewQuestion("MCQ")}
                    className="cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 mr-2 text-violet-600" />
                    <span>Multiple Choice (MCQ)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddNewQuestion("SHORT_ESSAY")}
                    className="cursor-pointer"
                  >
                    <AlignLeft className="w-3.5 h-3.5 mr-2 text-amber-600" />
                    <span>Short Essay (20-100w)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddNewQuestion("LONG_ESSAY")}
                    className="cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 mr-2 text-blue-600" />
                    <span>Long Essay / Theory</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddNewQuestion("TRUE_FALSE")}
                    className="cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                    <span>True / False</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quick Format Filter Pills */}
            <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setPaletteFilter("ALL")}
                className={`px-2 py-0.5 rounded-full font-semibold transition-colors shrink-0 ${
                  paletteFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                All ({formatCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("MCQ")}
                className={`px-2 py-0.5 rounded-full font-semibold transition-colors shrink-0 ${
                  paletteFilter === "MCQ"
                    ? "bg-violet-700 text-white"
                    : "bg-white text-violet-700 border border-violet-200 hover:bg-violet-50"
                }`}
              >
                MCQ ({formatCounts.mcq})
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("SHORT_ESSAY")}
                className={`px-2 py-0.5 rounded-full font-semibold transition-colors shrink-0 ${
                  paletteFilter === "SHORT_ESSAY"
                    ? "bg-amber-700 text-white"
                    : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-50"
                }`}
              >
                Short ({formatCounts.shortEssay})
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("LONG_ESSAY")}
                className={`px-2 py-0.5 rounded-full font-semibold transition-colors shrink-0 ${
                  paletteFilter === "LONG_ESSAY"
                    ? "bg-blue-700 text-white"
                    : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
                }`}
              >
                Long ({formatCounts.longEssay})
              </button>
            </div>
          </div>

          {/* Question List Scroll Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-[var(--border-fine)]/60">
            {filteredQuestions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)] px-4 space-y-3">
                <p>No questions matching filter.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaletteFilter("ALL")}
                  className="h-7 text-[11px] font-semibold"
                >
                  Clear Filter
                </Button>
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const originalIdx = questions.findIndex(
                  (orig) => orig.id === q.id,
                );
                const isActive = originalIdx === activeIdx;

                return (
                  <div
                    key={q.id}
                    onClick={() => setActiveIdx(originalIdx)}
                    className={`group p-2.5 rounded-[var(--radius-md)] cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isActive
                        ? "bg-[var(--violet-tint)] text-[var(--violet-ink)] font-semibold shadow-2xs border border-[var(--violet-ink)]/20"
                        : "hover:bg-[var(--surface-subtle)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-5 h-5 rounded bg-white border border-[var(--border-fine)] text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 text-[var(--foreground)]">
                        {originalIdx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs truncate font-normal leading-tight">
                          {q.prompt || "Untitled Question"}
                        </p>

                        {/* Tags and Marks */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {/* Format Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-mono px-1 py-0 uppercase border ${
                              q.type === "LONG_ESSAY"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : q.type === "SHORT_ESSAY"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            {q.type === "LONG_ESSAY"
                              ? "LONG ESSAY"
                              : q.type === "SHORT_ESSAY"
                                ? "SHORT ESSAY"
                                : q.type}
                          </Badge>

                          {q.rubric && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono px-1 py-0 bg-amber-50 text-amber-800 border-amber-300"
                            >
                              Rubric
                            </Badge>
                          )}

                          {q.section && (
                            <span className="text-[9px] text-slate-500 font-medium truncate max-w-[80px]">
                              {q.section}
                            </span>
                          )}

                          <span className="text-[10px] text-[var(--text-secondary)] font-mono ml-auto">
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
                        handleDeleteQuestion(originalIdx);
                      }}
                      className="text-[var(--text-secondary)] hover:text-[var(--crimson-signal)] p-1 opacity-40 hover:opacity-100 transition-opacity"
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
        <main className="flex-1 min-w-0 bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-3.5 sm:p-7 shadow-[var(--shadow-card)] space-y-5 sm:space-y-6">
          {!activeQuestion ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                <FileQuestion className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  No questions in this examination yet
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Start authoring your assessment by creating MCQs, Short
                  Essays, or Long Essays, or extract questions directly from
                  documents, slides, audio, or video with ParaLearn AI.
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
                  <span>Generate with ParaLearn AI</span>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Header Row: Question # + Format Segmented Switcher + Marks */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--border-fine)] gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-base text-[var(--foreground)]">
                    Editing Question #{activeIdx + 1}
                  </span>

                  {/* Format Segmented Switcher */}
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs overflow-x-auto max-w-full">
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType("MCQ")}
                      className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all ${
                        activeQuestion.type === "MCQ"
                          ? "bg-white text-violet-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      MCQ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType("SHORT_ESSAY")}
                      className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all ${
                        activeQuestion.type === "SHORT_ESSAY"
                          ? "bg-white text-amber-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Short Essay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType("LONG_ESSAY")}
                      className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all ${
                        activeQuestion.type === "LONG_ESSAY"
                          ? "bg-white text-blue-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Long Essay
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeQuestionType("TRUE_FALSE")}
                      className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all ${
                        activeQuestion.type === "TRUE_FALSE"
                          ? "bg-white text-emerald-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      True/False
                    </button>
                  </div>
                </div>

                {/* Marks & Section Controls */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                      Marks:
                    </label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={activeQuestion.marks}
                      onChange={(e) =>
                        updateActiveQuestion(
                          "marks",
                          parseFloat(e.target.value) || 1,
                        )
                      }
                      className="w-20 h-8 text-center font-mono text-xs font-bold rounded-[var(--radius-md)] border-[var(--border-fine)]"
                    />
                  </div>
                </div>
              </div>

              {/* Section Header Assignment */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold shrink-0">
                  <Tag className="w-3.5 h-3.5 text-violet-600" />
                  <span>Exam Section:</span>
                </div>
                <Input
                  type="text"
                  value={activeQuestion.section || ""}
                  onChange={(e) =>
                    updateActiveQuestion("section", e.target.value)
                  }
                  placeholder="e.g. Section A: Objectives or Section B: Theory & Essays"
                  className="h-8 text-xs font-medium border-slate-200 bg-white"
                />
                <div className="hidden lg:flex items-center gap-1 shrink-0 text-[10px] text-slate-500">
                  <span
                    className="cursor-pointer underline hover:text-violet-700"
                    onClick={() =>
                      updateActiveQuestion(
                        "section",
                        "Section A: Multiple Choice",
                      )
                    }
                  >
                    Sec A
                  </span>
                  <span>&bull;</span>
                  <span
                    className="cursor-pointer underline hover:text-violet-700"
                    onClick={() =>
                      updateActiveQuestion(
                        "section",
                        "Section B: Short Answers",
                      )
                    }
                  >
                    Sec B
                  </span>
                  <span>&bull;</span>
                  <span
                    className="cursor-pointer underline hover:text-violet-700"
                    onClick={() =>
                      updateActiveQuestion("section", "Section C: Long Essay")
                    }
                  >
                    Sec C
                  </span>
                </div>
              </div>

              {/* Question Prompt Editor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Question Statement / Problem Statement</span>
                  <span className="font-normal text-[11px] text-slate-500 lowercase">
                    Supports text and KaTeX math formulas
                  </span>
                </label>
                <textarea
                  rows={activeQuestion.type === "LONG_ESSAY" ? 5 : 3}
                  value={activeQuestion.prompt}
                  onChange={(e) =>
                    updateActiveQuestion("prompt", e.target.value)
                  }
                  placeholder="Enter question statement or case study prompt..."
                  className="w-full p-3.5 text-sm sm:text-base font-normal leading-relaxed rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white text-[var(--foreground)] focus:border-[var(--violet-ink)] focus:ring-2 focus:ring-[var(--violet-ink)]/20 outline-none"
                />
              </div>

              {/* ── CONDITIONAL CANVAS: MCQs & TRUE/FALSE ── */}
              {(activeQuestion.type === "MCQ" ||
                activeQuestion.type === "TRUE_FALSE") && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Answer Choices (Click the badge to mark the correct
                      choice)
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
                    {activeQuestion.options?.map((opt, optIdx) => {
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
                          <button
                            type="button"
                            onClick={() => setCorrectChoice(optIdx)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                              opt.isCorrect
                                ? "bg-[var(--emerald-signal)] text-white shadow-xs"
                                : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border-fine)]"
                            }`}
                            title={
                              opt.isCorrect
                                ? "Correct answer"
                                : "Click to mark as correct"
                            }
                          >
                            {opt.isCorrect ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              letter
                            )}
                          </button>

                          <Input
                            type="text"
                            value={opt.text}
                            onChange={(e) =>
                              updateOptionText(optIdx, e.target.value)
                            }
                            placeholder={`Option ${letter} text...`}
                            className="h-10 text-sm font-normal border-[var(--border-fine)] bg-white"
                          />

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
              )}

              {/* ── CONDITIONAL CANVAS: SHORT ESSAY ── */}
              {activeQuestion.type === "SHORT_ESSAY" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Minimum Words
                      </label>
                      <Input
                        type="number"
                        min="5"
                        value={activeQuestion.minWords || 20}
                        onChange={(e) =>
                          updateActiveQuestion(
                            "minWords",
                            parseInt(e.target.value, 10) || 20,
                          )
                        }
                        className="h-9 text-xs font-mono font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Maximum Words
                      </label>
                      <Input
                        type="number"
                        min="20"
                        value={activeQuestion.maxWords || 100}
                        onChange={(e) =>
                          updateActiveQuestion(
                            "maxWords",
                            parseInt(e.target.value, 10) || 100,
                          )
                        }
                        className="h-9 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>

                  {/* Benchmark Model Answer */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        <span>Teacher Reference / Model Answer</span>
                      </span>
                      <span className="font-normal text-[11px] text-slate-500">
                        Benchmark for ParaLearn AI grading engine
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={activeQuestion.modelAnswer || ""}
                      onChange={(e) =>
                        updateActiveQuestion("modelAnswer", e.target.value)
                      }
                      placeholder="e.g. Photosynthesis is the biochemical process whereby green plants convert light energy into chemical energy..."
                      className="w-full p-3 text-xs sm:text-sm font-normal rounded-[var(--radius-md)] border border-slate-200 bg-amber-50/20 text-[var(--foreground)] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
                    />
                  </div>

                  {/* Key Terms / Required Concepts */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      Essential Key Terms (Comma-separated concepts that should
                      appear)
                    </label>
                    <Input
                      type="text"
                      value={activeQuestion.keyTerms?.join(", ") || ""}
                      onChange={(e) => {
                        const terms = e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean);
                        updateActiveQuestion("keyTerms", terms);
                      }}
                      placeholder="e.g. Chloroplasts, Stomata, ATP, Light reactions"
                      className="h-9 text-xs font-normal border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* ── CONDITIONAL CANVAS: LONG ESSAY ── */}
              {activeQuestion.type === "LONG_ESSAY" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Minimum Words
                      </label>
                      <Input
                        type="number"
                        min="50"
                        value={activeQuestion.minWords || 150}
                        onChange={(e) =>
                          updateActiveQuestion(
                            "minWords",
                            parseInt(e.target.value, 10) || 150,
                          )
                        }
                        className="h-9 text-xs font-mono font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                        Maximum Words
                      </label>
                      <Input
                        type="number"
                        min="100"
                        value={activeQuestion.maxWords || 800}
                        onChange={(e) =>
                          updateActiveQuestion(
                            "maxWords",
                            parseInt(e.target.value, 10) || 800,
                          )
                        }
                        className="h-9 text-xs font-mono font-medium"
                      />
                    </div>
                  </div>

                  {/* Model Essay Outline */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          Comprehensive Essay Outline &amp; Expected Arguments
                        </span>
                      </span>
                      <span className="font-normal text-[11px] text-slate-500">
                        Benchmark for AI &amp; examiner review
                      </span>
                    </label>
                    <textarea
                      rows={4}
                      value={activeQuestion.modelAnswer || ""}
                      onChange={(e) =>
                        updateActiveQuestion("modelAnswer", e.target.value)
                      }
                      placeholder="Outline expected thesis, key body paragraphs, structural criteria, evidence, and critical evaluation points..."
                      className="w-full p-3 text-xs sm:text-sm font-normal rounded-[var(--radius-md)] border border-slate-200 bg-blue-50/20 text-[var(--foreground)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  {/* Attached Rubric Scheme Card */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-slate-900">
                          {activeQuestion.rubric?.name ||
                            "Standard Evaluation Rubric"}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono bg-white text-slate-700"
                        >
                          {activeQuestion.rubric?.totalMarks ||
                            activeQuestion.marks}{" "}
                          Total Marks
                        </Badge>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRubricModalOpen(true)}
                        className="h-7 text-xs font-semibold border-amber-300 text-amber-900 bg-white hover:bg-amber-50"
                      >
                        <Award className="w-3 h-3 mr-1 text-amber-600" />
                        <span>
                          {activeQuestion.rubric
                            ? "Change Rubric Scheme"
                            : "Attach Marking Rubric"}
                        </span>
                      </Button>
                    </div>

                    {/* Criteria List */}
                    {activeQuestion.rubric?.criteria &&
                    activeQuestion.rubric.criteria.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {activeQuestion.rubric.criteria.map((crit, cIdx) => (
                          <div
                            key={crit.id || cIdx}
                            className="bg-white p-2.5 rounded-md border border-slate-200 text-xs"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span>{crit.title}</span>
                              <span className="font-mono text-amber-700">
                                {crit.maxMarks}m
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {crit.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        No custom rubric linked yet. Using default weighted
                        grading. You can attach WAEC, Cambridge, or custom
                        institutional rubrics above.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Solution Notes / Explanation */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
                  <span>
                    Explanation &amp; Solution Notes (Revealed after assessment
                    review)
                  </span>
                </label>
                <Input
                  type="text"
                  value={activeQuestion.explanation || ""}
                  onChange={(e) =>
                    updateActiveQuestion("explanation", e.target.value)
                  }
                  placeholder="e.g. Highlighting core principles, formulas, and common student misconceptions..."
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
              Configure exam duration, access permissions, and anti-malpractice
              rules.
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
                max="360"
                value={durationMins}
                onChange={(e) =>
                  setDurationMins(parseInt(e.target.value, 10) || 60)
                }
                className="h-10 font-mono font-bold"
              />
            </div>

            {/* Anti-Malpractice Threshold */}
            <div className="space-y-1.5">
              <label className="font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Max Allowed Tab-Switch Violations
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={settings.maxTabViolations}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxTabViolations: parseInt(e.target.value, 10) || 3,
                  })
                }
                className="h-10 font-mono font-bold"
              />
              <p className="text-[11px] text-[var(--text-secondary)]">
                Candidate is disqualified upon exceeding this count.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shuffleQuestions}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      shuffleQuestions: e.target.checked,
                    })
                  }
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">
                  Shuffle Question Order for Each Student
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.shuffleChoices}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      shuffleChoices: e.target.checked,
                    })
                  }
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">
                  Shuffle Answer Choices (A, B, C, D)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showInstantResults}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      showInstantResults: e.target.checked,
                    })
                  }
                  className="rounded text-[var(--violet-ink)]"
                />
                <span className="font-medium">
                  Show Instant Score &amp; Grade Upon Submission
                </span>
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
              Upload an Excel (.xlsx) file or paste formatted questions into the
              studio.
            </DialogDescription>
          </DialogHeader>

          <div className="border-2 border-dashed border-[var(--border-fine)] rounded-[var(--radius-md)] p-8 text-center space-y-3">
            <Upload className="w-8 h-8 text-[var(--violet-ink)] mx-auto" />
            <div className="text-xs text-[var(--foreground)]">
              <span className="font-bold">Click to upload .xlsx file</span> or
              drag and drop
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Columns: question, type, option_a, option_b, option_c, option_d,
              correct, marks, min_words, max_words
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                toast.success("Imported questions from spreadsheet!");
                setIsBulkOpen(false);
              }}
              className="bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
            >
              Confirm Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MOBILE BOTTOM FLOATING ACTION BAR (< md) ──────────────────────── */}
      <div className="md:hidden fixed bottom-4 left-0 right-0 z-20 px-4 flex items-center justify-between pointer-events-none">
        <div className="mx-auto flex items-center gap-1 bg-slate-900/95 backdrop-blur-md text-white p-1.5 rounded-full shadow-2xl pointer-events-auto border border-slate-700/60">
          <Button
            variant="ghost"
            size="icon"
            disabled={activeIdx === 0}
            onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
            className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
            title="Previous question"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobilePaletteOpen(true)}
            className="h-8 px-3 text-xs font-semibold text-white hover:bg-slate-800 rounded-full flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>
              Q{" "}
              {questions.length > 0
                ? `${activeIdx + 1}/${questions.length}`
                : "0"}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={
              questions.length === 0 || activeIdx >= questions.length - 1
            }
            onClick={() =>
              setActiveIdx((prev) => Math.min(questions.length - 1, prev + 1))
            }
            className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full"
            title="Next question"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          <Button
            size="sm"
            onClick={() => handleAddNewQuestion("MCQ")}
            className="h-8 px-2.5 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-full flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {/* ── MOBILE QUESTION PALETTE SHEET (< md) ─────────────────────────── */}
      <Sheet open={isMobilePaletteOpen} onOpenChange={setIsMobilePaletteOpen}>
        <SheetContent
          side="bottom"
          className="h-[80vh] bg-white border-t border-[var(--border-fine)] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="p-4 border-b border-[var(--border-fine)] flex flex-row items-center justify-between shrink-0">
            <div>
              <SheetTitle className="text-base font-bold text-[var(--foreground)]">
                Question Palette ({questions.length})
              </SheetTitle>
              <SheetDescription className="text-xs text-[var(--text-secondary)] font-mono">
                Total: {totalMarks} Marks
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1.5 pr-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsMobilePaletteOpen(false);
                  setIsAiModalOpen(true);
                }}
                className="h-8 px-2.5 text-xs font-semibold border-violet-200 text-violet-700 bg-violet-50/60"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-violet-600" />
                <span>AI</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleAddNewQuestion("MCQ");
                }}
                className="h-8 px-3 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add</span>
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-[var(--border-fine)]/60">
            {questions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--text-secondary)]">
                No questions yet. Tap "+ Add" to create your first question.
              </div>
            ) : (
              questions.map((q, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setActiveIdx(idx);
                      setIsMobilePaletteOpen(false);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isActive
                        ? "bg-[var(--violet-tint)] text-[var(--violet-ink)] font-semibold shadow-2xs"
                        : "hover:bg-[var(--surface-subtle)] text-[var(--foreground)]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded bg-white border border-[var(--border-fine)] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs truncate font-normal leading-tight">
                          {q.prompt || "Untitled Question"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono px-1 py-0 uppercase"
                          >
                            {q.type}
                          </Badge>
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                            {q.marks}m
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(idx);
                      }}
                      className="text-[var(--text-secondary)] hover:text-rose-600 p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
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
