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
import "./cbt-monitor.css";

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
      <DialogContent className="cbt-dialog cbt-sheet max-w-2xl max-h-[85vh] overflow-y-auto">
        {review && (
          <>
            <DialogHeader>
              <DialogTitle className="cbt-sheet-title">{review.candidateName}&apos;s answer sheet</DialogTitle>
              <DialogDescription className="cbt-sheet-sub">
                PIN {review.candidatePin} · {review.score} / {review.totalMarks} marks ({review.percentage}%)
                {review.grade ? ` · Grade ${review.grade}` : ""}
              </DialogDescription>
            </DialogHeader>
            <ol className="cbt-sheet-list">
              {review.questions.map((q, idx) => {
                const chosen = chosenIds(q.answer);
                const isEssay = q.type === "ESSAY" || !q.options?.length;
                const result = q.isCorrect === true ? "right" : q.isCorrect === false ? "wrong" : "open";
                return (
                  <li key={q.id}>
                    <div className="cbt-sheet-q">
                      <p>
                        <span className="cbt-sheet-n">{idx + 1}.</span> {q.prompt}
                      </p>
                      <span className={`cbt-sheet-marks ${result}`}>
                        {q.marksAwarded ?? "–"} / {q.marks}
                      </span>
                    </div>
                    {isEssay ? (
                      <p className="cbt-sheet-essay">
                        {typeof q.answer === "string" && q.answer ? q.answer : "No answer"}
                      </p>
                    ) : (
                      <ul className="cbt-sheet-options">
                        {q.options!.map((opt) => {
                          const picked = chosen.includes(String(opt.id));
                          return (
                            <li key={opt.id} className={opt.isCorrect ? "right" : picked ? "wrong" : undefined}>
                              {opt.isCorrect ? (
                                <Check size={14} aria-label="Correct answer" />
                              ) : picked ? (
                                <X size={14} aria-label="Chosen, incorrect" />
                              ) : (
                                <span className="cbt-sheet-gap" />
                              )}
                              <span>{opt.text}</span>
                              {picked && <b>Chosen</b>}
                            </li>
                          );
                        })}
                        {chosen.length === 0 && <li className="cbt-sheet-none">Not answered</li>}
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
