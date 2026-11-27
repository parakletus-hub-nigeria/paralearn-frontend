import * as XLSX from "xlsx";
import { SCORE_COLUMNS, type ScoreColumnKey } from "./csvTemplate";

/**
 * Generates simple, teacher-friendly Excel (.xlsx) score sheets:
 *   - 1 Class + 1 Subject  -> 1 single-tab .xlsx  (e.g. "JSS1 - English.xlsx")
 *   - 1 Class + All        -> 1 multi-tab .xlsx   (1 tab per subject)
 *   - All + 1 Subject      -> 1 multi-tab .xlsx   (1 tab per class)
 *   - All + All            -> 1 .zip containing either 1 .xlsx per class or 1 .xlsx per subject
 *
 * Every tab uses the same minimal layout so non-technical teachers only type scores:
 *   Row 1: Class | <ClassName> | Subject | <SubjectName>
 *   Row 2: S/N   | Student Name | Admission No | 1st CA | 2nd CA | Exam
 *   Row 3+: 1    | Ada Obi      | STU-001      |        |        |
 */

export interface SheetRosterClass {
  className: string;
  students: Array<{ name: string; admissionNo: string | null }>;
}

export interface SubjectSheetOptions {
  classes: string[];
  subjects: string[];
  scoreColumns: ScoreColumnKey[];
  rowsPerClass: number;
  roster?: SheetRosterClass[];
}

const classKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Excel tab names: max 31 chars, none of : \ / ? * [ ] */
function safeTabName(name: string, used: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` ${i}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

const safeEntryName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Sheet";

function buildTabSheet(
  className: string,
  subjectName: string,
  scoreLabels: string[],
  students: Array<{ name: string; admissionNo: string | null }> | undefined,
  rowsPerClass: number
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ["Class", className, "Subject", subjectName],
    ["S/N", "Student Name", "Admission No", ...scoreLabels],
  ];
  const blanks = Array(scoreLabels.length).fill("");
  if (students?.length) {
    students.forEach((st, idx) => {
      rows.push([idx + 1, st.name, st.admissionNo || "", ...blanks]);
    });
  } else {
    for (let i = 1; i <= Math.max(1, rowsPerClass); i++) {
      rows.push([i, "", "", ...blanks]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  // Keep Admission No as text so leading zeros (0012) or codes (KC/001) aren't altered by Excel
  for (let r = 2; r < rows.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 2 });
    const existing = sheet[ref];
    sheet[ref] = { t: "s", v: existing?.v != null ? String(existing.v) : "", z: "@" };
  }
  sheet["!cols"] = [
    { wch: 7 },
    { wch: 30 },
    { wch: 16 },
    ...scoreLabels.map((l) => ({ wch: Math.max(10, l.length + 3) })),
  ];
  return sheet;
}

function writeWorkbook(wb: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** 1 Class + 1 Subject -> single-tab .xlsx */
export function buildSingleSubjectWorkbook(
  className: string,
  subjectName: string,
  opts: Pick<SubjectSheetOptions, "scoreColumns" | "rowsPerClass" | "roster">
): Uint8Array {
  const labels = SCORE_COLUMNS.filter((c) => opts.scoreColumns.includes(c.key)).map((c) => c.label);
  const rosterMap = new Map((opts.roster || []).map((c) => [classKey(c.className), c.students]));
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const sheet = buildTabSheet(className, subjectName, labels, rosterMap.get(classKey(className)), opts.rowsPerClass);
  XLSX.utils.book_append_sheet(wb, sheet, safeTabName(`${className} - ${subjectName}`, used));
  return writeWorkbook(wb);
}

/** 1 Class + All Subjects -> 1 .xlsx with 1 tab per subject */
export function buildClassWorkbook(className: string, opts: SubjectSheetOptions): Uint8Array {
  const labels = SCORE_COLUMNS.filter((c) => opts.scoreColumns.includes(c.key)).map((c) => c.label);
  const rosterMap = new Map((opts.roster || []).map((c) => [classKey(c.className), c.students]));
  const students = rosterMap.get(classKey(className));
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const subject of opts.subjects) {
    const sheet = buildTabSheet(className, subject, labels, students, opts.rowsPerClass);
    XLSX.utils.book_append_sheet(wb, sheet, safeTabName(subject, used));
  }
  return writeWorkbook(wb);
}

/** All Classes + 1 Subject -> 1 .xlsx with 1 tab per class */
export function buildSubjectWorkbook(subjectName: string, opts: SubjectSheetOptions): Uint8Array {
  const labels = SCORE_COLUMNS.filter((c) => opts.scoreColumns.includes(c.key)).map((c) => c.label);
  const rosterMap = new Map((opts.roster || []).map((c) => [classKey(c.className), c.students]));
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const cls of opts.classes) {
    const sheet = buildTabSheet(cls, subjectName, labels, rosterMap.get(classKey(cls)), opts.rowsPerClass);
    XLSX.utils.book_append_sheet(wb, sheet, safeTabName(cls, used));
  }
  return writeWorkbook(wb);
}

// ── Minimal uncompressed (STORE) ZIP builder (zero dependencies, works offline) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // STORE
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/** Full school pack: 1 .zip containing either 1 .xlsx per class or 1 .xlsx per subject */
export function buildSchoolPackZip(mode: "by-class" | "by-subject", opts: SubjectSheetOptions): Uint8Array {
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  if (mode === "by-class") {
    for (const cls of opts.classes) {
      entries.push({
        name: `By Class/${safeEntryName(cls)} - All Subjects.xlsx`,
        data: buildClassWorkbook(cls, opts),
      });
    }
  } else {
    for (const subject of opts.subjects) {
      entries.push({
        name: `By Subject/${safeEntryName(subject)} - All Classes.xlsx`,
        data: buildSubjectWorkbook(subject, opts),
      });
    }
  }
  return buildZip(entries);
}
