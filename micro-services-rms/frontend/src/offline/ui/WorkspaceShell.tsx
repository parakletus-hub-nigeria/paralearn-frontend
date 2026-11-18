"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  School,
  Upload,
  WifiOff,
} from "lucide-react";
import { db, type K12Session } from "../storage/db";
import type { OfflineReadiness } from "./serviceWorker";
import { plural, useOnline } from "./util";
import { Brand } from "./Brand";

export type Section = "batches" | "profile" | "template";

const SECTION_LABEL: Record<Section, string> = {
  batches: "Result batches",
  profile: "School profile",
  template: "Result sheet template",
};

/** The browser's install prompt, kept so "Install app" can be a visible button */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    setEvent(null);
  };
  return event ? install : null;
}

/** Batches whose scores haven't reached ParaLearn yet (waiting, sending or failed), and whether a sign-in is blocking them */
export function useWaitingToSend(): { count: number; needsSignIn: boolean } | undefined {
  return useLiveQuery(async () => {
    const waiting = await db.batches.filter((b) => b.sync.status !== "synced").toArray();
    return { count: waiting.length, needsSignIn: waiting.some((b) => b.sync.status === "failed" && !!b.sync.needsSignIn) };
  }, []);
}

/** What "works without internet" means right now, in words a school can act on */
function offlineState(readiness: OfflineReadiness | null) {
  switch (readiness) {
    case "ready":
      return { tone: "ok", title: "Ready without internet", detail: "This laptop can open Results with no connection." };
    case "dev":
      return { tone: "muted", title: "Offline use is off", detail: "Only the live site saves itself for offline use." };
    case "unsupported":
      return { tone: "warn", title: "Can't work offline here", detail: "Use a current version of Chrome or Edge on this laptop." };
    case "failed":
      return { tone: "warn", title: "Offline use isn't set up", detail: "Reload this page while online to try again." };
    default:
      return { tone: "busy", title: "Getting ready for offline use", detail: "Keep this page open while you're online." };
  }
}

/**
 * Confirmation dialog in the Stitch pattern: what will happen, what stays safe, then
 * Cancel and the action. Uses the native <dialog>, so focus, Escape and the backdrop
 * work without a library and offline.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="rms-confirm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="rms-confirm-body">
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
      <div className="rms-confirm-actions">
        <button type="button" className="rms-button" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </button>
        <button type="button" className={`rms-button ${tone === "danger" ? "destructive" : "primary"}`} onClick={onConfirm} disabled={busy}>
          {busy && <Loader2 size={15} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Signed-in frame for rms.pln.ng, built like the standalone CBT examiner shell: wash sidebar
 * with the school and navigation, whether this laptop can work offline, the account; and a
 * top bar with where you are and an honest connection and sending status.
 */
