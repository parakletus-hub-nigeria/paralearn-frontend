import type { ClassResult } from "./types";

/**
 * Builds the rows of a clean result sheet for the K12 backend's
 * result_up/process-result-sheets endpoint, from results already validated here.
 *
 * The K12 parser expects, per class tab: subject names on row 1 from column C, score labels
 * on row 2, students from row 3. It records only 1st CA, 2nd CA and Exam, so any other score
 * column (e.g. a 3rd CA) is left out and reported back to the caller.
 */
const K12_COMPONENTS: Array<{ key: string; label: string }> = [
  { key: "CA1", label: "1st" },
  { key: "CA2", label: "2nd" },
  { key: "EXAM", label: "Exam" },
];

export interface K12Sheet {
  name: string;
  rows: (string | number)[][];
}

export interface K12WorkbookPlan {
  sheets: K12Sheet[];
  /** Score columns K12 can't store, as "Class: Subject (label)" */
  droppedColumns: string[];
}

// Excel tab names: max 31 chars, none of : \ / ? * [ ]
const tabName = (name: string, used: Set<string>) => {
  const base = name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Class";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base.slice(0, 28)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
};

export function buildK12Workbook(classes: ClassResult[]): K12WorkbookPlan {
  const used = new Set<string>();
  const droppedColumns: string[] = [];

  const sheets = classes.map((cls) => {
    const subjects = cls.subjects
      .map((s) => ({ name: s.name, keys: K12_COMPONENTS.filter((k) => s.components.some((c) => c.key === k.key)) }))
      .filter((s) => s.keys.length > 0);

    for (const s of cls.subjects) {
      for (const comp of s.components) {
        if (!K12_COMPONENTS.some((k) => k.key === comp.key)) droppedColumns.push(`${cls.name}: ${s.name} (${comp.label})`);
      }
    }

    const subjectRow: (string | number)[] = [cls.name, ""];
    const labelRow: (string | number)[] = ["S/N", "Name"];
    for (const s of subjects) {
      s.keys.forEach((k, i) => {
        subjectRow.push(i === 0 ? s.name : "");
        labelRow.push(k.label);
      });
    }

    const studentRows = cls.students.map((student, idx) => {
      const row: (string | number)[] = [student.serial ?? idx + 1, student.name];
      for (const s of subjects) {
        const result = student.subjects.find((r) => r.subject === s.name);
        for (const k of s.keys) {
          const v = result?.scores[k.key];
          row.push(typeof v === "number" ? v : "");
        }
      }
      return row;
    });

    return { name: tabName(cls.name, used), rows: [subjectRow, labelRow, ...studentRows] };
  });

  return { sheets, droppedColumns };
}
