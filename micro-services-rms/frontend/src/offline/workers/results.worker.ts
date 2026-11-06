/// <reference lib="webworker" />
import * as XLSX from "xlsx";
import { parseWorkbookRows } from "../engine/parseWorkbook";
import { computeResults } from "../engine/computeResults";
import { buildK12Workbook } from "../engine/k12Workbook";
import type { ClassResult } from "../engine/types";

/**
 * Off-main-thread Excel work: reading the school's workbook and computing results, and
 * writing the clean workbook that is synced to the K12 backend.
 */
export type ResultsRequest =
  | { id: number; type: "process"; file: ArrayBuffer; fileName?: string }
  | { id: number; type: "k12Workbook"; classes: ClassResult[] }
  | { id: number; type: "ping" };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** CSVs saved by Excel are UTF-8 (often with a BOM) or Windows-1252; try UTF-8 first */
function decodeCsv(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const text = utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
  return text.replace(/^\uFEFF/, "");
}

ctx.onmessage = (event: MessageEvent<ResultsRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "ping") {
      ctx.postMessage({ id: msg.id, ok: true, value: "pong" });
      return;
    }
    if (msg.type === "process") {
      // CSV cells stay text (raw) so admission numbers like 007 keep their zeros; scores are parsed later
      const isCsv = /\.csv$/i.test(msg.fileName || "");
      const wb = isCsv
        ? XLSX.read(decodeCsv(msg.file), { type: "string", raw: true })
        : XLSX.read(new Uint8Array(msg.file), { type: "array", cellDates: false });
      const sheets = wb.SheetNames.map((name) => ({
        name: isCsv ? msg.fileName || name : name,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, blankrows: true, defval: null }) as unknown[][],
      }));
      ctx.postMessage({ id: msg.id, ok: true, value: computeResults(parseWorkbookRows(sheets)) });
      return;
    }
    if (msg.type === "k12Workbook") {
      const plan = buildK12Workbook(msg.classes);
      const wb = XLSX.utils.book_new();
      for (const sheet of plan.sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
      const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      ctx.postMessage({ id: msg.id, ok: true, value: { bytes, droppedColumns: plan.droppedColumns } }, [bytes]);
    }
  } catch (err) {
    const message =
      err instanceof Error && /zip|corrupt|signature|unsupported/i.test(err.message)
        ? "This file couldn't be read as an Excel workbook. Save it as .xlsx and try again."
        : err instanceof Error
        ? err.message
        : "Couldn't read the file.";
    ctx.postMessage({ id: msg.id, ok: false, error: message });
  }
};
