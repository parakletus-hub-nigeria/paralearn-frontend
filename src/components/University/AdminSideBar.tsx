"use client";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import Image from "next/image";
const logo = "/PL2 (1).svg";

import {
  Home,
  UserCircle,
  Building2,
  BookOpen,
  CalendarDays,
  Users,
  LogOut,
  MapPin,
  DoorOpen,
  Settings,
  FileText,
} from "lucide-react";

import Link from "next/link";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { logoutUser } from "@/reduxToolKit/user/userThunks";
import { LogoutConfirmModal } from "@/components/auth/LogoutConfirmModal";

export const uniAdminRoutes = {
  DASHBOARD: "/uni-admin/dashboard",
  FACULTIES: "/uni-admin/faculties",
  DEPARTMENTS: "/uni-admin/departments",
  COURSES: "/uni-admin/courses",
  TIMETABLE: "/uni-admin/timetable",
  USERS: "/uni-admin/users",
  HALLS: "/uni-admin/halls",
  SETTINGS: "/uni-admin/settings",
  ASSESSMENTS: "/uni-admin/assessments",
  SESSIONS: "/uni-admin/sessions",
  ATTENDANCE: "/uni-admin/attendance",
};

const UniAdminSideBar = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, tenantInfo } = useSelector((s: RootState) => s.user);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await dispatch(logoutUser()).unwrap();
      toast.success("Logged out successfully");
      router.push("/auth/signin");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
    }
  };

  const sideBarContent = useMemo(
    () => [
      { label: "Dashboard", path: uniAdminRoutes.DASHBOARD, icon: Home },
      { label: "Faculties", path: uniAdminRoutes.FACULTIES, icon: Building2 },
      { label: "Departments", path: uniAdminRoutes.DEPARTMENTS, icon: MapPin },
      { label: "Courses", path: uniAdminRoutes.COURSES, icon: BookOpen },
      {
        label: "Timetable",
        path: uniAdminRoutes.TIMETABLE,
        icon: CalendarDays,
      },
      { label: "Users", path: uniAdminRoutes.USERS, icon: Users },
      { label: "Halls", path: uniAdminRoutes.HALLS, icon: DoorOpen },
      { label: "Settings", path: uniAdminRoutes.SETTINGS, icon: Settings },
      {
        label: "Assessments",
        path: uniAdminRoutes.ASSESSMENTS,
        icon: FileText,
      },
      {
        label: "Sessions",
        path: uniAdminRoutes.SESSIONS,
        icon: CalendarDays,
      },
      {
        label: "Attendance",
        path: uniAdminRoutes.ATTENDANCE,
        icon: Users,
      },
    ],
    [],
  );

  return (
    <SidebarProvider>
      <SidebarContentContainer
        logo={logo}
        tenantInfo={tenantInfo}
        user={user}
        content={sideBarContent}
        pathname={pathname}
        handleLogout={() => setIsLogoutModalOpen(true)}
      >
        {children}
      </SidebarContentContainer>
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
      />
    </SidebarProvider>
  );
};

const SidebarContentContainer = ({
  children,
  logo,
  tenantInfo,
  user,
  content,
  pathname,
  handleLogout,
}: {
  children: ReactNode;
  logo: string;
  tenantInfo: any;
  user: any;
  content: any[];
  pathname: string;
  handleLogout: () => void;
}) => {
  const {
    SidebarTrigger: UI_SidebarTrigger,
    useSidebar,
  } = require("../ui/sidebar");
  const { open: isExpanded, isMobile } = useSidebar();
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sidebar = sidebarContentRef.current;
    if (!sidebar) return;
    const savedScrollPos = sessionStorage.getItem("uni-sidebar-scroll-pos");
    if (savedScrollPos) {
      requestAnimationFrame(() => {
        sidebar.scrollTop = parseInt(savedScrollPos, 10);
      });
    }
    const handleScroll = () => {
      sessionStorage.setItem(
        "uni-sidebar-scroll-pos",
        sidebar.scrollTop.toString(),
      );
    };
    sidebar.addEventListener("scroll", handleScroll);
    return () => sidebar.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return (
    <>
      <Sidebar className="border-r border-purple-100/50 bg-white">
        <SidebarHeader className="p-4 sm:p-5 pb-2 relative">
          <div className="absolute top-2 right-2 hidden md:block">
            <SidebarTrigger className="hover:bg-purple-50 h-8 w-8 text-slate-500" />
          </div>
          <div className="flex flex-col items-center text-center gap-1 mt-2">
            <Link href={uniAdminRoutes.DASHBOARD} className="block shrink-0">
              <Image
                src={logo}
                width={930}
                height={479}
                className="h-[64px] sm:h-[72px] w-auto object-contain"
                alt="paralearn logo"
              />
            </Link>
            <div className="flex flex-col leading-tight w-full px-1">
              <p className="text-[#641BC4] font-bold text-lg sm:text-lg tracking-tight line-clamp-2">
                {tenantInfo?.name || "ParaLearn University"}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex justify-center items-center gap-1.5 flex-col">
                <span className="truncate uppercase font-bold text-[#641BC4]/70 tracking-widest text-[10px]">
                  University Admin
                </span>
                <span className="truncate">
                  {user?.firstName
                    ? `${user.firstName} ${user.lastName}`
                    : "Administrator"}
                </span>
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent ref={sidebarContentRef} className="px-4">
          <nav className="flex flex-col gap-1.5 mt-4">
            {content.map((item, index) => {
              const isSelected = pathname.startsWith(item.path);

              const linkContent = (
                <div
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 group ${
                    isSelected
                      ? "bg-[#EDEAFB] text-[#641BC4] font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <item.icon
                    className={`w-[18px] h-[18px] transition-transform duration-300 ${
                      isSelected ? "scale-110" : "group-hover:translate-x-0.5"
                    }`}
                  />
                  <span
                    className={`text-[15px] ${
                      isSelected ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );

              return (
                <Link key={index} href={item.path}>
                  {linkContent}
                </Link>
              );
            })}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-3 px-4 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200 cursor-pointer"
          >
            Logout
          </button>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 bg-[#fbfaff] min-h-screen relative overflow-x-hidden">
        {(!isExpanded || isMobile) && (
          <div className="absolute top-4 left-0 right-0 px-4 flex justify-between items-center z-50 md:hidden">
            <SidebarTrigger className="hover:bg-purple-50 h-9 w-9 sm:h-10 sm:w-10 border border-purple-100 bg-white shadow-sm" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-xs border border-red-100 shadow-sm active:scale-95 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        )}
        {!isExpanded && !isMobile && (
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 hidden md:block">
            <SidebarTrigger className="hover:bg-purple-50 h-9 w-9 sm:h-10 sm:w-10" />
          </div>
        )}
        <div className="pt-16 pb-6 px-3.5 sm:px-6 sm:py-6 md:p-10 w-full max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </>
  );
};

export default UniAdminSideBar;
