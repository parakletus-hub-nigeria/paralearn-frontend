"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronRight,
  Code2,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  MonitorPlay,
  PanelLeftClose,
  PencilRuler,
  Plus,
  Settings,
  Ticket,
  Users,
  WifiOff,
} from "lucide-react";
import {
  clearExaminerSession,
  getExaminerSession,
  loadStoredExams,
  type ExaminerWorkspace,
} from "@cbt/lib/cbtSessionManager";
import {
  useGetCbtExamQuery,
  useGetLiveMonitorQuery,
} from "@cbt/store/cbtMicroserviceApi";
import CbtBrand from "./CbtBrand";
import "./cbt-workspace.css";
import "./cbt-shell.css";

/** The last exam an examiner opened, so Question studio and Candidate monitor in the sidebar have somewhere to go */
const LAST_EXAM_KEY = "paralearn_cbt_last_exam";
/** Stored as {id, title} so a title is never shown against a different exam's links */
const LAST_EXAM_TITLE_KEY = "paralearn_cbt_last_exam_title";

const readStoredTitle = (id: string): string | null => {
  try {
    const saved = JSON.parse(readStored(LAST_EXAM_TITLE_KEY) || "null") as { id?: string; title?: string } | null;
    return saved?.id === id && saved.title ? saved.title : null;
  } catch {
    return null; // an older plain-text value: ignore it
  }
};
/** cbt.pln.ng shows /exams/:id in the address bar (the proxy adds /cbt); the main domain shows /cbt/exams/:id */
const EXAM_PATH = /^(?:\/cbt)?\/exams\/([^/]+)/;

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private window: the sidebar falls back to the exam list */
  }
};

