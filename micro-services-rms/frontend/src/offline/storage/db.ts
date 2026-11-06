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
}

export type SyncState =
  | { status: "pending" }
  | { status: "syncing"; startedAt: string }
  | { status: "synced"; at: string; processed?: number; droppedColumns?: string[] }
  | { status: "failed"; at: string; error: string; needsSignIn?: boolean };

export interface BatchRecord {
  id: string;
  fileName: string;
  createdAt: string;
  term: string;
  session: string;
  totalStudents: number;
  classNames: string[];
  issues: SheetIssue[];
  /** Indexes of classes whose booklet PDF is saved; generation resumes from the rest */
  generatedClasses: number[];
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
  key: "session" | "profile";
  value: unknown;
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

export async function setSession(session: K12Session | null) {
  if (session) await db.kv.put({ key: "session", value: session });
  else await db.kv.delete("session");
}

export async function getProfile(): Promise<SchoolProfile> {
  const stored = (await db.kv.get("profile"))?.value as Partial<SchoolProfile> | undefined;
  return { ...DEFAULT_PROFILE, ...(stored || {}) };
}

export async function saveProfile(profile: SchoolProfile) {
  await db.kv.put({ key: "profile", value: profile });
}

export async function saveBatch(batch: BatchRecord, classes: ClassResult[]) {
  await db.transaction("rw", db.batches, db.classResults, async () => {
    await db.batches.put(batch);
    await db.classResults.bulkPut(classes.map((result, index) => ({ id: recordId(batch.id, index), batchId: batch.id, index, result })));
  });
}

export async function getClassResults(batchId: string): Promise<ClassResult[]> {
  const rows = await db.classResults.where("batchId").equals(batchId).toArray();
  return rows.sort((a, b) => a.index - b.index).map((r) => r.result);
}

export async function deleteBatch(batchId: string) {
  await db.transaction("rw", db.batches, db.classResults, db.booklets, async () => {
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
