"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  Copy,
  Check,
  ArrowUpRight,
  Clock,
  Send,
  Radio,
  CalendarClock,
  FileText,
  AlertCircle,
  Loader2,
  Monitor,
  Users,
  X,
  School,
  KeyRound,
  MoreVertical,
  PencilRuler,
  Lock,
  Infinity as Endless,
  BarChart3,
  CircleDashed,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  cbtApi,
  getExaminerSession,
  loadStoredExams,
  saveStoredExams,
  type ExaminerWorkspace,
} from "@cbt/lib/cbtSessionManager";
import {
  useCreateCbtExamMutation,
  useListWorkspaceExamsQuery,
  useUpdateCbtExamMutation,
  type CbtExamItem,
} from "@cbt/store/cbtMicroserviceApi";
import CbtEntrance from "@cbt/components/CBT/CbtEntrance";
import CbtSchoolExamSection, {
  type SchoolExamChoice,
} from "@cbt/components/CBT/CbtSchoolExamSection";
import "@cbt/components/CBT/cbt-dashboard.css";

type ExamStatus = "Draft" | "Ready" | "Open" | "Scheduled" | "Closed";
function statusOf(exam: CbtExamItem, now: number): ExamStatus {
  if (!exam.isPublished)
    return (exam.totalQuestions ?? exam._count?.questions ?? 0) > 0
      ? "Ready"
      : "Draft";
  if (exam.endsAt && new Date(exam.endsAt).getTime() <= now) return "Closed";
  if (exam.startsAt && new Date(exam.startsAt).getTime() > now)
    return "Scheduled";
  return "Open";
}
const STATUS_LABEL: Record<ExamStatus, string> = {
  Open: "Open",
  Scheduled: "Scheduled",
  Ready: "Ready to publish",
  Draft: "Draft",
  Closed: "Closed",
};
const STATUS_ICON = {
  Open: Radio,
  Scheduled: CalendarClock,
  Ready: Check,
  Draft: CircleDashed,
  Closed: Lock,
} as const;

/** "You have no … right now", per filter tab */
const FILTER_NOUN: Record<string, string> = {
  Open: "open examinations",
  Scheduled: "scheduled examinations",
  Drafts: "drafts",
  Closed: "closed examinations",
};

function when(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The line under the status pill: what the status means for candidates right now.
    Scheduled and Closed repeat the availability column, so CSS shows them only when that column is hidden. */
function statusNote(exam: CbtExamItem, status: ExamStatus) {
  if (status === "Open") return "Candidates can enter";
  if (status === "Scheduled") return `Opens ${when(exam.startsAt)}`;
  if (status === "Ready") return "Candidates can't see it yet";
  if (status === "Draft") return "Add questions to publish";
  return exam.endsAt ? `Ended ${when(exam.endsAt)}` : "Entry closed";
}

/** Availability column: the window candidates can enter in */
function availability(exam: CbtExamItem, status: ExamStatus) {
  if (!exam.isPublished)
    return {
      icon: CircleDashed,
      main: "Not published",
      sub: exam.accessType === "ROSTER_ONLY" ? "Registered candidates only" : "Anyone with the code",
    };
  if (status === "Closed")
    return { icon: Lock, main: "Entry closed", sub: exam.endsAt ? `Closed ${when(exam.endsAt)}` : "" };
  if (status === "Scheduled")
    return {
      icon: CalendarClock,
      main: `Opens ${when(exam.startsAt)}`,
      sub: exam.endsAt ? `Closes ${when(exam.endsAt)}` : "No closing time",
    };
  if (exam.endsAt)
    return { icon: Clock, main: `Closes ${when(exam.endsAt)}`, sub: "Open now" };
  return { icon: Endless, main: "No time window", sub: "Open until you close it" };
}

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { data?: { message?: string | string[] } })?.data
    ?.message;
  return Array.isArray(message) ? message.join(". ") : message || fallback;
}

function CbtPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsNew = searchParams.get("new") === "1";
  const [examiner, setExaminer] = useState<ExaminerWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [importPromptDismissed, setImportPromptDismissed] = useState(false);
  useEffect(() => {
    if (!examiner?.id) return;
    try {
      setImportPromptDismissed(
        !!localStorage.getItem(`paralearn_cbt_import_prompt_dismissed_${examiner.id}`)
      );
    } catch {}
  }, [examiner?.id]);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All exams");
  const [sort, setSort] = useState("newest");
  const [copied, setCopied] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<CbtExamItem | null>(null);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState(60);
  const [scheduled, setScheduled] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [showResultAfter, setShowResultAfter] = useState(true);
  const [rosterOnly, setRosterOnly] = useState(false);
  // School workspaces: which classes sit it and where the scores go
  const [schoolChoice, setSchoolChoice] = useState<SchoolExamChoice | null>(null);
  const [maxTabViolations, setMaxTabViolations] = useState(3);
  const [storedExams, setStoredExams] = useState<CbtExamItem[]>([]);
  const {
    data: exams = [],
    isFetching,
    isLoading,
    error,
    refetch,
  } = useListWorkspaceExamsQuery(examiner?.id || "", {
    skip: !examiner?.id,
    pollingInterval: 30000,
    refetchOnMountOrArgChange: true,
  });
  const [createExam, { isLoading: creating }] = useCreateCbtExamMutation();
  const [updateExam] = useUpdateCbtExamMutation();
  useEffect(() => {
    const ses = getExaminerSession();
    setExaminer(ses);
    if (ses?.id) {
      const cached = loadStoredExams(ses.id);
      if (cached && cached.length > 0) {
        setStoredExams(cached);
      }
    }
    setHydrated(true);
    // Confirm the server session; a stale local session drops back to the entrance
    cbtApi
      .fetchSession()
      .then((ws) => setExaminer(ws))
      .catch(() => {});
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // The top bar's "New exam" links here with ?new=1: open the create dialog, then tidy the address
  useEffect(() => {
    if (!wantsNew || !hydrated || !examiner) return;
    setCreateOpen(true);
    router.replace(window.location.pathname, { scroll: false });
  }, [wantsNew, hydrated, examiner, router]);

  useEffect(() => {
    if (exams && exams.length > 0 && examiner?.id) {
      saveStoredExams(exams as any, examiner.id);
      setStoredExams(exams);
    }
  }, [exams, examiner?.id]);

  const activeExams =
    exams.length > 0 ? exams : storedExams.length > 0 ? storedExams : exams;

  const safeIsoString = (
    dateStr?: string,
    timeStr?: string,
  ): string | undefined => {
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
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const counts = {
    "All exams": activeExams.length,
    Drafts: activeExams.filter((e) => !e.isPublished).length,
    Open: activeExams.filter((e) => statusOf(e, now) === "Open").length,
    Scheduled: activeExams.filter((e) => statusOf(e, now) === "Scheduled").length,
    Closed: activeExams.filter((e) => statusOf(e, now) === "Closed").length,
  };
  const visible = activeExams
    .filter((exam) => {
      const status = statusOf(exam, now);
      return (
        (filter === "All exams" ||
          (filter === "Drafts" ? !exam.isPublished : filter === status)) &&
        `${exam.title} ${exam.accessCode}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? (a.createdAt || "").localeCompare(b.createdAt || "")
          : (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  const attempts = activeExams.reduce(
    (sum, exam) => sum + (exam._count?.attempts ?? 0),
    0,
  );

  async function copyLink(exam: CbtExamItem) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/take/${encodeURIComponent(exam.accessCode)}`,
      );
      setCopied(exam.id);
      toast.success("Candidate link copied");
    } catch {
      toast.error(
        "Could not copy the link. Open the candidate entrance and copy its address.",
      );
    }
  }
  async function publishExam() {
    if (!publishTarget) return;
    setPublishing(publishTarget.id);
    try {
      await updateExam({ id: publishTarget.id, isPublished: true }).unwrap();
      toast.success("Exam published");
      setPublishTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, "Could not publish this exam. Try again."));
    } finally {
      setPublishing(null);
    }
  }
  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!examiner || !title.trim()) return;
    if (
      scheduled &&
      (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt))
    ) {
      toast.error("Closing time must be after opening time.");
      return;
    }
    if (scheduled && new Date(endsAt).getTime() <= Date.now()) {
      toast.error("Choose a closing time in the future.");
      return;
    }
    const isSchool = examiner.type === "INSTITUTION";
    const forClasses = isSchool && !!schoolChoice && schoolChoice.mode !== "open";
    if (forClasses && schoolChoice?.blocker) {
      toast.error(schoolChoice.blocker);
      return;
    }
    try {
      const exam = await createExam({
        workspaceId: examiner.id,
        title: title.trim(),
        accessCode: code.trim() || undefined,
        durationMins: duration,
        startsAt: scheduled ? new Date(startsAt).toISOString() : undefined,
        endsAt: scheduled ? new Date(endsAt).toISOString() : undefined,
        maxTabViolations,
        shuffleQuestions,
        shuffleChoices,
        showResultAfter,
        accessType: forClasses || rosterOnly ? "ROSTER_ONLY" : "ACCESS_CODE",
        isPublished: false,
        ...(forClasses ? { reportCard: schoolChoice!.reportCard } : {}),
      }).unwrap();
      const setup = exam.setup;
      if (!setup) {
        toast.success("Draft created");
      } else {
        const added = `${setup.imported} student${setup.imported === 1 ? "" : "s"} added with PINs`;
        if (setup.link) {
          toast.success(
            `Draft created for ${setup.link.subject.name} (${setup.link.session} ${setup.link.term}). ${added}.`,
          );
        } else if (!setup.linkError) {
          toast.success(`Practice test created. ${added}.`);
        }
        if (setup.linkError) {
          toast.error(
            `The exam was created but isn't on report cards yet: ${setup.linkError} You can link it from the exam's monitor.`,
            { duration: 12000 },
          );
        }
        if (setup.importError) {
          toast.error(
            `Students weren't added: ${setup.importError} Use Candidates → Import from ParaLearn to try again.`,
            { duration: 12000 },
          );
        }
      }
      setCreateOpen(false);
      router.push(`/cbt/exams/${exam.id}`);
    } catch (err) {
      toast.error(
        errorMessage(
          err,
          "Could not create the exam. Your entries have been kept.",
        ),
      );
    }
  }

  if (!hydrated)
    return (
      <div
        className="cbt-dashboard"
        aria-busy="true"
        aria-label="Loading workspace"
      >
        <div className="cbt-skeleton" />
        <div className="cbt-skeleton" />
      </div>
    );
  if (!examiner) return <CbtEntrance />;

  const importPromptKey = `paralearn_cbt_import_prompt_dismissed_${examiner.id}`;
  const showImportPrompt =
    examiner.type === "INSTITUTION" && !importPromptDismissed && activeExams.length > 0;

  const hasExams = activeExams.length > 0;
  // A failed first load is not the same as "no exams": never show zero counts for it
  const loadFailed = !!error && !hasExams;
  const TABS: Array<[keyof typeof counts, string]> = [
    ["All exams", "All exams"],
    ["Open", "Open"],
    ["Scheduled", "Scheduled"],
    ["Drafts", "Drafts"],
    ["Closed", "Closed"],
  ];
  const isSchool = examiner.type === "INSTITUTION";

  return (
    <main className="cbt-dashboard">
      <div className="cbt-page-heading is-compact">
        <div>
          <h1>Examinations</h1>
          {hasExams && (
            <p className="cbt-heading-sub">
              <span>{counts.Open} open now</span>
              <span>{counts.Scheduled} scheduled</span>
              <span>
                {attempts.toLocaleString()} attempt{attempts === 1 ? "" : "s"} so far
              </span>
            </p>
          )}
        </div>
        {(hasExams || error) && (
          <div className="cbt-page-actions">
            <button
              className="cbt-button"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} aria-hidden />
              {isFetching ? "Refreshing" : "Refresh"}
            </button>
          </div>
        )}
      </div>
      {showImportPrompt && (
        <div className="cbt-notice cbt-import-banner">
          <span className="cbt-import-icon" aria-hidden>
            <School size={18} />
          </span>
          <span>
            <strong>Bring in your students from ParaLearn.</strong>{" "}
            Import whole classes
            into an exam&apos;s candidate list, with PINs issued for you.
          </span>
          <Link className="cbt-button small" href="/cbt/candidates?import=1">
            Import students
          </Link>
          <button
            className="cbt-icon small"
            aria-label="Dismiss this suggestion"
            title="Dismiss"
            onClick={() => {
              setImportPromptDismissed(true);
              try {
                localStorage.setItem(importPromptKey, "1");
              } catch {}
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && hasExams && (
        <div className="cbt-notice is-warning" role="alert">
          <AlertCircle size={18} className="shrink-0" aria-hidden />
          <span>
            Couldn&apos;t reach the server, so this list may be out of date.
          </span>
          <button className="cbt-notice-action" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}
      {isLoading && !hasExams ? (
        <div className="cbt-table-card" aria-busy="true" aria-label="Loading exams">
          {[0, 1, 2].map((n) => (
            <div key={n} className="cbt-skeleton" />
          ))}
        </div>
      ) : loadFailed ? (
        <div className="cbt-empty is-error" role="alert">
          <AlertCircle size={28} aria-hidden />
          <h2>Couldn&apos;t load your examinations</h2>
          <p>Check this computer&apos;s internet connection, then try again.</p>
          <button
            className="cbt-button primary"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} aria-hidden />
            {isFetching ? "Trying again" : "Try again"}
          </button>
        </div>
      ) : !hasExams ? (
        <div className="cbt-empty is-first-run">
          <h2>Set up your first examination</h2>
          <p>Three steps from a blank page to candidates in the exam room.</p>
          <ol className="cbt-first-steps">
            <li>
              <span aria-hidden>1</span>
              <strong>Create a draft</strong>
              Give it a title and a duration. Nothing is visible to candidates yet.
            </li>
            <li>
              <span aria-hidden>2</span>
              <strong>Add questions</strong>
              Type them in, import an Excel sheet, or let ParaLearn AI draft some for you
              to check.
            </li>
            <li>
              <span aria-hidden>3</span>
              <strong>Publish and share the code</strong>
              {isSchool
                ? "Import your classes from ParaLearn for PINs, or write the exam code on the board."
                : "Candidates enter the exam code at the candidate entrance. Issue PINs if you want a register."}
            </li>
          </ol>
          <button className="cbt-button primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden />
            Create your first exam
          </button>
        </div>
      ) : (
        <div className="cbt-table-card">
          <div className="cbt-table-toolbar">
            <div className="cbt-tabs" role="group" aria-label="Filter examinations">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <small>{counts[key]}</small>
                </button>
              ))}
            </div>
            <div className="cbt-list-tools">
              <label className="cbt-search">
                <Search size={16} aria-hidden />
                <span className="sr-only">Search exams by name or code</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or code"
                />
                {search && (
                  <button
                    title="Clear search"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label>
                <span className="sr-only">Sort exams</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Name A to Z</option>
                </select>
              </label>
            </div>
          </div>
          {visible.length ? (
          <>
          <table className="cbt-exam-table">
            <thead>
              <tr>
                <th>Examination &amp; code</th>
                <th>Status</th>
                <th className="cbt-detail-col">Questions</th>
                <th className="cbt-schedule-col">Availability</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((exam) => {
                const status = statusOf(exam, now);
                const questions =
                  exam.totalQuestions ?? exam._count?.questions ?? 0;
                const attemptsCount = exam._count?.attempts ?? 0;
                const StatusIcon = STATUS_ICON[status];
                const win = availability(exam, status);
                const WindowIcon = win.icon;
                const studio = `/cbt/exams/${exam.id}`;
                const monitor = `/cbt/exams/${exam.id}/monitor`;
                return (
                  <tr key={exam.id}>
                    <td>
                      <Link className="cbt-exam-name" href={studio}>
                        {exam.title}
                      </Link>
                      <div className="cbt-exam-meta">
                        <code title="Exam code candidates type in">
                          <KeyRound size={11} aria-hidden />
                          {exam.accessCode}
                        </code>
                        <span>
                          <Clock size={12} aria-hidden />
                          {exam.durationMins} min
                        </span>
                        <span className={attemptsCount ? "has-attempts" : undefined}>
                          {attemptsCount
                            ? `${attemptsCount.toLocaleString()} attempt${attemptsCount === 1 ? "" : "s"}`
                            : "No attempts yet"}
                        </span>
                      </div>
                    </td>
                    <td className="cbt-status-cell">
                      <span className={`cbt-status ${status.toLowerCase()}`}>
                        <StatusIcon size={12} aria-hidden />
                        {STATUS_LABEL[status]}
                      </span>
                      <small
                        className={`cbt-status-note ${status === "Scheduled" || status === "Closed" ? "is-window" : ""}`}
                      >
                        {statusNote(exam, status)}
                      </small>
                    </td>
                    <td className="cbt-detail-col">
                      <Link
                        href={studio}
                        className="cbt-questions-link"
                        title="View and edit questions"
                      >
                        {questions} question{questions === 1 ? "" : "s"}
                      </Link>
                      {typeof exam.totalMarks === "number" && exam.totalMarks > 0 && (
                        <small className="cbt-cell-note is-number">
                          {exam.totalMarks} marks
                        </small>
                      )}
                    </td>
                    <td className="cbt-schedule-col">
                      <span className="cbt-window">
                        <WindowIcon size={14} aria-hidden />
                        {win.main}
                      </span>
                      {win.sub && <small className="cbt-cell-note">{win.sub}</small>}
                    </td>
                    <td>
                      <div className="cbt-row-actions">
                        {status === "Open" ? (
                          <Link className="cbt-button outline" href={monitor}>
                            <Monitor size={14} aria-hidden />
                            Monitor
                          </Link>
                        ) : status === "Closed" ? (
                          <Link className="cbt-button" href={monitor}>
                            <BarChart3 size={14} aria-hidden />
                            Results
                          </Link>
                        ) : status === "Ready" ? (
                          <button
                            className="cbt-button"
                            disabled={publishing === exam.id}
                            onClick={() => setPublishTarget(exam)}
                          >
                            <Send size={14} className="text-emerald-700" aria-hidden />
                            Publish
                          </button>
                        ) : status === "Scheduled" ? (
                          <Link className="cbt-button" href={studio}>
                            <PencilRuler size={14} aria-hidden />
                            Edit exam
                          </Link>
                        ) : (
                          <Link className="cbt-button" href={studio}>
                            <Plus size={14} aria-hidden />
                            Add questions
                          </Link>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="cbt-icon cbt-kebab"
                              aria-label={`More actions for ${exam.title}`}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="cbt-menu">
                            <DropdownMenuItem asChild>
                              <Link href={studio}>
                                <FileText size={14} />
                                View or edit questions
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/cbt/candidates?examId=${encodeURIComponent(exam.id)}`}
                              >
                                <Users size={14} />
                                Candidates and PINs
                              </Link>
                            </DropdownMenuItem>
                            {exam.isPublished && (
                              <>
                                <DropdownMenuSeparator />
                                {status !== "Open" && status !== "Closed" && (
                                  <DropdownMenuItem asChild>
                                    <Link href={monitor}>
                                      <Monitor size={14} />
                                      Monitor
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => copyLink(exam)}>
                                  {copied === exam.id ? (
                                    <Check size={14} />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                  Copy candidate link
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/take/${encodeURIComponent(exam.accessCode)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ArrowUpRight size={14} />
                                    Open candidate entrance
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="cbt-list-footer">
            <span>
              Showing {visible.length} of {activeExams.length} examination
              {activeExams.length === 1 ? "" : "s"}
            </span>
          </div>
          </>
          ) : (
            <div className="cbt-empty">
              <Search size={24} aria-hidden />
              <h2>No examinations match</h2>
              <p>
                {search.trim()
                  ? `Nothing in ${filter === "All exams" ? "your exams" : `“${filter}”`} matches “${search.trim()}”.`
                  : `You have no ${FILTER_NOUN[filter] ?? "examinations"} right now.`}
              </p>
              <button
                className="cbt-button"
                onClick={() => {
                  setSearch("");
                  setFilter("All exams");
                }}
              >
                Show all examinations
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open);
        }}
      >
        <DialogContent className="cbt-dialog sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>Create examination</DialogTitle>
            <DialogDescription>
              Save a draft, then add your questions before publishing.
            </DialogDescription>
          </DialogHeader>
          <form className="cbt-form" onSubmit={submitCreate}>
            <label>
              Exam title
              <input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mathematics mock examination"
                autoFocus
              />
            </label>
            <div className="cbt-form-grid">
              <label>
                Access code (optional)
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
                    )
                  }
                  maxLength={40}
                  placeholder="Generated automatically"
                  autoComplete="off"
                />
              </label>
              <label>
                Duration (minutes)
                <input
                  type="number"
                  required
                  min={5}
                  max={360}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
            </div>
            <fieldset>
              <legend>Availability</legend>
              <label className="cbt-check">
                <input
                  type="checkbox"
                  checked={scheduled}
                  onChange={(e) => setScheduled(e.target.checked)}
                />
                Schedule an opening and closing time
              </label>
              {scheduled && (
                <div className="cbt-form-grid mt-3">
                  <label>
                    Opens (local time)
                    <input
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </label>
                  <label>
                    Closes (local time)
                    <input
                      type="datetime-local"
                      required
                      min={startsAt || undefined}
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </fieldset>
            {examiner.type === "INSTITUTION" && (
              <CbtSchoolExamSection onChange={setSchoolChoice} />
            )}
            <fieldset>
              <legend>Exam settings</legend>
              <label className="cbt-check">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                Shuffle question order
              </label>
              <label className="cbt-check">
                <input
                  type="checkbox"
                  checked={shuffleChoices}
                  onChange={(e) => setShuffleChoices(e.target.checked)}
                />
                Shuffle answer choices
              </label>
              <label className="cbt-check">
                <input
                  type="checkbox"
                  checked={showResultAfter}
                  onChange={(e) => setShowResultAfter(e.target.checked)}
                />
                Show results after submission
              </label>
              {!(examiner.type === "INSTITUTION" && schoolChoice?.mode !== "open") && (
                <label className="cbt-check">
                  <input
                    type="checkbox"
                    checked={rosterOnly}
                    onChange={(e) => setRosterOnly(e.target.checked)}
                  />
                  Registered candidates only (they need the PIN you issue)
                </label>
              )}
              <label className="mt-3">
                Tab-switch limit
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={maxTabViolations}
                  onChange={(e) => setMaxTabViolations(Number(e.target.value))}
                />
              </label>
            </fieldset>
            <div className="cbt-form-footer">
              <button
                type="button"
                className="cbt-button"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                className="cbt-button primary"
                type="submit"
                disabled={creating}
              >
                {creating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {creating ? "Creating..." : "Create and add questions"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!publishTarget}
        onOpenChange={(open) => {
          if (!open && !publishing) setPublishTarget(null);
        }}
      >
        <DialogContent className="cbt-dialog sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Publish examination?</DialogTitle>
            <DialogDescription>{publishTarget?.title}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-4 py-4 text-sm">
            <div>
              <dt className="text-slate-500">Questions</dt>
              <dd className="font-bold">
                {publishTarget?.totalQuestions ??
                  publishTarget?._count?.questions ??
                  0}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-bold">
                {publishTarget?.durationMins} minutes
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Candidate access code</dt>
              <dd className="font-bold">{publishTarget?.accessCode}</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">
            {publishTarget?.startsAt
              ? "Candidates can enter during the scheduled examination window."
              : "Candidates with this code can enter as soon as you publish."}
          </p>
          <div className="cbt-form-footer">
            <button
              className="cbt-button"
              disabled={!!publishing}
              onClick={() => setPublishTarget(null)}
            >
              Keep draft
            </button>
            <button
              className="cbt-button primary"
              disabled={!!publishing}
              onClick={publishExam}
            >
              {publishing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Publish exam
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

// useSearchParams (for ?new=1) needs a Suspense boundary or the static build fails
export default function CbtPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="cbt-dashboard" aria-busy="true" aria-label="Loading workspace">
          <div className="cbt-skeleton" />
          <div className="cbt-skeleton" />
        </div>
      }
    >
      <CbtPortalContent />
    </Suspense>
  );
}
