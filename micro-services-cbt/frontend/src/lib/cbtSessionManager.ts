/**
 * CBT Session & Microservice API Client
 * Provides optimistic local storage, crash recovery, and offline resilience,
 * paired with direct asynchronous synchronization to the autonomous CBT Microservice.
 */

export type CbtQuestionType = "MCQ" | "SHORT_ESSAY" | "LONG_ESSAY" | "TRUE_FALSE";

export interface RubricLevel {
  label: string;
  points: number;
  descriptor: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  maxMarks: number;
  description: string;
  levels?: RubricLevel[];
}

export interface ExamRubric {
  id: string;
  name: string;
  source: "AUTO_GENERATED" | "CUSTOM_UPLOADED" | "MANUAL_STUDIO";
  criteria: RubricCriterion[];
  totalMarks: number;
  uploadedFileName?: string;
  createdAt?: string;
}

export interface CandidateSession {
  attemptId?: string;
  examId?: string;
  examTitle?: string;
  examCode: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string;
  startedAt: string;
  durationMins: number;
  deadline: string;
  answers: Record<string, string | string[]>;
  flaggedQuestionIds: string[];
  questions?: Array<{
    id: string;
    prompt: string;
    type: CbtQuestionType | "MULTI_SELECT" | "ESSAY";
    marks: number;
    section?: string;
    options?: Array<{
      id: string;
      text: string;
      keyLabel?: string;
    }>;
  }>;
  maxTabViolations?: number;
  violations: Array<{
    type: string;
    timestamp: string;
    questionIdx: number;
  }>;
  status: "in_progress" | "submitted" | "disqualified";
  gradingStatus?: "AUTO_SCORED" | "PENDING_REVIEW" | "GRADED";
  score?: number;
  totalMarks?: number;
  percentage?: number;
  mcqScore?: number;
  essayScore?: number;
  essayFeedback?: Record<string, {
    score: number;
    maxScore: number;
    comment?: string;
    rubricScores?: Record<string, number>;
  }>;
}

export interface ExaminerWorkspace {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  password?: string;
  credits: number;
  apiKey?: string;
  webhookUrl?: string;
  createdAt?: string;
  _count?: {
    exams: number;
    questions: number;
  };
}

import Cookies from "js-cookie";

export const getCbtApiBase = (): string => {
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const envUrl = process.env.NEXT_PUBLIC_CBT_API_URL;
    if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
      if (!isLocalhost) {
        return "/api/cbt";
      }
    }
    return (envUrl || "/api/cbt").replace(/\/+$/, "");
  }
  const envUrl = process.env.NEXT_PUBLIC_CBT_API_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/+$/, "");
  }
  return "http://localhost:3000/api/cbt";
};

export const CBT_API_BASE = getCbtApiBase();

export const CBT_COOKIE_SESSION = "pln_cbt_session";
export const CBT_COOKIE_ATTEMPT = "pln_cbt_active_attempt";

// ── Examiner Session Management (Auto-SignIn & Dual-Layer Cookie Persistence) ──
export const saveExaminerSession = (workspace: ExaminerWorkspace): void => {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(workspace);
    localStorage.setItem("paralearn_cbt_standalone_workspace", raw);
    localStorage.setItem("paralearn_cbt_user_type", "STANDALONE_TUTOR");
    localStorage.setItem("paralearn_cbt_examiner_email", workspace.ownerEmail);

    // Dual-layer Cookie persistence (7 days, Lax)
    Cookies.set(CBT_COOKIE_SESSION, raw, {
      expires: 7,
      sameSite: "lax",
      path: "/",
    });
  } catch (err) {
    console.error("[CBT Session] Failed to save examiner session:", err);
  }
};

