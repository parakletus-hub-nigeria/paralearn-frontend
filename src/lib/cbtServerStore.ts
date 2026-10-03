import fs from "fs";
import path from "path";

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

interface CbtDatabase {
  workspaces: Record<string, StoredWorkspace>;
  exams: Record<string, StoredExam>;
  questions: Record<string, StoredQuestion>;
  candidates: Record<string, StoredCandidate>;
  attempts: Record<string, StoredAttempt>;
}

// Global in-memory cache
const globalForCbt = globalThis as unknown as {
  __cbtDatabase?: CbtDatabase;
};

const getStoreFilePath = (): string => {
  if (process.env.CBT_STORE_PATH) {
    return process.env.CBT_STORE_PATH;
  }
  try {
    const cwdFile = path.join(process.cwd(), ".cbt-store.json");
    // Test write
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return cwdFile;
  } catch {
    return path.join("/tmp", "paralearn-cbt-store.json");
  }
};

const initDatabase = (): CbtDatabase => {
  if (globalForCbt.__cbtDatabase) {
    return globalForCbt.__cbtDatabase;
  }

  const defaultDb: CbtDatabase = {
    workspaces: {
      default: {
        id: "default",
        name: "ParaLearn Assessment Center",
        type: "STANDALONE_HALL",
        ownerName: "ParaLearn Admin",
        ownerEmail: "admin@pln.ng",
        credits: 9999,
        createdAt: new Date().toISOString(),
      },
    },
    exams: {},
    questions: {},
    candidates: {},
    attempts: {},
  };

  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      if (raw) {
        const parsed = JSON.parse(raw);
        globalForCbt.__cbtDatabase = {
          workspaces: { ...defaultDb.workspaces, ...(parsed.workspaces || {}) },
          exams: parsed.exams || {},
          questions: parsed.questions || {},
          candidates: parsed.candidates || {},
          attempts: parsed.attempts || {},
        };
        return globalForCbt.__cbtDatabase;
      }
    }
  } catch (err) {
    console.warn("[CBT Store] Could not read disk store, using memory store:", err);
  }

  globalForCbt.__cbtDatabase = defaultDb;
  return defaultDb;
};

const persistDatabase = () => {
  if (!globalForCbt.__cbtDatabase) return;
  try {
    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(globalForCbt.__cbtDatabase, null, 2), "utf-8");
  } catch (err) {
    // If running in read-only environment like Vercel serverless, in-memory cache serves requests
  }
};

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

