/**
 * CBT exams on ParaLearn report cards (server only).
 *
 * A school workspace links an exam to a subject, its classes, an assessment
 * category and a term. ParaLearn Core keeps an ordinary Assessment for it, and
 * "release" copies each ParaLearn student's result into that assessment's
 * scores. Callers have already checked that the examiner owns the exam.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { callCore, CoreRequestError, type CbtPrincipal } from "@/lib/cbtAuth";
import { cbtServerStore } from "@/lib/cbtServerStore";

const onlySchools = () =>
  NextResponse.json(
    { message: "Report cards are only available to school workspaces." },
    { status: 403 }
  );

/** Who is acting, for Core's permission checks */
function caller(me: CbtPrincipal) {
  return { email: me.email, schoolId: me.schoolId };
}

function isSchool(me: CbtPrincipal) {
  return me.type === "INSTITUTION" && !!me.schoolId && !!me.email;
}

/** Changes whenever a released result would change */
function fingerprint(scores: Array<{ studentId: string; marksAwarded: number; maxMarks: number }>) {
  const lines = scores
    .map((s) => `${s.studentId}:${s.marksAwarded}:${s.maxMarks}`)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(lines).digest("hex");
}

/** Turns a Core failure into a response the CBT screens can show */
async function withCore(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CoreRequestError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    throw err;
  }
}

/** GET /api/cbt/report-card/options */
export function reportCardOptions(me: CbtPrincipal) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () => NextResponse.json(await callCore("report-card/options", caller(me))));
}

/** GET /api/cbt/exams/:id/report-card: the link, last release and what is ready now */
export function reportCardStatus(me: CbtPrincipal, examId: string) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () => {
    const [link, release, results] = await Promise.all([
      callCore("report-card/link", { ...caller(me), cbtExamId: examId }),
      cbtServerStore.getReportCardRelease(examId),
      cbtServerStore.getReportCardResults(examId),
    ]);
    const linked = link?.assessmentId ? link : null;
    return NextResponse.json({
      link: linked,
      release,
      changedSinceRelease: !!release && release.fingerprint !== fingerprint(results.scores),
      ready: {
        students: results.scores.length,
        pendingReview: results.pendingReview.length,
        unlinked: results.unlinked,
        inProgress: results.inProgress,
      },
    });
  });
}

/** POST /api/cbt/exams/:id/report-card: create or update the link */
export function linkReportCard(me: CbtPrincipal, examId: string, body: any) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () => {
    const exam = await cbtServerStore.getExamById(examId);
    if (!exam) return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    const link = await callCore("report-card/link", {
      ...caller(me),
      cbtExamId: examId,
      title: exam.title,
      subjectId: body.subjectId,
      classIds: Array.isArray(body.classIds) ? body.classIds : [],
      categoryId: body.categoryId,
      session: body.session,
      term: body.term,
      totalMarks: exam.totalMarks || undefined,
      durationMins: exam.durationMins,
      startsAt: exam.startsAt || undefined,
      endsAt: exam.endsAt || undefined,
    });
    return NextResponse.json({ link });
  });
}

/** DELETE /api/cbt/exams/:id/report-card */
export function unlinkReportCard(me: CbtPrincipal, examId: string) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () => {
    const result = await callCore("report-card/unlink", { ...caller(me), cbtExamId: examId });
    await cbtServerStore.setReportCardRelease(examId, null);
    return NextResponse.json(result ?? { unlinked: false });
  });
}

/**
 * POST /api/cbt/exams/:id/report-card/release: copies results into ParaLearn.
 * Blocked while essays await grading; walk-in candidates without a ParaLearn
 * student id are listed rather than sent. Releasing again updates scores.
 */
export function releaseReportCard(me: CbtPrincipal, examId: string) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () => {
    const results = await cbtServerStore.getReportCardResults(examId);
    if (results.pendingReview.length > 0) {
      return NextResponse.json(
        {
          message: `${results.pendingReview.length} submission(s) have essays waiting to be graded. Grade them before releasing to report cards.`,
          pendingReview: results.pendingReview,
        },
        { status: 409 }
      );
    }
    if (results.scores.length === 0) {
      return NextResponse.json(
        {
          message: "No finished results from ParaLearn students yet.",
          unlinked: results.unlinked,
        },
        { status: 409 }
      );
    }
    if (results.scores.some((s) => !(s.maxMarks > 0))) {
      return NextResponse.json(
        { message: "This exam has no marks set yet, so scores can't be released." },
        { status: 409 }
      );
    }

    const saved = await callCore<{ saved: number; skipped: Array<{ studentId: string; reason: string }> }>(
      "report-card/scores",
      {
        ...caller(me),
        cbtExamId: examId,
        totalMarks: results.exam?.totalMarks || undefined,
        scores: results.scores.map(({ candidateName: _name, ...score }) => score),
      }
    );

    const names = new Map(results.scores.map((s) => [s.studentId, s.candidateName]));
    const skipped = (saved?.skipped || []).map((s) => ({
      ...s,
      candidateName: names.get(s.studentId) || s.studentId,
    }));
    const release = {
      releasedAt: new Date().toISOString(),
      saved: saved?.saved ?? 0,
      skipped: skipped.length,
      fingerprint: fingerprint(results.scores),
    };
    await cbtServerStore.setReportCardRelease(examId, release);

    return NextResponse.json({
      ...release,
      skipped,
      unlinked: results.unlinked,
      inProgress: results.inProgress,
    });
  });
}
