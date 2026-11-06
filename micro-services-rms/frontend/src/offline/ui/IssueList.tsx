"use client";

import React, { useState } from "react";
import type { SheetIssue } from "../engine/types";

/** Problems found in the sheet, errors first, with tab and row so they're easy to find */
export default function IssueList({ issues, className = "", limit = 6 }: { issues: SheetIssue[]; className?: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  const shown = expanded ? sorted : sorted.slice(0, limit);
  return (
    <div className={className}>
      <ul className="space-y-1.5 text-sm">
        {shown.map((issue, i) => (
          <li key={i} className="flex gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${issue.level === "error" ? "bg-[var(--crimson-signal)]" : "bg-[var(--amber-signal)]"}`}
              aria-label={issue.level}
            />
            <span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {issue.sheet}
                {issue.row ? ` · row ${issue.row}` : ""}
              </span>{" "}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-[var(--violet-ink)] hover:underline">
          {expanded ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
