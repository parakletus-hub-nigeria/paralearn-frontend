import { NextRequest, NextResponse } from "next/server";
import { cbtServerStore } from "@/lib/cbtServerStore";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    path: string[];
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  const searchParams = request.nextUrl.searchParams;

  // 1. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const workspaceId = searchParams.get("workspaceId") || undefined;
    const exams = cbtServerStore.listExams(workspaceId);
    return NextResponse.json(exams);
  }

  // 2. /api/cbt/exams/code/:code
  if (path[0] === "exams" && path[1] === "code" && path[2]) {
    const code = decodeURIComponent(path[2]);
    const exam = cbtServerStore.getExamByCode(code);
    if (!exam) {
      return NextResponse.json({ message: `Exam room ${code} not found.` }, { status: 404 });
    }
    const ws = cbtServerStore.getWorkspace(exam.workspaceId);
    return NextResponse.json({
      id: exam.id,
      accessCode: exam.accessCode,
      title: exam.title,
      instructions: "Answer all questions. Your responses are saved continuously and submitted when time expires.",
      accessType: "ACCESS_CODE",
      durationMins: exam.durationMins,
      totalQuestions: exam.totalQuestions || 0,
      totalMarks: exam.totalMarks || 0,
      maxTabViolations: exam.maxTabViolations || 3,
      workspaceName: ws?.name || "ParaLearn Assessment Center",
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
    });
  }

  // 3. /api/cbt/exams/:id/monitor
  if (path[0] === "exams" && path[2] === "monitor" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = cbtServerStore.getExamById(examId);
    const candidates = cbtServerStore.listCandidates(examId);
    return NextResponse.json({
      examId,
      examTitle: exam?.title || "Exam Monitor",
      totalCandidates: candidates.length,
      activeNow: candidates.filter((c) => c.status === "STARTED").length,
      submitted: candidates.filter((c) => c.status === "SUBMITTED").length,
      disqualified: candidates.filter((c) => c.status === "DISQUALIFIED").length,
      averageScore: 0,
      flaggedIncidents: [],
      candidates,
    });
  }

  // 4. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = cbtServerStore.getExamById(examId);
    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    }
    const questions = cbtServerStore.getQuestionsForExam(examId);
    const ws = cbtServerStore.getWorkspace(exam.workspaceId);
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

  // 5. /api/cbt/attempts/:id/slip
  if (path[0] === "attempts" && path[2] === "slip" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const att = cbtServerStore.getAttempt(attemptId);
    if (!att) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    const exam = cbtServerStore.getExamById(att.examId);
    return NextResponse.json({
      attemptId: att.id,
      candidateName: att.candidateName,
      candidatePin: att.candidatePin,
      examTitle: att.examTitle || exam?.title || "CBT Assessment",
      examCode: att.examCode,
      score: att.score || 0,
      totalMarks: att.totalMarks || 10,
      percentage: att.percentage || 0,
      status: att.status.toUpperCase(),
      violations: att.violations,
      completedAt: new Date().toISOString(),
    });
  }

  // 6. /api/cbt/candidates
  if (path[0] === "candidates") {
    const examId = searchParams.get("examId") || "";
    const candidates = cbtServerStore.listCandidates(examId);
    return NextResponse.json(candidates);
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  // 1. /api/cbt/workspaces/standalone
  if (path[0] === "workspaces" && path[1] === "standalone") {
    const ws = cbtServerStore.upsertWorkspace({
      name: body.name,
      ownerName: body.ownerName,
      ownerEmail: body.email,
      webhookUrl: body.webhookUrl,
    });
    return NextResponse.json(ws);
  }

  // 2. /api/cbt/workspaces/login
  if (path[0] === "workspaces" && path[1] === "login") {
    const ws = cbtServerStore.upsertWorkspace({
      ownerEmail: body.email,
    });
    return NextResponse.json(ws);
  }

  // 3. /api/cbt/exams
  if (path[0] === "exams" && path.length === 1) {
    const exam = cbtServerStore.upsertExam(body);
    return NextResponse.json(exam, { status: 201 });
  }

  // 4. /api/cbt/exams/:id/questions
  if (path[0] === "exams" && path[2] === "questions" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const questionIds = Array.isArray(body.questionIds) ? body.questionIds : [];
    const exam = cbtServerStore.attachQuestionsToExam(examId, questionIds);
    if (!exam) {
      return NextResponse.json({ message: "Exam not found" }, { status: 404 });
    }
    return NextResponse.json(exam);
  }

  // 5. /api/cbt/questions/bulk
  if (path[0] === "questions" && path[1] === "bulk") {
    const workspaceId = body.workspaceId || "default";
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const created = cbtServerStore.bulkUpsertQuestions(workspaceId, questions);
    return NextResponse.json({ count: created.length, questions: created }, { status: 201 });
  }

  // 6. /api/cbt/questions
  if (path[0] === "questions" && path.length === 1) {
    const q = cbtServerStore.upsertQuestion(body);
    return NextResponse.json(q, { status: 201 });
  }

  // 7. /api/cbt/attempts/start
  if (path[0] === "attempts" && path[1] === "start") {
    const res = cbtServerStore.startAttempt({
      accessCode: body.accessCode,
      candidateName: body.candidateName,
      candidatePin: body.candidatePin,
      email: body.email,
      phone: body.phone,
      studentId: body.studentId,
    });
    if (!res) {
      return NextResponse.json({ message: "Exam room not found or closed" }, { status: 404 });
    }
    return NextResponse.json({
      isResumed: res.isResumed,
      attemptId: res.attempt.id,
      examId: res.exam.id,
      examTitle: res.exam.title,
      candidateName: res.attempt.candidateName,
      candidatePin: res.attempt.candidatePin,
      durationMins: res.attempt.durationMins,
      deadline: res.attempt.deadline,
      remainingSeconds: res.attempt.remainingSeconds,
      violations: res.attempt.violations,
      maxTabViolations: res.exam.maxTabViolations || 3,
      questions: res.questions,
      restoredAnswers: res.attempt.answers || {},
    });
  }

  // 8. /api/cbt/attempts/:id/answer
  if (path[0] === "attempts" && path[2] === "answer" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const ok = cbtServerStore.bufferAnswer(attemptId, body.questionId, body.selectedVal);
    return NextResponse.json({ success: ok });
  }

  // 9. /api/cbt/attempts/:id/telemetry
  if (path[0] === "attempts" && path[2] === "telemetry" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const result = cbtServerStore.recordTelemetry(attemptId, body.eventType);
    return NextResponse.json(result);
  }

  // 10. /api/cbt/attempts/:id/submit
  if (path[0] === "attempts" && path[2] === "submit" && path[1]) {
    const attemptId = decodeURIComponent(path[1]);
    const att = cbtServerStore.submitAttempt(attemptId, body.finalAnswers);
    if (!att) {
      return NextResponse.json({ message: "Attempt not found" }, { status: 404 });
    }
    return NextResponse.json({
      score: att.score,
      totalMarks: att.totalMarks,
      percentage: att.percentage,
      status: att.status.toUpperCase(),
    });
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  // 1. /api/cbt/exams/:id
  if (path[0] === "exams" && path[1]) {
    const examId = decodeURIComponent(path[1]);
    const exam = cbtServerStore.upsertExam({ ...body, id: examId });
    return NextResponse.json(exam);
  }

  // 2. /api/cbt/questions/:id
  if (path[0] === "questions" && path[1]) {
    const questionId = decodeURIComponent(path[1]);
    const q = cbtServerStore.upsertQuestion({ ...body, id: questionId });
    return NextResponse.json(q);
  }

  return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
}
