import { after, NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  cbtServerStore,
  computeWaecGrade,
  CbtConflictError,
  CbtValidationError,
  CbtForbiddenError,
  CbtNotFoundError,
  questionsForAttempt,
  type StoredAttempt,
  publicAttemptMetadata,
  examWorkspaceId,
  toCandidateQuestion,
} from "@/lib/cbtServerStore";
import { BUSI_EXAM } from "@/lib/busiAssessmentData";
import {
  attemptToken,
  cbtServiceHeaders,
  getPrincipal,
  isSafeWebhookUrl,
  verifyAttemptToken,
  type CbtPrincipal,
} from "@/lib/cbtAuth";
import {
  createReportCardCategory,
  importableClasses,
  importCandidates,
  isSchool,
  linkReportCard,
  releaseReportCard,
  reportCardOptions,
  reportCardStatus,
  setUpSchoolExam,
  unlinkReportCard,
} from "@/lib/cbtReportCard";

// Route handler for CBT microservice proxy
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    path: string[];
  }>;
}

function redactWorkspace(ws: any) {
  const maskToken = (token?: string) => {
    if (!token) return undefined;
    if (token.length <= 12) return "••••••••";
    return `${token.substring(0, 10)}••••••••${token.substring(token.length - 4)}`;
  };

  return {
    id: ws.id,
    name: ws.name,
    type: ws.type,
    ownerName: ws.ownerName,
    ownerEmail: ws.ownerEmail,
    credits: ws.credits,
    apiKeyMasked: maskToken(ws.apiKey),
    hasApiKey: Boolean(ws.apiKey),
    hasWebhookSecret: Boolean(ws.webhookSecret),
    webhookUrl: ws.webhookUrl || null,
    createdAt: ws.createdAt,
  };
}

function cbtBackendBase() {
  return (
    process.env.NEXT_PUBLIC_CBT_API_URL ||
    process.env.CBT_BACKEND_URL ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

type Handler = (request: NextRequest, ctx: RouteParams) => Promise<NextResponse>;

/** Conflicts become 409s; store outages become retryable 503s instead of opaque 500s */
function withErrorHandling(handler: Handler): Handler {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      if (err instanceof CbtConflictError) {
        return NextResponse.json({ message: err.message }, { status: 409 });
      }
      if (err instanceof CbtValidationError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      if (err instanceof CbtForbiddenError) {
        return NextResponse.json({ message: err.message }, { status: 403 });
      }
      if (err instanceof CbtNotFoundError) {
        return NextResponse.json({ message: err.message }, { status: 404 });
      }
      console.error("[CBT API] Request failed:", err);
      return NextResponse.json(
        {
          message: "The exam service is busy. Please try again.",
          retryable: true,
          // Store/network error text only (no credentials) — helps diagnose outages
          detail: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        },
        { status: 503 }
      );
    }
  };
}

// ── Access control ────────────────────────────────────────────────────────────
// Candidates sitting an exam need no account. Everything else belongs to the
// signed-in examiner's workspace (session cookie) or an API key's workspace.
function isCandidateRoute(method: string, path: string[]): boolean {
  if (method === "GET") {
    return (
      (path[0] === "exams" && path[1] === "code" && !!path[2]) ||
      (path[0] === "attempts" && (path[2] === "slip" || path[2] === "status"))
    );
  }
  if (method === "POST" && path[0] === "attempts") {
    return path[1] === "start" || ["answer", "telemetry", "submit"].includes(path[2]);
  }
  return false;
}

const unauthorized = () =>
  NextResponse.json({ message: "Please sign in to your CBT workspace." }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ message: "You don't have access to this workspace." }, { status: 403 });
const notFound = (what: string) =>
  NextResponse.json({ message: `${what} not found` }, { status: 404 });

/** Workspace ids can be aliases (e.g. SWEEP), so compare canonical ids */
async function ownsWorkspace(me: CbtPrincipal, workspaceId?: string | null): Promise<boolean> {
  if (!workspaceId) return false;
  if (workspaceId === me.wsId) return true;
  return (await cbtServerStore.getWorkspace(workspaceId))?.id === me.wsId;
}

async function ownsExam(me: CbtPrincipal, examId?: string | null): Promise<boolean> {
  const exam = examId ? await cbtServerStore.getExamById(examId) : null;
  return !!exam && examWorkspaceId(exam) === me.wsId;
}

