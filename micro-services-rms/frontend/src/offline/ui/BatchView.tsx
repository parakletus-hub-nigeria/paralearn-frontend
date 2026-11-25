"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Copy,
  Download,
  FileStack,
  Info,
  Loader2,
  Play,
  Printer,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { db, deleteBatch, getAccountBatch, getClassResults, type BatchRecord, type BookletRecord, type SchoolProfile } from "../storage/db";
import { K12Error, syncBatch } from "../storage/k12";
import { buildReportCardsPdf } from "../pdf/reportCardPdf";
import type { ClassResult, SheetIssue, StudentResult } from "../engine/types";
import { cancelGeneration, cardContext, clearBooklets, generateBatch, profileFingerprint, useGeneration } from "./generation";
import { downloadBlob, ordinal, plural, safeFileName, timeAgo, useOnline } from "./util";
import { ConfirmDialog } from "./WorkspaceShell";
import IssueList from "./IssueList";
import { columnsParaLearnSkips } from "../engine/k12Workbook";
import "./rms-batch.css";

/** Matches the CSS breakpoint where the card preview moves under the class list */
const STACKED = "(max-width: 760px)";

/** Above this many classes the tab row gets a "Jump to class" picker as well */
const MANY_CLASSES = 8;

const fileTerm = (batch: Pick<BatchRecord, "term" | "session">) => `${batch.term} ${batch.session.replace("/", "-")}`;

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

/**
 * Opens the browser's print dialog for a PDF, saving the download-then-print step.
 * Browsers that can't show PDFs in a page get the PDF in a new tab instead, where they can print it.
 */
function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  // Kept for 10 minutes: the new tab or print dialog may read it well after this call
  const release = () => setTimeout(() => URL.revokeObjectURL(url), 600_000);
  if ((navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled === false) {
    window.open(url, "_blank");
    release();
    return;
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => frame.remove(), 60_000);
    release();
  };
  document.body.appendChild(frame);
}

