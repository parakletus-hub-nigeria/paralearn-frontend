"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchAssessmentDetail,
  fetchAssessmentSubmissions,
  deleteAssessment,
  bulkUploadQuestions,
  addQuestion,
  deleteQuestion,
  fetchScoresByAssessment,
} from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  X,
  Clock,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Users,
  BookOpen,
  MonitorCheck,
  GripVertical,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

const getStatusStyle = (status?: string) => {
  if (status === "started" || status === "active")
    return { background: "var(--emerald-tint)", color: "var(--emerald-signal)", label: "Active" };
  if (status === "ended")
    return { background: "var(--surface-muted)", color: "var(--foreground-muted)", label: "Ended" };
  return { background: "var(--amber-tint)", color: "var(--amber-signal)", label: "Pending" };
};

type Option = { text: string; isCorrect: boolean };

const EMPTY_OPTIONS: Option[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function CBTExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedAssessment, assessmentSubmissions, loading } = useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const [activeTab, setActiveTab] = useState<"questions" | "results">("questions");

  // Add question modal
  const [showAddQ, setShowAddQ] = useState(false);
  const [addingQ, setAddingQ] = useState(false);
  const [qForm, setQForm] = useState({
    question: "",
    options: EMPTY_OPTIONS as Option[],
    points: "1",
    type: "MCQ",
  });

  // Bulk upload modal
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Scores
  const [scores, setScores] = useState<any[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);

  useEffect(() => {
    if (params.examId) {
      dispatch(fetchAssessmentDetail(params.examId));
      dispatch(fetchAssessmentSubmissions(params.examId));
      dispatch(getTenantInfo());
    }
  }, [params.examId]);

  useEffect(() => {
    if (activeTab === "results" && params.examId) {
      setScoresLoading(true);
      dispatch(fetchScoresByAssessment(params.examId))
        .unwrap()
        .then((data) => setScores(Array.isArray(data) ? data : []))
        .catch(() => setScores([]))
        .finally(() => setScoresLoading(false));
    }
  }, [activeTab, params.examId]);

  const questions = useMemo(
    () => (selectedAssessment as any)?.questions || [],
    [selectedAssessment],
  );

  const statusStyle = getStatusStyle(selectedAssessment?.status);

  const resetQForm = () => {
    setQForm({ question: "", options: [...EMPTY_OPTIONS.map((o) => ({ ...o }))], points: "1", type: "MCQ" });
  };

  const handleAddQuestion = async () => {
    if (!qForm.question.trim()) return toast.error("Question text is required");
    const filledOptions = qForm.options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) return toast.error("Add at least 2 answer options");
    if (!filledOptions.some((o) => o.isCorrect)) return toast.error("Select the correct answer");

    setAddingQ(true);
    try {
      await dispatch(
        addQuestion({
          assessmentId: params.examId,
          existingQuestions: questions,
          question: qForm.question.trim(),
          options: filledOptions,
          points: Number(qForm.points) || 1,
          type: qForm.type,
          explanation: (qForm as any).explanation?.trim() || undefined,
        } as any),
      ).unwrap();
      toast.success("Question added");
      resetQForm();
      setShowAddQ(false);
      dispatch(fetchAssessmentDetail(params.examId));
    } catch (e: any) {
      toast.error(e || "Failed to add question");
    } finally {
      setAddingQ(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await dispatch(deleteQuestion({ assessmentId: params.examId, questionId })).unwrap();
      toast.success("Question deleted");
      dispatch(fetchAssessmentDetail(params.examId));
    } catch (e: any) {
      toast.error(e || "Failed to delete question");
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return toast.error("Select a file first");
    setUploading(true);
    try {
      await dispatch(bulkUploadQuestions({ assessmentId: params.examId, file: bulkFile })).unwrap();
      toast.success("Questions uploaded successfully");
      setBulkFile(null);
      setShowBulk(false);
      dispatch(fetchAssessmentDetail(params.examId));
    } catch (e: any) {
      toast.error(e || "Failed to upload questions");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!selectedAssessment) return;
    if (!confirm(`Delete "${selectedAssessment.title}"? This cannot be undone.`)) return;
    try {
      await dispatch(deleteAssessment(selectedAssessment.id)).unwrap();
      toast.success("Exam deleted");
      router.push("/RMS/cbt/exams");
    } catch (e: any) {
      toast.error(e || "Failed to delete exam");
    }
  };

  if (loading && !selectedAssessment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-10 w-10 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (!selectedAssessment) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Exam not found</p>
        <Link href="/RMS/cbt/exams">
          <Button className="mt-4" variant="outline">Back to Exams</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      {/* Back + title */}
      <div className="mb-6">
        <Link href="/RMS/cbt/exams">
          <button className="flex items-center gap-2 text-sm mb-4 transition-colors" style={{ color: "var(--foreground-muted)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to Exams
          </button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>{selectedAssessment.title}</h1>
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: statusStyle.background, color: statusStyle.color }}>
                {statusStyle.label}
              </span>
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                CBT Online
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {(selectedAssessment as any).durationMins && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <Clock className="w-4 h-4" /> {(selectedAssessment as any).durationMins} min
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                <FileQuestion className="w-4 h-4" /> {questions.length} questions
              </span>
              {(selectedAssessment as any).totalMarks && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <CheckCircle2 className="w-4 h-4" /> {(selectedAssessment as any).totalMarks} marks
                </span>
              )}
              {selectedAssessment.startsAt && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <Clock className="w-4 h-4" />
                  {format(new Date(selectedAssessment.startsAt), "MMM d, yyyy HH:mm")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteExam}
              style={{ borderColor: "color-mix(in oklch, var(--crimson-signal) 30%, transparent)", color: "var(--crimson-signal)", borderRadius: "var(--radius-md)" }}
            >
              <Trash2 className="w-4 h-4" /> Delete Exam
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 w-fit" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-lg)" }}>
        {(["questions", "results"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 text-sm font-semibold transition-all capitalize"
            style={{ borderRadius: "var(--radius-md)", background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "var(--foreground)" : "var(--foreground-muted)", boxShadow: activeTab === tab ? "var(--shadow-card)" : "none" }}
          >
            {tab === "questions" ? `Questions (${questions.length})` : `Results (${assessmentSubmissions?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* Questions Tab */}
      {activeTab === "questions" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{questions.length} question{questions.length !== 1 ? "s" : ""} in this exam</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                style={{ borderColor: "var(--border-fine)", borderRadius: "var(--radius-md)" }}
                onClick={() => setShowBulk(true)}
              >
                <Upload className="w-4 h-4" /> Bulk Upload
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5 text-white"
                style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
                onClick={() => setShowAddQ(true)}
              >
                <Plus className="w-4 h-4" /> Add Question
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white py-16 text-center" style={{ borderRadius: "var(--radius-xl)", border: "2px dashed var(--border-fine)" }}>
              <FileQuestion className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
              <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No questions yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Add questions one by one or bulk upload a file.</p>
              <div className="flex gap-3 justify-center mt-4">
                <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2" style={{ borderRadius: "var(--radius-md)" }}>
                  <Upload className="w-4 h-4" /> Bulk Upload
                </Button>
                <Button onClick={() => setShowAddQ(true)} className="gap-2 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                  <Plus className="w-4 h-4" /> Add Question
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q: any, idx: number) => (
                <div key={q.id} className="bg-white p-5" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-start gap-4">
                    <span className="w-8 h-8 text-sm font-bold flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" style={{ color: "var(--foreground)" }}>{q.question || q.content || q.text}</p>
                      {(q.options || q.choices || []).length > 0 && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(q.options || q.choices || []).map((opt: any, oi: number) => (
                            <div
                              key={opt.id || oi}
                              className="flex items-center gap-2.5 px-3 py-2 text-sm"
                              style={{
                                borderRadius: "var(--radius-md)",
                                background: opt.isCorrect ? "var(--emerald-tint)" : "var(--surface-muted)",
                                border: `1px solid ${opt.isCorrect ? "color-mix(in oklch, var(--emerald-signal) 20%, transparent)" : "var(--border-fine)"}`,
                                color: opt.isCorrect ? "var(--emerald-signal)" : "var(--foreground)",
                                fontWeight: opt.isCorrect ? 500 : 400,
                              }}
                            >
                              {opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--emerald-signal)" }} />}
                              <span className="truncate">{opt.text || opt.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {q.points && (
                        <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                      )}
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 transition-colors"
                        style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--crimson-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--crimson-signal)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-muted)"; }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === "results" && (
        <div>
          {scoresLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : scores.length === 0 ? (
            <div className="bg-white py-16 text-center" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
              <Users className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
              <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No submissions yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Results will appear here once students submit the exam.</p>
            </div>
          ) : (
            <div className="bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
              <div className="px-5 py-3 grid grid-cols-4 gap-4" style={{ borderBottom: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Student</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Score</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Status</span>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Submitted</span>
              </div>
              <div>
                {scores.map((score: any) => {
                  const total = (selectedAssessment as any).totalMarks || 100;
                  const pct = total > 0 ? Math.round((score.score / total) * 100) : 0;
                  const passed = pct >= ((selectedAssessment as any).passingMarks || 50);
                  return (
                    <div
                      key={score.id}
                      className="px-5 py-3.5 grid grid-cols-4 gap-4 items-center transition-colors"
                      style={{ borderTop: "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div>
                        <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                          {score.student?.firstName} {score.student?.lastName}
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{score.student?.email}</p>
                      </div>
                      <div>
                        <p className="font-bold" style={{ color: "var(--foreground)" }}>{score.score ?? "—"}</p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>{pct}%</p>
                      </div>
                      <span className="inline-flex items-center w-fit text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: passed ? "var(--emerald-tint)" : "var(--crimson-tint)", color: passed ? "var(--emerald-signal)" : "var(--crimson-signal)" }}>
                        {passed ? "Pass" : "Fail"}
                      </span>
                      <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {score.submittedAt ? format(new Date(score.submittedAt), "MMM d, HH:mm") : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddQ && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => { setShowAddQ(false); resetQForm(); }} />
          <div className="relative bg-white w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-fine)" }}>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Add Question</h2>
              <button onClick={() => { setShowAddQ(false); resetQForm(); }} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              {/* Type + Points row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Question Type</label>
                  <select
                    value={qForm.type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setQForm((p) => ({
                        ...p,
                        type: t,
                        options: t === "TRUE_FALSE"
                          ? [{ text: "True", isCorrect: false }, { text: "False", isCorrect: false }]
                          : p.options,
                      }));
                    }}
                    className="mt-2 w-full h-10 px-3 text-sm bg-white focus:outline-none"
                    style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                  >
                    <option value="MCQ">Multiple Choice (MCQ)</option>
                    <option value="TRUE_FALSE">True / False</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Marks</label>
                  <Input type="number" min={1} value={qForm.points} onChange={(e) => setQForm((p) => ({ ...p, points: e.target.value }))} className="mt-2 h-10 rounded-xl text-sm" />
                </div>
              </div>

              {/* Question text */}
              <div>
                <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Question Text <span style={{ color: "var(--crimson-signal)" }}>*</span></label>
                <textarea
                  value={qForm.question}
                  onChange={(e) => setQForm((p) => ({ ...p, question: e.target.value }))}
                  placeholder="Enter your question here..."
                  rows={3}
                  className="mt-2 w-full px-4 py-3 text-sm resize-none focus:outline-none"
                  style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                />
              </div>

              {/* Answer options */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Answer Options</label>
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Select the correct answer</span>
                </div>
                <div className="space-y-2.5">
                  {qForm.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={opt.isCorrect}
                        onChange={() =>
                          setQForm((p) => ({
                            ...p,
                            options: p.options.map((o, i) => ({ ...o, isCorrect: i === oi })),
                          }))
                        }
                        className="w-4 h-4 cursor-pointer shrink-0"
                        style={{ accentColor: "var(--emerald-signal)" }}
                      />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        <Input
                          value={opt.text}
                          onChange={(e) =>
                            setQForm((p) => ({
                              ...p,
                              options: p.options.map((o, i) =>
                                i === oi ? { ...o, text: e.target.value } : o,
                              ),
                            }))
                          }
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="pl-8 h-10 rounded-xl text-sm"
                        />
                      </div>
                      {qForm.type !== "TRUE_FALSE" && qForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setQForm((p) => ({ ...p, options: p.options.filter((_, i) => i !== oi) }))}
                          className="p-1.5 transition-colors"
                          style={{ borderRadius: "var(--radius-sm)", color: "var(--border-medium)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--crimson-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--crimson-signal)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.color = "var(--border-medium)"; }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {qForm.type !== "TRUE_FALSE" && qForm.options.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setQForm((p) => ({ ...p, options: [...p.options, { text: "", isCorrect: false }] }))}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-75"
                    style={{ color: "var(--violet-ink)" }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add option
                  </button>
                )}
              </div>

              {/* Explanation */}
              <div>
                <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Explanation <span className="font-normal" style={{ color: "var(--foreground-muted)" }}>(optional)</span></label>
                <textarea
                  value={(qForm as any).explanation || ""}
                  onChange={(e) => setQForm((p: any) => ({ ...p, explanation: e.target.value }))}
                  placeholder="Explain why the correct answer is right..."
                  rows={2}
                  className="mt-2 w-full px-4 py-3 text-sm resize-none focus:outline-none"
                  style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                />
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => { setShowAddQ(false); resetQForm(); }} className="h-11 px-6" style={{ borderRadius: "var(--radius-md)" }}>Cancel</Button>
              <Button onClick={handleAddQuestion} disabled={addingQ} className="h-11 px-6 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                {addingQ ? "Adding..." : "Add Question"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Bulk Upload Modal */}
      {showBulk && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => { setShowBulk(false); setBulkFile(null); }} />
          <div className="relative bg-white w-full max-w-lg mx-4 flex flex-col overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-fine)" }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Bulk Upload Questions</h2>
                <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>Upload CSV, Excel, or any supported format.</p>
              </div>
              <button onClick={() => { setShowBulk(false); setBulkFile(null); }} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Format guide */}
              <div className="rounded-xl p-4" style={{ background: "var(--cobalt-tint)", border: "1px solid color-mix(in oklch, var(--cobalt-signal) 20%, transparent)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--cobalt-signal)" }}>Expected format</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--cobalt-signal)", opacity: 0.85 }}>
                  question | option_a | option_b | option_c | option_d | correct_answer | points
                </p>
                <p className="text-xs mt-1.5" style={{ color: "var(--cobalt-signal)", opacity: 0.75 }}>
                  correct_answer should be A, B, C, or D. Points column is optional (defaults to 1).
                </p>
              </div>

              {/* Drop zone */}
              <label
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed cursor-pointer transition-colors"
                style={{ borderRadius: "var(--radius-xl)", borderColor: bulkFile ? "var(--violet-ink)" : "var(--border-medium)", background: bulkFile ? "var(--violet-tint)" : "var(--surface-muted)" }}
              >
                <Upload className="w-8 h-8 mb-2" style={{ color: bulkFile ? "var(--violet-ink)" : "var(--foreground-muted)" }} />
                {bulkFile ? (
                  <>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{bulkFile.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>{(bulkFile.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Click to select or drag & drop</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>CSV, XLSX, XLS, ODS supported</p>
                  </>
                )}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.ods,.tsv"
                  className="hidden"
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => { setShowBulk(false); setBulkFile(null); }} className="h-11 px-6" style={{ borderRadius: "var(--radius-md)" }}>Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={!bulkFile || uploading} className="h-11 px-6 text-white gap-2" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload Questions"}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
