/**
 * Data model for offline result processing. Everything here is plain data so it can cross
 * the Web Worker boundary (structured clone) and be stored in IndexedDB as-is.
 */

export type IssueLevel = "error" | "warning";

export interface SheetIssue {
  level: IssueLevel;
  sheet: string;
  /** 1-based Excel row, when the problem is in one row */
  row?: number;
  message: string;
}

/** One score column under a subject, e.g. "1st CA", "2nd CA", "Exam" */
export interface ScoreComponent {
  key: string;
  label: string;
}

export interface SubjectColumns {
  name: string;
  components: ScoreComponent[];
}

export interface ParsedStudent {
  /** 1-based Excel row */
  row: number;
  serial: number | null;
  name: string;
  admissionNo: string | null;
  /** subject -> component key -> score; a missing key means the cell was blank */
  scores: Record<string, Record<string, number>>;
}

export interface ParsedClass {
  name: string;
  subjects: SubjectColumns[];
  students: ParsedStudent[];
}

/** Optional "Teacher Data" tab: behaviour ratings, comments, attendance */
export interface TeacherRecord {
  name: string;
  className: string | null;
  traits: Record<string, number>;
  comment: string | null;
  daysPresent: number | null;
  daysOpened: number | null;
}

export interface ParsedWorkbook {
  classes: ParsedClass[];
  teacherRecords: TeacherRecord[];
  issues: SheetIssue[];
}

// ── Computed results ────────────────────────────────────────────────────────

export interface SubjectResult {
  subject: string;
  /** component key -> score (blank cells omitted) */
  scores: Record<string, number>;
  total: number;
  grade: string;
  remark: string;
  /** Rank within the class for this subject (ties share a rank) */
  position: number;
  classAverage: number;
  highest: number;
  lowest: number;
}

export interface StudentResult {
  id: string;
  row: number;
  serial: number | null;
  name: string;
  admissionNo: string | null;
  className: string;
  /** Only subjects the student sat (at least one score entered) */
  subjects: SubjectResult[];
  totalScore: number;
  totalObtainable: number;
  average: number;
  grade: string;
  position: number;
  classSize: number;
  traits: Record<string, number>;
  teacherComment: string;
  principalComment: string;
  daysPresent: number | null;
  daysOpened: number | null;
}

export interface ClassResult {
  name: string;
  subjects: SubjectColumns[];
  students: StudentResult[];
  classAverage: number;
}

export interface ComputedResults {
  classes: ClassResult[];
  totalStudents: number;
  issues: SheetIssue[];
}
