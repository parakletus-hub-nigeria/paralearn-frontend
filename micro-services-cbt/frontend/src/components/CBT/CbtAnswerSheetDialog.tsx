"use client";

import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttemptReviewPayload } from "@cbt/store/cbtMicroserviceApi";

/** The ids a candidate chose, whatever form the answer was stored in */
function chosenIds(answer: unknown): string[] {
  const value =
    answer && typeof answer === "object" && !Array.isArray(answer) && "selected" in (answer as any)
      ? (answer as any).selected
      : answer;
  if (Array.isArray(value)) return value.map(String);
  return value === null || value === undefined || value === "" ? [] : [String(value)];
}

/** A candidate's full answer sheet with the marking, for the examiner */
export default function CbtAnswerSheetDialog({
  review,
  onClose,
}: {
  review: AttemptReviewPayload | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!review} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white">
        {review && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {review.candidateName} · answer sheet
              </DialogTitle>
              <DialogDescription className="text-xs">
                PIN {review.candidatePin} · {review.score} / {review.totalMarks} marks ({review.percentage}%)
                {review.grade ? ` · ${review.grade}` : ""}
              </DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 pt-2">
              {review.questions.map((q, idx) => {
                const chosen = chosenIds(q.answer);
                const isEssay = q.type === "ESSAY" || !q.options?.length;
                return (
                  <li key={q.id} className="rounded-lg border border-slate-200 p-3 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">
                        {idx + 1}. {q.prompt}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          q.isCorrect === true
                            ? "bg-emerald-100 text-emerald-800"
                            : q.isCorrect === false
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {q.marksAwarded ?? "–"} / {q.marks}
                      </span>
                    </div>
                    {isEssay ? (
                      <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">
                        {typeof q.answer === "string" && q.answer ? q.answer : "No answer"}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {q.options!.map((opt) => {
                          const picked = chosen.includes(String(opt.id));
                          return (
                            <li
                              key={opt.id}
                              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                                opt.isCorrect ? "bg-emerald-50 text-emerald-900" : picked ? "bg-red-50 text-red-800" : ""
                              }`}
                            >
                              {opt.isCorrect ? (
                                <Check className="h-3.5 w-3.5" aria-label="Correct answer" />
                              ) : picked ? (
                                <X className="h-3.5 w-3.5" aria-label="Chosen, incorrect" />
                              ) : (
                                <span className="inline-block h-3.5 w-3.5" />
                              )}
                              <span>{opt.text}</span>
                              {picked && <span className="ml-auto font-semibold">chosen</span>}
                            </li>
                          );
                        })}
                        {chosen.length === 0 && <li className="text-xs italic text-slate-500">Not answered</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
