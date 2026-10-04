"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  KeyRound,
  Code2,
  LogOut,
  PanelLeftClose,
  Menu,
  ArrowUpRight,
} from "lucide-react";
import {
  clearExaminerSession,
  getExaminerSession,
  type ExaminerWorkspace,
} from "@cbt/lib/cbtSessionManager";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";

export default function CbtWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<ExaminerWorkspace | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setSession(getExaminerSession());
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);
  const isPublic =
    !session || pathname.endsWith("/auth") || pathname.endsWith("/api-docs");
  if (isPublic) return <div className="cbt-surface">{children}</div>;

  const nav = [
    {
      href: "/cbt",
      label: "Examinations",
      icon: BookOpen,
      active: !pathname.includes("candidates"),
    },
    {
      href: "/cbt/candidates",
      label: "Candidates",
      icon: Users,
      active: pathname.includes("candidates"),
    },
  ];
  return (
    <div className="cbt-surface cbt-workspace">
      <a className="cbt-skip" href="#cbt-content">
        Skip to content
      </a>
      <header className="cbt-mobile-header">
        <CbtBrand />
        <button
          className="cbt-icon"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
        </button>
      </header>
      {menuOpen && (
        <button
          className="cbt-menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`cbt-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <CbtBrand />
        <div className="cbt-workspace-name">
          <span>Examiner workspace</span>
          <strong>{session.name}</strong>
        </div>
        <nav aria-label="Primary">
          {nav.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={active ? "is-active" : ""}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="cbt-sidebar-secondary">
          <span className="cbt-nav-label">Resources</span>
          <Link href="/take">
            <KeyRound size={17} />
            Candidate entrance
            <ArrowUpRight size={14} className="ml-auto" />
          </Link>
          <Link href="/cbt/api-docs">
            <Code2 size={17} />
            Developer API
          </Link>
        </div>
        <div className="cbt-account">
          <div className="cbt-credit">
            <span>Candidate credits</span>
            <strong>{session.credits}</strong>
          </div>
          <div className="cbt-account-person">
            <span className="cbt-avatar">
              {session.ownerName?.slice(0, 1).toUpperCase() || "P"}
            </span>
            <div>
              <strong>{session.ownerName}</strong>
              <span>{session.ownerEmail}</span>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              className="cbt-icon"
              onClick={() => {
                clearExaminerSession();
                setSession(null);
                router.push("/cbt/auth");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div id="cbt-content" className="cbt-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
