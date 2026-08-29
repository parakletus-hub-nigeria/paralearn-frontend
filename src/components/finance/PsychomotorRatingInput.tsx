"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Star, Heart, Activity } from "lucide-react";

export const TRAIT_LABELS: Record<string, string> = {
  // Affective Domain
  punctuality: "Punctuality",
  neatness: "Neatness",
  politeness: "Politeness",
  honesty: "Honesty",
  attentiveness: "Attentiveness",
  peerRelationship: "Peer Relationship",
  // Psychomotor Domain
  handwriting: "Handwriting",
  sportsAndGames: "Sports & Games",
  crafts: "Crafts & Creative Skills",
  musicalSkills: "Musical & Performing Skills",
  leadership: "Leadership & Initiative",
};

export const RUBRIC_LABELS: Record<number, string> = {
  1: "Poor / Unsatisfactory",
  2: "Fair / Below Average",
  3: "Good / Average",
  4: "Very Good / Commendable",
  5: "Excellent / Outstanding",
};

export const DEFAULT_AFFECTIVE_KEYS = [
  "punctuality",
  "neatness",
  "politeness",
  "honesty",
  "attentiveness",
  "peerRelationship",
];

export const DEFAULT_PSYCHOMOTOR_KEYS = [
  "handwriting",
  "sportsAndGames",
  "crafts",
  "musicalSkills",
  "leadership",
];

/* ─── Single-trait star rating ─── */
interface StarRatingProps {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}

export function StarRating({ label, value = 0, onChange, readonly }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const activeScore = hovered || value;

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= activeScore;
          return (
            <button
              key={star}
              type="button"
              disabled={readonly}
              aria-label={`${label}: ${star} star${star !== 1 ? "s" : ""} - ${RUBRIC_LABELS[star]}`}
              title={`${star} Star - ${RUBRIC_LABELS[star]}`}
              onMouseEnter={() => !readonly && setHovered(star)}
              onClick={() => !readonly && onChange?.(star)}
              className={cn(
                "p-0.5 rounded transition-all focus:outline-none",
                readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
                filled ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"
              )}
            >
              <Star className={cn("h-4 w-4", filled ? "fill-amber-400" : "fill-slate-100")} />
            </button>
          );
        })}
      </div>
      <span className="w-16 text-right font-mono text-2xs font-bold text-slate-700">
        {value > 0 ? `${value}/5` : "Unrated"}
      </span>
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
  ratings: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onSave?: (ratings: Record<string, number>) => void;
  saving?: boolean;
  readonly?: boolean;
  className?: string;
}

export function PsychomotorRatingForm({
  ratings = {},
  onChange,
  onSave,
  saving,
  readonly,
  className,
}: PsychomotorRatingFormProps) {
  const handleSave = () => {
    onSave?.(ratings);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Affective Domain */}
      <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Heart className="h-4 w-4 text-rose-500" />
          <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Affective Domain Development
          </p>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {DEFAULT_AFFECTIVE_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-2 gap-4">
              <div>
                <span className="font-semibold text-slate-800">{TRAIT_LABELS[key] || key}</span>
                {ratings[key] ? (
                  <p className="text-2xs text-muted-foreground">{RUBRIC_LABELS[ratings[key]]}</p>
                ) : null}
              </div>
              <StarRating
                label={TRAIT_LABELS[key] || key}
                value={ratings[key] || 0}
                onChange={(v) => onChange(key, v)}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Psychomotor Domain */}
      <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 pb-1 border-b">
          <Activity className="h-4 w-4 text-blue-500" />
          <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Psychomotor &amp; Applied Skills
          </p>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {DEFAULT_PSYCHOMOTOR_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between py-2 gap-4">
              <div>
                <span className="font-semibold text-slate-800">{TRAIT_LABELS[key] || key}</span>
                {ratings[key] ? (
                  <p className="text-2xs text-muted-foreground">{RUBRIC_LABELS[ratings[key]]}</p>
                ) : null}
              </div>
              <StarRating
                label={TRAIT_LABELS[key] || key}
                value={ratings[key] || 0}
                onChange={(v) => onChange(key, v)}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      </div>

      {!readonly && onSave && (
        <Button className="w-full bg-primary font-semibold text-xs h-10" onClick={handleSave} disabled={saving}>
          {saving ? "Saving Ratings…" : "Save Domain Ratings"}
        </Button>
      )}
    </div>
  );
}

export default StarRating;
