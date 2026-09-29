/**
 * CBT Session & Microservice API Client
 * Provides optimistic local storage, crash recovery, and offline resilience,
 * paired with direct asynchronous synchronization to the autonomous CBT Microservice.
 */

export interface CandidateSession {
  attemptId?: string;
  examId?: string;
  examCode: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string;
  startedAt: string;
  durationMins: number;
  deadline: string;
  answers: Record<string, string | string[]>;
  flaggedQuestionIds: string[];
  violations: Array<{
    type: string;
    timestamp: string;
    questionIdx: number;
  }>;
  status: "in_progress" | "submitted" | "disqualified";
  score?: number;
  totalMarks?: number;
  percentage?: number;
}

export interface ExaminerWorkspace {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  credits: number;
  apiKey?: string;
  webhookUrl?: string;
  createdAt?: string;
  _count?: {
    exams: number;
    questions: number;
  };
}

const STORAGE_PREFIX = "paralearn_cbt_session_";
export const CBT_API_BASE = process.env.NEXT_PUBLIC_CBT_API_URL || "http://localhost:4000";

// ── Examiner Session Management (Auto-SignIn & Auth Persistence) ────────────
export const saveExaminerSession = (workspace: ExaminerWorkspace): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("paralearn_cbt_standalone_workspace", JSON.stringify(workspace));
    localStorage.setItem("paralearn_cbt_user_type", "STANDALONE_TUTOR");
    localStorage.setItem("paralearn_cbt_examiner_email", workspace.ownerEmail);
  } catch (err) {
    console.error("[CBT Session] Failed to save examiner session:", err);
  }
};

export const getExaminerSession = (): ExaminerWorkspace | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("paralearn_cbt_standalone_workspace");
    if (!raw) return null;
    return JSON.parse(raw) as ExaminerWorkspace;
  } catch {
    return null;
  }
};

export const clearExaminerSession = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("paralearn_cbt_standalone_workspace");
    localStorage.removeItem("paralearn_cbt_user_type");
    localStorage.removeItem("paralearn_cbt_examiner_email");
  } catch (err) {
    console.error("[CBT Session] Failed to clear examiner session:", err);
  }
};

// ── Local Optimistic Cache & Offline Candidate Resilience ───────────────────
export const getSessionStorageKey = (examCode: string, pin: string = "default"): string => {
  return `${STORAGE_PREFIX}${examCode.trim().toUpperCase()}_${pin.trim()}`;
};

export const saveCandidateSession = (session: CandidateSession): void => {
  if (typeof window === "undefined") return;
  try {
    const key = getSessionStorageKey(session.examCode, session.candidatePin);
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem("paralearn_cbt_active_exam", session.examCode.trim().toUpperCase());
    localStorage.setItem("paralearn_cbt_active_pin", session.candidatePin.trim());
    if (session.attemptId) {
      localStorage.setItem("paralearn_cbt_active_attempt_id", session.attemptId);
    }
  } catch (err) {
    console.error("[CBT Session] Failed to save session locally:", err);
  }
};

export const loadCandidateSession = (examCode: string, pin?: string): CandidateSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const candidatePin = pin || localStorage.getItem("paralearn_cbt_active_pin") || "default";
    const key = getSessionStorageKey(examCode, candidatePin);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as CandidateSession;
  } catch (err) {
    console.error("[CBT Session] Failed to restore session:", err);
    return null;
  }
};

export const clearCandidateSession = (examCode: string, pin: string = "default"): void => {
  if (typeof window === "undefined") return;
  try {
    const key = getSessionStorageKey(examCode, pin);
    localStorage.removeItem(key);
    localStorage.removeItem("paralearn_cbt_active_exam");
    localStorage.removeItem("paralearn_cbt_active_pin");
    localStorage.removeItem("paralearn_cbt_active_attempt_id");
  } catch (err) {
    console.error("[CBT Session] Failed to clear session:", err);
  }
};