/** Every class booklet in one PDF, in class order, for schools that print the whole batch at once */
async function combineBooklets(booklets: BookletRecord[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (const b of [...booklets].sort((x, y) => x.index - y.index)) {
    const src = await PDFDocument.load(await b.pdf.arrayBuffer());
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    // Let the page repaint between classes; a whole school can be over a thousand pages
    await new Promise((r) => setTimeout(r));
  }
  return out.save();
}

/** The sheet problems as plain text, ready to paste into WhatsApp for the class teachers */
function issuesAsText(fileName: string, issues: SheetIssue[]) {
  const lines = issues.map((i) => `- ${i.sheet}${i.row ? `, row ${i.row}` : ""}: ${i.message}`);
  return `Things to check in ${fileName}:\n${lines.join("\n")}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or no clipboard permission: fall back to a hidden text box
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Where the scores stand with ParaLearn, with the one action that makes sense */
function SyncStatus({ batch, onSignInNeeded }: { batch: BatchRecord; onSignInNeeded: () => void }) {
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
  let reason: string | null = null;
  let detail = online ? "Sends automatically." : "Sends when you're back online.";
  if (s.status === "syncing") {
    chip = (
      <span className="rms-status ready">
        <Loader2 size={12} className="animate-spin" />
        Sending
      </span>
    );
    detail = "Sending scores to ParaLearn.";
  } else if (s.status === "synced") {
    chip = (
      <span className="rms-status ok">
        <CheckCircle2 size={12} />
        Sent
      </span>
    );
    detail = `Sent ${timeAgo(s.at)}${s.processed ? `, ${plural(s.processed, "student")}` : ""}.`;
  } else if (s.status === "failed") {
    chip = (
      <span className={`rms-status ${s.needsSignIn ? "warn" : "bad"}`}>
        <CloudOff size={12} />
        {s.needsSignIn ? "Sign in needed" : "Not sent"}
      </span>
    );
    detail = s.needsSignIn ? "Sign in again to send." : online ? "Will try again automatically." : "Will try again when you're back online.";
    reason = s.error;
  }
  const canAct = s.status !== "syncing" && online;
  const signIn = s.status === "failed" && s.needsSignIn;
  return (
    <div className="rms-band-cell">
      <span className="rms-band-label">ParaLearn</span>
      <div className="rms-band-line">
        {chip}
        <span className="rms-band-detail">
          {detail}
          {canAct && (
            <>
              {" "}
              <button type="button" className="rms-link" onClick={signIn ? onSignInNeeded : send}>
                {signIn ? "Sign in" : s.status === "synced" ? "Send again" : "Send now"}
              </button>
            </>
          )}
        </span>
      </div>
      {reason && <small className={`rms-band-note ${s.status === "failed" && s.needsSignIn ? "is-warn" : "is-bad"}`}>{reason}</small>}
    </div>
  );
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

function CardPreview({
  student,
  cls,
  profile,
  batch,
  previewRef,
  onBackToList,
}: {
  student: StudentResult | null;
  cls: ClassResult | null;
  profile: SchoolProfile;
  batch: BatchRecord;
  previewRef: React.Ref<HTMLElement>;
  /** Shown where the preview sits under the list (phones), to get back to the chosen row */
  onBackToList: () => void;
}) {
  const inlinePdf = useInlinePdf();
  const [url, setUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const { term, session } = batch;

  useEffect(() => {
    if (!student || !cls) return;
    let cancelled = false;
    let created: string | null = null;
    setBytes(null);
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
  const blob = () => new Blob([bytes as BlobPart], { type: "application/pdf" });
  const download = () => bytes && downloadBlob(blob(), `${safeFileName(`${student.name} - ${student.className} - ${fileTerm(batch)}`)}.pdf`);
  return (
    <aside className="rms-preview rms-batch-preview" aria-label="Report card preview" ref={previewRef} tabIndex={-1}>
      <div className="rms-preview-head">
        <div className="rms-preview-who">
          <strong>{student.name}</strong>
          <span className="rms-num">
            {student.className} · {ordinal(student.position)} of {student.classSize}
          </span>
          <button type="button" className="rms-link rms-preview-back" onClick={onBackToList}>
            Back to the class list
          </button>
        </div>
        {inlinePdf && (
          <div className="rms-preview-actions">
            <button type="button" className="rms-button small" disabled={!bytes} onClick={() => bytes && printPdf(blob())}>
              <Printer size={14} />
              Print
            </button>
            <button type="button" className="rms-button small" disabled={!bytes} onClick={download}>
              <Download size={14} />
              Download
            </button>
          </div>
        )}
      </div>
      {inlinePdf ? (
        <div className="rms-preview-frame">
          {url ? (
            <iframe title={`Report card for ${student.name}`} src={`${url}#toolbar=0&view=FitH`} />
          ) : (
            <div className="rms-skeleton" style={{ height: "100%" }} aria-label="Drawing the card" />
          )}
        </div>
      ) : (
        <CardSummary student={student} onDownload={bytes ? download : undefined} />
      )}
    </aside>
  );
}


