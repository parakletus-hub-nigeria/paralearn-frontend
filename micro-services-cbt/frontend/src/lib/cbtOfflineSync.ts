/**
 * Candidate offline sync (browser only).
 *
 * Answers, tab-switch reports and the final submission go into the shared
 * outbox (public/cbt-outbox.js, IndexedDB) and are sent in order whenever the
 * device is online: on reconnect, when the tab becomes visible, every 15s, and
 * through the service worker's Background Sync after the tab is closed.
 *
 * The exam is fully usable offline once it has started: questions live in the
 * candidate session, the pages and app files are cached by public/cbt-sw.js,
 * and a submission made offline is sent and scored when the device reconnects.
 */
import {
  loadCandidateSession,
  saveCandidateSession,
  type CandidateSession,
} from "./cbtSessionManager";

type OpKind = "answer" | "telemetry" | "submit";

interface OutboxOpInput {
  kind: OpKind;
  attemptId: string;
  payload: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

interface OutboxOp extends OutboxOpInput {
  key: string;
  createdAt: string;
}

interface SubmitResult {
  attemptId: string;
  ok: boolean;
  status: number;
  body: any;
  meta: { examCode?: string; candidatePin?: string };
}

interface CbtOutboxApi {
  PAGES_CACHE: string;
  STATIC_CACHE: string;
  SYNC_TAG: string;
  enqueue(op: OutboxOpInput): Promise<unknown>;
  flush(): Promise<{ sent: number; remaining: number }>;
  pending(attemptId?: string): Promise<OutboxOp[]>;
  takeResults(): Promise<SubmitResult[]>;
}

declare global {
  interface Window {
    CbtOutbox?: CbtOutboxApi;
  }
}

const SYNC_INTERVAL_MS = 15000;
const PAGES_CACHE = "cbt-pages-v1";
const STATIC_CACHE = "cbt-static-v1";

/** Fired on window when a queued submission is accepted or rejected by the server */
export const SUBMISSION_SYNCED_EVENT = "cbt:submission-synced";

export interface CbtSyncState {
  online: boolean;
  /** Operations still waiting to be sent */
  pending: number;
}

let state: CbtSyncState = { online: true, pending: 0 };
const listeners = new Set<(s: CbtSyncState) => void>();

function setState(patch: Partial<CbtSyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function subscribeSyncState(fn: (s: CbtSyncState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

// ── Outbox loading ────────────────────────────────────────────────────────────

let outboxPromise: Promise<CbtOutboxApi | null> | null = null;

function loadOutbox(): Promise<CbtOutboxApi | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (window.CbtOutbox) return Promise.resolve(window.CbtOutbox);
  if (!outboxPromise) {
    outboxPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/cbt-outbox.js";
      script.async = true;
      script.onload = () => resolve(window.CbtOutbox ?? null);
      script.onerror = () => {
        outboxPromise = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
  return outboxPromise;
}

// ── Sync loop ─────────────────────────────────────────────────────────────────

let started = false;

/** Starts syncing for this tab. Safe to call from every exam page. */
export function startCbtSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  setState({ online: navigator.onLine });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/cbt-sw.js", { scope: "/take" }).catch((err) => {
      console.warn("[CBT Sync] Service worker registration failed:", err);
    });
  }

  window.addEventListener("online", () => {
    setState({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => setState({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncNow();
  });
  window.setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
  void syncNow();
}

let syncing: Promise<void> | null = null;
let rerun = false;

/**
 * Sends whatever is queued (if online) and applies any submission results.
 * The returned promise settles after a pass that started after this call, so
 * something queued just before is included.
 */
export function syncNow(): Promise<void> {
  if (syncing) {
    rerun = true;
    return syncing;
  }
  syncing = (async () => {
    do {
      rerun = false;
      await runSync();
    } while (rerun);
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function runSync() {
  const outbox = await loadOutbox();
  if (!outbox) return;
  if (navigator.onLine !== false) {
    try {
      await outbox.flush();
    } catch (err) {
      console.warn("[CBT Sync] Flush failed:", err);
    }
  }
  try {
    await applyResults(outbox);
    setState({ pending: (await outbox.pending()).length });
  } catch (err) {
    console.warn("[CBT Sync] Could not read the outbox:", err);
  }
}

function requestBackgroundSync(tag: string) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg: any) => reg.sync?.register(tag))
    .catch(() => {});
}

// ── Submission results ────────────────────────────────────────────────────────

function applySubmitResult(session: CandidateSession, result: SubmitResult): CandidateSession {
  if (!result.ok) {
    return {
      ...session,
      pendingSubmit: session.pendingSubmit && {
        ...session.pendingSubmit,
        error:
          result.body?.message ||
          "The exam server did not accept this submission. Please contact your examiner.",
      },
    };
  }
  const body = result.body || {};
  const reason = session.pendingSubmit?.reason;
  return {
    ...session,
    pendingSubmit: undefined,
    status:
      body.status === "DISQUALIFIED" || reason === "malpractice" ? "disqualified" : "submitted",
    gradingStatus: body.gradingStatus || "AUTO_SCORED",
    score: body.score,
    totalMarks: body.totalMarks,
    percentage: body.percentage,
    mcqScore: body.resultSlip?.breakdown?.mcqScore,
    essayScore: body.resultSlip?.breakdown?.essayScore,
  };
}

function recordResult(result: SubmitResult) {
  const { examCode, candidatePin } = result.meta || {};
  if (examCode && candidatePin) {
    const session = loadCandidateSession(examCode, candidatePin);
    if (session) saveCandidateSession(applySubmitResult(session, result));
  }
  window.dispatchEvent(
    new CustomEvent(SUBMISSION_SYNCED_EVENT, {
      detail: { examCode, attemptId: result.attemptId, ok: result.ok },
    }),
  );
}

async function applyResults(outbox: CbtOutboxApi) {
  for (const result of await outbox.takeResults()) recordResult(result);
}

// ── Queueing ──────────────────────────────────────────────────────────────────

/** Without IndexedDB there is no queue: send straight away, as before */
async function sendDirect(op: OutboxOpInput) {
  try {
    const res = await fetch(
      `/api/cbt/attempts/${encodeURIComponent(op.attemptId)}/${op.kind}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op.payload),
      },
    );
    const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
    if (op.kind === "submit" && !retryable) {
      recordResult({
        attemptId: op.attemptId,
        ok: res.ok,
        status: res.status,
        body: await res.json().catch(() => ({})),
        meta: (op.meta || {}) as SubmitResult["meta"],
      });
    }
  } catch {
    // Offline: an unsent submission is queued again from session.pendingSubmit
  }
}

async function enqueue(op: OutboxOpInput) {
  const outbox = await loadOutbox();
  if (!outbox) {
    await sendDirect(op);
    return;
  }
  await outbox.enqueue(op);
  setState({ pending: state.pending + 1 });
  requestBackgroundSync(outbox.SYNC_TAG);
  void syncNow();
}

/** The device clock, corrected to the server's at the start of the attempt */
export function deviceNow(session: Pick<CandidateSession, "clockOffsetMs">): number {
  return Date.now() + (session.clockOffsetMs || 0);
}

export function queueAnswer(session: CandidateSession, questionId: string, value: unknown) {
  if (!session.attemptId) return Promise.resolve();
  return enqueue({
    kind: "answer",
    attemptId: session.attemptId,
    payload: {
      questionId,
      selectedVal: value,
      answeredAt: new Date(deviceNow(session)).toISOString(),
    },
  });
}

export function queueTelemetry(session: CandidateSession, eventType: string, questionIdx: number) {
  if (!session.attemptId) return Promise.resolve();
  return enqueue({
    kind: "telemetry",
    attemptId: session.attemptId,
    payload: {
      eventType,
      questionIdx,
      // Lets the server ignore a report it already counted
      eventId: `${session.attemptId}:${eventType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      occurredAt: new Date(deviceNow(session)).toISOString(),
    },
  });
}

/** Queues the final submission; session.pendingSubmit must already be saved */
export function queueSubmission(session: CandidateSession, answers: Record<string, unknown>) {
  if (!session.attemptId || !session.pendingSubmit) return Promise.resolve();
  return enqueue({
    kind: "submit",
    attemptId: session.attemptId,
    payload: {
      finalAnswers: answers,
      autoSubmitted: session.pendingSubmit.reason !== "manual",
      submittedAt: session.pendingSubmit.submittedAt,
    },
    meta: { examCode: session.examCode, candidatePin: session.candidatePin },
  });
}

export async function hasQueuedSubmission(attemptId: string): Promise<boolean> {
  const outbox = await loadOutbox();
  if (!outbox) return false;
  return (await outbox.pending(attemptId)).some((op) => op.kind === "submit");
}

// ── Offline pages ─────────────────────────────────────────────────────────────

/**
 * Saves this exam's pages and the app files they load, so the candidate can
 * reload or reopen the exam without a connection. Best effort.
 */
export async function warmOfflineCache(examCode: string): Promise<void> {
  if (typeof window === "undefined" || typeof caches === "undefined") return;
  const code = encodeURIComponent(examCode);
  const assetPattern = /\/_next\/static\/[^"'\s)\\]+/g;
  try {
    const [pagesCache, staticCache] = await Promise.all([
      caches.open(PAGES_CACHE),
      caches.open(STATIC_CACHE),
    ]);
    const assets = new Set<string>(["/cbt-outbox.js"]);

    for (const path of [`/take/${code}`, `/take/${code}/live`, `/take/${code}/results`]) {
      try {
        const res = await fetch(path, { credentials: "same-origin" });
        if (!res.ok) continue;
        const html = await res.clone().text();
        await pagesCache.put(path, res);
        for (const match of html.match(assetPattern) || []) assets.add(match);
      } catch {}
    }
    for (const entry of performance.getEntriesByType("resource")) {
      const url = new URL(entry.name);
      if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) {
        assets.add(url.pathname + url.search);
      }
    }

    await Promise.all(
      [...assets].map(async (asset) => {
        if (await staticCache.match(asset)) return;
        await staticCache.add(asset).catch(() => {});
      }),
    );
  } catch (err) {
    console.warn("[CBT Sync] Could not save the exam for offline use:", err);
  }
}