async function ownsAttempt(me: CbtPrincipal, attemptId: string): Promise<boolean> {
  const att = await cbtServerStore.getAttempt(attemptId);
  return !!att && ownsExam(me, att.examId);
}

async function ownsQuestion(me: CbtPrincipal, questionId: string): Promise<boolean> {
  const q = await cbtServerStore.getQuestion(questionId);
  return !!q && ownsWorkspace(me, q.workspaceId);
}

/**
 * Exam fields a client may set. Questions are attached only through
 * POST /exams/:id/questions (which checks ownership), and the totals follow
 * from them, so neither can be written directly.
 */
function examSettings(body: any) {
  const {
    questionIds: _q,
    totalMarks: _m,
    totalQuestions: _n,
    workspaceId: _w,
    // Acted on when a school exam is created, never stored on the exam
    reportCard: _r,
    ...rest
  } = body || {};
  return rest;
}

/**
 * Who may act on an attempt: the candidate's device (holding the token from
 * attempts/start) or a signed-in examiner / API key that owns the exam.
 * Attempts from before tokens existed stay open, so nobody mid-exam is cut off.
 */
async function attemptAccess(
  request: NextRequest,
  attemptId: string,
  body?: any
): Promise<{ att: StoredAttempt; owner: boolean } | NextResponse> {
  const att = await cbtServerStore.getAttemptById(attemptId);
  if (!att) return notFound("Attempt");
  const token =
    request.headers.get("x-attempt-token") ||
    body?.attemptToken ||
    request.nextUrl.searchParams.get("token");
  if (verifyAttemptToken(att.id, token)) return { att, owner: false };

  const principal = await getPrincipal(request);
  if (principal && (await ownsExam(principal, att.examId))) return { att, owner: true };
  if (!att.tokenRequired && !token) return { att, owner: false };
  return NextResponse.json(
    { message: "This exam session isn't valid on this device. Rejoin from the exam lobby." },
    { status: 401 }
  );
}

/** Sends a signed webhook after the response, without holding it up */
function dispatchWebhook(target: { url?: string; secret?: string }, payload: Record<string, any>) {
  if (!target.url) return;
  if (!isSafeWebhookUrl(target.url)) {
    console.warn("[CBT Webhook] Skipped: webhook URL must be a public https address");
    return;
  }
  const secret = target.secret || process.env.CBT_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[CBT Webhook] Skipped: the workspace has no webhook secret");
    return;
  }
  const rawPayload = JSON.stringify(payload);
  const signature = "sha256=" + crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");
  after(async () => {
    try {
      const res = await fetch(target.url!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cbt-event": payload.event,
          "x-cbt-event-id": payload.eventId,
          "x-cbt-timestamp": payload.timestamp,
          "x-cbt-signature": signature,
        },
        body: rawPayload,
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });
      if (!res.ok) console.warn(`[CBT Webhook] ${payload.event} got HTTP ${res.status}`);
    } catch (err) {
      console.warn("[CBT Webhook] Webhook dispatch error:", err);
    }
  });
}

/** Score fields a candidate shouldn't see when the exam withholds results */
const WITHHELD = {
  score: null,
  totalMarks: null,
  percentage: null,
  grade: null,
  isPassed: null,
  resultsWithheld: true,
};

/** The caller's workspace, or null when the request names someone else's */
async function callerWorkspace(me: CbtPrincipal, requested?: string): Promise<string | null> {
  if (requested && !(await ownsWorkspace(me, requested))) return null;
  return me.wsId;
}