export default function BatchView({
  batchId,
  ownerKey,
  profile,
  autoStart,
  onBack,
  onSignInNeeded,
}: {
  batchId: string;
  ownerKey: string;
  profile: SchoolProfile;
  autoStart: boolean;
  onBack: () => void;
  onSignInNeeded: () => void;
}) {
  const batch = useLiveQuery(() => getAccountBatch(batchId, ownerKey), [batchId, ownerKey]);
  const [classes, setClasses] = useState<ClassResult[] | null>(null);
  const booklets = useLiveQuery(async () => {
    if (!(await getAccountBatch(batchId, ownerKey))) return [];
    return db.booklets.where("batchId").equals(batchId).toArray();
  }, [batchId, ownerKey]);
  const [classIdx, setClassIdx] = useState(0);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [combining, setCombining] = useState(false);
  const started = useRef(false);
  const previewRef = useRef<HTMLElement>(null);
  const ledgerRef = useRef<HTMLTableSectionElement>(null);
  const gen = useGeneration();

  useEffect(() => {
    setClasses(null);
    getClassResults(batchId, ownerKey).then(setClasses);
  }, [batchId, ownerKey]);

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
      const outcome = await generateBatch(batchId, ownerKey);
      if (outcome === "done") toast.success("All report cards are ready.");
      else toast.info("Stopped. Finished classes are saved; resume any time.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate the report cards.");
    }
  }, [batchId, ownerKey]);

  // Newly worked-out batch: show the first card (below), then generate the rest
  useEffect(() => {
    if (!autoStart || started.current || !batch || !classes || batch.generatedClasses.length) return;
    started.current = true;
    start();
  }, [autoStart, batch, classes, start]);

  const remove = useCallback(async () => {
    // Only stop generation if it's this batch's cards being made, not another batch's
    cancelGeneration(batchId);
    await deleteBatch(batchId, ownerKey);
    setConfirmDelete(false);
    toast.success("Batch deleted.");
    onBack();
  }, [batchId, onBack, ownerKey]);

  /** Selects a student and, where the preview sits below the list (tablets and phones), brings it into view */
  const pick = useCallback((id: string) => {
    setStudentId(id);
    const el = previewRef.current;
    if (el && window.matchMedia(STACKED).matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  }, []);

  const backToList = useCallback(() => {
    const row = ledgerRef.current?.querySelector<HTMLButtonElement>(`[data-student="${CSS.escape(student?.id || "")}"]`);
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    row.focus({ preventScroll: true });
  }, [student?.id]);

  /** Up and down arrows move through the class list, like a spreadsheet */
  const onLedgerKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const at = sorted.findIndex((s) => s.id === student?.id);
    const next = sorted[Math.min(sorted.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!next || next.id === student?.id) return;
    e.preventDefault();
    setStudentId(next.id);
    ledgerRef.current?.querySelector<HTMLButtonElement>(`[data-student="${CSS.escape(next.id)}"]`)?.focus();
  };

  const chooseClass = (i: number) => {
    setClassIdx(i);
    setStudentId(null);
  };

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
          <FileStack size={28} aria-hidden />
          <h2>This batch isn&apos;t on this laptop</h2>
          <p>It may have been deleted, or opened on another computer. Batches stay on the laptop that worked them out.</p>
          <button type="button" className="rms-button" style={{ marginTop: 18 }} onClick={onBack}>
            <ArrowLeft size={15} />
            Back to result batches
          </button>
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
  const busyNote = busyElsewhere ? "Another batch is making its cards. This one can start when it finishes." : undefined;

  const redo = async () => {
    await clearBooklets(batch.id, ownerKey);
    await start();
  };

  const downloadAll = async () => {
    const ready = (booklets || []).filter((b) => batch.generatedClasses.includes(b.index));
    if (!ready.length) return;
    if (ready.length === 1) {
      downloadBlob(ready[0].pdf, `${safeFileName(`${ready[0].className} report cards - ${fileTerm(batch)}`)}.pdf`);
      return;
    }
    setCombining(true);
    try {
      const bytes = await combineBooklets(ready);
      downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${safeFileName(`All classes report cards - ${fileTerm(batch)}`)}.pdf`);
    } catch {
      toast.error("Couldn't combine the booklets. Download them one class at a time.");
    } finally {
      setCombining(false);
    }
  };

  const copyIssues = async () => {
    const ok = await copyText(issuesAsText(batch.fileName, warnings));
    if (ok) toast.success("Issue list copied. Paste it into WhatsApp or an email for the class teachers.");
    else toast.error("Couldn't copy. Select the list and copy it instead.");
  };

  const cardsLine = running ? (
    <>
      Making <strong>{running.className}</strong> cards:{" "}
      <span className="rms-num">
        {running.classDone} of {running.classTotal}
      </span>
    </>
  ) : allReady ? (
    <>
      {plural(batch.totalStudents, "card")}, one booklet per class, ready to print
    </>
  ) : readyClasses ? (
    <>
      {readyClasses} of {plural(classes.length, "class", "classes")} ready. Resume to make the rest.
    </>
  ) : (
    <>Not made yet</>
  );

  return (
    <main className="rms-page rms-batch">
      <button type="button" className="rms-back" onClick={onBack}>
        <ArrowLeft size={14} />
        Result batches
      </button>

      <header className="rms-batch-head">
        <div className="rms-batch-title">
          <p className="rms-batch-term">
            <span>{batch.term}</span>
            <span className="rms-num">{batch.session} session</span>
          </p>
          <h1>{batch.fileName}</h1>
          <p className="rms-batch-facts rms-num">
            <span>{`${plural(batch.totalStudents, "student")} in ${plural(classes.length, "class", "classes")}`}</span>
            <span>{`School average ${schoolAverage.toFixed(1)}%`}</span>
          </p>
        </div>
        <div className="rms-batch-actions">
          <button type="button" className="rms-button quiet danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
            Delete
          </button>
          {running ? (
            <button type="button" className="rms-button" onClick={() => cancelGeneration(batchId)}>
              <Square size={14} />
              Stop
            </button>
          ) : allReady ? (
            <>
              <button type="button" className="rms-button" onClick={redo} disabled={busyElsewhere || combining} title={busyNote}>
                <RefreshCw size={15} />
                Redo cards
              </button>
              <button type="button" className="rms-button primary" onClick={downloadAll} disabled={combining || !booklets?.length}>
                {combining ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {combining ? "Combining classes" : classes.length > 1 ? "Download all classes" : "Download booklet"}
              </button>
            </>
          ) : (
            <button type="button" className="rms-button primary" onClick={start} disabled={busyElsewhere} title={busyNote}>
              <Play size={15} />
              {readyClasses ? "Resume" : "Make report cards"}
            </button>
          )}
        </div>
      </header>
      {busyElsewhere && !running && !allReady && <p className="rms-batch-busy">{busyNote}</p>}

      <section className="rms-band" aria-label="Status">
        <div className="rms-band-cell" role="status" aria-live="polite">
          <span className="rms-band-label">Report cards</span>
          <div className="rms-band-line">
            {allReady ? (
              <span className="rms-status ok">
                <CheckCircle2 size={12} />
                Ready
              </span>
            ) : running ? (
              <span className="rms-status ready">
                <Loader2 size={12} className="animate-spin" />
                <span className="rms-num">{Math.round(pct * 100)}%</span>
              </span>
            ) : (
              <span className="rms-status">
                <span className="rms-num">
                  {readyCards} of {batch.totalStudents}
                </span>
              </span>
            )}
            <span className="rms-band-detail">{cardsLine}</span>
          </div>
          {(running || (!allReady && readyCards > 0)) && (
            <div
              className="rms-bar rms-band-bar"
              role="progressbar"
              aria-label="Report cards made"
              aria-valuemin={0}
              aria-valuemax={batch.totalStudents}
              aria-valuenow={running ? running.overallDone : readyCards}
            >
              <span style={{ transform: `scaleX(${running ? pct : readyCards / Math.max(1, batch.totalStudents)})` }} />
            </div>
          )}
        </div>
        <SyncStatus batch={batch} onSignInNeeded={onSignInNeeded} />
      </section>

      {batch.generatedClasses.length > 0 && batch.cardsMadeWith && batch.cardsMadeWith !== profileFingerprint(profile) && (
        <p className="rms-notice rms-batch-info" role="status">
          <AlertTriangle size={15} />
          <span>
            The school details changed after these cards were made, so the saved booklets still show the old ones. The
            preview shows the new details.{" "}
            <button type="button" className="rms-link" onClick={redo} disabled={!!running || !!busyElsewhere}>
              Redo cards
            </button>
          </span>
        </p>
      )}

      {skipped.length > 0 && (
        <p className="rms-notice info rms-batch-info">
          <Info size={15} />
          <span>
            {`${skipped.join(" and ")} ${skipped.length === 1 ? "is" : "are"} printed on the cards but ${
              skipped.length === 1 ? "isn't" : "aren't"
            } stored in ParaLearn, which keeps only 1st CA, 2nd CA and Exam.`}
          </span>
        </p>
      )}

      {warnings.length > 0 && (
        <details className="rms-batch-issues">
          <summary>
            <AlertTriangle size={15} aria-hidden />
            <span>
              {plural(warnings.length, "thing")} to check in the sheet
              <small>These don&apos;t stop the cards. If one matters, fix it in the sheet and open the sheet again.</small>
            </span>
            <ChevronDown size={16} className="rms-batch-issues-chevron" aria-hidden />
          </summary>
          <div className="rms-batch-issues-body">
            <IssueList issues={warnings} />
            <button type="button" className="rms-button small" onClick={copyIssues}>
              <Copy size={14} />
              Copy list for teachers
            </button>
          </div>
        </details>
      )}

      <div className="rms-batch-classbar">
        <div className="rms-batch-tabs-wrap">
          <div className="rms-tabs rms-batch-tabs" role="tablist" aria-label="Classes">
            {classes.map((c, i) => {
              const ready = batch.generatedClasses.includes(i);
              return (
                <button
                  key={c.name + i}
                  role="tab"
                  aria-selected={i === classIdx}
                  aria-controls="rms-class-panel"
                  onClick={() => chooseClass(i)}
                >
                  {ready ? (
                    <CheckCircle2 size={13} className="rms-tab-ready" aria-label="cards ready" />
                  ) : running?.className === c.name ? (
                    <Loader2 size={13} className="animate-spin rms-tab-making" aria-label="making cards" />
                  ) : null}
                  {c.name}
                  <small className="rms-num">{c.students.length}</small>
                </button>
              );
            })}
          </div>
        </div>
        {classes.length > MANY_CLASSES && (
          <label className="rms-batch-jump">
            <span className="sr-only">Jump to class</span>
            <select className="rms-select" value={classIdx} onChange={(e) => chooseClass(Number(e.target.value))}>
              {classes.map((c, i) => (
                <option key={c.name + i} value={i}>
                  {c.name} ({c.students.length})
                </option>
              ))}
            </select>
          </label>
        )}
        {cls && (
          <div className="rms-batch-booklet">
            <button type="button" className="rms-button small" disabled={!booklet} onClick={() => booklet && printPdf(booklet.pdf)}>
              <Printer size={14} />
              Print {cls.name}
            </button>
            <button
              type="button"
              className="rms-button small"
              disabled={!booklet}
              onClick={() => booklet && downloadBlob(booklet.pdf, `${safeFileName(`${cls.name} report cards - ${fileTerm(batch)}`)}.pdf`)}
            >
              <Download size={14} />
              {booklet ? `Download ${cls.name} (${plural(booklet.pages, "page")})` : "Booklet not made yet"}
            </button>
          </div>
        )}
      </div>

      {cls && (
        <div className="rms-split rms-batch-split" id="rms-class-panel" role="tabpanel" aria-label={`${cls.name} results`}>
          <section>
            <div className="rms-table-wrap">
              <table className="rms-table rms-ledger">
                <caption className="sr-only">{cls.name} results, best first. Choose a student to preview their card.</caption>
                <thead>
                  <tr>
                    <th scope="col">Pos.</th>
                    <th scope="col">Student</th>
                    <th scope="col" className="rms-hide-md">
                      Admission no.
                    </th>
                    <th scope="col" className="num">
                      Average
                    </th>
                    <th scope="col">Grade</th>
                    <th scope="col" className="num rms-hide-md">
                      Subjects
                    </th>
                  </tr>
                </thead>
                <tbody ref={ledgerRef} onKeyDown={onLedgerKey}>
                  {sorted.map((s) => {
                    const selected = s.id === student?.id;
                    return (
                      <tr key={s.id} onClick={() => pick(s.id)} aria-selected={selected}>
                        <td className="rms-num rms-ledger-pos">{ordinal(s.position)}</td>
                        <td>
                          <button
                            type="button"
                            className="rms-ledger-name"
                            data-student={s.id}
                            aria-current={selected ? "true" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              pick(s.id);
                            }}
                          >
                            {s.name}
                          </button>
                          <span className="rms-ledger-sub">{s.admissionNo || "No admission no."}</span>
                        </td>
                        <td className="mono rms-hide-md">{s.admissionNo || <span className="rms-ledger-missing">None</span>}</td>
                        <td className="num">{s.subjects.length ? s.average.toFixed(1) : "–"}</td>
                        <td>
                          <span className={`rms-status rms-grade ${s.grade === "F" ? "bad" : s.grade === "A" ? "ok" : ""}`}>{s.grade}</span>
                        </td>
                        <td className="num rms-hide-md">{s.subjects.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="rms-ledger-foot">
              <span>
                Class average <strong className="rms-num">{cls.classAverage.toFixed(1)}%</strong>
              </span>
              <span className="rms-ledger-hint">Choose a student to see their card. Arrow keys move through the list.</span>
            </p>
          </section>
          <CardPreview student={student} cls={cls} profile={profile} batch={batch} previewRef={previewRef} onBackToList={backToList} />
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${batch.fileName}?`}
        confirmLabel="Delete from this laptop"
        tone="danger"
        busy={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await remove();
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>
          {`This removes the batch, its results and ${readyCards ? plural(readyCards, "report card") : "any report cards"} from this laptop. `}
          {"It can't be undone, but you can open the sheet again to rebuild them."}
        </p>
        {batch.sync.status === "synced" ? (
          <p className="rms-confirm-note is-ok">The scores were sent to ParaLearn, so they stay safe there.</p>
        ) : (
          <p className="rms-confirm-note is-warn">These scores haven&apos;t reached ParaLearn yet. Deleting loses them unless you still have the sheet.</p>
        )}
      </ConfirmDialog>
    </main>
  );
}
