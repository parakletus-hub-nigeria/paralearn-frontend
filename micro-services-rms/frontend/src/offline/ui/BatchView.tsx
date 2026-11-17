"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Download, Info, Loader2, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db, deleteBatch, getClassResults, type BatchRecord, type SchoolProfile } from "../storage/db";
import { K12Error, syncBatch } from "../storage/k12";
import { buildReportCardsPdf } from "../pdf/reportCardPdf";
import type { ClassResult, StudentResult } from "../engine/types";
import { cancelGeneration, cardContext, clearBooklets, generateBatch, useGeneration } from "./generation";
import { downloadBlob, ordinal, plural, safeFileName, timeAgo, useOnline } from "./util";
import IssueList from "./IssueList";
import { columnsParaLearnSkips } from "../engine/k12Workbook";

/** The sync cell of the summary row */
function SyncSummary({ batch, onSignInNeeded }: { batch: BatchRecord; onSignInNeeded: () => void }) {
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

  let chip = <span className="rms-status">Not sent yet</span>;
  let detail = online ? "Sends automatically" : "Sends when back online";
  if (s.status === "syncing") {
    chip = (
      <span className="rms-status ready">
        <Loader2 size={12} className="animate-spin" />
        Sending
      </span>
    );
    detail = "Sending scores to ParaLearn";
  } else if (s.status === "synced") {
    chip = (
      <span className="rms-status ok">
        <CheckCircle2 size={12} />
        Sent
      </span>
    );
    detail = `Scores sent to ParaLearn ${timeAgo(s.at)}${s.processed ? `, ${plural(s.processed, "student")}` : ""}`;
  } else if (s.status === "failed") {
    chip = (
      <span className={`rms-status ${s.needsSignIn ? "warn" : "bad"}`}>
        <CloudOff size={12} />
        {s.needsSignIn ? "Sign in needed" : "Not sent"}
      </span>
    );
    detail = s.needsSignIn ? "Sign in again to send" : "Will retry automatically";
  }
  const canAct = s.status !== "syncing" && online;
  return (
    <div>
      <dt>ParaLearn sync</dt>
      <dd className="text">{chip}</dd>
      <small>
        {detail}
        {canAct && (
          <>
            {" · "}
            <button type="button" className="rms-link" onClick={s.status === "failed" && s.needsSignIn ? onSignInNeeded : send}>
              {s.status === "failed" && s.needsSignIn ? "Sign in" : s.status === "synced" ? "Send again" : "Send now"}
            </button>
          </>
        )}
      </small>
    </div>
  );
}

/**
 * Whether this browser shows PDFs inside the page. Chrome on Android and other mobile browsers
 * report false and would show an empty frame, so they get a summary and a download instead.
 */
