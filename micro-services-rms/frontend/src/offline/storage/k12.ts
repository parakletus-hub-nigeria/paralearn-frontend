"use client";

import { getClassResults, getSession, setSession, db, type BatchRecord, type K12Session } from "./db";
import { buildK12WorkbookFile } from "../workers/client";

/**
 * The only online parts of the offline app: signing in with a ParaLearn K12 school account,
 * and sending computed scores to that school's records. Calls go through the host app's
 * /api/proxy rewrite to K12_BACKEND_URL, so they are same-origin and the K12 refresh-token
 * cookie stays on this site.
 */
const K12 = "/api/proxy";

export class K12Error extends Error {
  constructor(message: string, public status?: number, public needsSignIn = false) {
    super(message);
  }
}

/** "kings", "kings.pln.ng" or "https://kings.pln.ng/login" -> "kings" */
export function normalizeSubdomain(input: string): string {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  return host.split(".")[0].replace(/[^a-z0-9-]/g, "");
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const msg = body?.message;
  if (Array.isArray(msg)) return msg.join("; ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export async function signIn(input: { subdomain: string; email: string; password: string }): Promise<K12Session> {
  const subdomain = normalizeSubdomain(input.subdomain);
  if (!subdomain) throw new K12Error("Enter your school's ParaLearn address, e.g. kings.pln.ng.");
  let res: Response;
  try {
    res = await fetch(`${K12}/auth/login`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-tenant-subdomain": subdomain },
      body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password, subdomain }),
    });
  } catch {
    throw new K12Error("You're offline. Connect to the internet once to sign in; after that the app works offline.");
  }
  if (!res.ok) {
    const fallback = res.status === 401 ? "Wrong email or password for this school." : "Couldn't sign in. Please try again.";
    throw new K12Error(await errorMessage(res, fallback), res.status);
  }
  const body = await res.json();
  const accessToken: string | undefined = body?.accessToken || body?.data?.accessToken;
  const user = body?.user || body?.data?.user;
  if (!accessToken || !user?.id) throw new K12Error("ParaLearn didn't return a session. Please try again.");
  const session: K12Session = { accessToken, subdomain, user, signedInAt: new Date().toISOString() };
  await setSession(session);
  return session;
}

export async function signOut() {
  await setSession(null);
  await fetch(`${K12}/auth/logout`, { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return false;
  }
}

/** Access tokens last an hour; renew with the 7-day refresh cookie before giving up */
async function freshSession(): Promise<K12Session> {
  const session = await getSession();
  if (!session) throw new K12Error("Sign in to sync scores to ParaLearn.", 401, true);
  if (!tokenExpired(session.accessToken)) return session;
  const res = await fetch(`${K12}/auth/refresh-token`, {
    credentials: "same-origin",
    headers: { "x-tenant-subdomain": session.subdomain },
  }).catch(() => null);
  const body = res?.ok ? await res.json().catch(() => null) : null;
  const accessToken = body?.data?.accessToken || body?.accessToken;
  if (!accessToken) throw new K12Error("Your ParaLearn sign-in has expired. Sign in again to sync.", 401, true);
  const renewed = { ...session, accessToken };
  await setSession(renewed);
  return renewed;
}

async function setSync(batchId: string, sync: BatchRecord["sync"]) {
  await db.batches.update(batchId, { sync });
}

/**
 * Sends one batch's scores to the school's ParaLearn records via
 * POST result_up/process-result-sheets. ParaLearn files them under the school's current
 * session and term, and creates any classes, subjects or students it doesn't have yet.
 */
export async function syncBatch(batchId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new K12Error("You're offline. Scores will sync when you reconnect.");
  await setSync(batchId, { status: "syncing", startedAt: new Date().toISOString() });
  try {
    const session = await freshSession();
    const classes = await getClassResults(batchId);
    const batch = await db.batches.get(batchId);
    const { bytes, droppedColumns } = await buildK12WorkbookFile(classes);

    const form = new FormData();
    const fileName = (batch?.fileName || "results.xlsx").replace(/\.(xlsx|xls)$/i, "") + " (ParaLearn sync).xlsx";
    form.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
    form.append("id", session.user.id);

    let res: Response;
    try {
      res = await fetch(`${K12}/result_up/process-result-sheets`, {
        method: "POST",
        credentials: "same-origin",
        headers: { authorization: `Bearer ${session.accessToken}`, "x-tenant-subdomain": session.subdomain },
        body: form,
      });
    } catch {
      throw new K12Error("Lost the connection while syncing. It will retry when you're back online.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new K12Error(
        res.status === 401 ? "Your ParaLearn sign-in has expired. Sign in again to sync." : "This account isn't allowed to record results for the school.",
        res.status,
        res.status === 401
      );
    }
    if (!res.ok) throw new K12Error(await errorMessage(res, `ParaLearn couldn't record the scores (error ${res.status}).`), res.status);

    const body = await res.json().catch(() => ({}));
    const processed = typeof body?.processed === "number" ? body.processed : body?.data?.processed;
    await setSync(batchId, { status: "synced", at: new Date().toISOString(), processed, droppedColumns });
  } catch (err) {
    const e = err instanceof K12Error ? err : new K12Error(err instanceof Error ? err.message : "Sync failed.");
    await setSync(batchId, { status: "failed", at: new Date().toISOString(), error: e.message, needsSignIn: e.needsSignIn });
    throw e;
  }
}

/** Syncs every batch that hasn't synced yet; used when the laptop comes back online */
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const session = await getSession();
  if (!session || !navigator.onLine) return { synced: 0, failed: 0 };
  const batches = await db.batches.toArray();
  let synced = 0;
  let failed = 0;
  for (const b of batches) {
    // A sync interrupted by closing the tab is left as "syncing"; retry it after two minutes
    const stuck = b.sync.status === "syncing" && Date.now() - Date.parse(b.sync.startedAt) > 120_000;
    const due = b.sync.status === "pending" || stuck || (b.sync.status === "failed" && !b.sync.needsSignIn);
    if (!due) continue;
    try {
      await syncBatch(b.id);
      synced++;
    } catch (err) {
      failed++;
      if (err instanceof K12Error && err.needsSignIn) break;
    }
  }
  return { synced, failed };
}

