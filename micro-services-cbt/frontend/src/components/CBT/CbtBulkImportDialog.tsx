"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StudioQuestion } from "./CbtQuestionStudio";

const LETTERS = ["a", "b", "c", "d", "e", "f"];
const TEMPLATE_HEADER = [
  "question", "type", "option_a", "option_b", "option_c", "option_d", "option_e", "option_f",
  "correct", "marks", "section", "min_words", "max_words", "explanation", "model_answer", "key_terms",
];

const TYPE_ALIASES: Record<string, StudioQuestion["type"]> = {
  mcq: "MCQ", "multiple choice": "MCQ", objective: "MCQ",
  true_false: "TRUE_FALSE", "true/false": "TRUE_FALSE", truefalse: "TRUE_FALSE", tf: "TRUE_FALSE",
  multi_select: "MULTI_SELECT", multiselect: "MULTI_SELECT", "multiple answers": "MULTI_SELECT", multi: "MULTI_SELECT",
  short_essay: "SHORT_ESSAY", short: "SHORT_ESSAY", "short answer": "SHORT_ESSAY",
  long_essay: "LONG_ESSAY", long: "LONG_ESSAY", essay: "LONG_ESSAY", theory: "LONG_ESSAY",
};

/** Header cells become lower_snake keys ("Option A" -> option_a) */
const keyOf = (header: string) => header.trim().toLowerCase().replace(/[\s-]+/g, "_");
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

function rowToQuestion(raw: Record<string, unknown>, rowNumber: number, seq: number): StudioQuestion | string {
  const row: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) row[keyOf(k)] = text(v);

  const prompt = row.question || row.prompt;
  if (!prompt) return `Row ${rowNumber}: the question text is empty.`;

  let options = LETTERS.map((l) => row[`option_${l}`]).filter(Boolean);
  const typeText = (row.type || "").toLowerCase();
  const type: StudioQuestion["type"] =
    TYPE_ALIASES[typeText] || (typeText ? (undefined as any) : options.length ? "MCQ" : "LONG_ESSAY");
  if (!type) return `Row ${rowNumber}: unknown type "${row.type}". Use MCQ, TRUE_FALSE, MULTI_SELECT, SHORT_ESSAY or LONG_ESSAY.`;

  const id = `import_${Date.now()}_${seq}`;
  const marksValue = Number(row.marks);
  const marks = marksValue > 0 ? marksValue : type === "LONG_ESSAY" ? 15 : type === "SHORT_ESSAY" ? 5 : 1;
  const base = {
    id,
    prompt,
    type,
    marks,
    section: row.section || undefined,
    explanation: row.explanation || undefined,
  };

  if (type === "SHORT_ESSAY" || type === "LONG_ESSAY") {
    return {
      ...base,
      options: [],
      minWords: Number(row.min_words) > 0 ? Number(row.min_words) : type === "SHORT_ESSAY" ? 20 : 150,
      maxWords: Number(row.max_words) > 0 ? Number(row.max_words) : type === "SHORT_ESSAY" ? 100 : 800,
      modelAnswer: row.model_answer || "",
      keyTerms: row.key_terms ? row.key_terms.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
  }

  if (type === "TRUE_FALSE" && options.length === 0) options = ["True", "False"];
  if (options.length < 2) return `Row ${rowNumber}: add at least two options (option_a, option_b...).`;

  // Correct answers: letters ("B" or "A,C"), or the option's text (e.g. "True")
  const wanted = (row.correct || "").split(/[,;\s]+/).map((c) => c.trim().toLowerCase()).filter(Boolean);
  const correct = new Set<number>();
  for (const c of wanted) {
    const byLetter = LETTERS.indexOf(c);
    const byText = options.findIndex((o) => o.toLowerCase() === c);
    const idx = c.length === 1 && byLetter >= 0 ? byLetter : byText;
    if (idx < 0 || idx >= options.length) return `Row ${rowNumber}: correct answer "${c}" doesn't match an option.`;
    correct.add(idx);
  }
  if (correct.size === 0) return `Row ${rowNumber}: say which option is correct in the "correct" column.`;
  if (type !== "MULTI_SELECT" && correct.size > 1) {
    return `Row ${rowNumber}: only one answer can be correct for ${type}. Use MULTI_SELECT for several.`;
  }

  return {
    ...base,
    options: options.map((o, i) => ({ id: `${id}_o${i + 1}`, text: o, isCorrect: correct.has(i) })),
  };
}