export const saveAnswerToSession = (
  examCode: string,
  pin: string,
  questionId: string,
  value: string | string[]
): CandidateSession | null => {
  const session = loadCandidateSession(examCode, pin);
  if (!session) return null;
  session.answers[questionId] = value;
  saveCandidateSession(session);

  // Background non-blocking sync to Redis buffer if attemptId is present
  if (session.attemptId) {
    cbtApi.bufferAnswer(session.attemptId, questionId, value).catch(() => {});
  }

  return session;
};

export const toggleQuestionFlag = (
  examCode: string,
  pin: string,
  questionId: string
): { isFlagged: boolean; session: CandidateSession | null } => {
  const session = loadCandidateSession(examCode, pin);
  if (!session) return { isFlagged: false, session: null };

  const index = session.flaggedQuestionIds.indexOf(questionId);
  let isFlagged = false;
  if (index >= 0) {
    session.flaggedQuestionIds.splice(index, 1);
    isFlagged = false;
  } else {
    session.flaggedQuestionIds.push(questionId);
    isFlagged = true;
  }
  saveCandidateSession(session);
  return { isFlagged, session };
};

export const recordProctoringViolation = (
  examCode: string,
  pin: string,
  violationType: "tab_switch" | "window_blur" | "fullscreen_exit",
  questionIdx: number
): { violationCount: number; session: CandidateSession | null } => {
  const session = loadCandidateSession(examCode, pin);
  if (!session) return { violationCount: 0, session: null };

  session.violations.push({
    type: violationType,
    timestamp: new Date().toISOString(),
    questionIdx,
  });
  saveCandidateSession(session);

  // Background sync violation telemetry to backend proctoring engine
  if (session.attemptId) {
    cbtApi.recordTelemetry(session.attemptId, violationType, questionIdx).then((res) => {
      if (res && res.disqualified) {
        session.status = "disqualified";
        saveCandidateSession(session);
      }
    }).catch(() => {});
  }

  return { violationCount: session.violations.length, session };
};