export const getExaminerSession = (): ExaminerWorkspace | null => {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem("paralearn_cbt_standalone_workspace");
    if (!raw) {
      // Fallback to cookie
      raw = Cookies.get(CBT_COOKIE_SESSION) || null;
      if (raw) {
        try {
          localStorage.setItem("paralearn_cbt_standalone_workspace", raw);
        } catch {}
      }
    }
    if (!raw) return null;
    const ws = JSON.parse(raw) as ExaminerWorkspace;
    if (ws && (ws.id === "ws_parakletus_internship" || ws.ownerEmail === "internship@parakletus.com")) {
      ws.ownerEmail = "parakletus70@gmail.com";
    }
    return ws;
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
    Cookies.remove(CBT_COOKIE_SESSION, { path: "/" });
  } catch (err) {
    console.error("[CBT Session] Failed to clear examiner session:", err);
  }
};

// ── Local Optimistic Cache & Offline Candidate Resilience ───────────────────
const STORAGE_PREFIX = "paralearn_cbt_session_";

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

    // Set crash-recovery cookie (24 hours)
    Cookies.set(CBT_COOKIE_ATTEMPT, `${session.examCode.trim().toUpperCase()}:${session.candidatePin.trim()}`, {
      expires: 1,
      sameSite: "lax",
      path: "/",
    });
  } catch (err) {
    console.error("[CBT Session] Failed to save session locally:", err);
  }
};

export const loadCandidateSession = (examCode: string, pin?: string): CandidateSession | null => {
  if (typeof window === "undefined") return null;
  try {
    let candidatePin = pin || localStorage.getItem("paralearn_cbt_active_pin");
    if (!candidatePin) {
      const attemptCookie = Cookies.get(CBT_COOKIE_ATTEMPT);
      if (attemptCookie && attemptCookie.includes(":")) {
        const parts = attemptCookie.split(":");
        if (parts[0] === examCode.trim().toUpperCase()) {
          candidatePin = parts[1];
        }
      }
    }
    const finalPin = candidatePin || "default";
    const key = getSessionStorageKey(examCode, finalPin);
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data) as CandidateSession;

    // Fallback: search localStorage for any key matching this examCode
    const prefix = `${STORAGE_PREFIX}${examCode.trim().toUpperCase()}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const item = localStorage.getItem(k);
        if (item) {
          try {
            const parsed = JSON.parse(item) as CandidateSession;
            if (parsed && (parsed.status === "in_progress" || !parsed.status)) {
              return parsed;
            }
          } catch {}
        }
      }
    }
    return null;
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
    Cookies.remove(CBT_COOKIE_ATTEMPT, { path: "/" });
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
    const res = await fetch(`${CBT_API_BASE}/workspaces/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Examiner sign-in failed" }));
      throw new Error(err.message || "Examiner sign-in failed.");
    }
    const workspace = await res.json();
    saveExaminerSession(workspace);
    return workspace;
  },

  /**
   * Examiner registration — provisions workspace & signs in automatically
   */
  async registerStandaloneWorkspace(data: {
    name: string;
    ownerName: string;
    email: string;
  }): Promise<ExaminerWorkspace> {
    const res = await fetch(`${CBT_API_BASE}/workspaces/standalone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Workspace registration failed" }));
      throw new Error(err.message || "Workspace registration failed.");
    }
    const workspace = await res.json();
    saveExaminerSession(workspace);
    return workspace;
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
    } catch (e) {
      console.warn("[CBT Session] Microservice createExam unreachable, creating optimistic local exam:", e);
    }
    const localExam: CbtExamItem = {
      id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId: data.workspaceId,
      title: data.title,
      accessCode: data.accessCode || `EXAM-${Math.floor(1000 + Math.random() * 9000)}`,
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
    const existing = loadStoredExams(data.workspaceId);
    saveStoredExams([localExam, ...existing], data.workspaceId);
    return localExam;
  },

  async getWorkspaceExams(workspaceId: string): Promise<CbtExamItem[]> {
    try {
      const res = await fetch(`${CBT_API_BASE}/exams?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[CBT Session] Microservice getWorkspaceExams unreachable, loading stored exams:", e);
    }
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

export interface CandidateRecord {
  id: string;
  name: string;
  regNumber: string;
  pin: string;
  phone: string;
  roomCode: string;
  status: "ENROLLED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  score?: number;
  grade?: string;
  createdAt: string;
}

export const loadStoredExams = (workspaceId?: string): CbtExamItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const activeWs = workspaceId || getExaminerSession()?.id || "default";
    let raw = localStorage.getItem(`paralearn_cbt_exams_${activeWs}`);
    if (!raw && activeWs !== "default") {
      raw = localStorage.getItem("paralearn_cbt_exams_default");
    }
    if (!raw) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("paralearn_cbt_exams_")) {
          const val = localStorage.getItem(k);
          if (val && val !== "[]") {
            raw = val;
            break;
          }
        }
      }
    }
    if (raw) {
      const parsed: CbtExamItem[] = JSON.parse(raw);
      // Clean out demo exam if present to ensure clean slate
      const cleaned = parsed.filter((e) => e.id !== "jamb_mock_demo" && e.accessCode !== "JAMB-MOCK-26");
      if (cleaned.length !== parsed.length) {
        saveStoredExams(cleaned, workspaceId);
      }
      return cleaned;
    }
  } catch {}
  return [];
};

