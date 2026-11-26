import Dexie, { type Table } from "dexie";
import type { ClassResult, SheetIssue } from "../engine/types";

/**
 * Everything the offline app keeps on the laptop, in IndexedDB. Nothing here requires a
 * connection; the K12 session is only used when syncing scores.
 */

export interface K12Session {
  accessToken: string;
  subdomain: string;
  schoolName?: string;
  user: { id: string; email: string; firstName?: string; lastName?: string; role?: string; roles?: string[]; schoolId?: string };
  signedInAt: string;
}

export interface SchoolProfile {
  /** Subdomain this profile was explicitly saved or fetched for; guards against stale cross-tenant data */
  subdomain?: string;
  schoolName: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  color: string;
  logo: { bytes: Uint8Array; type: "png" | "jpg" } | null;
  /** Printed on every card as "Next term begins: ...", e.g. "Monday, 12 January 2027". Optional; empty hides the line */
  nextTermBegins?: string;
}

export interface CachedRoster {
  classes: Array<{ className: string; students: Array<{ name: string; admissionNo: string | null }> }>;
  subjects?: string[];
  importedAt: string;
}

export type SyncState =
  | { status: "pending" }
  | { status: "syncing"; startedAt: string }
  | { status: "synced"; at: string; processed?: number; droppedColumns?: string[] }
  | { status: "failed"; at: string; error: string; needsSignIn?: boolean };

export interface BatchRecord {
  id: string;
  ownerKey: string;
  fileName: string;
  createdAt: string;
  term: string;
  session: string;
  totalStudents: number;
  classNames: string[];
  issues: SheetIssue[];
  /** Indexes of classes whose booklet PDF is saved; generation resumes from the rest */
  generatedClasses: number[];
  /** Fingerprint of the school details the saved booklets were drawn with (see profileFingerprint) */
  cardsMadeWith?: string;
  sync: SyncState;
}

export interface ClassResultRecord {
  /** `${batchId}::${index}` */
  id: string;
  batchId: string;
  index: number;
  result: ClassResult;
}

export interface BookletRecord {
  /** `${batchId}::${index}` */
  id: string;
  batchId: string;
  index: number;
  className: string;
  pdf: Blob;
  pages: number;
  generatedAt: string;
}

export interface KeyValue {
  key: string;
  value: unknown;
}

export function accountKey(session: Pick<K12Session, "subdomain" | "user">): string {
  return `${session.subdomain.trim().toLowerCase()}:${session.user.id}`;
}

class RmsOfflineDB extends Dexie {
  kv!: Table<KeyValue, string>;
  batches!: Table<BatchRecord, string>;
  classResults!: Table<ClassResultRecord, string>;
  booklets!: Table<BookletRecord, string>;

  constructor() {
    super("paralearn-results-offline");
    this.version(1).stores({
      kv: "key",
      batches: "id, createdAt",
      classResults: "id, batchId",
      booklets: "id, batchId",
    });
    this.version(2)
      .stores({
        kv: "key",
        batches: "id, createdAt, ownerKey",
        classResults: "id, batchId",
        booklets: "id, batchId",
      })
      .upgrade(async (tx) => {
        // Never auto-claim unowned v1 batches for whichever user happens to be signed in
        await tx.table("batches").toCollection().modify((batch) => {
          if (!batch.ownerKey) batch.ownerKey = "legacy-unassigned";
        });
        await tx.table("kv").delete("profile");
      });
  }
}

export const db = new RmsOfflineDB();

export const recordId = (batchId: string, index: number) => `${batchId}::${index}`;

export const DEFAULT_PROFILE: SchoolProfile = {
  schoolName: "",
  motto: "",
  address: "",
  phone: "",
  email: "",
  color: "#641bc4",
  logo: null,
};

export async function getSession(): Promise<K12Session | null> {
  return ((await db.kv.get("session"))?.value as K12Session | undefined) ?? null;
}