function useInlinePdf(): boolean {
  const [inline, setInline] = useState(true);
  useEffect(() => {
    setInline((navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false);
  }, []);
  return inline;
}

/** The card's key facts as a page element, for browsers that can't show the PDF itself */
function CardSummary({ student, onDownload }: { student: StudentResult; onDownload?: () => void }) {
  return (
    <div className="rms-card-summary">
      <dl>
        <div>
          <dt>Class</dt>
          <dd>{student.className}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd className="rms-num">
            {ordinal(student.position)} of {student.classSize}
          </dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd className="rms-num">{student.average.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Grade</dt>
          <dd>{student.grade}</dd>
        </div>
      </dl>
      <table className="rms-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th className="num">Total</th>
            <th>Grade</th>
            <th className="num">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((s) => (
            <tr key={s.subject} style={{ cursor: "default" }}>
              <td>{s.subject}</td>
              <td className="num">{Number.isInteger(s.total) ? s.total : s.total.toFixed(1)}</td>
              <td>{s.grade}</td>
              <td className="num">{ordinal(s.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rms-section-sub" style={{ margin: 0 }}>
        This browser can&apos;t show the card here. Download it to see the full card or print it.
      </p>
      <button type="button" className="rms-button primary" disabled={!onDownload} onClick={onDownload}>
        <Download size={15} />
        Download {student.name.split(/\s+/)[0]}&apos;s card
      </button>
    </div>
  );
}

function CardPreview({ student, cls, profile, batch }: { student: StudentResult | null; cls: ClassResult | null; profile: SchoolProfile; batch: BatchRecord }) {
  const inlinePdf = useInlinePdf();
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
  const download = () =>
    bytes &&
    downloadBlob(
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
      `${safeFileName(`${student.name} - ${student.className} - ${term} ${session.replace("/", "-")}`)}.pdf`
    );
  return (
    <aside className="rms-preview" aria-label="Report card preview">
      <div className="rms-preview-head">
        <strong>{student.name}</strong>
        <button type="button" className="rms-button small" disabled={!bytes} onClick={download}>
          <Download size={14} />
          This card
        </button>
      </div>
      {inlinePdf ? (
        <div className="rms-preview-frame">
          {url ? <iframe title={`Report card for ${student.name}`} src={`${url}#toolbar=0&view=FitH`} /> : <div className="rms-skeleton" style={{ height: "100%" }} />}
        </div>
      ) : (
        <CardSummary student={student} onDownload={bytes ? download : undefined} />
      )}
    </aside>
  );
}

const unit = { fontSize: 15, color: "var(--rms-muted)", fontWeight: 600 } as const;

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
  const gen = useGeneration();

  useEffect(() => {
    getClassResults(batchId).then(setClasses);
  }, [batchId]);

  const cls = classes?.[classIdx] ?? null;
  const sorted = useMemo(() => (cls ? [...cls.students].sort((a, b) => a.position - b.position || a.row - b.row) : []), [cls]);
  const student = cls?.students.find((s) => s.id === studentId) || sorted[0] || null;
  const schoolAverage = useMemo(() => {
    const all = (classes || []).flatMap((c) => c.students.filter((s) => s.subjects.length).map((s) => s.average));
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  }, [classes]);
  // Score columns that print on the cards but that ParaLearn doesn't keep (e.g. a 3rd CA)
  const skipped = useMemo(() => (classes ? columnsParaLearnSkips(classes) : []), [classes]);

  const start = useCallback(async () => {
    try {
      const outcome = await generateBatch(batchId);
      if (outcome === "done") toast.success("All report cards are ready.");
      else toast.info("Stopped. Finished classes are saved; resume any time.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the report cards.");
    }
  }, [batchId]);

  // Newly worked-out batch: show the first card (below), then generate the rest
  useEffect(() => {
    if (!autoStart || started.current || !batch || !classes || batch.generatedClasses.length) return;
    started.current = true;
    start();
  }, [autoStart, batch, classes, start]);

  const remove = useCallback(async () => {
    if (!window.confirm("Delete this batch and its report cards from this laptop? Scores already sent to ParaLearn stay there.")) return;
    cancelGeneration();
    await deleteBatch(batchId);
    toast.success("Batch deleted.");
    onBack();
  }, [batchId, onBack]);

  if (batch === undefined || !classes) {
    return (
      <main className="rms-page" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rms-skeleton" />
        ))}
      </main>
    );
  }
  if (!batch) {
    return (
      <main className="rms-page">
        <div className="rms-empty">
          <h2>This batch isn&apos;t on this laptop</h2>
          <p>
            <button type="button" className="rms-link" onClick={onBack}>
              Back to result batches
            </button>
          </p>
        </div>
      </main>
    );
  }

  const running = gen?.batchId === batch.id ? gen : null;
  const busyElsewhere = !!gen && !running;
  const readyClasses = batch.generatedClasses.length;
  const allReady = readyClasses === classes.length;
  const readyCards = classes.filter((_, i) => batch.generatedClasses.includes(i)).reduce((a, c) => a + c.students.length, 0);
  const booklet = booklets?.find((b) => b.index === classIdx);
  const warnings = batch.issues.filter((i) => i.level === "warning");
  const pct = running && running.overallTotal ? running.overallDone / running.overallTotal : 0;

  const redo = async () => {
    await clearBooklets(batch.id);
    await start();
  };

  return (
    <main className="rms-page">
      <button type="button" className="rms-back" onClick={onBack}>
        <ArrowLeft size={14} />
        Result batches
      </button>
      <div className="rms-page-heading">
        <div style={{ minWidth: 0 }}>
          <span className="rms-eyebrow">
            {batch.term} · {batch.session}
          </span>
          <h1>{batch.fileName}</h1>
        </div>
        <div className="rms-page-actions">
          <button type="button" className="rms-button quiet danger" onClick={remove}>
            <Trash2 size={15} />
            Delete
          </button>
          {running ? (
            <button type="button" className="rms-button" onClick={cancelGeneration}>
              <Square size={14} />
              Stop
            </button>
          ) : allReady ? (
            <button type="button" className="rms-button" onClick={redo} disabled={busyElsewhere} title="Redraw every card, e.g. after changing the school profile">
              <RefreshCw size={15} />
              Redo cards
            </button>
          ) : (
            <button type="button" className="rms-button primary" onClick={start} disabled={busyElsewhere}>
              <Play size={15} />
              {readyClasses ? "Resume" : "Generate report cards"}
            </button>
          )}
        </div>
      </div>

      <dl className="rms-summary">
        <div>
          <dt>Students</dt>
          <dd>{batch.totalStudents}</dd>
          <small>in {plural(classes.length, "class", "classes")}</small>
        </div>
        <div>
          <dt>Report cards</dt>
          <dd>
            {running ? running.overallDone : readyCards}
            <span style={unit}> / {batch.totalStudents}</span>
          </dd>
          <small>
            {allReady
              ? "All report cards are ready"
              : running
              ? `Generating ${running.className}`
              : `${readyClasses} of ${plural(classes.length, "class", "classes")} ready`}
          </small>
        </div>
        <div>
          <dt>School average</dt>
          <dd>
            {schoolAverage.toFixed(1)}
            <span style={unit}>%</span>
          </dd>
          <small>across every student</small>
        </div>
        <SyncSummary batch={batch} onSignInNeeded={onSignInNeeded} />
      </dl>

      {running && (
        <div className="rms-progress" role="status" aria-live="polite">
          <div className="rms-progress-row">
            <span>
              Generating <strong>{running.className}</strong>: <span className="rms-num">{running.classDone} of {running.classTotal}</span>
            </span>
            <span className="rms-num">{Math.round(pct * 100)}%</span>
          </div>
          <div className="rms-bar">
            <span style={{ transform: `scaleX(${pct})` }} />
          </div>
        </div>
      )}

      {batch.sync.status === "failed" && batch.sync.needsSignIn && (
        <p className="rms-notice">
          <CloudOff size={15} />
          <span>{batch.sync.error}</span>
          <button type="button" className="rms-button small" onClick={onSignInNeeded}>
            Sign in
          </button>
        </p>
      )}

      {skipped.length > 0 && (
        <p className="rms-notice info">
          <Info size={15} />
          <span>
            {skipped.join(" and ")} {skipped.length === 1 ? "is" : "are"} printed on the cards but {skipped.length === 1 ? "isn't" : "aren't"} stored in
            ParaLearn, which keeps only 1st CA, 2nd CA and Exam.
          </span>
        </p>
      )}

      {warnings.length > 0 && (
        <details className="rms-notice rms-issues" style={{ display: "block" }}>
          <summary style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
            <AlertTriangle size={15} />
            {plural(warnings.length, "thing")} to check in the sheet
            <span style={{ marginLeft: "auto", fontWeight: 500, textDecoration: "underline" }}>Show</span>
          </summary>
          <IssueList issues={warnings} />
        </details>
      )}

      <div className="rms-toolbar">
        <div className="rms-tabs" role="tablist" aria-label="Classes">
          {classes.map((c, i) => (
            <button
              key={c.name + i}
              role="tab"
              aria-selected={i === classIdx}
              onClick={() => {
                setClassIdx(i);
                setStudentId(null);
              }}
            >
              {batch.generatedClasses.includes(i) && <CheckCircle2 size={13} style={{ color: "#047857" }} aria-label="cards ready" />}
              {c.name}
              <small>{c.students.length}</small>
            </button>
          ))}
        </div>
        {cls && (
          <button
            type="button"
            className="rms-button small"
            disabled={!booklet}
            onClick={() => booklet && downloadBlob(booklet.pdf, `${safeFileName(`${cls.name} report cards - ${batch.term} ${batch.session.replace("/", "-")}`)}.pdf`)}
          >
            <Download size={14} />
            {booklet ? `${cls.name} booklet (${plural(booklet.pages, "page")})` : "Booklet not generated yet"}
          </button>
        )}
      </div>

      {cls && (
        <div className="rms-split">
          <section aria-label={`${cls.name} results`}>
            <div className="rms-table-wrap">
              <table className="rms-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Student</th>
                    <th className="rms-hide-sm">Admission no.</th>
                    <th className="num">Average</th>
                    <th>Grade</th>
                    <th className="num rms-hide-sm">Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.id} onClick={() => setStudentId(s.id)} aria-selected={s.id === student?.id}>
                      <td className="rms-num" style={{ fontWeight: 600 }}>
                        {ordinal(s.position)}
                      </td>
                      <td>
                        <span className="rms-table-name">{s.name}</span>
                      </td>
                      <td className="mono rms-hide-sm">{s.admissionNo || "–"}</td>
                      <td className="num">{s.average.toFixed(1)}</td>
                      <td>
                        <span className={`rms-status ${s.grade === "F" ? "bad" : s.grade === "A" ? "ok" : ""}`}>{s.grade}</span>
                      </td>
                      <td className="num rms-hide-sm">{s.subjects.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rms-section-sub" style={{ marginTop: 12 }}>
              Class average <strong className="rms-num" style={{ color: "var(--rms-ink)" }}>{cls.classAverage.toFixed(1)}%</strong>. Select a student to preview their card.
            </p>
          </section>
          <CardPreview student={student} cls={cls} profile={profile} batch={batch} />
        </div>
      )}
    </main>
  );
}
