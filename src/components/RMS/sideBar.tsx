"use client";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import Image from "next/image";
const logo = "/PL2 (1).svg";

import {
  BookOpenCheck,
  Calendar,
  ClipboardList,
  Home,
  UserCircle,
  BookOpen,
  DownloadIcon,
  MessageSquareText,
  UserPlus,
  User,
  Settings,
  Palette,
  LogOut,
  MonitorCheck,
  Menu,
  Banknote,
} from "lucide-react";
import { routespath } from "@/lib/routepath";
import Link from "next/link";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { logoutUser } from "@/reduxToolKit/user/userThunks";
import { usePathname } from "next/navigation";
import { LogoutConfirmModal } from "@/components/auth/LogoutConfirmModal";
import ComingSoonModal from "@/components/landingpage/ComingSoonModal";

const SideBar = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, tenantInfo } = useSelector((s: RootState) => s.user);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);

  const { token: standaloneToken, user: standaloneUser } = useSelector(
    (s: RootState) => s.sabiStandaloneAuth
  );
  const isStandalone =
    !!standaloneToken ||
    (typeof window !== "undefined" &&
      !!localStorage.getItem("sabiStandaloneToken"));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (isStandalone) {
        const { standaloneLogout } = await import(
          "@/reduxToolKit/sabiStandaloneAuth/sabiStandaloneAuthThunks"
        );
        await dispatch(standaloneLogout()).unwrap();
        router.push(routespath.SABINOTE_LOGIN);
      } else {
        await dispatch(logoutUser()).unwrap();
        router.push(routespath.SIGNIN);
      }
      toast.success("Logged out");
    } catch {
      toast.error("Failed to log out");
    } finally {
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const sideBarContent = useMemo(
    () => [
      {
        label: "Dashboard",
        path: isStandalone
          ? routespath.SABINOTE_DASHBOARD
          : routespath.DASHBOARD,
        icon: Home,
        roles: ["admin", "principal", "teacher", "vp", "accountant"],
      },
      ...(!isStandalone
        ? [
            { label: "Users",         path: routespath.USERS,          icon: UserCircle,      roles: ["admin", "principal"] },
            { label: "Enrollments",   path: routespath.ENROLLMENTS,    icon: UserPlus,        roles: ["admin", "principal", "vp"] },
            { label: "Classes",       path: routespath.CLASSES,        icon: BookOpenCheck,   roles: ["admin", "principal", "teacher", "vp"] },
            { label: "Subjects",      path: routespath.SUBJECTS,       icon: BookOpen,        roles: ["admin", "principal", "teacher", "vp"] },
            { label: "Assessments",   path: routespath.ASSESSMENTS,    icon: ClipboardList,   roles: ["admin", "principal", "teacher", "vp"] },
            { label: "CBT",           path: routespath.CBT,            icon: MonitorCheck,    roles: ["admin", "principal", "vp"] },
            { label: "Report Cards",  path: routespath.REPORT,         icon: BookOpen,        roles: ["admin", "principal", "teacher", "vp"] },
            { label: "Comments",      path: routespath.COMMENTS,       icon: MessageSquareText, roles: ["admin", "principal", "teacher", "vp"] },
            { label: "Attendance",    path: routespath.ATTENDANCE,     icon: Calendar,        roles: ["admin", "principal", "teacher", "vp"] },
            { label: "Finance",       path: routespath.FINANCE,        icon: Banknote,        roles: ["admin", "principal", "accountant"] },
            { label: "Bulk Upload",   path: routespath.BULK_UPLOAD,    icon: DownloadIcon,    roles: ["admin", "principal", "vp"] },
            { label: "Academic",      path: routespath.ACADEMIC,       icon: Calendar,        roles: ["admin", "principal", "vp"] },
            { label: "School Settings", path: routespath.SCHOOL_SETTINGS, icon: Settings,    roles: ["admin", "principal"] },
            { label: "Branding",      path: routespath.BRANDING,       icon: Palette,         roles: ["admin", "principal"] },
          ]
        : []),
      {
        label: "Profile",
        path: isStandalone ? routespath.SABINOTE_PROFILE : "/profile",
        icon: User,
        roles: ["admin", "principal", "teacher", "vp", "accountant"],
      },
      ...(!isStandalone
        ? [{ label: "Settings", path: routespath.SETTINGS, icon: Settings, roles: ["admin", "principal", "teacher", "vp", "accountant"] }]
        : []),
    ],
    [isStandalone]
  );

  const filteredContent = useMemo(() => {
    return sideBarContent.filter((item) => {
      if (isStandalone) return true;
      if (!item.roles) return true;
      const userRoles = user?.roles || [];
      return item.roles.some((r) => userRoles.includes(r));
    });
  }, [sideBarContent, user?.roles, isStandalone]);

  const effectiveUser = isStandalone
    ? {
        name: standaloneUser?.name || "Teacher",
        role: "Teacher",
        firstName: standaloneUser?.name?.split(" ")[0] || "",
        roles: ["teacher"],
      }
    : user;

  const effectiveTenantInfo = isStandalone ? { name: "SabiNote" } : tenantInfo;

  return (
    <SidebarProvider>
      <SidebarContentContainer
        logo={logo}
        tenantInfo={effectiveTenantInfo}
        user={effectiveUser}
        filteredContent={filteredContent}
        pathname={pathname}
        handleLogout={() => setIsLogoutModalOpen(true)}
        onBrandingClick={() => setIsBrandingModalOpen(true)}
      >
        {children}
      </SidebarContentContainer>
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
      <ComingSoonModal
        open={isBrandingModalOpen}
        onOpenChange={setIsBrandingModalOpen}
        title="Branding & Customization"
      />
    </SidebarProvider>
  );
};

