import Dexie, { type Table } from "dexie";
import type { ClassResult, SheetIssue } from "../engine/types";

/**
 * Everything the offline app keeps on the laptop, in IndexedDB. Nothing here requires a
 * connection; the K12 session is only used when syncing scores.
 */

export interface K12Session {
  accessToken: string;
  subdomain: string;
  user: { id: string; email: string; firstName?: string; lastName?: string; role?: string; schoolId?: string };
  signedInAt: string;
}

export interface SchoolProfile {
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
        const saved = await tx.table("kv").get("session");
        const session = saved?.value as K12Session | undefined;
        const ownerKey = session?.user?.id && session.subdomain ? accountKey(session) : "legacy-unassigned";
        await tx.table("batches").toCollection().modify((batch) => {
          batch.ownerKey = ownerKey;
        });
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

const profileKey = (subdomain: string) => `profile:${subdomain}`;

async function moveLegacyProfile(subdomain: string) {
  const legacy = await db.kv.get("profile");
  if (!legacy) return;
  const key = profileKey(subdomain);
  if (!(await db.kv.get(key))) await db.kv.put({ ...legacy, key });
  await db.kv.delete("profile");
}

export async function setSession(session: K12Session | null) {
  const current = await getSession();
  if (current?.subdomain) await moveLegacyProfile(current.subdomain);
  if (session) await db.kv.put({ key: "session", value: session });
  else await db.kv.delete("session");
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("rms-session");
    channel.postMessage("changed");
    channel.close();
  }
}

export async function getProfile(subdomain?: string): Promise<SchoolProfile> {
  const stored = subdomain
    ? ((await db.kv.get(profileKey(subdomain)))?.value as Partial<SchoolProfile> | undefined)
    : undefined;
  return { ...DEFAULT_PROFILE, ...(stored || {}) };
}

export async function saveProfile(profile: SchoolProfile, subdomain: string) {
  await db.kv.put({ key: profileKey(subdomain), value: profile });
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
