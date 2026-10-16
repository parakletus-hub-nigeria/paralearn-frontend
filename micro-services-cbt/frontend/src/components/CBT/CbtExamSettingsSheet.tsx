"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useDeleteCbtExamMutation,
  useUpdateCbtExamMutation,
  type CbtExamItem,
} from "@cbt/store/cbtMicroserviceApi";

/** ISO time -> value for a datetime-local input (local time) */
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const labelClass = "text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]";

/**
 * Exam details and delivery rules, saved to the server: title, access code,
 * duration, opening window, who may sit it, instructions, tab-switch limit,
 * shuffling and whether candidates see their score.
 */
export default function CbtExamSettingsSheet({
  exam,
  open,
  onOpenChange,
}: {
  exam: CbtExamItem | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [updateExam, { isLoading: isSaving }] = useUpdateCbtExamMutation();
  const [deleteExam, { isLoading: isDeleting }] = useDeleteCbtExamMutation();
  const [form, setForm] = useState({
    title: "",
    accessCode: "",
    durationMins: 60,
    scheduled: false,
    startsAt: "",
    endsAt: "",
    rosterOnly: false,
    instructions: "",
    maxTabViolations: 3,
    shuffleQuestions: true,
    shuffleChoices: true,
    showResultAfter: true,
  });

  useEffect(() => {
    if (!exam || !open) return;
    setForm({
      title: exam.title || "",
      accessCode: exam.accessCode || "",
      durationMins: exam.durationMins || 60,
      scheduled: Boolean(exam.startsAt || exam.endsAt),
      startsAt: toLocalInput(exam.startsAt),
      endsAt: toLocalInput(exam.endsAt),
      rosterOnly: exam.accessType === "ROSTER_ONLY",
      instructions: exam.instructions || "",
      maxTabViolations: exam.maxTabViolations ?? 3,
      shuffleQuestions: exam.shuffleQuestions !== false,
      shuffleChoices: exam.shuffleChoices !== false,
      showResultAfter: exam.showResultAfter !== false,
    });
  }, [exam, open]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!exam) return;
    if (!form.title.trim()) {
      toast.error("Give the exam a title.");
      return;
    }
    if (form.scheduled && form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      toast.error("Closing time must be after opening time.");
      return;
    }
    try {
      await updateExam({
        id: exam.id,
        title: form.title.trim(),
        accessCode: form.accessCode.trim().toUpperCase() || undefined,
        durationMins: form.durationMins,
        startsAt: form.scheduled && form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.scheduled && form.endsAt ? new Date(form.endsAt).toISOString() : null,
        accessType: form.rosterOnly ? "ROSTER_ONLY" : "ACCESS_CODE",
        instructions: form.instructions.trim() || null,
        maxTabViolations: form.maxTabViolations,
        shuffleQuestions: form.shuffleQuestions,
        shuffleChoices: form.shuffleChoices,
        showResultAfter: form.showResultAfter,
      }).unwrap();
      toast.success("Exam settings saved.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save the exam settings.");
    }
  };

  const handleDelete = async () => {
    if (!exam) return;
    if (!window.confirm(`Delete "${exam.title}"? Its questions stay in your question bank.`)) return;
    try {
      await deleteExam(exam.id).unwrap();
      toast.success("Exam deleted.");
      router.push("/cbt");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't delete this exam.");
    }
  };

  const check = (key: "shuffleQuestions" | "shuffleChoices" | "showResultAfter" | "rosterOnly", text: string, hint?: string) => (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => set(key, e.target.checked)}
        className="mt-0.5 rounded text-[var(--violet-ink)]"
      />
      <span>
        <span className="font-medium">{text}</span>
        {hint && <span className="block text-[11px] text-[var(--text-secondary)]">{hint}</span>}
      </span>
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-white border-l border-[var(--border-fine)] p-6 overflow-y-auto">
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Exam settings
          </SheetTitle>
          <SheetDescription className="text-xs text-[var(--text-secondary)]">
            Details, timing, access and integrity rules for this exam.
          </SheetDescription>
        </SheetHeader>

        {!exam ? (
          <p className="text-sm text-[var(--text-secondary)] pt-4">
            Save the exam's questions first; settings are available once the exam is on the server.
          </p>
        ) : (
          <div className="space-y-4 pt-4 text-xs text-[var(--foreground)]">
            <label className="block space-y-1">
              <span className={labelClass}>Exam title</span>
              <Input value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className="h-10" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className={labelClass}>Access code</span>
                <Input
                  value={form.accessCode}
                  maxLength={40}
                  onChange={(e) => set("accessCode", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  className="h-10 font-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className={labelClass}>Duration (minutes)</span>
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={form.durationMins}
                  onChange={(e) => set("durationMins", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-10 font-mono"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.scheduled} onChange={(e) => set("scheduled", e.target.checked)} />
              <span className="font-medium">Only open between set times</span>
            </label>
            {form.scheduled && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className={labelClass}>Opens</span>
                  <Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="h-10" />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>Closes</span>
                  <Input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="h-10" />
                </label>
              </div>
            )}

            {check("rosterOnly", "Registered candidates only", "Candidates need the PIN you issue them. Walk-ins can't join.")}

            <label className="block space-y-1">
              <span className={labelClass}>Instructions for candidates</span>
              <textarea
                value={form.instructions}
                maxLength={5000}
                rows={3}
                onChange={(e) => set("instructions", e.target.value)}
                placeholder="Shown in the exam lobby before candidates start"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-fine)] p-2 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className={labelClass}>Tab switches allowed before the exam locks</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.maxTabViolations}
                onChange={(e) => set("maxTabViolations", Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="h-10 font-mono w-28"
              />
            </label>

            <div className="space-y-2.5 pt-1">
              {check("shuffleQuestions", "Shuffle question order for each candidate")}
              {check("shuffleChoices", "Shuffle answer choices", "True/False keeps its order.")}
              {check("showResultAfter", "Show the score when a candidate submits", "Turn off to release results later.")}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-fine)]">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={handleDelete}
                className="text-[var(--crimson-signal)] border-[var(--border-fine)]"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete exam
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="bg-[var(--violet-ink)] hover:bg-[var(--violet-hover)] text-white"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Save settings
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
