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

import crypto from "crypto";
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
  /** MCQ | TRUE_FALSE | MULTI_SELECT | SHORT_ESSAY | LONG_ESSAY (ESSAY in older data) */
  type: string;
  marks: number;
  section?: string;
  options?: StoredOption[];
  explanation?: string;
  /** Essay guidance shown to candidates */
  minWords?: number;
  maxWords?: number;
  /** Examiner-only marking aids */
  modelAnswer?: string;
  keyTerms?: string[];
  rubric?: Record<string, any> | null;
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
  /** ACCESS_CODE: anyone with the code; ROSTER_ONLY: enrolled candidates with their PIN */
  accessType?: "ACCESS_CODE" | "ROSTER_ONLY";
  instructions?: string;
  questionIds?: string[];
  createdAt: string;
}

export interface StoredWorkspace {
  id: string;
  name: string;
  type: string;
  ownerName: string;
  ownerEmail: string;
  /** Legacy plaintext password; replaced by passwordHash on next sign-in */
  password?: string;
  passwordHash?: string;
  /** ParaLearn School.id for INSTITUTION workspaces */
  externalId?: string;
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
  /** Added by the candidate starting without a PIN, not enrolled by the examiner */
  walkIn?: boolean;
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
  /** Attempts started since attempt tokens exist must present theirs */
  tokenRequired?: boolean;
  /** The examiner's comments, shown on the candidate's result slip */
  feedback?: { comment?: string; byQuestion?: Record<string, string>; gradedAt?: string };
  score?: number;
  totalMarks?: number;
  percentage?: number;
  grade?: string;
  gradingStatus?: GradingStatus;
  /** Marks set by the examiner, keyed by question id — override auto-marking */
  manualMarks?: Record<string, number>;
  mcqScore?: number;
  essayScore?: number;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  metadata?: Record<string, any>;
}

export type GradingStatus = "AUTO_SCORED" | "PENDING_REVIEW" | "GRADED";

export interface CbtReportCardRelease {
  releasedAt: string;
  saved: number;
  skipped: number;
  /** Fingerprint of the released scores, to spot results that changed since */
  fingerprint: string;
}

/** Thrown for requests that conflict with current state; routes map it to HTTP 409 */
export class CbtConflictError extends Error {}
/** A request the client must correct (HTTP 400) */
export class CbtValidationError extends Error {}
/** A request that is understood but not allowed right now (HTTP 403) */
export class CbtForbiddenError extends Error {}
/** Something the request names doesn't exist (HTTP 404) */
export class CbtNotFoundError extends Error {}

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** A small seeded random generator, so an attempt's shuffle is the same on every resume */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The questions as this attempt sees them: shuffled per attempt when the
 * exam asks for it (true/false keeps its order), stable across resumes.
 */
export function questionsForAttempt(
  exam: Pick<StoredExam, "shuffleQuestions" | "shuffleChoices">,
  questions: StoredQuestion[],
  attemptId: string
): StoredQuestion[] {
  const random = seededRandom(attemptId);
  const ordered = exam.shuffleQuestions ? shuffled(questions, random) : questions;
  if (!exam.shuffleChoices) return ordered;
  return ordered.map((q) =>
    q.type === "TRUE_FALSE" || !q.options?.length ? q : { ...q, options: shuffled(q.options, random) }
  );
}

export const OBJECTIVE_TYPES = new Set(["MCQ", "TRUE_FALSE", "MULTI_SELECT"]);
const QUESTION_TYPES = new Set([...OBJECTIVE_TYPES, "SHORT_ESSAY", "LONG_ESSAY", "ESSAY"]);

const cleanText = (value: unknown, max = 20000) =>
  typeof value === "string" ? value.trim().slice(0, max) : undefined;
const positiveInt = (value: unknown) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Builds a stored question from a create or partial update. Fields the
 * request leaves out keep their saved values; an explicit null or "" clears
 * an optional field. Objective questions must have a correct option.
 */
