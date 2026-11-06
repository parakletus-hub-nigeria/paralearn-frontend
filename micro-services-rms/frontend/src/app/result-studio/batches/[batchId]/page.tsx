"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileText, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import RmsShell from "@rms/components/ResultStudio/RmsShell";
import BatchStatusBadge from "@rms/components/ResultStudio/BatchStatusBadge";
import {
  isBatchActive,
  rmsDownloadUrls,
  rmsErrorMessage,
  useGenerateBatchMutation,
  useGetBatchQuery,
  useGetBatchStudentsQuery,
  type RmsBatch,
  type RmsBatchIssue,
  type RmsStudentRow,
} from "@rms/store/rmsApi";
import { useRmsHref } from "@rms/lib/rmsPaths";

const ordinal = (n?: number | null) => {
  if (!n) return "–";
  const rem100 = n % 100;
  const suffix = rem100 >= 11 && rem100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return `${n}${suffix}`;
};

const isError = (issue: RmsBatchIssue) => issue.level === "error";

function ProgressPanel({ batch }: { batch: RmsBatch }) {
  const total = batch.totalStudents || 0;
  const done = batch.renderedCount || 0;
  const pct = typeof batch.progress === "number" ? batch.progress : total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  if (batch.status === "UPLOADED" || batch.status === "PARSING") {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--violet-ink)]" />
        <div>
          <p className="font-semibold">{batch.status === "UPLOADED" ? "Waiting to check the sheet" : "Checking the sheet"}</p>
          <p className="text-sm text-[var(--text-secondary)]">Reading every class tab, totalling scores and ranking students.</p>
        </div>
      </div>
    );
  }

  if (batch.status === "RENDERING" || batch.status === "COMPLETED" || batch.status === "COMPLETED_WITH_ERRORS") {
    const finished = batch.status !== "RENDERING";
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">
            {finished ? "Report cards ready" : "Generating report cards"}
          </p>
          <p className="text-sm tabular-nums text-[var(--text-secondary)]">
            {done} of {total}
            {batch.failedCount ? <span className="text-[var(--crimson-signal)]"> · {batch.failedCount} failed</span> : null}
          </p>
        </div>
        <Progress value={finished ? 100 : pct} className="mt-3 h-2" />
        {!finished && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            You can leave this page; generation keeps running and the cards will be here when you come back.
          </p>
        )}
      </div>
    );
  }

  if (batch.status === "FAILED") {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-red-200 bg-[var(--crimson-tint)]/40 p-5">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--crimson-signal)]" />
        <div>
          <p className="font-semibold">This sheet couldn&apos;t be processed</p>
          <p className="text-sm">{batch.error || "Fix the problems listed below and upload the sheet again."}</p>
        </div>
      </div>
    );
  }

  return null;
}

