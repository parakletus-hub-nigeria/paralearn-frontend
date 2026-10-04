/**
 * cbtServerStore.ts  (KV-backed rewrite)
 *
 * All reads/writes now go through kvAdapter which:
 *   - Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set
 *   - Falls back to a process-level in-memory Map for local development
 *
 * This makes the CBT system work correctly on serverless platforms (Vercel)
 * where each function invocation is stateless.
 */

import { kvAdapter } from "./cbtKvAdapter";
import { BUSI_WORKSPACE, BUSI_EXAM, BUSI_QUESTIONS } from "./busiAssessmentData";

// ── Interfaces (unchanged from original) ─────────────────────────────────────

export interface StoredOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  keyLabel?: string;
}

export interface StoredQuestion {
  id: string;
  workspaceId: string;
  prompt: string;
  type: string;
  marks: number;
  section?: string;
  options?: StoredOption[];
  explanation?: string;
  createdAt?: string;
}

export interface StoredExam {
  id: string;
  workspaceId: string;
  title: string;
  accessCode: string;
  durationMins: number;
  totalMarks?: number;
  totalQuestions?: number;
  isPublished?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxTabViolations?: number;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  showResultAfter?: boolean;
  questionIds?: string[];
  createdAt: string;
}

export interface StoredWorkspace {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  password?: string;
  credits: number;
  apiKey?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  createdAt: string;
}

