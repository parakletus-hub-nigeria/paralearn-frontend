import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  cbtServerStore,
  computeWaecGrade,
  CbtConflictError,
  toCandidateQuestion,
} from "@/lib/cbtServerStore";
import { BUSI_EXAM } from "@/lib/busiAssessmentData";

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

async function handleGET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;

  // 1a. /api/cbt/workspaces/:id/exams
  if (path[0] === "workspaces" && path[2] === "exams" && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    const exams = await cbtServerStore.listExams(wsId);
    return NextResponse.json(exams);
  }


  // 1c. /api/cbt/workspaces/:id (EXACT match: path.length === 2)
  if (path[0] === "workspaces" && path.length === 2 && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    const ws = await cbtServerStore.getWorkspace(wsId);
    if (!ws) {
      return NextResponse.json({ message: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json(redactWorkspace(ws));
  }

  // 1d. /api/cbt/workspaces (EXACT match: path.length === 1)
  if (path[0] === "workspaces" && path.length === 1) {
    const ws = await cbtServerStore.getWorkspace("default");
    return NextResponse.json(ws ? [redactWorkspace(ws)] : []);
  }

  // 2. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const workspaceId = searchParams.get("workspaceId") || undefined;
    const exams = await cbtServerStore.listExams(workspaceId);
    return NextResponse.json(exams);
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
    const ws = await cbtServerStore.getWorkspace(exam.workspaceId);
    return NextResponse.json({
      id: exam.id,
      accessCode: exam.accessCode,
      title: exam.title,
      instructions:
        "Answer all questions. Your responses are saved continuously and submitted when time expires.",
      accessType: "ACCESS_CODE",
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

  // 3. /api/cbt/exams/:id/monitor
  if (path[0] === "exams" && path[2] === "monitor" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const monitor = await cbtServerStore.getExamMonitor(examId);
    return NextResponse.json({ ...monitor, flaggedIncidents: [] });
  }

  // 4. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = await cbtServerStore.getExamById(examId);
    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    }
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
    const review = await cbtServerStore.getAttemptReview(decodeURIComponent(path[1]));
    if (!review) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    return NextResponse.json(review);
  }

  // 5. /api/cbt/attempts/:id/slip
  if (path[0] === "attempts" && path[2] === "slip" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const att = await cbtServerStore.getAttempt(attemptId);
    if (!att) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    const exam = await cbtServerStore.getExamById(att.examId);
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

    return NextResponse.json({
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
          mcqScore: att.mcqScore ?? score,
          essayScore: att.essayScore ?? 0,
        },
      },
      metadata: {
        ...att.metadata,
        sweepLearnerId: att.studentId || null,
        sweepAttemptId: att.externalAttemptId || null,
      },
    });
  }

  // 6. /api/cbt/candidates
  if (path[0] === "candidates") {
    const examId = searchParams.get("examId") || "";
    const search = searchParams.get("search") || "";

    // Imported rosters live in the CBT service; walk-ins, live status and scores live here.
    // Merge both by PIN, letting this store's status and score win.
    let remote: any[] = [];
    try {
      const url = new URL(`${cbtBackendBase()}/candidates`);
      if (examId) url.searchParams.set("examId", examId);
      if (search) url.searchParams.set("search", search);
      const resp = await fetch(url.toString(), {
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

async function resolveCallerWorkspaceId(
  request: NextRequest,
  bodyWorkspaceId?: string
): Promise<string> {
  if (bodyWorkspaceId) return bodyWorkspaceId;
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : apiKeyHeader?.trim();
  if (token) {
    const ws = await cbtServerStore.findWorkspaceByApiKey(token);
    if (ws) return ws.id;
  }
  return "default";
}

async function handlePOST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  // 1. /api/cbt/workspaces/standalone
  if (path[0] === "workspaces" && path[1] === "standalone") {
    const ws = await cbtServerStore.upsertWorkspace({
      id: body.id,
      name: body.name,
      ownerName: body.ownerName,
      ownerEmail: body.email,
      webhookUrl: body.webhookUrl,
      webhookSecret: body.webhookSecret,
      apiKey: body.apiKey,
    });
    return NextResponse.json(ws, { status: 201 });
  }

  // 2. /api/cbt/workspaces/login
  if (path[0] === "workspaces" && path[1] === "login") {
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password ? String(body.password).trim() : "";

    // Specific password verification for parakletus70@gmail.com
    if (
      email === "parakletus70@gmail.com" ||
      email === "internship@parakletus.com" ||
      email.includes("parakletus")
    ) {
      if (!password || password !== "60647065PiP") {
        return NextResponse.json(
          { message: "Invalid password for Parakletus Internship Program examiner." },
          { status: 401 }
        );
      }
    }

    const ws = await cbtServerStore.upsertWorkspace({
      ownerEmail: body.email,
      password: body.password || "60647065PiP",
    });
    const { password: _p, ...safeWs } = ws as any;
    return NextResponse.json(safeWs);
  }

  // 3. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const workspaceId = await resolveCallerWorkspaceId(request, body.workspaceId);
    const exam = await cbtServerStore.upsertExam({ ...body, workspaceId });
    return NextResponse.json(exam, { status: 201 });
  }

  // 4. /api/cbt/exams/:id/questions
  if (path[0] === "exams" && path[2] === "questions" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const questionIds = Array.isArray(body.questionIds) ? body.questionIds : [];
    const exam = await cbtServerStore.attachQuestionsToExam(examId, questionIds);
    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    }
    return NextResponse.json(exam);
  }

  // 5. /api/cbt/questions/bulk
  if (path[0] === "questions" && path[1] === "bulk") {
    const workspaceId = await resolveCallerWorkspaceId(request, body.workspaceId);
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const created = await cbtServerStore.bulkUpsertQuestions(workspaceId, questions);
    return NextResponse.json({ count: created.length, questions: created }, { status: 201 });
  }

  // 6. /api/cbt/questions
  if (path[0] === "questions" && path.length === 1) {
    const workspaceId = await resolveCallerWorkspaceId(request, body.workspaceId);
    const q = await cbtServerStore.upsertQuestion({ ...body, workspaceId });
    return NextResponse.json(q, { status: 201 });
  }

  // 7. /api/cbt/attempts/start
  if (path[0] === "attempts" && path[1] === "start") {
    if (!String(body.candidateName || "").trim()) {
      return NextResponse.json({ message: "candidateName is required" }, { status: 400 });
    }
    const res = await cbtServerStore.startAttempt({
      accessCode: body.accessCode,
      candidateName: body.candidateName,
      candidatePin: body.candidatePin,
      email: body.email,
      phone: body.phone,
      studentId: body.studentId,
      externalAttemptId: body.externalAttemptId || body.attemptId,
      metadata: body.metadata,
    });
    if (!res) {
      return NextResponse.json(
        { message: "Exam room not found or closed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
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
      questions: res.questions.map(toCandidateQuestion),
      restoredAnswers: res.attempt.answers || {},
    });
  }

  // 8. /api/cbt/attempts/:id/answer
  if (path[0] === "attempts" && path[2] === "answer" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const result = await cbtServerStore.bufferAnswer(
      attemptId,
      body.questionId,
      body.selectedVal
    );
    if (!result.saved) {
      const status = result.reason === "Attempt not found" ? 404 : 409;
      return NextResponse.json({ success: false, message: result.reason }, { status });
    }
    return NextResponse.json({ success: true });
  }

  // 9. /api/cbt/attempts/:id/telemetry
  if (path[0] === "attempts" && path[2] === "telemetry" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const result = await cbtServerStore.recordTelemetry(attemptId, body.eventType);
    return NextResponse.json(result);
  }

  // 10. /api/cbt/attempts/:id/submit
  if (path[0] === "attempts" && path[2] === "submit" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const res = await cbtServerStore.submitAttempt(attemptId, body.finalAnswers);
    if (!res) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }

    // Trigger external HMAC-signed webhook if workspace has webhookUrl (first submission only)
    if (res.webhookUrl && !res.alreadySubmitted) {
      const rawPayload = JSON.stringify(res.webhookPayload);
      const secret =
        res.webhookSecret ||
        process.env.CBT_WEBHOOK_SECRET ||
        "pln_whsec_default";
      const signature =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(rawPayload).digest("hex");

      fetch(res.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cbt-event": res.webhookPayload.event,
          "x-cbt-event-id": res.webhookPayload.eventId,
          "x-cbt-timestamp": res.webhookPayload.timestamp,
          "x-cbt-signature": signature,
        },
        body: rawPayload,
        signal: AbortSignal.timeout(10000),
      }).catch((err) => {
        console.warn("[CBT Webhook] Webhook dispatch error:", err);
      });
    }

    return NextResponse.json({
      score: res.attempt.score,
      totalMarks: res.attempt.totalMarks,
      percentage: res.attempt.percentage,
      grade: res.attempt.grade,
      status: res.attempt.status.toUpperCase(),
      gradingStatus: res.attempt.gradingStatus || "AUTO_SCORED",
      alreadySubmitted: res.alreadySubmitted,
      attemptId: res.attempt.id,
      externalAttemptId: res.attempt.externalAttemptId || null,
      resultSlip: res.webhookPayload.resultSlip,
    });
  }

  // 10b. /api/cbt/attempts/:id/manual-grade
  if (path[0] === "attempts" && path[2] === "manual-grade" && path[1]) {
    const review = await cbtServerStore.manualGradeAttempt(
      decodeURIComponent(path[1]),
      Array.isArray(body.answers) ? body.answers : []
    );
    if (!review) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    return NextResponse.json(review);
  }

  // 11. /api/cbt/candidates/bulk
  if (path[0] === "candidates" && path[1] === "bulk") {
    const examId = body.examId;
    if (!examId) {
      return NextResponse.json({ message: "examId is required" }, { status: 400 });
    }
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

  
  // 13. /api/cbt/import/classes or /api/cbt/import/candidates
  if (path[0] === "import" && (path[1] === "classes" || path[1] === "candidates")) {
    try {
      const targetUrl = `${cbtBackendBase()}/import/${path[1]}`;
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));

      // Exam attempts are served from the local store, so mirror imported candidates
      // there too — otherwise their studentId link (needed for score sync) is lost.
      if (response.ok && path[1] === "candidates" && Array.isArray(data?.candidates)) {
        for (const c of data.candidates) {
          try {
            await cbtServerStore.provisionCandidate({
              examId: body.examId,
              candidateName: c.candidateName,
              candidatePin: c.candidatePin,
              studentId: c.studentId,
              email: c.email,
              phone: c.phone,
              metadata: c.metadata,
              baseUrl: request.nextUrl.origin,
            });
          } catch (mirrorErr) {
            console.warn("[cbt-import] Could not mirror candidate to local store:", mirrorErr);
            break; // exam not in local store — remaining candidates would fail the same way
          }
        }
      }

      return NextResponse.json(data, { status: response.status });
    } catch (err) {
      return NextResponse.json(
        { message: "Failed to connect to CBT microservice: " + (err instanceof Error ? err.message : String(err)) },
        { status: 502 }
      );
    }
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

  // 1. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = await cbtServerStore.upsertExam({ ...body, id: examId });
    return NextResponse.json(exam);
  }

  // 2. /api/cbt/questions/:id
  if (path[0] === "questions" && path[1]) {
    const questionId = decodeURIComponent(path[1]);
    const q = await cbtServerStore.upsertQuestion({ ...body, id: questionId });
    return NextResponse.json(q);
  }

  // 3. /api/cbt/workspaces/:id
  if (path[0] === "workspaces" && path[1]) {
    const wsId = decodeURIComponent(path[1]);
    const ws = await cbtServerStore.updateWorkspace(wsId, body);
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

  // /api/cbt/candidates/:id — the entry may exist in the CBT service, this store, or both
  if (path[0] === "candidates" && path[1]) {
    const id = decodeURIComponent(path[1]);
    const remoteUrl = `${cbtBackendBase()}/candidates/${encodeURIComponent(id)}`;
    let remote: { examId?: string; candidatePin?: string } | null = null;
    try {
      const found = await fetch(remoteUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (found.ok) remote = await found.json();
      if (remote) await fetch(remoteUrl, { method: "DELETE", signal: AbortSignal.timeout(8000) });
    } catch {}

    const removedLocal = await cbtServerStore.deleteCandidate({
      id,
      examId: remote?.examId,
      pin: remote?.candidatePin,
    });
    if (!remote && !removedLocal) {
      return NextResponse.json({ message: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export const DELETE = withErrorHandling(handleDELETE);