async function handleGET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;
  const principal = await getPrincipal(request);
  if (!principal && !isCandidateRoute("GET", path)) return unauthorized();
  const me = principal as CbtPrincipal;

  // 1a. /api/cbt/workspaces/:id/exams
  if (path[0] === "workspaces" && path[2] === "exams" && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    if (!(await ownsWorkspace(me, wsId))) return forbidden();
    const exams = await cbtServerStore.listExams(wsId);
    return NextResponse.json(exams);
  }


  // 1c. /api/cbt/workspaces/:id (EXACT match: path.length === 2)
  if (path[0] === "workspaces" && path.length === 2 && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    if (!(await ownsWorkspace(me, wsId))) return forbidden();
    const ws = await cbtServerStore.getWorkspace(wsId);
    if (!ws) {
      return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json(redactWorkspace(ws));
  }

  // 1d. /api/cbt/workspaces (EXACT match: path.length === 1)
  if (path[0] === "workspaces" && path.length === 1) {
    const ws = await cbtServerStore.getWorkspace(me.wsId);
    return NextResponse.json(ws ? [redactWorkspace(ws)] : []);
  }

  // 2. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const requested = searchParams.get("workspaceId") || undefined;
    if (requested && !(await ownsWorkspace(me, requested))) return forbidden();
    const exams = await cbtServerStore.listExams(requested || me.wsId);
    return NextResponse.json(exams);
  }

  // 2a. /api/cbt/exams/code/:code/candidate?pin= — greets an enrolled candidate by name.
  // The PIN alone already admits them (with the roster's name), so this reveals nothing more.
  if (path[0] === "exams" && path[1] === "code" && path[2] && path[3] === "candidate") {
    const exam = await cbtServerStore.getExamByCode(decodeURIComponent(path[2]));
    const candidate = exam
      ? await cbtServerStore.findEnrolledCandidate(exam.id, searchParams.get("pin") || "")
      : null;
    if (!candidate) {
      return NextResponse.json({ message: "That PIN isn't on this exam's list." }, { status: 404 });
    }
    return NextResponse.json({ candidateName: candidate.candidateName });
  }

  // 2b. /api/cbt/exams/code/:code
  if (path[0] === "exams" && path[1] === "code" && path[2]) {
    const code = decodeURIComponent(path[2]).trim().toUpperCase();
    if (code === "BUSI-7642") {
      return NextResponse.json({
        id: BUSI_EXAM.id,
        accessCode: "BUSI-7642",
        title: "Business Development Assessment - 1",
        instructions:
          "Answer all questions. Your responses are saved continuously and submitted when time expires.",
        accessType: "ACCESS_CODE",
        durationMins: 90,
        totalQuestions: 30,
        totalMarks: 30,
        maxTabViolations: 3,
        workspaceName: "Parakletus Internship Program",
        isPublished: true,
        startsAt: BUSI_EXAM.startsAt,
        endsAt: BUSI_EXAM.endsAt,
      });
    }
    const exam = await cbtServerStore.getExamByCode(code);
    if (!exam) {
      return NextResponse.json(
        { message: `Exam with code "${code}" not found.` },
        { status: 404 }
      );
    }
    const ws = await cbtServerStore.getWorkspace(examWorkspaceId(exam));
    return NextResponse.json({
      id: exam.id,
      accessCode: exam.accessCode,
      title: exam.title,
      instructions:
        exam.instructions ||
        "Answer all questions. Your responses are saved continuously and submitted when time expires.",
      accessType: exam.accessType || "ACCESS_CODE",
      durationMins: exam.durationMins,
      totalQuestions: exam.totalQuestions || 0,
      totalMarks: exam.totalMarks || 0,
      maxTabViolations: exam.maxTabViolations || 3,
      workspaceName: ws?.name || "ParaLearn Assessment Center",
      isPublished: exam.isPublished ?? true,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
    });
  }

  // 2c. /api/cbt/report-card/options — classes, subjects, categories and terms to link to
  if (path[0] === "report-card" && path[1] === "options") {
    return reportCardOptions(me);
  }

  // 2d. /api/cbt/exams/:id/report-card — link and release status
  if (path[0] === "exams" && path[2] === "report-card" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    return reportCardStatus(me, examId);
  }

  // 3. /api/cbt/exams/:id/monitor
  if (path[0] === "exams" && path[2] === "monitor" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    const monitor = await cbtServerStore.getExamMonitor(examId);
    return NextResponse.json({ ...monitor, flaggedIncidents: [] });
  }

  // 4. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = await cbtServerStore.getExamById(examId);
    if (!exam || examWorkspaceId(exam) !== me.wsId) return notFound("Exam");
    const questions = await cbtServerStore.getQuestionsForExam(examId);
    const ws = await cbtServerStore.getWorkspace(exam.workspaceId);
    return NextResponse.json({
      ...exam,
      workspace: ws ? { id: ws.id, name: ws.name, type: ws.type } : undefined,
      questions: questions.map((q, idx) => ({
        id: `eq_${exam.id}_${q.id}`,
        examId: exam.id,
        questionId: q.id,
        orderIndex: idx,
        question: q,
      })),
    });
  }

  // 5a. /api/cbt/attempts/:id/review (examiner answer sheet)
  if (path[0] === "attempts" && path[2] === "review" && path[1]) {
    if (!(await ownsAttempt(me, decodeURIComponent(path[1])))) return notFound("Attempt");
    const review = await cbtServerStore.getAttemptReview(decodeURIComponent(path[1]));
    if (!review) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    return NextResponse.json(review);
  }

  // 4c. /api/cbt/attempts/:id/status — the candidate's device checks for extra time or a lock
  if (path[0] === "attempts" && path[2] === "status" && path[1]) {
    const access = await attemptAccess(request, decodeURIComponent(path[1]));
    if (access instanceof NextResponse) return access;
    const { att } = access;
    return NextResponse.json({
      status: att.status,
      deadline: att.deadline,
      violations: att.violations || 0,
      serverNow: new Date().toISOString(),
    });
  }

  // 4d. /api/cbt/workspaces/:id/developer — API key and webhook secret, for the signed-in owner
  if (path[0] === "workspaces" && path[2] === "developer" && path[1]) {
    if (me.via !== "session") return forbidden();
    if (!(await ownsWorkspace(me, decodeURIComponent(path[1])))) return forbidden();
    const ws = await cbtServerStore.getWorkspace(me.wsId);
    if (!ws) return notFound("Workspace");
    return NextResponse.json({
      apiKey: ws.apiKey || null,
      webhookUrl: ws.webhookUrl || null,
      webhookSecret: ws.webhookSecret || null,
    });
  }

  // 5. /api/cbt/attempts/:id/slip
  if (path[0] === "attempts" && path[2] === "slip" && path[1]) {
    const access = await attemptAccess(request, decodeURIComponent(path[1]));
    if (access instanceof NextResponse) return access;
    const att = access.att;
    if (att.status === "in_progress" && !access.owner) {
      return NextResponse.json(
        { message: "This attempt is still in progress." },
        { status: 409 }
      );
    }
    const exam = await cbtServerStore.getExamById(att.examId);
    const withheld = !access.owner && exam?.showResultAfter === false;
    const score = att.score ?? 0;
    const totalMarks = att.totalMarks || exam?.totalMarks || 1;
    const percentage = att.percentage ?? Math.round((score / totalMarks) * 100);
    const grade = att.grade || computeWaecGrade(percentage);

    const startedTime = new Date(att.startedAt).getTime();
    const completedTime = att.submittedAt
      ? new Date(att.submittedAt).getTime()
      : Date.now();
    const timeSpentMins = Math.max(
      1,
      Math.round((completedTime - startedTime) / (60 * 1000))
    );

    const slip = {
      attemptId: att.id,
      externalAttemptId: att.externalAttemptId || null,
      studentId: att.studentId || null,
      examId: att.examId,
      examCode: att.examCode,
      examTitle: exam?.title || "CBT Assessment",
      candidateName: att.candidateName,
      candidatePin: att.candidatePin,
      email: att.email || null,
      status: att.status.toUpperCase(),
      gradingStatus: att.gradingStatus || "AUTO_SCORED",
      score,
      totalMarks,
      percentage,
      grade,
      isPassed: percentage >= 50,
      durationMins: att.durationMins || exam?.durationMins || 60,
      timeSpentMins,
      violations: att.violations || 0,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt || null,
      completedAt: att.submittedAt || null,
      resultSlip: {
        durationMins: att.durationMins || exam?.durationMins || 60,
        violations: att.violations || 0,
        breakdown: {
          totalQuestions: exam?.totalQuestions || exam?.questionIds?.length || 0,
          correctCount: att.correctCount ?? 0,
          wrongCount: att.wrongCount ?? 0,
          unansweredCount: att.unansweredCount ?? 0,
          mcqScore: att.mcqScore ?? score,
          essayScore: att.essayScore ?? 0,
        },
      },
      examinerFeedback: att.feedback || null,
      metadata: {
        ...publicAttemptMetadata(att.metadata),
        sweepLearnerId: att.studentId || null,
        sweepAttemptId: att.externalAttemptId || null,
      },
    };
    return NextResponse.json(
      withheld
        ? {
            ...slip,
            ...WITHHELD,
            gradingStatus: null,
            examinerFeedback: null,
            resultSlip: { ...slip.resultSlip, breakdown: null },
          }
        : slip
    );
  }

  // 5b. /api/cbt/sync/export-csv/:examId — results sheet for the exam
  if (path[0] === "sync" && path[1] === "export-csv" && path[2]) {
    const examId = decodeURIComponent(path[2]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    const exam = await cbtServerStore.getExamById(examId);
    const csv = await cbtServerStore.examResultsCsv(examId);
    const name = (exam?.accessCode || examId).replace(/[^A-Za-z0-9-]/g, "");
    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-results.csv"`,
      },
    });
  }

  // 6. /api/cbt/candidates
  if (path[0] === "candidates") {
    const examId = searchParams.get("examId") || "";
    const search = searchParams.get("search") || "";
    if (!(await ownsExam(me, examId))) return notFound("Exam");

    // Imported rosters live in the CBT service; walk-ins, live status and scores live here.
    // Merge both by PIN, letting this store's status and score win.
    let remote: any[] = [];
    try {
      const url = new URL(`${cbtBackendBase()}/candidates`);
      if (examId) url.searchParams.set("examId", examId);
      if (search) url.searchParams.set("search", search);
      const resp = await fetch(url.toString(), {
        headers: cbtServiceHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) remote = data;
      }
    } catch {}

    const local = await cbtServerStore.listCandidates(examId);
    const byPin = new Map<string, any>();
    for (const c of remote) byPin.set(String(c.candidatePin), c);
    for (const c of local) {
      const existing = byPin.get(String(c.candidatePin));
      byPin.set(
        String(c.candidatePin),
        existing
          ? {
              ...existing,
              status: c.status,
              score: c.score,
              totalMarks: c.totalMarks,
              percentage: c.percentage,
            }
          : c
      );
    }
    let merged = [...byPin.values()];
    if (search) {
      const q = search.toLowerCase();
      merged = merged.filter(
        (c) =>
          String(c.candidateName || "").toLowerCase().includes(q) ||
          String(c.candidatePin || "").toLowerCase().includes(q) ||
          String(c.email || "").toLowerCase().includes(q)
      );
    }
    return NextResponse.json(merged);
  }
  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export const GET = withErrorHandling(handleGET);