export interface StoredCandidate {
  id: string;
  examId: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string | null;
  externalAttemptId?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "REGISTERED" | "STARTED" | "SUBMITTED" | "DISQUALIFIED";
  score?: number;
  totalMarks?: number;
  percentage?: number;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface StoredAttempt {
  id: string;
  examId: string;
  examCode: string;
  candidateName: string;
  candidatePin: string;
  email?: string;
  phone?: string;
  studentId?: string;
  externalAttemptId?: string;
  startedAt: string;
  submittedAt?: string;
  deadline: string;
  durationMins: number;
  remainingSeconds: number;
  answers: Record<string, any>;
  violations: number;
  status: "in_progress" | "submitted" | "disqualified";
  score?: number;
  totalMarks?: number;
  percentage?: number;
  grade?: string;
  metadata?: Record<string, any>;
}

// ── KV namespace prefixes ─────────────────────────────────────────────────────
const NS = {
  workspace: "cbt:ws",
  workspaceByEmail: "cbt:ws:email",
  workspaceByApiKey: "cbt:ws:apikey",
  exam: "cbt:exam",
  examByCode: "cbt:exam:code",
  examsByWorkspace: "cbt:exams:ws",
  question: "cbt:q",
  questionsByExam: "cbt:qs:exam",
  candidate: "cbt:cand",
  candidatesByExam: "cbt:cands:exam",
  attempt: "cbt:att",
  attemptsByExam: "cbt:atts:exam",
};

export const SWEEP_WORKSPACE: StoredWorkspace = {
  id: "ws_sweep_prod",
  name: "SWEEP ACADEMY",
  type: "STANDALONE_HALL",
  ownerName: "Mina Ogbanga",
  ownerEmail: "ogbangadigitalprojects@gmail.com",
  credits: 999999,
  apiKey:
    process.env.SWEEP_CBT_API_KEY ||
    "pln_live_sk_swp_16a28285697747567c3b838c7de52a4892be574d",
  webhookSecret:
    process.env.SWEEP_CBT_WEBHOOK_SECRET ||
    "pln_whsec_swp_e40c3e7ff4d07d241380e63c7d1c955a6da8fe84",
  webhookUrl:
    process.env.SWEEP_WEBHOOK_URL ||
    "https://<your-sweep-domain>/courses/paralearn/webhook/",
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ── Default workspaces seeded on first access ────────────────────────────────
const DEFAULT_WORKSPACES: StoredWorkspace[] = [
  {
    id: "default",
    name: "ParaLearn Assessment Center",
    type: "STANDALONE_HALL",
    ownerName: "ParaLearn Admin",
    ownerEmail: "admin@pln.ng",
    credits: 99999,
    apiKey:
      process.env.CBT_WORKSPACE_API_KEY ||
      "pln_live_sk_def_c71a39f048d21b75e92c4a8f",
    webhookSecret:
      process.env.CBT_WEBHOOK_SECRET ||
      "pln_whsec_def_58b29c1e07f43a6d812e9b0c",
    webhookUrl: process.env.CBT_WEBHOOK_URL || undefined,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  SWEEP_WORKSPACE,
  BUSI_WORKSPACE,
];

// ── Helper: seed default workspaces, exams & questions if not present ─────────
async function ensureDefaultWorkspacesAndExams() {
  for (const ws of DEFAULT_WORKSPACES) {
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    await kvAdapter.set(`${NS.workspaceByEmail}:${ws.ownerEmail.toLowerCase()}`, ws.id);
    if (ws.apiKey) {
      await kvAdapter.set(`${NS.workspaceByApiKey}:${ws.apiKey}`, ws.id);
    }
  }

  // Ensure secondary email indexes
  await kvAdapter.set(`${NS.workspaceByEmail}:sweep@pln.ng`, SWEEP_WORKSPACE.id);
  await kvAdapter.set(`${NS.workspaceByEmail}:internship@parakletus.com`, BUSI_WORKSPACE.id);

  // Ensure BUSI-7642 exam is saved, published, and scheduled (Monday Oct 5, 8:00 AM to 11:00 PM WAT)
  await kvAdapter.hset(NS.exam, BUSI_EXAM.id, BUSI_EXAM);
  await kvAdapter.set(`${NS.examByCode}:${BUSI_EXAM.accessCode}`, BUSI_EXAM.id);

  // Ensure all 30 questions are seeded
  for (const q of BUSI_QUESTIONS) {
    const existingQ = await kvAdapter.hget<StoredQuestion>(NS.question, q.id);
    if (!existingQ) {
      await kvAdapter.hset(NS.question, q.id, q);
    }
  }
}

// ── Grade helper (unchanged) ──────────────────────────────────────────────────
export function computeWaecGrade(percentage: number): string {
  if (percentage >= 75) return "A1";
  if (percentage >= 70) return "B2";
  if (percentage >= 65) return "B3";
  if (percentage >= 60) return "C4";
  if (percentage >= 55) return "C5";
  if (percentage >= 50) return "C6";
  if (percentage >= 45) return "D7";
  if (percentage >= 40) return "E8";
  return "F9";
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const cbtServerStore = {
  // ── Workspaces ──────────────────────────────────────────────────────────
  async getWorkspace(id: string): Promise<StoredWorkspace | null> {
    if (!id) return null;
    await ensureDefaultWorkspacesAndExams();
    const cleanId = id.trim().toLowerCase();

    // 1. SWEEP ACADEMY: Mina Ogbanga (ogbangadigitalprojects@gmail.com)
    if (
      cleanId === "ws_sweep_prod" ||
      cleanId === "sweep" ||
      cleanId.includes("sweep") ||
      cleanId === "ogbangadigitalprojects@gmail.com" ||
      cleanId.includes("ogbanga")
    ) {
      const ws = await kvAdapter.hget<StoredWorkspace>(NS.workspace, "ws_sweep_prod");
      return {
        ...SWEEP_WORKSPACE,
        ...(ws || {}),
        id: "ws_sweep_prod",
        name: "SWEEP ACADEMY",
        ownerName: "Mina Ogbanga",
        ownerEmail: "ogbangadigitalprojects@gmail.com",
      };
    }

    // 2. Parakletus Internship Program: Evander Ikechukwu (parakletus70@gmail.com)
    if (
      cleanId === BUSI_WORKSPACE.id ||
      cleanId.includes("internship") ||
      cleanId.includes("parakletus") ||
      cleanId === "parakletus70@gmail.com" ||
      cleanId.includes("ikechukwu") ||
      cleanId.includes("evander")
    ) {
      const ws = await kvAdapter.hget<StoredWorkspace>(NS.workspace, BUSI_WORKSPACE.id);
      return {
        ...BUSI_WORKSPACE,
        ...(ws || {}),
        id: BUSI_WORKSPACE.id,
        name: "Parakletus Internship Program",
        ownerName: "Evander Ikechukwu",
        ownerEmail: "parakletus70@gmail.com",
        password: "60647065PiP",
      };
    }

    // 3. Default
    if (cleanId === "default") {
      const defaultWs = await kvAdapter.hget<StoredWorkspace>(NS.workspace, "default");
      return defaultWs || DEFAULT_WORKSPACES[0];
    }

    const ws = await kvAdapter.hget<StoredWorkspace>(NS.workspace, id);
    if (ws) return ws;

    const all = await kvAdapter.hlist<StoredWorkspace>(NS.workspace);
    return all.find((w) => w.id === id || w.name?.toLowerCase() === cleanId) || null;
  },

  async findWorkspaceByApiKey(apiKey: string): Promise<StoredWorkspace | null> {
    const cleanKey = apiKey.trim();
    const id = await kvAdapter.get<string>(`${NS.workspaceByApiKey}:${cleanKey}`);
    if (id) return kvAdapter.hget<StoredWorkspace>(NS.workspace, id);
    // fallback full scan
    const all = await kvAdapter.hlist<StoredWorkspace>(NS.workspace);
    return all.find((w) => w.apiKey === cleanKey) || null;
  },

  async findWorkspaceByEmail(email: string): Promise<StoredWorkspace | null> {
    if (!email) return null;
    await ensureDefaultWorkspacesAndExams();
    const cleanEmail = email.trim().toLowerCase();

    // 1. SWEEP ACADEMY: Mina Ogbanga
    if (
      cleanEmail === "ogbangadigitalprojects@gmail.com" ||
      cleanEmail === "sweep@pln.ng" ||
      cleanEmail.includes("ogbanga") ||
      cleanEmail.includes("sweep")
    ) {
      return this.getWorkspace("ws_sweep_prod");
    }

    // 2. Parakletus Internship Program: Evander Ikechukwu
    if (
      cleanEmail === "parakletus70@gmail.com" ||
      cleanEmail === "internship@parakletus.com" ||
      cleanEmail.includes("parakletus") ||
      cleanEmail.includes("ikechukwu") ||
      cleanEmail.includes("evander")
    ) {
      return this.getWorkspace(BUSI_WORKSPACE.id);
    }

    const id = await kvAdapter.get<string>(`${NS.workspaceByEmail}:${cleanEmail}`);
    if (id) return kvAdapter.hget<StoredWorkspace>(NS.workspace, id);
    const all = await kvAdapter.hlist<StoredWorkspace>(NS.workspace);
    return all.find((w) => w.ownerEmail?.toLowerCase() === cleanEmail) || null;
  },

  async updateWorkspace(
    id: string,
    data: Partial<StoredWorkspace>
  ): Promise<StoredWorkspace | null> {
    const ws = await this.getWorkspace(id);
    if (!ws) return null;
    if (data.name !== undefined) ws.name = data.name;
    if (data.webhookUrl !== undefined) ws.webhookUrl = data.webhookUrl;
    if (data.webhookSecret !== undefined) ws.webhookSecret = data.webhookSecret;
    if (data.apiKey !== undefined) ws.apiKey = data.apiKey;
    if (data.credits !== undefined) ws.credits = data.credits;
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    return ws;
  },

  async upsertWorkspace(
    data: Partial<StoredWorkspace> & { ownerEmail?: string; email?: string }
  ): Promise<StoredWorkspace> {
    const email = (
      data.ownerEmail ||
      data.email ||
      `${data.id || "ws"}@pln.ng`
    )
      .trim()
      .toLowerCase();

    // Explicit routing for SWEEP ACADEMY (Mina Ogbanga)
    if (
      data.id === "ws_sweep_prod" ||
      email === "ogbangadigitalprojects@gmail.com" ||
      email === "sweep@pln.ng" ||
      email.includes("ogbanga") ||
      email.includes("sweep")
    ) {
      const current = await this.getWorkspace("ws_sweep_prod");
      const updated: StoredWorkspace = {
        ...SWEEP_WORKSPACE,
        ...(current || {}),
        id: "ws_sweep_prod",
        name: "SWEEP ACADEMY",
        ownerName: "Mina Ogbanga",
        ownerEmail: "ogbangadigitalprojects@gmail.com",
      };
      await kvAdapter.hset(NS.workspace, updated.id, updated);
      await kvAdapter.set(`${NS.workspaceByEmail}:ogbangadigitalprojects@gmail.com`, updated.id);
      await kvAdapter.set(`${NS.workspaceByEmail}:sweep@pln.ng`, updated.id);
      return updated;
    }

    // Explicit routing for Parakletus Internship Program (Evander Ikechukwu)
    if (
      data.id === BUSI_WORKSPACE.id ||
      email === "parakletus70@gmail.com" ||
      email === "internship@parakletus.com" ||
      email.includes("parakletus") ||
      email.includes("ikechukwu") ||
      email.includes("evander")
    ) {
      const current = await this.getWorkspace(BUSI_WORKSPACE.id);
      const updated: StoredWorkspace = {
        ...BUSI_WORKSPACE,
        ...(current || {}),
        id: BUSI_WORKSPACE.id,
        name: "Parakletus Internship Program",
        ownerName: "Evander Ikechukwu",
        ownerEmail: "parakletus70@gmail.com",
        password: "60647065PiP",
      };
      await kvAdapter.hset(NS.workspace, updated.id, updated);
      await kvAdapter.set(`${NS.workspaceByEmail}:parakletus70@gmail.com`, updated.id);
      await kvAdapter.set(`${NS.workspaceByEmail}:internship@parakletus.com`, updated.id);
      return updated;
    }

    const existing = data.id
      ? await this.getWorkspace(data.id)
      : await this.findWorkspaceByEmail(email);
    const id =
      data.id ||
      existing?.id ||
      `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const workspace: StoredWorkspace = {
      id,
      name:
        data.name ||
        existing?.name ||
        `${email.split("@")[0].toUpperCase()} Exam Hall`,
      type: data.type || existing?.type || "STANDALONE_HALL",
      ownerName:
        data.ownerName || existing?.ownerName || email.split("@")[0],
      ownerEmail: email,
      credits: data.credits ?? existing?.credits ?? 50,
      apiKey:
        data.apiKey ||
        existing?.apiKey ||
        `pln_live_sk_${Math.random().toString(36).substring(2)}${Math.random()
          .toString(36)
          .substring(2)}`,
      webhookUrl: data.webhookUrl || existing?.webhookUrl,
      webhookSecret:
        data.webhookSecret ||
        existing?.webhookSecret ||
        `pln_whsec_${Math.random().toString(36).substring(2)}${Math.random()
          .toString(36)
          .substring(2)}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await kvAdapter.hset(NS.workspace, id, workspace);
    await kvAdapter.set(`${NS.workspaceByEmail}:${email}`, id);
    if (workspace.apiKey) {
      await kvAdapter.set(`${NS.workspaceByApiKey}:${workspace.apiKey}`, id);
    }
    return workspace;
  },

  // ── Exams ───────────────────────────────────────────────────────────────
  async listExams(workspaceId?: string): Promise<StoredExam[]> {
    await ensureDefaultWorkspacesAndExams();
    const rawAll = await kvAdapter.hlist<StoredExam>(NS.exam);
    const all = rawAll.filter(
      (e): e is StoredExam =>
        typeof e === "object" && e !== null && typeof (e as any).title === "string"
    );

    if (!workspaceId) {
      const busiPresent = all.some((e) => e.accessCode?.trim().toUpperCase() === "BUSI-7642");
      return busiPresent ? all : [BUSI_EXAM, ...all];
    }

    const cleanWs = workspaceId.trim().toLowerCase();

    // 1. SWEEP ACADEMY: Mina Ogbanga (ogbangadigitalprojects@gmail.com)
    // Strictly isolate: NEVER return BUSI-7642, never return exams belonging to Parakletus
    if (
      cleanWs === "ws_sweep_prod" ||
      cleanWs === "sweep" ||
      cleanWs.includes("sweep") ||
      cleanWs === "ogbangadigitalprojects@gmail.com" ||
      cleanWs.includes("ogbanga")
    ) {
      return all.filter(
        (e) =>
          (e.workspaceId === "ws_sweep_prod" || e.workspaceId?.toLowerCase().includes("sweep")) &&
          e.accessCode?.trim().toUpperCase() !== "BUSI-7642" &&
          e.id !== BUSI_EXAM.id &&
          e.workspaceId !== BUSI_WORKSPACE.id &&
          !e.workspaceId?.toLowerCase().includes("internship") &&
          !e.workspaceId?.toLowerCase().includes("parakletus")
      );
    }

    // 2. Parakletus Internship Program: Evander Ikechukwu (parakletus70@gmail.com)
    // Strictly isolate: Must include BUSI-7642, never return SWEEP exams
    if (
      cleanWs === BUSI_WORKSPACE.id ||
      cleanWs.includes("internship") ||
      cleanWs.includes("parakletus") ||
      cleanWs === "parakletus70@gmail.com" ||
      cleanWs.includes("ikechukwu") ||
      cleanWs.includes("evander")
    ) {
      const parakletusExams = all.filter(
        (e) =>
          (e.workspaceId === BUSI_WORKSPACE.id ||
            e.workspaceId?.toLowerCase().includes("internship") ||
            e.workspaceId?.toLowerCase().includes("parakletus") ||
            e.accessCode?.trim().toUpperCase() === "BUSI-7642" ||
            e.id === BUSI_EXAM.id) &&
          e.workspaceId !== "ws_sweep_prod" &&
          !e.workspaceId?.toLowerCase().includes("sweep")
      );
      const hasBusi = parakletusExams.some((e) => e.accessCode?.trim().toUpperCase() === "BUSI-7642");
      return hasBusi ? parakletusExams : [BUSI_EXAM, ...parakletusExams];
    }

    // 3. Default workspace
    if (cleanWs === "default") {
      const busiPresent = all.some((e) => e.accessCode?.trim().toUpperCase() === "BUSI-7642");
      return busiPresent ? all : [BUSI_EXAM, ...all];
    }

    // 4. Any other custom hall
    return all.filter((e) => e.workspaceId === workspaceId || e.workspaceId?.toLowerCase() === cleanWs);
  },

  async getExamById(id: string): Promise<StoredExam | null> {
    await ensureDefaultWorkspacesAndExams();
    if (id === BUSI_EXAM.id || id === "exam_busi_7642") return BUSI_EXAM;
    const direct = await kvAdapter.hget<StoredExam>(NS.exam, id);
    if (direct) return direct;
    if (id.toUpperCase().includes("BUSI")) return BUSI_EXAM;
    return null;
  },

  async getExamByCode(code: string): Promise<StoredExam | null> {
    if (!code || typeof code !== "string") return null;
    await ensureDefaultWorkspacesAndExams();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode === "BUSI-7642" || cleanCode === BUSI_EXAM.accessCode) {
      return BUSI_EXAM;
    }
    const examId = await kvAdapter.get<string>(
      `${NS.examByCode}:${cleanCode}`
    );
    if (examId) {
      const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
      if (exam) return exam;
    }
    // fallback full scan (handles exams created before index existed)
    const all = await kvAdapter.hlist<StoredExam>(NS.exam);
    const exam =
      all.find(
        (e) => e.accessCode?.trim().toUpperCase() === cleanCode
      ) || null;
    // backfill index
    if (exam) {
      await kvAdapter.set(`${NS.examByCode}:${cleanCode}`, exam.id);
    }
    return exam;
  },

  async upsertExam(
    data: Partial<StoredExam> & { title: string }
  ): Promise<StoredExam> {
    const id =
      data.id ||
      `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existing = await kvAdapter.hget<StoredExam>(NS.exam, id);
    const accessCode =
      data.accessCode?.trim().toUpperCase() ||
      existing?.accessCode ||
      `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;

    const exam: StoredExam = {
      id,
      workspaceId: data.workspaceId || existing?.workspaceId || "default",
      title: data.title,
      accessCode,
      durationMins:
        Number(data.durationMins) || existing?.durationMins || 60,
      totalMarks: data.totalMarks ?? existing?.totalMarks ?? 0,
      totalQuestions:
        data.totalQuestions ??
        existing?.totalQuestions ??
        existing?.questionIds?.length ??
        0,
      isPublished: data.isPublished ?? existing?.isPublished ?? true,
      startsAt: data.startsAt ?? existing?.startsAt ?? null,
      endsAt: data.endsAt ?? existing?.endsAt ?? null,
      maxTabViolations:
        Number(data.maxTabViolations) || existing?.maxTabViolations || 3,
      shuffleQuestions:
        data.shuffleQuestions ?? existing?.shuffleQuestions ?? true,
      shuffleChoices: data.shuffleChoices ?? existing?.shuffleChoices ?? true,
      showResultAfter:
        data.showResultAfter ?? existing?.showResultAfter ?? true,
      questionIds: data.questionIds || existing?.questionIds || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    await kvAdapter.hset(NS.exam, id, exam);
    // Write code → id index so lookups are O(1) and cross-instance
    await kvAdapter.set(`${NS.examByCode}:${exam.accessCode}`, id);
    return exam;
  },

  async attachQuestionsToExam(
    examId: string,
    questionIds: string[]
  ): Promise<StoredExam | null> {
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
    if (!exam) return null;
    exam.questionIds = questionIds;
    exam.totalQuestions = questionIds.length;
    let totalMarks = 0;
    for (const qId of questionIds) {
      const q = await kvAdapter.hget<StoredQuestion>(NS.question, qId);
      if (q) totalMarks += q.marks || 1;
    }
    exam.totalMarks = totalMarks;
    await kvAdapter.hset(NS.exam, examId, exam);
    return exam;
  },

  // ── Questions ───────────────────────────────────────────────────────────
  async getQuestion(id: string): Promise<StoredQuestion | null> {
    return kvAdapter.hget<StoredQuestion>(NS.question, id);
  },

  async getQuestionsForExam(examId: string): Promise<StoredQuestion[]> {
    await ensureDefaultWorkspacesAndExams();
    if (examId === BUSI_EXAM.id || examId === "exam_busi_7642" || examId?.trim().toUpperCase() === "BUSI-7642") {
      return BUSI_QUESTIONS;
    }
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
    if (!exam || !exam.questionIds) return [];
    const questions = await Promise.all(
      exam.questionIds.map((id) =>
        kvAdapter.hget<StoredQuestion>(NS.question, id)
      )
    );
    const filtered = questions.filter((q): q is StoredQuestion => q !== null);
    if (filtered.length > 0) return filtered;
    return [];
  },

  async upsertQuestion(
    data: Partial<StoredQuestion> & { prompt: string }
  ): Promise<StoredQuestion> {
    const id =
      data.id ||
      `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const existing = await kvAdapter.hget<StoredQuestion>(NS.question, id);
    const question: StoredQuestion = {
      id,
      workspaceId: data.workspaceId || existing?.workspaceId || "default",
      prompt: data.prompt,
      type: data.type || existing?.type || "MCQ",
      marks: Number(data.marks) || existing?.marks || 1,
      section: data.section || existing?.section,
      options: data.options || existing?.options || [],
      explanation: data.explanation || existing?.explanation || "",
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    await kvAdapter.hset(NS.question, id, question);
    return question;
  },

  async bulkUpsertQuestions(
    workspaceId: string,
    questions: Array<Partial<StoredQuestion> & { prompt: string }>
  ): Promise<StoredQuestion[]> {
    const results: StoredQuestion[] = [];
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const id =
        q.id ||
        `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
      const item: StoredQuestion = {
        id,
        workspaceId,
        prompt: q.prompt,
        type: q.type || "MCQ",
        marks: Number(q.marks) || 1,
        section: q.section,
        options: q.options || [],
        explanation: q.explanation || "",
        createdAt: new Date().toISOString(),
      };
      await kvAdapter.hset(NS.question, id, item);
      results.push(item);
    }
    return results;
  },

  // ── Candidate Provisioning ──────────────────────────────────────────────
  async provisionCandidate(data: {
    examId: string;
    candidateName: string;
    candidatePin?: string;
    studentId?: string | null;
    externalAttemptId?: string | null;
    email?: string | null;
    phone?: string | null;
    metadata?: Record<string, any> | null;
    baseUrl?: string;
  }): Promise<StoredCandidate & { launchUrl: string; accessCode: string }> {
    const exam =
      (await kvAdapter.hget<StoredExam>(NS.exam, data.examId)) ||
      (await this.getExamByCode(data.examId));
    if (!exam) throw new Error(`Exam ${data.examId} not found.`);

    let pin = data.candidatePin?.trim().toUpperCase();
    if (!pin) {
      const allCands = await kvAdapter.hlist<StoredCandidate>(NS.candidate);
      const examCands = allCands.filter((c) => c.examId === exam.id);
      let attempts = 0;
      do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
        attempts++;
      } while (
        attempts < 100 &&
        examCands.some((c) => c.candidatePin === pin)
      );
    }

    const allCands = await kvAdapter.hlist<StoredCandidate>(NS.candidate);
    const existing = allCands.find(
      (c) =>
        c.examId === exam.id &&
        (c.candidatePin === pin ||
          (data.studentId && c.studentId === data.studentId))
    );

    const candId =
      existing?.id ||
      `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const candidate: StoredCandidate = {
      id: candId,
      examId: exam.id,
      candidateName: data.candidateName.trim(),
      candidatePin: pin!,
      studentId: data.studentId || existing?.studentId || null,
      externalAttemptId:
        data.externalAttemptId || existing?.externalAttemptId || null,
      email: data.email || existing?.email || null,
      phone: data.phone || existing?.phone || null,
      status: existing?.status || "REGISTERED",
      metadata: data.metadata || existing?.metadata || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    await kvAdapter.hset(NS.candidate, candId, candidate);

    const domain = (data.baseUrl || "https://pln.ng").replace(/\/+$/, "");
    const search = new URLSearchParams();
    search.set("pin", candidate.candidatePin);
    search.set("name", candidate.candidateName);
    if (candidate.studentId) search.set("studentId", candidate.studentId);
    if (candidate.externalAttemptId)
      search.set("attemptId", candidate.externalAttemptId);

    const launchUrl = `${domain}/take/${exam.accessCode}?${search.toString()}`;
    return { ...candidate, accessCode: exam.accessCode, launchUrl };
  },

  async bulkProvisionCandidates(
    examId: string,
    candidates: Array<{
      candidateName: string;
      candidatePin?: string;
      studentId?: string | null;
      externalAttemptId?: string | null;
      email?: string | null;
      phone?: string | null;
      metadata?: Record<string, any> | null;
    }>,
    baseUrl?: string
  ): Promise<Array<StoredCandidate & { launchUrl: string; accessCode: string }>> {
    const results = [];
    for (const cand of candidates) {
      results.push(
        await this.provisionCandidate({
          examId,
          candidateName: cand.candidateName,
          candidatePin: cand.candidatePin,
          studentId: cand.studentId,
          externalAttemptId: cand.externalAttemptId,
          email: cand.email,
          phone: cand.phone,
          metadata: cand.metadata,
          baseUrl,
        })
      );
    }
    return results;
  },

  // ── Attempts ────────────────────────────────────────────────────────────
  async startAttempt(payload: {
    accessCode: string;
    candidateName: string;
    candidatePin?: string;
    email?: string;
    phone?: string;
    studentId?: string;
    externalAttemptId?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    attempt: StoredAttempt;
    exam: StoredExam;
    questions: StoredQuestion[];
    isResumed: boolean;
  } | null> {
    const exam = await this.getExamByCode(payload.accessCode);
    if (!exam) return null;

    const pin =
      payload.candidatePin?.trim().toUpperCase() ||
      Math.floor(100000 + Math.random() * 900000).toString();

    const allCands = await kvAdapter.hlist<StoredCandidate>(NS.candidate);
    const preRegistered = allCands.find(
      (c) =>
        c.examId === exam.id &&
        (c.candidatePin === pin ||
          (payload.studentId && c.studentId === payload.studentId))
    );

    const resolvedStudentId =
      payload.studentId || preRegistered?.studentId || null;
    const resolvedExternalAttemptId =
      payload.externalAttemptId || preRegistered?.externalAttemptId || null;

    // Check for resumable attempt
    const allAttempts = await kvAdapter.hlist<StoredAttempt>(NS.attempt);
    for (const att of allAttempts) {
      const matchByPin = att.examId === exam.id && att.candidatePin === pin;
      const matchByExternalId = Boolean(
        resolvedExternalAttemptId &&
          att.externalAttemptId === resolvedExternalAttemptId
      );
      if ((matchByPin || matchByExternalId) && att.status === "in_progress") {
        const questions = await this.getQuestionsForExam(exam.id);
        return { attempt: att, exam, questions, isResumed: true };
      }
    }

    const durationMins = exam.durationMins || 60;
    const now = new Date();
    const deadline = new Date(
      now.getTime() + durationMins * 60 * 1000
    ).toISOString();
    const attemptId = `att_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    const attempt: StoredAttempt = {
      id: attemptId,
      examId: exam.id,
      examCode: exam.accessCode,
      candidateName: payload.candidateName,
      candidatePin: pin,
      email: payload.email || preRegistered?.email || undefined,
      phone: payload.phone || preRegistered?.phone || undefined,
      studentId: resolvedStudentId || undefined,
      externalAttemptId: resolvedExternalAttemptId || undefined,
      startedAt: now.toISOString(),
      deadline,
      durationMins,
      remainingSeconds: durationMins * 60,
      answers: {},
      violations: 0,
      status: "in_progress",
      metadata: payload.metadata || preRegistered?.metadata || {},
    };

    await kvAdapter.hset(NS.attempt, attemptId, attempt);

    if (preRegistered) {
      preRegistered.status = "STARTED";
      if (resolvedExternalAttemptId && !preRegistered.externalAttemptId) {
        preRegistered.externalAttemptId = resolvedExternalAttemptId;
      }
      await kvAdapter.hset(NS.candidate, preRegistered.id, preRegistered);
    } else {
      const candId = `cand_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 5)}`;
      const newCand: StoredCandidate = {
        id: candId,
        examId: exam.id,
        candidateName: payload.candidateName,
        candidatePin: pin,
        email: payload.email,
        phone: payload.phone,
        studentId: resolvedStudentId,
        externalAttemptId: resolvedExternalAttemptId,
        status: "STARTED",
        metadata: payload.metadata || null,
        createdAt: now.toISOString(),
      };
      await kvAdapter.hset(NS.candidate, candId, newCand);
    }

    const questions = await this.getQuestionsForExam(exam.id);
    return { attempt, exam, questions, isResumed: false };
  },

  async bufferAnswer(
    attemptId: string,
    questionId: string,
    selectedVal: any
  ): Promise<boolean> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return false;
    att.answers[questionId] = selectedVal;
    await kvAdapter.hset(NS.attempt, attemptId, att);
    return true;
  },

  async recordTelemetry(
    attemptId: string,
    eventType: string
  ): Promise<{ violations: number; disqualified: boolean }> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return { violations: 0, disqualified: false };
    att.violations = (att.violations || 0) + 1;
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, att.examId);
    const maxViolations = exam?.maxTabViolations ?? 3;
    const disqualified = att.violations >= maxViolations;
    if (disqualified) att.status = "disqualified";
    await kvAdapter.hset(NS.attempt, attemptId, att);
    return { violations: att.violations, disqualified };
  },

  async submitAttempt(
    attemptId: string,
    finalAnswers?: Record<string, any>
  ): Promise<{
    attempt: StoredAttempt;
    webhookPayload: any;
    webhookUrl?: string;
    webhookSecret?: string;
  } | null> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return null;
    if (finalAnswers) att.answers = { ...att.answers, ...finalAnswers };
    att.status = "submitted";
    att.submittedAt = new Date().toISOString();

    const exam = await kvAdapter.hget<StoredExam>(NS.exam, att.examId);
    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;

    if (exam?.questionIds) {
      for (const qId of exam.questionIds) {
        const q = await kvAdapter.hget<StoredQuestion>(NS.question, qId);
        if (q) {
          totalMarks += q.marks || 1;
          if (q.type === "MCQ" || q.type === "TRUE_FALSE") {
            const userChoice = att.answers[q.id];
            const correctOpt = q.options?.find((o) => o.isCorrect);
            if (userChoice && correctOpt && userChoice === correctOpt.id) {
              score += q.marks || 1;
              correctCount++;
            } else {
              wrongCount++;
            }
          }
        }
      }
    }

    att.score = score;
    att.totalMarks = totalMarks > 0 ? totalMarks : 1;
    att.percentage = Math.round((score / att.totalMarks) * 100);
    att.grade = computeWaecGrade(att.percentage);
    await kvAdapter.hset(NS.attempt, attemptId, att);

    // Update candidate status
    const allCands = await kvAdapter.hlist<StoredCandidate>(NS.candidate);
    const cand = allCands.find(
      (c) =>
        c.examId === att.examId &&
        (c.candidatePin === att.candidatePin ||
          (att.studentId && c.studentId === att.studentId))
    );
    if (cand) {
      cand.status = "SUBMITTED";
      cand.score = att.score;
      cand.totalMarks = att.totalMarks;
      cand.percentage = att.percentage;
      await kvAdapter.hset(NS.candidate, cand.id, cand);
    }

    const ws = exam
      ? await kvAdapter.hget<StoredWorkspace>(NS.workspace, exam.workspaceId)
      : null;
    const eventId = `evt_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const webhookPayload = {
      event: "exam.attempt.completed",
      eventId,
      timestamp: new Date().toISOString(),
      workspaceId: exam?.workspaceId || "default",
      examId: att.examId,
      examCode: att.examCode,
      attemptId: att.id,
      externalAttemptId: att.externalAttemptId || null,
      studentId: att.studentId || null,
      candidateName: att.candidateName,
      candidatePin: att.candidatePin,
      email: att.email || null,
      status: "SUBMITTED",
      score: att.score,
      totalMarks: att.totalMarks,
      percentage: att.percentage,
      grade: att.grade,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      resultSlip: {
        durationMins: att.durationMins,
        violations: att.violations,
        breakdown: {
          totalQuestions:
            exam?.totalQuestions || exam?.questionIds?.length || 0,
          correctCount,
          wrongCount,
          mcqScore: att.score,
          essayScore: 0.0,
        },
      },
      metadata: {
        ...att.metadata,
        sweepLearnerId: att.studentId || null,
        sweepAttemptId: att.externalAttemptId || null,
      },
    };

    return {
      attempt: att,
      webhookPayload,
      webhookUrl: ws?.webhookUrl,
      webhookSecret: ws?.webhookSecret,
    };
  },

  async getAttempt(attemptId: string): Promise<StoredAttempt | null> {
    if (!attemptId) return null;
    const direct = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (direct) return direct;
    // fallback: scan by externalAttemptId
    const all = await kvAdapter.hlist<StoredAttempt>(NS.attempt);
    return (
      all.find(
        (a) =>
          a.id === attemptId ||
          (a.externalAttemptId && a.externalAttemptId === attemptId)
      ) || null
    );
  },

  async listCandidates(examId: string): Promise<StoredCandidate[]> {
    const all = await kvAdapter.hlist<StoredCandidate>(NS.candidate);
    return all.filter((c) => c.examId === examId);
  },
};
