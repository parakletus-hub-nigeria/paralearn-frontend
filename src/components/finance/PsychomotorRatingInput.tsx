"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ─── Single-trait star rating ─── */
interface StarRatingProps {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}

export function StarRating({ label, value, onChange, readonly }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-right text-xs font-mono text-muted-foreground">
        {value}/5
      </span>
      <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || value);
          return (
            <button
              key={star}
              type="button"
              disabled={readonly}
              aria-label={`${label}: ${star} star${star !== 1 ? "s" : ""}`}
              onMouseEnter={() => !readonly && setHovered(star)}
              onClick={() => !readonly && onChange?.(star)}
              className={cn(
                "text-xl leading-none transition-colors focus:outline-none",
                readonly ? "cursor-default" : "cursor-pointer",
                filled ? "text-yellow-400" : "text-gray-300 hover:text-yellow-200"
              )}
            >
              &#9733;
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Composite form for multiple traits ─── */
export interface TraitRating {
  traitKey: string;
  traitLabel: string;
  score: number;
}

interface PsychomotorRatingFormProps {
  traits: TraitRating[];
  onChange: (key: string, value: number) => void;
  onSave: (ratings: Record<string, number>) => void;
  saving?: boolean;
  readonly?: boolean;
}

export function PsychomotorRatingForm({
  traits,
  onChange,
  onSave,
  saving,
  readonly,
}: PsychomotorRatingFormProps) {
  const handleSave = () => {
    const map: Record<string, number> = {};
    traits.forEach((t) => { map[t.traitKey] = t.score; });
    onSave(map);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Psychomotor &amp; Affective Ratings
      </p>
      <div className="divide-y">
        {traits.map((t) => (
          <div key={t.traitKey} className="flex items-center justify-between py-2">
            <span className="text-sm">{t.traitLabel}</span>
            <StarRating
              label={t.traitLabel}
              value={t.score}
              onChange={(v) => onChange(t.traitKey, v)}
              readonly={readonly}
            />
          </div>
        ))}
      </div>
      {!readonly && (
        <Button className="w-full mt-2" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Ratings"}
        </Button>
      )}
    </div>
  );
}

/* Default export for convenience */
export default StarRating;
