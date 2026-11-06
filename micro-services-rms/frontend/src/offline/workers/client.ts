"use client";

import type { ClassResult, ComputedResults } from "../engine/types";
import type { CardContext } from "../pdf/reportCardPdf";

/**
 * Promise wrappers around the two Web Workers. Each worker is created lazily and reused;
 * cancel() terminates it (the only way to stop work mid-way) and the next call starts a
 * fresh one.
 */

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void; onProgress?: (p: any) => void };

class WorkerClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor(private create: () => Worker) {}

  private get(): Worker {
    if (this.worker) return this.worker;
    const w = this.create();
    w.onmessage = (e: MessageEvent<any>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      if (e.data.progress) return p.onProgress?.(e.data.progress);
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.value);
      else p.reject(new Error(e.data.error || "Worker failed"));
    };
    w.onerror = (e) => {
      const err = new Error(e.message || "The background task stopped unexpectedly.");
      this.pending.forEach((p) => p.reject(err));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    };
    this.worker = w;
    return w;
  }

  call<T>(message: Record<string, unknown>, transfer: Transferable[] = [], onProgress?: (p: any) => void): Promise<T> {
    const id = ++this.seq;
    const worker = this.get();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  cancel() {
    this.worker?.terminate();
    this.worker = null;
    const err = new CancelledError();
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
  }
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

// `new Worker(new URL(..., import.meta.url))` must be written literally for the bundler to emit the worker
const resultsClient = new WorkerClient(() => new Worker(new URL("./results.worker.ts", import.meta.url), { type: "module" }));
const pdfClient = new WorkerClient(() => new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" }));

export function processWorkbook(file: ArrayBuffer, fileName?: string): Promise<ComputedResults> {
  return resultsClient.call<ComputedResults>({ type: "process", file, fileName }, [file]);
}

export function buildK12WorkbookFile(classes: ClassResult[]): Promise<{ bytes: ArrayBuffer; droppedColumns: string[] }> {
  return resultsClient.call({ type: "k12Workbook", classes });
}

export function drawCards(
  cls: ClassResult,
  ctx: CardContext,
  options: { studentIds?: string[]; onProgress?: (p: { done: number; total: number }) => void } = {}
): Promise<{ bytes: ArrayBuffer; pages: number }> {
  return pdfClient.call({ type: "cards", cls, ctx, studentIds: options.studentIds }, [], options.onProgress);
}

export function cancelCardDrawing() {
  pdfClient.cancel();
}

/**
 * Starts both workers once so their scripts are downloaded (and cached by the service worker)
 * while online. Without this, the first offline use would fail to load a worker.
 */
export async function warmUpWorkers(): Promise<void> {
  await Promise.all([resultsClient.call({ type: "ping" }), pdfClient.call({ type: "ping" })]);
}
