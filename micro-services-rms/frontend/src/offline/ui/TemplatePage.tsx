"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_SUBJECTS, SCORE_COLUMNS, buildCsvTemplate, cleanList, type ScoreColumnKey } from "../engine/csvTemplate";
import { downloadBlob, safeFileName } from "./util";

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

/** For schools without their own result sheet: build a CSV to fill in, then open it */
export default function TemplatePage({ schoolName, onBack }: { schoolName: string; onBack: () => void }) {
  const [s, setS] = useState<Settings>(DEFAULTS);

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

  const download = () => {
    if (!classes.length) return toast.error("Add at least one class, e.g. JSS 1A.");
    if (!subjects.length) return toast.error("Add at least one subject.");
    if (!s.scoreColumns.length) return toast.error("Pick at least one score column.");
    const csv = buildCsvTemplate({
      classes,
      subjects,
      scoreColumns: s.scoreColumns,
      rowsPerClass: Math.min(200, Math.max(1, Math.round(s.rowsPerClass) || 1)),
      includeTeacherColumns: s.includeTeacherColumns,
    });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeFileName(schoolName || "School")} result sheet template.csv`);
    toast.success("Template downloaded. Fill it in, save it, then open it from Result batches.");
  };

  const previewHeader = ["Class", "S/N", "Student Name", "Admission No", ...(subjects[0] ? labels.map((l) => `${subjects[0]} ${l}`) : [])];

  return (
    <main className="rms-page">
      <button type="button" className="rms-back" onClick={onBack}>
        <ArrowLeft size={14} />
        Result batches
      </button>
      <div className="rms-page-heading">
        <div>
          <span className="rms-eyebrow">For schools without their own result sheet</span>
          <h1>CSV template</h1>
        </div>
        <div className="rms-page-actions">
          <button type="button" className="rms-button primary" onClick={download}>
            <Download size={16} />
            Download template
          </button>
        </div>
      </div>

      <div className="rms-profile">
        <div className="rms-form">
          <div className="rms-form-grid">
            <label className="rms-field">
              Classes
              <textarea
                id="tpl-classes"
                className="rms-textarea"
                rows={6}
                value={s.classes}
                onChange={(e) => update({ classes: e.target.value })}
                placeholder={"JSS 1A\nJSS 1B\nJSS 2A"}
              />
              <small>One per line, or separated by commas.</small>
            </label>
            <label className="rms-field">
              Subjects
              <textarea id="tpl-subjects" className="rms-textarea" rows={6} value={s.subjects} onChange={(e) => update({ subjects: e.target.value })} />
              <small>Each subject is marked out of 100.</small>
            </label>
          </div>
          <fieldset>
            <legend>Score columns for each subject</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
              {SCORE_COLUMNS.map((c) => (
                <label key={c.key} className="rms-check">
                  <input type="checkbox" checked={s.scoreColumns.includes(c.key)} onChange={(e) => toggleColumn(c.key, e.target.checked)} />
                  <span>
                    {c.label}
                    <small>
                      {c.hint}
                      {c.key === "CA3" && " · printed on cards, not stored in ParaLearn"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Rows and extra columns</legend>
            <div className="rms-form-grid">
              <label className="rms-field">
                Rows per class
                <input
                  id="tpl-rows"
                  className="rms-input rms-num"
                  type="number"
                  min={1}
                  max={200}
                  value={s.rowsPerClass}
                  onChange={(e) => update({ rowsPerClass: Number(e.target.value) })}
                />
              </label>
              <label className="rms-check" style={{ alignSelf: "center" }}>
                <input type="checkbox" checked={s.includeTeacherColumns} onChange={(e) => update({ includeTeacherColumns: e.target.checked })} />
                <span>
                  Teacher&apos;s comment and attendance
                  <small>Printed on each card when filled in.</small>
                </span>
              </label>
            </div>
          </fieldset>
        </div>

        <aside aria-labelledby="tpl-preview" style={{ display: "grid", gap: 12 }}>
          <h2 id="tpl-preview" className="rms-section-title">
            What you&apos;ll download
          </h2>
          <dl className="rms-summary" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
            <div>
              <dt>Classes</dt>
              <dd>{classes.length}</dd>
            </div>
            <div>
              <dt>Subjects</dt>
              <dd>{subjects.length}</dd>
            </div>
            <div>
              <dt>Columns</dt>
              <dd>{columnCount}</dd>
            </div>
          </dl>
          <div className="rms-table-wrap">
            <table className="rms-table" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  {previewHeader.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  {subjects.length * labels.length > labels.length && <th>…</th>}
                </tr>
              </thead>
              <tbody>
                {(classes.length ? classes : ["JSS 1A"]).slice(0, 2).map((c) => (
                  <tr key={c} style={{ cursor: "default" }}>
                    <td>{c}</td>
                    <td className="num">1</td>
                    {previewHeader.slice(2).map((h) => (
                      <td key={h} />
                    ))}
                    {subjects.length * labels.length > labels.length && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rms-section-sub" style={{ marginBottom: 0 }}>
            Opens in Excel or Google Sheets. Fill one row per student, save as CSV or Excel, then open it from Result batches.
          </p>
        </aside>
      </div>
    </main>
  );
}
