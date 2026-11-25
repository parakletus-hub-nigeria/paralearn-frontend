"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CheckCircle2, CloudOff, CloudUpload, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { accountKey, db, deleteBatch, getAccountBatch, getAccountBatches, getProfile, getSession, requestPersistentStorage, type BatchRecord, type K12Session, type SchoolProfile } from "../storage/db";
import { K12Error, fetchSchoolBranding, signOut, syncBatch, syncPending } from "../storage/k12";
import { fetchLogo } from "./logo";
import { setUpOffline, type OfflineReadiness } from "./serviceWorker";
import { plural, timeAgo, useOnline } from "./util";
import { cancelGeneration, useGeneration } from "./generation";
import SignIn from "./SignIn";
import Landing from "./Landing";
import NewBatch from "./NewBatch";
import BatchView from "./BatchView";
import SchoolProfileForm from "./SchoolProfileForm";
import TemplatePage from "./TemplatePage";
import WorkspaceShell, { ConfirmDialog, type Section } from "./WorkspaceShell";
import "./rms-workspace.css";

/** Views live in the URL hash so they work offline, with no server round trip */
type View =
  | { kind: "home" }
  | { kind: "batch"; id: string; fresh: boolean }
  | { kind: "profile" }
  | { kind: "template" }
  | { kind: "signin"; mode: "signin" | "create" };

function readView(): View {
  const h = window.location.hash;
  const batch = /^#\/batch\/([\w-]+)(\?new)?$/.exec(h);
  if (batch) return { kind: "batch", id: batch[1], fresh: !!batch[2] };
  if (h === "#/profile") return { kind: "profile" };
  if (h === "#/template") return { kind: "template" };
  if (h === "#/signin") return { kind: "signin", mode: "signin" };
  if (h === "#/create") return { kind: "signin", mode: "create" };
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

/** Where a batch's scores are with ParaLearn, plus the one action that helps (send now, send again, sign in) */
function SyncCell({ batch, onSignInNeeded }: { batch: BatchRecord; onSignInNeeded: () => void }) {
  const online = useOnline();
  const s = batch.sync;
  const send = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await syncBatch(batch.id);
      toast.success("Scores sent to ParaLearn.");
    } catch (err) {
      if (err instanceof K12Error && err.needsSignIn) onSignInNeeded();
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    }
  };

  let chip: React.ReactNode;
  if (s.status === "synced")
    chip = (
      <span className="rms-status ok">
        <CheckCircle2 size={12} aria-hidden />
        Sent
      </span>
    );
  else if (s.status === "syncing")
    chip = (
      <span className="rms-status ready">
        <Loader2 size={12} className="animate-spin" aria-hidden />
        Sending
      </span>
    );
  else if (s.status === "failed")
    chip = (
      <span className={`rms-status ${s.needsSignIn ? "warn" : "bad"}`}>
        <CloudOff size={12} aria-hidden />
        {s.needsSignIn ? "Sign in needed" : "Not sent"}
      </span>
    );
  else
    chip = (
      <span className="rms-status">
        <CloudUpload size={12} aria-hidden />
        Waiting to send
      </span>
    );

  const action =
    s.status === "failed" && s.needsSignIn ? (
      <button
        type="button"
        className="rms-link"
        onClick={(e) => {
          e.stopPropagation();
          onSignInNeeded();
        }}
      >
        Sign in
      </button>
    ) : s.status === "failed" || s.status === "pending" ? (
      online ? (
        <button type="button" className="rms-link" onClick={send}>
          {s.status === "failed" ? "Send again" : "Send now"}
        </button>
      ) : (
        <span className="rms-cell-note">When online</span>
      )
    ) : s.status === "synced" ? (
      <span className="rms-cell-note">{timeAgo(s.at)}</span>
    ) : null;

  return (
    <div className="rms-sync-cell">
      <div className="rms-sync-row">
        {chip}
        {action}
      </div>
      {/* Why it failed, in words, not hidden in a tooltip */}
      {s.status === "failed" && !s.needsSignIn && s.error && <span className="rms-sync-reason">{s.error}</span>}
    </div>
  );
}

