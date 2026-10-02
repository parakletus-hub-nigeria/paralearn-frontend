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
  createdAt: string;
}

export interface StoredCandidate {
  id: string;
  examId: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "REGISTERED" | "STARTED" | "SUBMITTED" | "DISQUALIFIED";
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
  startedAt: string;
  deadline: string;
  durationMins: number;
  remainingSeconds: number;
  answers: Record<string, any>;
  violations: number;
  status: "in_progress" | "submitted" | "disqualified";
  score?: number;
  totalMarks?: number;
  percentage?: number;
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
      apiKey: data.apiKey || existing?.apiKey,
      webhookUrl: data.webhookUrl || existing?.webhookUrl,
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

  // ── Attempts & Candidates ────────────────────────────────────────────────
  startAttempt(payload: {
    accessCode: string;
    candidateName: string;
    candidatePin?: string;
    email?: string;
    phone?: string;
    studentId?: string;
  }): { attempt: StoredAttempt; exam: StoredExam; questions: StoredQuestion[]; isResumed: boolean } | null {
    const db = initDatabase();
    const exam = this.getExamByCode(payload.accessCode);
    if (!exam) return null;

    const pin = payload.candidatePin?.trim() || Math.floor(100000 + Math.random() * 900000).toString();

    // Check for existing attempt with same exam & pin
    for (const att of Object.values(db.attempts)) {
      if (att.examId === exam.id && att.candidatePin === pin && att.status === "in_progress") {
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
      email: payload.email,
      phone: payload.phone,
      studentId: payload.studentId,
      startedAt: now.toISOString(),
      deadline,
      durationMins,
      remainingSeconds: durationMins * 60,
      answers: {},
      violations: 0,
      status: "in_progress",
    };

    db.attempts[attemptId] = attempt;

    // Track candidate in roster
    const candId = `cand_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    db.candidates[candId] = {
      id: candId,
      examId: exam.id,
      candidateName: payload.candidateName,
      candidatePin: pin,
      email: payload.email,
      phone: payload.phone,
      studentId: payload.studentId,
      status: "STARTED",
      createdAt: now.toISOString(),
    };

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

  submitAttempt(attemptId: string, finalAnswers?: Record<string, any>): StoredAttempt | null {
    const db = initDatabase();
    const att = db.attempts[attemptId];
    if (!att) return null;
    if (finalAnswers) {
      att.answers = { ...att.answers, ...finalAnswers };
    }
    att.status = "submitted";

    // Auto-score MCQs
    const exam = db.exams[att.examId];
    let score = 0;
    let totalMarks = 0;

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
            }
          }
        }
      });
    }

    att.score = score;
    att.totalMarks = totalMarks > 0 ? totalMarks : 1;
    att.percentage = Math.round((score / att.totalMarks) * 100);

    persistDatabase();
    return att;
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
