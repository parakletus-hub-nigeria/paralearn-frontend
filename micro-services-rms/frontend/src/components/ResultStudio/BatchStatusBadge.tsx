import React from "react";
import { Loader2 } from "lucide-react";
import type { RmsBatchStatus } from "@rms/store/rmsApi";

const STYLES: Record<RmsBatchStatus, { label: string; className: string; spinning?: boolean }> = {
  UPLOADED: { label: "Queued", className: "bg-[var(--surface-muted)] text-[var(--text-secondary)]", spinning: true },
  PARSING: { label: "Checking sheet", className: "bg-[var(--violet-tint)] text-[var(--violet-ink)]", spinning: true },
  PARSED: { label: "Ready to generate", className: "bg-sky-50 text-sky-800" },
  RENDERING: { label: "Generating cards", className: "bg-[var(--violet-tint)] text-[var(--violet-ink)]", spinning: true },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-800" },
  COMPLETED_WITH_ERRORS: { label: "Completed with errors", className: "bg-[var(--amber-tint)] text-amber-900" },
  FAILED: { label: "Failed", className: "bg-[var(--crimson-tint)] text-red-800" },
};

export default function BatchStatusBadge({ status }: { status: RmsBatchStatus }) {
  const style = STYLES[status] || { label: status, className: "bg-[var(--surface-muted)] text-[var(--text-secondary)]" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.spinning && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {style.label}
    </span>
  );
}
