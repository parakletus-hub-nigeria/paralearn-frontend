"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { logoutUser } from "@/reduxToolKit/user/userThunks";
import { 
  Building2, 
  UserCheck, 
  Coins, 
  ExternalLink, 
  LogOut, 
  FileText, 
  Database, 
  BarChart3, 
  ShieldCheck, 
  PlusCircle,
  Menu,
  X,
  ChevronDown,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clearExaminerSession, purgeAllDemoData } from "@cbt/lib/cbtSessionManager";

interface StandaloneWorkspace {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  credits: number;
  type: string;
}

export default function CbtWorkspaceHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();

  const { user } = useSelector((s: RootState) => s.user);

  const [standaloneWorkspace, setStandaloneWorkspace] = useState<StandaloneWorkspace | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("paralearn_cbt_standalone_workspace");
      if (stored) {
        try {
          setStandaloneWorkspace(JSON.parse(stored));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const isSchoolMode = !standaloneWorkspace && !!user;
  const workspaceTitle = isSchoolMode
    ? (user as any)?.schoolName || "School Workspace"
    : standaloneWorkspace?.name || "Independent Exam Hall";

  const handleLogout = async () => {
    clearExaminerSession();
    purgeAllDemoData();
    if (user) {
      await dispatch(logoutUser());
    }
    router.push("/cbt/auth");
  };

  const navLinks = [
    { label: "Exams", href: isSchoolMode ? "/RMS/cbt" : "/cbt", icon: FileText },
    { label: "Candidates", href: isSchoolMode ? "/RMS/cbt/candidates" : "/cbt/candidates", icon: Users },
    { label: "Question Bank", href: isSchoolMode ? "/RMS/cbt/question-bank" : "/cbt", icon: Database },
    { label: "Results", href: isSchoolMode ? "/RMS/cbt/results" : "/cbt", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-30 h-15 bg-white border-b border-[var(--border-fine)] px-4 sm:px-6 flex items-center justify-between shadow-xs">
      
      {/* Left: Brand & Workspace Switcher Context */}
      <div className="flex items-center gap-3.5">
        <Link href={isSchoolMode ? "/RMS/cbt" : "/cbt"} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--violet-ink)] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            PL
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm tracking-tight text-[var(--foreground)]">
              ParaLearn CBT
            </span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-[1px] bg-[var(--border-fine)]" />

        {/* Active Workspace Badge */}
        <div className="flex items-center gap-2 bg-[var(--surface-muted)] px-3 py-1 rounded-[var(--radius-md)] border border-[var(--border-fine)] text-xs">
          {isSchoolMode ? (
            <Building2 className="w-3.5 h-3.5 text-[var(--violet-ink)] shrink-0" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-[var(--emerald-signal)] shrink-0" />
          )}

          <span className="font-semibold text-[var(--foreground)] truncate max-w-[140px] sm:max-w-xs">
            {workspaceTitle}
          </span>

          <Badge 
            variant="outline" 
            className="text-[10px] uppercase font-mono px-1.5 py-0 border-0 bg-white"
          >
            {isSchoolMode ? "School" : "Tutor Hall"}
          </Badge>
        </div>
      </div>

      {/* Center: Navigation Links */}
      <nav className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`h-9 px-3.5 rounded-[var(--radius-md)] text-xs font-semibold flex items-center gap-2 transition-all ${
                isActive
                  ? "bg-[var(--violet-tint)] text-[var(--violet-ink)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Credits / User Profile / Actions */}
      <div className="flex items-center gap-3">
        
        {/* Candidate Credits Pill (for Standalone Tutors) */}
        {!isSchoolMode && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[var(--emerald-tint)]/60 text-[#065f46] border border-[#a7f3d0] px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-mono font-bold">
            <Coins className="w-3.5 h-3.5 text-[var(--emerald-signal)]" />
            <span>{standaloneWorkspace?.credits ?? 30} Credits</span>
          </div>
        )}

        {/* Candidate Entry Link */}
        <Link
          href="/take"
          target="_blank"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--violet-ink)] hover:underline px-2 py-1"
        >
          <span>Student Portal</span>
          <ExternalLink className="w-3 h-3" />
        </Link>

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="h-8 px-2.5 text-xs font-semibold border-[var(--border-fine)] text-[var(--text-secondary)] hover:text-[var(--crimson-signal)] rounded-[var(--radius-md)]"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline ml-1.5">Sign Out</span>
        </Button>

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden h-8 w-8"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>

      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-15 left-0 right-0 bg-white border-b border-[var(--border-fine)] p-4 shadow-[var(--shadow-dialog)] flex flex-col gap-2 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="h-10 px-3 rounded-[var(--radius-md)] text-xs font-semibold flex items-center gap-2 hover:bg-[var(--surface-muted)]"
            >
              <link.icon className="w-4 h-4 text-[var(--violet-ink)]" />
              <span>{link.label}</span>
            </Link>
          ))}
          <div className="pt-2 border-t border-[var(--border-fine)] flex items-center justify-between">
            <Link
              href="/take"
              target="_blank"
              className="text-xs font-semibold text-[var(--violet-ink)]"
            >
              Open Candidate Portal &rarr;
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-[var(--crimson-signal)]"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

    </header>
  );
}
