"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import RmsShell from "@rms/components/ResultStudio/RmsShell";
import UploadResultSheet from "@rms/components/ResultStudio/UploadResultSheet";
import BatchStatusBadge from "@rms/components/ResultStudio/BatchStatusBadge";
import { isBatchActive, rmsErrorMessage, useGetMeQuery, useListBatchesQuery } from "@rms/store/rmsApi";
import { useRmsHref } from "@rms/lib/rmsPaths";

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function BatchList() {
  const href = useRmsHref();
  // Refresh only while some batch is still being processed
  const [pollingInterval, setPollingInterval] = useState(0);
  const { data: batches, isLoading, error } = useListBatchesQuery(undefined, { pollingInterval });
  const anyActive = (batches || []).some((b) => isBatchActive(b.status));
  useEffect(() => setPollingInterval(anyActive ? 4000 : 0), [anyActive]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-[var(--crimson-signal)]">{rmsErrorMessage(error, "Couldn't load your batches.")}</p>;
  }
  if (!batches?.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-fine)] p-8 text-center">
        <FileSpreadsheet className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
        <p className="mt-2 font-semibold">No result sheets yet</p>
        <p className="text-sm text-[var(--text-secondary)]">Each sheet you upload appears here with its report cards.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border-fine)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white">
      {batches.map((batch) => {
        const progress = batch.totalStudents ? Math.round((batch.renderedCount / batch.totalStudents) * 100) : 0;
        return (
          <li key={batch.id}>
            <Link
              href={href(`/batches/${batch.id}`)}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-muted)]"
            >
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{batch.fileName || `${batch.term}, ${batch.session}`}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {batch.term} · {batch.session} · {batch.classes?.length || 0} classes ·{" "}
                  <span className="tabular-nums">{batch.totalStudents}</span> students ·{" "}
                  {dateFormat.format(new Date(batch.createdAt))}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <BatchStatusBadge status={batch.status} />
                {batch.status === "RENDERING" && (
                  <span className="text-xs tabular-nums text-[var(--text-secondary)]">{progress}%</span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Dashboard() {
  const { data: session } = useGetMeQuery();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Result batches</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {session?.workspace?.name ? `${session.workspace.name}: ` : ""}upload a term&apos;s scores and download the report cards.
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <UploadResultSheet />
        <section aria-labelledby="recent-batches">
          <h2 id="recent-batches" className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            Recent uploads
          </h2>
          <BatchList />
        </section>
      </div>
    </div>
  );
}

export default function RmsHomePage() {
  return (
    <RmsShell>
      <Dashboard />
    </RmsShell>
  );
}