function IssuesPanel({ issues }: { issues: RmsBatchIssue[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!issues?.length) return null;
  const errors = issues.filter(isError).length;
  const shown = expanded ? issues : issues.slice(0, 5);

  return (
    <section className="rounded-[var(--radius-lg)] border border-amber-200 bg-[var(--amber-tint)]/40 p-5" aria-labelledby="issues-heading">
      <h2 id="issues-heading" className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-[var(--amber-signal)]" />
        {issues.length} {issues.length === 1 ? "thing" : "things"} to check in the sheet
        {errors > 0 && <span className="text-sm font-normal text-[var(--crimson-signal)]">({errors} blocking)</span>}
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {shown.map((issue, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isError(issue) ? "bg-[var(--crimson-signal)]" : "bg-[var(--amber-signal)]"}`} />
            <span>
              {(issue.sheet || issue.row) && (
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  {[issue.sheet, issue.row ? `row ${issue.row}` : null].filter(Boolean).join(" · ")}{" "}
                </span>
              )}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
      {issues.length > 5 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm font-semibold text-[var(--violet-ink)] hover:underline">
          {expanded ? "Show fewer" : `Show all ${issues.length}`}
        </button>
      )}
    </section>
  );
}

const cardReady = (row: RmsStudentRow) => row.pdfReady === true || row.status === "DONE";

function StudentStatus({ row, generating }: { row: RmsStudentRow; generating: boolean }) {
  if (cardReady(row)) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Report card ready" />;
  if (row.status === "FAILED")
    return (
      <span title={row.error || "Couldn't generate this card"}>
        <XCircle className="h-4 w-4 text-[var(--crimson-signal)]" aria-label="Failed" />
      </span>
    );
  if (generating) return <Loader2 className="h-4 w-4 animate-spin text-[var(--violet-ink)]" aria-label="Generating" />;
  return <span className="text-xs text-[var(--text-secondary)]">Pending</span>;
}

function ClassResults({ batch }: { batch: RmsBatch }) {
  const classes = batch.classes || [];
  const [classId, setClassId] = useState<string | undefined>(classes[0]?.id);
  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  const active = isBatchActive(batch.status);
  const { data: students, isFetching, error } = useGetBatchStudentsQuery(
    { batchId: batch.id, classId },
    { skip: !classId, pollingInterval: active ? 4000 : 0 }
  );
  const current = classes.find((c) => c.id === classId);
  const finished = batch.status === "COMPLETED" || batch.status === "COMPLETED_WITH_ERRORS";
  const classPdfReady = current?.pdfReady ?? finished;

  const sorted = useMemo(
    () => [...(students || [])].sort((a, b) => (a.position || 9999) - (b.position || 9999) || a.name.localeCompare(b.name)),
    [students]
  );

  if (!classes.length) return null;

  return (
    <section aria-labelledby="classes-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="classes-heading" className="text-lg font-bold">Classes</h2>
        {current && (
          <Button asChild={classPdfReady} variant="outline" size="sm" disabled={!classPdfReady}>
            {classPdfReady ? (
              <a href={rmsDownloadUrls.classPdf(batch.id, current.id)}>
                <Download className="mr-1.5 h-4 w-4" />
                {current.name} booklet (PDF)
              </a>
            ) : (
              <span className="inline-flex items-center">
                <Download className="mr-1.5 h-4 w-4" />
                Booklet available when finished
              </span>
            )}
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Classes">
        {classes.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === classId}
            onClick={() => setClassId(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              c.id === classId
                ? "border-[var(--violet-ink)] bg-[var(--violet-tint)] text-[var(--violet-ink)]"
                : "border-[var(--border-fine)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {c.name}
            {typeof c.studentCount === "number" && <span className="ml-1.5 tabular-nums opacity-70">{c.studentCount}</span>}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Position</th>
              <th className="px-4 py-2.5 font-semibold">Student</th>
              <th className="px-4 py-2.5 text-right font-semibold">Average</th>
              <th className="px-4 py-2.5 font-semibold">Grade</th>
              <th className="px-4 py-2.5 font-semibold">Card</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-fine)]">
            {!students && isFetching
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : error
              ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--crimson-signal)]">
                      {rmsErrorMessage(error, "Couldn't load this class.")}
                    </td>
                  </tr>
                )
              : sorted.length === 0
              ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-secondary)]">
                      No students in this class.
                    </td>
                  </tr>
                )
              : sorted.map((row) => {
                  const ready = cardReady(row);
                  return (
                    <tr key={row.id} className="hover:bg-[var(--surface-muted)]/60">
                      <td className="px-4 py-2.5 font-mono tabular-nums">{ordinal(row.position)}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold">{row.name}</span>
                        {row.admissionNo && (
                          <span className="ml-2 font-mono text-xs text-[var(--text-secondary)]">{row.admissionNo}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {typeof row.average === "number" ? row.average.toFixed(1) : "–"}
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{row.grade || "–"}</td>
                      <td className="px-4 py-2.5">
                        <StudentStatus row={row} generating={batch.status === "RENDERING"} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {ready && (
                          <a
                            href={rmsDownloadUrls.studentPdf(batch.id, row.id)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--violet-ink)] hover:underline"
                          >
                            <FileText className="h-4 w-4" />
                            PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const href = useRmsHref();
  // Poll every 2s while the sheet is being checked or cards are generating
  const [pollingInterval, setPollingInterval] = useState(2000);
  const { data: batch, isLoading, error } = useGetBatchQuery(batchId, { pollingInterval });
  useEffect(() => {
    if (batch) setPollingInterval(isBatchActive(batch.status) ? 2000 : 0);
  }, [batch]);

  const [generate, { isLoading: isGenerating }] = useGenerateBatchMutation();
  const startGeneration = async () => {
    try {
      await generate(batchId).unwrap();
      setPollingInterval(2000);
      toast.success("Generating report cards.");
    } catch (err) {
      toast.error(rmsErrorMessage(err, "Couldn't start generating report cards."));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (error || !batch) {
    const notFound = (error as { status?: unknown })?.status === 404;
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-8 text-center">
        <p className="font-semibold">{notFound ? "This batch doesn't exist or belongs to another school." : rmsErrorMessage(error)}</p>
        <Link href={href("/")} className="mt-3 inline-block text-sm font-semibold text-[var(--violet-ink)] hover:underline">
          Back to result batches
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={href("/")} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          Result batches
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{batch.fileName || `${batch.term} results`}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {batch.term} · {batch.session} · {batch.classes?.length || 0} classes ·{" "}
              <span className="tabular-nums">{batch.totalStudents}</span> students
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BatchStatusBadge status={batch.status} />
            {batch.status === "PARSED" && (
              <Button onClick={startGeneration} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Generate {batch.totalStudents} report cards
              </Button>
            )}
          </div>
        </div>
      </div>

      <ProgressPanel batch={batch} />
      {batch.status === "PARSED" && (
        <p className="rounded-[var(--radius-lg)] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          The sheet checked out. Review the positions and grades below, then generate the report cards.
        </p>
      )}
      <IssuesPanel issues={batch.issues || []} />
      {!["UPLOADED", "PARSING", "FAILED"].includes(batch.status) && <ClassResults batch={batch} />}
    </div>
  );
}

export default function RmsBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  return (
    <RmsShell>
      <BatchDetail batchId={batchId} />
    </RmsShell>
  );
}
