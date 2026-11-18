"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { ImportFromParalearnModal } from "@cbt/components/CBT/ImportFromParalearnModal";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  Printer,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "@cbt/components/CBT/cbt-dashboard.css";
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
  useDeleteCandidateMutation,
} from "@cbt/store/cbtMicroserviceApi";

/** wa.me needs international digits: Nigerian 080... becomes 23480... */
function whatsAppNumber(phone: string): string {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

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
  const [newRegNumber, setNewRegNumber] = useState("");
  const [upsertCandidate, { isLoading: isSavingCandidate }] = useUpsertCandidateMutation();
  const [deleteCandidate] = useDeleteCandidateMutation();
  const {
    data: remoteExams = [],
    error: examsError,
    isLoading: examsLoading,
    isFetching: examsFetching,
    refetch: refetchExams,
  } = useListWorkspaceExamsQuery(examiner?.id || "", {
    skip: !examiner?.id,
  });
  // When the server can't be reached, fall back to the exam list saved on this computer
  const [storedExams, setStoredExamsList] = useState<typeof remoteExams>([]);
  const workspaceExams = remoteExams.length ? remoteExams : storedExams;
  const selectedExam = workspaceExams.find((exam) => exam.id === selectedExamId);
  const activeExamId = selectedExamId || workspaceExams[0]?.id || "";
  const activeRoomCode = selectedExam?.accessCode || workspaceExams[0]?.accessCode || newRoomCode;
  const {
    data: remoteCandidates = [],
    isFetching: isLoadingCandidates,
    error: candidatesError,
    refetch: refetchCandidates,
  } = useListCandidatesQuery(
    { examId: activeExamId, search: searchQuery || undefined },
    { skip: !activeExamId }
  );

  // Print Slips Dialog State
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    purgeAllDemoData();
    const session = getExaminerSession();
    if (session) {
      setExaminer(session);
      const stored = loadStoredCandidates(session.id);
      setCandidates(stored);

      const exams = loadStoredExams(session.id);
      setStoredExamsList(exams);
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

  // Arriving from the hub's "Bring in your students" prompt (?import=1)
  const wantsImport = searchParams.get("import") === "1";
  useEffect(() => {
    if (wantsImport && examiner?.type === "INSTITUTION" && workspaceExams.length > 0) {
      setIsImportOpen(true);
    }
  }, [wantsImport, examiner?.type, workspaceExams.length]);

  useEffect(() => {
    if (!activeExamId || !activeRoomCode || isLoadingCandidates || candidatesError) return;
    const mapped = remoteCandidates.map((candidate: any) => ({
      id: candidate.id,
      name: candidate.candidateName,
      regNumber: candidate.metadata?.regNumber || candidate.studentId || "",
      pin: candidate.candidatePin,
      phone: candidate.phone || "",
      roomCode: activeRoomCode,
      status: mapCandidateStatus(candidate.status),
      score: typeof candidate.percentage === "number" ? candidate.percentage : undefined,
      grade:
        typeof candidate.score === "number" && candidate.totalMarks
          ? `${candidate.score}/${candidate.totalMarks}`
          : undefined,
      createdAt: candidate.createdAt || "",
    })) as CandidateRecord[];
    setCandidates(mapped);
    saveStoredCandidates(mapped, examiner?.id);
  }, [activeExamId, activeRoomCode, examiner?.id, isLoadingCandidates, candidatesError, remoteCandidates]);

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
    const number = whatsAppNumber(candidate.phone);
    if (!number) {
      toast.error("Add a phone number for this candidate to send their pass on WhatsApp.");
      return;
    }
    const message = encodeURIComponent(
      `Hello ${candidate.name}, here is your ParaLearn CBT exam pass.\n\n` +
      `Exam code: ${candidate.roomCode}\n` +
      `Your PIN: ${candidate.pin}\n` +
      `Start here: ${window.location.origin}/take/${candidate.roomCode}?pin=${encodeURIComponent(candidate.pin)}\n\n` +
      `Enter your full name at the lobby to begin. Good luck!`
    );
    window.open(`https://wa.me/${number}?text=${message}`, "_blank", "noopener,noreferrer");
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

    const regNumber = newRegNumber.trim();
    try {
      // The server issues a PIN no one else in this exam has
      const created = await upsertCandidate({
        examId: activeExamId,
        candidateName: newName.trim(),
        phone: newPhone.trim() || undefined,
        metadata: regNumber ? { regNumber } : undefined,
      }).unwrap();

      const newCandidate: CandidateRecord = {
        id: created.id,
        name: created.candidateName,
        regNumber,
        pin: created.candidatePin,
        phone: created.phone || "",
        roomCode: activeRoomCode || newRoomCode.trim().toUpperCase(),
        status: mapCandidateStatus(created.status),
        createdAt: created.createdAt || "Just now",
      };

      const updated = [newCandidate, ...candidates.filter((candidate) => candidate.id !== newCandidate.id)];
      setCandidates(updated);
      saveStoredCandidates(updated, examiner?.id);
      toast.success(`Candidate ${newName} enrolled with PIN: ${created.candidatePin}`);
      setNewName("");
      setNewPhone("");
      setNewRegNumber("");
      setIsAddOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Could not enroll candidate on the CBT microservice.");
    }
  };

  // Removing a candidate also revokes their PIN; results already submitted are kept
  const handleDeleteCandidate = async (id: string) => {
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate) return;
    if (!confirm(`Remove ${candidate.name} from this exam? Their PIN will stop working.`)) return;
    try {
      await deleteCandidate({ id, examId: activeExamId }).unwrap();
      const updated = candidates.filter((c) => c.id !== id);
      setCandidates(updated);
      saveStoredCandidates(updated, examiner?.id);
      toast.success("Candidate removed from roster.");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't remove this candidate. Try again.");
    }
  };

  // Clears candidates who haven't started; anyone who sat the exam keeps their record
  const handleClearAllCandidates = async () => {
    const removable = candidates.filter((c) => c.status === "ENROLLED");
    if (removable.length === 0) {
      toast.info("Everyone on this roster has already started, so there's no one to clear.");
      return;
    }
    if (!confirm(`Remove ${removable.length} candidate(s) who haven't started? Their PINs will stop working.`)) return;
    let removed = 0;
    for (const c of removable) {
      try {
        await deleteCandidate({ id: c.id, examId: activeExamId }).unwrap();
        removed++;
      } catch {
        // keep going; the list refreshes from the server
      }
    }
    toast.success(`Removed ${removed} candidate${removed === 1 ? "" : "s"}.`);
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.pin.includes(searchQuery) ||
      c.regNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts: Record<string, number> = {
    ALL: candidates.length,
    ENROLLED: candidates.filter((c) => c.status === "ENROLLED").length,
    IN_PROGRESS: candidates.filter((c) => c.status === "IN_PROGRESS").length,
    COMPLETED: candidates.filter((c) => c.status === "COMPLETED").length,
    FLAGGED: candidates.filter((c) => c.status === "FLAGGED").length,
  };
  const TABS: Array<[string, string]> = [
    ["ALL", "All"],
    ["ENROLLED", "PIN ready"],
    ["IN_PROGRESS", "Testing now"],
    ["COMPLETED", "Completed"],
    ["FLAGGED", "Locked"],
  ];
  const STATE_LABEL: Record<CandidateRecord["status"], string> = {
    ENROLLED: "PIN ready",
    IN_PROGRESS: "Testing now",
    COMPLETED: "Completed",
    FLAGGED: "Locked",
  };
  const monitorHref = activeExamId ? `/cbt/exams/${activeExamId}/monitor` : "/cbt";
  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  const filtering = !!searchQuery || statusFilter !== "ALL";
  const formatPin = (pin: string) => (pin.length === 6 ? `${pin.slice(0, 3)}-${pin.slice(3)}` : pin);
  // Page states, in order: exams still loading, exams unavailable, no exams yet, then the roster
  const examsPending = !!examiner && examsLoading && !workspaceExams.length;
  const examsUnavailable = !!examsError && !workspaceExams.length;
  const noExams = !examsPending && !examsUnavailable && workspaceExams.length === 0;
  const rosterFailed = !!candidatesError && candidates.length === 0;

  return (
    <main className="cbt-dashboard">
      <div className="cbt-page-heading">
        <div className="min-w-0">
          <h1>Candidates &amp; PINs</h1>
          {workspaceExams.length > 0 && candidates.length > 0 && (
            <p className="cbt-heading-sub">
              <span>{candidates.length} enrolled</span>
              {counts.IN_PROGRESS > 0 && <span>{counts.IN_PROGRESS} writing now</span>}
              {counts.COMPLETED > 0 && <span>{counts.COMPLETED} submitted</span>}
            </p>
          )}
        </div>
        {workspaceExams.length > 0 && (
          <div className="cbt-page-actions">
            <button
              className="cbt-button"
              onClick={() => setIsPrintOpen(true)}
              disabled={candidates.length === 0}
              title={candidates.length === 0 ? "Enrol candidates first" : undefined}
            >
              <Printer size={15} aria-hidden />
              Print hall slips
            </button>
            {examiner?.type === "INSTITUTION" && (
              <button className="cbt-button" onClick={() => setIsImportOpen(true)}>
                <School size={15} aria-hidden />
                Import from ParaLearn
              </button>
            )}
            <button className="cbt-button primary" onClick={() => setIsAddOpen(true)}>
              <UserPlus size={15} aria-hidden />
              Enrol candidate
            </button>
          </div>
        )}
      </div>

      {workspaceExams.length > 0 && (
        <div className="cbt-exam-picker">
          <label>
            <span className="cbt-picker-label">Exam</span>
            <span className="cbt-select-wrap">
              <select
                value={activeExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {workspaceExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} ({exam.accessCode})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden />
            </span>
          </label>
          <Link
            href={activeRoomCode ? `/take/${activeRoomCode}` : `/take`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open candidate lobby
            <ExternalLink size={12} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </div>
      )}

      {examsPending ? (
        <div className="cbt-table-card" aria-busy="true" aria-label="Loading exams">
          {[0, 1, 2].map((n) => (
            <div key={n} className="cbt-skeleton" />
          ))}
        </div>
      ) : examsUnavailable ? (
        <div className="cbt-empty is-error" role="alert">
          <AlertCircle size={28} aria-hidden />
          <h2>Couldn&apos;t load your exams</h2>
          <p>Candidates belong to an exam, so this page needs the exam list. Check this computer&apos;s internet connection, then try again.</p>
          <button className="cbt-button primary" disabled={examsFetching} onClick={() => refetchExams()}>
            <RefreshCw size={15} className={examsFetching ? "animate-spin" : ""} aria-hidden />
            {examsFetching ? "Trying again" : "Try again"}
          </button>
        </div>
      ) : noExams ? (
        <div className="cbt-empty">
          <Users size={28} aria-hidden />
          <h2>Create an exam first</h2>
          <p>Candidates and their PINs belong to an exam. Create one, then come back to enrol candidates or import a class.</p>
          <Link className="cbt-button primary" href="/cbt?new=1">
            <Plus size={15} aria-hidden />
            New exam
          </Link>
        </div>
      ) : (
      <>
      <div className="cbt-guide">
        <button
          type="button"
          aria-expanded={guideOpen}
          aria-controls="cbt-entry-guide"
          onClick={() => setGuideOpen((open) => !open)}
        >
          <Info size={16} aria-hidden />
          <span>
            <strong>Getting candidates in:</strong>{" "}
            each one gets a 6-digit PIN on a slip, by link, or by signing up at the lobby.
          </span>
          <span className="cbt-guide-toggle">
            {guideOpen ? "Hide" : "How it works"}
            <ChevronDown
              size={14}
              aria-hidden
              style={{ transform: guideOpen ? "rotate(180deg)" : undefined }}
            />
          </span>
        </button>
        {guideOpen && (
          <ol id="cbt-entry-guide">
            <li>
              <strong>1. Printed PIN slips</strong>
              Print hall slips for the computer lab, or send each candidate their PIN on
              WhatsApp.
            </li>
            <li>
              <strong>2. Link with the PIN filled in</strong>
              <span>
                Share <code>/take/CODE?pin=XXXXXX</code>, which fills in the exam code and
                PIN, so there is nothing to type.
              </span>
            </li>
            <li>
              <strong>3. Sign up at the lobby</strong>
              Write the exam code on the board. Candidates enter their name and phone in
              the lobby and get a PIN on the spot.
            </li>
          </ol>
        )}
      </div>

      {candidatesError && candidates.length > 0 && (
        <div className="cbt-notice is-warning" role="alert">
          <AlertCircle size={18} className="shrink-0" aria-hidden />
          <span>Couldn&apos;t reach the server, so this roster may be out of date.</span>
          <button className="cbt-notice-action" onClick={() => refetchCandidates()}>
            Try again
          </button>
        </div>
      )}
      <div className="cbt-table-card">
        {(candidates.length > 0 || filtering) && (
        <div className="cbt-table-toolbar">
        <div className="cbt-tabs" role="group" aria-label="Filter candidates">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              {label}
              <small>{counts[key]}</small>
            </button>
          ))}
        </div>
        <div className="cbt-list-tools">
          <label className="cbt-search">
            <Search size={16} />
            <span className="sr-only">Search candidates</span>
            <input
              placeholder="Search name, reg no or PIN"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          {counts.ENROLLED > 0 && (
            <button
              className="cbt-button quiet"
              onClick={handleClearAllCandidates}
              title="Remove candidates who haven't started. Anyone who sat the exam keeps their record."
            >
              <Trash2 size={14} />
              Clear unused PINs
            </button>
          )}
        </div>
      </div>

        )}
        {isLoadingCandidates && (
          <div className="cbt-table-status" role="status">
            Loading candidates for this exam...
          </div>
        )}
        {rosterFailed ? (
          <div className="cbt-empty is-error" role="alert">
            <AlertCircle size={28} aria-hidden />
            <h2>Couldn&apos;t load the candidates for this exam</h2>
            <p>Check this computer&apos;s internet connection, then try again. Nothing has been removed.</p>
            <button className="cbt-button primary" onClick={() => refetchCandidates()}>
              <RefreshCw size={15} aria-hidden />
              Try again
            </button>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="cbt-empty">
            <Users size={32} />
            <h2>{filtering ? "No matching candidates" : "No candidates enrolled yet"}</h2>
            <p>
              {filtering
                ? "Try another name, PIN or status."
                : "Enrol candidates to issue 6-digit PINs, hall slips and WhatsApp passes. Or let them sign up at the lobby with the exam code."}
            </p>
            {filtering ? (
              <button
                className="cbt-button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </button>
            ) : (
              <button className="cbt-button primary" onClick={() => setIsAddOpen(true)}>
                <UserPlus size={15} />
                Enrol first candidate
              </button>
            )}
          </div>
        ) : (
          <table className="cbt-exam-table">
            <thead>
              <tr>
                <th>Candidate &amp; reg no</th>
                <th>Access PIN</th>
                <th>State</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((candidate) => {
                const locked = candidate.status === "FLAGGED";
                const hasPhone = !!whatsAppNumber(candidate.phone);
                const linkCopied = copiedLink === candidate.id;
                return (
                  <tr key={candidate.id} className={locked ? "is-locked" : undefined}>
                    <td>
                      <div className="cbt-exam-cell">
                        <span className="cbt-exam-initial" aria-hidden>
                          {initialsOf(candidate.name)}
                        </span>
                        <div className="min-w-0">
                          <span className="cbt-exam-name">
                            {candidate.name}
                          </span>
                          <div className="cbt-exam-meta">
                            <span>{candidate.regNumber || "No reg no"}</span>
                            {candidate.phone && <span className="cbt-meta-phone">{candidate.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`cbt-pin ${candidate.status === "COMPLETED" ? "is-used" : ""}`}
                      >
                        {formatPin(candidate.pin)}
                        <button
                          onClick={() => handleCopyPin(candidate.pin)}
                          aria-label={`Copy PIN for ${candidate.name}`}
                          title="Copy PIN"
                        >
                          {copiedPin === candidate.pin ? (
                            <Check size={14} className="text-emerald-700" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </span>
                    </td>
                    <td className="cbt-mobile-full">
                      <span className={`cbt-status ${candidate.status.toLowerCase()}`}>
                        {candidate.status === "COMPLETED" ? (
                          <CheckCircle2 size={12} aria-hidden />
                        ) : candidate.status === "IN_PROGRESS" ? (
                          <Clock size={12} aria-hidden />
                        ) : candidate.status === "FLAGGED" ? (
                          <Lock size={12} aria-hidden />
                        ) : (
                          <KeyRound size={12} aria-hidden />
                        )}
                        {STATE_LABEL[candidate.status]}
                      </span>
                      {candidate.score !== undefined ? (
                        <span className="cbt-score ml-2">
                          {candidate.score}%
                          {candidate.grade && <small>({candidate.grade})</small>}
                        </span>
                      ) : locked ? (
                        <small className="cbt-status-note">Can&apos;t continue until unlocked</small>
                      ) : null}
                    </td>
                    <td>
                      <div className="cbt-row-actions">
                        {locked ? (
                          <Link className="cbt-button danger" href={monitorHref}>
                            <ShieldAlert size={14} />
                            Review lock
                          </Link>
                        ) : candidate.status === "COMPLETED" ? (
                          <Link className="cbt-button" href={monitorHref}>
                            <BarChart3 size={14} />
                            View result
                          </Link>
                        ) : candidate.status === "ENROLLED" && hasPhone ? (
                          <button
                            className="cbt-button"
                            onClick={() => handleSendWhatsApp(candidate)}
                          >
                            <MessageCircle size={14} className="text-emerald-700" />
                            Send on WhatsApp
                          </button>
                        ) : (
                          <button
                            className="cbt-button"
                            onClick={() => handleCopyDirectLink(candidate)}
                          >
                            {linkCopied ? (
                              <Check size={14} className="text-emerald-700" />
                            ) : (
                              <Link2 size={14} />
                            )}
                            {linkCopied ? "Link copied" : "Copy link"}
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="cbt-icon cbt-kebab"
                              aria-label={`More actions for ${candidate.name}`}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="cbt-menu">
                            <DropdownMenuItem onSelect={() => handleCopyDirectLink(candidate)}>
                              <Link2 size={14} />
                              Copy link with PIN
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleCopyPin(candidate.pin)}>
                              <Copy size={14} />
                              Copy PIN
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleSendWhatsApp(candidate)}>
                              <MessageCircle size={14} />
                              Send pass on WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="is-danger"
                              onSelect={() => handleDeleteCandidate(candidate.id)}
                            >
                              <Trash2 size={14} />
                              Remove from exam
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filteredCandidates.length > 0 && (
          <div className="cbt-list-footer">
            <span>
              Showing {filteredCandidates.length} of {candidates.length} candidate
              {candidates.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      </>
      )}

      {/* Enrol one candidate */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="cbt-dialog sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Enrol a candidate</DialogTitle>
            <DialogDescription>
              They get a 6-digit PIN that no one else in this exam has.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCandidate} className="cbt-form">
            <label>
              Full name
              <input
                placeholder="e.g. Oluwaseun Adeleke"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
            </label>
            <div className="cbt-form-grid">
              <label>
                Phone or WhatsApp (optional)
                <input
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </label>
              <label htmlFor="cbt-new-reg">
                Registration number (optional)
                <input
                  id="cbt-new-reg"
                  placeholder="e.g. JSS1/024"
                  value={newRegNumber}
                  maxLength={60}
                  onChange={(e) => setNewRegNumber(e.target.value)}
                />
              </label>
            </div>
            {workspaceExams.length > 0 ? (
              <label>
                Exam
                <select
                  value={activeExamId}
                  onChange={(e) => {
                    const exam = workspaceExams.find((item) => item.id === e.target.value);
                    setSelectedExamId(e.target.value);
                    if (exam) setNewRoomCode(exam.accessCode);
                  }}
                >
                  {workspaceExams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} ({exam.accessCode})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Exam code
                <input
                  className="font-mono uppercase"
                  placeholder="Exam code"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                />
              </label>
            )}
            <div className="cbt-form-footer">
              <button type="button" className="cbt-button" onClick={() => setIsAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="cbt-button primary" disabled={isSavingCandidate}>
                {isSavingCandidate ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <KeyRound size={15} />
                )}
                {isSavingCandidate ? "Issuing PIN..." : "Issue PIN and enrol"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Printable hall slips */}
      <Dialog open={isPrintOpen} onOpenChange={setIsPrintOpen}>
        <DialogContent className="cbt-dialog sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-8">
              <span>Hall slips</span>
              <button className="cbt-button primary" onClick={() => window.print()}>
                <Printer size={15} />
                Print all slips
              </button>
            </DialogTitle>
            <DialogDescription>
              One slip per candidate, two to a row. Cut them out and hand them out at the hall door.
            </DialogDescription>
          </DialogHeader>

          {/* Only the slips print, two per row */}
          <style>{`@media print {
            body * { visibility: hidden !important; }
            #cbt-print-slips, #cbt-print-slips * { visibility: visible !important; }
            #cbt-print-slips { position: absolute; inset: 0 auto auto 0; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            #cbt-print-slips > div { break-inside: avoid; }
          }`}</style>
          <div id="cbt-print-slips" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="cbt-slip">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <strong className="text-xs text-[var(--violet-ink)]">ParaLearn CBT pass</strong>
                  <span className="font-mono text-[11px] text-slate-600">{candidate.regNumber}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-semibold uppercase text-slate-600">Candidate</span>
                  <strong className="text-sm">{candidate.name}</strong>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase text-slate-600">Exam code</span>
                    <span className="font-mono text-xs font-bold">{candidate.roomCode}</span>
                  </div>
                  <div className="rounded-md border border-violet-200 bg-violet-50 p-2">
                    <span className="block text-[10px] font-semibold uppercase text-[var(--violet-ink)]">PIN</span>
                    <span className="font-mono text-sm font-bold text-[var(--violet-ink)]">{formatPin(candidate.pin)}</span>
                  </div>
                </div>
                <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                  Go to <strong>{typeof window !== "undefined" ? window.location.host : "cbt.pln.ng"}/take</strong>, enter the
                  exam code, your full name and this PIN.
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from ParaLearn Modal */}
      <ImportFromParalearnModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        workspaceId={examiner?.id || ""}
        examId={activeExamId || requestedExamId}
        examTitle={selectedExam?.title || "Current Exam"}
        defaultEmail={examiner?.ownerEmail || ""}
      />
    </main>
  );
}

// useSearchParams (for ?examId=) needs a Suspense boundary or the static build fails
export default function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="cbt-dashboard" aria-busy="true" aria-label="Loading candidates">
          <div className="cbt-skeleton" />
          <div className="cbt-skeleton" />
        </div>
      }
    >
      <CandidatesPageContent />
    </Suspense>
  );
}
