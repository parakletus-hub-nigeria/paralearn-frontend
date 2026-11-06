/**
 * The school's grading rules, in one place. Scores are out of 100 per subject.
 * Bands match the report cards ParaLearn already issues (A 70–100 … F 0–39).
 */
export interface GradeBand {
  grade: string;
  min: number;
  remark: string;
}

export const GRADE_BANDS: GradeBand[] = [
  { grade: "A", min: 70, remark: "Excellent" },
  { grade: "B", min: 60, remark: "Very Good" },
  { grade: "C", min: 50, remark: "Good" },
  { grade: "D", min: 45, remark: "Fair" },
  { grade: "E", min: 40, remark: "Pass" },
  { grade: "F", min: 0, remark: "Fail" },
];

export const SUBJECT_MAX = 100;

export function gradeFor(score: number): GradeBand {
  const s = Math.round(score * 100) / 100;
  return GRADE_BANDS.find((b) => s >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1];
}

export function bandLabel(band: GradeBand): string {
  const i = GRADE_BANDS.indexOf(band);
  const upper = i <= 0 ? SUBJECT_MAX : GRADE_BANDS[i - 1].min - 1;
  return `${band.min}–${upper}`;
}

/** Default comments by overall average; the Teacher Data tab can override the teacher's */
export function teacherCommentFor(average: number): string {
  if (average >= 70) return "An excellent result. Keep up the hard work.";
  if (average >= 60) return "A very good result. Aim even higher next term.";
  if (average >= 50) return "A good effort. More practice will lift these grades.";
  if (average >= 40) return "A fair result. Needs more effort and regular revision.";
  return "Below expectations. Needs close support and steady study next term.";
}

export function principalCommentFor(average: number): string {
  if (average >= 70) return "Outstanding performance. Well done.";
  if (average >= 50) return "Satisfactory. Keep working steadily.";
  if (average >= 40) return "Can do better with more focus.";
  return "Must work harder; parents are invited to discuss support.";
}

/** Competition ranking: equal values share a rank and the next rank is skipped (1, 2, 2, 4) */
export function rankDescending(values: number[]): number[] {
  const order = values.map((v, i) => ({ v: Math.round(v * 1000) / 1000, i })).sort((a, b) => b.v - a.v);
  const ranks = new Array<number>(values.length);
  order.forEach((item, idx) => {
    ranks[item.i] = idx > 0 && item.v === order[idx - 1].v ? ranks[order[idx - 1].i] : idx + 1;
  });
  return ranks;
}
