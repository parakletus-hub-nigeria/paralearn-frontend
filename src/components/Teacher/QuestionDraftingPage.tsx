"use client";

import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchMyAssessments,
  fetchAssessmentDetail,
  fetchTeacherClasses,
  updateTeacherAssessment,
  publishAssessment,
} from "@/reduxToolKit/teacher/teacherThunks";
import { generateQuestions, GeneratedQuestion } from "@/lib/geminiService";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  History,
  Eye,
  Settings,
  Menu,
  X,
  BookOpen,
  CloudUpload,
  CloudOff,
  Edit3,
  Save,
  Minus,
  Target,
  Wand2,
  ListChecks,
  FileText,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import Link from "next/link";
import { ProductTour } from "@/components/common/ProductTour";
import { cn } from "@/lib/utils";

const logo = "/PL2 (1).svg";

const questionDraftingTourSteps = [
  {
    target: ".drafting-assessment-selector",
    content:
      "Start by selecting an assessment from this dropdown. The Editor will load any existing questions for that assessment, or start a fresh draft for a new one.",
    disableBeacon: true,
  },
  {
    target: ".drafting-question-stack",
    content:
      "This panel lists all questions in your current draft. Click any question to edit it in the center, or click 'New Question' to add a blank one.",
  },
  {
    target: ".drafting-publish-btn",
    content:
      "Once your questions are ready, click 'Publish' to save them to the assessment and make them live for students. Use 'Save Draft' at the bottom to save without publishing.",
  },
];

const toDateTimeLocal = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const getPublishScheduleIssue = (assessment: any) => {
  const startsAt = assessment?.startsAt ? new Date(assessment.startsAt) : null;
  const endsAt = assessment?.endsAt ? new Date(assessment.endsAt) : null;

  if (!startsAt) return "Set a start date before publishing.";
  if (!endsAt) return "Set an end date before publishing.";
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return "Check the assessment dates before publishing.";
  }
  if (endsAt <= startsAt) return "End date must be after start date.";
  if (endsAt <= new Date()) {
    return "This assessment has already ended. Update the dates before publishing.";
  }
  return null;
};