const cleanSubdomain = (subdomain: string) => subdomain.trim().toLowerCase();
const profileKey = (subdomain: string) => `profile:${cleanSubdomain(subdomain)}`;
const rosterKey = (ownerKey: string) => `roster:${ownerKey}`;

export async function setSession(session: K12Session | null, broadcast = true) {
  // Drop any leftover un-scoped legacy profile rather than attributing it to the wrong school
  await db.kv.delete("profile").catch(() => undefined);
  if (session) await db.kv.put({ key: "session", value: session });
  else await db.kv.delete("session");
  if (broadcast && typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("rms-session");
    channel.postMessage("changed");
    channel.close();
  }
}

export async function getProfile(subdomain?: string): Promise<SchoolProfile> {
  if (!subdomain) return { ...DEFAULT_PROFILE };
  const scope = cleanSubdomain(subdomain);
  const stored = (await db.kv.get(profileKey(scope)))?.value as Partial<SchoolProfile> | undefined;
  // Ignore profiles without an explicit matching subdomain (heals profiles copied from legacy key)
  if (!stored || stored.subdomain !== scope) return { ...DEFAULT_PROFILE };
  return { ...DEFAULT_PROFILE, ...stored, subdomain: scope };
}

export async function saveProfile(profile: SchoolProfile, subdomain: string) {
  const scope = cleanSubdomain(subdomain);
  await db.kv.put({ key: profileKey(scope), value: { ...profile, subdomain: scope } });
}

export async function getRoster(ownerKey: string): Promise<CachedRoster | null> {
  return ((await db.kv.get(rosterKey(ownerKey)))?.value as CachedRoster | undefined) ?? null;
}

export async function saveRoster(ownerKey: string, roster: CachedRoster) {
  await db.kv.put({ key: rosterKey(ownerKey), value: roster });
}

export async function clearRoster(ownerKey: string) {
  await db.kv.delete(rosterKey(ownerKey));
}

export async function resetNeedsSignInBatches(ownerKey: string) {
  await db.batches
    .where("ownerKey")
    .equals(ownerKey)
    .modify((batch) => {
      if (batch.sync.status === "failed" && batch.sync.needsSignIn) {
        batch.sync = { status: "pending" };
      }
    });
}

export async function saveBatch(batch: Omit<BatchRecord, "ownerKey">, classes: ClassResult[], session: K12Session) {
  await db.transaction("rw", db.batches, db.classResults, async () => {
    await db.batches.put({ ...batch, ownerKey: accountKey(session) });
    await db.classResults.bulkPut(classes.map((result, index) => ({ id: recordId(batch.id, index), batchId: batch.id, index, result })));
  });
}

export async function getAccountBatches(ownerKey: string): Promise<BatchRecord[]> {
  const rows = await db.batches.where("ownerKey").equals(ownerKey).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAccountBatch(batchId: string, ownerKey: string): Promise<BatchRecord | undefined> {
  const batch = await db.batches.get(batchId);
  return batch?.ownerKey === ownerKey ? batch : undefined;
}

export async function getClassResults(batchId: string, ownerKey: string): Promise<ClassResult[]> {
  if (!(await getAccountBatch(batchId, ownerKey))) return [];
  const rows = await db.classResults.where("batchId").equals(batchId).toArray();
  return rows.sort((a, b) => a.index - b.index).map((r) => r.result);
}

export async function deleteBatch(batchId: string, ownerKey: string) {
  await db.transaction("rw", db.batches, db.classResults, db.booklets, async () => {
    const batch = await db.batches.get(batchId);
    if (batch?.ownerKey !== ownerKey) return;
    await db.batches.delete(batchId);
    await db.classResults.where("batchId").equals(batchId).delete();
    await db.booklets.where("batchId").equals(batchId).delete();
  });
}

/** Ask the browser not to evict our data when the disk is low (best effort) */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
