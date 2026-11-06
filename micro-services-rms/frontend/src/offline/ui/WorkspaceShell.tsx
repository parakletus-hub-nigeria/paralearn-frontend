"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, FileSpreadsheet, FileText, LogOut, Menu, PanelLeftClose, School } from "lucide-react";
import type { K12Session } from "../storage/db";
import type { OfflineReadiness } from "./serviceWorker";
import { useOnline } from "./util";
import { Brand } from "./Brand";

export type Section = "batches" | "profile" | "template";

/**
 * Signed-in frame for rms.pln.ng, built like the standalone CBT workspace: wash sidebar
 * with the school, navigation, resources, connection status and the account.
 */
export default function WorkspaceShell({
  section,
  schoolName,
  session,
  readiness,
  onNavigate,
  onSignOut,
  children,
}: {
  section: Section | null;
  schoolName: string;
  session: K12Session;
  readiness: OfflineReadiness | null;
  onNavigate: (hash: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const online = useOnline();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const person = [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") || session.user.email;
  const nav: Array<{ hash: string; label: string; icon: typeof FileSpreadsheet; id: Section }> = [
    { hash: "#/", label: "Result batches", icon: FileSpreadsheet, id: "batches" },
    { hash: "#/profile", label: "School profile", icon: School, id: "profile" },
  ];

  return (
    <div className="rms-surface rms-workspace">
      <a className="rms-skip" href="#rms-content">
        Skip to content
      </a>
      <header className="rms-mobile-header">
        <Brand onClick={() => onNavigate("#/")} />
        <button
          className="rms-icon"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {menuOpen && <button className="rms-menu-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <aside className={`rms-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Workspace navigation">
        <Brand onClick={() => onNavigate("#/")} />
        <div className="rms-workspace-name">
          <span>School workspace</span>
          <strong>{schoolName || "Your school"}</strong>
        </div>
        <nav aria-label="Primary">
          {nav.map(({ hash, label, icon: Icon, id }) => (
            <a key={id} href={hash} onClick={go(hash)} aria-current={section === id ? "page" : undefined}>
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="rms-sidebar-secondary">
          <span className="rms-nav-label">Resources</span>
          <a href="#/template" onClick={go("#/template")} aria-current={section === "template" ? "page" : undefined}>
            <FileText size={17} />
            CSV template
          </a>
          <a href={`https://${session.subdomain}.pln.ng`} target="_blank" rel="noopener noreferrer">
            <School size={17} />
            ParaLearn portal
            <ArrowUpRight size={14} className="ml-auto" />
          </a>
        </div>

        <div className="rms-account">
          <div className="rms-connection">
            <div>
              <span>Connection</span>
              <strong>
                <span className={`rms-dot ${online ? "ok" : "warn"}`} aria-hidden />
                {online ? "Online" : "Offline"}
              </strong>
            </div>
            <div>
              <span>Without internet</span>
              <strong>{readiness === "ready" ? "Ready" : readiness === null || readiness === "installing" ? "Preparing" : "Not available"}</strong>
            </div>
          </div>
          <div className="rms-account-person">
            <span className="rms-avatar" aria-hidden>
              {(session.user.firstName || session.user.email || "P").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{person}</strong>
              <span>{session.subdomain}.pln.ng</span>
            </div>
            <button title="Sign out" aria-label="Sign out" className="rms-icon" onClick={onSignOut}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div id="rms-content" className="rms-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
