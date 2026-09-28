"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchAssessments,
  fetchClasses,
  fetchSubjects,
  createAssessment,
  deleteAssessment,
  fetchAssessmentCategoriesMap,
} from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { ManageCategoriesDialog } from "@/components/RMS/ManageCategoriesDialog";
import { Header } from "@/components/RMS/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  X,
  MoreVertical,
  Trash2,
  Eye,
  MonitorCheck,
  Clock,
  FileQuestion,
  ChevronRight,
  Filter,
} from "lucide-react";
import { format } from "date-fns";

const getStatusStyle = (status?: string) => {
  if (status === "started" || status === "active")
    return { background: "var(--emerald-tint)", color: "var(--emerald-signal)", label: "Active" };
  if (status === "ended")
    return { background: "var(--surface-muted)", color: "var(--foreground-muted)", label: "Ended" };
  return { background: "var(--amber-tint)", color: "var(--amber-signal)", label: "Pending" };
};

export function CBTExamsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { assessments, classes, subjects, loading, assessmentCategories, cbtExamIds } =
    useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    classIds: [] as string[],
    subjectNames: [] as string[],
    categoryId: "",
    totalMarks: "",
    passingMarks: "",
    durationMins: "",
    term: "",
    instructions: "",
    startsAt: "",
    endsAt: "",
    shuffleQuestions: false,
    shuffleOptions: false,
  });

  useEffect(() => {
    dispatch(fetchAssessments());
    dispatch(fetchClasses(undefined));
    dispatch(fetchSubjects());
    dispatch(getTenantInfo());
    dispatch(fetchAssessmentCategoriesMap());
  }, []);

  const cbtExamIdSet = useMemo(() => {
    const fromStorage: string[] = (() => {
      try { return JSON.parse(localStorage.getItem("cbt_exam_ids") || "[]"); } catch { return []; }
    })();
    return new Set([...cbtExamIds, ...fromStorage]);
  }, [cbtExamIds]);
  const cbtExams = useMemo(
    () => assessments.filter((a: any) => cbtExamIdSet.has(a.id) || !!a.isOnline),
    [assessments, cbtExamIdSet],
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

  const filtered = useMemo(() => {
    let result = cbtExams;
    if (classFilter !== "all") result = result.filter((a: any) => a.classId === classFilter);
    if (statusFilter !== "all") {
      result = result.filter((a: any) => {
        if (statusFilter === "active") return a.status === "started" || a.status === "active";
        if (statusFilter === "ended") return a.status === "ended";
        if (statusFilter === "pending") return !a.status || a.status === "not_started";
        return true;
      });
    }
    const term = q.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (a: any) =>
          (a.title || "").toLowerCase().includes(term) ||
          (subjectNameById.get(a.subjectId || "") || "").toLowerCase().includes(term),
      );
    }
    return result;
  }, [cbtExams, classFilter, statusFilter, q, subjectNameById]);

  // Subjects available for selected classes
  const subjectsInSelectedClasses = useMemo(() => {
    if (form.classIds.length === 0) return [];
    const flat: Array<{ subjectId: string; name: string; classId: string; classSubjectId: string }> = [];
    for (const s of subjects) {
      const cs: any[] = s.classSubjects || [];
      for (const c of cs) {
        if (form.classIds.includes(c.classId)) {
          flat.push({ subjectId: s.id, name: s.name, classId: c.classId, classSubjectId: c.id });
        }
      }
      if (cs.length === 0 && s.classId && form.classIds.includes(s.classId)) {
        flat.push({ subjectId: s.id, name: s.name, classId: s.classId, classSubjectId: "" });
      }
    }
    return flat;
  }, [subjects, form.classIds]);

  const uniqueSubjectNames = useMemo(() => {
    const names = new Set<string>();
    subjectsInSelectedClasses.forEach((s) => names.add(s.name));
    return Array.from(names).sort();
  }, [subjectsInSelectedClasses]);

  const resetForm = () => {
    setForm({
      title: "", classIds: [], subjectNames: [], categoryId: "",
      totalMarks: "", passingMarks: "", durationMins: "", term: "",
      instructions: "", startsAt: "", endsAt: "",
      shuffleQuestions: false, shuffleOptions: false,
    });
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.categoryId) return toast.error("Category is required");
    if (form.classIds.length === 0) return toast.error("Select at least one class");
    if (form.subjectNames.length === 0) return toast.error("Select at least one subject");
    if (!form.startsAt) return toast.error("Start date is required");

    const pairs = subjectsInSelectedClasses.filter((s) => form.subjectNames.includes(s.name));
    if (pairs.length === 0) return toast.error("No matching subjects for selected classes");

    setCreating(true);
    try {
      const results = await Promise.all(
        pairs.map(({ classId, subjectId, classSubjectId }) => {
          const start = new Date(form.startsAt);
          const duration = form.durationMins ? Number(form.durationMins) : 60;
          const end = form.endsAt ? new Date(form.endsAt) : new Date(start.getTime() + duration * 60000);
          return dispatch(
            createAssessment({
              title: form.title.trim(),
              classSubjectIds: classSubjectId ? [classSubjectId] : [],
              ...(form.categoryId ? { categoryId: form.categoryId } : {}),
              ...(form.totalMarks ? { totalMarks: Number(form.totalMarks) } : {}),
              ...(form.passingMarks ? { passingMarks: Number(form.passingMarks) } : {}),
              isOnline: true,
              duration,
              durationMins: duration,
              ...(form.term ? { term: form.term } : {}),
              ...(form.instructions ? { instructions: form.instructions } : {}),
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
              questions: [],
            }),
          ).unwrap();
        }),
      );
      // Persist new CBT exam IDs to localStorage regardless of backend response shape
      const newIds = results.map((r: any) => r?.id).filter(Boolean) as string[];
      if (newIds.length > 0) {
        try {
          const stored: string[] = JSON.parse(localStorage.getItem("cbt_exam_ids") || "[]");
          localStorage.setItem("cbt_exam_ids", JSON.stringify([...new Set([...stored, ...newIds])]));
        } catch {}
      }
      toast.success(`${pairs.length} exam${pairs.length > 1 ? "s" : ""} created`);
      resetForm();
      setShowCreate(false);
      dispatch(fetchAssessments());
    } catch (e: any) {
      toast.error(e || "Failed to create exam");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await dispatch(deleteAssessment(id)).unwrap();
      dispatch(fetchAssessments());
    } catch (e: any) {
      toast.error(e || "Failed to delete exam");
    }
  };

  return (
    <div className="w-full">
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>CBT Exams</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>Create and manage all computer-based exams.</p>
        </div>
        <Button
          className="gap-2 text-white shadow-sm h-10"
          style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" /> Create Exam
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search exams..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 rounded-xl border-slate-200 bg-white shadow-sm"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="h-11 w-full md:w-[160px] rounded-xl border-slate-200 bg-white shadow-sm">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-full md:w-[150px] rounded-xl border-slate-200 bg-white shadow-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Exams", value: cbtExams.length },
          { label: "Active", value: cbtExams.filter((a: any) => a.status === "started" || a.status === "active").length },
          { label: "Completed", value: cbtExams.filter((a: any) => a.status === "ended").length },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 text-center" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{loading ? "—" : s.value}</p>
            <p className="text-xs uppercase tracking-wide font-semibold mt-0.5" style={{ color: "var(--foreground-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Exam list */}
      {loading && cbtExams.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
        </div>
      ) : (
        <div className="bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <MonitorCheck className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
              <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No exams found</p>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Create a new CBT exam to get started.</p>
            </div>
          ) : (
            <div>
              {filtered.map((exam: any) => {
                const ss = getStatusStyle(exam.status);
                const subjectName = subjectNameById.get(exam.subjectId || "") || "—";
                const className = classNameById.get(exam.classId || "") || "—";
                const qCount = exam.questionCount ?? exam._count?.questions ?? 0;
                return (
                  <div
                    key={exam.id}
                    className="px-5 py-4 flex items-center gap-4 transition-colors"
                    style={{ borderTop: "1px solid var(--border-fine)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                      <MonitorCheck className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{exam.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{subjectName}</span>
                        <span className="text-xs" style={{ color: "var(--border-medium)" }}>•</span>
                        <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{className}</span>
                        {exam.durationMins && (
                          <>
                            <span className="text-xs" style={{ color: "var(--border-medium)" }}>•</span>
                            <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                              <Clock className="w-3 h-3" />{exam.durationMins} min
                            </span>
                          </>
                        )}
                        <span className="text-xs" style={{ color: "var(--border-medium)" }}>•</span>
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                          <FileQuestion className="w-3 h-3" />{qCount} questions
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {exam.startsAt && (
                        <span className="text-xs hidden lg:block" style={{ color: "var(--foreground-muted)" }}>
                          {format(new Date(exam.startsAt), "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: ss.background, color: ss.color }}>
                        {ss.label}
                      </span>
                      <Link href={`/RMS/cbt/exams/${exam.id}`}>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-slate-200 text-xs">
                          <Eye className="w-3.5 h-3.5" /> Open
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem
                            onClick={() => handleDelete(exam.id, exam.title)}
                            className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Exam Modal */}
      {showCreate && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-white w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create CBT Exam</h2>
                <p className="text-sm text-slate-500 mt-0.5">Select classes and subjects — one exam per matching pair.</p>
              </div>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 grid grid-cols-3 gap-5">
              {/* Col 1: exam settings */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Title <span className="text-red-500">*</span></label>
                  <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. First Term Exam" className="mt-2 h-10 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
                  {assessmentCategories.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 h-10">
                      <span className="text-xs text-slate-400 flex-1">No categories yet</span>
                      <ManageCategoriesDialog>
                        <button type="button" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--violet-ink)" }}>
                          Create category
                        </button>
                      </ManageCategoriesDialog>
                    </div>
                  ) : (
                    <Select value={form.categoryId} onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}>
                      <SelectTrigger className="mt-2 h-10 rounded-xl text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent className="rounded-xl z-[99999]">
                        {assessmentCategories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Total Marks</label>
                    <Input type="number" min={0} value={form.totalMarks} onChange={(e) => setForm((p) => ({ ...p, totalMarks: e.target.value }))} placeholder="100" className="mt-2 h-10 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Pass Mark</label>
                    <Input type="number" min={0} value={form.passingMarks} onChange={(e) => setForm((p) => ({ ...p, passingMarks: e.target.value }))} placeholder="50" className="mt-2 h-10 rounded-xl text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Duration (mins)</label>
                    <Input type="number" min={1} value={form.durationMins} onChange={(e) => setForm((p) => ({ ...p, durationMins: e.target.value }))} placeholder="60" className="mt-2 h-10 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Term</label>
                    <Select value={form.term} onValueChange={(v) => setForm((p) => ({ ...p, term: v }))}>
                      <SelectTrigger className="mt-2 h-10 rounded-xl text-sm"><SelectValue placeholder="Term" /></SelectTrigger>
                      <SelectContent className="rounded-xl z-[99999]">
                        <SelectItem value="1st Term">1st Term</SelectItem>
                        <SelectItem value="2nd Term">2nd Term</SelectItem>
                        <SelectItem value="3rd Term">3rd Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Start Date <span className="text-red-500">*</span></label>
                  <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} className="mt-2 h-10 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">End Date</label>
                  <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} className="mt-2 h-10 rounded-xl text-sm" />
                </div>
                <div className="space-y-2.5 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <Checkbox checked={form.shuffleQuestions} onCheckedChange={(v) => setForm((p) => ({ ...p, shuffleQuestions: !!v }))} />
                    <span className="text-sm font-medium text-slate-700">Shuffle question order</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <Checkbox checked={form.shuffleOptions} onCheckedChange={(v) => setForm((p) => ({ ...p, shuffleOptions: !!v }))} />
                    <span className="text-sm font-medium text-slate-700">Shuffle answer options</span>
                  </label>
                </div>
              </div>

              {/* Col 2: class picker */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Classes <span className="text-red-500">*</span>
                    {form.classIds.length > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">({form.classIds.length})</span>}
                  </label>
                  {form.classIds.length > 0 && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, classIds: [], subjectNames: [] }))} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                  )}
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden flex-1">
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                    <Checkbox checked={form.classIds.length === classes.length && classes.length > 0} onCheckedChange={(v) => setForm((p) => ({ ...p, classIds: v ? classes.map((c) => c.id) : [], subjectNames: [] }))} />
                    <span className="text-xs font-semibold text-slate-700">Select All</span>
                  </label>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {classes.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                        <Checkbox checked={form.classIds.includes(c.id)} onCheckedChange={(v) => setForm((p) => ({ ...p, classIds: v ? [...p.classIds, c.id] : p.classIds.filter((id) => id !== c.id), subjectNames: [] }))} />
                        <span className="text-sm text-slate-800">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Col 3: subject picker */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Subjects <span className="text-red-500">*</span>
                    {form.subjectNames.length > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">({form.subjectNames.length})</span>}
                  </label>
                  {form.subjectNames.length > 0 && (
                    <button type="button" onClick={() => setForm((p) => ({ ...p, subjectNames: [] }))} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                  )}
                </div>
                {form.classIds.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl flex items-center justify-center flex-1 text-xs text-slate-400 text-center px-3">Select classes first</div>
                ) : uniqueSubjectNames.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl flex items-center justify-center flex-1 text-xs text-slate-400 text-center px-3">No subjects in selected classes</div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden flex-1">
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                      <Checkbox checked={form.subjectNames.length === uniqueSubjectNames.length} onCheckedChange={(v) => setForm((p) => ({ ...p, subjectNames: v ? [...uniqueSubjectNames] : [] }))} />
                      <span className="text-xs font-semibold text-slate-700">Select All</span>
                    </label>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {uniqueSubjectNames.map((name) => (
                        <label key={name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                          <Checkbox checked={form.subjectNames.includes(name)} onCheckedChange={(v) => setForm((p) => ({ ...p, subjectNames: v ? [...p.subjectNames, name] : p.subjectNames.filter((n) => n !== name) }))} />
                          <span className="text-sm text-slate-800">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                {form.classIds.length > 0 && form.subjectNames.length > 0
                  ? `${subjectsInSelectedClasses.filter((s) => form.subjectNames.includes(s.name)).length} exam(s) will be created`
                  : "Select classes and subjects"}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }} className="h-11 px-6 rounded-xl">Cancel</Button>
                <Button onClick={handleCreate} disabled={creating} className="h-11 px-6 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                  {creating ? "Creating..." : "Create Exam(s)"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
