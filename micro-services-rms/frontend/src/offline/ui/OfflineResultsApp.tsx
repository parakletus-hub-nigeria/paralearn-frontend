"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, ChevronRight, CloudOff, CloudUpload, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db, getProfile, getSession, requestPersistentStorage, type BatchRecord, type K12Session, type SchoolProfile } from "../storage/db";
import { fetchSchoolBranding, signOut, syncPending } from "../storage/k12";
import { fetchLogo } from "./logo";
import { setUpOffline, type OfflineReadiness } from "./serviceWorker";
import { plural, timeAgo } from "./util";
import SignIn from "./SignIn";
import NewBatch from "./NewBatch";
import BatchView from "./BatchView";
import SchoolProfileForm from "./SchoolProfileForm";
import TemplatePage from "./TemplatePage";
import WorkspaceShell, { type Section } from "./WorkspaceShell";
import "./rms-workspace.css";

/** Views live in the URL hash so they work offline, with no server round trip */
type View = { kind: "home" } | { kind: "batch"; id: string; fresh: boolean } | { kind: "profile" } | { kind: "template" };

function readView(): View {
  const h = window.location.hash;
  const batch = /^#\/batch\/([\w-]+)(\?new)?$/.exec(h);
  if (batch) return { kind: "batch", id: batch[1], fresh: !!batch[2] };
  if (h === "#/profile") return { kind: "profile" };
  if (h === "#/template") return { kind: "template" };
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
  const view = useMemo(() => (typeof window === "undefined" ? ({ kind: "home" } as View) : readView()), [hash]);
  const go = useCallback((h: string) => {
    window.location.hash = h;
    window.scrollTo({ top: 0 });
  }, []);
  return [view, go];
}

function SyncChip({ sync }: { sync: BatchRecord["sync"] }) {
  if (sync.status === "synced")
    return (
      <span className="rms-status ok">
        <CheckCircle2 size={12} />
        Sent
      </span>
    );
  if (sync.status === "syncing")
    return (
      <span className="rms-status ready">
        <Loader2 size={12} className="animate-spin" />
        Sending
      </span>
    );
  if (sync.status === "failed")
    return (
      <span className="rms-status bad">
        <CloudOff size={12} />
        Not sent
      </span>
    );
  return (
    <span className="rms-status">
      <CloudUpload size={12} />
      To send
    </span>
  );
}

function Home({ onOpen, onTemplate }: { onOpen: (id: string, fresh?: boolean) => void; onTemplate: () => void }) {
  const batches = useLiveQuery(() => db.batches.orderBy("createdAt").reverse().toArray(), []);
  const totals = useMemo(() => {
    const list = batches || [];
    return {
      students: list.reduce((a, b) => a + b.totalStudents, 0),
      ready: list.filter((b) => b.generatedClasses.length === b.classNames.length).length,
      waiting: list.filter((b) => b.sync.status !== "synced").length,
    };
  }, [batches]);

  return (
    <main className="rms-page">
      <div className="rms-page-heading">
        <div>
          <span className="rms-eyebrow">Report cards, with or without internet</span>
          <h1>Result batches</h1>
        </div>
        <div className="rms-page-actions">
          <button type="button" className="rms-button" onClick={onTemplate}>
            <FileText size={16} />
            CSV template
          </button>
        </div>
      </div>

      <dl className="rms-summary">
        <div>
          <dt>Batches on this laptop</dt>
          <dd>{batches?.length ?? "–"}</dd>
        </div>
        <div>
          <dt>Students worked out</dt>
          <dd>{batches ? totals.students : "–"}</dd>
        </div>
        <div>
          <dt>Batches with cards ready</dt>
          <dd>{batches ? totals.ready : "–"}</dd>
        </div>
        <div>
          <dt>Waiting to send to ParaLearn</dt>
          <dd>{batches ? totals.waiting : "–"}</dd>
          <small>{totals.waiting ? "Sends when online" : "All sent"}</small>
        </div>
      </dl>

      <NewBatch onCreated={(id) => onOpen(id, true)} />

      <section aria-labelledby="batches-heading">
        <h2 id="batches-heading" className="rms-section-title" style={{ marginBottom: 12 }}>
          On this laptop
        </h2>
        {!batches ? (
          [0, 1, 2].map((i) => <div key={i} className="rms-skeleton" />)
        ) : !batches.length ? (
          <div className="rms-empty">
            <FileSpreadsheet size={28} />
            <h2>No result sheets yet</h2>
            <p>
              Open your school&apos;s Excel result sheet above. No sheet?{" "}
              <button type="button" className="rms-link" onClick={onTemplate}>
                Download our CSV template
              </button>
              , fill it in and open it.
            </p>
          </div>
        ) : (
          <div className="rms-table-wrap">
            <table className="rms-table">
              <thead>
                <tr>
                  <th>Result sheet</th>
                  <th className="num">Students</th>
                  <th>Report cards</th>
                  <th className="rms-hide-sm">ParaLearn</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const ready = b.generatedClasses.length === b.classNames.length;
                  return (
                    <tr key={b.id} onClick={() => onOpen(b.id)}>
                      <td>
                        <a
                          href={`#/batch/${b.id}`}
                          className="rms-table-name"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onOpen(b.id);
                          }}
                        >
                          {b.fileName}
                        </a>
                        <span className="rms-table-meta">
                          <span>
                            {b.term} · {b.session}
                          </span>
                          <span>{plural(b.classNames.length, "class", "classes")}</span>
                          <span>{timeAgo(b.createdAt)}</span>
                        </span>
                      </td>
                      <td className="num">{b.totalStudents}</td>
                      <td>
                        {ready ? (
                          <span className="rms-status ok">
                            <CheckCircle2 size={12} />
                            Cards ready
                          </span>
                        ) : (
                          <span className="rms-status warn">
                            {b.generatedClasses.length}/{b.classNames.length} classes
                          </span>
                        )}
                      </td>
                      <td className="rms-hide-sm">
                        <SyncChip sync={b.sync} />
                      </td>
                      <td className="num">
                        <ChevronRight size={16} style={{ color: "var(--rms-muted)" }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
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
      <div className="rms-surface">
        <main className="rms-page" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rms-skeleton" />
          ))}
        </main>
      </div>
    );
  }

  if (!session || reSignIn) return <SignIn onSignedIn={onSignedIn} />;

  const onProfile = profileSetup || view.kind === "profile";
  const section: Section | null = onProfile ? "profile" : view.kind === "template" ? "template" : view.kind === "home" ? "batches" : null;

  return (
    <WorkspaceShell section={section} schoolName={profile.schoolName} session={session} readiness={readiness} onNavigate={go} onSignOut={doSignOut}>
      {onProfile ? (
        <main className="rms-page">
          <div className="rms-page-heading">
            <div>
              <span className="rms-eyebrow">Printed at the top of every report card</span>
              <h1>School profile</h1>
            </div>
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
        </main>
      ) : view.kind === "template" ? (
        <TemplatePage schoolName={profile.schoolName} onBack={() => go("#/")} />
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
        <Home onOpen={(id, fresh) => go(`#/batch/${id}${fresh ? "?new" : ""}`)} onTemplate={() => go("#/template")} />
      )}
    </WorkspaceShell>
  );
}
