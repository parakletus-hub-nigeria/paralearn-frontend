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

const onlySchools = (message = "Report cards are only available to school workspaces.") =>
  NextResponse.json({ message }, { status: 403 });
const IMPORT_SCHOOLS_ONLY = "Importing from ParaLearn is only available to school workspaces.";

/** Who is acting, for Core's permission checks */
function caller(me: CbtPrincipal) {
  return { email: me.email, schoolId: me.schoolId };
}

/** A school workspace signed in by a ParaLearn staff member */
export function isSchool(me: CbtPrincipal) {
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

// ── Guided set-up for school exams ───────────────────────────────────────────

/** POST /api/cbt/report-card/category: one-click category (Core allows school admins only) */
export function createReportCardCategory(me: CbtPrincipal, body: any) {
  if (!isSchool(me)) return onlySchools();
  return withCore(async () =>
    NextResponse.json(
      await callCore("report-card/category", {
        ...caller(me),
        name: String(body?.name ?? ""),
        weight: Number(body?.weight),
      })
    )
  );
}

/** POST /api/cbt/import/classes: the classes this staff member can import from */
export function importableClasses(me: CbtPrincipal) {
  if (!isSchool(me)) return onlySchools(IMPORT_SCHOOLS_ONLY);
  return withCore(async () => {
    const data = await callCore<any>("classes", caller(me));
    const classes = Array.isArray(data?.classes) ? data.classes : [];
    return NextResponse.json({
      success: true,
      user: data?.user ?? null,
      accessTier: data?.tier,
      classes,
      totalClasses: classes.length,
      totalAvailableStudents: classes.reduce(
        (sum: number, c: any) => sum + (Number(c.activeStudents) || 0),
        0
      ),
    });
  });
}

/** Fetches the classes' students from Core and adds them to the exam's roster */
async function importClassStudents(me: CbtPrincipal, examId: string, classIds: string[]) {
  const data = await callCore<any>("students", { ...caller(me), classIds });
  const students = (Array.isArray(data?.students) ? data.students : []).map((s: any) => ({
    studentId: s.studentId,
    candidateName: s.fullName || `${s.firstName || ""} ${s.lastName || ""}`.trim(),
    email: s.email,
    phone: s.phone,
    metadata: {
      regNumber: s.sisStudentId || null,
      className: s.className || null,
      classId: s.classId || null,
      source: "paralearn",
    },
  }));
  const result = await cbtServerStore.importRoster(examId, students);
  return { ...result, classesImported: data?.classesRequested ?? [] };
}

/** POST /api/cbt/import/candidates: imports whole classes into an exam's roster */
export function importCandidates(me: CbtPrincipal, examId: string, body: any) {
  if (!isSchool(me)) return onlySchools(IMPORT_SCHOOLS_ONLY);
  const classIds = cleanIds(body?.classIds);
  if (classIds.length === 0) {
    return NextResponse.json({ message: "Choose at least one class." }, { status: 400 });
  }
  return withCore(async () => {
    const exam = await cbtServerStore.getExamById(examId);
    if (!exam) return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    const { candidates, created, updated, classesImported } = await importClassStudents(
      me,
      examId,
      classIds
    );
    return NextResponse.json({
      success: true,
      imported: candidates.length,
      newlyCreated: created,
      updated,
      examId,
      examTitle: exam.title,
      classesImported,
      message:
        candidates.length === 0
          ? "No active students were found in the selected classes."
          : `Imported ${candidates.length} student${candidates.length === 1 ? "" : "s"} into ${exam.title}.`,
      candidates: candidates.map((c) => ({
        id: c.id,
        candidateName: c.candidateName,
        candidatePin: c.candidatePin,
        studentId: c.studentId ?? null,
        email: c.email ?? null,
      })),
    });
  });
}

function cleanIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string" && v.trim() !== ""))]
    : [];
}

export interface SchoolExamSetup {
  /** The report-card link, when one was made */
  link: any | null;
  linkError: string | null;
  /** Students added to the roster */
  imported: number;
  importError: string | null;
}

/**
 * Runs right after a school exam is created: links it to the report card and
 * imports the chosen classes' students. Each step reports its own result, so a
 * failure leaves a working exam and tells the examiner what still needs doing.
 */
export async function setUpSchoolExam(
  me: CbtPrincipal,
  examId: string,
  reportCard: any
): Promise<SchoolExamSetup> {
  const setup: SchoolExamSetup = { link: null, linkError: null, imported: 0, importError: null };
  const classIds = cleanIds(reportCard?.classIds);
  if (!isSchool(me) || classIds.length === 0) return setup;

  const reason = (err: unknown) =>
    err instanceof CoreRequestError ? err.message : "ParaLearn couldn't be reached. Try again from the exam's monitor.";

  if (!reportCard.practice) {
    try {
      const res = await linkReportCard(me, examId, { ...reportCard, classIds });
      const data = await res.json();
      if (res.ok) setup.link = data.link;
      else setup.linkError = data.message || "The exam couldn't be linked to report cards.";
    } catch (err) {
      setup.linkError = reason(err);
    }
  }

  try {
    setup.imported = (await importClassStudents(me, examId, classIds)).candidates.length;
  } catch (err) {
    setup.importError = reason(err);
  }
  return setup;
}
