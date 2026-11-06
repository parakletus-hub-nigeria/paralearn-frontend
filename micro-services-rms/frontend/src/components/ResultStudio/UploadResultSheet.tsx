"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  currentAcademicSession,
  rmsDownloadUrls,
  rmsErrorMessage,
  RMS_TERMS,
  useUploadBatchMutation,
} from "@rms/store/rmsApi";
import { useRmsHref } from "@rms/lib/rmsPaths";

const ACCEPTED = [".xlsx", ".xls"];
// Uploads pass through the web server; Vercel caps request bodies at 4.5 MB
const MAX_BYTES = 4 * 1024 * 1024;

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export default function UploadResultSheet() {
  const router = useRouter();
  const href = useRmsHref();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [session, setSession] = useState(currentAcademicSession());
  const [term, setTerm] = useState<string>(RMS_TERMS[0]);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [uploadBatch, { isLoading }] = useUploadBatchMutation();

  const pick = (candidate?: File | null) => {
    if (!candidate) return;
    const name = candidate.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      toast.error("Upload an Excel file (.xlsx or .xls).");
      return;
    }
    if (candidate.size > MAX_BYTES) {
      toast.error(`That file is ${formatSize(candidate.size)}. Result sheets must be under 4 MB; remove images or extra tabs and try again.`);
      return;
    }
    setFile(candidate);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose the result sheet to upload.");
      return;
    }
    if (!/^\d{4}\/\d{4}$/.test(session.trim())) {
      toast.error("Write the session as YYYY/YYYY, for example 2026/2027.");
      return;
    }
    try {
      const batch = await uploadBatch({ file, session: session.trim(), term, autoGenerate }).unwrap();
      toast.success("Sheet uploaded. Checking it now.");
      router.push(href(`/batches/${batch.id}`));
    } catch (err) {
      toast.error(rmsErrorMessage(err, "Upload failed. Please try again."));
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Upload a result sheet</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            One tab per class. Subjects across the top, with CA and exam columns under each.
          </p>
        </div>
        <a
          href={rmsDownloadUrls.sampleSheet()}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[var(--violet-ink)] hover:underline"
        >
          <Download className="h-4 w-4" />
          Sample sheet
        </a>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-[var(--violet-ink)] bg-[var(--violet-tint)]"
            : "border-[var(--border-fine)] hover:border-[var(--violet-ink)]/50 hover:bg-[var(--surface-muted)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {file ? (
          <div className="flex items-center gap-3 text-left">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{formatSize(file.size)} · click to choose another</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-[var(--violet-ink)]" />
            <p className="mt-2 font-semibold">Drop the Excel file here, or click to choose</p>
            <p className="text-xs text-[var(--text-secondary)]">.xlsx or .xls, up to 4 MB</p>
          </>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="session">Session</Label>
          <Input id="session" value={session} onChange={(e) => setSession(e.target.value)} placeholder="2026/2027" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="term">Term</Label>
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger id="term" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RMS_TERMS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <Checkbox checked={autoGenerate} onCheckedChange={(v) => setAutoGenerate(v === true)} className="mt-0.5" />
        <span>
          <span className="font-semibold">Generate report cards as soon as the sheet checks out</span>
          <span className="block text-[var(--text-secondary)]">Untick to review the computed results before generating.</span>
        </span>
      </label>

      <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={isLoading || !file}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        {isLoading ? "Uploading" : "Upload and process"}
      </Button>
    </form>
  );
}
