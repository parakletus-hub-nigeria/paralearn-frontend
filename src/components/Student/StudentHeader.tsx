"use client";

import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import { RootState, AppDispatch } from "@/reduxToolKit/store";
import { logoutUser } from "@/reduxToolKit/user/userThunks";
import { LogOut, LayoutDashboard, Bell, Banknote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoutConfirmModal } from "@/components/auth/LogoutConfirmModal";

interface StudentHeaderProps {
  transparent?: boolean;
}

export function StudentHeader({ transparent = false }: StudentHeaderProps) {
  const { user } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await dispatch(logoutUser());
      router.push("/auth/signin");
    } catch (error) {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  return (
    <div
      className="h-20 px-6 md:px-10 flex items-center justify-between sticky top-0 z-50 transition-all duration-300"
      style={{
        background: transparent ? "transparent" : "white",
        borderBottom: transparent ? "1px solid rgba(255,255,255,0.1)" : "1px solid var(--border-fine)",
      }}
    >
      <div className="flex items-center gap-8">
        <Link href="/student/dashboard" className="flex items-center gap-2 group">
          <div
            className="w-10 h-10 flex items-center justify-center text-white font-bold transition-transform group-hover:scale-110"
            style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)" }}
          >
            PL
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-lg tracking-tight" style={{ color: transparent ? "white" : "var(--foreground)" }}>
              ParaLearn
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: transparent ? "rgba(255,255,255,0.6)" : "var(--violet-ink)" }}>
              Premium CBT
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          <Link
            href="/student/dashboard"
            className="px-4 py-2 font-medium text-sm flex items-center gap-2 transition-all"
            style={{
              borderRadius: "var(--radius-lg)",
              background: transparent ? "rgba(255,255,255,0.1)" : "var(--violet-tint)",
              color: transparent ? "white" : "var(--violet-ink)",
              border: transparent ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/student/fees"
            className="px-4 py-2 font-semibold text-sm flex items-center gap-2 transition-all"
            style={{
              borderRadius: "var(--radius-lg)",
              background: transparent ? "rgba(16,185,129,0.2)" : "#ecfdf5",
              color: transparent ? "#6ee7b7" : "#047857",
              border: transparent ? "1px solid rgba(16,185,129,0.3)" : "1px solid #a7f3d0",
            }}
          >
            <Banknote className="w-4 h-4 text-emerald-600" />
            School Fees &amp; Payments
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold" style={{ color: transparent ? "white" : "var(--foreground)" }}>
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Student"}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: transparent ? "rgba(255,255,255,0.6)" : "var(--foreground-muted)" }}>
            Student Portal
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition-opacity" style={{ background: "var(--emerald-signal)" }} />
          <button className="relative w-11 h-11 rounded-full p-[2px] overflow-hidden" style={{ border: "2px solid var(--foreground)", background: "var(--foreground)" }}>
            <img
              alt="Avatar"
              className="rounded-full w-full h-full object-cover"
              style={{ background: "var(--surface-muted)" }}
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'guest'}`}
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full" style={{ background: "var(--emerald-signal)", border: "2px solid var(--foreground)" }} />
          </button>

          {/* Dropdown */}
          <div className="absolute right-0 top-12 w-48 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 divide-y divide-slate-100" style={{ background: "white", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-dialog)", border: "1px solid var(--border-fine)" }}>
            <div className="py-1">
              <Link
                href="/student/fees"
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
              >
                <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Pay School Fees
              </Link>
            </div>
            <div className="py-1">
              <button
                onClick={() => setIsLogoutModalOpen(true)}
                className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 font-medium transition-colors"
                style={{ color: "var(--crimson-signal)", background: "transparent", border: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--crimson-tint)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Logout */}
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="md:hidden flex items-center gap-2 px-3 py-1.5 font-bold text-xs active:scale-95 transition-all"
          style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)" }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
    </div>
  );
}
