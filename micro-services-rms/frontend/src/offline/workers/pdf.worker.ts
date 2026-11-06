/// <reference lib="webworker" />
import { buildReportCardsPdf, type CardContext } from "../pdf/reportCardPdf";
import type { ClassResult } from "../engine/types";

/** Draws report-card PDFs off the main thread so the page stays responsive */
export type PdfRequest =
  | { id: number; type: "cards"; cls: ClassResult; studentIds?: string[]; ctx: CardContext }
  | { id: number; type: "ping" };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<PdfRequest>) => {
  const msg = event.data;
  if (msg.type === "ping") {
    ctx.postMessage({ id: msg.id, ok: true, value: "pong" });
    return;
  }
  try {
    const students = msg.studentIds ? msg.cls.students.filter((s) => msg.studentIds!.includes(s.id)) : msg.cls.students;
    let lastReport = 0;
    const bytes = await buildReportCardsPdf(students, msg.cls, msg.ctx, (done, total) => {
      const now = Date.now();
      if (now - lastReport > 150 || done === total) {
        lastReport = now;
        ctx.postMessage({ id: msg.id, progress: { done, total } });
      }
    });
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    ctx.postMessage({ id: msg.id, ok: true, value: { bytes: buffer, pages: students.length } }, [buffer]);
  } catch (err) {
    ctx.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : "Couldn't draw the report cards." });
  }
};
