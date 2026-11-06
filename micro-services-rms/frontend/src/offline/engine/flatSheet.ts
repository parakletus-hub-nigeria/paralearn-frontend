import type { SheetIssue, TeacherRecord } from "./types";
import type { SheetRows } from "./parseWorkbook";

/**
 * The CSV template layout: one table for the whole school, one row per student.
 *
 *   Class  | S/N | Student Name | Admission No | Mathematics 1st CA | Mathematics 2nd CA | Mathematics Exam | ... | Teacher's Comment | Days Present | Days Opened
 *   JSS 1A | 1   | Ada Obi      | KC/001       | 15                 | 18                 | 55               | ...
 *
 * A score column is "<subject> <score label>". This module turns such a table into one
 * class sheet per class, in the layout parseWorkbookRows already reads, so the CSV gets the
 * same validation, results and cards as an Excel result sheet.
 */

const SCORE_SUFFIX = /^(.*?)[\s\-–:/|]*\(?\s*(1st\s*CA|2nd\s*CA|3rd\s*CA|first\s*CA|second\s*CA|third\s*CA|CA\s*[123]|1st\s*test|2nd\s*test|exam(?:ination)?|total)\s*\)?$/i;

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const text = (v: unknown) => (isBlank(v) ? "" : String(v).trim());

export interface FlatColumns {
  classCol: number;
  serialCol: number;
  nameCol: number;
  admissionCol: number;
  commentCol: number;
  presentCol: number;
  openedCol: number;
  /** Score columns in sheet order */
  scores: Array<{ col: number; subject: string; label: string }>;
}

/** Finds the template's columns in a header row; null if the row isn't a flat template header */
export function readFlatHeader(header: unknown[]): FlatColumns | null {
  const cells = header.map(text);
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c));
  const classCol = find(/^class(\s*name|\s*\/\s*arm)?$/i);
  const nameCol = find(/^(student'?s?\s*)?(full\s*)?names?$/i);
  if (classCol < 0 || nameCol < 0) return null;

  const scores: FlatColumns["scores"] = [];
  cells.forEach((c, col) => {
    const m = SCORE_SUFFIX.exec(c);
    if (m && m[1].trim()) scores.push({ col, subject: m[1].trim(), label: m[2].replace(/\s+/g, " ").trim() });
  });
  if (!scores.length) return null;

  return {
    classCol,
    serialCol: find(/^(s\/?n|no\.?|serial|#)$/i),
    nameCol,
    admissionCol: find(/^(admission|adm\.?|reg(istration)?|matric|student\s*id)\b/i),
    commentCol: find(/comment|remark/i),
    presentCol: find(/present|attend/i),
    openedCol: find(/opened|school\s*days|days\s*open|total\s*days/i),
    scores,
  };
}

export interface ExpandedFlat {
  sheets: SheetRows[];
  teacherRecords: TeacherRecord[];
  issues: SheetIssue[];
}

/**
 * Splits a flat sheet by its Class column. Each class sheet keeps the original line numbers
 * so problems point at the right row in the file the school filled in.
 */
export function expandFlatSheet(sheet: SheetRows, label = sheet.name): ExpandedFlat | null {
  const headerIdx = sheet.rows.findIndex((r, i) => i < 10 && readFlatHeader(r || []) !== null);
  if (headerIdx < 0) return null;
  const cols = readFlatHeader(sheet.rows[headerIdx])!;
  const issues: SheetIssue[] = [];

  // Subject order as it first appears; each subject's score labels in column order
  const subjects: Array<{ name: string; parts: Array<{ col: number; label: string }> }> = [];
  for (const s of cols.scores) {
    let subject = subjects.find((x) => x.name.toLowerCase() === s.subject.toLowerCase());
    if (!subject) subjects.push((subject = { name: s.subject, parts: [] }));
    subject.parts.push({ col: s.col, label: s.label });
  }

  const subjectRow: unknown[] = ["", "", "Admission No"];
  const labelRow: unknown[] = ["S/N", "Name", ""];
  for (const s of subjects) {
    s.parts.forEach((p, i) => {
      subjectRow.push(i === 0 ? s.name : "");
      labelRow.push(p.label);
    });
  }

  const byClass = new Map<string, { name: string; rows: unknown[][]; rowNumbers: number[] }>();
  const teacherRecords: TeacherRecord[] = [];
  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r] || [];
    const line = r + 1;
    const name = text(row[cols.nameCol]);
    const className = text(row[cols.classCol]);
    const hasScores = cols.scores.some((s) => !isBlank(row[s.col]));
    if (!name) {
      if (hasScores) issues.push({ level: "warning", sheet: label, row: line, message: "Scores without a student name; row skipped." });
      continue;
    }
    if (!className) {
      issues.push({ level: "warning", sheet: label, row: line, message: `${name} has no class in the Class column; row skipped.` });
      continue;
    }
    const key = className.toLowerCase().replace(/\s+/g, " ");
    if (!byClass.has(key)) byClass.set(key, { name: className.replace(/\s+/g, " "), rows: [subjectRow, labelRow], rowNumbers: [headerIdx, headerIdx + 1] });
    const target = byClass.get(key)!;
    target.rows.push([
      cols.serialCol >= 0 ? row[cols.serialCol] : null,
      name,
      cols.admissionCol >= 0 ? row[cols.admissionCol] : null,
      ...subjects.flatMap((s) => s.parts.map((p) => row[p.col])),
    ]);
    target.rowNumbers.push(line);

    const comment = cols.commentCol >= 0 ? text(row[cols.commentCol]) : "";
    const num = (c: number) => (c >= 0 && !isBlank(row[c]) && Number.isFinite(Number(text(row[c]))) ? Number(text(row[c])) : null);
    const daysPresent = num(cols.presentCol);
    const daysOpened = num(cols.openedCol);
    if (comment || daysPresent !== null || daysOpened !== null) {
      teacherRecords.push({ name, className: target.name, traits: {}, comment: comment || null, daysPresent, daysOpened });
    }
  }

  if (!byClass.size) {
    issues.push({ level: "error", sheet: label, message: "No students found. Fill in at least the Class and Student Name columns." });
  }
  return {
    sheets: [...byClass.values()].map((c) => ({ name: c.name, rows: c.rows, rowNumbers: c.rowNumbers })),
    teacherRecords,
    issues,
  };
}