/** Questions from an Excel or CSV sheet, checked row by row before they reach the editor */
export default function CbtBulkImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: StudioQuestion[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<StudioQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const reset = () => {
    setFileName("");
    setParsed([]);
    setErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const good: StudioQuestion[] = [];
      const bad: string[] = [];
      rows.forEach((row, i) => {
        if (Object.values(row).every((v) => text(v) === "")) return;
        const result = rowToQuestion(row, i + 2, i);
        if (typeof result === "string") bad.push(result);
        else good.push(result);
      });
      if (rows.length === 0) bad.push("The sheet has no rows under the header.");
      setParsed(good);
      setErrors(bad);
    } catch {
      setErrors(["That file couldn't be read. Upload an .xlsx or .csv file."]);
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADER,
      ["What is 2 + 2?", "MCQ", "3", "4", "5", "6", "", "", "B", 1, "Section A", "", "", "Basic addition", "", ""],
      ["The sun is a star.", "TRUE_FALSE", "True", "False", "", "", "", "", "A", 1, "Section A", "", "", "", "", ""],
      ["Which are prime numbers?", "MULTI_SELECT", "2", "4", "5", "9", "", "", "A,C", 2, "Section A", "", "", "", "", ""],
      ["Define photosynthesis.", "SHORT_ESSAY", "", "", "", "", "", "", "", 5, "Section B", 20, 100, "", "Plants convert light to chemical energy", "chlorophyll, light, glucose"],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Questions");
    XLSX.writeFile(book, "paralearn-cbt-questions-template.xlsx");
  };

  const confirm = () => {
    if (parsed.length === 0) return;
    onImport(parsed);
    toast.success(`Added ${parsed.length} question${parsed.length === 1 ? "" : "s"}. Press Save to store them.`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg bg-white border border-[var(--border-fine)] rounded-[var(--radius-lg)] p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Bulk Import Questions
          </DialogTitle>
          <DialogDescription className="text-xs text-[var(--text-secondary)]">
            Upload an Excel (.xlsx) or CSV file with one question per row. Start from the template.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Question spreadsheet"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-[var(--border-fine)] rounded-[var(--radius-md)] p-6 text-center space-y-2 hover:bg-[var(--surface-subtle)]"
        >
          {fileName ? (
            <FileSpreadsheet className="w-8 h-8 text-[var(--violet-ink)] mx-auto" />
          ) : (
            <Upload className="w-8 h-8 text-[var(--violet-ink)] mx-auto" />
          )}
          <div className="text-xs font-bold text-[var(--foreground)]">
            {fileName || "Choose a spreadsheet"}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Columns: question, type, option_a–option_f, correct (e.g. B or A,C), marks, section,
            min_words, max_words, explanation, model_answer, key_terms
          </p>
        </button>

        {(parsed.length > 0 || errors.length > 0) && (
          <div className="space-y-2 text-xs">
            {parsed.length > 0 && (
              <p className="font-semibold text-[var(--emerald-signal)]">
                {parsed.length} question{parsed.length === 1 ? "" : "s"} ready to add.
              </p>
            )}
            {errors.length > 0 && (
              <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 max-h-40 overflow-y-auto">
                <p className="font-semibold mb-1">
                  {errors.length} row{errors.length === 1 ? "" : "s"} skipped:
                </p>
                <ul className="list-disc ml-4 space-y-0.5">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-1.5" />
            Download template
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={parsed.length === 0}
              onClick={confirm}
              className="bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
            >
              Add {parsed.length || ""} question{parsed.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
