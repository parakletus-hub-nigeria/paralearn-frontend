"use client";

import { useSyncExternalStore } from "react";
import { db, getClassResults, getProfile, recordId, type BatchRecord, type SchoolProfile } from "../storage/db";
import { CancelledError, cancelCardDrawing, drawCards } from "../workers/client";
import type { CardContext } from "../pdf/reportCardPdf";

/**
 * Generates a batch's report cards one class at a time (about 50 cards per run), saving each
 * class booklet to IndexedDB as soon as it is done. Cancelling keeps finished classes;
 * running again resumes from the first class without a booklet.
 */

export interface GenerationState {
  batchId: string;
  className: string;
  classDone: number;
  classTotal: number;
  overallDone: number;
  overallTotal: number;
}

let state: GenerationState | null = null;
let cancelled = false;
const listeners = new Set<() => void>();
const emit = (next: GenerationState | null) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useGeneration(): GenerationState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null
  );
}

export function cardContext(profile: SchoolProfile, batch: Pick<BatchRecord, "term" | "session">): CardContext {
  return {
    term: batch.term,
    session: batch.session,
    branding: {
      schoolName: profile.schoolName || "School",
      motto: profile.motto,
      address: profile.address,
      phone: profile.phone,
      email: profile.email,
      color: profile.color,
      logo: profile.logo,
    },
  };
}

export function cancelGeneration() {
  if (!state) return;
  cancelled = true;
  cancelCardDrawing();
}

export async function generateBatch(batchId: string): Promise<"done" | "cancelled"> {
  if (state) throw new Error("Report cards are already being generated.");
  cancelled = false;
  const batch = await db.batches.get(batchId);
  if (!batch) throw new Error("This batch no longer exists.");
  const classes = await getClassResults(batchId);
  const ctx = cardContext(await getProfile(), batch);
  const overallTotal = classes.reduce((a, c) => a + c.students.length, 0);
  const finished = new Set(batch.generatedClasses);
  let overallDone = classes.filter((_, i) => finished.has(i)).reduce((a, c) => a + c.students.length, 0);

  try {
    for (let index = 0; index < classes.length; index++) {
      if (finished.has(index)) continue;
      const cls = classes[index];
      emit({ batchId, className: cls.name, classDone: 0, classTotal: cls.students.length, overallDone, overallTotal });
      const { bytes, pages } = await drawCards(cls, ctx, {
        onProgress: ({ done, total }) =>
          emit({ batchId, className: cls.name, classDone: done, classTotal: total, overallDone: overallDone + done, overallTotal }),
      });
      if (cancelled) return "cancelled";
      await db.transaction("rw", db.booklets, db.batches, async () => {
        await db.booklets.put({
          id: recordId(batchId, index),
          batchId,
          index,
          className: cls.name,
          pdf: new Blob([bytes], { type: "application/pdf" }),
          pages,
          generatedAt: new Date().toISOString(),
        });
        finished.add(index);
        await db.batches.update(batchId, { generatedClasses: [...finished].sort((a, b) => a - b) });
      });
      overallDone += cls.students.length;
    }
    return "done";
  } catch (err) {
    if (err instanceof CancelledError || cancelled) return "cancelled";
    throw err;
  } finally {
    emit(null);
  }
}

/** Drops saved booklets, e.g. after the school profile changed, so the next run redraws them */
export async function clearBooklets(batchId: string) {
  await db.transaction("rw", db.booklets, db.batches, async () => {
    await db.booklets.where("batchId").equals(batchId).delete();
    await db.batches.update(batchId, { generatedClasses: [] });
  });
}