export default function WorkspaceShell({
  section,
  crumb,
  schoolName,
  session,
  readiness,
  onNavigate,
  onSignOut,
  children,
}: {
  section: Section | null;
  /** The page below the section, e.g. a batch's file name */
  crumb?: string;
  schoolName: string;
  session: K12Session;
  readiness: OfflineReadiness | null;
  onNavigate: (hash: string) => void;
  onSignOut: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const online = useOnline();
  const pending = useWaitingToSend();
  const waiting = pending?.count ?? 0;
  const install = useInstallPrompt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  const go = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    onNavigate(hash);
  };

  /** Home, with the cursor on the file picker */
  const openSheet = () => {
    setMenuOpen(false);
    onNavigate("#/");
    window.setTimeout(() => document.getElementById("rms-drop")?.focus(), 80);
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
      setConfirmOut(false);
    }
  };

  const person = [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") || session.user.email;
  const nav: Array<{ hash: string; icon: typeof FileSpreadsheet; id: Section }> = [
    { hash: "#/", icon: FileSpreadsheet, id: "batches" },
    { hash: "#/profile", icon: School, id: "profile" },
    { hash: "#/template", icon: FileText, id: "template" },
  ];
  const offline = offlineState(readiness);
  const here = section ? SECTION_LABEL[section] : "Result batches";
  // A batch has no section of its own; it lives under Result batches
  const activeNav: Section | null = section ?? (crumb ? "batches" : null);

  return (
    <div className="rms-surface rms-workspace">
      <a className="rms-skip" href="#rms-content">
        Skip to content
      </a>
      <header className="rms-mobile-header">
        <Brand onClick={() => onNavigate("#/")} />
        <div className="rms-mobile-actions">
          {!online && (
            <span className="rms-connection-chip is-offline" role="status">
              <WifiOff size={14} aria-hidden />
              Offline
            </span>
          )}
          <button
            className="rms-icon"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="rms-sidebar"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <PanelLeftClose size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </header>
      {menuOpen && <button className="rms-menu-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <aside id="rms-sidebar" className={`rms-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Workspace navigation">
        <div className="rms-sidebar-brand">
          <Brand onClick={() => onNavigate("#/")} />
        </div>
        <div className="rms-workspace-name">
          <span>School workspace</span>
          <strong>{schoolName || "Your school"}</strong>
        </div>
        <nav aria-label="Primary">
          {nav.map(({ hash, icon: Icon, id }) => (
            <a key={id} href={hash} onClick={go(hash)} aria-current={activeNav === id ? "page" : undefined}>
              <Icon size={18} aria-hidden />
              {SECTION_LABEL[id]}
            </a>
          ))}
        </nav>
        <div className="rms-sidebar-secondary">
          <span className="rms-nav-label">Resources</span>
          <a href={`https://${session.subdomain}.pln.ng`} target="_blank" rel="noopener noreferrer">
            <School size={17} aria-hidden />
            ParaLearn portal
            <ArrowUpRight size={14} className="ml-auto" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>

        <div className="rms-account">
          <div className={`rms-offline-card is-${offline.tone}`}>
            <strong>
              {offline.tone === "ok" ? (
                <CheckCircle2 size={15} aria-hidden />
              ) : offline.tone === "busy" ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <WifiOff size={15} aria-hidden />
              )}
              {offline.title}
            </strong>
            <span>{offline.detail}</span>
            {install && (
              <button type="button" className="rms-button small" onClick={install}>
                <Download size={14} aria-hidden />
                Install app
              </button>
            )}
          </div>
          <div className="rms-account-person">
            <span className="rms-avatar" aria-hidden>
              {(session.user.firstName || session.user.email || "P").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{person}</strong>
              <span>{session.subdomain}.pln.ng</span>
            </div>
            <button title="Sign out" aria-label="Sign out" className="rms-icon" onClick={() => setConfirmOut(true)}>
              <LogOut size={17} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      <div id="rms-content" className="rms-content" tabIndex={-1}>
        <div className="rms-topbar">
          <nav className="rms-topbar-trail" aria-label="Breadcrumb">
            {crumb ? (
              <>
                <a href="#/" onClick={go("#/")}>
                  {here}
                </a>
                <ChevronRight size={14} aria-hidden />
                <strong className="rms-trail-current" aria-current="page">
                  {crumb}
                </strong>
              </>
            ) : (
              <strong aria-current="page">{here}</strong>
            )}
          </nav>
          <div className="rms-topbar-actions">
            {!!waiting &&
              (section === "batches" ? (
                <span className={`rms-waiting ${pending?.needsSignIn ? "is-warn" : ""}`}>
                  <CloudUpload size={14} aria-hidden />
                  {pending?.needsSignIn ? "Sign in to send scores" : `${plural(waiting, "batch", "batches")} waiting to send`}
                </span>
              ) : (
                <a href="#/" onClick={go("#/")} className={`rms-waiting ${pending?.needsSignIn ? "is-warn" : ""}`}>
                  <CloudUpload size={14} aria-hidden />
                  {pending?.needsSignIn ? "Sign in to send scores" : `${plural(waiting, "batch", "batches")} waiting to send`}
                </a>
              ))}
            {online ? (
              <span className="rms-connection-chip is-online" role="status">
                Online
              </span>
            ) : (
              <span className="rms-connection-chip is-offline" role="status">
                <WifiOff size={14} aria-hidden />
                Offline.<span className="rms-hide-md"> Work carries on; scores send when you reconnect.</span>
              </span>
            )}
            {section !== "batches" && (
              <button type="button" className="rms-button primary small" onClick={openSheet}>
                <Upload size={15} aria-hidden />
                Open result sheet
              </button>
            )}
          </div>
        </div>
        {children}
      </div>

      <ConfirmDialog
        open={confirmOut}
        title="Sign out of ParaLearn Results?"
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={signOut}
        onCancel={() => setConfirmOut(false)}
      >
        <p>Your result batches and report cards stay saved on this laptop.</p>
        {!!waiting && (
          <p className="rms-confirm-note is-warn">
            {plural(waiting, "batch", "batches")} of scores {waiting === 1 ? "hasn't" : "haven't"} reached ParaLearn yet. They send after you sign in
            again.
          </p>
        )}
        <p className="rms-confirm-note">You&apos;ll need internet to sign in again.</p>
      </ConfirmDialog>
    </div>
  );
}
