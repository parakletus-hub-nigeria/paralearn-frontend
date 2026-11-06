"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, ChevronRight, CloudOff, CloudUpload, FileSpreadsheet, LogOut, Settings, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db, getProfile, getSession, requestPersistentStorage, type K12Session, type SchoolProfile } from "../storage/db";
import { fetchSchoolBranding, signOut, syncPending } from "../storage/k12";
import { fetchLogo } from "./logo";
import { setUpOffline, type OfflineReadiness } from "./serviceWorker";
import { plural, timeAgo, useOnline } from "./util";
import { Wordmark } from "./Wordmark";
import SignIn from "./SignIn";
import NewBatch from "./NewBatch";
import BatchView from "./BatchView";
import SchoolProfileForm from "./SchoolProfileForm";

/** Views live in the URL hash so they work offline, with no server round trip */
type View = { kind: "home" } | { kind: "batch"; id: string; fresh: boolean } | { kind: "profile" };

function readView(): View {
  const h = window.location.hash;
  const batch = /^#\/batch\/([\w-]+)(\?new)?$/.exec(h);
  if (batch) return { kind: "batch", id: batch[1], fresh: !!batch[2] };
  if (h === "#/profile") return { kind: "profile" };
  return { kind: "home" };
}

function useView(): [View, (hash: string) => void] {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => window.location.hash,
    () => ""
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = React.useMemo(() => (typeof window === "undefined" ? ({ kind: "home" } as View) : readView()), [hash]);
  const go = useCallback((h: string) => {
    window.location.hash = h;
  }, []);
  return [view, go];
}

function StatusPills({ readiness }: { readiness: OfflineReadiness | null }) {
  const online = useOnline();
  return (
    <div className="hidden items-center gap-2 md:flex">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          online ? "bg-emerald-50 text-emerald-800" : "bg-[var(--amber-tint)] text-amber-900"
        }`}
      >
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Online" : "Offline"}
      </span>
      {readiness === "ready" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--violet-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--violet-ink)]" title="This app reopens without internet">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Works offline
        </span>
      )}
    </div>
  );
}

function BatchList({ onOpen }: { onOpen: (id: string) => void }) {
  const batches = useLiveQuery(() => db.batches.orderBy("createdAt").reverse().toArray(), []);
  if (!batches) return <Skeleton className="h-40 w-full" />;
  if (!batches.length) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-fine)] p-8 text-center">
        <FileSpreadsheet className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
        <p className="mt-2 font-semibold">No result sheets yet</p>
        <p className="text-sm text-[var(--text-secondary)]">Each sheet you open is saved here with its report cards.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[var(--border-fine)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-fine)] bg-white">
      {batches.map((b) => {
        const ready = b.generatedClasses.length === b.classNames.length;
        const sync = b.sync.status;
        return (
          <li key={b.id}>
            <button onClick={() => onOpen(b.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-muted)]">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.fileName}</span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {b.term} · {b.session} · {plural(b.totalStudents, "student")} · {timeAgo(b.createdAt)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
                <span className={ready ? "text-emerald-700" : "text-[var(--text-secondary)]"}>
                  {ready ? "Cards ready" : `${b.generatedClasses.length}/${b.classNames.length} classes`}
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    sync === "synced" ? "text-emerald-700" : sync === "failed" ? "text-[var(--crimson-signal)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {sync === "synced" ? <CheckCircle2 className="h-3.5 w-3.5" /> : sync === "failed" ? <CloudOff className="h-3.5 w-3.5" /> : <CloudUpload className="h-3.5 w-3.5" />}
                  {sync === "synced" ? "Sent" : sync === "failed" ? "Not sent" : sync === "syncing" ? "Sending" : "To send"}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function OfflineResultsApp() {
  const [loaded, setLoaded] = useState(false);
  const [session, setSessionState] = useState<K12Session | null>(null);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
  const [reSignIn, setReSignIn] = useState(false);
  // The school confirms its card header once, before the first batch
  const [profileSetup, setProfileSetup] = useState(false);
  const [view, go] = useView();

  useEffect(() => {
    Promise.all([getSession(), getProfile()]).then(([s, p]) => {
      setSessionState(s);
      setProfile(p);
      setProfileSetup(!p.schoolName);
      setLoaded(true);
    });
    requestPersistentStorage();
    setUpOffline().then(setReadiness);
  }, []);

  // Send any scores waiting from offline work, now and whenever the connection returns
  useEffect(() => {
    if (!session) return;
    const run = () =>
      syncPending()
        .then(({ synced }) => synced && toast.success(`${plural(synced, "batch", "batches")} of scores sent to ParaLearn.`))
        .catch(() => undefined);
    run();
    window.addEventListener("online", run);
    // "Online" can mean Wi-Fi with no data; keep retrying quietly while scores are waiting
    const timer = window.setInterval(run, 60_000);
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(timer);
    };
  }, [session]);

  const onSignedIn = async (s: K12Session) => {
    const current = await getProfile();
    if (!current.schoolName) {
      // Prefill the card header from the school's ParaLearn details before showing the form,
      // so a late answer can't overwrite what the user has started typing
      const lookup = (async () => {
        const branding = await fetchSchoolBranding(s.subdomain);
        const logoBytes = branding?.logoUrl ? await fetchLogo(branding.logoUrl) : null;
        return { branding, logoBytes };
      })();
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const found = await Promise.race([lookup, timeout]);
      setProfile({
        ...current,
        schoolName: found?.branding?.name || "",
        color: found?.branding?.color || current.color,
        email: current.email || s.user.email || "",
        logo: found?.logoBytes ? { bytes: found.logoBytes, type: "png" } : current.logo,
      });
      setProfileSetup(true);
    }
    setReSignIn(false);
    setSessionState(s);
  };

  const doSignOut = async () => {
    if (!window.confirm("Sign out? Result batches stay on this laptop. You'll need internet to sign in again.")) return;
    await signOut();
    setSessionState(null);
  };

  if (!loaded || !profile) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6">
        <Skeleton className="mx-auto h-64 max-w-5xl" />
      </div>
    );
  }

  if (!session || reSignIn) {
    return <SignIn onSignedIn={onSignedIn} />;
  }

  const showProfile = profileSetup || view.kind === "profile";

  return (
    <div className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-fine)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button onClick={() => go("#/")} aria-label="Result batches">
            <Wordmark className="text-sm sm:text-base" />
          </button>
          <div className="flex items-center gap-2">
            <StatusPills readiness={readiness} />
            <span className="hidden max-w-[200px] truncate text-sm font-semibold lg:inline">{profile.schoolName}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => go("#/profile")} aria-label="School profile" title="School profile">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={doSignOut} aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {showProfile ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">School profile</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Printed at the top of every report card. Saved on this laptop.</p>
            </div>
            <SchoolProfileForm
              initial={profile}
              firstRun={profileSetup}
              onSaved={(p) => {
                setProfile(p);
                setProfileSetup(false);
                go("#/");
              }}
            />
          </div>
        ) : view.kind === "batch" ? (
          <BatchView
            key={view.id}
            batchId={view.id}
            profile={profile}
            autoStart={view.fresh}
            onBack={() => go("#/")}
            onSignInNeeded={() => setReSignIn(true)}
          />
        ) : (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Result batches</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Open a term&apos;s result sheet to work out positions and grades and print report cards, with or without internet.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <NewBatch onCreated={(id) => go(`#/batch/${id}?new`)} />
              <section aria-labelledby="batches-heading">
                <h2 id="batches-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                  On this laptop
                </h2>
                <BatchList onOpen={(id) => go(`#/batch/${id}`)} />
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
