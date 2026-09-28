"use client";

import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchMyAssessments,
  fetchAssessmentDetail,
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
  Loader2,
  History,
  Eye,
  Settings,
  Menu,
  X,
  GripVertical,
  BookOpen,
  CloudUpload,
  CloudOff,
  Edit3,
  Save,
  Check,
  ChevronDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
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

export function QuestionDraftingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentIdFromUrl = searchParams.get("assessmentId");

  const { assessments, loading } = useSelector((s: RootState) => s.teacher);
  const user = useSelector((s: RootState) => s.user.user);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(assessmentIdFromUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [publishDates, setPublishDates] = useState({ startsAt: "", endsAt: "" });

  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHistory, setGeneratedHistory] = useState<{ prompt: string; questions: GeneratedQuestion[] }[]>([]);

  const [draftQuestions, setDraftQuestions] = useState<any[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);

  const [isStackOpen, setIsStackOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchMyAssessments());
  }, [dispatch]);

  useEffect(() => {
    if (assessmentIdFromUrl) setSelectedAssessmentId(assessmentIdFromUrl);
  }, [assessmentIdFromUrl]);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!selectedAssessmentId) return;
      try {
        const result = await dispatch(fetchAssessmentDetail(selectedAssessmentId)).unwrap();
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

  const onlineAssessments = useMemo(
    () => assessments.filter((a: any) => a.isOnline === true && a.status !== "ended"),
    [assessments],
  );
  const selectedAssessment = assessments.find((a: any) => a.id === selectedAssessmentId);
  const activeQ = draftQuestions.find((q) => q.id === activeQuestionId) || null;

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
      if (shouldPublish) router.push("/teacher/assessments");
    } catch (error: any) {
      toast.error(error || "Failed to save questions");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishClick = () => {
    if (!selectedAssessmentId) return toast.error("Select an assessment first.");
    if (draftQuestions.length === 0) return toast.error("No questions to save");
    
    if (selectedAssessment?.startsAt) {
      if (confirm("Are you sure you want to publish this assessment with its pre-configured dates?")) {
        handleSave(true);
      }
    } else {
      setShowDateModal(true);
    }
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
      router.push("/teacher/assessments");
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
      const questions = await generateQuestions(apiKey, prompt, questionCount);
      setGeneratedHistory((prev) => [{ prompt, questions }, ...prev]);
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
    window.alert("Question added to draft successfully!");
  };

  const addAllQuestionsFromGen = (idx: number) => {
    const gen = generatedHistory[idx];
    if (!gen) return;
    const newQuestions = gen.questions.map((q) => ({ ...q, id: Date.now() + Math.random() }));
    setDraftQuestions((prev) => [...prev, ...newQuestions]);
    setActiveQuestionId(newQuestions[0].id);
    toast.success(`Added ${newQuestions.length} questions`);
    window.alert(`Added ${newQuestions.length} questions to draft successfully!`);
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
      <header className="flex h-16 items-center justify-between px-4 md:px-6 shrink-0 z-10" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => setIsStackOpen(true)}
            className="lg:hidden p-1.5 -ml-1 shrink-0 transition-colors"
            style={{ color: "var(--foreground-muted)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--violet-ink)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--foreground-muted)")}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center shrink-0 text-white" style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
            <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-[13px] md:text-lg font-bold tracking-tight hidden sm:block leading-tight" style={{ color: "var(--foreground)" }}>
              ParaLearn Editor
            </h1>
            <div className="flex items-center gap-1 relative drafting-assessment-selector">
              {selectedAssessment ? (
                <span className="truncate max-w-[120px] md:max-w-[200px] text-[11px] md:text-xs font-semibold" style={{ color: "var(--violet-ink)" }}>
                  {selectedAssessment.title}
                </span>
              ) : (
                <select
                  value={selectedAssessmentId}
                  onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  className="bg-transparent border-none p-0 pr-4 text-[11px] md:text-xs font-semibold focus:ring-0 w-auto min-w-[100px] max-w-[130px] md:w-48 appearance-none cursor-pointer truncate rounded-none"
                  style={{ color: "var(--violet-ink)" }}
                >
                  <option value="" disabled>Select...</option>
                  {onlineAssessments.map((a) => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              )}
              {!selectedAssessment && (
                <ChevronDown className="w-3 h-3 pointer-events-none absolute right-0 top-1/2 -translate-y-1/2" style={{ color: "var(--violet-ink)" }} />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <nav className="hidden md:flex items-center gap-6 h-16">
            <Link href="/teacher/dashboard" className="text-sm font-medium transition-colors" style={{ color: "var(--foreground-muted)" }}
              onMouseEnter={(e: any) => (e.currentTarget.style.color = "var(--violet-ink)")}
              onMouseLeave={(e: any) => (e.currentTarget.style.color = "var(--foreground-muted)")}
            >
              Dashboard
            </Link>
            <span className="text-sm font-medium h-full flex items-center" style={{ color: "var(--violet-ink)", borderBottom: "2px solid var(--violet-ink)" }}>
              Editor
            </span>
            <Link href="/teacher/assessments" className="text-sm font-medium transition-colors" style={{ color: "var(--foreground-muted)" }}
              onMouseEnter={(e: any) => (e.currentTarget.style.color = "var(--violet-ink)")}
              onMouseLeave={(e: any) => (e.currentTarget.style.color = "var(--foreground-muted)")}
            >
              Bank
            </Link>
          </nav>
          <div className="hidden md:block h-8 w-px" style={{ background: "var(--border-fine)" }} />
          <div className="flex items-center gap-3">
            {selectedAssessment?.isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={!selectedAssessmentId || isSaving}
                className="drafting-unpublish-btn flex h-9 md:h-10 items-center gap-2 px-3 md:px-4 text-xs md:text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "white", color: "var(--crimson-signal)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--crimson-tint)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "white"; }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudOff className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="hidden sm:inline">Unpublish</span>
              </button>
            ) : (
              <button
                onClick={handlePublishClick}
                disabled={!selectedAssessmentId || draftQuestions.length === 0 || isSaving}
                className="drafting-publish-btn flex h-9 md:h-10 items-center gap-2 px-3 md:px-4 text-xs md:text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "white", color: "var(--foreground)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--violet-ink)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--violet-ink)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-medium)"; }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="hidden sm:inline">Publish</span>
              </button>
            )}
            {(user as any)?.school?.logoUrl ? (
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full overflow-hidden" style={{ border: "1px solid var(--border-fine)" }}>
                <img alt="Profile" className="h-full w-full object-cover" src={(user as any).school.logoUrl} />
              </div>
            ) : (
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-signal)", border: "1px solid var(--border-fine)" }}>
                {user?.firstName?.charAt(0) || "T"}
              </div>
            )}
          </div>
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
              <div className="text-center p-6 text-sm" style={{ color: "var(--foreground-muted)" }}>
                No questions yet.
              </div>
            ) : (
              draftQuestions.map((q, idx) => {
                const isActive = q.id === activeQuestionId;
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
                      <p className="text-sm truncate" style={{ fontWeight: isActive ? 600 : 500, color: isActive ? "var(--foreground)" : "var(--foreground-muted)" }}>
                        {q.questionText || "Empty Question"}
                      </p>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "none", boxShadow: "var(--shadow-card)" }}
            >
              <Plus className="w-4 h-4" /> New Question
            </button>
          </div>
        </aside>

        {/* Center Editor */}
        <section
          className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth"
          style={{ background: "white" }}
          onClick={() => { setIsStackOpen(false); setIsAIOpen(false); }}
        >
          {!selectedAssessmentId ? (
            <div className="max-w-3xl mx-auto py-20 px-6 flex flex-col items-center justify-center h-full opacity-70 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--surface-muted)" }}>
                <BookOpen className="w-10 h-10" style={{ color: "var(--border-medium)" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>No Assessment Selected</h2>
              <p className="text-sm max-w-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
                Please select an assessment from the top navigation dropdown to start drafting questions.
              </p>
            </div>
          ) : !activeQ ? (
            <div className="max-w-3xl mx-auto py-20 px-6 flex flex-col items-center justify-center h-full opacity-70 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--surface-muted)" }}>
                <BookOpen className="w-10 h-10" style={{ color: "var(--border-medium)" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>No Question Selected</h2>
              <p className="text-sm max-w-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
                Select a question from the stack on the left, or create a new one to start drafting.
              </p>
              <button
                onClick={addManualQuestion}
                className="h-10 px-6 font-bold text-white"
                style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-lg)", border: "none" }}
              >
                <Plus className="w-4 h-4 mr-2 inline" /> Blank Question
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-10 lg:py-16 px-6 lg:px-10">
              <div className="mb-10 lg:mb-12">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-2 font-bold" style={{ color: "var(--violet-ink)" }}>
                    <Edit3 className="w-4 h-4" />
                    <span className="uppercase tracking-widest text-[10px] md:text-xs">
                      Editing Question {String(draftQuestions.findIndex((q) => q.id === activeQuestionId) + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="lg:hidden flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsStackOpen(true); }}
                      className="px-3 py-1.5 text-xs font-bold"
                      style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)", borderRadius: "var(--radius-sm)", border: "none" }}
                    >
                      Stack
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsAIOpen(true); }}
                      className="px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                      style={{ background: "var(--violet-tint)", color: "var(--violet-ink)", borderRadius: "var(--radius-sm)", border: "none" }}
                    >
                      <Sparkles className="w-3 h-3" /> AI
                    </button>
                  </div>
                </div>

                <div className="relative group/title">
                  <textarea
                    value={activeQ.questionText || ""}
                    onChange={(e) => {
                      updateDraftQuestion(activeQ.id, "questionText", e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    className="w-full text-2xl md:text-3xl font-bold leading-relaxed outline-none pb-4 transition-colors resize-none bg-transparent focus:ring-0 px-0 m-0 overflow-hidden"
                    style={{ borderBottom: "2px solid transparent", color: "var(--foreground)", height: "auto", minHeight: "60px" }}
                    placeholder="Type your question prompt here..."
                    onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--border-medium)")}
                    onBlur={e => (e.currentTarget.style.borderBottomColor = "transparent")}
                    ref={(textarea) => {
                      if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
                    }}
                  />
                  <div className="absolute -left-10 top-2 opacity-0 group-hover/title:opacity-100 transition-opacity hidden md:flex items-center justify-center p-1" style={{ color: "var(--border-medium)", borderRadius: "var(--radius-sm)" }}>
                    <GripVertical className="w-5 h-5 pointer-events-none" />
                  </div>
                </div>
                <p className="mt-4 text-xs italic" style={{ color: "var(--foreground-muted)" }}>
                  Click any text block to start editing directly.
                </p>
              </div>

              {/* Options Area */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest mb-5 lg:mb-6" style={{ color: "var(--foreground-muted)" }}>
                  Answer Options
                </h3>

                <div className="flex flex-col gap-3">
                  {activeQ.options?.map((opt: any, oIdx: number) => (
                    <div
                      key={oIdx}
                      className="group flex items-start sm:items-center gap-3 md:gap-4 p-3 md:p-4 transition-all"
                      style={{
                        borderRadius: "var(--radius-lg)",
                        border: opt.isCorrect ? "1px solid var(--emerald-signal)" : "1px solid var(--border-fine)",
                        background: opt.isCorrect ? "var(--emerald-tint)" : "var(--surface-muted)",
                        boxShadow: opt.isCorrect ? "var(--shadow-card)" : "none",
                      }}
                      onMouseEnter={e => { if (!opt.isCorrect) e.currentTarget.style.borderColor = "var(--violet-ink)"; }}
                      onMouseLeave={e => { if (!opt.isCorrect) e.currentTarget.style.borderColor = "var(--border-fine)"; }}
                    >
                      <div
                        className="shrink-0 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center font-bold text-xs md:text-sm transition-colors mt-0.5 sm:mt-0"
                        style={{
                          borderRadius: "var(--radius-md)",
                          background: opt.isCorrect ? "var(--emerald-signal)" : "white",
                          color: opt.isCorrect ? "white" : "var(--foreground-muted)",
                          border: opt.isCorrect ? "none" : "1px solid var(--border-fine)",
                          boxShadow: "var(--shadow-card)",
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
                        className="flex-1 text-sm md:text-base outline-none bg-transparent resize-none overflow-hidden m-0 p-0 focus:ring-0 border-none"
                        style={{ color: opt.isCorrect ? "var(--foreground)" : "var(--foreground-muted)", fontWeight: opt.isCorrect ? 500 : 400, height: "auto", minHeight: "24px" }}
                        placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                        ref={(textarea) => {
                          if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
                        }}
                      />

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => removeOption(activeQ.id, oIdx)}
                          className="sm:opacity-0 group-hover:opacity-100 p-1.5 transition-all flex items-center justify-center shrink-0"
                          style={{ color: "var(--foreground-muted)", borderRadius: "var(--radius-sm)", border: "none", background: "transparent" }}
                          title="Remove option"
                          onMouseEnter={e => { e.currentTarget.style.color = "var(--crimson-signal)"; e.currentTarget.style.background = "var(--crimson-tint)"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.background = "transparent"; }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateOption(activeQ.id, oIdx, "isCorrect", !opt.isCorrect)}
                          className="flex h-7 w-12 md:h-8 md:w-14 items-center rounded-full p-1 transition-all focus:outline-none"
                          style={{ background: opt.isCorrect ? "var(--emerald-signal)" : "var(--border-medium)", justifyContent: opt.isCorrect ? "flex-end" : "flex-start" }}
                        >
                          <div className="h-5 w-5 md:h-6 md:w-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform" style={{ color: opt.isCorrect ? "var(--emerald-signal)" : "transparent" }}>
                            {opt.isCorrect && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addOption(activeQ.id)}
                  className="w-full mt-4 py-4 md:py-5 flex items-center justify-center gap-2 transition-all outline-none"
                  style={{ border: "2px dashed var(--border-medium)", borderRadius: "var(--radius-lg)", color: "var(--foreground-muted)", background: "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--violet-ink)"; e.currentTarget.style.borderColor = "var(--violet-ink)"; e.currentTarget.style.background = "var(--violet-tint)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--foreground-muted)"; e.currentTarget.style.borderColor = "var(--border-medium)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <Plus className="w-5 h-5 opacity-70" />
                  <span className="font-bold text-sm">Add Option</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Panel: AI & Settings */}
        <aside
          className={`w-80 flex flex-col shrink-0 overflow-y-auto custom-scrollbar z-[50] transition-transform lg:relative fixed inset-y-0 right-0 ${isAIOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"}`}
          style={{ background: "white", borderLeft: "1px solid var(--border-fine)" }}
        >
          <div className="p-4 flex justify-between items-center sticky top-0 z-10 lg:hidden" style={{ background: "white", borderBottom: "1px solid var(--border-fine)" }}>
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>Settings & AI</h2>
            <button style={{ color: "var(--foreground-muted)", background: "transparent", border: "none" }} onClick={() => setIsAIOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* AI Assistant Section */}
          <div className="p-4 relative" style={{ borderBottom: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" style={{ color: "var(--violet-ink)" }} />
              <h3 className="font-bold text-xs md:text-sm uppercase tracking-wider" style={{ color: "var(--foreground)" }}>AI Builder</h3>
            </div>

            <div className="space-y-4">
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

              <div className="p-2.5 md:p-3 transition-all" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                <label className="block text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                  AI Prompt
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="eg. Create 5 hard MCQs on quantum physics..."
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

              {generatedHistory.length > 0 && (
                <div className="p-4 relative" style={{ background: "var(--violet-tint)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                  <h4 className="text-[10px] uppercase font-bold mb-1.5 tracking-wider" style={{ color: "var(--violet-ink)" }}>AI Generations</h4>
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
                                AI Generated Drafts
                              </DialogTitle>
                              <DialogDescription className="mt-1 text-sm md:text-base" style={{ color: "var(--foreground-muted)" }}>
                                Review the AI outputs below. Click 'Add' to move a question to your draft.
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
                                  <p className="text-sm md:text-base font-medium leading-relaxed pl-3 py-0.5" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--violet-ink)" }}>
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
          </div>

          {/* Settings Section */}
          <div className="p-4 relative">
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
                      Points awarded per correct answer
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
        </aside>

        {/* Mobile AI Trigger FAB */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="lg:hidden fixed left-4 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white hover:scale-105 active:scale-95 transition-all"
          style={{ background: "var(--violet-ink)", boxShadow: "var(--shadow-dialog)" }}
          title="Open AI Builder"
        >
          <Sparkles className="w-6 h-6" />
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
