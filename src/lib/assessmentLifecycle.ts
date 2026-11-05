/**
 * Where an assessment is in its life, from what students can actually see:
 * unpublished → "draft"; published → "scheduled" / "active" / "ended" by its
 * start and end times. Shared by the admin list and detail pages so they agree.
 */
export type AssessmentLifecycle = "draft" | "scheduled" | "active" | "ended";

type Dated = {
  isPublished?: boolean | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  status?: string | null;
};

const time = (v?: string | Date | null) => (v ? new Date(v).getTime() : NaN);

export function assessmentLifecycle(a: Dated, now: number = Date.now()): AssessmentLifecycle {
  // Older payloads may not carry isPublished; fall back to the backend's status words.
  const published = a.isPublished ?? (a.status === "started" || a.status === "ended" || a.status === "published");
  if (!published) return "draft";
  const ends = time(a.endsAt);
  const starts = time(a.startsAt);
  if (!Number.isNaN(ends) && ends < now) return "ended";
  if (!Number.isNaN(starts) && starts > now) return "scheduled";
  return "active";
}

export const LIFECYCLE_STYLE: Record<AssessmentLifecycle, { label: string; background: string; color: string }> = {
  draft: { label: "Draft", background: "var(--violet-tint)", color: "var(--violet-ink)" },
  scheduled: { label: "Scheduled", background: "var(--amber-tint)", color: "var(--amber-signal)" },
  active: { label: "Active", background: "var(--emerald-tint)", color: "var(--emerald-signal)" },
  ended: { label: "Ended", background: "var(--surface-muted)", color: "var(--foreground-muted)" },
};

/** Human message for a failed publish, pointing at the fix where we can. */
export function publishErrorMessage(err: unknown): string {
  const msg = typeof err === "string" ? err : (err as any)?.message || "Couldn't update the assessment.";
  if (/start date/i.test(msg)) return "Set a start date and time on this assessment before publishing it.";
  if (/end date/i.test(msg)) return "The end time must be after the start time. Edit the assessment, then publish.";
  if (/not allowed|forbidden/i.test(msg)) return "Only school admins, VPs, principals or the teacher who created it can publish this.";
  return msg;
}

const fmt = (v: string | Date) => new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * What to ask before (un)publishing, or why it can't be done. Publishing an
 * assessment whose window has already closed is refused by the backend, so say
 * so up front instead of asking first.
 */
export function publishPrompt(
  a: { title: string; isPublished?: boolean | null; startsAt?: string | Date | null; endsAt?: string | Date | null },
  now: number = Date.now(),
): { blocked: string } | { question: string } {
  if (a.isPublished) {
    return {
      question: `Unpublish "${a.title}"?\n\nStudents won't see it until it's published again. Submissions already made are kept.`,
    };
  }
  if (!a.startsAt) return { blocked: "Set a start date and time on this assessment before publishing it." };
  const starts = new Date(a.startsAt).getTime();
  const ends = a.endsAt ? new Date(a.endsAt).getTime() : NaN;
  if (!Number.isNaN(ends) && ends <= now) {
    return { blocked: `"${a.title}" closed on ${fmt(a.endsAt!)}. Edit its dates before publishing it.` };
  }
  const when =
    starts > now
      ? `can take it from ${fmt(a.startsAt)}`
      : `can take it now${Number.isNaN(ends) ? "" : `, until ${fmt(a.endsAt!)}`}`;
  return { question: `Publish "${a.title}"?\n\nStudents in its class will be notified and ${when}.` };
}
