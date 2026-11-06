"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** For schools without their own result sheet: build a CSV to fill in, then open it above */
export default function CsvTemplateCard({ schoolName, defaultOpen = false }: { schoolName: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
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

  const download = () => {
    const classes = cleanList(s.classes);
    const subjects = cleanList(s.subjects);
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
    toast.success("Template downloaded. Fill it in, save it, then open it above.");
  };

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left sm:px-6"
      >
        <span className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--violet-ink)]" />
          <span>
            <span className="block font-bold">No result sheet? Use our template</span>
            <span className="block text-sm text-[var(--text-secondary)]">Download a CSV with your classes and subjects, fill in the scores, then open it above.</span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--border-fine)] p-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-classes">Classes</Label>
              <Textarea
                id="tpl-classes"
                rows={5}
                value={s.classes}
                onChange={(e) => update({ classes: e.target.value })}
                placeholder={"JSS 1A\nJSS 1B\nJSS 2A"}
              />
              <p className="text-xs text-[var(--text-secondary)]">One per line, or separated by commas.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subjects">Subjects</Label>
              <Textarea id="tpl-subjects" rows={5} value={s.subjects} onChange={(e) => update({ subjects: e.target.value })} />
              <p className="text-xs text-[var(--text-secondary)]">Each subject is marked out of 100.</p>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Score columns for each subject</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SCORE_COLUMNS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={s.scoreColumns.includes(c.key)} onCheckedChange={(v) => toggleColumn(c.key, v === true)} />
                  <span>
                    {c.label} <span className="text-[var(--text-secondary)]">({c.hint})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-rows">Rows per class</Label>
              <Input
                id="tpl-rows"
                type="number"
                min={1}
                max={200}
                value={s.rowsPerClass}
                onChange={(e) => update({ rowsPerClass: Number(e.target.value) })}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 self-end pb-1 text-sm">
              <Checkbox
                checked={s.includeTeacherColumns}
                onCheckedChange={(v) => update({ includeTeacherColumns: v === true })}
                className="mt-0.5"
              />
              <span>Add columns for the teacher&apos;s comment and attendance</span>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--text-secondary)]">Opens in Excel or Google Sheets. Save as CSV or Excel; both can be opened here.</p>
            <Button type="button" onClick={download} className="shrink-0">
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