// ── Microservice HTTP API Client ───────────────────────────────────────────
export const cbtApi = {
  /**
   * Examiner sign in — automatically saves session in client storage
   */
  async examinerLogin(email: string, password?: string): Promise<ExaminerWorkspace> {
    try {
      const res = await fetch(`${CBT_API_BASE}/workspaces/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const workspace = await res.json();
        saveExaminerSession(workspace);
        return workspace;
      }
    } catch {
      // Fallback below
    }

    const fallback: ExaminerWorkspace = {
      id: `hall_${Date.now()}`,
      name: `${email.split("@")[0]}'s Exam Hall`,
      ownerName: email.split("@")[0],
      ownerEmail: email.trim(),
      type: "STANDALONE_HALL",
      credits: 30,
      createdAt: new Date().toISOString(),
    };
    saveExaminerSession(fallback);
    return fallback;
  },

  /**
   * Examiner registration — provisions workspace & signs in automatically
   */
  async registerStandaloneWorkspace(data: {
    name: string;
    ownerName: string;
    email: string;
  }): Promise<ExaminerWorkspace> {
    try {
      const res = await fetch(`${CBT_API_BASE}/workspaces/standalone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const workspace = await res.json();
        saveExaminerSession(workspace);
        return workspace;
      }
    } catch {
      // Fallback below
    }

    const fallback: ExaminerWorkspace = {
      id: `hall_${Date.now()}`,
      name: data.name.trim() || `${data.ownerName}'s Exam Hall`,
      ownerName: data.ownerName.trim(),
      ownerEmail: data.email.trim(),
      type: "STANDALONE_HALL",
      credits: 30,
      createdAt: new Date().toISOString(),
    };
    saveExaminerSession(fallback);
    return fallback;
  },

  async getExamByCode(accessCode: string) {
    const res = await fetch(`${CBT_API_BASE}/exams/code/${encodeURIComponent(accessCode)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Exam not found" }));
      throw new Error(err.message || "Failed to retrieve exam details.");
    }
    return res.json();
  },

  async startAttempt(payload: {
    accessCode: string;
    candidatePin: string;
    candidateName: string;
    studentId?: string;
  }) {
    const res = await fetch(`${CBT_API_BASE}/attempts/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to start attempt" }));
      throw new Error(err.message || "Could not launch examination session.");
    }
    return res.json();
  },

  async bufferAnswer(attemptId: string, questionId: string, selectedVal: any) {
    const res = await fetch(`${CBT_API_BASE}/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, selectedVal }),
    });
    return res.ok;
  },

  async recordTelemetry(attemptId: string, eventType: string, questionIdx?: number) {
    const res = await fetch(`${CBT_API_BASE}/attempts/${attemptId}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, timestamp: new Date().toISOString(), questionIdx }),
    });
    if (!res.ok) return null;
    return res.json();
  },

  async submitAttempt(attemptId: string, finalAnswers?: Record<string, any>, autoSubmitted?: boolean) {
    const res = await fetch(`${CBT_API_BASE}/attempts/${attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalAnswers, autoSubmitted }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to submit attempt" }));
      throw new Error(err.message || "Error submitting examination.");
    }
    return res.json();
  },

  async getResultSlip(attemptId: string) {
    const res = await fetch(`${CBT_API_BASE}/attempts/${attemptId}/slip`);
    if (!res.ok) throw new Error("Could not retrieve result slip.");
    return res.json();
  },

  async getLiveMonitor(examId: string) {
    const res = await fetch(`${CBT_API_BASE}/exams/${examId}/monitor`);
    if (!res.ok) throw new Error("Could not load live monitor metrics.");
    return res.json();
  },

  async syncScoresToParaLearn(examId: string) {
    const res = await fetch(`${CBT_API_BASE}/sync/export-scores/${examId}`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Synchronization to ParaLearn Core failed.");
    return res.json();
  },

  getExportCsvUrl(examId: string) {
    return `${CBT_API_BASE}/sync/export-csv/${examId}`;
  },

  async createExam(data: {
    workspaceId: string;
    title: string;
    accessCode?: string;
    durationMins?: number;
    startsAt?: string;
    endsAt?: string;
    maxTabViolations?: number;
    shuffleQuestions?: boolean;
    shuffleChoices?: boolean;
    showResultAfter?: boolean;
  }): Promise<CbtExamItem> {
    try {
      const res = await fetch(`${CBT_API_BASE}/exams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    const fallback: CbtExamItem = {
      id: `exam_${Date.now()}`,
      workspaceId: data.workspaceId,
      title: data.title,
      accessCode: data.accessCode?.trim().toUpperCase() || `MOCK-${Math.floor(1000 + Math.random() * 9000)}`,
      durationMins: data.durationMins || 60,
      totalQuestions: 0,
      isPublished: true,
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
      maxTabViolations: data.maxTabViolations ?? 3,
      shuffleQuestions: data.shuffleQuestions ?? true,
      shuffleChoices: data.shuffleChoices ?? true,
      showResultAfter: data.showResultAfter ?? true,
      createdAt: new Date().toISOString(),
    };
    return fallback;
  },

  async getWorkspaceExams(workspaceId: string): Promise<CbtExamItem[]> {
    try {
      const res = await fetch(`${CBT_API_BASE}/exams?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return loadStoredExams(workspaceId);
  },
};

export interface CbtExamItem {
  id: string;
  workspaceId?: string;
  title: string;
  accessCode: string;
  durationMins: number;
  totalQuestions: number;
  isPublished?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxTabViolations?: number;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  showResultAfter?: boolean;
  createdAt?: string;
}

export const loadStoredExams = (workspaceId?: string): CbtExamItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const key = `paralearn_cbt_exams_${workspaceId || "default"}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveStoredExams = (exams: CbtExamItem[], workspaceId?: string) => {
  if (typeof window === "undefined") return;
  try {
    const key = `paralearn_cbt_exams_${workspaceId || "default"}`;
    localStorage.setItem(key, JSON.stringify(exams));
  } catch {}
};
