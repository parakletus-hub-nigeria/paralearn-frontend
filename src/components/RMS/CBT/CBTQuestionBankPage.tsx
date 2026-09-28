"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchAssessments,
  fetchSubjects,
  fetchClasses,
  addQuestion,
  deleteQuestion,
  bulkUploadQuestions,
  fetchAssessmentDetail,
} from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { Header } from "@/components/RMS/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Trash2,
  Upload,
  X,
  BookOpen,
  FileQuestion,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MonitorCheck,
} from "lucide-react";

type Option = { text: string; isCorrect: boolean };
const EMPTY_OPTIONS: Option[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function CBTQuestionBankPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { assessments, subjects, classes, loading } = useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  const [q, setQ] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());
  const [examQuestions, setExamQuestions] = useState<Record<string, any[]>>({});
  const [loadingExams, setLoadingExams] = useState<Set<string>>(new Set());

  const [showAddQ, setShowAddQ] = useState(false);
  const [targetExamId, setTargetExamId] = useState<string | null>(null);
  const [addingQ, setAddingQ] = useState(false);
  const [qForm, setQForm] = useState({ question: "", options: EMPTY_OPTIONS as Option[], points: "1" });

  const [showBulk, setShowBulk] = useState(false);
  const [bulkExamId, setBulkExamId] = useState<string | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    dispatch(fetchAssessments());
    dispatch(fetchSubjects());
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
  }, []);

  const cbtExams = useMemo(
    () => assessments.filter((a: any) => a.isOnline === true || a.isOnline === "true"),
    [assessments],
  );

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.id, s.name);
    return map;
  }, [subjects]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const filteredExams = useMemo(() => {
    let result = cbtExams;
    if (subjectFilter !== "all") result = result.filter((a: any) => a.subjectId === subjectFilter);
    const term = q.trim().toLowerCase();
    if (term) {
      result = result.filter((a: any) =>
        (a.title || "").toLowerCase().includes(term) ||
        (subjectNameById.get(a.subjectId || "") || "").toLowerCase().includes(term),
      );
    }
    return result;
  }, [cbtExams, subjectFilter, q, subjectNameById]);

  const toggleExam = async (examId: string) => {
    const next = new Set(expandedExams);
    if (next.has(examId)) {
      next.delete(examId);
      setExpandedExams(next);
      return;
    }
    next.add(examId);
    setExpandedExams(next);
    if (!examQuestions[examId]) {
      setLoadingExams((prev) => new Set(prev).add(examId));
      try {
        const result = await dispatch(fetchAssessmentDetail(examId)).unwrap();
        setExamQuestions((prev) => ({ ...prev, [examId]: (result as any)?.questions || [] }));
      } catch {
        setExamQuestions((prev) => ({ ...prev, [examId]: [] }));
      } finally {
        setLoadingExams((prev) => { const s = new Set(prev); s.delete(examId); return s; });
      }
    }
  };

  const openAddQuestion = (examId: string) => {
    setTargetExamId(examId);
    setQForm({ question: "", options: EMPTY_OPTIONS.map((o) => ({ ...o })), points: "1" });
    setShowAddQ(true);
  };

  const openBulkUpload = (examId: string) => {
    setBulkExamId(examId);
    setBulkFile(null);
    setShowBulk(true);
  };

  const handleAddQuestion = async () => {
    if (!targetExamId) return;
    if (!qForm.question.trim()) return toast.error("Question text is required");
    const filledOptions = qForm.options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) return toast.error("Add at least 2 options");
    if (!filledOptions.some((o) => o.isCorrect)) return toast.error("Mark at least one correct answer");
    setAddingQ(true);
    try {
      await dispatch(addQuestion({
        assessmentId: targetExamId,
        existingQuestions: examQuestions[targetExamId] || [],
        question: qForm.question.trim(),
        options: filledOptions,
        points: Number(qForm.points) || 1,
        type: "mcq",
      })).unwrap();
      toast.success("Question added");
      const result = await dispatch(fetchAssessmentDetail(targetExamId)).unwrap();
      setExamQuestions((prev) => ({ ...prev, [targetExamId]: (result as any)?.questions || [] }));
      setShowAddQ(false);
    } catch (e: any) {
      toast.error(e || "Failed to add question");
    } finally {
      setAddingQ(false);
    }
  };

  const handleDeleteQuestion = async (examId: string, questionId: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await dispatch(deleteQuestion({ assessmentId: examId, questionId })).unwrap();
      setExamQuestions((prev) => ({ ...prev, [examId]: (prev[examId] || []).filter((q) => q.id !== questionId) }));
      toast.success("Question deleted");
    } catch (e: any) {
      toast.error(e || "Failed to delete question");
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkExamId || !bulkFile) return toast.error("Select a file first");
    setUploading(true);
    try {
      await dispatch(bulkUploadQuestions({ assessmentId: bulkExamId, file: bulkFile })).unwrap();
      toast.success("Questions uploaded successfully");
      const result = await dispatch(fetchAssessmentDetail(bulkExamId)).unwrap();
      setExamQuestions((prev) => ({ ...prev, [bulkExamId]: (result as any)?.questions || [] }));
      setShowBulk(false);
      setBulkFile(null);
    } catch (e: any) {
      toast.error(e || "Failed to upload questions");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
            <BookOpen className="w-6 h-6" style={{ color: "var(--cobalt-signal)" }} />
            Question Bank
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Browse, add, and manage questions across all CBT exams.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: "CBT Exams", value: cbtExams.length, bg: "var(--violet-tint)", color: "var(--violet-ink)" },
          { label: "Total Questions", value: cbtExams.reduce((sum: number, a: any) => sum + (a.questionCount ?? a._count?.questions ?? 0), 0), bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
          { label: "Subjects", value: subjects.length, bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-5 text-center" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{stat.value}</p>
            <p className="text-xs uppercase tracking-wide font-semibold mt-0.5" style={{ color: "var(--foreground-muted)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          <Input
            placeholder="Search by exam title or subject..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 bg-white"
            style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="h-11 w-full md:w-[180px] bg-white" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}>
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent style={{ borderRadius: "var(--radius-md)" }}>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Exam accordion list */}
      {loading && cbtExams.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="bg-white py-16 text-center" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <FileQuestion className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
          <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No CBT exams found</p>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Create a CBT exam first, then add questions here.</p>
          <Link href="/RMS/cbt/exams">
            <Button className="mt-4 gap-2 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
              <Plus className="w-4 h-4" /> Create Exam
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExams.map((exam: any) => {
            const isOpen = expandedExams.has(exam.id);
            const isLoadingQ = loadingExams.has(exam.id);
            const questions = examQuestions[exam.id] || [];
            const subjectName = subjectNameById.get(exam.subjectId || "") || "—";
            const className = classNameById.get(exam.classId || "") || "—";
            const qCount = isOpen ? questions.length : (exam.questionCount ?? exam._count?.questions ?? 0);

            return (
              <div key={exam.id} className="bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
                {/* Exam header */}
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors"
                  onClick={() => toggleExam(exam.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                    <MonitorCheck className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{exam.title}</p>
                    <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{subjectName} • {className}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                      {qCount} Q{qCount !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openBulkUpload(exam.id); }}
                      className="p-1.5 transition-colors"
                      style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", color: "var(--foreground-muted)" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}
                      title="Bulk upload"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAddQuestion(exam.id); }}
                      className="p-1.5 text-white transition-opacity hover:opacity-85"
                      style={{ borderRadius: "var(--radius-sm)", background: "var(--violet-ink)" }}
                      title="Add question"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                    )}
                  </div>
                </div>

                {/* Questions list */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border-fine)" }}>
                    {isLoadingQ ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
                      </div>
                    ) : questions.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No questions yet.</p>
                        <div className="flex gap-2 justify-center mt-3">
                          <Button size="sm" variant="outline" onClick={() => openBulkUpload(exam.id)} className="gap-1.5 h-8" style={{ borderRadius: "var(--radius-md)" }}>
                            <Upload className="w-3.5 h-3.5" /> Bulk Upload
                          </Button>
                          <Button size="sm" onClick={() => openAddQuestion(exam.id)} className="gap-1.5 h-8 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                            <Plus className="w-3.5 h-3.5" /> Add Question
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {questions.map((qItem: any, idx: number) => (
                          <div
                            key={qItem.id}
                            className="px-5 py-3.5 flex items-start gap-4 transition-colors"
                            style={{ borderTop: idx > 0 ? "1px solid var(--border-fine)" : undefined }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                          >
                            <span className="w-7 h-7 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{qItem.question || qItem.content || qItem.text}</p>
                              {(qItem.options || qItem.choices || []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(qItem.options || qItem.choices || []).map((opt: any, oi: number) => (
                                    <span
                                      key={opt.id || oi}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-1"
                                      style={{
                                        borderRadius: "var(--radius-sm)",
                                        background: opt.isCorrect ? "var(--emerald-tint)" : "var(--surface-muted)",
                                        color: opt.isCorrect ? "var(--emerald-signal)" : "var(--foreground-muted)",
                                        fontWeight: opt.isCorrect ? 500 : 400,
                                      }}
                                    >
                                      {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                                      {String.fromCharCode(65 + oi)}. {opt.text || opt.content}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {qItem.points && <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{qItem.points}pt</span>}
                              <button
                                onClick={() => handleDeleteQuestion(exam.id, qItem.id)}
                                className="p-1 transition-colors"
                                style={{ borderRadius: "var(--radius-sm)", color: "var(--foreground-muted)" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--crimson-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--crimson-signal)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-muted)"; }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddQ && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setShowAddQ(false)} />
          <div className="relative bg-white w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-fine)" }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Add Question</h2>
                {targetExamId && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                    Adding to: {cbtExams.find((e: any) => e.id === targetExamId)?.title}
                  </p>
                )}
              </div>
              <button onClick={() => setShowAddQ(false)} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
              <div>
                <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Question <span style={{ color: "var(--crimson-signal)" }}>*</span></label>
                <textarea
                  value={qForm.question}
                  onChange={(e) => setQForm((p) => ({ ...p, question: e.target.value }))}
                  placeholder="Enter your question..."
                  rows={3}
                  className="mt-2 w-full px-4 py-3 text-sm resize-none focus:outline-none"
                  style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Options</label>
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Check the correct answer(s)</span>
                </div>
                <div className="space-y-2.5">
                  {qForm.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={(e) =>
                          setQForm((p) => ({
                            ...p,
                            options: p.options.map((o, i) => i === oi ? { ...o, isCorrect: e.target.checked } : o),
                          }))
                        }
                        className="w-4 h-4 cursor-pointer"
                        style={{ accentColor: "var(--emerald-signal)" }}
                      />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>{String.fromCharCode(65 + oi)}.</span>
                        <Input
                          value={opt.text}
                          onChange={(e) =>
                            setQForm((p) => ({
                              ...p,
                              options: p.options.map((o, i) => i === oi ? { ...o, text: e.target.value } : o),
                            }))
                          }
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="pl-8 h-10 text-sm"
                          style={{ borderRadius: "var(--radius-md)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-32">
                <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Points</label>
                <Input type="number" min={1} value={qForm.points} onChange={(e) => setQForm((p) => ({ ...p, points: e.target.value }))} className="mt-2 h-10 text-sm" style={{ borderRadius: "var(--radius-md)" }} />
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => setShowAddQ(false)} className="h-11 px-6" style={{ borderRadius: "var(--radius-md)" }}>Cancel</Button>
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
                {bulkExamId && (
                  <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                    Uploading to: {cbtExams.find((e: any) => e.id === bulkExamId)?.title}
                  </p>
                )}
              </div>
              <button onClick={() => { setShowBulk(false); setBulkFile(null); }} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="p-4" style={{ borderRadius: "var(--radius-lg)", background: "var(--cobalt-tint)", border: "1px solid color-mix(in oklch, var(--cobalt-signal) 20%, transparent)" }}>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--cobalt-signal)" }}>Expected format</p>
                <p className="text-xs font-mono leading-relaxed" style={{ color: "var(--cobalt-signal)", opacity: 0.85 }}>
                  question | option_a | option_b | option_c | option_d | correct_answer | points
                </p>
                <p className="text-xs mt-1.5" style={{ color: "var(--cobalt-signal)", opacity: 0.75 }}>correct_answer: A, B, C, or D. Points is optional (defaults to 1).</p>
              </div>
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
                <input type="file" accept=".csv,.xlsx,.xls,.ods,.tsv" className="hidden" onChange={(e) => setBulkFile(e.target.files?.[0] || null)} />
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
