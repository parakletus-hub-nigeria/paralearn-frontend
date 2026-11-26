/**
 * Builds the CSV template a school fills in when it doesn't keep its own result sheet:
 * one row per student, a Class column, and "<subject> <score label>" columns.
 * The file is made in the browser, so it can be downloaded offline too.
 */

export const DEFAULT_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Basic Technology",
  "Social Studies",
  "Civic Education",
  "Agricultural Science",
  "Computer Studies",
];

export const SCORE_COLUMNS = [
  { key: "CA1", label: "1st CA", hint: "out of 20" },
  { key: "CA2", label: "2nd CA", hint: "out of 20" },
  { key: "CA3", label: "3rd CA", hint: "if your school has one" },
  { key: "EXAM", label: "Exam", hint: "out of 60" },
] as const;

export type ScoreColumnKey = (typeof SCORE_COLUMNS)[number]["key"];

export interface TemplateOptions {
  classes: string[];
  subjects: string[];
  scoreColumns: ScoreColumnKey[];
  rowsPerClass: number;
  includeTeacherColumns: boolean;
  roster?: Array<{ className: string; students: Array<{ name: string; admissionNo: string | null }> }>;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function cleanList(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(/[\n,;]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

const classKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function buildCsvTemplate(opts: TemplateOptions): string {
  const labels = SCORE_COLUMNS.filter((c) => opts.scoreColumns.includes(c.key)).map((c) => c.label);
  const header = [
    "Class",
    "S/N",
    "Student Name",
    "Admission No",
    ...opts.subjects.flatMap((s) => labels.map((l) => `${s} ${l}`)),
    ...(opts.includeTeacherColumns ? ["Teacher's Comment", "Days Present", "Days Opened"] : []),
  ];
  const blanks = header.length - 2;
  const rows: (string | number)[][] = [header];
  const classes = opts.classes.length ? opts.classes : ["JSS 1A"];
  const rosterByClass = new Map((opts.roster || []).map((cls) => [classKey(cls.className), cls.students]));
  for (const cls of classes) {
    const students = rosterByClass.get(classKey(cls));
    if (students?.length) {
      for (const [index, student] of students.entries()) {
        rows.push([cls, index + 1, student.name, student.admissionNo || "", ...Array(header.length - 4).fill("")]);
      }
    } else {
      for (let i = 1; i <= Math.max(1, opts.rowsPerClass); i++) rows.push([cls, i, ...Array(blanks).fill("")]);
    }
  }
  // BOM so Excel on Windows opens names with accents correctly
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
