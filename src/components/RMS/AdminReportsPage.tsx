"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import Image from "next/image";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { fetchClasses, fetchStudentsByClass, fetchClassReportCards } from "@/reduxToolKit/admin/adminThunks";
import { clearAdminError, clearAdminSuccess } from "@/reduxToolKit/admin/adminSlice";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";
import { useGetSchoolReportCardTemplatesQuery } from "@/reduxToolKit/api/endpoints/settings";
import { useDeleteReportCardMutation, useDeleteClassReportCardsMutation, useDeleteClassReportCardJobMutation } from "@/reduxToolKit/api/endpoints/reports";
import { Header } from "@/components/RMS/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, FileText, ChevronLeft, ChevronRight,
  Loader2, ExternalLink, Users, LayoutTemplate, CheckCircle2, ImageOff,
  CheckCircle, XCircle, Clock, Trash, Share2, ShieldCheck, Send, Star, Sparkles,
} from "lucide-react";
import apiClient from "@/lib/api";
import { ProductTour } from "@/components/common/ProductTour";
import { ShareReportModal } from "@/components/Report/ShareReportModal";
import { SignReportModal } from "@/components/Report/SignReportModal";
import { BulkShareReportModal } from "@/components/Report/BulkShareReportModal";
import { PsychomotorEvaluationModal } from "@/components/Report/PsychomotorEvaluationModal";
import { ReportAuditTrailModal } from "@/components/Report/ReportAuditTrailModal";

const reportTourSteps = [
  { target: ".reports-filter-card", content: "Select Class, Session, Term and a template to get started.", disableBeacon: true },
  { target: ".reports-tab-nav", content: "Switch between Generate and Download tabs." },
  { target: ".reports-individual-actions", content: "Search students and generate individual report cards." },
  { target: ".reports-class-actions", content: "Use class-wide bulk generation to create PDFs for all students at once." },
];

type TabType = "generation" | "download";

type ClassJobStatus = {
  recordId: string;
  format: "combined" | "individual";
  status: "processing" | "completed" | "failed";
  documentUrl?: string;
  successCount?: number;
  failCount?: number;
  failureReason?: string;
};

// ── Template Picker Dialog ───────────────────────────────────────────────────
function TemplatePicker({
  open, onOpenChange, templates, selectedId, onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: any[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Choose Report Card Template</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <div className="py-16 text-center space-y-2" style={{ color: "var(--foreground-muted)" }}>
            <ImageOff className="mx-auto h-10 w-10" />
            <p className="text-sm">No active templates. Add templates in School Settings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            <button
              onClick={() => { onSelect("__active__"); onOpenChange(false); }}
              className="relative overflow-hidden text-left transition-all"
              style={{ borderRadius: "var(--radius-xl)", border: `2px solid ${selectedId === "__active__" ? "var(--violet-ink)" : "var(--border-fine)"}`, boxShadow: selectedId === "__active__" ? "var(--shadow-card)" : "none" }}
            >
              <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2" style={{ background: "var(--violet-tint)" }}>
                <LayoutTemplate className="w-10 h-10" style={{ color: "var(--violet-ink)", opacity: 0.5 }} />
                <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>Default / Auto</span>
              </div>
              <div className="p-3" style={{ borderTop: "1px solid var(--border-fine)" }}>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Auto (first active)</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Use school's default active template</p>
              </div>
              {selectedId === "__active__" && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--violet-ink)" }}>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
            {templates.map((t: any) => {
              const tpl = t.template ?? {};
              const isSelected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t.id); onOpenChange(false); }}
                  className="relative overflow-hidden text-left transition-all"
                  style={{ borderRadius: "var(--radius-xl)", border: `2px solid ${isSelected ? "var(--violet-ink)" : "var(--border-fine)"}`, boxShadow: isSelected ? "var(--shadow-card)" : "none" }}
                >
                  <div className="aspect-[3/4] bg-slate-100 overflow-hidden">
                    {tpl.thumbnailUrl ? (
                      <Image src={tpl.thumbnailUrl} alt={tpl.name ?? "Template"} width={300} height={400} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="h-10 w-10 text-slate-300" /></div>
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100">
                    <p className="font-semibold text-sm text-slate-800 truncate">{tpl.name ?? "Template"}</p>
                    {tpl.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tpl.description}</p>}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--violet-ink)" }}>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Selected Template Preview chip ──────────────────────────────────────────
function SelectedTemplateChip({ templates, selectedId, onChangClick }: {
  templates: any[];
  selectedId: string;
  onChangClick: () => void;
}) {
  const selected = templates.find((t) => t.id === selectedId);
  const tpl = selected?.template ?? null;
  const thumb = tpl?.thumbnailUrl;
  const name = tpl?.name ?? "Auto (first active)";
  return (
    <button
      onClick={onChangClick}
      className="flex items-center gap-3 px-4 py-2.5 transition-all group w-full"
      style={{ borderRadius: "var(--radius-lg)", border: "2px dashed color-mix(in oklch, var(--violet-ink) 30%, transparent)", background: "var(--violet-tint)" }}
    >
      <div className="w-10 h-12 overflow-hidden bg-white shrink-0" style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)" }}>
        {thumb ? (
          <Image src={thumb} alt={name} width={40} height={48} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--violet-tint)" }}>
            <LayoutTemplate className="w-5 h-5" style={{ color: "var(--violet-ink)", opacity: 0.5 }} />
          </div>
        )}
      </div>
      <div className="text-left flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--violet-ink)" }}>Template</p>
        <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>{name}</p>
      </div>
      <span className="text-xs font-semibold group-hover:underline shrink-0" style={{ color: "var(--violet-ink)" }}>Change</span>
    </button>
  );
}

