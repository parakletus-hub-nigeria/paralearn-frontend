"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { db, deleteBatch, getClassResults, type BatchRecord, type SchoolProfile } from "../storage/db";
import { K12Error, syncBatch } from "../storage/k12";
import { buildReportCardsPdf } from "../pdf/reportCardPdf";
import type { ClassResult, StudentResult } from "../engine/types";
import { cancelGeneration, cardContext, clearBooklets, generateBatch, useGeneration } from "./generation";
import { downloadBlob, ordinal, plural, safeFileName, timeAgo, useOnline } from "./util";
import IssueList from "./IssueList";

function SyncPanel({ batch, onSignInNeeded }: { batch: BatchRecord; onSignInNeeded: () => void }) {
  const online = useOnline();
  const s = batch.sync;
  const send = async () => {
    try {
      await syncBatch(batch.id);
      toast.success("Scores sent to ParaLearn.");
    } catch (err) {
      if (err instanceof K12Error && err.needsSignIn) onSignInNeeded();
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    }
  };

  let icon = <CloudUpload className="h-5 w-5 text-[var(--text-secondary)]" />;
  let title = "Scores not sent to ParaLearn yet";
  let detail = online ? "They'll send automatically, or send them now." : "They'll send automatically when this laptop is back online.";
  if (s.status === "syncing") {
    icon = <Loader2 className="h-5 w-5 animate-spin text-[var(--violet-ink)]" />;
    title = "Sending scores to ParaLearn…";
    detail = "";
  } else if (s.status === "synced") {
    icon = <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    title = `Scores sent to ParaLearn ${timeAgo(s.at)}`;
    detail = s.processed ? `${plural(s.processed, "student")} recorded under the school's current term.` : "Recorded under the school's current term.";
  } else if (s.status === "failed") {
    icon = s.needsSignIn ? <CloudOff className="h-5 w-5 text-[var(--amber-signal)]" /> : <AlertTriangle className="h-5 w-5 text-[var(--crimson-signal)]" />;
    title = s.needsSignIn ? "Sign in again to send scores" : "Scores couldn't be sent";
    detail = s.error;
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5">{icon}</span>
        <div>
          <p className="font-semibold">{title}</p>
          {detail && <p className="text-sm text-[var(--text-secondary)]">{detail}</p>}
          {s.status === "synced" && s.droppedColumns?.length ? (
            <p className="mt-1 text-xs text-amber-800">
              ParaLearn records only 1st CA, 2nd CA and Exam, so these columns stayed on the cards only: {s.droppedColumns.slice(0, 3).join(", ")}
              {s.droppedColumns.length > 3 ? ", …" : ""}
            </p>
          ) : null}
        </div>
      </div>
      {s.status !== "syncing" && (
        <Button
          variant="outline"
          size="sm"
          disabled={!online}
          onClick={s.status === "failed" && s.needsSignIn ? onSignInNeeded : send}
          className="shrink-0"
        >
          {s.status === "failed" && s.needsSignIn ? "Sign in" : s.status === "synced" ? "Send again" : "Send scores now"}
        </Button>
      )}
    </div>
  );
}

function GenerationPanel({ batch, classes }: { batch: BatchRecord; classes: ClassResult[] }) {
  const gen = useGeneration();
  const running = gen?.batchId === batch.id;
  const busyElsewhere = !!gen && !running;
  const readyClasses = batch.generatedClasses.length;
  const allReady = readyClasses === classes.length;

  const start = async () => {
    try {
      const outcome = await generateBatch(batch.id);
      if (outcome === "done") toast.success("All report cards are ready.");
      else toast.info("Stopped. Finished classes are saved; resume any time.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the report cards.");
    }
  };
  const redo = async () => {
    await clearBooklets(batch.id);
    await start();
  };

  if (running && gen) {
    const pct = gen.overallTotal ? Math.round((gen.overallDone / gen.overallTotal) * 100) : 0;
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">
            Generating {gen.className}: <span className="tabular-nums">{gen.classDone} of {gen.classTotal}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={cancelGeneration}>
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        </div>
        <Progress value={pct} className="mt-2 h-2" />
        <p className="mt-2 text-xs tabular-nums text-[var(--text-secondary)]">
          {gen.overallDone} of {gen.overallTotal} cards · finished classes are saved as they complete
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">
          {allReady ? "All report cards are ready" : readyClasses ? `${readyClasses} of ${plural(classes.length, "class", "classes")} ready` : "Report cards not generated yet"}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {allReady ? "Download a class booklet below, or any student's card." : "Generated one class at a time and saved on this laptop."}
        </p>
      </div>
      {allReady ? (
        <Button variant="outline" size="sm" onClick={redo} disabled={busyElsewhere} title="Redraw every card, e.g. after changing the school profile">
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Redo cards
        </Button>
      ) : (
        <Button size="sm" onClick={start} disabled={busyElsewhere}>
          <Play className="mr-1.5 h-4 w-4" />
          {readyClasses ? "Resume" : "Generate report cards"}
        </Button>
      )}
    </div>
  );
}

