"use client";

import React, { useState } from "react";
import type { SheetIssue } from "../engine/types";

/** Problems found in the sheet, errors first, with tab and row so they're easy to find */
export default function IssueList({ issues, limit = 6 }: { issues: SheetIssue[]; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
  const shown = expanded ? sorted : sorted.slice(0, limit);
  return (
    <div>
      <ul className="rms-issue-list">
        {shown.map((issue, i) => (
          <li key={i}>
            <span className={`rms-status ${issue.level === "error" ? "bad" : "warn"}`}>{issue.level === "error" ? "Fix" : "Check"}</span>
            <span>
              <code>
                {issue.sheet}
                {issue.row ? ` · row ${issue.row}` : ""}
              </code>{" "}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="rms-link" style={{ marginTop: 10, fontSize: 12 }}>
          {expanded ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
