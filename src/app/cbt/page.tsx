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
  cbtApi,
  loadStoredExams,
  saveStoredExams,
  loadStoredCandidates,
  purgeAllDemoData,
} from "@/lib/cbtSessionManager";

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

    const accessCode = newCode.trim().toUpperCase() || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const startsAt = isScheduled && newStartDate && newStartTime 
      ? new Date(`${newStartDate}T${newStartTime}:00`).toISOString() 
      : null;
    const endsAt = isScheduled && newEndDate && newEndTime 
      ? new Date(`${newEndDate}T${newEndTime}:00`).toISOString() 
      : null;

    const payload = {
      workspaceId: examiner?.id || "default",
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

    const created = await cbtApi.createExam(payload);
    const updated = [created, ...exams];
    setExams(updated);
    if (examiner?.id) {
      saveStoredExams(updated, examiner.id);
    }

    toast.success(`Exam room "${created.title}" created with Room Code: ${created.accessCode}`);
    setIsCreateOpen(false);

    // Reset fields
    setNewTitle("");
    setNewCode("");
    setNewDuration(60);
    setIsScheduled(false);
    setNewStartDate("");
    setNewEndDate("");
  };

  const handleDeleteExam = (examId: string) => {
    const updated = exams.filter((e) => e.id !== examId);
    setExams(updated);
    if (examiner?.id) {
      saveStoredExams(updated, examiner.id);
    }
    toast.info("Exam room removed from workspace.");
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

        <div className="flex items-center gap-3">
          <Link
            href="/cbt/api-docs"
            className="text-xs font-semibold text-slate-600 hover:text-[#641bc4] flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
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
                  className="h-9 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-[var(--radius-md)]"
                >
                  Examiner Sign In
                </Button>
              </Link>
              <Link href="/cbt/auth">
                <Button
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs"
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
                  Configure distinct test schedules, date/time windows, and manage multiple exam halls simultaneously.
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
                          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
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
                          className="text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white px-5 rounded-xl shadow-xs"
                        >
                          Provision Exam Room
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
                          <span>{exam.totalQuestions || 0} questions</span>
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

                        {/* Delete Exam */}
                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                          title="Remove exam room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </main>
      ) : (
        /* ── GUEST / UNLOGGED HERO PORTAL VIEW ───────────────────────────────── */
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 lg:py-20 flex flex-col items-center text-center space-y-10">
          
          {/* Value Proposition Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-muted)] border border-[var(--border-fine)] text-xs text-[var(--text-secondary)]">
            <Zap className="w-3.5 h-3.5 text-[var(--violet-ink)]" />
            <span>High-Throughput &bull; Real-Time Proctoring &bull; Instant Results</span>
          </div>

          {/* Hero Title */}
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-tight">
              Computer-Based Testing built for precision and speed.
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              Take school exams, run tutorial centre mock tests, or author assessments with zero lag. Used by K-12 schools, JAMB prep academies, and independent tutors across Nigeria.
            </p>
          </div>

          {/* Candidate PIN Entrance Gate */}
          <div className="w-full max-w-md bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-fine)] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Student PIN Gate
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-[var(--violet-ink)] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Engine
              </span>
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              <div className="text-left space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Enter 6-digit Candidate PIN or Room Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="e.g. JAMB-MOCK-26"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                    className="pl-9 h-11 text-center font-mono font-bold tracking-widest text-base uppercase rounded-[var(--radius-md)] border-[var(--border-fine)] focus-visible:ring-[var(--violet-ink)]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={!examCode.trim()}
                className="w-full h-11 text-xs font-bold bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white rounded-[var(--radius-md)] shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Enter Test Room</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>

          {/* Dual Persona Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left pt-6">
            <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-muted)] flex items-center justify-center text-[var(--violet-ink)]">
                <UserCheck className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Independent Examiners</h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Tutors, prep academies, and exam centres. Register an Exam Hall in 10 seconds with <strong>30 free candidate test credits</strong>.
              </p>
              <Link href="/cbt/auth" className="inline-block text-xs font-bold text-[var(--violet-ink)] hover:underline pt-2">
                Create Free Exam Hall &rarr;
              </Link>
            </div>

            <div className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 shadow-2xs space-y-2">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-muted)] flex items-center justify-center text-[var(--violet-ink)]">
                <Building2 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[var(--foreground)]">School Staff (SSO)</h2>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Seamlessly integrated with ParaLearn RMS. Author term assessments, schedule class exams, and auto-sync student grade booklets.
              </p>
              <Link href="/cbt/auth" className="inline-block text-xs font-bold text-[var(--violet-ink)] hover:underline pt-2">
                School Staff Sign In &rarr;
              </Link>
            </div>
          </div>

        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border-fine)] py-6 px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)] bg-white">
        <div>
          <span>&copy; {new Date().getFullYear()} ParaLearn CBT Microservice. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/cbt/api-docs" className="hover:text-[var(--violet-ink)]">
            Developer API v1.1.0
          </Link>
          <Link href="/cbt/auth" className="hover:text-[var(--violet-ink)]">
            Examiner Portal
          </Link>
          <Link href="/take" className="hover:text-[var(--violet-ink)]">
            Candidate Gate
          </Link>
        </div>
      </footer>

    </div>
  );
}