function buildQuestion(
  id: string,
  data: Record<string, any>,
  existing: StoredQuestion | null,
  workspaceId: string,
  label = "This question"
): StoredQuestion {
  const has = (key: string) => data[key] !== undefined;
  const optional = <T>(key: string, parse: (v: any) => T | undefined, prev: T | undefined) =>
    has(key) ? (data[key] === null || data[key] === "" ? undefined : parse(data[key])) : prev;

  const prompt = has("prompt") ? cleanText(data.prompt) || "" : existing?.prompt || "";
  if (!prompt) throw new CbtValidationError(`${label} needs a question prompt.`);

  const type = String(has("type") ? data.type : existing?.type || "MCQ").trim().toUpperCase();
  if (!QUESTION_TYPES.has(type)) {
    throw new CbtValidationError(`${label} has an unknown type "${type}".`);
  }

  const marks = has("marks") ? Number(data.marks) : existing?.marks ?? 1;
  if (!Number.isFinite(marks) || marks <= 0 || marks > 1000) {
    throw new CbtValidationError(`${label} needs marks greater than 0.`);
  }

  let options: StoredOption[] = [];
  if (OBJECTIVE_TYPES.has(type)) {
    const source: any[] = has("options") ? (Array.isArray(data.options) ? data.options : []) : existing?.options || [];
    const seen = new Set<string>();
    options = source.map((opt, idx) => {
      let optId = String(opt?.id ?? "").trim() || `opt_${id}_${idx + 1}`;
      if (seen.has(optId)) optId = `${optId}_${idx + 1}`;
      seen.add(optId);
      return {
        id: optId,
        text: cleanText(opt?.text, 5000) || "",
        isCorrect: opt?.isCorrect === true,
        ...(opt?.keyLabel ? { keyLabel: String(opt.keyLabel).slice(0, 4) } : {}),
      };
    });
    if (options.length < 2 || options.some((o) => !o.text)) {
      throw new CbtValidationError(`${label} needs at least two options, each with text.`);
    }
    const correct = options.filter((o) => o.isCorrect).length;
    if (type === "MULTI_SELECT" ? correct < 1 : correct !== 1) {
      throw new CbtValidationError(
        type === "MULTI_SELECT"
          ? `${label} needs at least one correct option.`
          : `${label} needs exactly one correct option.`
      );
    }
  }

  const keyTerms = optional<string[]>(
    "keyTerms",
    (v) => (Array.isArray(v) ? v : String(v).split(",")).map((t) => String(t).trim()).filter(Boolean).slice(0, 50),
    existing?.keyTerms
  );

  return {
    id,
    workspaceId,
    prompt,
    type,
    marks,
    section: optional("section", (v) => cleanText(v, 200), existing?.section),
    options,
    explanation: optional("explanation", (v) => cleanText(v), existing?.explanation) || "",
    minWords: optional("minWords", positiveInt, existing?.minWords),
    maxWords: optional("maxWords", positiveInt, existing?.maxWords),
    modelAnswer: optional("modelAnswer", (v) => cleanText(v), existing?.modelAnswer),
    keyTerms,
    rubric: optional("rubric", (v) => (typeof v === "object" ? v : undefined), existing?.rubric ?? undefined),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}


// ── KV namespace prefixes ─────────────────────────────────────────────────────
const NS = {
  workspace: "cbt:ws",
  workspaceByEmail: "cbt:ws:email",
  workspaceByApiKey: "cbt:ws:apikey",
  workspaceBySchool: "cbt:ws:school",
  exam: "cbt:exam",
  examByCode: "cbt:exam:code",
  attemptByExternalId: "cbt:attempt:ext",
  examsByWorkspace: "cbt:exams:ws",
  question: "cbt:q",
  questionsByExam: "cbt:qs:exam",
  candidate: "cbt:cand",
  candidatesByExam: "cbt:cands:exam",
  attempt: "cbt:att",
  attemptsByExam: "cbt:atts:exam",
};

// Per-exam indexes (Redis hashes) so lookups don't scan every record in the store
const IDX = {
  examCands: (examId: string) => `cbt:idx:exam:${examId}:cands`, // candidateId -> pin
  examAtts: (examId: string) => `cbt:idx:exam:${examId}:atts`, // attemptId -> pin
  examProgress: (examId: string) => `cbt:idx:exam:${examId}:progress`, // attemptId -> answered count
  examBuilt: (examId: string) => `cbt:idx:exam:${examId}:built`,
  answers: (attemptId: string) => `cbt:ans:${attemptId}`, // questionId -> { v: answer }
};

/** Set once older exams and attempts have been added to the lookup indexes */
const EXAM_CODE_INDEX_BUILT = "cbt:exam:code:index-built";
const ATTEMPT_EXTERNAL_INDEX_BUILT = "cbt:attempt:ext:index-built";

// Answers arriving this long after the deadline are rejected (covers slow networks)
const ANSWER_GRACE_MS = 2 * 60 * 1000;
/** A submission received this long after the deadline is flagged as synced late */
const LATE_SYNC_TOLERANCE_MS = 2 * 60 * 1000;
/** Recent tab-switch report ids kept per attempt, to ignore resent reports */
const TELEMETRY_IDS_KEPT = 200;

/** Attempt metadata safe to share with integrators (drops internal bookkeeping) */
export function publicAttemptMetadata(metadata?: Record<string, any>) {
  const { telemetryEventIds: _ids, ...rest } = metadata || {};
  return rest;
}
const ESSAY_TYPES = new Set(["ESSAY", "SHORT_ESSAY", "LONG_ESSAY"]);
const isEssayType = (type?: string) => ESSAY_TYPES.has(String(type || "").toUpperCase());

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
// Seeding costs ~40 store commands, so it runs once per store (flag key) and once per instance.
const SEED_FLAG = "cbt:seed:v2";
let seedPromise: Promise<void> | null = null;

function ensureDefaultWorkspacesAndExams(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      if (await kvAdapter.get(SEED_FLAG)) return;
      await seedDefaultWorkspacesAndExams();
      await kvAdapter.set(SEED_FLAG, new Date().toISOString());
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function seedDefaultWorkspacesAndExams() {
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

/** A 6-digit PIN not in use (re-drawn on the rare clash) */
function uniquePin(inUse: Set<string>): string {
  for (let i = 0; i < 1000; i++) {
    const pin = String(crypto.randomInt(100000, 1000000));
    if (!inUse.has(pin)) return pin;
  }
  throw new Error("Couldn't find a free PIN for this exam.");
}

// ── Index helpers ─────────────────────────────────────────────────────────────
/** Builds an exam's candidate/attempt indexes from a full scan the first time they're needed */
async function ensureExamIndex(examId: string) {
  if (await kvAdapter.get(IDX.examBuilt(examId))) return;
  const [cands, atts] = await Promise.all([
    kvAdapter.hlist<StoredCandidate>(NS.candidate),
    kvAdapter.hlist<StoredAttempt>(NS.attempt),
  ]);
  for (const c of cands) {
    if (c.examId === examId) await kvAdapter.hashSet(IDX.examCands(examId), c.id, c.candidatePin);
  }
  for (const a of atts) {
    if (a.examId === examId) await kvAdapter.hashSet(IDX.examAtts(examId), a.id, a.candidatePin);
  }
  await kvAdapter.set(IDX.examBuilt(examId), "1");
}

async function loadIndexed<T extends { examId: string }>(
  examId: string,
  indexKey: string,
  ns: string
): Promise<T[]> {
  await ensureExamIndex(examId);
  const ids = Object.keys(await kvAdapter.hashGetAll(indexKey));
  const items = await kvAdapter.mget<T>(ids.map((id) => `${ns}:${id}`));
  return items.filter((item): item is T => Boolean(item) && item!.examId === examId);
}

const getExamCandidates = (examId: string) =>
  loadIndexed<StoredCandidate>(examId, IDX.examCands(examId), NS.candidate);
const getExamAttempts = (examId: string) =>
  loadIndexed<StoredAttempt>(examId, IDX.examAtts(examId), NS.attempt);

/**
 * The attempt's answer sheet. Once submitted, the stored sheet is final; while in progress,
 * answers saved field-by-field during the exam are merged over it.
 */
async function getMergedAnswers(att: StoredAttempt): Promise<Record<string, any>> {
  if (att.submittedAt) return { ...(att.answers || {}) };
  const buffered = await kvAdapter.hashGetAll<{ v: unknown }>(IDX.answers(att.id));
  const merged: Record<string, any> = { ...(att.answers || {}) };
  for (const [qId, entry] of Object.entries(buffered)) {
    merged[qId] = entry && typeof entry === "object" && "v" in entry ? entry.v : entry;
  }
  return merged;
}

const toApiStatus = (status: StoredAttempt["status"]) =>
  status === "in_progress" ? "IN_PROGRESS" : status === "disqualified" ? "DISQUALIFIED" : "SUBMITTED";

/** Strips the answer key so it never reaches a candidate's browser */
export function toCandidateQuestion(q: StoredQuestion) {
  const {
    explanation: _explanation,
    modelAnswer: _modelAnswer,
    keyTerms: _keyTerms,
    workspaceId: _workspaceId,
    ...rest
  } = q;
  return {
    ...rest,
    options: (q.options || []).map(({ isCorrect: _isCorrect, ...opt }) => opt),
  };
}

/** Scores an attempt: MCQ/true-false/multi-select are auto-marked, essays wait for the examiner */
function scoreAttempt(
  questions: StoredQuestion[],
  answers: Record<string, any>,
  manualMarks: Record<string, number> = {}
) {
  let mcqScore = 0;
  let essayScore = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let ungradedEssays = 0;
  let essayCount = 0;
  const perQuestion: Record<string, { marksAwarded?: number; isCorrect: boolean | null }> = {};

  for (const q of questions) {
    const marks = q.marks || 1;
    totalMarks += marks;
    const manual = manualMarks[q.id];

    if (isEssayType(q.type)) {
      essayCount++;
      if (manual === undefined) {
        ungradedEssays++;
        perQuestion[q.id] = { isCorrect: null };
      } else {
        essayScore += manual;
        perQuestion[q.id] = { marksAwarded: manual, isCorrect: null };
      }
      continue;
    }

    const correctIds = new Set((q.options || []).filter((o) => o.isCorrect).map((o) => String(o.id)));
    const chosen = chosenOptionIds(answers[q.id]);
    const isCorrect =
      correctIds.size > 0 &&
      chosen.size === correctIds.size &&
      [...chosen].every((optId) => correctIds.has(optId));
    const awarded = manual ?? (isCorrect ? marks : 0);
    mcqScore += awarded;
    if (isCorrect) correctCount++;
    else if (chosen.size === 0) unansweredCount++;
    else wrongCount++;
    perQuestion[q.id] = { marksAwarded: awarded, isCorrect };
  }

  const score = mcqScore + essayScore;
  const safeTotal = totalMarks > 0 ? totalMarks : 1;
  const percentage = Math.round((score / safeTotal) * 100);
  const gradingStatus: GradingStatus =
    essayCount === 0 ? "AUTO_SCORED" : ungradedEssays > 0 ? "PENDING_REVIEW" : "GRADED";

  return {
    score,
    totalMarks: safeTotal,
    percentage,
    grade: computeWaecGrade(percentage),
    mcqScore,
    essayScore,
    correctCount,
    wrongCount,
    unansweredCount,
    gradingStatus,
    perQuestion,
  };
}

/**
 * The option ids a candidate chose. Accepts an id, a list of ids, or the
 * documented {"selected": id | ids} form; repeats count once.
 */
function chosenOptionIds(answer: unknown): Set<string> {
  const value =
    answer && typeof answer === "object" && !Array.isArray(answer) && "selected" in answer
      ? (answer as { selected: unknown }).selected
      : answer;
  const list = Array.isArray(value) ? value : value === undefined || value === null || value === "" ? [] : [value];
  return new Set(list.filter((v) => typeof v === "string" || typeof v === "number").map(String));
}

/**
 * The one id a workspace is known by. Seeded customer workspaces have legacy
 * alias ids; everything else is matched exactly (never by name or substring).
 */
const WORKSPACE_ALIASES: Record<string, string> = {
  cmusrg4w30002of8ccfazuegn: "ws_sweep_prod",
  sweep: "ws_sweep_prod",
};
export function canonicalWorkspaceId(id?: string | null): string {
  const clean = (id || "").trim();
  return WORKSPACE_ALIASES[clean] || clean;
}
/** Workspace ids old exams were saved under before exams had a real owner */
const LEGACY_UNOWNED = new Set(["", "default"]);

/** The workspace that owns an exam, including SWEEP's legacy unowned SWP- exams */
export function examWorkspaceId(exam: Pick<StoredExam, "workspaceId" | "accessCode">): string {
  if (
    LEGACY_UNOWNED.has(exam.workspaceId || "") &&
    exam.accessCode?.trim().toUpperCase().startsWith("SWP-")
  ) {
    return "ws_sweep_prod";
  }
  return canonicalWorkspaceId(exam.workspaceId);
}

/** The payload integrators receive for an attempt event */
export function attemptWebhookPayload(
  att: StoredAttempt,
  exam: StoredExam | null,
  event: "exam.attempt.completed" | "exam.attempt.graded"
) {
  const eventId = `evt_${crypto.randomBytes(10).toString("hex")}`;
  return {
    event,
    eventId,
    timestamp: new Date().toISOString(),
    workspaceId: exam ? examWorkspaceId(exam) : "default",
    examId: att.examId,
    examCode: att.examCode,
    attemptId: att.id,
    externalAttemptId: att.externalAttemptId || null,
    studentId: att.studentId || null,
    candidateName: att.candidateName,
    candidatePin: att.candidatePin,
    email: att.email || null,
    status: toApiStatus(att.status),
    gradingStatus: att.gradingStatus || "AUTO_SCORED",
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
        correctCount: att.correctCount ?? 0,
        wrongCount: att.wrongCount ?? 0,
        unansweredCount: att.unansweredCount ?? 0,
        mcqScore: att.mcqScore ?? att.score ?? 0,
        essayScore: att.essayScore ?? 0,
      },
    },
    metadata: {
      ...publicAttemptMetadata(att.metadata),
      sweepLearnerId: att.studentId || null,
      sweepAttemptId: att.externalAttemptId || null,
    },
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const cbtServerStore = {
  // ── Workspaces ──────────────────────────────────────────────────────────
  async getWorkspace(id: string): Promise<StoredWorkspace | null> {
    if (!id) return null;
    await ensureDefaultWorkspacesAndExams();
    const canonical = canonicalWorkspaceId(id);

    // Seeded customer workspaces keep their fixed identity
    if (canonical === SWEEP_WORKSPACE.id) {
      const ws = await kvAdapter.hget<StoredWorkspace>(NS.workspace, SWEEP_WORKSPACE.id);
      return {
        ...SWEEP_WORKSPACE,
        ...(ws || {}),
        id: SWEEP_WORKSPACE.id,
        name: "SWEEP ACADEMY",
        ownerName: "Mina Ogbanga",
        ownerEmail: "ogbangadigitalprojects@gmail.com",
      };
    }
    if (canonical === BUSI_WORKSPACE.id) {
      const ws = await kvAdapter.hget<StoredWorkspace>(NS.workspace, BUSI_WORKSPACE.id);
      return {
        ...BUSI_WORKSPACE,
        ...(ws || {}),
        id: BUSI_WORKSPACE.id,
        name: "Parakletus Internship Program",
        ownerName: "Evander Ikechukwu",
        ownerEmail: "parakletus70@gmail.com",
      };
    }
    if (canonical === "default") {
      const defaultWs = await kvAdapter.hget<StoredWorkspace>(NS.workspace, "default");
      return defaultWs || DEFAULT_WORKSPACES[0];
    }
    return kvAdapter.hget<StoredWorkspace>(NS.workspace, canonical);
  },

  async findWorkspaceByApiKey(apiKey: string): Promise<StoredWorkspace | null> {
    const cleanKey = apiKey.trim();
    const id = await kvAdapter.get<string>(`${NS.workspaceByApiKey}:${cleanKey}`);
    if (id) return kvAdapter.hget<StoredWorkspace>(NS.workspace, id);
    // fallback full scan
    const all = await kvAdapter.hlist<StoredWorkspace>(NS.workspace);
    return all.find((w) => w.apiKey === cleanKey) || null;
  },

  /**
   * Exact-email lookup of an independent exam hall, for sign-in. Unlike
   * findWorkspaceByEmail it never matches by alias or substring.
   */
  async findStandaloneWorkspaceByEmail(email: string): Promise<StoredWorkspace | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    await ensureDefaultWorkspacesAndExams();
    let id = await kvAdapter.get<string>(`${NS.workspaceByEmail}:${cleanEmail}`);
    if (!id) {
      const all = await kvAdapter.hlist<StoredWorkspace>(NS.workspace);
      id = all.find((w) => w.ownerEmail?.toLowerCase() === cleanEmail)?.id || null;
    }
    if (!id || id === "default") return null;
    const ws = await this.getWorkspace(id);
    if (!ws || ws.type === "INSTITUTION") return null;
    return ws;
  },

  async createStandaloneWorkspace(data: {
    name: string;
    ownerName: string;
    email: string;
    passwordHash: string;
  }): Promise<StoredWorkspace> {
    const email = data.email.trim().toLowerCase();
    const ws: StoredWorkspace = {
      id: `ws_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      name: data.name,
      type: "STANDALONE_HALL",
      ownerName: data.ownerName,
      ownerEmail: email,
      passwordHash: data.passwordHash,
      credits: 50,
      apiKey: `pln_live_sk_${crypto.randomBytes(24).toString("hex")}`,
      webhookSecret: `pln_whsec_${crypto.randomBytes(24).toString("hex")}`,
      createdAt: new Date().toISOString(),
    };
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    await kvAdapter.set(`${NS.workspaceByEmail}:${email}`, ws.id);
    await kvAdapter.set(`${NS.workspaceByApiKey}:${ws.apiKey}`, ws.id);
    return ws;
  },

  async setWorkspacePassword(id: string, passwordHash: string): Promise<void> {
    const ws = await this.getWorkspace(id);
    if (!ws) return;
    const { password: _legacy, ...rest } = ws;
    await kvAdapter.hset(NS.workspace, ws.id, { ...rest, passwordHash });
  },

  /** Finds or creates a ParaLearn school's workspace, keyed by School.id */
  async upsertInstitutionWorkspace(data: {
    id?: string;
    schoolId: string;
    name: string;
    ownerEmail: string;
  }): Promise<StoredWorkspace> {
    const existingId = await kvAdapter.get<string>(`${NS.workspaceBySchool}:${data.schoolId}`);
    const existing = existingId
      ? await kvAdapter.hget<StoredWorkspace>(NS.workspace, existingId)
      : data.id
        ? await kvAdapter.hget<StoredWorkspace>(NS.workspace, data.id)
        : null;

    const ws: StoredWorkspace = {
      credits: 999999,
      apiKey: `pln_live_sk_${crypto.randomBytes(24).toString("hex")}`,
      webhookSecret: `pln_whsec_${crypto.randomBytes(24).toString("hex")}`,
      createdAt: new Date().toISOString(),
      ownerName: data.name,
      ...(existing || {}),
      id: existing?.id || data.id || `ws_inst_${crypto.randomBytes(6).toString("hex")}`,
      name: data.name,
      type: "INSTITUTION",
      externalId: data.schoolId,
      ownerEmail: existing?.ownerEmail || data.ownerEmail.toLowerCase(),
    };
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    await kvAdapter.set(`${NS.workspaceBySchool}:${data.schoolId}`, ws.id);
    if (ws.apiKey) await kvAdapter.set(`${NS.workspaceByApiKey}:${ws.apiKey}`, ws.id);
    return ws;
  },

  /** Issues a new API key; the old one stops working at once */
  async rotateApiKey(id: string): Promise<string> {
    const ws = await this.getWorkspace(id);
    if (!ws) throw new CbtNotFoundError("Workspace not found");
    if (ws.apiKey) await kvAdapter.del(`${NS.workspaceByApiKey}:${ws.apiKey}`);
    ws.apiKey = `pln_live_sk_${crypto.randomBytes(24).toString("hex")}`;
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    await kvAdapter.set(`${NS.workspaceByApiKey}:${ws.apiKey}`, ws.id);
    return ws.apiKey;
  },

  /** Issues a new webhook signing secret */
  async rotateWebhookSecret(id: string): Promise<string> {
    const ws = await this.getWorkspace(id);
    if (!ws) throw new CbtNotFoundError("Workspace not found");
    ws.webhookSecret = `pln_whsec_${crypto.randomBytes(24).toString("hex")}`;
    await kvAdapter.hset(NS.workspace, ws.id, ws);
    return ws.webhookSecret;
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

  // ── Exams ───────────────────────────────────────────────────────────────
  /** A workspace's exams. Matches the canonical workspace id exactly. */
  async listExams(workspaceId?: string): Promise<StoredExam[]> {
    if (!workspaceId) return [];
    await ensureDefaultWorkspacesAndExams();
    const all = (await kvAdapter.hlist<StoredExam>(NS.exam)).filter(
      (e): e is StoredExam =>
        typeof e === "object" && e !== null && typeof (e as any).title === "string"
    );
    const canonical = canonicalWorkspaceId(workspaceId);

    const own = all.filter((e) => examWorkspaceId(e) === canonical);
    if (canonical === BUSI_WORKSPACE.id && !own.some((e) => e.id === BUSI_EXAM.id)) {
      return [BUSI_EXAM, ...own];
    }
    return own;
  },

  async getExamById(id: string): Promise<StoredExam | null> {
    await ensureDefaultWorkspacesAndExams();
    if (id === BUSI_EXAM.id || id === "exam_busi_7642") return BUSI_EXAM;
    return kvAdapter.hget<StoredExam>(NS.exam, id);
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
    // Exams saved before the index existed are indexed in one pass; after that a
    // wrong code is a single lookup, so guessing codes can't make every request
    // read the whole store
    if (await kvAdapter.get(EXAM_CODE_INDEX_BUILT)) return null;
    const all = await kvAdapter.hlist<StoredExam>(NS.exam);
    let match: StoredExam | null = null;
    for (const e of all) {
      const key = e.accessCode?.trim().toUpperCase();
      if (!key) continue;
      if (!(await kvAdapter.get(`${NS.examByCode}:${key}`))) {
        await kvAdapter.set(`${NS.examByCode}:${key}`, e.id);
      }
      if (!match && key === cleanCode) match = e;
    }
    await kvAdapter.set(EXAM_CODE_INDEX_BUILT, "1");
    return match;
  },

  async upsertExam(data: Partial<StoredExam>): Promise<StoredExam> {
    const id =
      data.id ||
      `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existing = await kvAdapter.hget<StoredExam>(NS.exam, id);
    const codeOwner = async (code: string) =>
      kvAdapter.get<string>(`${NS.examByCode}:${code}`);

    let accessCode = data.accessCode?.trim().toUpperCase() || existing?.accessCode || "";
    if (accessCode) {
      const owner = await codeOwner(accessCode);
      if (owner && owner !== id) {
        throw new CbtConflictError(
          `Access code "${accessCode}" is already used by another exam. Choose a different code.`
        );
      }
    } else {
      for (let tries = 0; tries < 10 && !accessCode; tries++) {
        const candidate = `EXAM-${Math.floor(100000 + Math.random() * 900000)}`;
        if (!(await codeOwner(candidate))) accessCode = candidate;
      }
      if (!accessCode) accessCode = `EXAM-${Date.now().toString(36).toUpperCase()}`;
    }

    const exam: StoredExam = {
      id,
      workspaceId: data.workspaceId || existing?.workspaceId || "default",
      // PATCH requests (e.g. publish) may omit the title — keep the existing one
      title: data.title ?? existing?.title ?? "Untitled Exam",
      accessCode,
      durationMins: Math.min(
        600,
        Math.max(1, Math.round(Number(data.durationMins) || existing?.durationMins || 60))
      ),
      totalMarks: data.totalMarks ?? existing?.totalMarks ?? 0,
      totalQuestions:
        data.totalQuestions ??
        existing?.totalQuestions ??
        existing?.questionIds?.length ??
        0,
      isPublished: data.isPublished ?? existing?.isPublished ?? true,
      // An explicit null clears the schedule
      startsAt: data.startsAt !== undefined ? data.startsAt || null : existing?.startsAt ?? null,
      endsAt: data.endsAt !== undefined ? data.endsAt || null : existing?.endsAt ?? null,
      maxTabViolations: Math.min(
        20,
        Math.max(1, Math.round(Number(data.maxTabViolations) || existing?.maxTabViolations || 3))
      ),
      accessType:
        (data.accessType ?? existing?.accessType) === "ROSTER_ONLY" ? "ROSTER_ONLY" : "ACCESS_CODE",
      instructions:
        data.instructions !== undefined
          ? cleanText(data.instructions, 5000) || undefined
          : existing?.instructions,
      shuffleQuestions:
        data.shuffleQuestions ?? existing?.shuffleQuestions ?? true,
      shuffleChoices: data.shuffleChoices ?? existing?.shuffleChoices ?? true,
      showResultAfter:
        data.showResultAfter ?? existing?.showResultAfter ?? true,
      questionIds: data.questionIds || existing?.questionIds || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    if (exam.startsAt && exam.endsAt && new Date(exam.endsAt) <= new Date(exam.startsAt)) {
      throw new CbtValidationError("The closing time must be after the opening time.");
    }
    await kvAdapter.hset(NS.exam, id, exam);
    // Write code → id index so lookups are O(1) and cross-instance
    await kvAdapter.set(`${NS.examByCode}:${exam.accessCode}`, id);
    if (existing?.accessCode && existing.accessCode !== exam.accessCode) {
      await kvAdapter.del(`${NS.examByCode}:${existing.accessCode}`);
    }
    return exam;
  },

  async attachQuestionsToExam(
    examId: string,
    questionIds: string[]
  ): Promise<StoredExam | null> {
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
    if (!exam) return null;
    // Each question once, in the order given
    questionIds = [...new Set(questionIds.filter((qId) => typeof qId === "string" && qId))];
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

  async upsertQuestion(data: Record<string, any>): Promise<StoredQuestion> {
    const id = String(data.id || `q_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`);
    const existing = await kvAdapter.hget<StoredQuestion>(NS.question, id);
    const question = buildQuestion(
      id,
      data,
      existing,
      data.workspaceId || existing?.workspaceId || "default"
    );
    await kvAdapter.hset(NS.question, id, question);
    if (existing) await this.refreshExamsUsing([id]);
    return question;
  },

  /**
   * After a question changes: recompute the totals of every exam using it and
   * re-mark their submitted attempts, so a corrected answer key or new marks
   * apply to results already in.
   */
  async refreshExamsUsing(questionIds: string[]) {
    const ids = new Set(questionIds);
    const exams = await kvAdapter.hlist<StoredExam>(NS.exam);
    for (const exam of exams) {
      if (!exam?.questionIds?.some((qId) => ids.has(qId))) continue;
      const questions = (
        await Promise.all(exam.questionIds.map((qId) => kvAdapter.hget<StoredQuestion>(NS.question, qId)))
      ).filter((q): q is StoredQuestion => !!q);
      exam.totalQuestions = questions.length;
      exam.totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
      await kvAdapter.hset(NS.exam, exam.id, exam);
      for (const att of await getExamAttempts(exam.id)) {
        if (att.submittedAt) await this.applyScore(att, questions);
      }
    }
  },

  /** Saves several questions; validates all of them before saving any */
  async bulkUpsertQuestions(
    workspaceId: string,
    questions: Array<Record<string, any>>
  ): Promise<StoredQuestion[]> {
    const built: StoredQuestion[] = [];
    let updatedExisting = false;
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx] || {};
      const id = String(q.id || `q_${Date.now()}_${idx}_${crypto.randomBytes(3).toString("hex")}`);
      const existing = q.id ? await kvAdapter.hget<StoredQuestion>(NS.question, id) : null;
      if (existing) updatedExisting = true;
      built.push(buildQuestion(id, q, existing, workspaceId, `Question ${idx + 1}`));
    }
    for (const item of built) await kvAdapter.hset(NS.question, item.id, item);
    if (updatedExisting) await this.refreshExamsUsing(built.map((q) => q.id));
    return built;
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

    const examCands = await getExamCandidates(exam.id);
    const requestedPin = data.candidatePin?.trim().toUpperCase();
    const existing = examCands.find(
      (c) =>
        (requestedPin && c.candidatePin === requestedPin) ||
        (data.studentId && c.studentId === data.studentId)
    );
    // A student provisioned again keeps their PIN, so printed slips stay valid
    const pin =
      requestedPin || existing?.candidatePin || uniquePin(new Set(examCands.map((c) => c.candidatePin)));

    const candId =
      existing?.id ||
      `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const candidate: StoredCandidate = {
      id: candId,
      examId: exam.id,
      candidateName: data.candidateName.trim(),
      candidatePin: pin,
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
    await kvAdapter.hashSet(IDX.examCands(exam.id), candId, candidate.candidatePin);

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

  /**
   * The candidate an examiner enrolled with this PIN, so their lobby can greet
   * them by name. Walk-ins aren't returned: they rejoin by typing their own name.
   */
  async findEnrolledCandidate(examId: string, pin: string): Promise<StoredCandidate | null> {
    const clean = String(pin || "").trim().toUpperCase();
    if (!clean) return null;
    const roster = await getExamCandidates(examId);
    return roster.find((c) => c.candidatePin === clean && !c.walkIn) || null;
  },

  /**
   * Adds a school's students to an exam's roster in one pass. A student already
   * on the roster (same ParaLearn id) keeps their PIN and is updated; new
   * students get a PIN unique within the exam.
   */
  async importRoster(
    examId: string,
    students: Array<{
      studentId: string;
      candidateName: string;
      email?: string | null;
      phone?: string | null;
      metadata?: Record<string, any> | null;
    }>
  ): Promise<{ candidates: StoredCandidate[]; created: number; updated: number }> {
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
    if (!exam) throw new CbtNotFoundError("Exam not found.");

    const roster = await getExamCandidates(exam.id);
    const byStudent = new Map(roster.filter((c) => c.studentId).map((c) => [c.studentId!, c]));
    const pinsInUse = new Set(roster.map((c) => c.candidatePin));
    const saved: StoredCandidate[] = [];
    const writes: Array<() => Promise<unknown>> = [];
    let created = 0;
    let updated = 0;

    for (const s of students) {
      if (!s?.studentId || !String(s.candidateName || "").trim()) continue;
      const existing = byStudent.get(s.studentId);
      const candidate: StoredCandidate = existing
        ? {
            ...existing,
            candidateName: s.candidateName.trim(),
            email: s.email || existing.email || null,
            phone: s.phone || existing.phone || null,
            metadata: { ...(existing.metadata || {}), ...(s.metadata || {}) },
          }
        : {
            id: `cand_${crypto.randomBytes(9).toString("hex")}`,
            examId: exam.id,
            candidateName: s.candidateName.trim(),
            candidatePin: uniquePin(pinsInUse),
            studentId: s.studentId,
            externalAttemptId: null,
            email: s.email || null,
            phone: s.phone || null,
            status: "REGISTERED",
            metadata: s.metadata || null,
            createdAt: new Date().toISOString(),
          };
      if (existing) updated++;
      else created++;
      pinsInUse.add(candidate.candidatePin);
      byStudent.set(s.studentId, candidate);
      writes.push(
        () => kvAdapter.hset(NS.candidate, candidate.id, candidate),
        () => kvAdapter.hashSet(IDX.examCands(exam.id), candidate.id, candidate.candidatePin)
      );
      saved.push(candidate);
    }
    // PINs are settled above, so the writes can go out in parallel batches
    for (let i = 0; i < writes.length; i += 20) {
      await Promise.all(writes.slice(i, i + 20).map((write) => write()));
    }
    return { candidates: saved, created, updated };
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
  /**
   * Starts or resumes a candidate's attempt.
   *  - The exam must be published, inside its opening window, and have questions.
   *  - ROSTER_ONLY exams admit only enrolled candidates (by PIN or the
   *    integrator's attempt id).
   *  - A PIN that matches no enrolment or attempt is refused rather than used
   *    to create one; a walk-in rejoining needs their PIN and their name.
   *  - The ParaLearn student id comes only from the examiner's roster.
   */
  async startAttempt(payload: {
    accessCode: string;
    candidateName: string;
    candidatePin?: string;
    email?: string;
    phone?: string;
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

    const now = new Date();
    if (exam.isPublished === false) {
      throw new CbtForbiddenError("This exam isn't open yet. Check with your examiner.");
    }
    if (exam.startsAt && now < new Date(exam.startsAt)) {
      throw new CbtForbiddenError(
        `This exam opens at ${new Date(exam.startsAt).toISOString()}. Come back then.`
      );
    }
    if (exam.endsAt && now > new Date(exam.endsAt)) {
      throw new CbtForbiddenError("This exam has closed.");
    }
    const questions = await this.getQuestionsForExam(exam.id);
    if (questions.length === 0) {
      throw new CbtConflictError("This exam has no questions yet. Check with your examiner.");
    }

    const pin = payload.candidatePin?.trim().toUpperCase() || "";
    const externalId = payload.externalAttemptId?.trim() || "";
    const [examCands, examAttempts] = await Promise.all([
      getExamCandidates(exam.id),
      getExamAttempts(exam.id),
    ]);

    // Only examiner-issued PINs identify a candidate on their own
    const enrolled = examCands.find(
      (c) =>
        !c.walkIn &&
        ((pin && c.candidatePin === pin) || (externalId && c.externalAttemptId === externalId))
    );
    const samePerson = (att: StoredAttempt) =>
      (pin && att.candidatePin === pin) || (externalId && att.externalAttemptId === externalId);
    const mine = examAttempts.filter(samePerson);

    if (exam.accessType === "ROSTER_ONLY" && !enrolled) {
      throw new CbtForbiddenError(
        pin
          ? "That PIN isn't registered for this exam. Check it with your examiner."
          : "This exam is only for registered candidates. Enter the PIN your examiner gave you."
      );
    }

    const running = mine.find((att) => att.status === "in_progress");
    if (running) {
      // An enrolled candidate's PIN identifies them; a walk-in must also give their name
      const nameMatches =
        normalizeName(running.candidateName) === normalizeName(payload.candidateName);
      if (!enrolled && !nameMatches && !(externalId && running.externalAttemptId === externalId)) {
        throw new CbtForbiddenError(
          "That participant ID belongs to someone else. Enter your own name and participant ID."
        );
      }
      running.answers = await getMergedAnswers(running);
      running.remainingSeconds = Math.max(
        0,
        Math.floor((new Date(running.deadline).getTime() - now.getTime()) / 1000)
      );
      return { attempt: running, exam, questions, isResumed: true };
    }

    const finished = mine.find((att) => att.status !== "in_progress");
    if (finished) {
      throw new CbtConflictError(
        finished.status === "disqualified"
          ? "This attempt was locked for malpractice. Contact your examiner."
          : "You have already submitted this exam. Contact your examiner if you need to retake it."
      );
    }
    if (pin && !enrolled) {
      throw new CbtNotFoundError(
        "We couldn't find that participant ID for this exam. Leave it blank to start, or check it with your examiner."
      );
    }

    // A walk-in gets a fresh PIN no one else in this exam has
    let candidatePin = enrolled?.candidatePin || "";
    if (!candidatePin) {
      const taken = new Set([...examCands, ...examAttempts].map((x) => x.candidatePin));
      do {
        candidatePin = crypto.randomInt(100000, 1000000).toString();
      } while (taken.has(candidatePin));
    }

    const durationMins = exam.durationMins || 60;
    const deadline = new Date(now.getTime() + durationMins * 60 * 1000).toISOString();
    const attemptId = `att_${crypto.randomBytes(12).toString("hex")}`;
    const attempt: StoredAttempt = {
      id: attemptId,
      examId: exam.id,
      examCode: exam.accessCode,
      candidateName: enrolled?.candidateName || payload.candidateName.trim(),
      candidatePin,
      email: payload.email || enrolled?.email || undefined,
      phone: payload.phone || enrolled?.phone || undefined,
      studentId: enrolled?.studentId || undefined,
      externalAttemptId: externalId || enrolled?.externalAttemptId || undefined,
      startedAt: now.toISOString(),
      deadline,
      durationMins,
      remainingSeconds: durationMins * 60,
      answers: {},
      violations: 0,
      status: "in_progress",
      tokenRequired: true,
      metadata: payload.metadata || enrolled?.metadata || {},
    };

    await kvAdapter.hset(NS.attempt, attemptId, attempt);
    await kvAdapter.hashSet(IDX.examAtts(exam.id), attemptId, candidatePin);
    if (attempt.externalAttemptId) {
      const extKey = `${NS.attemptByExternalId}:${attempt.externalAttemptId}`;
      if (!(await kvAdapter.get(extKey))) await kvAdapter.set(extKey, attemptId);
    }

    if (enrolled) {
      enrolled.status = "STARTED";
      if (externalId && !enrolled.externalAttemptId) enrolled.externalAttemptId = externalId;
      await kvAdapter.hset(NS.candidate, enrolled.id, enrolled);
    } else {
      const candId = `cand_${crypto.randomBytes(8).toString("hex")}`;
      const walkIn: StoredCandidate = {
        id: candId,
        examId: exam.id,
        candidateName: attempt.candidateName,
        candidatePin,
        email: payload.email,
        phone: payload.phone,
        studentId: null,
        externalAttemptId: externalId || null,
        status: "STARTED",
        walkIn: true,
        metadata: payload.metadata || null,
        createdAt: now.toISOString(),
      };
      await kvAdapter.hset(NS.candidate, candId, walkIn);
      await kvAdapter.hashSet(IDX.examCands(exam.id), candId, candidatePin);
    }

    return { attempt, exam, questions, isResumed: false };
  },

  /** Saves one answer as its own hash field, so rapid answers can't overwrite each other */
  async bufferAnswer(
    attemptId: string,
    questionId: string,
    selectedVal: any
  ): Promise<{ saved: boolean; reason?: string }> {
    if (!questionId) return { saved: false, reason: "questionId is required" };
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return { saved: false, reason: "Attempt not found" };
    if (att.status !== "in_progress") {
      return {
        saved: false,
        reason:
          att.status === "disqualified"
            ? "This attempt was locked for malpractice."
            : "This attempt has already been submitted.",
      };
    }
    const exam = await this.getExamById(att.examId);
    if (exam?.questionIds && !exam.questionIds.includes(questionId) && exam.id !== BUSI_EXAM.id) {
      return { saved: false, reason: "That question isn't part of this exam." };
    }
    if (Date.now() > new Date(att.deadline).getTime() + ANSWER_GRACE_MS) {
      return { saved: false, reason: "Time is up for this attempt." };
    }
    const isNew = await kvAdapter.hashSet(
      IDX.answers(attemptId),
      questionId,
      { v: selectedVal }
    );
    if (isNew) {
      // Progress is a monitor convenience; the answer itself is already saved
      await kvAdapter.hashIncrBy(IDX.examProgress(att.examId), attemptId, 1).catch(() => {});
    }
    return { saved: true };
  },

  async recordTelemetry(
    attemptId: string,
    eventType: string,
    eventId?: string
  ): Promise<{ violations: number; disqualified: boolean }> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return { violations: 0, disqualified: false };
    // Events arriving after submission must not reopen or alter a finished attempt
    if (att.status !== "in_progress") {
      return { violations: att.violations || 0, disqualified: att.status === "disqualified" };
    }
    // Offline devices resend reports until they are acknowledged; count each once
    const seenIds: string[] = att.metadata?.telemetryEventIds || [];
    if (eventId && seenIds.includes(eventId)) {
      return { violations: att.violations || 0, disqualified: false };
    }
    if (eventId) {
      att.metadata = {
        ...att.metadata,
        telemetryEventIds: [...seenIds, eventId].slice(-TELEMETRY_IDS_KEPT),
      };
    }
    att.violations = (att.violations || 0) + 1;
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, att.examId);
    const maxViolations = exam?.maxTabViolations ?? 3;
    const disqualified = att.violations >= maxViolations;
    if (disqualified) att.status = "disqualified";
    await kvAdapter.hset(NS.attempt, attemptId, att);
    return { violations: att.violations, disqualified };
  },

  /** Applies a computed score to the attempt and mirrors it onto the roster entry */
  async applyScore(att: StoredAttempt, questions: StoredQuestion[]) {
    const result = scoreAttempt(questions, att.answers || {}, att.manualMarks);
    att.score = result.score;
    att.totalMarks = result.totalMarks;
    att.percentage = result.percentage;
    att.grade = result.grade;
    att.gradingStatus = result.gradingStatus;
    att.mcqScore = result.mcqScore;
    att.essayScore = result.essayScore;
    att.correctCount = result.correctCount;
    att.wrongCount = result.wrongCount;
    att.unansweredCount = result.unansweredCount;
    await kvAdapter.hset(NS.attempt, att.id, att);

    try {
      const cands = await getExamCandidates(att.examId);
      const cand = cands.find(
        (c) =>
          c.candidatePin === att.candidatePin ||
          (att.studentId && c.studentId === att.studentId)
      );
      if (cand) {
        cand.status = att.status === "disqualified" ? "DISQUALIFIED" : "SUBMITTED";
        cand.score = att.score;
        cand.totalMarks = att.totalMarks;
        cand.percentage = att.percentage;
        await kvAdapter.hset(NS.candidate, cand.id, cand);
      }
    } catch (err) {
      // The attempt itself is saved; the roster entry is only a summary
      console.warn("[CBT] Could not update roster entry after scoring:", err);
    }
    return result;
  },

  async submitAttempt(
    attemptId: string,
    finalAnswers?: Record<string, any>,
    options: { claimedSubmittedAt?: string } = {}
  ): Promise<{
    attempt: StoredAttempt;
    webhookPayload: any;
    webhookUrl?: string;
    webhookSecret?: string;
    alreadySubmitted: boolean;
  } | null> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return null;

    const exam = await this.getExamById(att.examId);
    // Retried or duplicate submissions return the stored result instead of re-grading
    const alreadySubmitted = Boolean(att.submittedAt);

    if (!alreadySubmitted) {
      const buffered = await getMergedAnswers(att);
      // The candidate's device holds the complete answer sheet; it wins over the
      // buffer, except once the attempt was locked for malpractice
      att.answers =
        att.status === "disqualified" ? buffered : { ...buffered, ...(finalAnswers || {}) };
      if (att.status === "in_progress") att.status = "submitted";

      // A device that submitted offline sends the time it submitted; trust it
      // only within the attempt's own window, and flag late arrivals for review
      const receivedAt = Date.now();
      const startedAt = new Date(att.startedAt).getTime();
      const deadline = new Date(att.deadline).getTime();
      const claimed = options.claimedSubmittedAt
        ? new Date(options.claimedSubmittedAt).getTime()
        : NaN;
      const submittedAt =
        Number.isFinite(claimed) && claimed >= startedAt && claimed <= receivedAt
          ? claimed
          : receivedAt;
      att.submittedAt = new Date(submittedAt).toISOString();
      att.metadata = {
        ...att.metadata,
        sync: {
          receivedAt: new Date(receivedAt).toISOString(),
          claimedSubmittedAt: options.claimedSubmittedAt || null,
          syncedLate: receivedAt > deadline + LATE_SYNC_TOLERANCE_MS,
          overtime: submittedAt > deadline + LATE_SYNC_TOLERANCE_MS,
        },
      };
      const questions = await this.getQuestionsForExam(att.examId);
      await this.applyScore(att, questions);
    }

    const target = await this.webhookTarget(exam);
    const webhookPayload = attemptWebhookPayload(att, exam, "exam.attempt.completed");

    return {
      attempt: att,
      webhookPayload,
      webhookUrl: target.url,
      webhookSecret: target.secret,
      alreadySubmitted,
    };
  },

  /** Full answer sheet with marking, for the examiner's review and grading screens */
  async getAttemptReview(attemptId: string) {
    const att = await this.getAttempt(attemptId);
    if (!att) return null;
    if (att.status === "in_progress") {
      throw new CbtConflictError("This attempt is still in progress and cannot be reviewed yet.");
    }
    const exam = await this.getExamById(att.examId);
    const questions = await this.getQuestionsForExam(att.examId);
    const answers = await getMergedAnswers(att);
    const result = scoreAttempt(questions, answers, att.manualMarks);
    const ws = exam ? await this.getWorkspace(exam.workspaceId) : null;

    return {
      attemptId: att.id,
      examId: att.examId,
      examTitle: exam?.title || "CBT Assessment",
      accessCode: att.examCode,
      institutionName: ws?.name,
      candidateName: att.candidateName,
      candidatePin: att.candidatePin,
      studentId: att.studentId || null,
      status: toApiStatus(att.status),
      gradingStatus: result.gradingStatus,
      score: result.score,
      totalMarks: result.totalMarks,
      percentage: result.percentage,
      grade: result.grade,
      violations: att.violations || 0,
      submittedAt: att.submittedAt || null,
      sync: att.metadata?.sync || null,
      questions: questions.map((q, idx) => ({
        id: q.id,
        prompt: q.prompt,
        // The grading UI treats every essay variant as "ESSAY"
        type: isEssayType(q.type) ? "ESSAY" : q.type,
        marks: q.marks || 1,
        options: q.options,
        explanation: q.explanation,
        minWords: q.minWords,
        maxWords: q.maxWords,
        modelAnswer: q.modelAnswer,
        keyTerms: q.keyTerms,
        rubric: q.rubric || null,
        orderIndex: idx,
        answer: answers[q.id] ?? null,
        marksAwarded: result.perQuestion[q.id]?.marksAwarded,
        isCorrect: result.perQuestion[q.id]?.isCorrect ?? null,
        feedback: att.feedback?.byQuestion?.[q.id] ?? null,
      })),
      feedback: att.feedback || null,
    };
  },

  /** Where an exam's events go: its workspace's webhook URL and signing secret */
  async webhookTarget(exam: StoredExam | null): Promise<{ url?: string; secret?: string }> {
    if (!exam) return {};
    const ws = await this.getWorkspace(examWorkspaceId(exam));
    return { url: ws?.webhookUrl || undefined, secret: ws?.webhookSecret || undefined };
  },

  /** The "graded" event for an attempt whose essays have all been marked */
  async gradedWebhook(attemptId: string) {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att || att.gradingStatus !== "GRADED") return null;
    const exam = await this.getExamById(att.examId);
    const target = await this.webhookTarget(exam);
    return { payload: attemptWebhookPayload(att, exam, "exam.attempt.graded"), ...target };
  },

  async manualGradeAttempt(
    attemptId: string,
    grades: Array<{ questionId: string; marksAwarded: number; feedback?: string }>,
    comment?: string
  ) {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) return null;
    if (att.status === "in_progress") {
      throw new CbtConflictError("Wait for the candidate to submit before grading.");
    }
    const questions = await this.getQuestionsForExam(att.examId);
    const byId = new Map<string, StoredQuestion>(questions.map((q) => [q.id, q]));
    att.manualMarks = { ...(att.manualMarks || {}) };
    for (const g of grades || []) {
      const q = byId.get(g.questionId);
      if (!q) continue;
      const max = q.marks || 1;
      const marks = Number(g.marksAwarded);
      att.manualMarks[q.id] = Math.min(max, Math.max(0, Number.isFinite(marks) ? marks : 0));
      if (typeof g.feedback === "string") {
        att.feedback = {
          ...att.feedback,
          byQuestion: { ...(att.feedback?.byQuestion || {}), [q.id]: g.feedback.trim().slice(0, 5000) },
        };
      }
    }
    if (typeof comment === "string") {
      att.feedback = { ...att.feedback, comment: comment.trim().slice(0, 5000) };
    }
    if (att.feedback) att.feedback.gradedAt = new Date().toISOString();
    att.answers = await getMergedAnswers(att);
    await this.applyScore(att, questions);
    return this.getAttemptReview(attemptId);
  },

  /** Everyone on an exam: attempts (with progress and scores) plus roster entries not yet started */
  async getExamMonitor(examId: string) {
    const exam = await this.getExamById(examId);
    const [cands, atts, progress] = await Promise.all([
      getExamCandidates(examId),
      getExamAttempts(examId),
      kvAdapter.hashGetAll<number>(IDX.examProgress(examId)),
    ]);
    const totalQuestions = exam?.totalQuestions || exam?.questionIds?.length || 0;

    const participants: any[] = atts
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((att) => ({
        id: att.id,
        attemptId: att.id,
        candidateName: att.candidateName,
        candidatePin: att.candidatePin,
        studentId: att.studentId || null,
        attemptStatus: toApiStatus(att.status),
        gradingStatus: att.submittedAt ? att.gradingStatus || "AUTO_SCORED" : undefined,
        startedAt: att.startedAt,
        submittedAt: att.submittedAt || null,
        deadline: att.deadline,
        answeredCount: att.submittedAt
          ? Object.keys(att.answers || {}).length
          : Number(progress[att.id]) || 0,
        totalQuestions,
        violations: att.violations || 0,
        // Submitted offline and received after the deadline: worth a second look
        syncedLate: Boolean(att.metadata?.sync?.syncedLate),
        overtime: Boolean(att.metadata?.sync?.overtime),
        score: att.submittedAt ? att.score ?? 0 : null,
        totalMarks: att.totalMarks ?? exam?.totalMarks,
        percentage: att.percentage ?? null,
        grade: att.gradingStatus === "PENDING_REVIEW" ? null : att.grade ?? null,
      }));

    const startedPins = new Set(atts.map((a) => a.candidatePin));
    for (const c of cands) {
      if (startedPins.has(c.candidatePin)) continue;
      participants.push({
        id: c.id,
        attemptId: null,
        candidateName: c.candidateName,
        candidatePin: c.candidatePin,
        studentId: c.studentId || null,
        rosterStatus: "REGISTERED",
        answeredCount: 0,
        totalQuestions,
        violations: 0,
        score: null,
        totalMarks: exam?.totalMarks,
      });
    }

    const submitted = atts.filter((a) => a.submittedAt);
    const scored = submitted.filter((a) => typeof a.percentage === "number");
    return {
      examId,
      examTitle: exam?.title || "Exam Monitor",
      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            accessCode: exam.accessCode,
            totalQuestions,
            totalMarks: exam.totalMarks,
          }
        : null,
      totalCandidates: participants.length,
      activeNow: atts.filter((a) => a.status === "in_progress").length,
      submitted: submitted.length,
      disqualified: atts.filter((a) => a.status === "disqualified").length,
      pendingReview: submitted.filter((a) => a.gradingStatus === "PENDING_REVIEW").length,
      averageScore: scored.length
        ? Math.round(scored.reduce((sum, a) => sum + (a.percentage || 0), 0) / scored.length)
        : 0,
      participants,
      candidates: cands,
    };
  },

  /** Exact lookup by our attempt id (no scan) */
  async getAttemptById(attemptId: string): Promise<StoredAttempt | null> {
    if (!attemptId) return null;
    return kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
  },

  /** Gives a candidate extra time on a running attempt */
  async extendAttempt(attemptId: string, minutes: number): Promise<StoredAttempt> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) throw new CbtNotFoundError("Attempt not found");
    if (att.status !== "in_progress") {
      throw new CbtConflictError("Only a candidate who is still writing can be given extra time.");
    }
    const add = Math.round(Number(minutes));
    if (!Number.isFinite(add) || add < 1 || add > 240) {
      throw new CbtValidationError("Extra time must be between 1 and 240 minutes.");
    }
    att.deadline = new Date(new Date(att.deadline).getTime() + add * 60 * 1000).toISOString();
    att.metadata = {
      ...att.metadata,
      extraMinutes: (att.metadata?.extraMinutes || 0) + add,
    };
    await kvAdapter.hset(NS.attempt, att.id, att);
    return att;
  },

  /**
   * Lets a candidate locked for tab switching continue: the attempt reopens
   * with its answers, violations reset, and at least 5 minutes on the clock.
   * The candidate rejoins from the lobby with their name and participant ID.
   */
  async reinstateAttempt(attemptId: string): Promise<StoredAttempt> {
    const att = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (!att) throw new CbtNotFoundError("Attempt not found");
    if (att.status !== "disqualified") {
      throw new CbtConflictError("Only a locked attempt can be reinstated.");
    }
    const answers = await getMergedAnswers(att);
    const minDeadline = Date.now() + 5 * 60 * 1000;
    Object.assign(att, {
      status: "in_progress" as const,
      answers,
      violations: 0,
      submittedAt: undefined,
      score: undefined,
      percentage: undefined,
      grade: undefined,
      gradingStatus: undefined,
      deadline: new Date(Math.max(new Date(att.deadline).getTime(), minDeadline)).toISOString(),
      metadata: { ...att.metadata, reinstatedAt: new Date().toISOString(), sync: undefined },
    });
    await kvAdapter.hset(NS.attempt, att.id, att);
    const cand = (await getExamCandidates(att.examId)).find((c) => c.candidatePin === att.candidatePin);
    if (cand) {
      cand.status = "STARTED";
      await kvAdapter.hset(NS.candidate, cand.id, cand);
    }
    return att;
  },

  /** Deletes an exam nobody has taken; one with attempts should be unpublished instead */
  async deleteExam(examId: string): Promise<void> {
    const exam = await kvAdapter.hget<StoredExam>(NS.exam, examId);
    if (!exam) throw new CbtNotFoundError("Exam not found");
    if ((await getExamAttempts(examId)).length > 0) {
      throw new CbtConflictError(
        "Candidates have already taken this exam, so it can't be deleted. Unpublish it instead."
      );
    }
    for (const cand of await getExamCandidates(examId)) {
      await kvAdapter.del(`${NS.candidate}:${cand.id}`);
    }
    await kvAdapter.del(IDX.examCands(examId));
    await kvAdapter.del(IDX.examAtts(examId));
    await kvAdapter.del(`${NS.examByCode}:${exam.accessCode}`);
    await kvAdapter.del(`${NS.exam}:reportcard:${examId}`);
    await kvAdapter.del(`${NS.exam}:${examId}`);
  },

  /** Results as a CSV sheet, one row per attempt */
  async examResultsCsv(examId: string): Promise<string> {
    const exam = await this.getExamById(examId);
    const attempts = (await getExamAttempts(examId)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const cell = (v: unknown) => {
      const text = v === null || v === undefined ? "" : String(v);
      // Quote everything and neutralise spreadsheet formulas
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = [
      "Candidate", "PIN", "Student ID", "Status", "Score", "Total marks", "Percentage",
      "Grade", "Grading", "Correct", "Wrong", "Unanswered", "Tab switches",
      "Started", "Submitted", "Synced late",
    ];
    const rows = attempts.map((a) => [
      a.candidateName, a.candidatePin, a.studentId, toApiStatus(a.status),
      a.submittedAt ? a.score ?? 0 : "", a.totalMarks ?? exam?.totalMarks ?? "",
      a.submittedAt ? a.percentage ?? "" : "", a.submittedAt ? a.grade ?? "" : "",
      a.gradingStatus ?? "", a.correctCount ?? "", a.wrongCount ?? "", a.unansweredCount ?? "",
      a.violations ?? 0, a.startedAt, a.submittedAt ?? "", a.metadata?.sync?.syncedLate ? "yes" : "",
    ]);
    return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  },

  async getAttempt(attemptId: string): Promise<StoredAttempt | null> {
    if (!attemptId) return null;
    const direct = await kvAdapter.hget<StoredAttempt>(NS.attempt, attemptId);
    if (direct) return direct;
    // An integrator's own attempt id, through its index
    const byExternal = await kvAdapter.get<string>(`${NS.attemptByExternalId}:${attemptId}`);
    if (byExternal) return kvAdapter.hget<StoredAttempt>(NS.attempt, byExternal);
    // Attempts saved before the index existed are indexed in one pass; after that
    // an unknown id is a single lookup instead of a scan of every attempt
    if (await kvAdapter.get(ATTEMPT_EXTERNAL_INDEX_BUILT)) return null;
    const all = await kvAdapter.hlist<StoredAttempt>(NS.attempt);
    let match: StoredAttempt | null = null;
    for (const a of all) {
      if (!a.externalAttemptId) continue;
      const key = `${NS.attemptByExternalId}:${a.externalAttemptId}`;
      if (!(await kvAdapter.get(key))) await kvAdapter.set(key, a.id);
      if (!match && a.externalAttemptId === attemptId) match = a;
    }
    await kvAdapter.set(ATTEMPT_EXTERNAL_INDEX_BUILT, "1");
    return match;
  },

  async listCandidates(examId: string): Promise<StoredCandidate[]> {
    return getExamCandidates(examId);
  },

  /** Removes a roster entry by id, or by exam + PIN (for entries mirrored from the CBT service) */
  /**
   * Finished results ready for report cards: the latest per ParaLearn student,
   * plus what can't be released yet (essays awaiting grading, walk-in
   * candidates without a ParaLearn student id, attempts still running).
   */
  async getReportCardResults(examId: string) {
    const exam = await this.getExamById(examId);
    const attempts = await getExamAttempts(examId);
    const latest = new Map<string, StoredAttempt>();
    const unlinked: Array<{ candidateName: string; candidatePin: string }> = [];
    const pendingReview: Array<{ candidateName: string; candidatePin: string }> = [];
    let inProgress = 0;

    for (const att of attempts) {
      if (att.status === "in_progress") {
        inProgress++;
      } else if (att.gradingStatus === "PENDING_REVIEW") {
        pendingReview.push({ candidateName: att.candidateName, candidatePin: att.candidatePin });
      } else if (!att.studentId) {
        unlinked.push({ candidateName: att.candidateName, candidatePin: att.candidatePin });
      } else {
        const prev = latest.get(att.studentId);
        if (!prev || (att.submittedAt || "") > (prev.submittedAt || "")) latest.set(att.studentId, att);
      }
    }

    const scores = [...latest.values()].map((att) => ({
      studentId: att.studentId as string,
      candidateName: att.candidateName,
      marksAwarded: att.score ?? 0,
      maxMarks: att.totalMarks || exam?.totalMarks || 0,
      attemptId: att.id,
    }));
    return { exam, scores, unlinked, pendingReview, inProgress };
  },

  /** What was last released to report cards for an exam (kept apart from the exam record) */
  async getReportCardRelease(examId: string): Promise<CbtReportCardRelease | null> {
    return kvAdapter.get<CbtReportCardRelease>(`${NS.exam}:reportcard:${examId}`);
  },

  async setReportCardRelease(examId: string, release: CbtReportCardRelease | null) {
    const key = `${NS.exam}:reportcard:${examId}`;
    if (release) await kvAdapter.set(key, release);
    else await kvAdapter.del(key);
  },

  async getCandidate(id: string): Promise<StoredCandidate | null> {
    return kvAdapter.hget<StoredCandidate>(NS.candidate, id);
  },

  async deleteCandidate(ref: { id?: string; examId?: string; pin?: string }): Promise<boolean> {
    let cand = ref.id ? await kvAdapter.hget<StoredCandidate>(NS.candidate, ref.id) : null;
    if (!cand && ref.examId && ref.pin) {
      cand = (await getExamCandidates(ref.examId)).find((c) => c.candidatePin === ref.pin) || null;
    }
    if (!cand) return false;
    await kvAdapter.del(`${NS.candidate}:${cand.id}`);
    await kvAdapter.hashDel(IDX.examCands(cand.examId), cand.id);
    return true;
  },
};
