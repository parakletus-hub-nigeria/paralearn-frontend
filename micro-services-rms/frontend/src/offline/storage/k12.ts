"use client";

import { accountKey, getAccountBatch, getAccountBatches, getClassResults, getSession, setSession, db, type BatchRecord, type K12Session } from "./db";
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

export interface RosterStudent {
  name: string;
  admissionNo: string | null;
}

export interface RosterClass {
  className: string;
  students: RosterStudent[];
}

export interface ImportedRoster {
  classes: RosterClass[];
  subjects: string[];
}

export function normalizeClassKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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

function extractRoles(user: Record<string, unknown>): string[] {
  const roles = new Set<string>();
  const add = (val: unknown) => {
    if (typeof val === "string" && val.trim()) roles.add(val.trim().toLowerCase());
  };
  add(user.role);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      if (typeof r === "string") add(r);
      else if (isRecord(r)) {
        add(r.name);
        if (isRecord(r.role)) add(r.role.name);
      }
    }
  }
  return [...roles];
}

export async function signIn(input: { subdomain: string; email: string; password: string }): Promise<K12Session> {
  const requestedSubdomain = normalizeSubdomain(input.subdomain);
  if (!requestedSubdomain) throw new K12Error("Enter your school's ParaLearn address, e.g. kings.pln.ng.");
  let res: Response;
  try {
    res = await fetch(`${K12}/auth/login`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-tenant-subdomain": requestedSubdomain },
      body: JSON.stringify({ email: input.email.trim().toLowerCase(), password: input.password, subdomain: requestedSubdomain }),
    });
  } catch {
    throw new K12Error("You're offline. Connect to the internet once to sign in; after that the app works offline.");
  }
  if (!res.ok) {
    const fallback = res.status === 401 ? "Wrong email or password for this school." : "Couldn't sign in. Please try again.";
    throw new K12Error(await errorMessage(res, fallback), res.status);
  }
  const body = await res.json();
  const accessToken: string | undefined = body?.accessToken || body?.token || body?.data?.accessToken || body?.data?.token;
  const rawUser = body?.user || body?.data?.user;
  if (!accessToken || !isRecord(rawUser) || typeof rawUser.id !== "string" || !rawUser.id) {
    throw new K12Error("ParaLearn didn't return a session. Please try again.");
  }
  const school = isRecord(body?.data?.school) ? body.data.school : isRecord(body?.school) ? body.school : null;
  const serverSubdomain = typeof school?.subdomain === "string" ? normalizeSubdomain(school.subdomain) : "";
  const subdomain = serverSubdomain || requestedSubdomain;
  const schoolName = typeof school?.name === "string" && school.name.trim() ? school.name.trim() : undefined;
  const roles = extractRoles(rawUser);
  const user: K12Session["user"] = {
    id: rawUser.id,
    email: typeof rawUser.email === "string" ? rawUser.email : input.email.trim().toLowerCase(),
    firstName: typeof rawUser.firstName === "string" ? rawUser.firstName : undefined,
    lastName: typeof rawUser.lastName === "string" ? rawUser.lastName : undefined,
    role: typeof rawUser.role === "string" ? rawUser.role : roles[0],
    roles,
    schoolId: typeof rawUser.schoolId === "string" ? rawUser.schoolId : typeof school?.id === "string" ? school.id : undefined,
  };
  const session: K12Session = { accessToken, subdomain, schoolName, user, signedInAt: new Date().toISOString() };
  await setSession(session);
  return session;
}

export async function signOut() {
  const current = await getSession();
  const headers: Record<string, string> = {};
  if (current?.subdomain) headers["x-tenant-subdomain"] = current.subdomain;
  if (current?.accessToken) headers.authorization = `Bearer ${current.accessToken}`;
  try {
    // K12 backend exposes GET /auth/logout to clear the refresh cookie; fall back to POST if needed
    const res = await fetch(`${K12}/auth/logout`, { method: "GET", credentials: "same-origin", headers }).catch(() => null);
    if (res && (res.status === 404 || res.status === 405)) {
      await fetch(`${K12}/auth/logout`, { method: "POST", credentials: "same-origin", headers }).catch(() => undefined);
    }
  } finally {
    await setSession(null);
  }
}

function tokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now() + 60_000;
  } catch {
    return false;
  }
}

let refreshInFlight: Promise<K12Session> | null = null;

