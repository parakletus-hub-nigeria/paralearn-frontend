"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, Link2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  useGetReportCardOptionsQuery,
  useGetReportCardStatusQuery,
  useLinkReportCardMutation,
  useReleaseReportCardMutation,
  useUnlinkReportCardMutation,
  type ReportCardLink,
  type ReportCardReleaseResult,
} from "@cbt/store/cbtMicroserviceApi";

const errorMessage = (err: any, fallback: string) =>
  err?.data?.message || err?.message || fallback;

const selectClass =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-fine)] bg-white px-2 text-sm";
const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]";

/**
 * Puts this exam on ParaLearn report cards: link it to a subject, classes,
 * category and term, then release finished results as that assessment's
 * scores. School workspaces only.
 */
export default function CbtReportCardPanel({ examId }: { examId: string }) {
  const { data: status, isLoading, error, refetch } = useGetReportCardStatusQuery(examId, {
    skip: !examId,
  });
  const [releaseReportCard, { isLoading: isReleasing }] = useReleaseReportCardMutation();
  const [unlinkReportCard, { isLoading: isUnlinking }] = useUnlinkReportCardMutation();
  const [editing, setEditing] = useState(false);
  const [lastRelease, setLastRelease] = useState<ReportCardReleaseResult | null>(null);

  const link = status?.link ?? null;
  const ready = status?.ready;

  const handleRelease = async () => {
    try {
      const result = await releaseReportCard(examId).unwrap();
      setLastRelease(result);
      toast.success(
        `Released ${result.saved} score${result.saved === 1 ? "" : "s"} to report cards.`,
      );
    } catch (err) {
      toast.error(errorMessage(err, "Could not release scores to report cards."));
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkReportCard(examId).unwrap();
      setLastRelease(null);
      toast.success("This exam no longer counts toward report cards.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not unlink this exam."));
    }
  };

  return (
    <section
      aria-labelledby="report-card-heading"
      className="bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-[var(--violet-ink)]" />
          <h2 id="report-card-heading" className="text-base font-bold">
            Report cards
          </h2>
          {link && (
            <Badge className="bg-[var(--violet-tint)] text-[var(--violet-ink)] border-0 text-[10px]">
              Linked
            </Badge>
          )}
        </div>
        {link && !editing && (
          <div className="flex gap-2">
            <button className="cbt-button" onClick={() => setEditing(true)}>
              Edit link
            </button>
            {!link.scoresReleased && (
              <button className="cbt-button" disabled={isUnlinking} onClick={handleUnlink}>
                Unlink
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking report card link…
        </p>
      )}

      {error && !isLoading && (
        <div className="cbt-notice" role="alert">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{errorMessage(error, "Couldn't reach ParaLearn to check this exam's report card link.")}</span>
          <button className="ml-auto underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && (!link || editing) && (
        <LinkForm
          examId={examId}
          current={link}
          onDone={() => setEditing(false)}
          onCancel={link ? () => setEditing(false) : undefined}
        />
      )}

      {link && !editing && ready && (
        <>
          <p className="text-sm">
            Counts as <strong>{link.category.name}</strong> in <strong>{link.subject.name}</strong>{" "}
            for {link.classes.map((c) => c.name).join(", ")}, {link.session} {link.term}.
          </p>

          <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
            <li>
              {ready.students} ParaLearn student{ready.students === 1 ? "" : "s"} with finished
              results.
            </li>
            {ready.pendingReview > 0 && (
              <li className="text-[#92400e]">
                {ready.pendingReview} submission{ready.pendingReview === 1 ? " has" : "s have"} essays
                waiting to be graded. Grade them before releasing.
              </li>
            )}
            {ready.inProgress > 0 && (
              <li>
                {ready.inProgress} candidate{ready.inProgress === 1 ? " is" : "s are"} still sitting
                the exam and won&apos;t be included yet.
              </li>
            )}
            {ready.unlinked.length > 0 && (
              <li>
                <details>
                  <summary className="cursor-pointer">
                    {ready.unlinked.length} candidate{ready.unlinked.length === 1 ? " isn't" : "s aren't"}{" "}
                    linked to a ParaLearn student and can&apos;t go on report cards
                  </summary>
                  <ul className="mt-1 ml-4 list-disc">
                    {ready.unlinked.map((c) => (
                      <li key={c.candidatePin}>
                        {c.candidateName} (PIN {c.candidatePin})
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>

          {status?.release && (
            <p className="text-sm flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--emerald-signal)]" />
              Released {new Date(status.release.releasedAt).toLocaleString()}: {status.release.saved}{" "}
              saved
              {status.release.skipped > 0 && `, ${status.release.skipped} skipped`}.
              {status.changedSinceRelease && (
                <Badge className="bg-[var(--amber-tint)] text-[#92400e] border border-[var(--amber-signal)]/30 text-[10px]">
                  Results changed since release
                </Badge>
              )}
            </p>
          )}

          <button
            className="cbt-button primary"
            disabled={isReleasing || ready.pendingReview > 0 || ready.students === 0}
            onClick={handleRelease}
          >
            {isReleasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {status?.release ? "Release again" : "Release to report cards"}
          </button>

          {lastRelease && lastRelease.skipped.length > 0 && (
            <div className="cbt-notice" role="status">
              <AlertTriangle size={18} className="shrink-0" />
              <div>
                <p>These students were not updated:</p>
                <ul className="mt-1 ml-4 list-disc">
                  {lastRelease.skipped.map((s) => (
                    <li key={s.studentId}>
                      {s.candidateName}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function LinkForm({
  examId,
  current,
  onDone,
  onCancel,
}: {
  examId: string;
  current: ReportCardLink | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { data: options, isLoading, error } = useGetReportCardOptionsQuery();
  const [linkReportCard, { isLoading: isSaving }] = useLinkReportCardMutation();

  const [classIds, setClassIds] = useState<string[]>(current?.classes.map((c) => c.id) ?? []);
  const [subjectId, setSubjectId] = useState(current?.subject.id ?? "");
  const [categoryId, setCategoryId] = useState(current?.category.id ?? "");
  const [session, setSession] = useState(current?.session ?? "");
  const [term, setTerm] = useState(current?.term ?? "");
  // Released scores belong to one subject and term; those can't change now
  const locked = !!current?.scoresReleased;

  useEffect(() => {
    if (!options || current) return;
    if (options.activePeriod) {
      setSession(options.activePeriod.session);
      setTerm(options.activePeriod.term);
    }
  }, [options, current]);

  // Subjects taken by every selected class
  const subjects = useMemo(() => {
    const chosen = options?.classes.filter((c) => classIds.includes(c.id)) ?? [];
    if (chosen.length === 0) return [];
    return chosen[0].subjects.filter((s) =>
      chosen.every((c) => c.subjects.some((cs) => cs.id === s.id)),
    );
  }, [options, classIds]);

  useEffect(() => {
    if (subjectId && subjects.length && !subjects.some((s) => s.id === subjectId) && !locked) {
      setSubjectId("");
    }
  }, [subjects, subjectId, locked]);

  const terms = options?.periods.find((p) => p.session === session)?.terms ?? [];

  if (isLoading) {
    return (
      <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your classes and subjects…
      </p>
    );
  }
  if (error || !options) {
    return (
      <p className="text-sm text-[var(--crimson-signal)]">
        {errorMessage(error, "Couldn't load your classes from ParaLearn.")}
      </p>
    );
  }
  if (options.classes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        {options.tier === "TEACHER"
          ? "You aren't assigned to any classes with subjects in ParaLearn yet."
          : "No classes with subjects are set up in ParaLearn yet."}
      </p>
    );
  }

  const toggleClass = (id: string) =>
    setClassIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const canSave = classIds.length > 0 && subjectId && categoryId && session && term && !isSaving;

  const handleSave = async () => {
    try {
      await linkReportCard({ examId, classIds, subjectId, categoryId, session, term }).unwrap();
      toast.success("This exam now counts toward report cards.");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, "Could not link this exam to report cards."));
    }
  };

  return (
    <div className="space-y-4">
      {!current && (
        <p className="text-sm text-[var(--text-secondary)]">
          Count this exam on ParaLearn report cards. Choose where its scores belong, then release
          them once results are final.
        </p>
      )}

      <fieldset className="space-y-1.5">
        <legend className={labelClass}>Classes</legend>
        <div className="flex flex-wrap gap-2">
          {options.classes.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-fine)] px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                checked={classIds.includes(c.id)}
                onChange={() => toggleClass(c.id)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className={labelClass}>Subject</span>
          <select
            className={selectClass}
            value={subjectId}
            disabled={locked || subjects.length === 0}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">
              {classIds.length === 0
                ? "Choose classes first"
                : subjects.length === 0
                  ? "No subject shared by these classes"
                  : "Choose a subject"}
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Counts as</span>
          <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose a category</option>
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.weight}%)
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Session</span>
          <select
            className={selectClass}
            value={session}
            disabled={locked}
            onChange={(e) => {
              setSession(e.target.value);
              setTerm("");
            }}
          >
            <option value="">Choose a session</option>
            {options.periods.map((p) => (
              <option key={p.session} value={p.session}>
                {p.session}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelClass}>Term</span>
          <select className={selectClass} value={term} disabled={locked} onChange={(e) => setTerm(e.target.value)}>
            <option value="">Choose a term</option>
            {terms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {locked && (
        <p className="text-xs text-[var(--text-secondary)]">
          Scores are already on report cards, so the subject and term can&apos;t change.
        </p>
      )}

      <div className="flex gap-2">
        <button className="cbt-button primary" disabled={!canSave} onClick={handleSave}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {current ? "Save link" : "Link to report cards"}
        </button>
        {onCancel && (
          <button className="cbt-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