/** "JSS 1A, JSS 1B and 4 more" */
function classSummary(names: string[]) {
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

function Home({
  session,
  onOpen,
  onTemplate,
  onSignInNeeded,
}: {
  session: K12Session;
  onOpen: (id: string, fresh?: boolean) => void;
  onTemplate: () => void;
  onSignInNeeded: () => void;
}) {
  const ownerKey = accountKey(session);
  // An error reading IndexedDB (a blocked or private browser) shows a message, not an endless skeleton
  const loaded = useLiveQuery(async () => {
    try {
      return { list: await getAccountBatches(ownerKey), error: null };
    } catch (err) {
      return { list: [] as BatchRecord[], error: err instanceof Error ? err.message : "Unknown error" };
    }
  }, [ownerKey]);
  const batches = loaded?.list;
  const generation = useGeneration();
  const [toDelete, setToDelete] = useState<BatchRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totals = useMemo(() => {
    const list = batches || [];
    return {
      students: list.reduce((a, b) => a + b.totalStudents, 0),
      waiting: list.filter((b) => b.sync.status !== "synced").length,
    };
  }, [batches]);

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (generation?.batchId === toDelete.id) cancelGeneration();
      await deleteBatch(toDelete.id, ownerKey);
      toast.success("Batch deleted from this laptop.");
      setToDelete(null);
    } catch {
      toast.error("Couldn't delete the batch. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="rms-page">
      <div className="rms-page-heading">
        <div>
          <h1>Result batches</h1>
          {batches && batches.length > 0 ? (
            <p className="rms-facts">
              <span>{plural(batches.length, "batch", "batches")} on this laptop</span>
              <span>{plural(totals.students, "student")}</span>
              <span>{totals.waiting ? `${totals.waiting} waiting to send to ParaLearn` : "All scores sent to ParaLearn"}</span>
            </p>
          ) : (
            <p className="rms-facts">
              <span>Report cards from your result sheet, with or without internet</span>
            </p>
          )}
        </div>
      </div>

      <NewBatch session={session} onCreated={(id) => onOpen(id, true)} onTemplate={onTemplate} />

      <section aria-labelledby="batches-heading" className="rms-batches">
        <div className="rms-section-head">
          <div>
            <h2 id="batches-heading" className="rms-section-title">
              On this laptop
            </h2>
            <p className="rms-section-sub">
              Batches and report cards are saved in this browser only. Scores you send to ParaLearn are also kept there.
            </p>
          </div>
        </div>

        {loaded?.error ? (
          <div className="rms-notice bad" role="alert">
            <AlertTriangle size={15} aria-hidden />
            <span>
              This browser won&apos;t let Results read its saved batches. Reload the page. In a private window, open Results in a normal window
              instead.
            </span>
          </div>
        ) : !batches ? (
          <div aria-busy aria-label="Loading batches">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rms-skeleton" />
            ))}
          </div>
        ) : !batches.length ? (
          <div className="rms-first-run">
            <h3>No result sheets yet</h3>
            <ol>
              <li>
                <span aria-hidden>1</span>
                <div>
                  <strong>Open your result sheet above</strong>
                  <p>Your school&apos;s Excel sheet, one tab per class, or our result sheet template filled in.</p>
                </div>
              </li>
              <li>
                <span aria-hidden>2</span>
                <div>
                  <strong>Check the cards</strong>
                  <p>Totals, grades and positions are worked out on this laptop. Preview any student before printing.</p>
                </div>
              </li>
              <li>
                <span aria-hidden>3</span>
                <div>
                  <strong>Print one booklet per class</strong>
                  <p>An A4 PDF per class, ready for any printer. Scores send to ParaLearn when you&apos;re online.</p>
                </div>
              </li>
            </ol>
            <button type="button" className="rms-button" onClick={onTemplate}>
              <FileText size={16} aria-hidden />
              Get the result sheet template
            </button>
          </div>
        ) : (
          <div className="rms-table-wrap">
            <table className="rms-table rms-batch-table">
              <thead>
                <tr>
                  <th scope="col">Result sheet</th>
                  <th scope="col" className="rms-col-classes">
                    Classes
                  </th>
                  <th scope="col" className="num">
                    Students
                  </th>
                  <th scope="col">Report cards</th>
                  <th scope="col">Sent to ParaLearn</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const ready = b.generatedClasses.length === b.classNames.length;
                  const generating = generation?.batchId === b.id;
                  return (
                    <tr key={b.id} onClick={() => onOpen(b.id)}>
                      <td data-label="Result sheet">
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
                          <span>{timeAgo(b.createdAt)}</span>
                        </span>
                      </td>
                      <td data-label="Classes" className="rms-col-classes">
                        <span className="rms-num">{b.classNames.length}</span>
                        <span className="rms-cell-note" title={b.classNames.join(", ")}>
                          {classSummary(b.classNames)}
                        </span>
                      </td>
                      <td data-label="Students" className="num rms-num">
                        {b.totalStudents}
                      </td>
                      <td data-label="Report cards">
                        {ready ? (
                          <span className="rms-status ok">
                            <CheckCircle2 size={12} aria-hidden />
                            Cards ready
                          </span>
                        ) : generating ? (
                          <span className="rms-status ready">
                            <Loader2 size={12} className="animate-spin" aria-hidden />
                            Making cards
                          </span>
                        ) : (
                          <span className="rms-status warn">
                            {b.generatedClasses.length} of {b.classNames.length} classes
                          </span>
                        )}
                      </td>
                      <td data-label="ParaLearn">
                        <SyncCell batch={b} onSignInNeeded={onSignInNeeded} />
                      </td>
                      <td className="rms-row-actions">
                        <button
                          type="button"
                          className="rms-button small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(b.id);
                          }}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="rms-icon rms-icon-danger"
                          aria-label={`Delete ${b.fileName} from this laptop`}
                          title="Delete from this laptop"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(b);
                          }}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete ${toDelete?.fileName ?? "this batch"}?`}
        confirmLabel="Delete from this laptop"
        tone="danger"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      >
        <p>
          This removes the batch and its report cards ({plural(toDelete?.totalStudents ?? 0, "student")}) from this laptop. It can&apos;t be
          undone.
        </p>
        {toDelete?.sync.status === "synced" ? (
          <p className="rms-confirm-note is-ok">The scores were sent to ParaLearn, so they stay safe there.</p>
        ) : (
          <p className="rms-confirm-note is-warn">These scores haven&apos;t reached ParaLearn yet. Deleting loses them unless you still have the sheet.</p>
        )}
      </ConfirmDialog>
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
  const sessionRevision = useRef(0);
  const ownerKey = session ? accountKey(session) : null;
  // The open batch's file name, for the breadcrumb
  const batchId = view.kind === "batch" ? view.id : null;
  const openBatchName = useLiveQuery(async () => {
    if (!batchId || !ownerKey) return undefined;
    return (await getAccountBatch(batchId, ownerKey))?.fileName;
  }, [batchId, ownerKey]);

  useEffect(() => {
    const revision = sessionRevision.current;
    getSession().then(async (s) => {
      const p = await getProfile(s?.subdomain);
      if (revision !== sessionRevision.current) return;
      setSessionState(s);
      setProfile(p);
      setProfileSetup(!p.schoolName);
      setLoaded(true);
    });
    requestPersistentStorage();
    setUpOffline().then(setReadiness);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("rms-session");
    channel.onmessage = async () => {
      const revision = ++sessionRevision.current;
      const next = await getSession();
      const nextProfile = await getProfile(next?.subdomain);
      if (revision !== sessionRevision.current) return;
      const accountChanged = !next || !session || accountKey(next) !== accountKey(session);
      if (accountChanged) {
        cancelGeneration();
      }
      setSessionState(next);
      setProfile(nextProfile);
      setProfileSetup(!!next && !nextProfile.schoolName);
      setReSignIn(false);
      setLoaded(true);
      if (accountChanged && view.kind === "batch") go("#/");
    };
    return () => channel.close();
  }, [go, session, view.kind]);

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
    // Leave #/signin or #/create behind so the workspace opens on its home screen
    if (/^#\/(signin|create)$/.test(window.location.hash)) go("#/");
    const current = await getProfile(s.subdomain);
    const active = await getSession();
    if (!active || active.accessToken !== s.accessToken) return;
    sessionRevision.current++;
    setSessionState(s);
    setProfile(current);
    setProfileSetup(!current.schoolName);
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
    } else {
      setProfile(current);
      setProfileSetup(false);
    }
    setReSignIn(false);
    setSessionState(s);
  };

  const doSignOut = async () => {
    cancelGeneration();
    await signOut();
    setSessionState(null);
    // Back to the sign-in form on this laptop, not the public landing page
    go("#/signin");
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

  if (reSignIn) return <SignIn onSignedIn={onSignedIn} />;
  if (!session) {
    // Signed-out visitors see the landing page; the installed app goes straight to the form
    const installed = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;
    if (view.kind === "signin" || installed)
      return (
        <SignIn
          key={view.kind === "signin" ? view.mode : "signin"}
          onSignedIn={onSignedIn}
          initialMode={view.kind === "signin" ? view.mode : "signin"}
          onBack={installed ? undefined : () => go("#/")}
        />
      );
    return <Landing onSignIn={() => go("#/signin")} onCreate={() => go("#/create")} />;
  }

  const onProfile = profileSetup || view.kind === "profile";
  const section: Section | null = onProfile ? "profile" : view.kind === "template" ? "template" : view.kind === "home" ? "batches" : null;

  return (
    <WorkspaceShell
      section={section}
      crumb={view.kind === "batch" ? openBatchName || "Batch" : undefined}
      schoolName={profile.schoolName} session={session} readiness={readiness} onNavigate={go} onSignOut={doSignOut}>
      {onProfile ? (
        <main className="rms-page">
          <div className="rms-page-heading">
            <div>
              <span className="rms-eyebrow">Printed at the top of every report card</span>
              <h1>School profile</h1>
            </div>
          </div>
          <SchoolProfileForm
            key={session.subdomain}
            initial={profile}
            profileScope={session.subdomain}
            firstRun={profileSetup}
            onSaved={(p) => {
              setProfile(p);
              setProfileSetup(false);
              go("#/");
            }}
          />
        </main>
      ) : view.kind === "template" ? (
        <TemplatePage
          key={ownerKey!}
          schoolName={profile.schoolName}
          subdomain={session.subdomain}
          ownerKey={ownerKey!}
          onBack={() => go("#/")}
          onSignInNeeded={() => setReSignIn(true)}
        />
      ) : view.kind === "batch" ? (
        <BatchView
          key={`${view.id}:${ownerKey}`}
          batchId={view.id}
          ownerKey={ownerKey!}
          profile={profile}
          autoStart={view.fresh}
          onBack={() => go("#/")}
          onSignInNeeded={() => setReSignIn(true)}
        />
      ) : (
        <Home
          key={ownerKey!}
          session={session}
          onOpen={(id, fresh) => go(`#/batch/${id}${fresh ? "?new" : ""}`)}
          onTemplate={() => go("#/template")}
          onSignInNeeded={() => setReSignIn(true)}
        />
      )}
    </WorkspaceShell>
  );
}