export const cbtServerStore = {
  // ── Workspaces ──────────────────────────────────────────────────────────
  getWorkspace(id: string): StoredWorkspace | null {
    const db = initDatabase();
    return db.workspaces[id] || null;
  },

  findWorkspaceByEmail(email: string): StoredWorkspace | null {
    const db = initDatabase();
    const cleanEmail = email.trim().toLowerCase();
    for (const ws of Object.values(db.workspaces)) {
      if (ws.ownerEmail?.toLowerCase() === cleanEmail) {
        return ws;
      }
    }
    return null;
  },

  upsertWorkspace(data: Partial<StoredWorkspace> & { ownerEmail: string }): StoredWorkspace {
    const db = initDatabase();
    const existing = this.findWorkspaceByEmail(data.ownerEmail);
    const id = data.id || existing?.id || `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const workspace: StoredWorkspace = {
      id,
      name: data.name || existing?.name || `${data.ownerEmail.split("@")[0].toUpperCase()} Exam Hall`,
      type: data.type || existing?.type || "STANDALONE_HALL",
      ownerName: data.ownerName || existing?.ownerName || data.ownerEmail.split("@")[0],
      ownerEmail: data.ownerEmail.trim().toLowerCase(),
      credits: data.credits ?? existing?.credits ?? 50,
      apiKey:
        data.apiKey ||
        existing?.apiKey ||
        `pln_live_sk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      webhookUrl: data.webhookUrl || existing?.webhookUrl,
      webhookSecret:
        data.webhookSecret ||
        existing?.webhookSecret ||
        `pln_whsec_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    db.workspaces[id] = workspace;
    persistDatabase();
    return workspace;
  },

  // ── Exams ───────────────────────────────────────────────────────────────
  listExams(workspaceId?: string): StoredExam[] {
    const db = initDatabase();
    const all = Object.values(db.exams);
    if (!workspaceId) return all;
    return all.filter((e) => e.workspaceId === workspaceId || workspaceId === "default");
  },

  getExamById(id: string): StoredExam | null {
    const db = initDatabase();
    return db.exams[id] || null;
  },

  getExamByCode(code: string): StoredExam | null {
    const db = initDatabase();
    const cleanCode = code.trim().toUpperCase();
    for (const exam of Object.values(db.exams)) {
      if (exam.accessCode?.trim().toUpperCase() === cleanCode) {
        return exam;
      }
    }
    return null;
  },

  upsertExam(data: Partial<StoredExam> & { title: string }): StoredExam {
    const db = initDatabase();
    const id = data.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existing = db.exams[id];
    const accessCode =
      data.accessCode?.trim().toUpperCase() ||
      existing?.accessCode ||
      `EXAM-${Math.floor(1000 + Math.random() * 9000)}`;

    const exam: StoredExam = {
      id,
      workspaceId: data.workspaceId || existing?.workspaceId || "default",
      title: data.title,
      accessCode,
      durationMins: Number(data.durationMins) || existing?.durationMins || 60,
      totalMarks: data.totalMarks ?? existing?.totalMarks ?? 0,
      totalQuestions: data.totalQuestions ?? existing?.totalQuestions ?? (existing?.questionIds?.length || 0),
      isPublished: data.isPublished ?? existing?.isPublished ?? true,
      startsAt: data.startsAt ?? existing?.startsAt ?? null,
      endsAt: data.endsAt ?? existing?.endsAt ?? null,
      maxTabViolations: Number(data.maxTabViolations) || existing?.maxTabViolations || 3,
      shuffleQuestions: data.shuffleQuestions ?? existing?.shuffleQuestions ?? true,
      shuffleChoices: data.shuffleChoices ?? existing?.shuffleChoices ?? true,
      showResultAfter: data.showResultAfter ?? existing?.showResultAfter ?? true,
      questionIds: data.questionIds || existing?.questionIds || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    db.exams[id] = exam;
    persistDatabase();
    return exam;
  },

  attachQuestionsToExam(examId: string, questionIds: string[]): StoredExam | null {
    const db = initDatabase();
    const exam = db.exams[examId];
    if (!exam) return null;
    exam.questionIds = questionIds;
    exam.totalQuestions = questionIds.length;
    let totalMarks = 0;
    questionIds.forEach((qId) => {
      const q = db.questions[qId];
      if (q) totalMarks += q.marks || 1;
    });
    exam.totalMarks = totalMarks;
    persistDatabase();
    return exam;
  },

  // ── Questions ───────────────────────────────────────────────────────────
  getQuestion(id: string): StoredQuestion | null {
    const db = initDatabase();
    return db.questions[id] || null;
  },

  getQuestionsForExam(examId: string): StoredQuestion[] {
    const db = initDatabase();
    const exam = db.exams[examId];
    if (!exam || !exam.questionIds) return [];
    return exam.questionIds.map((id) => db.questions[id]).filter(Boolean);
  },

  upsertQuestion(data: Partial<StoredQuestion> & { prompt: string }): StoredQuestion {
    const db = initDatabase();
    const id = data.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const existing = db.questions[id];

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

    db.questions[id] = question;
    persistDatabase();
    return question;
  },

  bulkUpsertQuestions(workspaceId: string, questions: Array<Partial<StoredQuestion> & { prompt: string }>): StoredQuestion[] {
    const db = initDatabase();
    const results: StoredQuestion[] = [];
    questions.forEach((q, idx) => {
      const id = q.id || `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
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
      db.questions[id] = item;
      results.push(item);
    });
    persistDatabase();
    return results;
  },

  // ── Candidate Provisioning ──────────────────────────────────────────────
  provisionCandidate(data: {
    examId: string;
    candidateName: string;
    candidatePin?: string;
    studentId?: string | null;
    externalAttemptId?: string | null;
    email?: string | null;
    phone?: string | null;
    metadata?: Record<string, any> | null;
    baseUrl?: string;
  }): StoredCandidate & { launchUrl: string; accessCode: string } {
    const db = initDatabase();
    const exam = db.exams[data.examId] || Object.values(db.exams).find((e) => e.accessCode === data.examId);
    if (!exam) {
      throw new Error(`Exam ${data.examId} not found.`);
    }

    let pin = data.candidatePin?.trim().toUpperCase();
    if (!pin) {
      let attempts = 0;
      do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
        attempts++;
      } while (
        attempts < 100 &&
        Object.values(db.candidates).some((c) => c.examId === exam.id && c.candidatePin === pin)
      );
    }

    const existing = Object.values(db.candidates).find(
      (c) => c.examId === exam.id && (c.candidatePin === pin || (data.studentId && c.studentId === data.studentId))
    );

    const candId = existing?.id || `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const candidate: StoredCandidate = {
      id: candId,
      examId: exam.id,
      candidateName: data.candidateName.trim(),
      candidatePin: pin,
      studentId: data.studentId || existing?.studentId || null,
      externalAttemptId: data.externalAttemptId || existing?.externalAttemptId || null,
      email: data.email || existing?.email || null,
      phone: data.phone || existing?.phone || null,
      status: existing?.status || "REGISTERED",
      metadata: data.metadata || existing?.metadata || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    db.candidates[candId] = candidate;
    persistDatabase();

    const domain = (data.baseUrl || "https://pln.ng").replace(/\/+$/, "");
    const search = new URLSearchParams();
    search.set("pin", candidate.candidatePin);
    search.set("name", candidate.candidateName);
    if (candidate.studentId) search.set("studentId", candidate.studentId);
    if (candidate.externalAttemptId) search.set("attemptId", candidate.externalAttemptId);

    const launchUrl = `${domain}/take/${exam.accessCode}?${search.toString()}`;
    return { ...candidate, accessCode: exam.accessCode, launchUrl };
  },

  bulkProvisionCandidates(
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
  ): Array<StoredCandidate & { launchUrl: string; accessCode: string }> {
    return candidates.map((cand) =>
      this.provisionCandidate({
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
  },

  // ── Attempts & Candidates ────────────────────────────────────────────────
  startAttempt(payload: {
    accessCode: string;
    candidateName: string;
    candidatePin?: string;
    email?: string;
    phone?: string;
    studentId?: string;
    externalAttemptId?: string;
    metadata?: Record<string, any>;
  }): { attempt: StoredAttempt; exam: StoredExam; questions: StoredQuestion[]; isResumed: boolean } | null {
    const db = initDatabase();
    const exam = this.getExamByCode(payload.accessCode);
    if (!exam) return null;

    const pin = payload.candidatePin?.trim().toUpperCase() || Math.floor(100000 + Math.random() * 900000).toString();

    // Check pre-registered candidate
    const preRegistered = Object.values(db.candidates).find(
      (c) => c.examId === exam.id && (c.candidatePin === pin || (payload.studentId && c.studentId === payload.studentId))
    );

    const resolvedStudentId = payload.studentId || preRegistered?.studentId || null;
    const resolvedExternalAttemptId = payload.externalAttemptId || preRegistered?.externalAttemptId || null;

    // Check for existing attempt with same exam & pin or externalAttemptId
    for (const att of Object.values(db.attempts)) {
      const matchByPin = att.examId === exam.id && att.candidatePin === pin;
      const matchByExternalId = Boolean(resolvedExternalAttemptId && att.externalAttemptId === resolvedExternalAttemptId);
      if ((matchByPin || matchByExternalId) && att.status === "in_progress") {
        const questions = (exam.questionIds || []).map((id) => db.questions[id]).filter(Boolean);
        return { attempt: att, exam, questions, isResumed: true };
      }
    }

    const durationMins = exam.durationMins || 60;
    const now = new Date();
    const deadline = new Date(now.getTime() + durationMins * 60 * 1000).toISOString();

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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

    db.attempts[attemptId] = attempt;

    if (preRegistered) {
      preRegistered.status = "STARTED";
      if (resolvedExternalAttemptId && !preRegistered.externalAttemptId) {
        preRegistered.externalAttemptId = resolvedExternalAttemptId;
      }
    } else {
      const candId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
      db.candidates[candId] = {
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
    }

    persistDatabase();
    const questions = (exam.questionIds || []).map((id) => db.questions[id]).filter(Boolean);
    return { attempt, exam, questions, isResumed: false };
  },

  bufferAnswer(attemptId: string, questionId: string, selectedVal: any): boolean {
    const db = initDatabase();
    const att = db.attempts[attemptId];
    if (!att) return false;
    att.answers[questionId] = selectedVal;
    persistDatabase();
    return true;
  },

  recordTelemetry(attemptId: string, eventType: string): { violations: number; disqualified: boolean } {
    const db = initDatabase();
    const att = db.attempts[attemptId];
    if (!att) return { violations: 0, disqualified: false };
    att.violations = (att.violations || 0) + 1;
    const exam = db.exams[att.examId];
    const maxViolations = exam?.maxTabViolations ?? 3;
    const disqualified = att.violations >= maxViolations;
    if (disqualified) {
      att.status = "disqualified";
    }
    persistDatabase();
    return { violations: att.violations, disqualified };
  },

  submitAttempt(
    attemptId: string,
    finalAnswers?: Record<string, any>
  ): {
    attempt: StoredAttempt;
    webhookPayload: any;
    webhookUrl?: string;
    webhookSecret?: string;
  } | null {
    const db = initDatabase();
    const att = db.attempts[attemptId];
    if (!att) return null;
    if (finalAnswers) {
      att.answers = { ...att.answers, ...finalAnswers };
    }
    att.status = "submitted";
    att.submittedAt = new Date().toISOString();

    // Auto-score MCQs
    const exam = db.exams[att.examId];
    let score = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;

    if (exam && exam.questionIds) {
      exam.questionIds.forEach((qId) => {
        const q = db.questions[qId];
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
      });
    }

    att.score = score;
    att.totalMarks = totalMarks > 0 ? totalMarks : 1;
    att.percentage = Math.round((score / att.totalMarks) * 100);
    att.grade = computeWaecGrade(att.percentage);

    // Update candidate in roster
    const cand = Object.values(db.candidates).find(
      (c) =>
        c.examId === att.examId &&
        (c.candidatePin === att.candidatePin || (att.studentId && c.studentId === att.studentId))
    );
    if (cand) {
      cand.status = "SUBMITTED";
      cand.score = att.score;
      cand.totalMarks = att.totalMarks;
      cand.percentage = att.percentage;
    }

    persistDatabase();

    const ws = exam ? db.workspaces[exam.workspaceId] : null;
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const webhookPayload = {
      event: "exam.attempt.completed",
      eventId,
      timestamp,
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
          totalQuestions: exam?.totalQuestions || exam?.questionIds?.length || 0,
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

  getAttempt(attemptId: string): StoredAttempt | null {
    const db = initDatabase();
    return db.attempts[attemptId] || null;
  },

  listCandidates(examId: string): StoredCandidate[] {
    const db = initDatabase();
    return Object.values(db.candidates).filter((c) => c.examId === examId);
  },
};
