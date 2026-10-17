/**
 * CBT examiner authentication (server only).
 *
 * One sign-in for both kinds of examiner:
 *  - ParaLearn school staff are verified against ParaLearn Core and land in
 *    their school's INSTITUTION workspace.
 *  - Independent examiners are verified against the password hash stored on
 *    their STANDALONE_HALL workspace.
 *
 * A signed, httpOnly session cookie carries the result. External integrations
 * keep using their workspace API key.
 */
import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cbtServerStore, type StoredWorkspace } from "@/lib/cbtServerStore";

export const CBT_SESSION_COOKIE = "pln_cbt_auth";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SELECTION_TTL_SECONDS = 5 * 60;

/** ParaLearn roles allowed to run a school's CBT workspace */
const STAFF_ROLES = ["admin", "principal", "teacher", "vp", "vice_principal"];

export type CbtWorkspaceType = "INSTITUTION" | "STANDALONE_HALL";

export interface CbtSession {
  kind: "session";
  wsId: string;
  type: CbtWorkspaceType;
  email: string;
  name: string;
  schoolId?: string;
  exp: number;
}

/** Issued when one email matches both a school account and an exam hall */
interface CbtSelection {
  kind: "selection";
  email: string;
  choices: CbtSessionInput[];
  exp: number;
}

export type CbtSessionInput = Omit<CbtSession, "kind" | "exp">;

export interface CbtPrincipal {
  wsId: string;
  type: CbtWorkspaceType;
  email: string | null;
  schoolId?: string;
  via: "session" | "apiKey";
}

// ── Signed tokens ─────────────────────────────────────────────────────────────

function sessionSecret(): string {
  const secret = process.env.CBT_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CBT_SESSION_SECRET is not configured");
  }
  return "dev-only-cbt-session-secret";
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign<T extends { exp: number }>(payload: Omit<T, "exp">, ttlSeconds: number): string {
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  );
  const mac = crypto.createHmac("sha256", sessionSecret()).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function verify<T extends { exp: number; kind: string }>(token: string, kind: T["kind"]): T | null {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest();
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (payload.kind !== kind || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export const signSession = (input: CbtSessionInput) =>
  sign<CbtSession>({ ...input, kind: "session" }, SESSION_TTL_SECONDS);

export const signSelection = (email: string, choices: CbtSessionInput[]) =>
  sign<CbtSelection>({ kind: "selection", email, choices }, SELECTION_TTL_SECONDS);

export const verifySelection = (token: string) => verify<CbtSelection>(token, "selection");

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(CBT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(CBT_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Resolves the caller from the session cookie, or a workspace API key */
export async function getPrincipal(request: NextRequest): Promise<CbtPrincipal | null> {
  const cookie = request.cookies.get(CBT_SESSION_COOKIE)?.value;
  const session = cookie ? verify<CbtSession>(cookie, "session") : null;
  if (session) {
    return {
      wsId: session.wsId,
      type: session.type,
      email: session.email,
      schoolId: session.schoolId,
      via: "session",
    };
  }

  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : request.headers.get("x-api-key")?.trim();
  if (apiKey) {
    const ws = await cbtServerStore.findWorkspaceByApiKey(apiKey);
    if (ws && ws.apiKey === apiKey) {
      return {
        wsId: ws.id,
        type: ws.type === "INSTITUTION" ? "INSTITUTION" : "STANDALONE_HALL",
        email: ws.ownerEmail || null,
        schoolId: ws.externalId,
        via: "apiKey",
      };
    }
  }
  return null;
}

// ── Attempt tokens ────────────────────────────────────────────────────────────
// A candidate has no account. Starting an attempt returns a token that only
// that device holds; answers, reports, submission and the result slip need it.

export function attemptToken(attemptId: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(`attempt:${attemptId}`).digest("base64url");
}

export function verifyAttemptToken(attemptId: string, token?: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(attemptToken(attemptId));
  const actual = Buffer.from(String(token));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Webhook targets must be public HTTPS endpoints (no internal addresses) */
export function isSafeWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // Local testing only: never set this in production
  if (process.env.CBT_WEBHOOK_ALLOW_INSECURE === "1") return url.protocol === "http:" || url.protocol === "https:";
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return false;
  }
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) {
      return false;
    }
  }
  if (host.includes(":")) {
    // IPv6 literals: refuse loopback, link-local and unique-local ranges
    if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd") || host === "::") return false;
  }
  return true;
}

// ── Passwords ─────────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "base64"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Checks an exam hall password. Halls created before passwords existed have
 * none (or a legacy plaintext one); the first successful sign-in stores a hash.
 */
async function verifyStandalonePassword(ws: StoredWorkspace, password: string): Promise<boolean> {
  if (ws.passwordHash) return verifyPasswordHash(password, ws.passwordHash);

  if (ws.password) {
    const a = Buffer.from(ws.password);
    const b = Buffer.from(password);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    return false;
  } else {
    console.warn(`[CBT Auth] Exam hall ${ws.id} had no password; first sign-in set it.`);
  }

  await cbtServerStore.setWorkspacePassword(ws.id, hashPassword(password));
  return true;
}

// ── ParaLearn Core (school staff) ────────────────────────────────────────────

function coreApiBase(): string | null {
  const url = process.env.K12_BACKEND_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function cbtServiceBase(): string {
  return (
    process.env.CBT_BACKEND_URL ||
    process.env.NEXT_PUBLIC_CBT_API_URL ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

/** Headers for server-to-server calls to the Nest CBT service */
export function cbtServiceHeaders(): Record<string, string> {
  const key = process.env.CBT_SERVICE_SECRET?.trim();
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-cbt-service-key": key } : {}),
  };
}

export class CoreUnavailableError extends Error {}

/** A ParaLearn Core call that failed; status and message are safe to show */
export class CoreRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Calls one of ParaLearn Core's service endpoints for the CBT
 * (non-tenant/cbt-import/*), authenticated with the shared service key.
 * Returns null for an empty response body.
 */
export async function callCore<T = any>(path: string, body: unknown): Promise<T | null> {
  const base = coreApiBase();
  if (!base) throw new CoreRequestError(503, "ParaLearn isn't configured for the CBT yet.");

  let res: Response;
  try {
    res = await fetch(`${base}/non-tenant/cbt-import/${path}`, {
      method: "POST",
      headers: cbtServiceHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new CoreRequestError(503, "ParaLearn can't be reached right now. Please try again.");
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(" ") : data?.message;
    throw new CoreRequestError(
      res.status >= 500 ? 502 : res.status,
      message || "ParaLearn couldn't complete the request."
    );
  }
  return data as T | null;
}

interface CoreStaff {
  email: string;
  name: string;
  schoolId: string;
  schoolName: string;
}

/**
 * Verifies the credentials with ParaLearn Core. Returns the staff member and
 * their school, or null when the credentials are wrong or the account is not
 * school staff (e.g. a student).
 */
async function verifyCoreStaff(email: string, password: string): Promise<CoreStaff | null> {
  const base = coreApiBase();
  if (!base) return null;

  // Core can take several seconds to answer while its host wakes up, so allow
  // for that and try once more when the connection fails or the host is busy
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      });
    } catch (err) {
      if (attempt === 0 && !(err instanceof Error && err.name === "TimeoutError")) continue;
      throw new CoreUnavailableError("ParaLearn sign-in is unavailable");
    }
    if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) continue;
    break;
  }
  if (!res) throw new CoreUnavailableError("ParaLearn sign-in is unavailable");
  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }
  if (!res.ok) throw new CoreUnavailableError("ParaLearn sign-in is unavailable");

  const raw = await res.json().catch(() => ({}));
  const data = raw?.data ?? raw;
  const token: string | undefined = data?.accessToken ?? raw?.accessToken;
  let claims: any = {};
  if (token) {
    try {
      claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    } catch {}
  }
  const user = data?.user ?? raw?.user ?? {};
  const roleSource: any[] = Array.isArray(claims.roles) ? claims.roles : user.roles || [];
  const roles = roleSource.map((r: any) =>
    String(typeof r === "string" ? r : r?.role?.name ?? r?.name ?? "").toLowerCase()
  );
  const schoolId: string | undefined = claims.schoolId ?? user.schoolId ?? data?.school?.id;
  if (!schoolId || !roles.some((r) => STAFF_ROLES.includes(r))) return null;

  const school = data?.school ?? raw?.school ?? user.school ?? {};
  return {
    email: String(claims.email ?? user.email ?? email).toLowerCase(),
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || email,
    schoolId,
    schoolName: school.name || "School Workspace",
  };
}

