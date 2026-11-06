"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      const errors = results.issues.filter((i) => i.level === "error");
      if (errors.length) {
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
    <form onSubmit={submit} className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-bold">Open a result sheet</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        Your Excel sheet (one tab per class) or our filled-in CSV template. Everything is worked out on this laptop; no internet needed.
      </p>

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
        className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging ? "border-[var(--violet-ink)] bg-[var(--violet-tint)]" : "border-[var(--border-fine)] hover:border-[var(--violet-ink)]/50 hover:bg-[var(--surface-muted)]"
        }`}
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
          <div className="flex items-center gap-3 text-left">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{Math.ceil(file.size / 1024)} KB · click to choose another</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setBlocking(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-[var(--violet-ink)]" />
            <p className="mt-2 font-semibold">Drop the Excel file here, or click to choose</p>
            <p className="text-xs text-[var(--text-secondary)]">.xlsx, .xls or .csv</p>
          </>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="term">Term</Label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger id="term" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="session">Session</Label>
          <Input id="session" value={session} onChange={(e) => setSession(e.target.value)} placeholder="2026/2027" />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-[var(--crimson-signal)]">
          {error}
        </p>
      )}
      {blocking && (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-red-200 bg-[var(--crimson-tint)]/40 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-[var(--crimson-signal)]" />
            Fix these in the sheet, then choose it again
          </p>
          <IssueList issues={blocking} className="mt-2" />
        </div>
      )}

      <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={busy || !file}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        {busy ? "Working out results" : "Work out results"}
      </Button>
    </form>
  );
}
