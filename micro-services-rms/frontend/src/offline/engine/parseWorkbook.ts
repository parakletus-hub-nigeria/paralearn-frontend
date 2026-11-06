import type {
  ParsedClass,
  ParsedStudent,
  ParsedWorkbook,
  ScoreComponent,
  SheetIssue,
  SubjectColumns,
  TeacherRecord,
} from "./types";
import { SUBJECT_MAX } from "./grading";
import { expandFlatSheet } from "./flatSheet";

/**
 * Reads the ParaLearn result-sheet layout (the same one the K12 backend's
 * result_up/process-result-sheets endpoint accepts, so the file can be synced as-is):
 *
 *   row A:  <class title> | (blank) | Mathematics |        |      | English | ...
 *   row B:  S/N           | Name    | 1st CA      | 2nd CA | Exam | 1st CA  | ...
 *   row C+: 1             | Ada Obi | 15          | 18     | 55   | ...
 *
 * One tab per class (tab name = class name). Subject names may be merged across their
 * columns. Some schools put a title row first, so the subject row may be row 1 or 2.
 * Columns such as "Admission No" or "Gender" between the name and the first subject are
 * read as student details, not subjects.
 * A "Total" column, if present, is ignored and recalculated. An optional "Teacher Data"
 * tab carries behaviour ratings, comments and attendance.
 */

export interface SheetRows {
  name: string;
  rows: unknown[][];
  /** Line in the original file for each row, when rows were rearranged (CSV template) */
  rowNumbers?: number[];
}

