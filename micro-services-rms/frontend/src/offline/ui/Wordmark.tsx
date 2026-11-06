import React from "react";
import { FileSpreadsheet } from "lucide-react";

export function Wordmark({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${inverted ? "text-white" : "text-[var(--foreground)]"} ${className}`}>
      <span
        className={`grid h-7 w-7 place-items-center rounded-[var(--radius-md)] ${
          inverted ? "bg-white text-[var(--violet-ink)]" : "bg-[var(--violet-ink)] text-white"
        }`}
      >
        <FileSpreadsheet className="h-4 w-4" />
      </span>
      ParaLearn <span className={inverted ? "text-white/80" : "text-[var(--violet-ink)]"}>Results</span>
    </span>
  );
}
