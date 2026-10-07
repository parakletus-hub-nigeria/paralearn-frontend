"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { ImportFromParalearnModal } from "@cbt/components/CBT/ImportFromParalearnModal";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  School,
  Users,
  UserPlus,
  FileSpreadsheet,
  Printer,
  Share2,
  Copy,
  Check,
  Search,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  MessageCircle,
  Download,
  Filter,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
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
import { 
  getExaminerSession, 
  ExaminerWorkspace,
  CandidateRecord,
  loadStoredCandidates,
  saveStoredCandidates,
  loadStoredExams,
  purgeAllDemoData,
} from "@cbt/lib/cbtSessionManager";
import {
  CandidateRecord as RemoteCandidateRecord,
  useListCandidatesQuery,
  useListWorkspaceExamsQuery,
  useUpsertCandidateMutation,
} from "@cbt/store/cbtMicroserviceApi";

const mapCandidateStatus = (status: RemoteCandidateRecord["status"]): CandidateRecord["status"] => {
  if (status === "STARTED") return "IN_PROGRESS";
  if (status === "SUBMITTED") return "COMPLETED";
  if (status === "DISQUALIFIED") return "FLAGGED";
  return "ENROLLED";
};

function CandidatesPageContent() {
  const searchParams = useSearchParams();
  const requestedExamId = searchParams.get("examId") || "";
  const [examiner, setExaminer] = useState<ExaminerWorkspace | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [availableRoomCodes, setAvailableRoomCodes] = useState<string[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // New Candidate Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [upsertCandidate, { isLoading: isSavingCandidate }] = useUpsertCandidateMutation();
  const { data: workspaceExams = [] } = useListWorkspaceExamsQuery(examiner?.id || "", {
    skip: !examiner?.id,
  });
  const selectedExam = workspaceExams.find((exam) => exam.id === selectedExamId);
  const activeExamId = selectedExamId || workspaceExams[0]?.id || "";
  const activeRoomCode = selectedExam?.accessCode || workspaceExams[0]?.accessCode || newRoomCode;
  const { data: remoteCandidates = [], isFetching: isLoadingCandidates } = useListCandidatesQuery(
    { examId: activeExamId, search: searchQuery || undefined },
    { skip: !activeExamId }
  );

  // Print Slips Dialog State
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    purgeAllDemoData();
    const session = getExaminerSession();
    if (session) {
      setExaminer(session);
      const stored = loadStoredCandidates(session.id);
      setCandidates(stored);

      const exams = loadStoredExams(session.id);
      if (exams.length > 0) {
        setAvailableRoomCodes(exams.map((e) => e.accessCode));
        setNewRoomCode(exams[0].accessCode);
      }
    } else {
      const stored = loadStoredCandidates();
      setCandidates(stored);
      const exams = loadStoredExams();
      if (exams.length > 0) {
        setAvailableRoomCodes(exams.map((e) => e.accessCode));
        setNewRoomCode(exams[0].accessCode);
      }
    }
  }, []);

  useEffect(() => {
    if (workspaceExams.length === 0) return;
    setAvailableRoomCodes(workspaceExams.map((exam) => exam.accessCode));
    const requestedExam = workspaceExams.find((exam) => exam.id === requestedExamId);
    if (requestedExam && selectedExamId !== requestedExam.id) {
      setSelectedExamId(requestedExam.id);
      setNewRoomCode(requestedExam.accessCode);
      return;
    }

    if (!selectedExamId) {
      setSelectedExamId(workspaceExams[0].id);
      setNewRoomCode(workspaceExams[0].accessCode);
    }
  }, [requestedExamId, selectedExamId, workspaceExams]);

  useEffect(() => {
    if (!activeExamId || !activeRoomCode || isLoadingCandidates) return;
    const mapped = remoteCandidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.candidateName,
      regNumber: candidate.studentId || candidate.metadata?.regNumber || `PIN-${candidate.candidatePin}`,
      pin: candidate.candidatePin,
      phone: candidate.phone || "",
      roomCode: activeRoomCode,
      status: mapCandidateStatus(candidate.status),
      createdAt: candidate.createdAt || "",
    })) as CandidateRecord[];
    setCandidates(mapped);
    saveStoredCandidates(mapped, examiner?.id);
  }, [activeExamId, activeRoomCode, examiner?.id, isLoadingCandidates, remoteCandidates]);

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    toast.success(`PIN ${pin} copied to clipboard`);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  const handleCopyDirectLink = (candidate: CandidateRecord) => {
    const url = `${window.location.origin}/take/${candidate.roomCode}?pin=${candidate.pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(candidate.id);
    toast.success(`Candidate link with pre-filled PIN copied!`);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleSendWhatsApp = (candidate: CandidateRecord) => {
    const message = encodeURIComponent(
      `Hello ${candidate.name}, here is your ParaLearn CBT Exam pass.\n\n` +
      `Exam Room: ${candidate.roomCode}\n` +
      `Your Access PIN: ${candidate.pin}\n` +
      `Direct Link: ${window.location.origin}/take/${candidate.roomCode}\n\n` +
      `Enter your 6-digit PIN at the lobby to begin. Good luck!`
    );
    window.open(`https://wa.me/${candidate.phone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Please provide the candidate's full name");
      return;
    }

    if (!activeExamId) {
      toast.error("Create or select an exam before enrolling candidates.");
      return;
    }

    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    const nextIndex = candidates.length + 1;
    const formattedReg = `PLN/26/${String(nextIndex).padStart(3, "0")}`;

    try {
      const created = await upsertCandidate({
        examId: activeExamId,
        candidateName: newName.trim(),
        candidatePin: randomPin,
        phone: newPhone.trim() || undefined,
        studentId: formattedReg,
        metadata: { regNumber: formattedReg },
      }).unwrap();

      const newCandidate: CandidateRecord = {
        id: created.id,
        name: created.candidateName,
        regNumber: created.studentId || formattedReg,
        pin: created.candidatePin,
        phone: created.phone || "",
        roomCode: activeRoomCode || newRoomCode.trim().toUpperCase(),
        status: mapCandidateStatus(created.status),
        createdAt: created.createdAt || "Just now",
      };

      const updated = [newCandidate, ...candidates.filter((candidate) => candidate.id !== newCandidate.id)];
      setCandidates(updated);
      saveStoredCandidates(updated, examiner?.id);
      toast.success(`Candidate ${newName} enrolled with PIN: ${randomPin}`);
      setNewName("");
      setNewPhone("");
      setIsAddOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Could not enroll candidate on the CBT microservice.");
    }
  };

  const handleDeleteCandidate = (id: string) => {
    const updated = candidates.filter((c) => c.id !== id);
    setCandidates(updated);
    saveStoredCandidates(updated, examiner?.id);
    toast.info("Candidate removed from roster.");
  };

  const handleClearAllCandidates = () => {
    if (candidates.length === 0) return;
    if (confirm("Are you sure you want to clear all candidates? This will start with a fresh, clean slate.")) {
      setCandidates([]);
      saveStoredCandidates([], examiner?.id);
      toast.success("Candidate roster cleared. Clean slate restored.");
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.pin.includes(searchQuery) ||
      c.regNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#fdfdff] text-[#0f172a] font-sans antialiased selection:bg-[#641bc4]/10 selection:text-[#641bc4]">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e2e8f0] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/cbt"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#641bc4] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to CBT Workspace
            </Link>
            <span className="text-slate-300">/</span>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 text-sm">Candidates & PINs</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-[#641bc4] border border-violet-200">
                {candidates.length} Registered
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {examiner && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-xs px-2.5 py-1">
                {examiner.credits} Credits Available
              </Badge>
            )}
            <Link href={availableRoomCodes.length > 0 ? `/take/${availableRoomCodes[0]}` : `/take`} target="_blank">
              <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 flex items-center gap-1.5">
                <span>Open Student Lobby</span>
                <ExternalLink className="w-3 h-3 text-[#641bc4]" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Candidate Access & PIN Dissemination
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Issue secure 6-digit access PINs, print examination passes, or dispatch direct test links to students.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Import from ParaLearn Modal Trigger */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsImportOpen(true)}
              className="h-9 px-3.5 text-xs font-bold border-violet-200 bg-violet-50/60 hover:bg-violet-100 text-[#641bc4] flex items-center gap-1.5 rounded-xl shadow-2xs transition-all"
            >
              <School className="w-3.5 h-3.5 text-[#641bc4]" />
              <span>Import from ParaLearn</span>
            </Button>

            {/* Print Slips Modal Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPrintOpen(true)}
              className="h-9 px-3.5 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 rounded-xl shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-[#641bc4]" />
              <span>Print Hall Slips</span>
            </Button>

            {/* Add Candidate Modal Trigger */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-9 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white flex items-center gap-1.5 rounded-xl shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Enrol Candidate</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-slate-900">Enrol New Candidate</DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    A unique 6-digit access PIN will be generated automatically for this student.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddCandidate} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Full Name</label>
                    <Input
                      placeholder="e.g. Oluwaseun Adeleke"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Phone / WhatsApp Number</label>
                    <Input
                      placeholder="e.g. 08031234567"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="text-xs font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Target Exam Room Code</label>
                    <Input
                      placeholder="Exam room code"
                      value={newRoomCode}
                      onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                      disabled={workspaceExams.length > 0}
                      className="text-xs font-mono font-bold uppercase"
                    />
                    {workspaceExams.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 pt-1">
                        <label className="text-[11px] font-semibold text-slate-500">Select Exam</label>
                        <select
                          value={activeExamId}
                          onChange={(e) => {
                            const exam = workspaceExams.find((item) => item.id === e.target.value);
                            setSelectedExamId(e.target.value);
                            if (exam) setNewRoomCode(exam.accessCode);
                          }}
                          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#641bc4] focus:ring-2 focus:ring-[#641bc4]/15"
                        >
                          {workspaceExams.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.title} ({exam.accessCode})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAddOpen(false)}
                      className="text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSavingCandidate}
                      className="text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white px-5"
                    >
                      {isSavingCandidate ? "Issuing..." : "Issue PIN & Enrol"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── DISSEMINATION WORKFLOW EXPLAINER ───────────────────────────────── */}
        <div className="bg-gradient-to-r from-violet-50/70 via-white to-slate-50 border border-violet-100 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#641bc4]">
            <Info className="w-4 h-4" />
            <span>How Candidates Receive & Use Their Access Codes:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-100 text-[#641bc4] font-mono text-[10px] flex items-center justify-center font-bold">1</span>
                Pre-Assigned PIN Slips
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Print physical photocard slips for the computer lab or click the WhatsApp button to blast the candidate their personalized 6-digit PIN.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-100 text-[#641bc4] font-mono text-[10px] flex items-center justify-center font-bold">2</span>
                1-Click Magic Link
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Share <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">/take/ROOM?pin=XXXXXX</code> with the student. Clicking it auto-fills their credentials without typing.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-violet-100 text-[#641bc4] font-mono text-[10px] flex items-center justify-center font-bold">3</span>
                Open Hall Self-Enrolment
              </span>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Write the Room Code on the whiteboard. Candidates enter their Name & Phone at the lobby and are auto-issued a PIN on the spot.
              </p>
            </div>
          </div>
        </div>

        {/* ── METRICS TILES ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Total Enrolled</span>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">{candidates.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Completed Sessions</span>
            <p className="text-2xl font-extrabold text-emerald-600 font-mono">
              {candidates.filter((c) => c.status === "COMPLETED").length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Live in Hall</span>
            <p className="text-2xl font-extrabold text-[#641bc4] font-mono">
              {candidates.filter((c) => c.status === "IN_PROGRESS").length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
            <span className="text-xs font-medium text-slate-500">Unused Passes</span>
            <p className="text-2xl font-extrabold text-amber-600 font-mono">
              {candidates.filter((c) => c.status === "ENROLLED").length}
            </p>
          </div>
        </div>

        {/* ── FILTER & SEARCH BAR ───────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by name, PIN, or reg no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {["ALL", "ENROLLED", "IN_PROGRESS", "COMPLETED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    statusFilter === s
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {s === "ALL" ? "All" : s === "IN_PROGRESS" ? "Live" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {candidates.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllCandidates}
                className="h-8 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2"
                title="Clear all candidates to clean slate"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Clear Roster</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── CANDIDATES TABLE (Desktop) & CARDS (Mobile) ────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          {isLoadingCandidates && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
              Syncing candidate roster from CBT microservice...
            </div>
          )}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="py-3 px-4">Candidate & Reg No</th>
                  <th className="py-3 px-4">Exam Room</th>
                  <th className="py-3 px-4">Access PIN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score & WAEC</th>
                  <th className="py-3 px-4 text-right">Dissemination Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="space-y-3 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-slate-900">
                            {searchQuery || statusFilter !== "ALL" ? "No matching candidates" : "No candidates enrolled yet"}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {searchQuery || statusFilter !== "ALL"
                              ? "Try adjusting your search query or status filter."
                              : "Enrol candidates to generate 6-digit access PINs, printable photocard slips, and 1-click WhatsApp exam passes."}
                          </p>
                        </div>
                        {!searchQuery && statusFilter === "ALL" && (
                          <Button
                            size="sm"
                            onClick={() => setIsAddOpen(true)}
                            className="h-8 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-lg shadow-xs inline-flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Enrol First Candidate</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Reg */}
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">{candidate.name}</div>
                        <div className="font-mono text-[11px] text-slate-400">{candidate.regNumber} &bull; {candidate.phone}</div>
                      </td>

                      {/* Exam Room */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {candidate.roomCode}
                        </span>
                      </td>

                      {/* Access PIN */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-[#641bc4] tracking-wider bg-violet-50 px-2.5 py-0.5 rounded-md border border-violet-100">
                            {candidate.pin}
                          </span>
                          <button
                            onClick={() => handleCopyPin(candidate.pin)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Copy PIN"
                          >
                            {copiedPin === candidate.pin ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {candidate.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Finished
                          </span>
                        )}
                        {candidate.status === "IN_PROGRESS" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-[#641bc4]">
                            <Clock className="w-3.5 h-3.5 text-[#641bc4] animate-spin" />
                            Testing Now
                          </span>
                        )}
                        {candidate.status === "ENROLLED" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            PIN Ready
                          </span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4">
                        {candidate.score !== undefined ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <strong className="text-slate-900 font-bold">{candidate.score}%</strong>
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                              {candidate.grade}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Awaiting Exam</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Magic Link */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyDirectLink(candidate)}
                            className="h-8 px-2.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                            title="Copy link with auto-filled PIN"
                          >
                            {copiedLink === candidate.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            )}
                            <span>{copiedLink === candidate.id ? "Copied" : "Copy Link"}</span>
                          </Button>

                          {/* WhatsApp Blast */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendWhatsApp(candidate)}
                            className="h-8 px-2.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                            title="Send PIN & Link via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                            <span>WhatsApp</span>
                          </Button>

                          {/* Delete Candidate */}
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                            title="Remove candidate from roster"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredCandidates.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 text-[#641bc4] flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">
                  {searchQuery || statusFilter !== "ALL" ? "No matching candidates" : "No candidates enrolled yet"}
                </h4>
                <p className="text-xs text-slate-500">
                  {searchQuery || statusFilter !== "ALL"
                    ? "Try adjusting your search query or status filter."
                    : "Enrol candidates to generate 6-digit access PINs and passes."}
                </p>
                {!searchQuery && statusFilter === "ALL" && (
                  <Button
                    size="sm"
                    onClick={() => setIsAddOpen(true)}
                    className="h-8 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white rounded-lg"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    <span>Enrol First Candidate</span>
                  </Button>
                )}
              </div>
            ) : (
              filteredCandidates.map((candidate) => (
                <div key={candidate.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{candidate.name}</h4>
                      <p className="font-mono text-[11px] text-slate-500">
                        {candidate.regNumber} &bull; {candidate.phone}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {candidate.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Finished
                        </span>
                      )}
                      {candidate.status === "IN_PROGRESS" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-[#641bc4]">
                          <Clock className="w-3 h-3 text-[#641bc4] animate-spin" />
                          Testing
                        </span>
                      )}
                      {candidate.status === "ENROLLED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          PIN Ready
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Exam Room</span>
                      <div className="font-mono font-bold text-slate-700 truncate">{candidate.roomCode}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Access PIN</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs font-black text-[#641bc4]">
                        <span>{candidate.pin}</span>
                        <button
                          onClick={() => handleCopyPin(candidate.pin)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                          title="Copy PIN"
                        >
                          {copiedPin === candidate.pin ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {candidate.score !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Score:</span>
                      <strong className="text-slate-900 font-bold font-mono">{candidate.score}%</strong>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                        {candidate.grade}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyDirectLink(candidate)}
                      className="flex-1 h-8 text-[11px] font-semibold border-slate-200"
                    >
                      {copiedLink === candidate.id ? (
                        <Check className="w-3 h-3 text-emerald-600 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1 text-slate-400" />
                      )}
                      <span>{copiedLink === candidate.id ? "Copied" : "Copy Link"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendWhatsApp(candidate)}
                      className="flex-1 h-8 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600 mr-1" />
                      <span>WhatsApp</span>
                    </Button>

                    <button
                      onClick={() => handleDeleteCandidate(candidate.id)}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove candidate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ── PRINTABLE EXAMINATION SLIPS MODAL ─────────────────────────────── */}
      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span>Print Candidate Examination Hall Slips</span>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print All Slips</span>
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cut-out examination slips to distribute to students entering the computer testing hall.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
            {candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-white space-y-2.5 text-left"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="font-extrabold text-xs text-[#641bc4]">ParaLearn CBT Pass</div>
                  <span className="font-mono text-[10px] text-slate-400">{candidate.regNumber}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Candidate Name</span>
                  <div className="font-extrabold text-sm text-slate-900">{candidate.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Room Code</span>
                    <span className="font-mono font-bold text-xs text-slate-800">{candidate.roomCode}</span>
                  </div>
                  <div className="bg-violet-50 p-2 rounded-lg border border-violet-100">
                    <span className="text-[9px] uppercase font-bold text-[#641bc4] block">6-Digit PIN</span>
                    <span className="font-mono font-black text-sm text-[#641bc4]">{candidate.pin}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                  Instructions: Go to <strong>cbt.pln.ng/take</strong> and enter your 6-digit PIN. Do not exit fullscreen.
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from ParaLearn Modal */}
      <ImportFromParalearnModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        workspaceId={examiner?.id || "cmuyg4mva0000v1v8d6702yxm"}
        examId={activeExamId || requestedExamId || "cmuyg4nle0002v1v86exuw15m"}
        examTitle={selectedExam?.title || "Current Exam"}
        defaultEmail={examiner?.ownerEmail || "admin@brightfuture.ng"}
      />
    </div>
  );
}

// useSearchParams (for ?examId=) needs a Suspense boundary or the static build fails
export default function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--border-fine)] border-t-[var(--violet-ink)] animate-spin" />
        </div>
      }
    >
      <CandidatesPageContent />
    </Suspense>
  );
}