export function QuestionDraftingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentIdFromUrl = searchParams.get("assessmentId");

  const { assessments, teacherClasses, loading } = useSelector((s: RootState) => s.teacher);
  const user = useSelector((s: RootState) => s.user.user);
  const teacherId = (user as any)?.id || (user as any)?.teacherId;

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(assessmentIdFromUrl || "");
  const [loadedAssessmentDetail, setLoadedAssessmentDetail] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [publishDates, setPublishDates] = useState({ startsAt: "", endsAt: "" });

  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHistory, setGeneratedHistory] = useState<{ prompt: string; questions: GeneratedQuestion[] }[]>([]);

  const [draftQuestions, setDraftQuestions] = useState<any[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);

  const [isStackOpen, setIsStackOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isGeneratorExpanded, setIsGeneratorExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAssessments = async () => {
      try {
        if (teacherId && teacherClasses.length === 0) {
          await dispatch(fetchTeacherClasses({ teacherId })).unwrap();
        }

        if (!cancelled) {
          await dispatch(fetchMyAssessments()).unwrap();
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[QuestionDraftingPage] Failed to load assessments:", error);
        }
      }
    };

    loadAssessments();

    return () => {
      cancelled = true;
    };
  }, [dispatch, teacherId, teacherClasses.length]);

  useEffect(() => {
    if (assessmentIdFromUrl) setSelectedAssessmentId(assessmentIdFromUrl);
  }, [assessmentIdFromUrl]);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!selectedAssessmentId) return;
      try {
        const result = await dispatch(fetchAssessmentDetail(selectedAssessmentId)).unwrap();
        setLoadedAssessmentDetail(result || null);
        if (result?.questions && result.questions.length > 0) {
          const transformedQuestions = result.questions.map((q: any, index: number) => ({
            id: Date.now() + index,
            questionText: q.prompt || q.questionText || "",
            questionType: q.type || q.questionType || "MCQ",
            marks: q.marks || 1,
            options: (q.choices || q.options || []).map((opt: any) => ({
              text: opt.text || "",
              isCorrect: opt.isCorrect || false,
            })),
            correctAnswer: q.correctAnswer || "",
            explanation: q.explanation || "",
          }));
          setDraftQuestions(transformedQuestions);
          if (transformedQuestions.length > 0) setActiveQuestionId(transformedQuestions[0].id);
          return;
        }
      } catch (error) {
        // No questions in backend, fallback to localStorage
        setLoadedAssessmentDetail(null);
      }
      try {
        const saved = localStorage.getItem(`draft_questions_${selectedAssessmentId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setDraftQuestions(parsed);
          if (parsed.length > 0) setActiveQuestionId(parsed[0].id);
        } else {
          setDraftQuestions([]);
          setActiveQuestionId(null);
        }
      } catch (storageError) {
        console.warn("localStorage is not available:", storageError);
        toast.error("Local storage is unavailable. Drafts cannot be loaded.");
        setDraftQuestions([]);
        setActiveQuestionId(null);
      }
    };
    loadQuestions();
  }, [selectedAssessmentId, dispatch]);

  useEffect(() => {
    if (draftQuestions.length > 0 && !activeQuestionId) setActiveQuestionId(draftQuestions[0].id);
  }, [draftQuestions, activeQuestionId]);

  useEffect(() => {
    if (selectedAssessmentId && draftQuestions.length > 0) {
      try {
        localStorage.setItem(`draft_questions_${selectedAssessmentId}`, JSON.stringify(draftQuestions));
      } catch (storageError) {
        console.warn("localStorage is not available to save:", storageError);
        toast.error("Local storage is unavailable. Cannot save draft locally.");
      }
    }
  }, [draftQuestions, selectedAssessmentId]);

  const onlineAssessments = useMemo(() => {
    const isOnlineAssessment = (assessment: any) =>
      assessment?.isOnline === true ||
      String(assessment?.assessmentType || assessment?.type || "").toLowerCase() === "online";

    const visibleAssessments = assessments.filter(
      (assessment: any) => isOnlineAssessment(assessment) && assessment.status !== "ended",
    );

    if (
      loadedAssessmentDetail &&
      isOnlineAssessment(loadedAssessmentDetail) &&
      loadedAssessmentDetail.status !== "ended" &&
      !visibleAssessments.some((assessment: any) => assessment.id === loadedAssessmentDetail.id)
    ) {
      return [loadedAssessmentDetail, ...visibleAssessments];
    }

    return visibleAssessments;
  }, [assessments, loadedAssessmentDetail]);
  const selectedAssessment =
    assessments.find((a: any) => a.id === selectedAssessmentId) ||
    (loadedAssessmentDetail?.id === selectedAssessmentId ? loadedAssessmentDetail : null);
  const activeQ = draftQuestions.find((q) => q.id === activeQuestionId) || null;
  const activeIndex = draftQuestions.findIndex((q) => q.id === activeQuestionId);
  const totalMarks = draftQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const completeQuestions = draftQuestions.filter((q) => {
    const hasPrompt = Boolean(q.questionText?.trim());
    const needsOptions = ["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(q.questionType);
    const hasOptions = !needsOptions || ((q.options || []).length >= 2 && (q.options || []).some((opt: any) => opt.isCorrect));
    return hasPrompt && hasOptions;
  }).length;
  const activeQuality = activeQ
    ? [
        {
          label: "Prompt written",
          ok: Boolean(activeQ.questionText?.trim()),
        },
        {
          label: "Answer key set",
          ok:
            !["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(activeQ.questionType) ||
            (activeQ.options || []).some((opt: any) => opt.isCorrect),
        },
        {
          label: "Distractors present",
          ok:
            !["MCQ", "MULTI_SELECT"].includes(activeQ.questionType) ||
            (activeQ.options || []).filter((opt: any) => opt.text?.trim()).length >= 3,
        },
        {
          label: "Explanation added",
          ok: Boolean(activeQ.explanation?.trim()),
        },
      ]
    : [];
  const activeQualityCount = activeQuality.filter((item) => item.ok).length;

  useEffect(() => {
    if (selectedAssessment) {
      setPublishDates({
        startsAt: selectedAssessment.startsAt ? new Date(selectedAssessment.startsAt).toISOString().slice(0, 16) : "",
        endsAt: selectedAssessment.endsAt ? new Date(selectedAssessment.endsAt).toISOString().slice(0, 16) : "",
      });
    }
  }, [selectedAssessment]);

  const handleSave = async (shouldPublish = false) => {
    if (!selectedAssessmentId) return toast.error("Select an assessment first.");
    if (draftQuestions.length === 0) return toast.error("No questions to save");
    setIsSaving(true);
    try {
      const formattedQuestions = draftQuestions.map((q) => {
        const mappedChoices = (q.options || []).map((o: any) => ({ text: o.text, isCorrect: o.isCorrect }));
        return {
          questionText: q.questionText,
          prompt: q.questionText,
          questionType: q.questionType,
          type: q.questionType,
          marks: q.marks || 1,
          options: mappedChoices,
          choices: mappedChoices,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        };
      });
      await dispatch(updateTeacherAssessment({ id: selectedAssessmentId, data: { questions: formattedQuestions } })).unwrap();
      if (shouldPublish) {
        await dispatch(publishAssessment({ assessmentId: selectedAssessmentId, publish: true })).unwrap();
        toast.success("Questions saved and assessment published!");
      } else {
        toast.success("Questions saved successfully!");
      }
      try {
        localStorage.removeItem(`draft_questions_${selectedAssessmentId}`);
      } catch (e) {
        // ignore
      }
      if (shouldPublish) router.replace("/teacher/assessments");
    } catch (error: any) {
      toast.error(error || "Failed to save questions");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishClick = () => {
    if (!selectedAssessmentId) return toast.error("Select an assessment first.");
    if (draftQuestions.length === 0) return toast.error("No questions to save");

    const scheduleIssue = getPublishScheduleIssue(selectedAssessment);
    if (scheduleIssue) {
      const durationMins =
        Number(
          selectedAssessment?.durationMins ??
            selectedAssessment?.durationMinutes ??
            selectedAssessment?.duration ??
            60,
        ) || 60;
      const start = new Date(Date.now() + 5 * 60_000);
      const end = new Date(start.getTime() + durationMins * 60_000);
      setPublishDates({
        startsAt:
          selectedAssessment?.startsAt &&
          new Date(selectedAssessment.startsAt) > new Date()
            ? new Date(selectedAssessment.startsAt).toISOString().slice(0, 16)
            : toDateTimeLocal(start),
        endsAt:
          selectedAssessment?.endsAt && new Date(selectedAssessment.endsAt) > start
            ? new Date(selectedAssessment.endsAt).toISOString().slice(0, 16)
            : toDateTimeLocal(end),
      });
      toast.error(scheduleIssue);
      setShowDateModal(true);
      return;
    }

    handleSave(true);
  };

  const handleConfirmAndPublish = async () => {
    if (!publishDates.startsAt || !publishDates.endsAt) {
      return toast.error("Both start and end dates/times are required.");
    }
    const start = new Date(publishDates.startsAt);
    const end = new Date(publishDates.endsAt);
    if (end <= start) {
      return toast.error("End date must be after start date.");
    }

    setIsSaving(true);
    try {
      const formattedQuestions = draftQuestions.map((q) => {
        const mappedChoices = (q.options || []).map((o: any) => ({ text: o.text, isCorrect: o.isCorrect }));
        return {
          questionText: q.questionText,
          prompt: q.questionText,
          questionType: q.questionType,
          type: q.questionType,
          marks: q.marks || 1,
          options: mappedChoices,
          choices: mappedChoices,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        };
      });

      // 1. Update questions and dates atomically
      await dispatch(
        updateTeacherAssessment({
          id: selectedAssessmentId,
          data: {
            questions: formattedQuestions,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
          },
        })
      ).unwrap();

      // 2. Publish
      await dispatch(
        publishAssessment({ assessmentId: selectedAssessmentId, publish: true })
      ).unwrap();

      toast.success("Assessment scheduled and published successfully!");

      try {
        localStorage.removeItem(`draft_questions_${selectedAssessmentId}`);
      } catch (e) {
        // ignore
      }

      setShowDateModal(false);
      router.replace("/teacher/assessments");
    } catch (error: any) {
      toast.error(error?.message || error || "Failed to publish assessment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selectedAssessmentId) return;
    if (
      !confirm(
        "Are you sure you want to unpublish this assessment? Students will no longer be able to access or start it."
      )
    )
      return;
    setIsSaving(true);
    try {
      await dispatch(
        publishAssessment({ assessmentId: selectedAssessmentId, publish: false })
      ).unwrap();
      toast.success("Assessment unpublished successfully!");
    } catch (err: any) {
      toast.error(err || "Failed to unpublish assessment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAssessmentId) return toast.error("Select an assessment first.");
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    if (!apiKey) return toast.error("API Key missing.");
    if (!prompt.trim()) return toast.error("Enter a prompt.");
    setIsGenerating(true);
    try {
      const contextualPrompt = selectedAssessment
        ? `${prompt}\n\nAssessment context: ${selectedAssessment.title || "Untitled assessment"}`
        : prompt;
      const questions = await generateQuestions(apiKey, contextualPrompt, questionCount, difficulty);
      setGeneratedHistory((prev) => [{ prompt, questions }, ...prev]);
      setIsGeneratorExpanded(true);
      setPrompt("");
      toast.success(`Generated ${questions.length} questions!`);
      setIsAIOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const addQuestionToDraft = (q: GeneratedQuestion) => {
    const newId = Date.now() + Math.random();
    setDraftQuestions((prev) => [...prev, { ...q, id: newId }]);
    setActiveQuestionId(newId);
    toast.success("Question added to draft");
  };

  const addAllQuestionsFromGen = (idx: number) => {
    const gen = generatedHistory[idx];
    if (!gen) return;
    const newQuestions = gen.questions.map((q) => ({ ...q, id: Date.now() + Math.random() }));
    setDraftQuestions((prev) => [...prev, ...newQuestions]);
    setActiveQuestionId(newQuestions[0].id);
    toast.success(`Added ${newQuestions.length} questions`);
  };

  const addManualQuestion = () => {
    if (!selectedAssessmentId) return toast.error("Select an assessment first.");
    const newId = Date.now();
    setDraftQuestions((prev) => [
      ...prev,
      {
        id: newId,
        questionText: "",
        questionType: "MCQ",
        marks: 1,
        options: [
          { text: "Option 1", isCorrect: true },
          { text: "Option 2", isCorrect: false },
          { text: "Option 3", isCorrect: false },
          { text: "Option 4", isCorrect: false },
        ],
      },
    ]);
    setActiveQuestionId(newId);
    if (window.innerWidth < 1024) setIsStackOpen(false);
  };

  const updateDraftQuestion = (id: number, field: string, value: any) => {
    setDraftQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: number, oIdx: number, field: string, value: any) => {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const newOptions = [...q.options];
        newOptions[oIdx] = { ...newOptions[oIdx], [field]: value };
        if (field === "isCorrect" && value === true && q.questionType === "MCQ") {
          newOptions.forEach((o, i) => { if (i !== oIdx) o.isCorrect = false; });
        }
        return { ...q, options: newOptions };
      }),
    );
  };

  const addOption = (qId: number) => {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return { ...q, options: [...(q.options || []), { text: `New Option ${(q.options?.length || 0) + 1}`, isCorrect: false }] };
      }),
    );
  };

  const removeOption = (qId: number, oIdx: number) => {
    setDraftQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const newOptions = [...q.options];
        newOptions.splice(oIdx, 1);
        return { ...q, options: newOptions };
      }),
    );
  };

  const removeQuestion = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDraftQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      if (activeQuestionId === id) setActiveQuestionId(filtered.length > 0 ? filtered[0].id : null);
      return filtered;
    });
  };

  const clearDraft = () => {
    if (confirm("Are you sure you want to clear all questions?")) {
      setDraftQuestions([]);
      setActiveQuestionId(null);
      try {
        localStorage.removeItem(`draft_questions_${selectedAssessmentId}`);
      } catch (e) {
        toast.error("Local storage is unavailable. Could not remove draft.");
      }
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans w-full fixed inset-0 z-50" style={{ background: "var(--surface-muted)", color: "var(--foreground)" }}>
      <ProductTour tourKey="teacher_drafting" steps={questionDraftingTourSteps} />

      {/* Top Navigation */}
      <header className="flex min-h-[76px] items-center justify-between gap-4 px-4 md:px-6 shrink-0 z-10" style={{ background: "var(--chalk-white, #fdfdff)", borderBottom: "1px solid var(--border-fine)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsStackOpen(true)}
            className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center transition-colors"
            style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "white" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--violet-ink)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--foreground-muted)")}
            aria-label="Open question stack"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/teacher/dashboard" className="hidden sm:flex shrink-0 items-center">
            <Image
              src={logo}
              width={930}
              height={479}
              className="h-11 w-auto object-contain"
              alt="ParaLearn"
              priority
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold md:text-lg" style={{ color: "var(--foreground)" }}>
                Question Drafting
              </h1>
              <span className="hidden rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] md:inline-flex" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                Teacher
              </span>
            </div>
            <p className="hidden truncate text-xs md:block" style={{ color: "var(--foreground-muted)" }}>
              {selectedAssessment ? selectedAssessment.title : "Select an online assessment to start authoring questions"}
            </p>
          </div>
        </div>

        <div className="drafting-assessment-selector hidden min-w-[280px] max-w-[420px] flex-1 lg:block">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground-muted)" }}>
            Assessment
          </label>
          <Select value={selectedAssessmentId || undefined} onValueChange={setSelectedAssessmentId}>
            <SelectTrigger className="h-10 w-full bg-white text-sm font-semibold" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
              <SelectValue placeholder={loading ? "Loading assessments..." : "Select assessment"} />
            </SelectTrigger>
            <SelectContent>
              {onlineAssessments.length === 0 ? (
                <SelectItem value="__none" disabled>No online assessments available</SelectItem>
              ) : (
                onlineAssessments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <nav className="hidden md:flex items-center gap-1 h-11 rounded-md p-1" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
            <Link href="/teacher/dashboard" className="flex h-9 items-center px-3 text-sm font-semibold transition-colors" style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-sm)" }}>
              Dashboard
            </Link>
            <span className="flex h-9 items-center px-3 text-sm font-semibold" style={{ color: "var(--violet-ink)", background: "white", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)" }}>
              Draft
            </span>
            <Link href="/teacher/assessments" className="flex h-9 items-center px-3 text-sm font-semibold transition-colors" style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-sm)" }}>
              Assessments
            </Link>
          </nav>
          <div className="hidden md:block h-8 w-px" style={{ background: "var(--border-fine)" }} />
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsAIOpen(true); }}
              className="lg:hidden flex h-10 w-10 items-center justify-center transition-colors"
              style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "white", color: "var(--foreground-muted)" }}
              aria-label="Open question tools"
            >
              <Settings className="h-4 w-4" />
            </button>
            {selectedAssessment?.isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={!selectedAssessmentId || isSaving}
                className="drafting-unpublish-btn flex h-10 items-center gap-2 px-3 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed md:px-4 md:text-sm"
                style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--crimson-signal)", background: "white", color: "var(--crimson-signal)" }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
                <span className="hidden sm:inline">Unpublish</span>
              </button>
            ) : (
              <button
                onClick={handlePublishClick}
                disabled={!selectedAssessmentId || draftQuestions.length === 0 || isSaving}
                className="drafting-publish-btn flex h-10 items-center gap-2 px-3 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed md:px-4 md:text-sm"
                style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "white", color: "var(--foreground)" }}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                <span className="hidden sm:inline">Publish</span>
              </button>
            )}
            {(user as any)?.school?.logoUrl ? (
              <div className="h-9 w-9 rounded-full overflow-hidden" style={{ border: "1px solid var(--border-fine)" }}>
                <img alt="School logo" className="h-full w-full object-cover" src={(user as any).school.logoUrl} />
              </div>
            ) : (
              <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-signal)", border: "1px solid var(--border-fine)" }}>
                {user?.firstName?.charAt(0) || "T"}
              </div>
            )}
          </div>
        </div>

        <div className="drafting-assessment-selector absolute left-4 right-4 top-[82px] z-20 lg:hidden">
          <Select value={selectedAssessmentId || undefined} onValueChange={setSelectedAssessmentId}>
            <SelectTrigger className="h-10 w-full bg-white text-sm font-semibold shadow-sm" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
              <SelectValue placeholder={loading ? "Loading assessments..." : "Select assessment"} />
            </SelectTrigger>
            <SelectContent>
              {onlineAssessments.length === 0 ? (
                <SelectItem value="__none" disabled>No online assessments available</SelectItem>
              ) : (
                onlineAssessments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {(isStackOpen || isAIOpen) && (
          <div
            className="fixed inset-0 z-[40] lg:hidden"
            style={{ background: "rgba(15,23,42,0.3)" }}
            onClick={() => { setIsStackOpen(false); setIsAIOpen(false); }}
          />
        )}

        {/* Left Sidebar: Question Stack */}
        <aside
          className={`drafting-question-stack w-72 flex flex-col shrink-0 lg:relative absolute inset-y-0 left-0 transition-transform duration-300 z-[50] ${isStackOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}
          style={{ background: "white", borderRight: "1px solid var(--border-fine)" }}
        >
          <div className="p-4 flex justify-between items-center sticky top-0 z-10" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
            <h2 className="text-[11px] md:text-xs font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
              Question Stack
            </h2>
            <span className="text-[10px] font-semibold px-2 py-1" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)", borderRadius: "var(--radius-sm)" }}>
              {draftQuestions.length} Total
            </span>
            <button className="lg:hidden ml-2" style={{ color: "var(--foreground-muted)" }} onClick={() => setIsStackOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {draftQuestions.length === 0 ? (
              <div className="mx-2 mt-4 rounded-lg border p-5 text-center text-sm" style={{ borderColor: "var(--border-fine)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                <FileText className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--foreground-muted)" }} />
                <p className="font-semibold" style={{ color: "var(--foreground)" }}>No questions yet</p>
                <p className="mt-1 text-xs leading-5">Add questions one after another. Use the assistant only when it helps.</p>
              </div>
            ) : (
              draftQuestions.map((q, idx) => {
                const isActive = q.id === activeQuestionId;
                const isReady =
                  Boolean(q.questionText?.trim()) &&
                  (!["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(q.questionType) ||
                    (q.options || []).some((opt: any) => opt.isCorrect));
                return (
                  <div
                    key={q.id}
                    onClick={() => { setActiveQuestionId(q.id); if (window.innerWidth < 1024) setIsStackOpen(false); }}
                    className="group relative flex items-start gap-3 p-3 cursor-pointer transition-all"
                    style={{
                      borderRadius: "var(--radius-md)",
                      background: isActive ? "var(--violet-tint)" : "transparent",
                      border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-muted)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div className="font-bold text-sm mt-0.5" style={{ color: isActive ? "var(--violet-ink)" : "var(--foreground-muted)" }}>
                      Q{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm truncate" style={{ fontWeight: isActive ? 600 : 500, color: isActive ? "var(--foreground)" : "var(--foreground-muted)" }}>
                          {q.questionText || "Empty question"}
                        </p>
                        {isReady ? (
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--emerald-signal)" }} />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--amber-signal)" }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 tracking-wide" style={{ borderRadius: "var(--radius-sm)", background: isActive ? "var(--violet-tint)" : "var(--surface-muted)", color: isActive ? "var(--violet-ink)" : "var(--foreground-muted)" }}>
                          {q.questionType}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                          {q.marks} Mark{q.marks !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => removeQuestion(q.id, e)}
                      className="absolute right-2 top-2 p-1.5 transition-colors"
                      style={{ borderRadius: "var(--radius-sm)", color: "var(--foreground-muted)", opacity: isActive ? 1 : 0, border: "none", background: "transparent" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--crimson-tint)"; e.currentTarget.style.color = "var(--crimson-signal)"; (e.currentTarget.closest(".group") as HTMLElement)?.querySelectorAll("button").forEach(b => b.style.opacity = "1"); }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; }}
                      onFocus={() => {}}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4" style={{ background: "var(--surface-muted)", borderTop: "1px solid var(--border-fine)" }}>
            <button
              onClick={addManualQuestion}
              disabled={!selectedAssessmentId}
              className="w-full flex items-center justify-center gap-2 py-2.5 font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}
            >
              <Plus className="w-4 h-4" /> New Question
            </button>
          </div>
        </aside>

        {/* Center Editor */}
        <section
          className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth pt-12 lg:pt-0"
          style={{ background: "white" }}
          onClick={() => { setIsStackOpen(false); setIsAIOpen(false); }}
        >
          {!selectedAssessmentId ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-xl)", color: "var(--violet-ink)" }}>
                <BookOpen className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                Select an assessment
              </h2>
              <p className="mb-6 max-w-md text-sm leading-6" style={{ color: "var(--foreground-muted)" }}>
                Choose the assessment you want to prepare. You can add questions manually, save progress, and publish when it is ready.
              </p>
              <div className="w-full max-w-md text-left">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground-muted)" }}>
                  Online assessment
                </label>
                <Select value={selectedAssessmentId || undefined} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger className="h-11 w-full bg-white text-sm font-semibold" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
                    <SelectValue placeholder={loading ? "Loading assessments..." : "Select assessment"} />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineAssessments.length === 0 ? (
                      <SelectItem value="__none" disabled>No online assessments available</SelectItem>
                    ) : (
                      onlineAssessments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  {[
                    ["1", "Select assessment"],
                    ["2", "Draft questions"],
                    ["3", "Save or publish"],
                  ].map(([step, label]) => (
                    <div key={step} className="flex items-center gap-2 rounded-md border px-3 py-2" style={{ borderColor: "var(--border-fine)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "white", color: "var(--violet-ink)", border: "1px solid var(--border-fine)" }}>{step}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : !activeQ ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-xl)" }}>
                <BookOpen className="h-8 w-8" style={{ color: "var(--foreground-muted)" }} />
              </div>
              <h2 className="mb-2 text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                No questions drafted
              </h2>
              <p className="mb-6 max-w-sm text-sm leading-6" style={{ color: "var(--foreground-muted)" }}>
                Create the first question for this assessment. You can add more from the question list as you go.
              </p>
              <button
                onClick={addManualQuestion}
                className="h-10 px-5 font-semibold text-white"
                style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none" }}
              >
                <Plus className="w-4 h-4 mr-2 inline" /> New Question
              </button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8 lg:py-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--violet-ink)" }}>
                    <Edit3 className="h-4 w-4" />
                    Question {String(activeIndex + 1).padStart(2, "0")}
                  </div>
                  <h2 className="mt-1 text-lg font-bold leading-tight" style={{ color: "var(--foreground)" }}>
                    Draft and verify the item before publishing
                  </h2>
                </div>
                <div className="flex items-center gap-2 lg:hidden">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsStackOpen(true); }}
                    className="h-9 px-3 text-xs font-semibold"
                    style={{ background: "var(--surface-muted)", color: "var(--foreground)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}
                  >
                    Stack
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsAIOpen(true); }}
                    className="h-9 px-3 text-xs font-semibold"
                    style={{ background: "var(--surface-muted)", color: "var(--foreground)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}
                  >
                    <Settings className="mr-1 inline h-3.5 w-3.5" /> Tools
                  </button>
                </div>
              </div>

              <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_260px]">
                <div className="rounded-xl border p-4" style={{ background: "var(--chalk-white, #fdfdff)", borderColor: "var(--border-fine)" }}>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground-muted)" }}>
                    Question prompt
                  </label>
                  <textarea
                    value={activeQ.questionText || ""}
                    onChange={(e) => {
                      updateDraftQuestion(activeQ.id, "questionText", e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    className="m-0 min-h-[112px] w-full resize-none overflow-hidden border-none bg-transparent p-0 text-[17px] font-semibold leading-8 outline-none focus:ring-0"
                    style={{ color: "var(--foreground)" }}
                    placeholder="Write the question students will answer."
                    ref={(textarea) => {
                      if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
                    }}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                    <span>{(activeQ.questionText || "").trim().length} characters</span>
                    <span className="h-1 w-1 rounded-full" style={{ background: "var(--border-fine)" }} />
                    <span>{activeQ.marks || 1} mark{activeQ.marks !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <div className="rounded-xl border p-4" style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)" }}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" style={{ color: "var(--violet-ink)" }} />
                      <h3 className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground)" }}>
                        Review
                      </h3>
                    </div>
                    <span className="text-xs font-bold" style={{ color: activeQualityCount === activeQuality.length ? "var(--emerald-signal)" : "var(--amber-signal)" }}>
                      {activeQualityCount}/{activeQuality.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeQuality.map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs font-medium" style={{ color: item.ok ? "var(--foreground)" : "var(--foreground-muted)" }}>
                        {item.ok ? (
                          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "var(--emerald-signal)" }} />
                        ) : (
                          <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "var(--amber-signal)" }} />
                        )}
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Options Area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground-muted)" }}>
                    Answer options
                  </h3>
                  <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                    Select the defensible correct answer
                  </span>
                </div>

                {["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(activeQ.questionType) ? (
                  <>
                    <div className="flex flex-col gap-2.5">
                      {activeQ.options?.map((opt: any, oIdx: number) => (
                        <div
                          key={oIdx}
                          className="group flex items-start gap-3 p-3 transition-all"
                          style={{
                            borderRadius: "var(--radius-md)",
                            border: opt.isCorrect ? "1px solid var(--emerald-signal)" : "1px solid var(--border-fine)",
                            background: opt.isCorrect ? "var(--emerald-tint)" : "var(--chalk-white, #fdfdff)",
                          }}
                        >
                          <div
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold"
                            style={{
                              borderRadius: "var(--radius-md)",
                              background: opt.isCorrect ? "var(--emerald-signal)" : "var(--surface-muted)",
                              color: opt.isCorrect ? "white" : "var(--foreground-muted)",
                              border: opt.isCorrect ? "none" : "1px solid var(--border-fine)",
                            }}
                          >
                            {String.fromCharCode(65 + oIdx)}
                          </div>

                          <textarea
                            value={opt.text}
                            onChange={(e) => {
                              updateOption(activeQ.id, oIdx, "text", e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            className="m-0 min-h-[30px] flex-1 resize-none overflow-hidden border-none bg-transparent p-0 text-sm leading-7 outline-none focus:ring-0"
                            style={{ color: "var(--foreground)", fontWeight: opt.isCorrect ? 600 : 400 }}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            ref={(textarea) => {
                              if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
                            }}
                          />

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => updateOption(activeQ.id, oIdx, "isCorrect", !opt.isCorrect)}
                              className="h-8 px-2.5 text-xs font-semibold transition-all"
                              style={{
                                borderRadius: "var(--radius-md)",
                                border: `1px solid ${opt.isCorrect ? "var(--emerald-signal)" : "var(--border-fine)"}`,
                                background: opt.isCorrect ? "var(--emerald-signal)" : "white",
                                color: opt.isCorrect ? "white" : "var(--foreground-muted)",
                              }}
                            >
                              {opt.isCorrect ? "Correct" : "Mark"}
                            </button>
                            <button
                              onClick={() => removeOption(activeQ.id, oIdx)}
                              className="flex h-8 w-8 items-center justify-center transition-all"
                              style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "white" }}
                              title="Remove option"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addOption(activeQ.id)}
                      className="mt-2 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold transition-all"
                      style={{ border: "1px dashed var(--border-fine)", borderRadius: "var(--radius-md)", color: "var(--foreground-muted)", background: "var(--surface-muted)" }}
                    >
                      <Plus className="h-4 w-4" />
                      Add option
                    </button>
                  </>
                ) : (
                  <div className="rounded-xl border p-4 text-sm" style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground-muted)" }}>
                    This question type is manually graded. Add a marking guide in the explanation field below.
                  </div>
                )}

                <div className="pt-3">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--foreground-muted)" }}>
                    Explanation or marking guide
                  </label>
                  <Textarea
                    value={activeQ.explanation || ""}
                    onChange={(e) => updateDraftQuestion(activeQ.id, "explanation", e.target.value)}
                    placeholder="Explain why the correct answer is defensible, or write the marking guide for manual grading."
                    className="min-h-[96px] resize-y text-sm leading-6"
                    style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", background: "var(--chalk-white, #fdfdff)", color: "var(--foreground)" }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Panel: Question Tools */}
        <aside
          className={`w-80 flex flex-col shrink-0 overflow-y-auto custom-scrollbar z-[50] transition-transform lg:relative fixed inset-y-0 right-0 ${isAIOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"}`}
          style={{ background: "white", borderLeft: "1px solid var(--border-fine)" }}
        >
          <div className="p-4 flex justify-between items-center sticky top-0 z-10 lg:hidden" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Question Tools</h2>
            <button style={{ color: "var(--foreground-muted)", background: "transparent", border: "none" }} onClick={() => setIsAIOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Draft Summary Section */}
          <div className="p-4 relative" style={{ borderBottom: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="font-bold text-xs md:text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Draft summary</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border px-2 py-2" style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)" }}>
                  <FileText className="mx-auto mb-1 h-4 w-4" style={{ color: "var(--foreground-muted)" }} />
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{draftQuestions.length}</div>
                  <div className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Drafted</div>
                </div>
                <div className="rounded-lg border px-2 py-2" style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)" }}>
                  <CheckCircle className="mx-auto mb-1 h-4 w-4" style={{ color: "var(--emerald-signal)" }} />
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{completeQuestions}</div>
                  <div className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Ready</div>
                </div>
                <div className="rounded-lg border px-2 py-2" style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)" }}>
                  <Target className="mx-auto mb-1 h-4 w-4" style={{ color: "var(--violet-ink)" }} />
                  <div className="text-xs font-bold" style={{ color: "var(--foreground)" }}>{totalMarks}</div>
                  <div className="text-[10px]" style={{ color: "var(--foreground-muted)" }}>Marks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="p-4 relative" style={{ borderBottom: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--foreground-muted)" }} />
              <h3 className="font-bold text-xs md:text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>Question Settings</h3>
            </div>

            {!activeQ ? (
              <div className="text-center py-4">
                <p className="text-[10px] md:text-xs" style={{ color: "var(--foreground-muted)" }}>Select a question to edit settings.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] md:text-[10px] font-bold mb-1.5 uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
                    Question Type
                  </label>
                  <Select value={activeQ?.questionType} onValueChange={(val) => updateDraftQuestion(activeQ.id, "questionType", val)}>
                    <SelectTrigger className="h-9 text-xs font-semibold" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ" className="text-xs">Multiple Choice (Single Answer)</SelectItem>
                      <SelectItem value="MULTI_SELECT" className="text-xs">Multiple Choice (Multiple Answers)</SelectItem>
                      <SelectItem value="TEXT" className="text-xs">Short Answer / Text</SelectItem>
                      <SelectItem value="ESSAY" className="text-xs">Essay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] md:text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
                    Marks Allocation
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center p-1 shadow-sm w-full sm:w-auto" style={{ background: "white", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
                      <button
                        onClick={() => updateDraftQuestion(activeQ.id, "marks", Math.max(1, (activeQ?.marks || 1) - 1))}
                        className="w-12 h-12 md:w-8 md:h-8 flex shrink-0 items-center justify-center transition-colors active:scale-95"
                        style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-md)", border: "none", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-muted)"; e.currentTarget.style.color = "var(--foreground)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; }}
                      >
                        <Minus className="w-6 h-6 md:w-4 md:h-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={activeQ?.marks || 1}
                        onChange={(e) => updateDraftQuestion(activeQ.id, "marks", parseInt(e.target.value) || 1)}
                        className="flex-1 sm:w-16 w-full h-12 md:h-8 border-none bg-transparent text-center font-black text-xl md:text-sm focus:ring-0 p-0 outline-none"
                        style={{ color: "var(--violet-ink)" }}
                      />
                      <button
                        onClick={() => updateDraftQuestion(activeQ.id, "marks", (activeQ?.marks || 1) + 1)}
                        className="w-12 h-12 md:w-8 md:h-8 flex shrink-0 items-center justify-center transition-colors active:scale-95"
                        style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-md)", border: "none", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-muted)"; e.currentTarget.style.color = "var(--foreground)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; }}
                      >
                        <Plus className="w-6 h-6 md:w-4 md:h-4" />
                      </button>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "var(--foreground-muted)" }}>
                      Points awarded for this question
                    </span>
                  </div>
                </div>

                <div className="pt-3 mt-4 flex justify-end" style={{ borderTop: "1px solid var(--border-fine)" }}>
                  <button
                    onClick={() => { if (confirm("Are you sure you want to delete this specific question?")) removeQuestion(activeQ.id); }}
                    className="text-[10px] md:text-[11px] font-bold px-3 py-1.5 flex items-center gap-1.5 transition-colors"
                    style={{ color: "var(--crimson-signal)", borderRadius: "var(--radius-md)", border: "none", background: "transparent" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--crimson-tint)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Question
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Optional Generator Section */}
          <div className="p-4 relative">
            <button
              type="button"
              onClick={() => setIsGeneratorExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors"
              style={{ background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}
              aria-expanded={isGeneratorExpanded}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--foreground-muted)" }} />
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wider">Optional question assistant</span>
                  <span className="block text-[11px] font-medium" style={{ color: "var(--foreground-muted)" }}>
                    Generate drafts only when you need a starting point
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", isGeneratorExpanded && "rotate-180")}
                style={{ color: "var(--foreground-muted)" }}
              />
            </button>

            {isGeneratorExpanded && (
              <div className="mt-4 space-y-4">
                <div>
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Questions to Generate
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-lg)" }}>
                  {[1, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => setQuestionCount(num)}
                      className="py-2 md:py-1.5 text-sm md:text-xs font-bold transition-all"
                      style={{
                        borderRadius: "var(--radius-md)",
                        background: questionCount === num ? "white" : "transparent",
                        color: questionCount === num ? "var(--violet-ink)" : "var(--foreground-muted)",
                        boxShadow: questionCount === num ? "var(--shadow-card)" : "none",
                        border: "none",
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Difficulty
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={cn("h-9 rounded-md border text-xs font-bold capitalize transition-colors")}
                      style={{
                        background: difficulty === level ? "var(--violet-ink)" : "white",
                        color: difficulty === level ? "white" : "var(--foreground-muted)",
                        borderColor: difficulty === level ? "var(--violet-ink)" : "var(--border-fine)",
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--foreground-muted)" }}>
                  Prompt starters
                </label>
                <div className="space-y-1.5">
                  {[
                    "Create misconception-based MCQs with one defensible answer.",
                    "Generate application questions from today's lesson objective.",
                    "Create a balanced mix of recall, application, and analysis items.",
                  ].map((starter) => (
                    <button
                      key={starter}
                      onClick={() => setPrompt(starter)}
                      className="w-full rounded-md border px-3 py-2 text-left text-xs leading-5 transition-colors"
                      style={{ background: "white", borderColor: "var(--border-fine)", color: "var(--foreground-muted)" }}
                    >
                      <Wand2 className="mr-2 inline h-3.5 w-3.5" style={{ color: "var(--violet-ink)" }} />
                      {starter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 md:p-3 transition-all" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Create 5 application MCQs from today's lesson objective."
                  className="w-full bg-transparent border-0 p-0 focus:ring-0 resize-none text-xs md:text-sm leading-relaxed min-h-[60px]"
                  style={{ color: "var(--foreground)" }}
                />
                <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: "1px solid var(--border-fine)" }}>
                  <span className="text-[9px] md:text-[10px] font-semibold" style={{ color: "var(--foreground-muted)" }}>
                    {prompt.length} chars
                  </span>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="h-7 md:h-8 px-3 text-white text-[10px] md:text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderRadius: "var(--radius-md)", background: "var(--violet-ink)", boxShadow: "var(--shadow-card)", border: "none" }}
                  >
                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CloudUpload className="w-3.5 h-3.5 mr-1 inline" /> Generate</>}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border p-3 text-xs leading-5" style={{ background: "var(--cobalt-tint)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
                <div className="mb-1 flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4" style={{ color: "var(--cobalt-signal)" }} />
                  Teacher review required
                </div>
                Generated items are drafts. Confirm the wording, answer key, marks, and syllabus fit before publishing.
              </div>

              {generatedHistory.length > 0 && (
                <div className="p-4 relative" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                  <h4 className="text-[10px] uppercase font-bold mb-1.5 tracking-wider" style={{ color: "var(--violet-ink)" }}>Generated drafts</h4>
                  <p className="text-xs mb-4 leading-relaxed font-medium" style={{ color: "var(--foreground-muted)" }}>
                    <span className="font-bold" style={{ color: "var(--violet-ink)" }}>
                      {generatedHistory.reduce((acc, curr) => acc + curr.questions.length, 0)}
                    </span>{" "}
                    generated questions ready.
                  </p>

                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="w-full h-9 font-bold text-xs transition-all"
                        style={{ background: "white", color: "var(--violet-ink)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--violet-ink)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--violet-ink)"; }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5 inline" /> Review & Add
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-0 shadow-2xl" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-xl)" }}>
                      <DialogHeader className="p-6 md:p-8 shadow-sm shrink-0" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
                        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center text-white shrink-0" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}>
                              <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                              <DialogTitle className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                                Generated Drafts
                              </DialogTitle>
                              <DialogDescription className="mt-1 text-sm md:text-base" style={{ color: "var(--foreground-muted)" }}>
                                Review each item below. Click 'Add' to move a question into the assessment draft.
                              </DialogDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end md:self-auto">
                            <button
                              onClick={() => { if (confirm("Clear generations?")) setGeneratedHistory([]); }}
                              className="h-10 px-4 font-semibold text-sm transition-all"
                              style={{ background: "white", color: "var(--crimson-signal)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "var(--crimson-tint)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
                            >
                              <Trash2 className="w-4 h-4 mr-2 inline" /> Clear All
                            </button>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1 custom-scrollbar scroll-smooth">
                        {generatedHistory.map((gen, idx) => (
                          <div key={idx} className="overflow-hidden transition-all" style={{ background: "white", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4" style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 shrink-0 mt-0.5" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-md)" }}>
                                  <History className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                                </div>
                                <div>
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2" style={{ color: "var(--foreground-muted)" }}>
                                    Prompt{" "}
                                    <span className="w-1 h-1 rounded-full inline-block" style={{ background: "var(--border-medium)" }} />{" "}
                                    <span style={{ color: "var(--violet-ink)" }}>{gen.questions.length} Results</span>
                                  </h4>
                                  <p className="rounded-md px-3 py-2 text-sm md:text-base font-medium leading-relaxed" style={{ color: "var(--foreground)", background: "white", border: "1px solid var(--border-fine)" }}>
                                    {gen.prompt}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => addAllQuestionsFromGen(idx)}
                                className="shrink-0 px-4 py-2 font-semibold text-sm transition-all"
                                style={{ background: "var(--violet-tint)", color: "var(--violet-ink)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--violet-ink)"; e.currentTarget.style.color = "white"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "var(--violet-tint)"; e.currentTarget.style.color = "var(--violet-ink)"; }}
                              >
                                <Plus className="w-4 h-4 mr-1.5 inline" /> Add All {gen.questions.length}
                              </button>
                            </div>
                            <div className="p-4 md:p-5 space-y-4">
                              {gen.questions.map((q, qIdx) => (
                                <div key={qIdx} className="flex flex-col md:flex-row items-start gap-4 md:gap-6 p-4 md:p-5 relative transition-all" style={{ background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                                  <div className="hidden md:flex flex-col items-center gap-2 shrink-0 pt-1">
                                    <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)", border: "1px solid var(--border-fine)" }}>
                                      {qIdx + 1}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 w-full md:pr-24">
                                    <div className="flex flex-wrap items-center justify-between md:justify-start gap-2 mb-3">
                                      <div className="flex gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1" style={{ color: "var(--violet-ink)", background: "var(--violet-tint)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)" }}>
                                          {q.questionType}
                                        </span>
                                        {q.marks && (
                                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1" style={{ color: "var(--foreground-muted)", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)" }}>
                                            {q.marks} Mark{q.marks > 1 ? "s" : ""}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => addQuestionToDraft(q)}
                                        className="md:hidden px-3 py-2 font-semibold text-sm"
                                        style={{ background: "white", color: "var(--violet-ink)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)" }}
                                      >
                                        <Plus className="w-4 h-4 mr-1 inline" /> Add
                                      </button>
                                    </div>
                                    <h3 className="text-sm md:text-base font-bold leading-relaxed mb-4" style={{ color: "var(--foreground)" }}>
                                      {q.questionText}
                                    </h3>
                                    {q.options && q.options.length > 0 && (
                                      <div className="grid grid-cols-1 gap-2 mt-4">
                                        {q.options.map((opt: any, optIdx: number) => (
                                          <div
                                            key={optIdx}
                                            className="flex items-start gap-3 p-2.5 md:p-3 transition-all"
                                            style={{ borderRadius: "var(--radius-md)", background: opt.isCorrect ? "var(--emerald-tint)" : "var(--surface-muted)", border: `1px solid ${opt.isCorrect ? "var(--emerald-signal)" : "var(--border-fine)"}` }}
                                          >
                                            <div className="shrink-0 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center mt-0.5" style={{ background: opt.isCorrect ? "var(--emerald-signal)" : "white", borderColor: opt.isCorrect ? "var(--emerald-signal)" : "var(--border-medium)", color: "white" }}>
                                              {opt.isCorrect && <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                                            </div>
                                            <span className="text-xs md:text-sm leading-relaxed" style={{ color: opt.isCorrect ? "var(--foreground)" : "var(--foreground-muted)", fontWeight: opt.isCorrect ? 600 : 400 }}>
                                              {opt.text}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => addQuestionToDraft(q)}
                                    className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 shrink-0 items-center justify-center h-12 px-6 font-bold text-sm transition-all"
                                    style={{ background: "white", color: "var(--violet-ink)", border: "2px solid var(--border-medium)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
                                    onMouseEnter={e => { e.currentTarget.style.background = "var(--violet-ink)"; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "var(--violet-ink)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--violet-ink)"; e.currentTarget.style.borderColor = "var(--border-medium)"; }}
                                  >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Add
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Tools Trigger FAB */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="lg:hidden fixed left-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white hover:scale-105 active:scale-95 transition-all"
          style={{ background: "var(--violet-ink)", boxShadow: "var(--shadow-dialog)" }}
          title="Open question tools"
        >
          <Settings className="w-6 h-6" />
        </button>
      </main>

      {/* Footer Bar */}
      <footer className="h-16 md:h-[72px] flex items-center justify-between px-4 md:px-6 shrink-0 z-40 relative" style={{ background: "white", borderTop: "1px solid var(--border-fine)" }}>
        <div className="flex items-center gap-4 md:gap-6">
          <button
            className="flex items-center gap-2 font-semibold text-xs md:text-sm px-2 md:px-4 py-2 transition-colors disabled:opacity-50"
            onClick={() => handleSave(false)}
            disabled={isSaving || draftQuestions.length === 0}
            style={{ color: "var(--foreground-muted)", border: "none", background: "transparent", borderRadius: "var(--radius-md)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--violet-ink)"; e.currentTarget.style.background = "var(--violet-tint)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            {isSaving ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Save className="w-4 h-4 md:w-5 md:h-5" />}
            <span className="hidden sm:inline">Save Draft</span>
          </button>
          <div className="hidden sm:block h-4 w-px" style={{ background: "var(--border-fine)" }} />
          <button
            className="hidden sm:flex items-center gap-2 font-semibold text-xs md:text-sm px-4 py-2 transition-colors disabled:opacity-50"
            onClick={clearDraft}
            disabled={draftQuestions.length === 0}
            style={{ color: "var(--foreground-muted)", border: "none", background: "transparent", borderRadius: "var(--radius-md)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--crimson-signal)"; e.currentTarget.style.background = "var(--crimson-tint)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.background = "transparent"; }}
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            Reset All
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs font-medium italic mr-2 text-right" style={{ color: "var(--foreground-muted)" }}>
            {draftQuestions.length} Questions <br /> in Draft
          </span>
          <button
            onClick={addManualQuestion}
            disabled={!selectedAssessmentId}
            className="flex h-10 md:h-11 items-center justify-center gap-2 px-4 md:px-6 font-bold text-white active:scale-95 transition-all text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-lg)", border: "none", boxShadow: "var(--shadow-card)" }}
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">New Question</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </footer>

      <Dialog open={showDateModal} onOpenChange={setShowDateModal}>
        <DialogContent className="sm:max-w-md" style={{ background: "white", borderRadius: "var(--radius-xl)" }}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
              Publish Assessment Schedule
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              Please confirm or set the dates and times for this assessment before publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={publishDates.startsAt}
                onChange={(e) => setPublishDates(prev => ({ ...prev, startsAt: e.target.value }))}
                className="w-full h-10 px-3 border focus:outline-none focus:ring-1 focus:ring-violet-500"
                style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-medium)", background: "white", color: "var(--foreground)" }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={publishDates.endsAt}
                onChange={(e) => setPublishDates(prev => ({ ...prev, endsAt: e.target.value }))}
                className="w-full h-10 px-3 border focus:outline-none focus:ring-1 focus:ring-violet-500"
                style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-medium)", background: "white", color: "var(--foreground)" }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setShowDateModal(false)}
              className="h-10 px-4 text-sm font-semibold transition-all"
              style={{ background: "white", color: "var(--foreground)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAndPublish}
              disabled={isSaving || !publishDates.startsAt || !publishDates.endsAt}
              className="h-10 px-4 text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
            >
              {isSaving ? "Publishing..." : "Confirm & Publish"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