// ── Class Job Status Banner ──────────────────────────────────────────────────
function ClassJobBanner({ job, onViewDownloads, onOpenPdf, onDismiss }: {
  job: ClassJobStatus;
  onViewDownloads: () => void;
  onOpenPdf: (url: string) => void;
  onDismiss: () => void;
}) {
  if (job.status === "processing") {
    return (
      <div className="flex items-center gap-3 p-4 mt-3" style={{ borderRadius: "var(--radius-lg)", background: "var(--cobalt-tint)", border: "1px solid color-mix(in oklch, var(--cobalt-signal) 20%, transparent)" }}>
        <Loader2 className="w-5 h-5 animate-spin shrink-0" style={{ color: "var(--cobalt-signal)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--cobalt-signal)" }}>
            Generating {job.format === "combined" ? "combined PDF" : "individual report cards"}…
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--cobalt-signal)", opacity: 0.8 }}>This may take a few minutes. You can navigate away safely.</p>
        </div>
      </div>
    );
  }
  if (job.status === "completed") {
    return (
      <div className="flex items-center gap-3 p-4 mt-3" style={{ borderRadius: "var(--radius-lg)", background: "var(--emerald-tint)", border: "1px solid color-mix(in oklch, var(--emerald-signal) 20%, transparent)" }}>
        <CheckCircle className="w-5 h-5 shrink-0" style={{ color: "var(--emerald-signal)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--emerald-signal)" }}>
            {job.format === "combined" ? "Combined PDF is ready!" : `${job.successCount ?? 0} report cards generated`}
          </p>
          {!!job.failCount && (
            <p className="text-xs mt-0.5" style={{ color: "var(--amber-signal)" }}>{job.failCount} student(s) failed</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.format === "combined" && job.documentUrl && (
            <Button size="sm" onClick={() => onOpenPdf(job.documentUrl!)} className="gap-1.5 h-8 text-white" style={{ background: "var(--emerald-signal)" }}>
              <ExternalLink className="w-3.5 h-3.5" />Open PDF
            </Button>
          )}
          {job.format === "individual" && (
            <Button size="sm" variant="outline" onClick={onViewDownloads} className="gap-1.5 h-8" style={{ borderColor: "color-mix(in oklch, var(--emerald-signal) 30%, transparent)", color: "var(--emerald-signal)" }}>
              <Download className="w-3.5 h-3.5" />View Downloads
            </Button>
          )}
          <button onClick={onDismiss} className="p-1 rounded" style={{ color: "var(--foreground-muted)" }}>✕</button>
        </div>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex items-center gap-3 p-4 mt-3" style={{ borderRadius: "var(--radius-lg)", background: "var(--crimson-tint)", border: "1px solid color-mix(in oklch, var(--crimson-signal) 20%, transparent)" }}>
        <XCircle className="w-5 h-5 shrink-0" style={{ color: "var(--crimson-signal)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--crimson-signal)" }}>Generation failed</p>
          {job.failureReason && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--crimson-signal)", opacity: 0.8 }}>{job.failureReason}</p>}
        </div>
        <button onClick={onDismiss} className="p-1 rounded shrink-0" style={{ color: "var(--foreground-muted)" }}>✕</button>
      </div>
    );
  }
  return null;
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function AdminReportsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { classes, error, success } = useSelector((s: RootState) => s.admin);
  const { user, tenantInfo } = useSelector((s: RootState) => s.user);
  const [activeTab, setActiveTab] = useState<TabType>("generation");
  const [classId, setClassId] = useState("");
  const [session, setSession] = useState("");
  const [term, setTerm] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("__active__");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [generatingStudents, setGeneratingStudents] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [search, setSearch] = useState("");

  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const [deleteReportCard] = useDeleteReportCardMutation();
  const [deleteClassReports] = useDeleteClassReportCardsMutation();
  const [deleteClassJob] = useDeleteClassReportCardJobMutation();
  const [deletingReports, setDeletingReports] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set());

  const [classJob, setClassJob] = useState<ClassJobStatus | null>(null);
  const [classJobHistory, setClassJobHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [shareModal, setShareModal] = useState<{
    open: boolean;
    reportId: string;
    studentName: string;
    defaultPhone?: string;
    defaultEmail?: string;
  }>({ open: false, reportId: "", studentName: "" });

  const [signModal, setSignModal] = useState<{
    open: boolean;
    reportId: string;
    studentName: string;
    signatures: any[];
    checksum: string;
    isVerified: boolean;
  }>({ open: false, reportId: "", studentName: "", signatures: [], checksum: "", isVerified: false });

  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const [psychomotorModal, setPsychomotorModal] = useState<{
    open: boolean;
    reportCardId: string;
    studentId?: string;
    studentName?: string;
  }>({ open: false, reportCardId: "", studentId: "", studentName: "" });

  const [auditModal, setAuditModal] = useState<{
    open: boolean;
    reportCardId: string;
    studentName?: string;
  }>({ open: false, reportCardId: "", studentName: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { sessionOptions, getTermsForSession, currentSession: apiCurrentSession, currentTerm: apiCurrentTerm } = useSessionsAndTerms();
  const termOptions = useMemo(() => (!session ? [] : getTermsForSession(session)), [session, getTermsForSession]);

  const { data: schoolTemplates = [] } = useGetSchoolReportCardTemplatesQuery();
  const activeTemplates = useMemo(() => schoolTemplates.filter((t: any) => t.isActive), [schoolTemplates]);

  const resolvedTemplateId = selectedTemplateId === "__active__" ? undefined : selectedTemplateId;

  const hasRole = user?.roles && user.roles.length > 0;

  useEffect(() => {
    if (!hasRole) return;
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
  }, [dispatch, hasRole]);

  useEffect(() => {
    if (apiCurrentSession && !session) setSession(apiCurrentSession);
    if (apiCurrentTerm && !term) setTerm(apiCurrentTerm);
  }, [apiCurrentSession, apiCurrentTerm, session, term]);

  useEffect(() => {
    if (!hasRole || !classId || !session || !term) return;
    if (activeTab === "generation") fetchStudents();
    else { fetchReports(); fetchClassJobHistory(); }
  }, [activeTab, classId, session, term, hasRole]);

  // Reset job state when filters change
  useEffect(() => {
    setClassJob(null);
    setClassJobHistory([]);
  }, [classId, session, term]);

  useEffect(() => {
    if (error) { toast.error(error); dispatch(clearAdminError()); }
    if (success) { toast.success(success); dispatch(clearAdminSuccess()); }
  }, [error, success, dispatch]);

  // ── Async polling for class job ────────────────────────────────────────────
  useEffect(() => {
    if (!classJob?.recordId || classJob.status !== "processing") return;
    const recordId = classJob.recordId;
    const format = classJob.format;
    let stopped = false;
    let tid: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await apiClient.get(`/api/proxy/reports/class/${classId}/report-cards/status?recordId=${recordId}`);
        const data = res.data?.data;
        if (data?.status === "completed") {
          stopped = true;
          setClassJob(prev => prev?.recordId === recordId ? {
            ...prev, status: "completed",
            documentUrl: data.documentUrl,
            successCount: data.successCount,
            failCount: data.failCount,
          } : prev);
          if (format === "combined" && data.documentUrl) {
            toast.success("Combined PDF is ready!");
            window.open(data.documentUrl, "_blank");
          } else if (format === "individual") {
            toast.success(`Generated ${data.successCount ?? 0} report cards`);
            setActiveTab("download");
            setTimeout(() => { fetchReports(); fetchClassJobHistory(); }, 500);
          }
        } else if (data?.status === "failed") {
          stopped = true;
          setClassJob(prev => prev?.recordId === recordId ? {
            ...prev, status: "failed", failureReason: data.failureReason,
          } : prev);
          toast.error(data?.failureReason || "Class report card generation failed");
        } else {
          tid = setTimeout(poll, 3000);
        }
      } catch {
        if (!stopped) tid = setTimeout(poll, 5000);
      }
    };

    tid = setTimeout(poll, 2000);
    return () => { stopped = true; clearTimeout(tid); };
  }, [classJob?.recordId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const result = await dispatch(fetchStudentsByClass({ classId })).unwrap();
      setStudents(result || []);
    } catch (e: any) {
      toast.error(e || "Failed to load students");
      setStudents([]);
    } finally { setLoadingStudents(false); }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const result = await dispatch(fetchClassReportCards({ classId, session, term })).unwrap();
      const flat: any[] = [];
      if (Array.isArray(result)) {
        result.forEach((student: any) => {
          (student.reportCardsAsStudent || []).forEach((report: any) => {
            flat.push({ ...report, studentName: `${student.firstName || ""} ${student.lastName || ""}`.trim(), studentId: student.id });
          });
        });
      }
      setReportCards(flat);
    } catch (e: any) {
      toast.error(e || "Failed to load report cards");
      setReportCards([]);
    } finally { setLoadingReports(false); }
  };

  const fetchClassJobHistory = async () => {
    if (!classId || !session || !term) return;
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(
        `/api/proxy/reports/class/${classId}/report-cards/history?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`
      );
      setClassJobHistory(res.data?.data || []);
    } catch {
      setClassJobHistory([]);
    } finally { setLoadingHistory(false); }
  };

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter((s: any) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.studentId || "").toLowerCase().includes(q));
  }, [students, search]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = useMemo(() => filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredStudents, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [search, classId]);

  const toggleStudent = (id: string) => {
    const s = new Set(selectedStudents);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedStudents(s);
  };
  const toggleAll = () => setSelectedStudents(
    selectedStudents.size === filteredStudents.length ? new Set() : new Set(filteredStudents.map((s: any) => s.id))
  );

  const templateParam = resolvedTemplateId ? `&templateId=${encodeURIComponent(resolvedTemplateId)}` : "";

  const generateOne = async (studentId: string) => {
    if (!classId || !session || !term) { toast.error("Select class, session, and term"); return; }
    setGeneratingStudents((p) => new Set(p).add(studentId));
    try {
      const res = await apiClient.get(`/api/proxy/reports/student/${studentId}/${classId}/report-card/pdf?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}${templateParam}`);
      if (res.data?.success) toast.success(res.data.message || "Report card queued");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to generate");
    } finally {
      setGeneratingStudents((p) => { const s = new Set(p); s.delete(studentId); return s; });
    }
  };

  const generateSelected = async () => {
    if (!selectedStudents.size) { toast.error("Select at least one student"); return; }
    toast.info(`Queuing ${selectedStudents.size} report cards…`);
    for (const id of selectedStudents) { await generateOne(id); await new Promise((r) => setTimeout(r, 300)); }
    setSelectedStudents(new Set());
    toast.success("Selected report cards queued");
  };

  const generateAllClass = async (format: "combined" | "individual") => {
    if (!classId || !session || !term) { toast.error("Select class, session, and term"); return; }
    if (classJob?.status === "processing") { toast.info("Generation already in progress…"); return; }
    const label = format === "combined" ? "combined PDF" : "individual PDFs";
    if (!confirm(`Queue ${label} generation for all ${filteredStudents.length} students?`)) return;
    setBulkGenerating(true);
    try {
      const payload = { session, term, format, ...(resolvedTemplateId && { templateId: resolvedTemplateId }) };
      const res = await apiClient.post(
        `/api/proxy/reports/class/${classId}/report-cards/queue`,
        payload,
        {
          params: payload
        }
      );
      if (res.data?.success) {
        setClassJob({ recordId: res.data.data?.recordId || res.data.recordId, format, status: "processing" });
        toast.info(`Queued ${label} for ${filteredStudents.length} students`);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to queue generation");
    } finally { setBulkGenerating(false); }
  };

  const openPdf = (url: string, name?: string) => {
    window.open(url, "_blank");
    if (name) toast.success(`Opening report card for ${name}`);
    setDownloadingReport(url);
    setTimeout(() => setDownloadingReport(null), 1000);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report card? This cannot be undone.")) return;
    
    setDeletingReports(prev => new Set(prev).add(reportId));
    try {
      const res = await deleteReportCard(reportId).unwrap();
      if (res?.success) {
        toast.success(res.message || "Report card deleted");
        fetchReports();
      }
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete report card");
    } finally {
      setDeletingReports(prev => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  const handleDeleteClassJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this class PDF job? This action cannot be undone.")) return;
    
    setDeletingJobs(prev => new Set(prev).add(jobId));
    try {
      const res = await deleteClassJob(jobId).unwrap();
      if (res?.success) {
        toast.success(res.message || "Class PDF job deleted");
        fetchClassJobHistory();
      }
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete class PDF job");
    } finally {
      setDeletingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!classId || !session || !term) return toast.error("Select class, session, and term");
    if (!confirm("Are you sure you want to delete ALL report cards for this class, session, and term? This cannot be undone.")) return;

    setIsBulkDeleting(true);
    try {
      const res = await deleteClassReports({ classId, session, term }).unwrap();
      if (res?.success) {
        toast.success(res.message || "Class report cards deleted");
        fetchReports();
        fetchClassJobHistory();
      }
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to delete class report cards");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  const statusStyle = (s: string): React.CSSProperties => ({
    approved: { background: "var(--emerald-tint)", color: "var(--emerald-signal)" },
    published: { background: "var(--emerald-tint)", color: "var(--emerald-signal)" },
    pending: { background: "var(--amber-tint)", color: "var(--amber-signal)" },
    rejected: { background: "var(--crimson-tint)", color: "var(--crimson-signal)" },
    processing: { background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
    completed: { background: "var(--emerald-tint)", color: "var(--emerald-signal)" },
    failed: { background: "var(--crimson-tint)", color: "var(--crimson-signal)" },
  }[s?.toLowerCase()] ?? { background: "var(--surface-muted)", color: "var(--foreground-muted)" });

  const fmtBytes = (b: number) => { if (!b) return "N/A"; const k = b / 1024; return k < 1024 ? `${k.toFixed(1)} KB` : `${(k / 1024).toFixed(1)} MB`; };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";

  return (
    <div className="min-h-screen">
      <ProductTour tourKey="admin_reports" steps={reportTourSteps} />
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Report Cards</h1>
            <p className="mt-1" style={{ color: "var(--foreground-muted)" }}>Generate report cards, evaluate psychomotor & affective domains, and dispatch via WhatsApp / Email</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setBulkShareOpen(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-xl font-semibold"
            >
              <Send className="w-4 h-4" />
              Bulk Dispatch (WhatsApp & Email)
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="reports-filter-card p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Class</label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Session</label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>{sessionOptions.map((o) => <SelectItem key={o.id || o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>Term</label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>{termOptions.map((o) => <SelectItem key={o.id || o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-1">
            <label className="text-sm font-medium mb-2 block" style={{ color: "var(--foreground-muted)" }}>Report Card Template</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-sm">
                <SelectedTemplateChip templates={activeTemplates} selectedId={selectedTemplateId} onChangClick={() => setTemplatePickerOpen(true)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => setTemplatePickerOpen(true)} className="gap-2 rounded-xl shrink-0">
                <LayoutTemplate className="w-4 h-4" />Select Template
              </Button>
            </div>
          </div>
        </Card>

        <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} templates={activeTemplates} selectedId={selectedTemplateId} onSelect={setSelectedTemplateId} />

        {/* Tabs */}
        <div className="reports-tab-nav" style={{ borderBottom: "1px solid var(--border-fine)" }}>
          <nav className="-mb-px flex space-x-8">
            {(["generation", "download"] as TabType[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="py-4 px-1 border-b-2 font-medium text-sm transition-colors"
                style={{ borderBottomColor: activeTab === tab ? "var(--violet-ink)" : "transparent", color: activeTab === tab ? "var(--violet-ink)" : "var(--foreground-muted)" }}
              >
                {tab === "generation"
                  ? <><FileText className="inline-block w-5 h-5 mr-2" />Generate Reports</>
                  : <><Download className="inline-block w-5 h-5 mr-2" />Download Reports</>}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {!classId || !session || !term ? (
          <Card className="p-12">
            <div className="text-center" style={{ color: "var(--foreground-muted)" }}>
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select class, session, and term to get started</p>
            </div>
          </Card>
        ) : activeTab === "generation" ? (
          <div className="space-y-4">
            {/* Individual student generation */}
            <Card className="p-6 space-y-4">
              <div className="reports-individual-actions flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Individual Report Cards</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Generate report cards for specific students</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Search students…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-9" />
                  <Button variant="outline" size="sm" onClick={generateSelected} disabled={!selectedStudents.size || loadingStudents}>
                    Generate Selected ({selectedStudents.size})
                  </Button>
                </div>
              </div>

              {loadingStudents ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--violet-ink)" }} /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-gray-500"><p>No students found</p></div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0} onCheckedChange={toggleAll} />
                          </TableHead>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedStudents.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell><Checkbox checked={selectedStudents.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} /></TableCell>
                            <TableCell className="font-mono text-sm">{s.studentId || "N/A"}</TableCell>
                            <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => generateOne(s.id)} disabled={generatingStudents.has(s.id) || bulkGenerating}>
                                  {generatingStudents.has(s.id) ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : <><FileText className="w-4 h-4 mr-2" />Generate</>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200"
                                  onClick={() => setPsychomotorModal({
                                    open: true,
                                    reportCardId: `student_${s.id}_${session}_${term}`,
                                    studentId: s.id,
                                    studentName: `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Student",
                                  })}
                                  title="Evaluate Affective & Psychomotor Domain"
                                >
                                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                  <span className="hidden sm:inline text-xs font-semibold">Psychomotor</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                        <span className="px-4 py-2 text-sm">Page {currentPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Class-wide bulk generation */}
            <Card className="reports-class-actions p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Users className="w-4 h-4 " style={{ color: "var(--violet-ink)" }} />
                    <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Class-Wide Generation</h2>
                  </div>
                  <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    Generate report cards for all {filteredStudents.length > 0 ? filteredStudents.length : ""} students at once. Runs in the background.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => generateAllClass("combined")}
                    disabled={!filteredStudents.length || loadingStudents || bulkGenerating || classJob?.status === "processing"}
                    className="gap-2"
                  >
                    {bulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Combined PDF
                  </Button>
                  <Button
                    style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
                    onClick={() => generateAllClass("individual")}
                    disabled={!filteredStudents.length || loadingStudents || bulkGenerating || classJob?.status === "processing"}
                    className="gap-2 text-white"
                  >
                    {bulkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                    Individual PDFs
                  </Button>
                </div>
              </div>

              {classJob && (
                <ClassJobBanner
                  job={classJob}
                  onViewDownloads={() => { setActiveTab("download"); fetchReports(); fetchClassJobHistory(); }}
                  onOpenPdf={(url) => openPdf(url)}
                  onDismiss={() => setClassJob(null)}
                />
              )}
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Class PDF history */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Class PDF Jobs</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Bulk generation history for {selectedClass?.name || "this class"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchClassJobHistory} disabled={loadingHistory} className="gap-2">
                  {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  Refresh
                </Button>
              </div>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--violet-ink)" }} /></div>
              ) : classJobHistory.length === 0 ? (
                <div className="text-center py-8" style={{ color: "var(--foreground-muted)" }}>
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No class PDF jobs yet. Use "Class-Wide Generation" to get started.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>File Size</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classJobHistory.map((job: any) => (
                        <TableRow key={job.id}>
                          <TableCell className="text-sm" style={{ color: "var(--foreground-muted)" }}>{fmtDate(job.createdAt)}</TableCell>
                          <TableCell><span className="capitalize text-xs font-medium px-2 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>{job.format}</span></TableCell>
                          <TableCell>
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5" style={{ borderRadius: "var(--radius-sm)", ...statusStyle(job.status) }}>
                              {job.status === "processing" && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                              {job.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm" style={{ color: "var(--foreground-muted)" }}>{fmtBytes(job.bytes)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {job.documentUrl && job.status === "completed" && job.format === "combined" ? (
                                <Button size="sm" variant="outline" onClick={() => openPdf(job.documentUrl)} className="gap-1.5">
                                  <ExternalLink className="w-3.5 h-3.5" />Open PDF
                                </Button>
                              ) : job.status === "failed" && job.failureReason ? (
                                <span className="text-xs truncate max-w-[200px] block" style={{ color: "var(--crimson-signal)" }} title={job.failureReason}>{job.failureReason}</span>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>—</span>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                style={{ borderColor: "color-mix(in oklch, var(--crimson-signal) 30%, transparent)", color: "var(--crimson-signal)" }}
                                onClick={() => handleDeleteClassJob(job.id)}
                                disabled={deletingJobs.has(job.id)}
                                title="Delete class job"
                              >
                                {deletingJobs.has(job.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {/* Individual report cards */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Individual Report Cards</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Per-student generated report cards</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={fetchReports} disabled={isBulkDeleting}>Refresh</Button>
                  <Button variant="outline" size="sm" style={{ borderColor: "color-mix(in oklch, var(--crimson-signal) 30%, transparent)", color: "var(--crimson-signal)" }} onClick={handleBulkDelete} disabled={isBulkDeleting || reportCards.length === 0}>
                    {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash className="w-4 h-4 mr-2" />}
                    Delete All
                  </Button>
                </div>
              </div>
              {loadingReports ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--violet-ink)" }} /></div>
              ) : reportCards.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No report cards found</p>
                  <p className="text-sm mt-2">Generate report cards in the Generate Reports tab</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>File Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportCards.map((r: any) => {
                        const url = r.documentUrl || r.url || r.pdfUrl;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.studentName || "N/A"}</TableCell>
                            <TableCell className="font-mono text-sm">{r.studentId || "N/A"}</TableCell>
                            <TableCell>{r.className || selectedClass?.name || "N/A"}</TableCell>
                            <TableCell><span className="inline-flex items-center text-xs font-medium px-2 py-0.5" style={{ borderRadius: "var(--radius-sm)", ...statusStyle(r.status) }}>{r.status || "Unknown"}</span></TableCell>
                            <TableCell className="text-sm" style={{ color: "var(--foreground-muted)" }}>{fmtBytes(r.bytes)}</TableCell>
                            <TableCell className="text-sm" style={{ color: "var(--foreground-muted)" }}>{fmtDate(r.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => url ? openPdf(url, r.studentName) : toast.error("URL not available")} disabled={!url || downloadingReport === url}>
                                  {downloadingReport === url ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-4 h-4 mr-2" />Open PDF</>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-200"
                                  onClick={() => setPsychomotorModal({
                                    open: true,
                                    reportCardId: r.id,
                                    studentId: r.studentId || "",
                                    studentName: r.studentName || "Student",
                                  })}
                                  title="Evaluate Affective & Psychomotor Domain"
                                >
                                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                                  <span className="hidden sm:inline text-xs font-semibold">Psychomotor</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-purple-700 hover:text-purple-800"
                                  onClick={() => setSignModal({
                                    open: true,
                                    reportId: r.id,
                                    studentName: r.studentName || "Student",
                                    signatures: r.signatures || [],
                                    checksum: r.checksum || r.hash || "",
                                    isVerified: !!r.isVerified,
                                  })}
                                  title="Digital Sign-off"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  <span className="hidden sm:inline text-xs">Sign</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-green-700 hover:text-green-800"
                                  onClick={() => setShareModal({
                                    open: true,
                                    reportId: r.id,
                                    studentName: r.studentName || "Student",
                                    defaultPhone: r.parentPhone || r.phone || "",
                                    defaultEmail: r.parentEmail || r.email || "",
                                  })}
                                  title="Share via WhatsApp or Email"
                                >
                                  <Share2 className="w-4 h-4" />
                                  <span className="hidden sm:inline text-xs">Share</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  style={{ borderColor: "color-mix(in oklch, var(--crimson-signal) 30%, transparent)", color: "var(--crimson-signal)" }}
                                  onClick={() => handleDeleteReport(r.id)}
                                  disabled={deletingReports.has(r.id)}
                                >
                                  {deletingReports.has(r.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* Share Modal */}
      <ShareReportModal
        open={shareModal.open}
        onOpenChange={(o) => setShareModal((prev) => ({ ...prev, open: o }))}
        reportCardId={shareModal.reportId}
        studentName={shareModal.studentName}
        defaultPhone={shareModal.defaultPhone}
        defaultEmail={shareModal.defaultEmail}
      />

      {/* Bulk Share Multi-Channel Dispatch Modal */}
      <BulkShareReportModal
        open={bulkShareOpen}
        onOpenChange={setBulkShareOpen}
        classId={classId}
        className={selectedClass?.name}
      />

      {/* Psychomotor & Affective Domain Evaluation Modal */}
      <PsychomotorEvaluationModal
        open={psychomotorModal.open}
        onOpenChange={(o) => setPsychomotorModal((prev) => ({ ...prev, open: o }))}
        reportCardId={psychomotorModal.reportCardId}
        studentId={psychomotorModal.studentId}
        studentName={psychomotorModal.studentName}
        onSavedSuccess={fetchReports}
      />

      {/* Sign Modal */}
      <SignReportModal
        open={signModal.open}
        onOpenChange={(o) => setSignModal((prev) => ({ ...prev, open: o }))}
        reportCardId={signModal.reportId}
        studentName={signModal.studentName}
        currentSignatures={signModal.signatures}
        checksum={signModal.checksum}
        isVerified={signModal.isVerified}
        onSignedSuccess={fetchReports}
      />

      {/* Digital Signature Audit Trail Modal */}
      <ReportAuditTrailModal
        open={auditModal.open}
        onOpenChange={(o) => setAuditModal((prev) => ({ ...prev, open: o }))}
        reportCardId={auditModal.reportCardId}
        studentName={auditModal.studentName}
      />
    </div>
  );
}
