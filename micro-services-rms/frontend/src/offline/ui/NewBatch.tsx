"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { processWorkbook } from "../workers/client";
import { saveBatch, type BatchRecord } from "../storage/db";
import type { SheetIssue } from "../engine/types";
import { TERMS, currentSession } from "./util";
import IssueList from "./IssueList";

const MAX_BYTES = 25 * 1024 * 1024;

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** The Excel layout the reader expects, drawn as a tiny sheet (parseWorkbook.ts documents it) */
function SheetDiagram() {
  return (
    <div className="rms-sheet-diagram" aria-hidden>
      <table>
        <tbody>
          <tr>
            <td className="is-head">JSS 1A</td>
            <td className="is-head" />
            <td className="is-head is-subject" colSpan={3}>
              Mathematics
            </td>
            <td className="is-head is-subject" colSpan={3}>
              English
            </td>
          </tr>
          <tr>
            <td className="is-label">S/N</td>
            <td className="is-label">Name</td>
            <td className="is-label">1st CA</td>
            <td className="is-label">2nd CA</td>
            <td className="is-label">Exam</td>
            <td className="is-label">1st CA</td>
            <td className="is-label">2nd CA</td>
            <td className="is-label">Exam</td>
          </tr>
          <tr>
            <td>1</td>
            <td>Ada Obi</td>
            <td>15</td>
            <td>18</td>
            <td>55</td>
            <td>14</td>
            <td>17</td>
            <td>48</td>
          </tr>
        </tbody>
      </table>
      <span className="rms-sheet-tabs">
        <span className="is-active">JSS 1A</span>
        <span>JSS 1B</span>
        <span>JSS 2A</span>
      </span>
    </div>
  );
}

/** Reads the workbook and computes every result on this laptop, then saves the batch */
export default function NewBatch({ onCreated, onTemplate }: { onCreated: (batchId: string) => void; onTemplate: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [session, setSession] = useState(currentSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<SheetIssue[] | null>(null);
  const sessionValid = /^\d{4}\/\d{4}$/.test(session.trim());

  const pick = (f?: File | null) => {
    if (!f) return;
    setError(null);
    setBlocking(null);
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return setError("Choose an Excel file (.xlsx or .xls) or a CSV file.");
    if (f.size > MAX_BYTES) return setError("That file is over 25 MB. Remove pictures or unused tabs and try again.");
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Choose your result sheet first: drop it in the box above, or click the box to pick it.");
      document.getElementById("rms-drop")?.focus();
      return;
    }
    if (!/^\d{4}\/\d{4}$/.test(session.trim())) return setError("Write the session as YYYY/YYYY, for example 2026/2027.");
    setBusy(true);
    setError(null);
    setBlocking(null);
    try {
      const results = await processWorkbook(await file.arrayBuffer(), file.name);
      if (results.issues.some((i) => i.level === "error")) {
        setBlocking(results.issues);
        return;
      }
      const batch: BatchRecord = {
        id: crypto.randomUUID(),
        fileName: file.name,
        createdAt: new Date().toISOString(),
        term,
        session: session.trim(),
        totalStudents: results.totalStudents,
        classNames: results.classes.map((c) => c.name),
        issues: results.issues,
        generatedClasses: [],
        sync: { status: "pending" },
      };
      await saveBatch(batch, results.classes);
      setFile(null);
      onCreated(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read this file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="open-sheet" id="open-sheet-section" className="rms-open-panel">
      <div className="rms-section-head">
        <div>
          <h2 id="open-sheet" className="rms-section-title">
            Open a result sheet
          </h2>
          <p className="rms-section-sub">Worked out on this laptop. No internet needed.</p>
        </div>
      </div>

      <form onSubmit={submit} className="rms-open" aria-busy={busy}>
        <div
          id="rms-drop"
          role="button"
          tabIndex={0}
          aria-label={file ? `Chosen: ${file.name}. Choose another file` : "Choose result sheet"}
          aria-describedby="rms-drop-hint"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (busy || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) pick(e.dataTransfer.files?.[0]);
          }}
          className={`rms-drop ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <>
              <span className="rms-drop-icon">
                <FileSpreadsheet size={22} aria-hidden />
              </span>
              <span className="rms-drop-text">
                <strong>{file.name}</strong>
                <small id="rms-drop-hint">{sizeLabel(file.size)} · click to choose another</small>
              </span>
              {!busy && (
                <button
                  type="button"
                  className="rms-icon"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setBlocking(null);
                    setError(null);
                  }}
                >
                  <X size={16} aria-hidden />
                </button>
              )}
            </>
          ) : (
            <>
              <span className="rms-drop-icon">
                <UploadCloud size={22} aria-hidden />
              </span>
              <span className="rms-drop-text">
                <strong>
                  Drop your result sheet here, or <u>choose a file</u>
                </strong>
                <small id="rms-drop-hint">Excel (.xlsx, .xls) or CSV, up to 25 MB</small>
              </span>
            </>
          )}
        </div>

        <div className="rms-open-fields">
          <label className="rms-field">
            Term
            <select id="term" className="rms-select" value={term} onChange={(e) => setTerm(e.target.value)} disabled={busy}>
              {TERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="rms-field rms-field-session">
            Session
            <input
              id="session"
              className="rms-input rms-num"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="2026/2027"
              inputMode="numeric"
              aria-invalid={!sessionValid}
              aria-describedby={!sessionValid ? "session-hint" : undefined}
              disabled={busy}
            />
            {!sessionValid && (
              <small id="session-hint" className="rms-error">
                Like 2026/2027
              </small>
            )}
          </label>
          <button type="submit" className="rms-button primary rms-open-submit" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
            {busy ? "Working out results" : "Work out results"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rms-notice bad">
          <AlertTriangle size={15} aria-hidden />
          {error}
        </p>
      )}
      {blocking && (
        <div className="rms-notice bad is-block" role="alert">
          <p className="rms-notice-title">Fix these in the sheet, then open it again</p>
          <IssueList issues={blocking} />
        </div>
      )}

      <details className="rms-sheet-help">
        <summary>
          What should my sheet look like?
          <ChevronDown size={15} aria-hidden />
        </summary>
        <div className="rms-sheet-help-body">
          <SheetDiagram />
          <ul>
            <li>One tab per class. The tab name becomes the class name.</li>
            <li>Subject names across the top, with 1st CA, 2nd CA and Exam under each subject.</li>
            <li>One student per row. Columns like Admission No may sit between the name and the first subject.</li>
            <li>A Total column is ignored; totals are worked out again.</li>
          </ul>
          <p>
            No sheet like this?{" "}
            <button type="button" className="rms-link" onClick={onTemplate}>
              Use our result sheet template
            </button>
            , in Excel or CSV: one row per student, for the whole school.
          </p>
        </div>
      </details>
    </section>
  );
}
