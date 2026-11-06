"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { processWorkbook } from "../workers/client";
import { saveBatch, type BatchRecord } from "../storage/db";
import type { SheetIssue } from "../engine/types";
import { TERMS, currentSession } from "./util";
import IssueList from "./IssueList";

const MAX_BYTES = 25 * 1024 * 1024;

/** Reads the workbook and computes every result on this laptop, then saves the batch */
export default function NewBatch({ onCreated }: { onCreated: (batchId: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [session, setSession] = useState(currentSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<SheetIssue[] | null>(null);

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
    if (!file) return setError("Choose the result sheet first.");
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
    <section aria-labelledby="open-sheet" id="open-sheet-section">
      <h2 id="open-sheet" className="rms-section-title">
        Open a result sheet
      </h2>
      <p className="rms-section-sub">Your Excel sheet (one tab per class) or our filled-in CSV template. It&apos;s worked out on this laptop; no internet needed.</p>
      <form onSubmit={submit} className="rms-open">
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose result sheet"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`rms-drop ${dragging ? "is-dragging" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {file ? (
            <>
              <FileSpreadsheet size={26} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong>{file.name}</strong>
                <small>{Math.ceil(file.size / 1024)} KB · click to choose another</small>
              </span>
              <button
                type="button"
                className="rms-icon"
                aria-label="Remove file"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setBlocking(null);
                }}
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <UploadCloud size={26} />
              <span>
                <strong>Drop the file here, or click to choose</strong>
                <small>.xlsx, .xls or .csv</small>
              </span>
            </>
          )}
        </div>
        <div className="rms-open-fields">
          <label className="rms-field">
            Term
            <select id="term" className="rms-select" value={term} onChange={(e) => setTerm(e.target.value)}>
              {TERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="rms-field" style={{ maxWidth: 130 }}>
            Session
            <input id="session" className="rms-input rms-num" value={session} onChange={(e) => setSession(e.target.value)} placeholder="2026/2027" />
          </label>
          <button type="submit" className="rms-button primary" disabled={busy || !file}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? "Working out results" : "Work out results"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="rms-notice bad" style={{ marginTop: -16 }}>
          <AlertTriangle size={15} />
          {error}
        </p>
      )}
      {blocking && (
        <div className="rms-notice bad" style={{ marginTop: -16, display: "block" }}>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Fix these in the sheet, then choose it again</p>
          <IssueList issues={blocking} />
        </div>
      )}
    </section>
  );
}