const SidebarContentContainer = ({
  children,
  logo,
  tenantInfo,
  user,
  filteredContent,
  pathname,
  handleLogout,
  onBrandingClick,
}: {
  children: ReactNode;
  logo: string;
  tenantInfo: any;
  user: any;
  filteredContent: any[];
  pathname: string;
  handleLogout: () => void;
  onBrandingClick: () => void;
}) => {
  const { open: isExpanded, isMobile } = useSidebar();
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sidebar = sidebarContentRef.current;
    if (!sidebar) return;
    const saved = sessionStorage.getItem("sidebar-scroll-pos");
    if (saved) {
      requestAnimationFrame(() => {
        sidebar.scrollTop = parseInt(saved, 10);
      });
    }
    const onScroll = () =>
      sessionStorage.setItem("sidebar-scroll-pos", sidebar.scrollTop.toString());
    sidebar.addEventListener("scroll", onScroll);
    return () => sidebar.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const getInitials = (name: string) => {
    if (!name) return "PL";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const roleName =
    user?.roles?.[0]
      ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1)
      : "User";

  return (
    <>
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <Sidebar
        style={{
          borderRight: "1px solid var(--border-fine)",
          background: "#ffffff",
        }}
      >
        {/* Logo + school name */}
        <SidebarHeader style={{ padding: "20px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href={routespath.DASHBOARD} prefetch={false}>
              <Image
                src={logo}
                width={930}
                height={479}
                style={{ height: 36, width: "auto", objectFit: "contain" }}
                alt="ParaLearn"
              />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: "var(--font-manrope), system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "-0.02em",
                  color: "var(--violet-ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {tenantInfo?.name || "ParaLearn"}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-manrope), system-ui, sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                  marginTop: 1,
                  lineHeight: 1.4,
                }}
              >
                {roleName}
                {user?.firstName ? ` · ${user.firstName}` : ""}
              </p>
            </div>
            {/* Collapse trigger — desktop only */}
            <SidebarTrigger
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm)",
                flexShrink: 0,
              }}
              className="hidden md:flex hover:bg-[var(--surface-muted)] text-[var(--text-secondary)]"
            />
          </div>
        </SidebarHeader>

        {/* Nav items */}
        <SidebarContent
          ref={sidebarContentRef}
          style={{ padding: "4px 8px" }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredContent.map((item, index) => {
              const isActive = pathname === item.path;
              const isBranding = item.path === routespath.BRANDING;

              const navItem = (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: "var(--radius-sm)",
                    position: "relative",
                    transition:
                      "background var(--dur-quick) var(--ease-out-expo), color var(--dur-quick)",
                    background: isActive ? "var(--violet-tint)" : "transparent",
                    color: isActive
                      ? "var(--violet-ink)"
                      : "var(--text-secondary)",
                    fontFamily:
                      "var(--font-manrope), system-ui, sans-serif",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    cursor: "pointer",
                  }}
                  className={!isActive ? "hover:bg-[var(--surface-muted)] hover:text-[#0f172a]" : ""}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        background: "var(--violet-ink)",
                        borderRadius: "0 3px 3px 0",
                      }}
                    />
                  )}
                  <item.icon
                    style={{ width: 16, height: 16, flexShrink: 0 }}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  <span>{item.label}</span>
                </div>
              );

              if (isBranding) {
                return (
                  <button
                    key={index}
                    onClick={onBrandingClick}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0 }}
                  >
                    {navItem}
                  </button>
                );
              }

              return (
                <Link key={index} href={item.path} prefetch={false}>
                  {navItem}
                </Link>
              );
            })}
          </nav>
        </SidebarContent>

        {/* Footer: user avatar + logout */}
        <SidebarFooter style={{ padding: "12px 8px 16px", borderTop: "1px solid var(--border-fine)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "var(--violet-tint)",
                color: "var(--violet-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {getInitials(user?.firstName || user?.name || "PL")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: "var(--font-manrope), system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {user?.firstName || "User"}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  lineHeight: 1.3,
                }}
              >
                {roleName}
              </p>
            </div>
            {/* Logout icon button */}
            <button
              onClick={handleLogout}
              title="Log out"
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-fine)",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background var(--dur-quick), color var(--dur-quick), border-color var(--dur-quick)",
              }}
              className="hover:bg-[var(--crimson-tint)] hover:text-[var(--crimson-signal)] hover:border-[var(--crimson-signal)]/30"
            >
              <LogOut style={{ width: 14, height: 14 }} strokeWidth={2} />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          background: "var(--background)",
          minHeight: "100dvh",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        {/* Mobile top bar */}
        {(!isExpanded || isMobile) && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 50,
            }}
            className="md:hidden"
          >
            <SidebarTrigger
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-fine)",
                background: "#ffffff",
              }}
              className="hover:bg-[var(--surface-muted)]"
            />
            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-fine)",
                background: "#ffffff",
                fontFamily: "var(--font-manrope), system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <LogOut style={{ width: 13, height: 13 }} />
              Log out
            </button>
          </div>
        )}

        {/* Desktop collapsed trigger */}
        {!isExpanded && !isMobile && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 16,
              zIndex: 50,
            }}
            className="hidden md:block"
          >
            <SidebarTrigger
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-fine)",
                background: "#ffffff",
              }}
              className="hover:bg-[var(--surface-muted)]"
            />
          </div>
        )}

        {/* Page content */}
        <div
          style={{
            padding: "32px 40px",
            width: "100%",
            maxWidth: 1600,
            margin: "0 auto",
          }}
          className="px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8"
        >
          {children}
        </div>
      </main>
    </>
  );
};

export default SideBar;