export const saveStoredExams = (exams: CbtExamItem[], workspaceId?: string) => {
  if (typeof window === "undefined") return;
  try {
    const activeWs = workspaceId || getExaminerSession()?.id || "default";
    localStorage.setItem(`paralearn_cbt_exams_${activeWs}`, JSON.stringify(exams));
    if (activeWs !== "default") {
      localStorage.setItem("paralearn_cbt_exams_default", JSON.stringify(exams));
    }
  } catch {}
};

export const loadStoredCandidates = (workspaceId?: string): CandidateRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const activeWs = workspaceId || getExaminerSession()?.id || "default";
    let raw = localStorage.getItem(`paralearn_cbt_candidates_${activeWs}`);
    if (!raw && activeWs !== "default") {
      raw = localStorage.getItem("paralearn_cbt_candidates_default");
    }
    if (raw) {
      const parsed: CandidateRecord[] = JSON.parse(raw);
      // Filter out demo candidate IDs
      const cleaned = parsed.filter((c) => !["c1", "c2", "c3", "c4", "c5", "c6"].includes(c.id));
      if (cleaned.length !== parsed.length) {
        saveStoredCandidates(cleaned, workspaceId);
      }
      return cleaned;
    }
  } catch {}
  return [];
};

export const saveStoredCandidates = (candidates: CandidateRecord[], workspaceId?: string) => {
  if (typeof window === "undefined") return;
  try {
    const activeWs = workspaceId || getExaminerSession()?.id || "default";
    localStorage.setItem(`paralearn_cbt_candidates_${activeWs}`, JSON.stringify(candidates));
    if (activeWs !== "default") {
      localStorage.setItem("paralearn_cbt_candidates_default", JSON.stringify(candidates));
    }
  } catch {}
};

export const loadStoredQuestions = (examId: string): any[] => {
  if (typeof window === "undefined") return [];
  try {
    const key = `paralearn_cbt_questions_${examId}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveStoredQuestions = (questions: any[], examId: string) => {
  if (typeof window === "undefined") return;
  try {
    const key = `paralearn_cbt_questions_${examId}`;
    localStorage.setItem(key, JSON.stringify(questions));
  } catch {}
};

/**
 * Purge legacy demo accounts and mock data to guarantee a pristine, clean slate.
 */
export const purgeAllDemoData = () => {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes("jamb_mock_demo") ||
        key.includes("JAMB-MOCK-26") ||
        key === "paralearn_cbt_exams_default" ||
        key === "paralearn_cbt_candidates_default"
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
};

export const loadStoredRubrics = (examId: string): ExamRubric[] => {
  if (typeof window === "undefined") return [];
  try {
    const key = `paralearn_cbt_rubrics_${examId}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

export const saveStoredRubrics = (rubrics: ExamRubric[], examId: string) => {
  if (typeof window === "undefined") return;
  try {
    const key = `paralearn_cbt_rubrics_${examId}`;
    localStorage.setItem(key, JSON.stringify(rubrics));
  } catch {}
};


