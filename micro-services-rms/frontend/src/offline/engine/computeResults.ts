import type { ClassResult, ComputedResults, ParsedWorkbook, StudentResult, SubjectResult, TeacherRecord } from "./types";
import { SUBJECT_MAX, gradeFor, principalCommentFor, rankDescending, teacherCommentFor } from "./grading";
import { normalizeName } from "./parseWorkbook";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Turns parsed sheets into report-card data. Each class is computed as a whole before any
 * card is drawn, because subject and class positions depend on every student in the class.
 * A subject counts for a student only if at least one of its scores was entered, so the
 * average is over the subjects the student actually sat.
 */
export function computeResults(parsed: ParsedWorkbook): ComputedResults {
  const issues = [...parsed.issues];

  // Teacher Data lookup: by class + name, falling back to name alone
  const teacherByKey = new Map<string, TeacherRecord>();
  for (const rec of parsed.teacherRecords) {
    const key = normalizeName(rec.name);
    if (rec.className) teacherByKey.set(`${normalizeName(rec.className)}|${key}`, rec);
    if (!teacherByKey.has(`*|${key}`)) teacherByKey.set(`*|${key}`, rec);
  }
  const matchedTeacherRecords = new Set<TeacherRecord>();

  const classes: ClassResult[] = parsed.classes.map((cls) => {
    // Per-subject totals for students who sat it
    const subjectTotals = new Map<string, Array<{ idx: number; total: number }>>();
    const perStudent = cls.students.map((student, idx) => {
      const subjects: Array<{ subject: string; scores: Record<string, number>; total: number }> = [];
      for (const subject of cls.subjects) {
        const scores = student.scores[subject.name];
        if (!scores || !Object.keys(scores).length) continue;
        const total = round(Object.values(scores).reduce((a, b) => a + b, 0));
        subjects.push({ subject: subject.name, scores, total });
        if (!subjectTotals.has(subject.name)) subjectTotals.set(subject.name, []);
        subjectTotals.get(subject.name)!.push({ idx, total });
      }
      return { student, subjects };
    });

    // Subject positions and class statistics
    const subjectStats = new Map<string, { positions: Map<number, number>; average: number; highest: number; lowest: number }>();
    for (const [subject, entries] of subjectTotals) {
      const totals = entries.map((e) => e.total);
      const ranks = rankDescending(totals);
      subjectStats.set(subject, {
        positions: new Map(entries.map((e, i) => [e.idx, ranks[i]])),
        average: round(totals.reduce((a, b) => a + b, 0) / totals.length),
        highest: Math.max(...totals),
        lowest: Math.min(...totals),
      });
    }

    const averages = perStudent.map(({ subjects }) =>
      subjects.length ? subjects.reduce((a, s) => a + s.total, 0) / subjects.length : 0
    );
    const classRanks = rankDescending(averages);
    const classSize = cls.students.length;

    const students: StudentResult[] = perStudent.map(({ student, subjects }, idx) => {
      if (!subjects.length) {
        issues.push({ level: "warning", sheet: cls.name, row: student.row, message: `${student.name} has no scores; the card will be empty.` });
      }
      const subjectResults: SubjectResult[] = subjects.map((s) => {
        const stats = subjectStats.get(s.subject)!;
        const band = gradeFor(s.total);
        return {
          subject: s.subject,
          scores: s.scores,
          total: s.total,
          grade: band.grade,
          remark: band.remark,
          position: stats.positions.get(idx)!,
          classAverage: stats.average,
          highest: stats.highest,
          lowest: stats.lowest,
        };
      });
      const totalScore = round(subjects.reduce((a, s) => a + s.total, 0));
      const average = round(averages[idx]);
      const nameKey = normalizeName(student.name);
      const teacher = teacherByKey.get(`${normalizeName(cls.name)}|${nameKey}`) || teacherByKey.get(`*|${nameKey}`);
      if (teacher) matchedTeacherRecords.add(teacher);

      return {
        id: `${cls.name}#${student.row}`,
        row: student.row,
        serial: student.serial,
        name: student.name,
        admissionNo: student.admissionNo,
        className: cls.name,
        subjects: subjectResults,
        totalScore,
        totalObtainable: subjects.length * SUBJECT_MAX,
        average,
        grade: gradeFor(average).grade,
        position: classRanks[idx],
        classSize,
        traits: teacher?.traits || {},
        teacherComment: teacher?.comment || teacherCommentFor(average),
        principalComment: principalCommentFor(average),
        daysPresent: teacher?.daysPresent ?? null,
        daysOpened: teacher?.daysOpened ?? null,
      };
    });

    return {
      name: cls.name,
      subjects: cls.subjects,
      students,
      classAverage: round(averages.reduce((a, b) => a + b, 0) / Math.max(1, averages.length)),
    };
  });

  const unmatched = parsed.teacherRecords.filter((r) => !matchedTeacherRecords.has(r));
  if (unmatched.length) {
    const sample = unmatched.slice(0, 3).map((r) => r.name).join(", ");
    issues.push({
      level: "warning",
      sheet: "Teacher Data",
      message: `${unmatched.length} name${unmatched.length === 1 ? "" : "s"} on the Teacher Data tab didn't match any student (${sample}${
        unmatched.length > 3 ? ", …" : ""
      }). Check the spelling matches the class tabs.`,
    });
  }

  return {
    classes,
    totalStudents: classes.reduce((a, c) => a + c.students.length, 0),
    issues,
  };
}