function CardPreview({ student, cls, profile, batch }: { student: StudentResult | null; cls: ClassResult | null; profile: SchoolProfile; batch: BatchRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const { term, session } = batch;

  useEffect(() => {
    if (!student || !cls) return;
    let cancelled = false;
    let created: string | null = null;
    // One page draws in a few milliseconds, so previews run on the main thread and never wait behind a class
    buildReportCardsPdf([student], cls, cardContext(profile, { term, session })).then((pdf) => {
      if (cancelled) return;
      created = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      setBytes(pdf);
      setUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [student, cls, profile, term, session]);

  if (!student) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{student.name}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!bytes}
          onClick={() =>
            bytes &&
            downloadBlob(
              new Blob([bytes as BlobPart], { type: "application/pdf" }),
              `${safeFileName(`${student.name} - ${student.className} - ${batch.term} ${batch.session.replace("/", "-")}`)}.pdf`
            )
          }
        >
          <Download className="mr-1.5 h-4 w-4" />
          This card
        </Button>
      </div>
      <div className="aspect-[1/1.414] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white">
        {url ? (
          <iframe title={`Report card for ${student.name}`} src={`${url}#toolbar=0&view=FitH`} className="h-full w-full" />
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>
    </div>
  );
}

export default function BatchView({
  batchId,
  profile,
  autoStart,
  onBack,
  onSignInNeeded,
}: {
  batchId: string;
  profile: SchoolProfile;
  autoStart: boolean;
  onBack: () => void;
  onSignInNeeded: () => void;
}) {
  const batch = useLiveQuery(() => db.batches.get(batchId), [batchId]);
  const [classes, setClasses] = useState<ClassResult[] | null>(null);
  const booklets = useLiveQuery(() => db.booklets.where("batchId").equals(batchId).toArray(), [batchId]);
  const [classIdx, setClassIdx] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    getClassResults(batchId).then(setClasses);
  }, [batchId]);

  const cls = classes?.[classIdx] ?? null;
  const sorted = useMemo(() => (cls ? [...cls.students].sort((a, b) => a.position - b.position || a.row - b.row) : []), [cls]);
  const student = cls?.students.find((s) => s.id === studentId) || sorted[0] || null;

  // Newly worked-out batch: show the first card (above), then generate the rest
  useEffect(() => {
    if (!autoStart || started.current || !batch || !classes || batch.generatedClasses.length) return;
    started.current = true;
    generateBatch(batchId)
      .then((o) => o === "done" && toast.success("All report cards are ready."))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't generate the report cards."));
  }, [autoStart, batch, classes, batchId]);

  const remove = useCallback(async () => {
    if (!window.confirm("Delete this batch and its report cards from this laptop? Scores already sent to ParaLearn stay there.")) return;
    cancelGeneration();
    await deleteBatch(batchId);
    toast.success("Batch deleted.");
    onBack();
  }, [batchId, onBack]);

  if (batch === undefined || !classes) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!batch) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-8 text-center">
        <p className="font-semibold">This batch isn&apos;t on this laptop.</p>
        <Button variant="link" onClick={onBack}>
          Back to batches
        </Button>
      </div>
    );
  }

  const booklet = booklets?.find((b) => b.index === classIdx);
  const warnings = batch.issues.filter((i) => i.level === "warning");

  return (
    <div className="space-y-5">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          Result batches
        </button>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{batch.fileName}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {batch.term} · {batch.session} · {plural(classes.length, "class", "classes")} · {plural(batch.totalStudents, "student")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={remove} className="self-start text-[var(--text-secondary)]">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <GenerationPanel batch={batch} classes={classes} />
      <SyncPanel batch={batch} onSignInNeeded={onSignInNeeded} />

      {warnings.length > 0 && (
        <details className="rounded-[var(--radius-lg)] border border-amber-200 bg-[var(--amber-tint)]/40 p-4">
          <summary className="cursor-pointer font-semibold">
            <AlertTriangle className="mr-2 inline h-4 w-4 text-[var(--amber-signal)]" />
            {plural(warnings.length, "thing")} to check in the sheet
          </summary>
          <IssueList issues={warnings} className="mt-3" />
        </details>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Classes">
        {classes.map((c, i) => {
          const ready = batch.generatedClasses.includes(i);
          return (
            <button
              key={c.name + i}
              role="tab"
              aria-selected={i === classIdx}
              onClick={() => {
                setClassIdx(i);
                setStudentId(null);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                i === classIdx
                  ? "border-[var(--violet-ink)] bg-[var(--violet-tint)] text-[var(--violet-ink)]"
                  : "border-[var(--border-fine)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {ready && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="cards ready" />}
              {c.name}
              <span className="tabular-nums opacity-70">{c.students.length}</span>
            </button>
          );
        })}
      </div>

      {cls && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--text-secondary)]">
                Class average <span className="font-mono font-semibold text-[var(--foreground)]">{cls.classAverage.toFixed(1)}%</span>
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={!booklet}
                onClick={() =>
                  booklet &&
                  downloadBlob(booklet.pdf, `${safeFileName(`${cls.name} report cards - ${batch.term} ${batch.session.replace("/", "-")}`)}.pdf`)
                }
              >
                <Download className="mr-1.5 h-4 w-4" />
                {booklet ? `${cls.name} booklet (${plural(booklet.pages, "page")})` : "Booklet not generated yet"}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Pos.</th>
                    <th className="px-3 py-2.5 font-semibold">Student</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Average</th>
                    <th className="px-3 py-2.5 font-semibold">Grade</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-fine)]">
                  {sorted.map((s) => {
                    const selected = s.id === student?.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setStudentId(s.id)}
                        aria-selected={selected}
                        className={`cursor-pointer ${selected ? "bg-[var(--violet-tint)]" : "hover:bg-[var(--surface-muted)]/70"}`}
                      >
                        <td className="px-3 py-2 font-mono tabular-nums">{ordinal(s.position)}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold">{s.name}</span>
                          {s.admissionNo && <span className="ml-2 font-mono text-xs text-[var(--text-secondary)]">{s.admissionNo}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{s.average.toFixed(1)}</td>
                        <td className="px-3 py-2 font-semibold">{s.grade}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{s.subjects.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
              <FileText className="h-3.5 w-3.5" />
              Card preview
            </p>
            <CardPreview student={student} cls={cls} profile={profile} batch={batch} />
          </aside>
        </div>
      )}
    </div>
  );
}