/**
 * Finds or creates the school's workspace. The Nest CBT service owns the
 * ParaLearn link (it imports rosters), so its workspace id is reused here.
 */
async function ensureInstitutionWorkspace(staff: CoreStaff): Promise<StoredWorkspace> {
  let id: string | undefined;
  try {
    const res = await fetch(`${cbtServiceBase()}/workspaces/institution`, {
      method: "POST",
      headers: cbtServiceHeaders(),
      body: JSON.stringify({
        schoolId: staff.schoolId,
        schoolName: staff.schoolName,
        email: staff.email,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) id = (await res.json())?.id;
    else console.warn(`[CBT Auth] CBT service returned ${res.status} for institution sync`);
  } catch (err) {
    console.warn("[CBT Auth] Could not sync institution workspace with CBT service:", err);
  }

  return cbtServerStore.upsertInstitutionWorkspace({
    id,
    schoolId: staff.schoolId,
    name: staff.schoolName,
    ownerEmail: staff.email,
  });
}

/**
 * Every workspace these credentials can open. Most people get exactly one;
 * an email that is both school staff and an exam hall owner gets two.
 */
export async function resolveSignInChoices(
  email: string,
  password: string
): Promise<CbtSessionInput[]> {
  const cleanEmail = email.trim().toLowerCase();
  const choices: CbtSessionInput[] = [];

  const [staff, hall] = await Promise.all([
    verifyCoreStaff(cleanEmail, password),
    cbtServerStore.findStandaloneWorkspaceByEmail(cleanEmail),
  ]);

  if (staff) {
    const ws = await ensureInstitutionWorkspace(staff);
    choices.push({
      wsId: ws.id,
      type: "INSTITUTION",
      email: staff.email,
      name: ws.name,
      schoolId: staff.schoolId,
    });
  }

  if (hall && (await verifyStandalonePassword(hall, password))) {
    choices.push({
      wsId: hall.id,
      type: "STANDALONE_HALL",
      email: cleanEmail,
      name: hall.name,
    });
  }

  return choices;
}