export interface K12Branding {
  name: string | null;
  color: string | null;
  logoUrl: string | null;
}

/** Public school details used to prefill the card header (GET tenant/by-subdomain/:subdomain) */
export async function fetchSchoolBranding(subdomain: string): Promise<K12Branding | null> {
  try {
    const res = await fetch(`${K12}/tenant/by-subdomain/${encodeURIComponent(subdomain)}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    const body = await res.json();
    const t = body?.data;
    if (!t) return null;
    return {
      name: typeof t.name === "string" ? t.name : null,
      color: typeof t.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(t.primaryColor) ? t.primaryColor : null,
      logoUrl: typeof t.logoUrl === "string" && t.logoUrl ? t.logoUrl : null,
    };
  } catch {
    return null;
  }
}

/** "St. Mary's College, Lagos" -> "st-marys-college-lagos" (K12 needs 3-63 chars: a-z, 0-9, hyphens) */
export function suggestSubdomain(schoolName: string): string {
  return schoolName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export interface NewSchoolAccount {
  schoolName: string;
  subdomain: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

/**
 * Creates a school on ParaLearn for schools not using it yet (POST auth/register-school),
 * then signs in. ParaLearn picks a free address if the requested one is taken.
 */
export async function registerSchool(input: NewSchoolAccount): Promise<{ session: K12Session; subdomain: string; changed: boolean }> {
  const domain = normalizeSubdomain(input.subdomain);
  if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(domain)) {
    throw new K12Error("The school address needs 3 or more letters or numbers (hyphens allowed in the middle).");
  }
  if (input.password.length < 8) throw new K12Error("Use at least 8 characters for the password.");
  let res: Response;
  try {
    res = await fetch(`${K12}/auth/register-school`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schoolName: input.schoolName.trim(),
        domain,
        adminEmail: input.email.trim().toLowerCase(),
        adminPassword: input.password,
        adminFirstName: input.firstName.trim(),
        adminLastName: input.lastName.trim(),
        ...(input.phone?.trim() ? { phoneNumber: input.phone.trim() } : {}),
      }),
    });
  } catch {
    throw new K12Error("You're offline. Creating an account needs internet; after that the app works offline.");
  }
  if (!res.ok) throw new K12Error(await errorMessage(res, "Couldn't create the school account. Please try again."), res.status);
  const body = await res.json();
  const subdomain: string | undefined = body?.data?.subdomain;
  if (!subdomain) throw new K12Error("ParaLearn created the school but didn't return its address. Try signing in.");
  const session = await signIn({ subdomain, email: input.email, password: input.password });
  return { session, subdomain, changed: subdomain !== domain };
}