/** Access tokens last an hour; renew with the 7-day refresh cookie before giving up */
async function freshSession(forceRefresh = false): Promise<K12Session> {
  const session = await getSession();
  if (!session) throw new K12Error("Sign in to connect with ParaLearn.", 401, true);
  if (!forceRefresh && !tokenExpired(session.accessToken)) return session;
  if (refreshInFlight) return refreshInFlight;

  const owner = accountKey(session);
  refreshInFlight = (async () => {
    const res = await fetch(`${K12}/auth/refresh-token`, {
      credentials: "same-origin",
      headers: { "x-tenant-subdomain": session.subdomain },
    }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    const accessToken = body?.data?.accessToken || body?.accessToken || body?.data?.token || body?.token;
    if (!accessToken) throw new K12Error("Your ParaLearn sign-in has expired. Sign in again to continue.", 401, true);
    const latest = await getSession();
    if (!latest || accountKey(latest) !== owner) {
      throw new K12Error("Your ParaLearn account changed. Sign in again to continue.", 401, true);
    }
    const renewed = { ...latest, accessToken };
    await setSession(renewed, false);
    return renewed;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function unwrapData(body: unknown): unknown {
  return isRecord(body) && "data" in body ? body.data : body;
}

function extractArray(body: unknown): unknown[] | null {
  const data = unwrapData(body);
  const nested = isRecord(data) ? data.data ?? data.items ?? data.users ?? data.students : undefined;
  const candidates: unknown[] = [body, data, nested];
  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? list : null;
}

async function fetchAuthed(path: string, session: K12Session): Promise<{ res: Response; session: K12Session }> {
  const run = async (s: K12Session) => {
    try {
      return await fetch(`${K12}${path}`, {
        credentials: "same-origin",
        headers: {
          authorization: `Bearer ${s.accessToken}`,
          "x-tenant-subdomain": s.subdomain,
        },
      });
    } catch {
      throw new K12Error("Lost the connection while loading data from ParaLearn. Try again when you're online.");
    }
  };
  let active = session;
  let res = await run(active);
  if (res.status === 401) {
    active = await freshSession(true);
    res = await run(active);
  }
  return { res, session: active };
}

async function getCoreJson(path: string, session: K12Session, label: string): Promise<{ body: unknown; session: K12Session }> {
  const { res, session: active } = await fetchAuthed(path, session);
  if (res.status === 401 || res.status === 403) {
    throw new K12Error(
      res.status === 401
        ? "Your ParaLearn sign-in has expired. Sign in again to import students."
        : "This account isn't allowed to view the school's student roster.",
      res.status,
      res.status === 401
    );
  }
  if (!res.ok) throw new K12Error(await errorMessage(res, `ParaLearn couldn't load ${label} (error ${res.status}).`), res.status);
  return { body: await res.json(), session: active };
}

function parseStudentEntry(entry: unknown): (RosterStudent & { id?: string }) | null {
  if (!isRecord(entry)) return null;
  if (entry.isActive === false || entry.deletedAt != null) return null;
  const student = isRecord(entry.student) ? entry.student : isRecord(entry.user) ? entry.user : entry;
  if (student.isActive === false || student.deletedAt != null) return null;
  // Filter out non-student users if roles are attached and exclude student
  const roles = extractRoles(student);
  if (roles.length > 0 && !roles.includes("student") && (roles.includes("teacher") || roles.includes("admin") || roles.includes("principal"))) {
    return null;
  }
  const firstName = typeof student.firstName === "string" ? student.firstName.trim() : "";
  const middleName = typeof student.middleName === "string" ? student.middleName.trim() : "";
  const lastName = typeof student.lastName === "string" ? student.lastName.trim() : "";
  const joined = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const fallbackName = [student.studentName, student.fullName, student.name].find(
    (value): value is string => typeof value === "string" && !!value.trim()
  );
  const name = (joined || fallbackName?.trim() || "").replace(/\s+/g, " ");
  if (!name) return null;
  const admissionNo = [student.studentId, student.studentIdNumber, student.admissionNo, student.admissionNumber, student.code].find(
    (value): value is string => typeof value === "string" && !!value.trim()
  );
  const id = typeof student.id === "string" && student.id ? student.id : undefined;
  return { id, name, admissionNo: admissionNo?.trim() || null };
}

function dedupeAndSortStudents(entries: unknown[]): RosterStudent[] {
  const seen = new Set<string>();
  const out: RosterStudent[] = [];
  for (const raw of entries) {
    const parsed = parseStudentEntry(raw);
    if (!parsed) continue;
    const key = parsed.id || `${parsed.name.toLowerCase()}|${(parsed.admissionNo || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: parsed.name, admissionNo: parsed.admissionNo });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchClassStudentsFallback(classId: string, className: string, session: K12Session): Promise<RosterStudent[]> {
  const all: unknown[] = [];
  const limit = 200;
  for (let page = 1; page <= 25; page++) {
    const { body } = await getCoreJson(
      `/users?classId=${encodeURIComponent(classId)}&role=student&page=${page}&limit=${limit}`,
      session,
      `student roster for ${className}`
    );
    const list = extractArray(body);
    if (!list) throw new K12Error(`ParaLearn returned an unexpected student roster for ${className}.`);
    all.push(...list);
    const meta = isRecord(body) ? (isRecord(body.meta) ? body.meta : isRecord(body.data) && isRecord(body.data.meta) ? body.data.meta : body) : null;
    const totalPages = meta && typeof meta.totalPages === "number" ? meta.totalPages : undefined;
    if ((totalPages && page >= totalPages) || list.length < limit) break;
  }
  return dedupeAndSortStudents(all);
}

/** Loads active class rosters (and subjects when available) from ParaLearn Core. */
export async function fetchStudentRoster(): Promise<ImportedRoster> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new K12Error("Connect to the internet to import student names from ParaLearn.");
  }
  let session = await freshSession();

  // 1. Load school classes (GET /classes — same call as Core RMS; fall back to teacher's assigned classes on 403)
  let rawClasses: unknown[] = [];
  try {
    const res = await getCoreJson("/classes", session, "class list");
    session = res.session;
    rawClasses = extractArray(res.body) ?? [];
  } catch (err) {
    if (err instanceof K12Error && err.status === 403) {
      const teacherRes = await getCoreJson(`/classes/teacher/${encodeURIComponent(session.user.id)}`, session, "assigned classes");
      session = teacherRes.session;
      rawClasses = extractArray(teacherRes.body) ?? [];
    } else {
      throw err;
    }
  }

  const seenIds = new Set<string>();
  const validClasses = rawClasses.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const cls = isRecord(entry.class) ? entry.class : entry;
    if (cls.isActive === false) return [];
    if (typeof cls.id !== "string" || !cls.id || typeof cls.name !== "string" || !cls.name.trim()) return [];
    if (seenIds.has(cls.id)) return [];
    seenIds.add(cls.id);
    const expectedCount =
      typeof cls.enrollmentCount === "number"
        ? cls.enrollmentCount
        : typeof cls.studentCount === "number"
        ? cls.studentCount
        : undefined;
    return [{ id: cls.id, name: cls.name.trim().replace(/\s+/g, " "), expectedCount }];
  });
  if (!validClasses.length) throw new K12Error("No active classes were found in this ParaLearn school.");

  const names = new Set<string>();
  const duplicate = validClasses.find((cls) => {
    const key = normalizeClassKey(cls.name);
    if (names.has(key)) return true;
    names.add(key);
    return false;
  });
  if (duplicate) {
    throw new K12Error(`ParaLearn has more than one active class named "${duplicate.name}". Rename the duplicate class before importing its roster.`);
  }

  // 2. Load each class's enrolled students via GET /classes/:classId (complete list, works for admins and teachers),
  //    falling back to paginated GET /users?classId=...&role=student if enrollments aren't returned.
  const subjectSet = new Map<string, string>();
  const classes = await Promise.all(
    validClasses.map(async (cls): Promise<RosterClass> => {
      try {
        const { body } = await getCoreJson(`/classes/${encodeURIComponent(cls.id)}`, session, `class details for ${cls.name}`);
        const detail = unwrapData(body);
        if (isRecord(detail)) {
          if (Array.isArray(detail.subjects)) {
            for (const sub of detail.subjects) {
              const name = isRecord(sub) && typeof sub.name === "string" ? sub.name.trim().replace(/\s+/g, " ") : "";
              if (name && !subjectSet.has(name.toLowerCase())) subjectSet.set(name.toLowerCase(), name);
            }
          }
          const fromDetail = [
            ...(Array.isArray(detail.enrollments) ? detail.enrollments : []),
            ...(Array.isArray(detail.students) ? detail.students : []),
          ];
          const parsedFromDetail = dedupeAndSortStudents(fromDetail);
          if (parsedFromDetail.length > 0) {
            return { className: cls.name, students: parsedFromDetail };
          }
        }
      } catch (err) {
        if (err instanceof K12Error && err.needsSignIn) throw err;
        // Fall through to /users?classId=... fallback
      }
      const students = await fetchClassStudentsFallback(cls.id, cls.name, session);
      return { className: cls.name, students };
    })
  );

  // 3. Best-effort school subjects lookup if class details didn't include subjects
  if (!subjectSet.size) {
    try {
      const { body } = await getCoreJson("/subjects", session, "subjects");
      const list = extractArray(body) ?? [];
      for (const sub of list) {
        const name = isRecord(sub) && typeof sub.name === "string" ? sub.name.trim().replace(/\s+/g, " ") : "";
        if (name && !subjectSet.has(name.toLowerCase())) subjectSet.set(name.toLowerCase(), name);
      }
    } catch {
      /* optional: school can still edit subjects manually */
    }
  }

  return { classes, subjects: [...subjectSet.values()] };
}

async function setSync(batchId: string, ownerKey: string, sync: BatchRecord["sync"]) {
  await db.transaction("rw", db.batches, async () => {
    const batch = await db.batches.get(batchId);
    if (batch?.ownerKey !== ownerKey) {
      throw new K12Error("This batch belongs to a different ParaLearn account.");
    }
    await db.batches.update(batchId, { sync });
  });
}

/**
 * Sends one batch's scores to the school's ParaLearn records via
 * POST result_up/process-result-sheets. ParaLearn files them under the school's current
 * session and term, and creates any classes, subjects or students it doesn't have yet.
 */
/** Sends in progress, by batch: a second request for the same batch joins the first instead of uploading twice */
const inFlight = new Map<string, Promise<void>>();

export function syncBatch(batchId: string): Promise<void> {
  const running = inFlight.get(batchId);
  if (running) return running;
  const run = sendBatch(batchId).finally(() => inFlight.delete(batchId));
  inFlight.set(batchId, run);
  return run;
}

async function sendBatch(batchId: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new K12Error("You're offline. Scores will sync when you reconnect.");
  let session = await freshSession();
  const ownerKey = accountKey(session);
  const batch = await getAccountBatch(batchId, ownerKey);
  if (!batch) throw new K12Error("This batch belongs to a different ParaLearn account. Sign in with the account that created it.");
  await setSync(batchId, ownerKey, { status: "syncing", startedAt: new Date().toISOString() });
  try {
    const classes = await getClassResults(batchId, ownerKey);
    const { bytes, droppedColumns } = await buildK12WorkbookFile(classes);

    const fileName = batch.fileName.replace(/\.(xlsx|xls)$/i, "") + " (ParaLearn sync).xlsx";
    const upload = async (active: K12Session) => {
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
      form.append("id", active.user.id);
      try {
        return await fetch(`${K12}/result_up/process-result-sheets`, {
          method: "POST",
          credentials: "same-origin",
          headers: { authorization: `Bearer ${active.accessToken}`, "x-tenant-subdomain": active.subdomain },
          body: form,
        });
      } catch {
        throw new K12Error("Lost the connection while syncing. It will retry when you're back online.");
      }
    };

    let res = await upload(session);
    if (res.status === 401) {
      session = await freshSession(true);
      res = await upload(session);
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
    await setSync(batchId, ownerKey, { status: "synced", at: new Date().toISOString(), processed, droppedColumns });
  } catch (err) {
    const e = err instanceof K12Error ? err : new K12Error(err instanceof Error ? err.message : "Sync failed.");
    await setSync(batchId, ownerKey, { status: "failed", at: new Date().toISOString(), error: e.message, needsSignIn: e.needsSignIn });
    throw e;
  }
}

/** Syncs every batch that hasn't synced yet; used when the laptop comes back online */
export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const session = await getSession();
  if (!session || (typeof navigator !== "undefined" && navigator.onLine === false)) return { synced: 0, failed: 0 };
  const ownerKey = accountKey(session);
  const batches = await getAccountBatches(ownerKey);
  let synced = 0;
  let failed = 0;
  for (const listed of batches) {
    const active = await getSession();
    if (!active || accountKey(active) !== ownerKey) break;
    // Re-read: the list is a snapshot, and "Send now" may have sent this batch since
    const b = await getAccountBatch(listed.id, ownerKey);
    if (!b) continue;
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
  const clean = normalizeSubdomain(subdomain);
  if (!clean) return null;
  try {
    const res = await fetch(`${K12}/tenant/by-subdomain/${encodeURIComponent(clean)}`, {
      credentials: "same-origin",
      headers: { "x-tenant-subdomain": clean },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const t = body?.data;
    if (!t) return null;
    return {
      name: typeof t.name === "string" && t.name.trim() ? t.name.trim() : null,
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