/** Shows whether this computer can reach the internet. Exams keep running offline; this only says so. */
function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export default function CbtWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useOnline();
  const [session, setSession] = useState<ExaminerWorkspace | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastExam, setLastExam] = useState<{ id: string; title: string | null } | null>(null);

  useEffect(() => {
    const current = getExaminerSession();
    setSession(current);
    setMenuOpen(false);
    // Remember the exam being worked on, so the sidebar can link back to its studio and monitor
    const match = EXAM_PATH.exec(pathname);
    const storedId = readStored(LAST_EXAM_KEY);
    const id = match?.[1] ?? storedId;
    if (match) writeStored(LAST_EXAM_KEY, match[1]);
    // Name it from what this computer already knows: the dashboard's saved exam list, or the
    // title saved the last time this exam was open. The exam query below fills it in on exam pages.
    const title = id
      ? loadStoredExams(current?.id).find((exam) => exam.id === id)?.title ??
        readStoredTitle(id)
      : null;
    setLastExam(id ? { id, title } : null);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  // On exam pages the studio and the monitor already load the exam. Asking RTK Query for the same
  // thing reuses their cached result, so the title costs no extra request.
  const examMatch = EXAM_PATH.exec(pathname);
  const examId = examMatch?.[1] ?? "";
  const onMonitorPath = /\/monitor\/?$/.test(pathname);
  const { data: studioExam } = useGetCbtExamQuery(examId, {
    skip: !session || !examId || onMonitorPath,
  });
  const { data: monitorData } = useGetLiveMonitorQuery(examId, {
    skip: !session || !examId || !onMonitorPath,
  });
  const fetchedTitle: string | undefined =
    (onMonitorPath ? monitorData?.exam?.title : studioExam?.title) || undefined;
  useEffect(() => {
    if (!examId || !fetchedTitle) return;
    writeStored(LAST_EXAM_TITLE_KEY, JSON.stringify({ id: examId, title: fetchedTitle }));
    setLastExam((prev) =>
      prev && prev.id === examId && prev.title !== fetchedTitle
        ? { id: examId, title: fetchedTitle }
        : prev,
    );
  }, [examId, fetchedTitle]);

  const isPublic =
    !session || pathname.endsWith("/auth") || pathname.endsWith("/api-docs");
  if (isPublic) return <div className="cbt-surface">{children}</div>;

  const onMonitor = /^(?:\/cbt)?\/exams\/[^/]+\/monitor/.test(pathname);
  const onStudio = /^(?:\/cbt)?\/exams\/[^/]+\/?$/.test(pathname);
  const onCandidates = pathname.includes("/candidates");
  const onSettings = pathname.includes("/settings");
  const onExam = onMonitor || onStudio;

  const examNav = [
    {
      suffix: "",
      label: "Question studio",
      icon: PencilRuler,
      active: onStudio,
    },
    {
      suffix: "/monitor",
      label: "Candidate monitor",
      icon: MonitorPlay,
      active: onMonitor,
    },
  ];

  const section = onMonitor
    ? "Candidate monitor"
    : onStudio
      ? "Question studio"
      : onCandidates
        ? "Candidates & PINs"
        : onSettings
          ? "Settings & keys"
          : "Examinations";

  const signOut = () => {
    clearExaminerSession();
    setSession(null);
    router.push("/cbt/auth");
  };

  const navLink = (
    href: string,
    label: string,
    Icon: typeof FileText,
    active: boolean,
  ) => (
    <Link
      key={label}
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "is-active" : ""}
    >
      <Icon size={18} aria-hidden />
      {label}
    </Link>
  );

  return (
    <div className="cbt-surface cbt-workspace">
      <a className="cbt-skip" href="#cbt-content">
        Skip to content
      </a>
      <header className="cbt-mobile-header">
        <CbtBrand />
        <div className="cbt-mobile-actions">
          <Link href="/cbt?new=1" className="cbt-button primary small">
            <Plus size={16} aria-hidden />
            New exam
          </Link>
          <button
            className="cbt-icon"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="cbt-sidebar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <button
          className="cbt-menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="cbt-sidebar"
        className={`cbt-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="cbt-sidebar-brand">
          <CbtBrand />
        </div>
        <div className="cbt-workspace-name">
          <span>Examiner workspace</span>
          <strong>{session.name}</strong>
        </div>
        <nav aria-label="Primary">
          {navLink("/cbt", "Examinations", FileText, !onExam && !onCandidates && !onSettings)}
          {navLink("/cbt/candidates", "Candidates & PINs", Ticket, onCandidates)}
        </nav>

        {/* Studio and monitor belong to one exam, so they sit under its name */}
        <div className="cbt-exam-nav">
          <span className="cbt-nav-label">
            {lastExam ? (onExam ? "This exam" : "Last opened exam") : "Exam tools"}
          </span>
          {lastExam ? (
            <>
              <p className="cbt-exam-nav-title" title={lastExam.title || undefined}>
                {lastExam.title || "Exam you last opened"}
              </p>
              <nav aria-label="Exam tools">
                {examNav.map(({ suffix, label, icon, active }) =>
                  navLink(`/cbt/exams/${lastExam.id}${suffix}`, label, icon, active),
                )}
              </nav>
            </>
          ) : (
            <p className="cbt-exam-nav-empty">
              Open an exam to edit its questions or watch it live.
            </p>
          )}
        </div>

        <div className="cbt-sidebar-secondary">
          <span className="cbt-nav-label">Resources</span>
          <Link href="/take" target="_blank" rel="noopener noreferrer">
            <KeyRound size={17} aria-hidden />
            Candidate entrance
            <ArrowUpRight size={14} className="ml-auto" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <Link href="/cbt/api-docs">
            <Code2 size={17} aria-hidden />
            Developer API
          </Link>
          <Link
            href="/cbt/settings"
            aria-current={onSettings ? "page" : undefined}
            className={onSettings ? "is-active" : ""}
          >
            <Settings size={17} aria-hidden />
            Settings &amp; keys
          </Link>
        </div>
        <div className="cbt-account">
          <div className="cbt-credit-card">
            <span>Candidate credits</span>
            <strong>
              <Users size={14} aria-hidden />
              {session.credits.toLocaleString()} available
            </strong>
          </div>
          <div className="cbt-account-person">
            <span className="cbt-avatar" aria-hidden>
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
              onClick={signOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div id="cbt-content" className="cbt-content" tabIndex={-1}>
        <div className="cbt-topbar">
          <nav className="cbt-topbar-trail" aria-label="Breadcrumb">
            {onExam ? (
              <>
                <Link href="/cbt">Examinations</Link>
                <ChevronRight size={14} aria-hidden />
                <span className="cbt-trail-exam">{lastExam?.title || "Exam"}</span>
                <ChevronRight size={14} aria-hidden />
                <strong aria-current="page">{section}</strong>
              </>
            ) : (
              <strong aria-current="page">{section}</strong>
            )}
          </nav>
          <div className="cbt-topbar-actions">
            {online ? (
              <span className="cbt-connection is-online" role="status">
                Online
              </span>
            ) : (
              <span className="cbt-connection is-offline" role="status">
                <WifiOff size={14} aria-hidden />
                Offline. Reconnect to save changes.
              </span>
            )}
            <Link href="/cbt?new=1" className="cbt-button primary">
              <Plus size={16} aria-hidden />
              New exam
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