const TEACHER_SHEET = /^teacher('?s)?\s*data$/i;

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const cellText = (v: unknown) => (isBlank(v) ? "" : String(v).trim());

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Maps a score-column header to a stable key; "Total" columns return null (recalculated) */
export function componentKey(label: string): string | null {
  const l = label.trim().toUpperCase().replace(/\s+/g, " ");
  if (!l) return null;
  if (l.includes("TOTAL")) return null;
  if (l.includes("EXAM")) return "EXAM";
  if (/^(1ST|FIRST|CA ?1|1)\b/.test(l) || l === "CA1") return "CA1";
  if (/^(2ND|SECOND|CA ?2|2)\b/.test(l) || l === "CA2") return "CA2";
  if (/^(3RD|THIRD|CA ?3|3)\b/.test(l) || l === "CA3") return "CA3";
  return l.replace(/[^A-Z0-9]+/g, "_");
}

const ADMISSION_HEADER = /^(admission|adm\.?|reg(istration)?|matric|student ?id)\b/i;
const IDENTITY_HEADER = /^(admission|adm\.?|reg(istration)?|matric|student ?(id|name)|names?|gender|sex|class|arm|s\/?n|no\.?)\b/i;

function hasSubjectNames(row: unknown[] | undefined): boolean {
  return (row || []).slice(2).some((c) => typeof c === "string" && c.trim().length > 0 && !IDENTITY_HEADER.test(c.trim()));
}

function parseScore(raw: unknown): { value: number | null; invalid: boolean } {
  if (isBlank(raw)) return { value: null, invalid: false };
  if (typeof raw === "number") return { value: raw, invalid: !Number.isFinite(raw) };
  const text = String(raw).trim();
  // Common placeholders for "did not sit"
  if (/^(-|–|—|nil|n\/?a|abs|absent)$/i.test(text)) return { value: null, invalid: false };
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

function parseClassSheet(sheet: SheetRows, issues: SheetIssue[]): ParsedClass | null {
  const rows = sheet.rows;
  const subjectRowIdx = !hasSubjectNames(rows[0]) && hasSubjectNames(rows[1]) ? 1 : 0;
  const metricRowIdx = subjectRowIdx + 1;
  const firstStudentIdx = metricRowIdx + 1;
  const subjectRow = rows[subjectRowIdx] || [];
  const metricRow = rows[metricRowIdx] || [];

  if (!hasSubjectNames(subjectRow)) {
    issues.push({
      level: "error",
      sheet: sheet.name,
      message: "No subject names found. Put subject names in row 1 (or row 2 under a title), starting from column C.",
    });
    return null;
  }

  // Student-detail columns sitting where subjects start (e.g. "Admission No")
  let admissionCol = -1;
  const identityCols = new Set<number>();
  for (let c = 2; c < subjectRow.length; c++) {
    const label = cellText(subjectRow[c]);
    if (!label || !IDENTITY_HEADER.test(label) || cellText(metricRow[c])) continue;
    identityCols.add(c);
    if (admissionCol < 0 && ADMISSION_HEADER.test(label)) admissionCol = c;
  }

  // Column index -> subject + component
  const columns = new Map<number, { subject: string; key: string }>();
  const subjects: SubjectColumns[] = [];
  let current: SubjectColumns | null = null;
  const width = Math.max(subjectRow.length, metricRow.length);
  for (let c = 2; c < width; c++) {
    if (identityCols.has(c)) {
      current = null;
      continue;
    }
    const subjectName = cellText(subjectRow[c]);
    if (subjectName) {
      current = subjects.find((s) => s.name.toLowerCase() === subjectName.toLowerCase()) || null;
      if (current) {
        issues.push({ level: "warning", sheet: sheet.name, message: `"${subjectName}" appears twice; its columns were combined.` });
      } else {
        current = { name: subjectName, components: [] };
        subjects.push(current);
      }
    }
    const label = cellText(metricRow[c]);
    if (!current || !label) continue;
    const key = componentKey(label);
    if (!key) continue;
    if (current.components.some((comp) => comp.key === key)) {
      issues.push({ level: "warning", sheet: sheet.name, message: `${current.name} has two "${label}" columns; only the first is used.` });
      continue;
    }
    current.components.push({ key, label } satisfies ScoreComponent);
    columns.set(c, { subject: current.name, key });
  }

  const scored = subjects.filter((s) => s.components.length > 0);
  for (const s of subjects) {
    if (!s.components.length) {
      issues.push({
        level: "warning",
        sheet: sheet.name,
        message: `${s.name} has no score columns (like 1st CA, 2nd CA, Exam) under it, so it was skipped.`,
      });
    }
  }
  if (!scored.length) {
    issues.push({
      level: "error",
      sheet: sheet.name,
      row: metricRowIdx + 1,
      message: "No score columns found. The row under the subject names should label each column (1st CA, 2nd CA, Exam).",
    });
    return null;
  }

  const students: ParsedStudent[] = [];
  const seenNames = new Map<string, number>();
  for (let r = firstStudentIdx; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = cellText(row[1]).replace(/\s+/g, " ");
    const excelRow = sheet.rowNumbers?.[r] ?? r + 1;
    if (!name) {
      const hasScores = [...columns.keys()].some((c) => !isBlank(row[c]));
      if (hasScores) issues.push({ level: "warning", sheet: sheet.name, row: excelRow, message: "Scores without a student name; row skipped." });
      continue;
    }

    const normalized = normalizeName(name);
    if (seenNames.has(normalized)) {
      issues.push({
        level: "warning",
        sheet: sheet.name,
        row: excelRow,
        message: `${name} also appears in row ${seenNames.get(normalized)}. Both were kept; check this isn't a duplicate.`,
      });
    } else {
      seenNames.set(normalized, excelRow);
    }

    const scores: ParsedStudent["scores"] = {};
    for (const [c, { subject, key }] of columns) {
      const { value, invalid } = parseScore(row[c]);
      if (invalid) {
        issues.push({ level: "warning", sheet: sheet.name, row: excelRow, message: `${name}: "${cellText(row[c])}" in ${subject} isn't a number; treated as blank.` });
        continue;
      }
      if (value === null) continue;
      let v = value;
      if (v < 0) {
        issues.push({ level: "warning", sheet: sheet.name, row: excelRow, message: `${name}: negative score ${v} in ${subject}; treated as 0.` });
        v = 0;
      }
      (scores[subject] ||= {})[key] = v;
    }

    for (const [subject, parts] of Object.entries(scores)) {
      const total = Object.values(parts).reduce((a, b) => a + b, 0);
      if (total > SUBJECT_MAX) {
        issues.push({
          level: "warning",
          sheet: sheet.name,
          row: excelRow,
          message: `${name}: ${subject} adds up to ${total}, over ${SUBJECT_MAX}. Check the scores.`,
        });
      }
    }

    const serialNum = Number(cellText(row[0]));
    students.push({
      row: excelRow,
      serial: Number.isFinite(serialNum) && cellText(row[0]) ? serialNum : null,
      name,
      admissionNo: admissionCol >= 0 ? cellText(row[admissionCol]) || null : null,
      scores,
    });
  }

  if (!students.length) {
    issues.push({ level: "warning", sheet: sheet.name, message: "No students found on this tab; it was skipped." });
    return null;
  }
  return { name: sheet.name.trim(), subjects: scored, students };
}

function parseTeacherSheet(sheet: SheetRows, issues: SheetIssue[]): TeacherRecord[] {
  const rows = sheet.rows;
  const headerIdx = rows.findIndex((r) => (r || []).some((c) => /name/i.test(cellText(c))));
  if (headerIdx < 0) {
    issues.push({ level: "warning", sheet: sheet.name, message: "No Name column found; behaviour ratings and comments were not read." });
    return [];
  }
  const header = (rows[headerIdx] || []).map(cellText);
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const nameCol = find(/name/i);
  const classCol = find(/^class$/i);
  const commentCol = find(/comment|remark/i);
  const presentCol = find(/present|attend/i);
  const openedCol = find(/opened|school days|days open|total days/i);
  const skip = new Set([nameCol, classCol, commentCol, presentCol, openedCol, find(/^(s\/?n|no\.?|reg|admission)/i)]);

  const records: TeacherRecord[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = cellText(row[nameCol]);
    if (!name) continue;
    const traits: Record<string, number> = {};
    header.forEach((h, c) => {
      if (!h || skip.has(c)) return;
      const n = Number(cellText(row[c]));
      // Same rule as the K12 backend: a blank rating counts as 5
      traits[h] = isBlank(row[c]) || !Number.isFinite(n) ? 5 : Math.max(1, Math.min(5, n));
    });
    const num = (c: number) => {
      if (c < 0 || isBlank(row[c])) return null;
      const n = Number(cellText(row[c]));
      return Number.isFinite(n) ? n : null;
    };
    records.push({
      name,
      className: classCol >= 0 ? cellText(row[classCol]) || null : null,
      traits,
      comment: commentCol >= 0 ? cellText(row[commentCol]) || null : null,
      daysPresent: num(presentCol),
      daysOpened: num(openedCol),
    });
  }
  return records;
}

export function parseWorkbookRows(sheets: SheetRows[]): ParsedWorkbook {
  const issues: SheetIssue[] = [];
  const classes: ParsedClass[] = [];
  let teacherRecords: TeacherRecord[] = [];

  for (const sheet of sheets) {
    if (TEACHER_SHEET.test(sheet.name.trim())) {
      teacherRecords = teacherRecords.concat(parseTeacherSheet(sheet, issues));
      continue;
    }
    if (!sheet.rows.some((r) => (r || []).some((c) => !isBlank(c)))) continue; // empty tab
    // The CSV template (one table, Class column) becomes one class sheet per class
    const flat = expandFlatSheet(sheet);
    if (flat) {
      issues.push(...flat.issues);
      teacherRecords = teacherRecords.concat(flat.teacherRecords);
      for (const classSheet of flat.sheets) {
        if (classes.some((c) => c.name.toLowerCase() === classSheet.name.toLowerCase())) {
          issues.push({ level: "error", sheet: classSheet.name, message: `Class "${classSheet.name}" appears in more than one tab.` });
          continue;
        }
        const parsed = parseClassSheet(classSheet, issues);
        if (parsed) classes.push(parsed);
      }
      continue;
    }
    const parsed = parseClassSheet(sheet, issues);
    if (parsed) classes.push(parsed);
  }

  if (!classes.length && !issues.some((i) => i.level === "error")) {
    issues.push({ level: "error", sheet: "Workbook", message: "No class tabs with students were found in this file." });
  }
  return { classes, teacherRecords, issues };
}
