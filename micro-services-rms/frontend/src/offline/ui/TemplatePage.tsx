"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_SUBJECTS, SCORE_COLUMNS, buildCsvTemplate, cleanList, type ScoreColumnKey } from "../engine/csvTemplate";
import { downloadBlob, plural, safeFileName } from "./util";
import "./rms-forms.css";

const STORAGE_KEY = "rms-csv-template-settings";

interface Settings {
  classes: string;
  subjects: string;
  scoreColumns: ScoreColumnKey[];
  rowsPerClass: number;
  includeTeacherColumns: boolean;
}

const DEFAULTS: Settings = {
  classes: "",
  subjects: DEFAULT_SUBJECTS.join("\n"),
  scoreColumns: ["CA1", "CA2", "EXAM"],
  rowsPerClass: 40,
  includeTeacherColumns: true,
};

type Problem = "classes" | "subjects" | "columns" | "rows";
type Format = "csv" | "xlsx";

/** How many subject columns the preview shows before "and N more" */
const PREVIEW_SUBJECTS = 2;

/** For schools without their own result sheet: build a CSV (or Excel file) to fill in, then open it */
export default function TemplatePage({ schoolName, onBack }: { schoolName: string; onBack: () => void }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState<Format | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setS({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {
      /* private mode or blocked storage: keep defaults */
    }
  }, []);

  const update = (patch: Partial<Settings>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* not essential */
      }
      return next;
    });

  const toggleColumn = (key: ScoreColumnKey, on: boolean) =>
    update({ scoreColumns: SCORE_COLUMNS.map((c) => c.key).filter((k) => (k === key ? on : s.scoreColumns.includes(k))) });

  const classes = useMemo(() => cleanList(s.classes), [s.classes]);
  const subjects = useMemo(() => cleanList(s.subjects), [s.subjects]);
  const labels = SCORE_COLUMNS.filter((c) => s.scoreColumns.includes(c.key)).map((c) => c.label);
  const columnCount = 4 + subjects.length * labels.length + (s.includeTeacherColumns ? 3 : 0);
  const rowsOk = Number.isFinite(s.rowsPerClass) && s.rowsPerClass >= 1 && s.rowsPerClass <= 200;
  const rows = rowsOk ? Math.round(s.rowsPerClass) : 0;
  const subjectsAreDefault = cleanList(s.subjects).join("|") === DEFAULT_SUBJECTS.join("|");

  // Errors only show after a download attempt, then clear as each one is fixed
  const current: Problem[] = [
    ...(!classes.length ? (["classes"] as const) : []),
    ...(!subjects.length ? (["subjects"] as const) : []),
    ...(!s.scoreColumns.length ? (["columns"] as const) : []),
    ...(!rowsOk ? (["rows"] as const) : []),
  ];
  const shown = problems.filter((p) => current.includes(p));
  const has = (p: Problem) => shown.includes(p);

  const removeClass = (name: string) => update({ classes: classes.filter((c) => c !== name).join("\n") });

  const download = async (format: Format) => {
    if (current.length) {
      setProblems(current);
      const first = current[0];
      document.getElementById(first === "classes" ? "tpl-classes" : first === "subjects" ? "tpl-subjects" : first === "rows" ? "tpl-rows" : "tpl-col-CA1")?.focus();
      return;
    }
    const csv = buildCsvTemplate({
      classes,
      subjects,
      scoreColumns: s.scoreColumns,
      rowsPerClass: rows,
      includeTeacherColumns: s.includeTeacherColumns,
    });
    const name = `${safeFileName(schoolName || "School")} result sheet template`;
    if (format === "csv") {
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      toast.success("Template downloaded. Fill it in, save it, then open it from Result batches.");
      return;
    }
    setBusy("xlsx");
    try {
      // Same rows as the CSV, so both files open the same way in Result batches
      const XLSX = await import("xlsx");
      const book = XLSX.read(csv.replace(/^﻿/, ""), { type: "string", raw: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      const header = csv.replace(/^﻿/, "").split("\r\n")[0].split(",");
      // Admission numbers like 0012 or KC/001 must stay text, or Excel rewrites them
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      for (let r = 1; r <= range.e.r; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: 3 });
        sheet[ref] = { t: "s", v: "", z: "@" };
      }
      sheet["!cols"] = header.map((h, i) => ({ wch: i === 2 ? 28 : i < 2 ? 8 : Math.max(10, Math.min(24, h.length + 2)) }));
      const first = book.SheetNames[0];
      book.SheetNames[0] = "Results";
      book.Sheets.Results = sheet;
      if (first !== "Results") delete book.Sheets[first];
      const out = XLSX.write(book, { bookType: "xlsx", type: "array" });
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
      toast.success("Template downloaded. Fill it in, save it, then open it from Result batches.");
    } catch {
      toast.error("The Excel version couldn't be made here. Download the CSV instead; it opens in Excel too.");
    } finally {
      setBusy(null);
    }
  };

  const previewSubjects = subjects.slice(0, PREVIEW_SUBJECTS);
  const hiddenColumns = Math.max(0, subjects.length - PREVIEW_SUBJECTS) * labels.length + (s.includeTeacherColumns ? 3 : 0);
  const sampleClass = classes[0] || "JSS 1A";

  return (
    <main className="rms-page">
      <button type="button" className="rms-back" onClick={onBack}>
        <ArrowLeft size={14} />
        Result batches
      </button>
      <div className="rms-page-heading rms-tpl-heading">
        <div>
          <span className="rms-eyebrow">For schools without their own result sheet</span>
          <h1>Result sheet template</h1>
          <p className="rms-tpl-lede">Set your classes and subjects, download the sheet, and have teachers fill in one row per student.</p>
        </div>
        <div className="rms-page-actions">
          <button type="button" className="rms-button" onClick={() => download("xlsx")} disabled={!!busy}>
            {busy === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            Excel (.xlsx)
          </button>
          <button type="button" className="rms-button primary" onClick={() => download("csv")} disabled={!!busy}>
            <Download size={16} />
            Download CSV
          </button>
        </div>
      </div>

      <div className="rms-pf rms-tpl">
        <div className="rms-pf-form">
          <section className="rms-pf-section" aria-labelledby="tpl-classes-title">
            <header>
              <h2 id="tpl-classes-title">Classes</h2>
              <p>Every class gets its own block of rows.</p>
            </header>
            <div className="rms-pf-fields">
              <label className="rms-field">
                <span className="sr-only">Classes</span>
                <textarea
                  id="tpl-classes"
                  className="rms-textarea"
                  rows={4}
                  value={s.classes}
                  onChange={(e) => update({ classes: e.target.value })}
                  placeholder={"JSS 1A\nJSS 1B\nJSS 2A"}
                  aria-invalid={has("classes")}
                  aria-describedby="tpl-classes-hint"
                />
                <small id="tpl-classes-hint">One per line, or separated by commas.</small>
                {has("classes") && (
                  <span className="rms-pf-error" role="alert">
                    Add at least one class, e.g. JSS 1A.
                  </span>
                )}
              </label>
              {classes.length > 0 && (
                <ul className="rms-tpl-chips" aria-label={`${plural(classes.length, "class", "classes")} in the template`}>
                  {classes.map((c) => (
                    <li key={c}>
                      {c}
                      <button type="button" onClick={() => removeClass(c)} aria-label={`Remove ${c}`}>
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rms-pf-section" aria-labelledby="tpl-subjects-title">
            <header>
              <h2 id="tpl-subjects-title">Subjects</h2>
              <p>Each subject is marked out of 100.</p>
            </header>
            <div className="rms-pf-fields">
              <label className="rms-field">
                <span className="sr-only">Subjects</span>
                <textarea
                  id="tpl-subjects"
                  className="rms-textarea"
                  rows={Math.min(12, Math.max(5, s.subjects.split("\n").length + 1))}
                  value={s.subjects}
                  onChange={(e) => update({ subjects: e.target.value })}
                  aria-invalid={has("subjects")}
                  aria-describedby="tpl-subjects-hint"
                />
                <small id="tpl-subjects-hint" className="rms-tpl-hintrow">
                  <span>{subjects.length ? `${plural(subjects.length, "subject")}, one per line or separated by commas.` : "One per line, or separated by commas."}</span>
                  {!subjectsAreDefault && (
                    <button type="button" className="rms-link" onClick={() => update({ subjects: DEFAULT_SUBJECTS.join("\n") })}>
                      Use common subjects
                    </button>
                  )}
                </small>
                {has("subjects") && (
                  <span className="rms-pf-error" role="alert">
                    Add at least one subject.
                  </span>
                )}
              </label>
            </div>
          </section>

          <section className="rms-pf-section" aria-labelledby="tpl-cols-title">
            <header>
              <h2 id="tpl-cols-title">Score columns</h2>
              <p>Repeated for every subject.</p>
            </header>
            <div className="rms-pf-fields">
              <div className="rms-tpl-columns" role="group" aria-labelledby="tpl-cols-title">
                {SCORE_COLUMNS.map((c) => (
                  <label key={c.key} className={`rms-tpl-option ${s.scoreColumns.includes(c.key) ? "is-on" : ""}`}>
                    <input id={`tpl-col-${c.key}`} type="checkbox" checked={s.scoreColumns.includes(c.key)} onChange={(e) => toggleColumn(c.key, e.target.checked)} />
                    <span>
                      <strong>{c.label}</strong>
                      <small>{c.key === "CA3" ? "If your school has one. Printed on cards, not stored in ParaLearn." : c.hint[0].toUpperCase() + c.hint.slice(1)}</small>
                    </span>
                  </label>
                ))}
              </div>
              {has("columns") && (
                <span className="rms-pf-error" role="alert">
                  Pick at least one score column.
                </span>
              )}
            </div>
          </section>

          <section className="rms-pf-section" aria-labelledby="tpl-extra-title">
            <header>
              <h2 id="tpl-extra-title">Rows and extras</h2>
              <p>Blank rows to fill in, and what else each card can show.</p>
            </header>
            <div className="rms-pf-fields">
              <label className="rms-field rms-tpl-rows">
                Rows per class
                <span className="rms-affix">
                  <input
                    id="tpl-rows"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    value={Number.isFinite(s.rowsPerClass) ? s.rowsPerClass : ""}
                    onChange={(e) => update({ rowsPerClass: e.target.value === "" ? NaN : Number(e.target.value) })}
                    aria-invalid={has("rows")}
                    aria-describedby="tpl-rows-hint"
                  />
                  <span>students</span>
                </span>
                <small id="tpl-rows-hint">Between 1 and 200. Use your largest class size.</small>
                {has("rows") && (
                  <span className="rms-pf-error" role="alert">
                    Enter a number from 1 to 200.
                  </span>
                )}
              </label>
              <label className="rms-check">
                <input type="checkbox" checked={s.includeTeacherColumns} onChange={(e) => update({ includeTeacherColumns: e.target.checked })} />
                <span>
                  Teacher&apos;s comment and attendance
                  <small>Adds Teacher&apos;s Comment, Days Present and Days Opened. Printed on each card when filled in.</small>
                </span>
              </label>
            </div>
          </section>
        </div>

        <aside className="rms-pf-preview" aria-labelledby="tpl-preview">
          <h2 id="tpl-preview">What you&apos;ll download</h2>
          <p className="rms-tpl-facts">
            <span>
              <strong>{classes.length}</strong> {classes.length === 1 ? "class" : "classes"}
            </span>
            <span>
              <strong>{subjects.length}</strong> {subjects.length === 1 ? "subject" : "subjects"}
            </span>
            <span>
              <strong>{columnCount}</strong> columns
            </span>
            <span>
              <strong>{rowsOk ? classes.length * rows : 0}</strong> rows to fill
            </span>
          </p>
          <div className="rms-tpl-sheet" tabIndex={0} role="region" aria-label="Preview of the first rows of the sheet">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>S/N</th>
                  <th>Student Name</th>
                  <th>Admission No</th>
                  {previewSubjects.flatMap((sub) =>
                    labels.map((l) => (
                      <th key={`${sub}-${l}`}>
                        {sub} {l}
                      </th>
                    ))
                  )}
                  {hiddenColumns > 0 && <th className="is-more">+{hiddenColumns} more</th>}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((n) => (
                  <tr key={n}>
                    <td>{sampleClass}</td>
                    <td className="num">{n}</td>
                    <td />
                    <td />
                    {previewSubjects.flatMap((sub) => labels.map((l) => <td key={`${sub}-${l}`} />))}
                    {hiddenColumns > 0 && <td className="is-more" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="rms-tpl-steps">
            <li>Open it in Excel or Google Sheets.</li>
            <li>Teachers fill in one row per student and save it as CSV or Excel.</li>
            <li>
              Open the saved file from{" "}
              <button type="button" className="rms-link" onClick={onBack}>
                Result batches
                <ArrowRight size={13} aria-hidden />
              </button>
            </li>
          </ol>
        </aside>
      </div>
    </main>
  );
}
