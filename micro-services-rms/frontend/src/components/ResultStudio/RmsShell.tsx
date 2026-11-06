"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileSpreadsheet, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeQuery, useLogoutMutation, rmsApi, RMS_SESSION_EXPIRED_EVENT } from "@rms/store/rmsApi";
import { useRmsHref } from "@rms/lib/rmsPaths";
import { useDispatch } from "react-redux";

export function RmsWordmark({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${
        inverted ? "text-white" : "text-[var(--foreground)]"
      } ${className}`}
    >
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

/** Signed-in frame for every RMS page except /auth */
export default function RmsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const href = useRmsHref();
  const dispatch = useDispatch();
  const { data: session, error, isLoading } = useGetMeQuery();
  const [logout] = useLogoutMutation();

  const unauthenticated = (error as { status?: unknown } | undefined)?.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(href("/auth"));
  }, [unauthenticated, router, href]);

  useEffect(() => {
    const onExpired = () => router.replace(`${href("/auth")}?expired=1`);
    window.addEventListener(RMS_SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(RMS_SESSION_EXPIRED_EVENT, onExpired);
  }, [router, href]);

  const signOut = async () => {
    await logout().catch(() => undefined);
    dispatch(rmsApi.util.resetApiState());
    router.replace(href("/auth"));
  };

  const workspace = session?.workspace;
  const navItems = [
    { label: "Result batches", path: "/", active: !pathname.includes("/settings") },
    { label: "School profile", path: "/settings", active: pathname.includes("/settings") },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <header className="sticky top-0 z-30 border-b border-[var(--border-fine)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={href("/")} aria-label="Result batches">
            <RmsWordmark className="text-sm sm:text-base" />
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={href(item.path)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-semibold transition-colors ${
                  item.active
                    ? "bg-[var(--violet-tint)] text-[var(--violet-ink)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <Skeleton className="h-8 w-36" />
            ) : workspace ? (
              <div className="flex min-w-0 items-center gap-2">
                {workspace.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={workspace.logoUrl} alt="" className="h-8 w-8 rounded-full border border-[var(--border-fine)] object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--violet-tint)] text-xs font-bold text-[var(--violet-ink)]">
                    {workspace.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[180px] truncate text-sm font-semibold md:inline">{workspace.name}</span>
              </div>
            ) : null}
            <Link href={href("/settings")} className="sm:hidden">
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="School profile">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading || unauthenticated ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white p-8 text-center">
            <p className="font-semibold">Can&apos;t reach the results service right now.</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Check your connection and reload the page.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
