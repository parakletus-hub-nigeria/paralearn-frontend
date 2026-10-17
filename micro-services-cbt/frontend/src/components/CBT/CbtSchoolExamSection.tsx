"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  useGetReportCardOptionsQuery,
  type ReportCardChoice,
} from "@cbt/store/cbtMicroserviceApi";
import CbtReportCardFields, {
  emptySelection,
  isSelectionComplete,
  reportCardErrorMessage,
  setupProblems,
  useSelectionDefaults,
  type ReportCardSelection,
} from "./CbtReportCardFields";

export type SchoolExamMode = "report" | "practice" | "open";

export interface SchoolExamChoice {
  mode: SchoolExamMode;
  /** Sent with the new exam; undefined for an open exam */
  reportCard?: ReportCardChoice;
  /** Why the exam can't be created yet, if it can't */
  blocker: string | null;
}

const MODES: Array<{ value: SchoolExamMode; label: string; hint: string }> = [
  {
    value: "report",
    label: "For report cards",
    hint: "Your class sits it and the scores go on ParaLearn report cards.",
  },
  {
    value: "practice",
    label: "Practice test",
    hint: "Your class sits it, but the scores stay off report cards.",
  },
  {
    value: "open",
    label: "Open exam",
    hint: "Anyone with the exam code can sit it (e.g. an entrance exam).",
  },
];

/**
 * The "who sits this and where do scores go" part of creating a school exam.
 * Choosing classes imports their students with PINs; for report cards it also
 * links the exam to a subject, category and term. Missing ParaLearn set-up is
 * explained instead of showing empty lists.
 */
export default function CbtSchoolExamSection({
  onChange,
}: {
  onChange: (choice: SchoolExamChoice) => void;
}) {
  const { data: options, isLoading, error, refetch } = useGetReportCardOptionsQuery();
  const [mode, setMode] = useState<SchoolExamMode>("report");
  const [selection, setSelection] = useState<ReportCardSelection>(emptySelection);
  const unavailable = !isLoading && (!!error || !options);

  useSelectionDefaults(options, selection, setSelection);

  // ParaLearn can't be reached: only an open exam is possible
  const effectiveMode: SchoolExamMode = unavailable ? "open" : mode;
  const problems = options && effectiveMode !== "open" ? setupProblems(options, effectiveMode === "report") : [];

  useEffect(() => {
    let blocker: string | null = null;
    let reportCard: ReportCardChoice | undefined;
    if (effectiveMode !== "open") {
      if (isLoading) blocker = "Still loading your classes from ParaLearn.";
      else if (problems.length) blocker = problems[0];
      else if (selection.classIds.length === 0) blocker = "Choose the class or classes sitting this exam.";
      else if (effectiveMode === "report" && !isSelectionComplete(options, selection)) {
        blocker = "Choose the subject, category and term for the report card, or make it a practice test.";
      }
      reportCard =
        effectiveMode === "practice"
          ? { classIds: selection.classIds, practice: true }
          : { ...selection };
    }
    onChange({ mode: effectiveMode, reportCard, blocker });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMode, selection, options, isLoading, problems.join("|")]);

  return (
    <fieldset>
      <legend>Students &amp; report card</legend>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who sits this exam">
        {MODES.map((m) => (
          <label
            key={m.value}
            className="cbt-check !items-start rounded-[var(--radius-md)] border border-[var(--border-fine)] p-2.5 has-[:checked]:border-[var(--violet-ink)] has-[:checked]:bg-violet-50 has-[:disabled]:opacity-50"
          >
            <input
              type="radio"
              name="school-exam-mode"
              value={m.value}
              checked={effectiveMode === m.value}
              disabled={unavailable && m.value !== "open"}
              onChange={() => setMode(m.value)}
              className="mt-0.5 shrink-0"
              // The dialog's form styles stretch every non-checkbox input; keep this a normal radio
              style={{ width: 16, height: 16, minHeight: 0, padding: 0, accentColor: "#641bc4" }}
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-xs font-normal text-[var(--text-secondary)]">{m.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-3">
        {effectiveMode === "open" ? (
          unavailable ? (
            <p className="text-xs text-amber-700 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {reportCardErrorMessage(error, "ParaLearn couldn't be reached")}. You can still create
              an open exam now, or{" "}
              <button type="button" className="underline" onClick={() => refetch()}>
                try again
              </button>
              .
            </p>
          ) : null
        ) : isLoading ? (
          <p className="text-sm text-[var(--text-secondary)] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your classes and subjects from
            ParaLearn…
          </p>
        ) : options ? (
          <div className="space-y-3">
            {problems.length > 0 && (
              <ul className="space-y-1.5 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3">
                {problems.map((p) => (
                  <li key={p} className="text-sm text-[var(--foreground)] flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {options.classes.length > 0 && (
              <CbtReportCardFields
                options={options}
                value={selection}
                onChange={setSelection}
                forReportCard={effectiveMode === "report"}
              />
            )}
            <p className="text-xs text-[var(--text-secondary)]">
              The students in these classes are added with their own PINs, and only they can sit
              this exam.
            </p>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
