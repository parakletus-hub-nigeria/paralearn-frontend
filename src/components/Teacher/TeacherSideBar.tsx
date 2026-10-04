"use client";

import React, { ReactNode, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  ClipboardList,
  Home,
  MessageSquareText,
  Settings,
  User,
  FileEdit,
  GraduationCap,
  Sparkles,
  LogOut,
} from "lucide-react";
const logo = "/PL2 (1).svg";
import { routespath } from "@/lib/routepath";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { logoutUser } from "@/reduxToolKit/user/userThunks";
import { LogoutConfirmModal } from "@/components/auth/LogoutConfirmModal";

export default function TeacherSideBar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, tenantInfo } = useSelector((s: RootState) => s.user);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const items = useMemo(
    () => [
      { label: "Dashboard", path: routespath.TEACHER_DASHBOARD, icon: Home },
      { label: "Classes", path: routespath.TEACHER_CLASSES, icon: GraduationCap },
      { label: "Assessments", path: routespath.TEACHER_ASSESSMENTS, icon: ClipboardList },
      { label: "Draft Questions", path: "/teacher/question-drafting", icon: Sparkles },
      { label: "Scores", path: routespath.TEACHER_SCORES, icon: FileEdit },
      { label: "Attendance", path: routespath.TEACHER_ATTENDANCE, icon: ClipboardList },
      { label: "Comments", path: routespath.TEACHER_COMMENTS, icon: MessageSquareText },
      { label: "Reports", path: routespath.TEACHER_REPORTS, icon: BookOpen },
      { label: "Profile", path: "/profile", icon: User },
    ],
    []
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await dispatch(logoutUser()).unwrap();
      toast.success("Logged out successfully");
      router.push(routespath.SIGNIN);
    } catch (e: any) {
      toast.error(e || "Logout failed");
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
      router.push(routespath.SIGNIN);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar style={{ borderRight: "1px solid var(--border-fine)" }}>
        <SidebarHeader className="p-5 pb-2 relative">
          <div className="absolute top-2 right-2 hidden md:block">
            <SidebarTrigger className="h-8 w-8" style={{ color: "var(--foreground-muted)" } as React.CSSProperties} />
          </div>
          <div className="flex flex-col items-center text-center gap-1 mt-1">
            <Link href={routespath.TEACHER_DASHBOARD} className="block shrink-0">
              <Image
                src={logo}
                width={930}
                height={479}
                className="h-[64px] sm:h-[72px] w-auto object-contain"
                alt="paralearn logo"
              />
            </Link>
            <div className="flex flex-col leading-tight w-full px-1">
              <p className="font-bold text-lg sm:text-lg tracking-tight line-clamp-2" style={{ color: "var(--violet-ink)" }}>
                {tenantInfo?.name || "ParaLearn"}
              </p>
              <p className="text-xs font-medium mt-0.5 flex justify-center items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
                <span className="truncate">Teacher{user?.firstName ? ` • ${user.firstName}` : ""}</span>
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-4">
          <nav className="flex flex-col gap-1.5 mt-4">
            {items.map((item) => {
              const isSelected = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="flex items-center gap-3.5 px-4 py-3 transition-all duration-300"
                  style={{
                    borderRadius: "var(--radius-md)",
                    background: isSelected ? "var(--violet-tint)" : "transparent",
                    color: isSelected ? "var(--violet-ink)" : "var(--foreground-muted)",
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = "var(--surface-muted)"; e.currentTarget.style.color = "var(--foreground)"; } }}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; } }}
                >
                  <item.icon
                    className={`w-[18px] h-[18px] transition-transform duration-300 ${isSelected ? "scale-110" : ""}`}
                  />
                  <span className={`text-[15px] ${isSelected ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center justify-center py-3 px-4 font-semibold transition-colors duration-200 cursor-pointer"
            style={{ background: "var(--crimson-signal)", color: "white", borderRadius: "var(--radius-md)", border: "none" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Logout
          </button>
        </SidebarFooter>
      </Sidebar>

      <SidebarMainContent
        setIsLogoutModalOpen={setIsLogoutModalOpen}
        handleLogout={handleLogout}
      >
        {children}
      </SidebarMainContent>
      <LogoutConfirmModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
    </SidebarProvider>
  );
}

function SidebarMainContent({ 
  children, 
  handleLogout, 
  setIsLogoutModalOpen 
}: { 
  children: ReactNode;
  handleLogout: () => void;
  setIsLogoutModalOpen: (open: boolean) => void;
}) {
  const { useSidebar } = require("../ui/sidebar");
  const { open: isExpanded, isMobile } = useSidebar();

  return (
    <main className="flex-1 min-h-screen relative overflow-x-hidden" style={{ background: "var(--surface-muted)" }}>
      {(!isExpanded || isMobile) && (
        <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-center z-50 md:hidden">
          <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10 shadow-sm" style={{ border: "1px solid var(--border-fine)", background: "white" } as React.CSSProperties} />
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 font-bold text-xs shadow-sm active:scale-95 transition-all"
            style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      )}
      {(!isExpanded && !isMobile) && (
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 hidden md:block">
          <SidebarTrigger className="h-9 w-9 sm:h-10 sm:w-10" />
        </div>
      )}
      <div className="pt-16 pb-6 px-3.5 sm:px-6 sm:py-6 md:p-10 w-full max-w-[1600px] mx-auto">
        {children}
      </div>
    </main>
  );
}

