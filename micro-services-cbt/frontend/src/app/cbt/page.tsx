"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  RefreshCw,
  Copy,
  Check,
  ArrowUpRight,
  BookOpen,
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
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
function errorMessage(error: unknown, fallback: string) {
  const message = (error as { data?: { message?: string | string[] } })?.data
    ?.message;
  return Array.isArray(message) ? message.join(". ") : message || fallback;
}

export default function CbtPortalPage() {
  const router = useRouter();
  const [examiner, setExaminer] = useState<ExaminerWorkspace | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (exams && exams.length > 0 && examiner?.id) {
      saveStoredExams(exams, examiner.id);
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
        isPublished: false,
      }).unwrap();
      toast.success("Draft created");
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

  return (
    <main className="cbt-dashboard">
      <div className="cbt-page-heading">
        <div>
          <span className="cbt-eyebrow">{examiner.name} / Workspace</span>
          <h1>Examinations</h1>
        </div>
        <div className="cbt-page-actions">
          <button
            className="cbt-icon"
            aria-label="Refresh exams"
            title="Refresh exams"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw size={17} className={isFetching ? "animate-spin" : ""} />
          </button>
          <button
            className="cbt-button primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={17} />
            Create exam
          </button>
        </div>
      </div>
      {error && (
        <div className="cbt-notice" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <span>
            {activeExams.length
              ? "Connection interrupted. These results may be out of date."
              : "We could not load your examinations."}
          </span>
          <button className="ml-auto underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}
      <dl className="cbt-summary">
        <div>
          <dt>Total exams</dt>
          <dd>{isLoading && !activeExams.length ? "--" : activeExams.length}</dd>
          <small>{counts.Drafts} drafts</small>
        </div>
        <div>
          <dt>Open for candidates</dt>
          <dd>{isLoading && !activeExams.length ? "--" : counts.Open}</dd>
          <small>Published and accepting entry</small>
        </div>
        <div>
          <dt>Scheduled exams</dt>
          <dd>
            {isLoading && !activeExams.length ? "--" : counts.Scheduled}
          </dd>
          <small>Upcoming opening windows</small>
        </div>
        <div>
          <dt>Exam attempts</dt>
          <dd>{isLoading && !activeExams.length ? "--" : attempts}</dd>
          <small>Across all examinations</small>
        </div>
      </dl>
      <div className="cbt-toolbar">
        <div className="cbt-tabs" aria-label="Filter examinations">
          {Object.entries(counts).map(([name, count]) => (
            <button
              key={name}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
            >
              {name}
              <small>{count}</small>
            </button>
          ))}
        </div>
        <div className="cbt-list-tools">
          <label className="cbt-search">
            <Search size={16} />
            <span className="sr-only">Search exams by name or code</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or code"
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
      {isLoading ? (
        <div aria-busy="true" aria-label="Loading exams">
          {[0, 1, 2].map((n) => (
            <div key={n} className="cbt-skeleton" />
          ))}
        </div>
      ) : visible.length ? (
        <table className="cbt-exam-table">
          <thead>
            <tr>
              <th>Examination</th>
              <th>Status</th>
              <th className="cbt-detail-col">Questions</th>
              <th className="cbt-schedule-col">Availability</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((exam) => {
              const status = statusOf(exam, now);
              const questions =
                exam.totalQuestions ?? exam._count?.questions ?? 0;
              const StatusIcon =
                status === "Open"
                  ? Radio
                  : status === "Scheduled"
                    ? CalendarClock
                    : status === "Ready"
                      ? Check
                      : status === "Closed"
                        ? Check
                        : FileText;
              return (
                <tr key={exam.id}>
                  <td>
                    <Link
                      className="cbt-exam-name"
                      href={`/cbt/exams/${exam.id}`}
                    >
                      {exam.title}
                    </Link>
                    <div className="cbt-exam-meta">
                      <code>{exam.accessCode}</code>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {exam.durationMins} min
                      </span>
                      <span>{exam._count?.attempts ?? 0} attempts</span>
                    </div>
                  </td>
                  <td>
                    <span className={`cbt-status ${status.toLowerCase()}`}>
                      <StatusIcon size={12} />
                      {status === "Ready" ? "Ready to publish" : status}
                    </span>
                  </td>
                  <td className="cbt-detail-col tabular-nums">{questions}</td>
                  <td className="cbt-schedule-col text-xs text-slate-600">
                    {!exam.isPublished
                      ? "Not published"
                      : status === "Closed"
                        ? "Entry closed"
                        : exam.startsAt
                          ? new Date(exam.startsAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "No time restriction"}
                  </td>
                  <td>
                    <div className="cbt-row-actions">
                      {exam.isPublished ? (
                        <>
                          <button
                            title="Copy candidate link"
                            aria-label={`Copy candidate link for ${exam.title}`}
                            className="cbt-icon"
                            onClick={() => copyLink(exam)}
                          >
                            {copied === exam.id ? (
                              <Check size={16} />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                          <Link
                            className="cbt-icon"
                            title="Open candidate entrance"
                            aria-label={`Open candidate entrance for ${exam.title}`}
                            href={`/take/${encodeURIComponent(exam.accessCode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ArrowUpRight size={16} />
                          </Link>
                          <Link
                            className="cbt-button"
                            href={`/cbt/exams/${exam.id}/monitor`}
                          >
                            <Monitor size={14} />
                            {status === "Closed" ? "Results" : "Monitor"}
                          </Link>
                        </>
                      ) : questions ? (
                        <button
                          className="cbt-button"
                          disabled={publishing === exam.id}
                          onClick={() => setPublishTarget(exam)}
                        >
                          <Send size={14} />
                          Publish exam
                        </button>
                      ) : (
                        <Link
                          className="cbt-button"
                          href={`/cbt/exams/${exam.id}`}
                        >
                          <Plus size={14} />
                          Add questions
                        </Link>
                      )}
                      <Link
                        className="cbt-icon"
                        title="Manage candidates"
                        aria-label={`Manage candidates for ${exam.title}`}
                        href={`/cbt/candidates?examId=${encodeURIComponent(exam.id)}`}
                      >
                        <Users size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="cbt-empty">
          <BookOpen size={32} />
          <h2>
            {error
              ? "Exams are unavailable"
              : exams.length
                ? "No matching examinations"
                : "Your first examination starts here"}
          </h2>
          <p>
            {error
              ? "Try refreshing when your connection is available."
              : exams.length
                ? "Try another name, code, or status."
                : "Create a draft to begin adding your questions."}
          </p>
          {exams.length ? (
            <button
              className="cbt-button"
              onClick={() => {
                setSearch("");
                setFilter("All exams");
              }}
            >
              Clear filters
            </button>
          ) : (
            !error && (
              <button
                className="cbt-button primary"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} />
                Create exam
              </button>
            )
          )}
        </div>
      )}
      <div className="cbt-list-footer">
        <span>
          {visible.length} of {exams.length} exams
        </span>
        <Link href="/take" className="flex items-center gap-1">
          Candidate entrance
          <ArrowUpRight size={12} />
        </Link>
      </div>

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
