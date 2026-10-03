"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowRight, 
  KeyRound, 
  Building2, 
  UserCheck, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  Zap,
  PlusCircle,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  BookOpen,
  Code2,
  Users,
  Calendar,
  CalendarClock,
  Trash2,
  Sliders,
  AlertCircle,
  Plus,
  CheckCircle2,
  Cpu,
  FileText,
  Layers,
  Award,
  Lock,
  ChevronRight,
  GraduationCap,
  MonitorCheck,
  FileQuestion,
  HelpCircle,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  getExaminerSession, 
  clearExaminerSession, 
  ExaminerWorkspace,
  CbtExamItem,
  loadStoredExams,
  saveStoredExams,
  loadStoredCandidates,
  purgeAllDemoData,
} from "@cbt/lib/cbtSessionManager";
import {
  useCreateCbtExamMutation,
  useListWorkspaceExamsQuery,
} from "@cbt/store/cbtMicroserviceApi";

export default function CbtPortalPage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");
  const [examiner, setExaminer] = useState<ExaminerWorkspace | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [exams, setExams] = useState<CbtExamItem[]>([]);
  const [candidatesCount, setCandidatesCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);

  // Create Exam Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newDuration, setNewDuration] = useState<number>(60);
  const [isScheduled, setIsScheduled] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndDate, setNewEndDate] = useState("");
  const [newEndTime, setNewEndTime] = useState("17:00");
  const [newMaxViolations, setNewMaxViolations] = useState<number>(3);
  const [newShuffleQuestions, setNewShuffleQuestions] = useState(true);
  const [newShuffleChoices, setNewShuffleChoices] = useState(true);
  const [newShowResults, setNewShowResults] = useState(true);
  const { data: serviceExams, isFetching: isLoadingExams, error: examsError } = useListWorkspaceExamsQuery(examiner?.id || "", {
    skip: !examiner?.id,
  });
  const [createCbtExam, { isLoading: isCreatingExam }] = useCreateCbtExamMutation();

  useEffect(() => {
    // Purge any legacy mock demo data from previous runs
    purgeAllDemoData();

    const session = getExaminerSession();
    if (session) {
      setExaminer(session);
      const stored = loadStoredExams(session.id);
      setExams(stored);

      const storedCandidates = loadStoredCandidates(session.id);
      setCandidatesCount(storedCandidates.length);
      setCompletedCount(storedCandidates.filter((c) => c.status === "COMPLETED").length);
    } else {
      setExams([]);
      setCandidatesCount(0);
      setCompletedCount(0);
    }
  }, []);

  const safeIsoString = (dateStr?: string, timeStr?: string): string | undefined => {
    if (!dateStr || !dateStr.trim()) return undefined;
    const time = timeStr && timeStr.trim() ? timeStr.trim() : "00:00";
    try {
      const d = new Date(`${dateStr.trim()}T${time}:00`);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  };

  useEffect(() => {
    if (!examiner?.id) return;

    const rawList = Array.isArray(serviceExams) ? serviceExams : [];
    const normalized = rawList.map((exam) => ({
      ...exam,
      totalQuestions: exam.totalQuestions ?? (exam as any)._count?.questions ?? 0,
    }));
    
    // Merge remote exams with locally created offline exams so local rooms are preserved
    const localExams = loadStoredExams(examiner.id);
    const remoteIdSet = new Set(normalized.map((e) => e.id));
    let merged = [
      ...normalized,
      ...localExams.filter((local) => !remoteIdSet.has(local.id)),
    ];

    const isRelevantHall =
      examiner.id === "ws_parakletus_internship" ||
      examiner.id === "ws_sweep_prod" ||
      examiner.id === "default" ||
      examiner.name?.toLowerCase().includes("internship") ||
      examiner.name?.toLowerCase().includes("sweep") ||
      examiner.ownerEmail?.toLowerCase().includes("internship") ||
      examiner.ownerEmail?.toLowerCase().includes("sweep");

    if (isRelevantHall && !merged.some((e) => e.accessCode?.trim().toUpperCase() === "BUSI-7642")) {
      merged = [
        {
          id: "exam_busi_7642",
          workspaceId: examiner.id,
          title: "Business Development Assessment - 1",
          accessCode: "BUSI-7642",
          durationMins: 90,
          totalQuestions: 30,
          totalMarks: 30,
          isPublished: true,
          startsAt: "2026-10-04T07:00:00.000Z",
          endsAt: "2026-10-04T21:00:00.000Z",
          maxTabViolations: 3,
          shuffleQuestions: true,
          shuffleChoices: true,
          showResultAfter: true,
          createdAt: "2026-10-03T12:00:00.000Z",
        },
        ...merged,
      ];
    }

    setExams(merged);
    saveStoredExams(merged, examiner.id);
  }, [examiner?.id, examiner?.name, examiner?.ownerEmail, serviceExams]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) return;
    router.push(`/take/${encodeURIComponent(examCode.trim().toUpperCase())}`);
  };

  const handleSignOut = () => {
    clearExaminerSession();
    setExaminer(null);
    setExams([]);
    setCandidatesCount(0);
    setCompletedCount(0);
    toast.info("Signed out of Examiner Workspace.");
  };

  const copyRoomLink = (code: string) => {
    const url = `${window.location.origin}/take/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success(`Copied room link: ${url}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleGenerateCode = () => {
    const prefix = newTitle.trim().slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "") || "MOCK";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setNewCode(`${prefix}-${rand}`);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please provide an examination title");
      return;
    }

    // Room codes go into share links, so keep them URL-safe: letters, digits and hyphens
    const accessCode =
      newCode.trim().toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "").replace(/^-+|-+$/g, "") ||
      `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const startsAt = isScheduled ? safeIsoString(newStartDate, newStartTime) : undefined;
    const endsAt = isScheduled ? safeIsoString(newEndDate, newEndTime) : undefined;
    const workspaceId = examiner?.id || "default";

    const payload = {
      workspaceId,
      title: newTitle.trim(),
      accessCode,
      durationMins: Number(newDuration) || 60,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      maxTabViolations: Number(newMaxViolations) || 3,
      shuffleQuestions: newShuffleQuestions,
      shuffleChoices: newShuffleChoices,
      showResultAfter: newShowResults,
    };

    let createdRecord: CbtExamItem;

    try {
      const created = await createCbtExam(payload).unwrap();
      createdRecord = {
        ...created,
        totalQuestions: created.totalQuestions ?? (created as any)._count?.questions ?? 0,
      };
    } catch (error) {
      console.warn("[CBT] Microservice exam creation unreachable or offline, persisting exam locally:", error);
      createdRecord = {
        id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        workspaceId,
        title: payload.title,
        accessCode: payload.accessCode,
        durationMins: payload.durationMins,
        totalQuestions: 0,
        isPublished: true,
        startsAt: payload.startsAt || null,
        endsAt: payload.endsAt || null,
        maxTabViolations: payload.maxTabViolations,
        shuffleQuestions: payload.shuffleQuestions,
        shuffleChoices: payload.shuffleChoices,
        showResultAfter: payload.showResultAfter,
        createdAt: new Date().toISOString(),
      };
    }

    const updated = [createdRecord, ...exams.filter((exam) => exam.id !== createdRecord.id)];
    setExams(updated);
    saveStoredExams(updated, examiner?.id);

    toast.success(`Exam room "${createdRecord.title}" created successfully. Add questions next.`);
    setIsCreateOpen(false);

    // Reset fields
    setNewTitle("");
    setNewCode("");
    setNewDuration(60);
    setIsScheduled(false);
    setNewStartDate("");
    setNewEndDate("");

    router.push(`/cbt/exams/${createdRecord.id}`);
  };

  const getQuestionCount = (exam: CbtExamItem) => {
    const serviceCount = (exam as CbtExamItem & { _count?: { questions?: number } })._count?.questions;
    return exam.totalQuestions ?? serviceCount ?? 0;
  };

  const getNextExamAction = (exam: CbtExamItem) => {
    const questionCount = getQuestionCount(exam);
    if (questionCount === 0) {
      return {
        label: "Add Questions",
        href: `/cbt/exams/${exam.id}`,
        icon: BookOpen,
        className: "bg-[#641bc4] hover:bg-[#5214a3] text-white",
      };
    }

    return {
      label: "Enroll Candidates",
      href: `/cbt/candidates?examId=${encodeURIComponent(exam.id)}`,
      icon: Users,
      className: "bg-slate-900 hover:bg-slate-800 text-white",
    };
  };

  const getExamScheduleStatus = (startsAt?: string | null, endsAt?: string | null) => {
    if (!startsAt && !endsAt) {
      return {
        label: "Always Live",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        description: "Open 24/7",
        isLive: true,
      };
    }

    const now = new Date();
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;

    if (start && now < start) {
      return {
        label: "Scheduled",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
        description: `Starts: ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        isLive: false,
      };
    }

    if (end && now > end) {
      return {
        label: "Concluded",
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        description: `Ended: ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        isLive: false,
      };
    }

    return {
      label: "Live Window Now",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      description: end ? `Closes at ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Active Now",
      isLive: true,
    };
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col font-sans text-[var(--foreground)]">
      
      {/* Top Navigation */}
      <header className="h-16 border-b border-[var(--border-fine)] px-6 lg:px-12 flex items-center justify-between bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Link href="/cbt" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--violet-ink)] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              PL
            </div>
            <span className="font-bold text-base tracking-tight text-[var(--foreground)]">
              ParaLearn CBT
            </span>
          </Link>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-wider bg-[var(--violet-tint)] text-[var(--violet-ink)] border-[var(--violet-ink)]/20">
            Assessment Engine
          </Badge>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/take"
            className="text-xs font-semibold text-slate-600 hover:text-[#641bc4] hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#641bc4]" />
            <span>Candidate Gate</span>
          </Link>

          <Link
            href="/cbt/api-docs"
            className="text-xs font-semibold text-slate-600 hover:text-[#641bc4] hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Developer API</span>
          </Link>

          {examiner ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs px-2.5 py-1">
                {examiner.credits} Free Credits
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="h-8 text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/cbt/auth">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-[var(--radius-md)]"
                >
                  Examiner Sign In
                </Button>
              </Link>
              <Link href="/cbt/auth">
                <Button
                  size="sm"
                  className="h-9 px-3.5 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs"
                >
                  Create Exam Hall
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── LOGGED-IN EXAMINER DASHBOARD VIEW ───────────────────────────────── */}
      {examiner ? (
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
          
          {/* Welcome Banner */}
          <div className="bg-white border border-[var(--border-fine)] rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-[#641bc4] border border-violet-100">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Active Examiner Workspace</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {examiner.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Managed by {examiner.ownerName} &bull; {examiner.ownerEmail}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Candidate Credits</span>
                <span className="text-2xl font-black text-emerald-600 font-mono">{examiner.credits}</span>
              </div>
              <Button 
                onClick={() => {
                  if (exams.length > 0) {
                    router.push(`/cbt/exams/${exams[0].id}`);
                  } else {
                    setIsCreateOpen(true);
                    toast.info("Please create an examination room first to author questions.");
                  }
                }}
                className="h-10 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{exams.length > 0 ? "Author Questions" : "Create Exam"}</span>
              </Button>
            </div>
          </div>

          <div className="bg-white border border-[var(--border-fine)] rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">CBT Setup Flow</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Build the exam room once, then every screen reads from the same CBT microservice record.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                {[
                  ["1", "Create room"],
                  ["2", "Add questions"],
                  ["3", "Enroll candidates"],
                  ["4", "Share gate"],
                  ["5", "Monitor live"],
                ].map(([step, label]) => (
                  <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-black text-[#641bc4] font-mono">{step}</span>
                    <span className="ml-2 font-bold text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Total Exams</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">{exams.length}</p>
            </div>

            <Link href="/cbt/candidates">
              <div className="bg-white border border-[var(--border-fine)] hover:border-[#641bc4]/50 hover:shadow-xs transition-all rounded-xl p-4 shadow-2xs space-y-1 cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 group-hover:text-[#641bc4] transition-colors">
                    Candidates
                  </span>
                  <Users className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#641bc4] transition-colors" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-extrabold text-slate-900 font-mono">{candidatesCount}</p>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Roster &rarr;
                  </span>
                </div>
              </div>
            </Link>

            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Completed Sessions</span>
              <p className="text-2xl font-extrabold text-slate-900 font-mono">{completedCount}</p>
            </div>

            <div className="bg-white border border-[var(--border-fine)] rounded-xl p-4 shadow-2xs space-y-1">
              <span className="text-xs font-medium text-slate-500">Anti-Cheat Status</span>
              <p className="text-sm font-bold text-emerald-600 flex items-center gap-1 mt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Active</span>
              </p>
            </div>
          </div>

          {/* Active Examinations List with Multi-Exam Creation & Scheduling */}
          <div className="bg-white border border-[var(--border-fine)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Exam Rooms</h2>
                <p className="text-xs text-slate-500">
                  {isLoadingExams
                    ? "Loading rooms from the CBT microservice..."
                    : examsError
                    ? "Showing the last cached rooms because the CBT service is unreachable."
                    : "Configure schedules, author questions, enroll candidates, and launch the student gate."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Create Exam Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      className="h-9 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white flex items-center gap-1.5 rounded-xl shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Exam Room</span>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-slate-900">
                        Create New Examination Room
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        Set custom title, room access code, duration, and optional date/time schedule window.
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateExam} className="space-y-4 pt-2">
                      {/* Title */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Exam Title</label>
                        <Input
                          placeholder="e.g. JAMB UTME 2026 Mock — Mathematics"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          required
                          className="text-xs font-medium"
                        />
                      </div>

                      {/* Access Code & Auto Generate */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">Room Access Code</label>
                          <button
                            type="button"
                            onClick={handleGenerateCode}
                            className="text-[11px] font-bold text-[#641bc4] hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-Generate Code</span>
                          </button>
                        </div>
                        <Input
                          placeholder="e.g. JAMB-MTH-26"
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, ""))}
                          className="text-xs font-mono font-bold uppercase"
                        />
                      </div>

                      {/* Duration */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Duration (Minutes)</label>
                        <Input
                          type="number"
                          min="5"
                          max="360"
                          value={newDuration}
                          onChange={(e) => setNewDuration(Number(e.target.value))}
                          className="text-xs font-mono font-medium"
                        />
                      </div>

                      {/* Scheduling Mode Toggle */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-[#641bc4]" />
                            <span className="text-xs font-bold text-slate-800">Set Date & Time Window</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isScheduled}
                            onChange={(e) => setIsScheduled(e.target.checked)}
                            className="w-4 h-4 rounded text-[#641bc4] focus:ring-[#641bc4]"
                          />
                        </div>

                        {isScheduled ? (
                          <div className="space-y-3 pt-2 border-t border-slate-200">
                            {/* Start Schedule */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                                <Input
                                  type="date"
                                  value={newStartDate}
                                  onChange={(e) => setNewStartDate(e.target.value)}
                                  required={isScheduled}
                                  className="text-xs font-medium"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Time</label>
                                <Input
                                  type="time"
                                  value={newStartTime}
                                  onChange={(e) => setNewStartTime(e.target.value)}
                                  required={isScheduled}
                                  className="text-xs font-medium"
                                />
                              </div>
                            </div>

                            {/* End Schedule */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">End Date (Deadline)</label>
                                <Input
                                  type="date"
                                  value={newEndDate}
                                  onChange={(e) => setNewEndDate(e.target.value)}
                                  required={isScheduled}
                                  className="text-xs font-medium"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">End Time</label>
                                <Input
                                  type="time"
                                  value={newEndTime}
                                  onChange={(e) => setNewEndTime(e.target.value)}
                                  required={isScheduled}
                                  className="text-xs font-medium"
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                              Candidates will only be allowed to sit for this test within this scheduled time window.
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 leading-normal">
                            This exam will be available immediately with open 24/7 access.
                          </p>
                        )}
                      </div>

                      {/* Anti-Cheat Options */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">Security Policies</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white">
                            <input
                              type="checkbox"
                              checked={newShuffleQuestions}
                              onChange={(e) => setNewShuffleQuestions(e.target.checked)}
                              className="rounded text-[#641bc4]"
                            />
                            <span>Shuffle Questions</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white">
                            <input
                              type="checkbox"
                              checked={newShuffleChoices}
                              onChange={(e) => setNewShuffleChoices(e.target.checked)}
                              className="rounded text-[#641bc4]"
                            />
                            <span>Shuffle Choices</span>
                          </label>
                        </div>
                      </div>

                      <DialogFooter className="pt-4 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCreateOpen(false)}
                          className="text-xs font-semibold"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isCreatingExam}
                          className="text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white px-5 rounded-xl shadow-xs"
                        >
                          {isCreatingExam ? "Provisioning..." : "Provision Exam Room"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Exam Rooms Cards or Clean Slate Empty State */}
            {exams.length === 0 ? (
              <div className="text-center py-14 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="text-base font-bold text-slate-900">No examinations created yet</h3>
                  <p className="text-xs text-slate-500">
                    Start by creating your first examination room to set up access codes, schedule testing windows, and author questions.
                  </p>
                </div>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Exam Room</span>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {exams.map((exam) => {
                  const schedule = getExamScheduleStatus(exam.startsAt, exam.endsAt);
                  const nextAction = getNextExamAction(exam);
                  const NextIcon = nextAction.icon;
                  const questionCount = getQuestionCount(exam);
                  return (
                    <div key={exam.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900">{exam.title}</span>
                          <Badge className={`text-[10px] font-bold border ${schedule.badgeClass}`}>
                            {schedule.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
                          <span>Room Code: <strong className="text-[#641bc4]">{exam.accessCode}</strong></span>
                          <span>&bull;</span>
                          <span>{exam.durationMins} mins</span>
                          <span>&bull;</span>
                          <span>{questionCount} questions</span>
                          <span>&bull;</span>
                          <span className="text-slate-600 font-sans text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{schedule.description}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Copy Link */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyRoomLink(exam.accessCode)}
                          className="h-8 text-xs font-semibold border-slate-200 text-slate-700 flex items-center gap-1.5"
                        >
                          {copiedCode === exam.accessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode === exam.accessCode ? "Copied" : "Copy Student Link"}</span>
                        </Button>

                        <Link href={nextAction.href}>
                          <Button
                            size="sm"
                            className={`h-8 text-xs font-bold rounded-lg flex items-center gap-1 ${nextAction.className}`}
                          >
                            <NextIcon className="w-3 h-3" />
                            <span>{nextAction.label}</span>
                          </Button>
                        </Link>

                        {/* Author Questions */}
                        <Link href={`/cbt/exams/${exam.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold border-slate-200 text-[#641bc4] hover:bg-violet-50 flex items-center gap-1"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Questions</span>
                          </Button>
                        </Link>

                        {/* Live Monitor */}
                        <Link href={`/cbt/exams/${exam.id}/monitor`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                          >
                            <BarChart3 className="w-3 h-3 text-[#641bc4]" />
                            <span>Monitor</span>
                          </Button>
                        </Link>

                        {/* Launch Test */}
                        <Link href={`/take/${exam.accessCode}`}>
                          <Button size="sm" className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1">
                            <span>Launch</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </main>
      ) : (
        /* ── GUEST / UNLOGGED HERO PORTAL VIEW (cbt.pln.ng) ─────────────────── */
        <main className="flex-1 flex flex-col items-center">
          
          {/* ── HERO SECTION ──────────────────────────────────────────────── */}
          <section className="w-full max-w-6xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 flex flex-col items-center text-center space-y-10">
            
            {/* Live Engine Status Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-200/80 text-xs font-medium text-[#641bc4] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold tracking-wide">High-Throughput Assessment Microservice</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-600 font-mono text-[11px]">Real-Time Proctoring</span>
            </div>

            {/* Hero Title & Value Proposition */}
            <div className="space-y-5 max-w-3xl">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Computer-Based Testing built for{" "}
                <span className="bg-gradient-to-r from-[#641bc4] via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  precision and speed.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
                Deliver school terminal exams, JAMB mock tests, and academy assessments with zero lag, active anti-cheat proctoring, and instant automated grading.
              </p>
            </div>

            {/* Candidate PIN Entrance Gate Card */}
            <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xl shadow-violet-950/5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-[#641bc4] flex items-center justify-center">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Candidate Test Gate
                  </span>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border-emerald-200 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Secure Session
                </Badge>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                <div className="text-left space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Enter Candidate PIN or Room Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Enter the room code issued by your examiner"
                      value={examCode}
                      onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                      className="pl-10 h-12 text-center font-mono font-bold tracking-widest text-base uppercase rounded-xl border-slate-200 focus-visible:ring-[#641bc4] focus-visible:border-[#641bc4]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!examCode.trim()}
                  className="w-full h-12 text-sm font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl shadow-md shadow-violet-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <span>Enter Examination Room</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Anti-Cheat Monitored
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Offline Buffered
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-500" />
                  Instant Grade
                </span>
              </div>
            </div>

            {/* Quick Proof Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl pt-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-left">
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">10,000+</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">Concurrent Test Capacity</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-left">
                <div className="text-xl sm:text-2xl font-black text-[#641bc4] font-mono">0 ms</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">Offline Answer Buffering</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-left">
                <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">100%</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">Tab-Switch Proctoring</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-left">
                <div className="text-xl sm:text-2xl font-black text-amber-600 font-mono">Instant</div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">PDF Result Slip Export</div>
              </div>
            </div>

          </section>

          {/* ── CORE CAPABILITIES / FEATURES GRID ──────────────────────────── */}
          <section id="features" className="w-full bg-slate-50/70 border-y border-slate-200/70 py-16 lg:py-24">
            <div className="max-w-6xl mx-auto px-6 space-y-12">
              
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider bg-violet-100 text-[#641bc4] border-violet-200">
                  Engine Architecture
                </Badge>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Engineered for Nigerian Exam Halls &amp; Remote Assessments
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every feature is built around reliability: handling fluctuating internet, preventing examination malpractice, and delivering instant analytics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Feature 1 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-[#641bc4] flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">Active Anti-Malpractice Proctoring</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tracks candidate tab-switches, browser minimizes, and unauthorized key combinations. Configurable violation thresholds automatically submit locked sessions upon breach.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">Zero-Data-Loss Offline Resilience</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Answers buffer to encrypted client storage instantaneously. If internet disconnects or power fluctuates, candidates continue testing seamlessly without lost answers.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <MonitorCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">Live Examiner Command Center</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Monitor hundreds of candidates in real time. Invigilators can grant extra time (+5 mins), forgive accidental infractions, or force-submit attempts remotely.
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <FileQuestion className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">STEM &amp; LaTeX Formula Support</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Full mathematical equation rendering, scientific notation, chemical reactions, and rich image diagrams for WAEC, JAMB, and University STEM examinations.
                  </p>
                </div>

                {/* Feature 5 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">Instant PDF Result Slip Generation</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Automated scoring calculates percentages, grades, and pass/fail rankings the moment an exam ends. Candidates can print or download branded result slips on the spot.
                  </p>
                </div>

                {/* Feature 6 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">Developer REST API &amp; Webhooks</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Headless assessment delivery for universities and EdTechs. Provision exam rooms, generate candidate PIN batches, and stream score webhooks into your custom LMS.
                  </p>
                </div>

              </div>
            </div>
          </section>

          {/* ── DUAL PERSONA SECTION (INDEPENDENT EXAMINERS VS SCHOOLS) ─────── */}
          <section className="w-full max-w-5xl mx-auto px-6 py-16 lg:py-20 space-y-10">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Choose How You Want to Deliver Assessments
              </h2>
              <p className="text-sm text-slate-500">
                Flexible enough for a solo math tutor, powerful enough for a 5,000-student university campus.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              
              {/* Persona 1: Independent Examiner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-5 flex flex-col justify-between hover:border-violet-300 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 text-[#641bc4] flex items-center justify-center">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-900">Independent Examiners &amp; Academies</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      For JAMB/WAEC prep centers, tutorial academies, hiring managers, and private tutors. Launch a standalone Exam Hall in under 10 seconds.
                    </p>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>30 Free Candidate Test Credits included instantly</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Automated 6-digit Candidate PIN generation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Live candidate proctoring and score slips</span>
                    </li>
                  </ul>
                </div>
                <Link href="/cbt/auth" className="block pt-2">
                  <Button className="w-full h-11 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-xl shadow-xs">
                    Create Free Exam Hall &rarr;
                  </Button>
                </Link>
              </div>

              {/* Persona 2: School Staff */}
              <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-5 flex flex-col justify-between hover:border-violet-300 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-900">K-12 Schools &amp; Institutions (SSO)</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Deeply integrated with ParaLearn RMS. Teachers and academic directors can author term assessments and synchronize student rosters with zero manual data entry.
                    </p>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Single Sign-On with existing teacher &amp; admin accounts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Direct sync to student continuous assessment (CA) records</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Timed examination windows and automated grade distribution</span>
                    </li>
                  </ul>
                </div>
                <Link href="/cbt/auth" className="block pt-2">
                  <Button variant="outline" className="w-full h-11 text-xs font-bold border-slate-300 text-slate-800 hover:bg-slate-50 rounded-xl">
                    School Staff Sign In &rarr;
                  </Button>
                </Link>
              </div>

            </div>
          </section>

          {/* ── CALL TO ACTION BANNER ──────────────────────────────────────── */}
          <section className="w-full max-w-5xl mx-auto px-6 pb-20">
            <div className="bg-gradient-to-br from-[#641bc4] via-[#5214a3] to-slate-950 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl shadow-violet-950/20">
              <div className="space-y-2 max-w-xl mx-auto">
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Modernize Your Examination Process Today
                </h2>
                <p className="text-xs sm:text-sm text-violet-200 font-normal leading-relaxed">
                  Join hundreds of educators and academies delivering lightning-fast, cheat-resistant examinations across Nigeria.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link href="/cbt/auth">
                  <Button size="lg" className="h-11 px-6 text-xs sm:text-sm font-bold bg-white text-[#641bc4] hover:bg-violet-50 rounded-xl shadow-md">
                    Provision Free Exam Hall
                  </Button>
                </Link>
                <Link href="/cbt/api-docs">
                  <Button size="lg" variant="outline" className="h-11 px-6 text-xs sm:text-sm font-bold border-white/30 text-white hover:bg-white/10 rounded-xl">
                    View Developer API
                  </Button>
                </Link>
              </div>
            </div>
          </section>

        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border-fine)] py-6 px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)] bg-white">
        <div>
          <span>&copy; {new Date().getFullYear()} ParaLearn CBT Microservice. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/cbt/api-docs" className="hover:text-[var(--violet-ink)]">
            Developer API v1.2.0
          </Link>
          <Link href="/cbt/auth" className="hover:text-[var(--violet-ink)]">
            Examiner Portal
          </Link>
          <Link href="/take" className="hover:text-[var(--violet-ink)]">
            Candidate Gate
          </Link>
        </div>
      </footer>

      {/* ── JSON-LD STRUCTURED DATA FOR SEARCH ENGINES & LLMS ───────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "ParaLearn CBT - High-Concurrency Computer-Based Testing Platform",
              "applicationCategory": "EducationalApplication",
              "operatingSystem": "Web, iOS, Android, Desktop",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD",
                "description": "30 Free Credits on registration for standalone tutorial centres, academies, and schools."
              },
              "description": "Offline-resilient computer-based testing (CBT) engine for schools, JAMB mock examinations, WAEC preparation, and tertiary assessments with real-time anti-cheat telemetry and automated grading.",
              "url": "https://cbt.pln.ng"
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "Can ParaLearn CBT operate offline or during unstable network connections?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. ParaLearn CBT features an offline-resilient local sync layer with background retry queues. It continuously persists candidate progress and answers in browser storage and cookie layers, ensuring zero answer loss during internet drops."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does ParaLearn AI author questions from lecture notes or slides?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "ParaLearn AI multimodal ingestion extracts context and concepts directly from uploaded lecture notes (PDF, Word, TXT), presentation slide decks (PPTX), audio lectures (MP3, WAV), or classroom video recordings (MP4), calibrating question difficulty across Bloom's Taxonomy."
                  }
                },
                {
                  "@type": "Question",
                  "name": "How does anti-cheat invigilation and proctoring work on ParaLearn CBT?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "ParaLearn CBT monitors real-time browser visibility and window focus telemetry, flagging tab switches, screen minimization, and multi-monitor cheating. Configurable malpractice thresholds automatically lock or submit attempts."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can an exam centre schedule multiple exams across different dates and times?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. Examiners can schedule multiple concurrent or staggered exams with customized start/end dates, timers, access PINs, question/option shuffling, and live invigilator monitoring."
                  }
                }
              ]
            }
          ])
        }}
      />

    </div>
  );
}