async function handlePOST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  // 1-2. Legacy sign-in endpoints: sign-in now lives at /api/cbt/auth/*
  if (path[0] === "workspaces" && (path[1] === "standalone" || path[1] === "login")) {
    return NextResponse.json(
      { message: "Sign-in has moved. Refresh the page and sign in again." },
      { status: 410 }
    );
  }

  const principal = await getPrincipal(request);
  if (!principal && !isCandidateRoute("POST", path)) return unauthorized();
  const me = principal as CbtPrincipal;

  // 3. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const workspaceId = await callerWorkspace(me, body.workspaceId);
    if (!workspaceId) return forbidden();
    const isNew = !(body.id && (await cbtServerStore.getExamById(body.id)));
    if (!isNew && !(await ownsExam(me, body.id))) {
      return forbidden();
    }
    // A school exam can name its classes (and report card) when it is created
    const reportCard = body.reportCard;
    const forClasses =
      isNew && isSchool(me) && Array.isArray(reportCard?.classIds) && reportCard.classIds.length > 0;
    const exam = await cbtServerStore.upsertExam({
      ...examSettings(body),
      // Only the imported students may sit it
      ...(forClasses ? { accessType: "ROSTER_ONLY" } : {}),
      workspaceId,
    });
    if (!forClasses) return NextResponse.json(exam, { status: 201 });
    const setup = await setUpSchoolExam(me, exam.id, reportCard);
    return NextResponse.json({ ...exam, setup }, { status: 201 });
  }

  // 3a. /api/cbt/report-card/category — one-click assessment category (school admins)
  if (path[0] === "report-card" && path[1] === "category") {
    return createReportCardCategory(me, body);
  }

  // 3b. /api/cbt/exams/:id/report-card(/release) — link to report cards, release scores
  if (path[0] === "exams" && path[2] === "report-card" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    return path[3] === "release"
      ? releaseReportCard(me, examId)
      : linkReportCard(me, examId, body);
  }

  // 4. /api/cbt/exams/:id/questions
  if (path[0] === "exams" && path[2] === "questions" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    const requestedIds: string[] = Array.isArray(body.questionIds) ? body.questionIds : [];
    const owned = await Promise.all(requestedIds.map((id) => ownsQuestion(me, id)));
    const questionIds = requestedIds.filter((_, i) => owned[i]);
    const exam = await cbtServerStore.attachQuestionsToExam(examId, questionIds);
    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    }
    return NextResponse.json(exam);
  }

  // 5. /api/cbt/questions/bulk
  if (path[0] === "questions" && path[1] === "bulk") {
    const workspaceId = await callerWorkspace(me, body.workspaceId);
    if (!workspaceId) return forbidden();
    const questions = Array.isArray(body.questions) ? body.questions : [];
    for (const q of questions) {
      if (q?.id && (await cbtServerStore.getQuestion(q.id)) && !(await ownsQuestion(me, q.id))) {
        return forbidden();
      }
    }
    const created = await cbtServerStore.bulkUpsertQuestions(workspaceId, questions);
    return NextResponse.json({ count: created.length, questions: created }, { status: 201 });
  }

  // 6. /api/cbt/questions
  if (path[0] === "questions" && path.length === 1) {
    const workspaceId = await callerWorkspace(me, body.workspaceId);
    if (!workspaceId) return forbidden();
    if (body.id && (await cbtServerStore.getQuestion(body.id)) && !(await ownsQuestion(me, body.id))) {
      return forbidden();
    }
    const q = await cbtServerStore.upsertQuestion({ ...body, workspaceId });
    return NextResponse.json(q, { status: 201 });
  }

  // 7. /api/cbt/attempts/start
  if (path[0] === "attempts" && path[1] === "start") {
    if (!String(body.candidateName || "").trim()) {
      return NextResponse.json({ message: "candidateName is required" }, { status: 400 });
    }
    const res = await cbtServerStore.startAttempt({
      accessCode: String(body.accessCode || ""),
      candidateName: String(body.candidateName).trim().slice(0, 120),
      candidatePin: body.candidatePin ? String(body.candidatePin) : undefined,
      email: body.email ? String(body.email).slice(0, 200) : undefined,
      phone: body.phone ? String(body.phone).slice(0, 40) : undefined,
      externalAttemptId:
        body.externalAttemptId || body.attemptId
          ? String(body.externalAttemptId || body.attemptId).slice(0, 200)
          : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    if (!res) {
      return NextResponse.json(
        { message: "Exam room not found or closed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      // Lets the candidate's device correct its clock for an offline countdown
      serverNow: new Date().toISOString(),
      isResumed: res.isResumed,
      attemptId: res.attempt.id,
      externalAttemptId: res.attempt.externalAttemptId || null,
      studentId: res.attempt.studentId || null,
      examId: res.exam.id,
      examTitle: res.exam.title,
      candidateName: res.attempt.candidateName,
      candidatePin: res.attempt.candidatePin,
      durationMins: res.attempt.durationMins,
      deadline: res.attempt.deadline,
      remainingSeconds: res.attempt.remainingSeconds,
      violations: res.attempt.violations,
      maxTabViolations: res.exam.maxTabViolations || 3,
      showResultAfter: res.exam.showResultAfter !== false,
      instructions: res.exam.instructions || null,
      // Only this device holds it; answers, reports, submission and the slip need it
      attemptToken: attemptToken(res.attempt.id),
      questions: questionsForAttempt(res.exam, res.questions, res.attempt.id).map(toCandidateQuestion),
      restoredAnswers: res.attempt.answers || {},
    });
  }

  // 8. /api/cbt/attempts/:id/answer
  if (path[0] === "attempts" && path[2] === "answer" && path[1]) {
    const access = await attemptAccess(request, decodeURIComponent(path[1]), body);
    if (access instanceof NextResponse) return access;
    if (!body.questionId) {
      return NextResponse.json({ success: false, message: "questionId is required" }, { status: 400 });
    }
    const result = await cbtServerStore.bufferAnswer(access.att.id, body.questionId, body.selectedVal);
    if (!result.saved) {
      return NextResponse.json({ success: false, message: result.reason }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  }

  // 9. /api/cbt/attempts/:id/telemetry
  if (path[0] === "attempts" && path[2] === "telemetry" && path[1]) {
    const access = await attemptAccess(request, decodeURIComponent(path[1]), body);
    if (access instanceof NextResponse) return access;
    const result = await cbtServerStore.recordTelemetry(access.att.id, body.eventType, body.eventId);
    return NextResponse.json(result);
  }

  // 10. /api/cbt/attempts/:id/submit
  if (path[0] === "attempts" && path[2] === "submit" && path[1]) {
    const access = await attemptAccess(request, decodeURIComponent(path[1]), body);
    if (access instanceof NextResponse) return access;
    const res = await cbtServerStore.submitAttempt(access.att.id, body.finalAnswers, {
      claimedSubmittedAt: body.submittedAt,
    });
    if (!res) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }

    // Integrators hear about each attempt once, when it is first submitted
    if (!res.alreadySubmitted) {
      dispatchWebhook({ url: res.webhookUrl, secret: res.webhookSecret }, res.webhookPayload);
    }

    const exam = await cbtServerStore.getExamById(res.attempt.examId);
    const withheld = !access.owner && exam?.showResultAfter === false;
    const result = {
      score: res.attempt.score,
      totalMarks: res.attempt.totalMarks,
      percentage: res.attempt.percentage,
      grade: res.attempt.grade,
      status: res.attempt.status.toUpperCase(),
      gradingStatus: res.attempt.gradingStatus || "AUTO_SCORED",
      alreadySubmitted: res.alreadySubmitted,
      attemptId: res.attempt.id,
      externalAttemptId: res.attempt.externalAttemptId || null,
      submittedAt: res.attempt.submittedAt,
      resultSlip: res.webhookPayload.resultSlip,
    };
    return NextResponse.json(
      withheld
        ? { ...result, ...WITHHELD, gradingStatus: null, resultSlip: { ...result.resultSlip, breakdown: null } }
        : result
    );
  }

  // 10a. /api/cbt/attempts/:id/extend | reinstate — invigilator actions
  if (path[0] === "attempts" && (path[2] === "extend" || path[2] === "reinstate") && path[1]) {
    const target = await cbtServerStore.getAttempt(decodeURIComponent(path[1]));
    if (!target || !(await ownsExam(me, target.examId))) return notFound("Attempt");
    const att =
      path[2] === "extend"
        ? await cbtServerStore.extendAttempt(target.id, Number(body.minutes))
        : await cbtServerStore.reinstateAttempt(target.id);
    return NextResponse.json({
      attemptId: att.id,
      status: att.status,
      deadline: att.deadline,
      violations: att.violations || 0,
    });
  }

  // 10c. /api/cbt/workspaces/:id/rotate-api-key | rotate-webhook-secret
  if (
    path[0] === "workspaces" &&
    path[1] &&
    (path[2] === "rotate-api-key" || path[2] === "rotate-webhook-secret")
  ) {
    if (me.via !== "session") return forbidden();
    if (!(await ownsWorkspace(me, decodeURIComponent(path[1])))) return forbidden();
    return path[2] === "rotate-api-key"
      ? NextResponse.json({ apiKey: await cbtServerStore.rotateApiKey(me.wsId) })
      : NextResponse.json({ webhookSecret: await cbtServerStore.rotateWebhookSecret(me.wsId) });
  }

  // 10b. /api/cbt/attempts/:id/manual-grade
  if (path[0] === "attempts" && path[2] === "manual-grade" && path[1]) {
    const target = await cbtServerStore.getAttempt(decodeURIComponent(path[1]));
    if (!target || !(await ownsExam(me, target.examId))) return notFound("Attempt");
    const wasGraded = target.gradingStatus === "GRADED";
    const review = await cbtServerStore.manualGradeAttempt(
      target.id,
      Array.isArray(body.answers) ? body.answers : [],
      typeof body.comment === "string" ? body.comment : undefined
    );
    if (!review) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    // Integrators get the final result once every essay has been marked
    if (!wasGraded && review.gradingStatus === "GRADED") {
      const graded = await cbtServerStore.gradedWebhook(target.id);
      if (graded) dispatchWebhook(graded, graded.payload);
    }
    return NextResponse.json(review);
  }

  // 11. /api/cbt/candidates/bulk
  if (path[0] === "candidates" && path[1] === "bulk") {
    const examId = body.examId;
    if (!examId) {
      return NextResponse.json({ message: "examId is required" }, { status: 400 });
    }
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const results = await cbtServerStore.bulkProvisionCandidates(
      examId,
      candidates,
      request.nextUrl.origin
    );
    return NextResponse.json(results, { status: 201 });
  }

  // 12. /api/cbt/candidates
  if (path[0] === "candidates" && path.length === 1) {
    if (!body.examId || !body.candidateName) {
      return NextResponse.json(
        { message: "examId and candidateName are required" },
        { status: 400 }
      );
    }
    if (!(await ownsExam(me, body.examId))) return notFound("Exam");
    const candidate = await cbtServerStore.provisionCandidate({
      examId: body.examId,
      candidateName: body.candidateName,
      candidatePin: body.candidatePin,
      studentId: body.studentId,
      externalAttemptId: body.externalAttemptId,
      email: body.email,
      phone: body.phone,
      metadata: body.metadata,
      baseUrl: request.nextUrl.origin,
    });
    return NextResponse.json(candidate, { status: 201 });
  }

  
  // 13. /api/cbt/import/classes or /api/cbt/import/candidates — straight from ParaLearn Core
  if (path[0] === "import" && path[1] === "classes") {
    return importableClasses(me);
  }
  if (path[0] === "import" && path[1] === "candidates") {
    if (!(await ownsExam(me, body.examId))) return notFound("Exam");
    return importCandidates(me, body.examId, body);
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export const POST = withErrorHandling(handlePOST);

async function handlePATCH(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  const me = await getPrincipal(request);
  if (!me) return unauthorized();
  // Records never move between workspaces
  const { workspaceId: _ignored, ...changes } = body;

  // 1. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    const exam = await cbtServerStore.upsertExam({ ...examSettings(changes), id: examId });
    return NextResponse.json(exam);
  }

  // 2. /api/cbt/questions/:id
  if (path[0] === "questions" && path[1]) {
    const questionId = decodeURIComponent(path[1]);
    if (!(await ownsQuestion(me, questionId))) return notFound("Question");
    const q = await cbtServerStore.upsertQuestion({ ...changes, id: questionId });
    return NextResponse.json(q);
  }

  // 3. /api/cbt/workspaces/:id
  if (path[0] === "workspaces" && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    if (!(await ownsWorkspace(me, wsId))) return forbidden();
    if (changes.webhookUrl && !isSafeWebhookUrl(String(changes.webhookUrl))) {
      return NextResponse.json(
        { message: "The webhook URL must be a public https:// address." },
        { status: 400 }
      );
    }
    // Credits and API keys are not self-service
    const ws = await cbtServerStore.updateWorkspace(me.wsId, {
      name: typeof changes.name === "string" ? changes.name.trim().slice(0, 120) || undefined : undefined,
      webhookUrl:
        changes.webhookUrl === null || changes.webhookUrl === ""
          ? ""
          : typeof changes.webhookUrl === "string"
            ? changes.webhookUrl.trim()
            : undefined,
    });
    if (!ws) {
      return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json(redactWorkspace(ws));
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export const PATCH = withErrorHandling(handlePATCH);

async function handleDELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;

  // /api/cbt/exams/:id — delete an exam nobody has taken
  if (path[0] === "exams" && path[1] && path.length === 2) {
    const me = await getPrincipal(request);
    if (!me) return unauthorized();
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    await cbtServerStore.deleteExam(examId);
    return NextResponse.json({ success: true });
  }

  // /api/cbt/exams/:id/report-card — unlink (only before scores are released)
  if (path[0] === "exams" && path[2] === "report-card" && path[1]) {
    const me = await getPrincipal(request);
    if (!me) return unauthorized();
    const examId = decodeURIComponent(path[1]);
    if (!(await ownsExam(me, examId))) return notFound("Exam");
    return unlinkReportCard(me, examId);
  }

  // /api/cbt/candidates/:id — the entry may exist in the CBT service, this store, or both
  if (path[0] === "candidates" && path[1]) {
    const me = await getPrincipal(request);
    if (!me) return unauthorized();
    const id = decodeURIComponent(path[1]);
    const remoteUrl = `${cbtBackendBase()}/candidates/${encodeURIComponent(id)}`;
    let remote: { examId?: string; candidatePin?: string } | null = null;
    try {
      const found = await fetch(remoteUrl, {
        headers: cbtServiceHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (found.ok) remote = await found.json();
    } catch {}
    const local = await cbtServerStore.getCandidate(id);

    const examId = remote?.examId || local?.examId;
    if (!examId || !(await ownsExam(me, examId))) return notFound("Candidate");

    if (remote) {
      try {
        await fetch(remoteUrl, {
          method: "DELETE",
          headers: cbtServiceHeaders(),
          signal: AbortSignal.timeout(8000),
        });
      } catch {}
    }
    await cbtServerStore.deleteCandidate({ id, examId, pin: remote?.candidatePin });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export const DELETE = withErrorHandling(handleDELETE);
