"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { routespath } from "@/lib/routepath";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/reduxToolKit/store";
import {
  getCurrentUserProfile,
  fetchUniUserProfile,
  logoutUser,
} from "@/reduxToolKit/user/userThunks";
import tokenManager from "@/lib/tokenManager";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

type RoleGuardProps = {
  children: ReactNode;
  allow: Array<
    | "admin"
    | "teacher"
    | "student"
    | "lecturer"
    | "accountant"
    | "principal"
    | "vp"
  >;
  mode?: "block" | "redirect";
  redirectTo?: string; // only used in redirect mode
};

export default function RoleGuard({
  children,
  allow,
  mode = "block",
  redirectTo,
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const userState = useSelector((s: any) => s.user);
  const roles = userState?.user?.roles || [];

  const userLoading = useSelector((s: any) => s.user?.loading);
  const institutionType = useSelector((s: any) => s.user?.institutionType);
  const [checkedProfile, setCheckedProfile] = useState(false);
  const didKickoff = useRef(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const standaloneToken = useSelector((s: any) => s.sabiStandaloneAuth.token);
  const isStandalone = !!standaloneToken || (typeof window !== "undefined" && !!localStorage.getItem("sabiStandaloneToken"));

  const ok = useMemo(() => {
    // If user is a standalone SabiNote user, we treat them as a 'teacher' for role-guarding purposes
    if (isStandalone && (allow.includes("teacher") || allow.includes("admin"))) {
      return true;
    }

    if (!Array.isArray(roles)) return false;
    if (roles.length === 0) return false;

    // Normalize both user roles and allowed roles to lowercase for comparison
    const normalizedUserRoles = roles.map((r: any) =>
      String(r).toLowerCase().trim(),
    );
    const normalizedAllowedRoles = allow.map((r) => r.toLowerCase().trim());

    return normalizedUserRoles.some((r: string) =>
      normalizedAllowedRoles.includes(r),
    );
  }, [roles, allow, isStandalone]);

  const hasToken = !!tokenManager.getToken() || isStandalone;

  // If we have a token but roles are empty (e.g. page refresh), fetch /users/me once.
  useEffect(() => {
    if (!hasToken) return;
    if (ok) return;
    if (didKickoff.current) return;
    if (Array.isArray(roles) && roles.length > 0) return;

    didKickoff.current = true;
    const profileThunk =
      institutionType === "university"
        ? fetchUniUserProfile
        : getCurrentUserProfile;
    dispatch(profileThunk())
      .unwrap()
      .catch(() => {})
      .finally(() => setCheckedProfile(true));
  }, [dispatch, hasToken, ok, roles, institutionType]);

  // If roles are still empty after attempting profile fetch, stop showing blank.
  useEffect(() => {
    if (!hasToken) return;
    if (Array.isArray(roles) && roles.length > 0) return;
    if (didKickoff.current && !userLoading) setCheckedProfile(true);
  }, [hasToken, roles, userLoading]);

  useEffect(() => {
    // only auto-redirect in redirect mode or if no token exists
    if (!hasToken && mounted) {
      router.replace(routespath.SIGNIN);
      return;
    }

    if (mode !== "redirect") return;
    if (ok) return;
    const normalizedRoles = roles.map((r: any) => String(r).toLowerCase());
    const fallback =
      redirectTo ||
      (normalizedRoles.includes("accountant")
        ? routespath.FINANCE
        : normalizedRoles.includes("teacher")
        ? routespath.TEACHER_DASHBOARD
        : normalizedRoles.includes("lecturer")
        ? "/lecturer/dashboard"
        : normalizedRoles.includes("admin") || normalizedRoles.includes("principal") || normalizedRoles.includes("vp")
        ? routespath.DASHBOARD
        : normalizedRoles.includes("student")
        ? "/student/dashboard"
        : "/unauthorized");
    if (pathname !== fallback) router.replace(fallback);
  }, [ok, router, redirectTo, roles, pathname, mode, hasToken, mounted]);

  // Prevent hydration mismatch by showing loading state until mounted
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8" />
          <p className="text-slate-600 font-medium">Checking access...</p>
        </div>
      </div>
    );
  }

  // While roles are being resolved after refresh
  if (
    hasToken &&
    !isStandalone &&
    Array.isArray(roles) &&
    roles.length === 0 &&
    !checkedProfile
  ) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8" />
          <p className="text-slate-600 font-medium">Loading your access…</p>
        </div>
      </div>
    );
  }

  if (!ok) {
    // If we don't have a token, we are likely logging out or already logged out.
    // Don't show the unauthorized UI, just return null and let the redirect handle it.
    if (!hasToken) {
      return null;
    }

    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-2xl font-black text-slate-900">Unauthorized</p>
          <p className="text-slate-500 mt-2">
            You don’t have permission to access this page.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-1.5">
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Required: </span>
              {allow.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}
            </p>
            <p className="text-slate-500">
              <span className="font-semibold text-slate-700">Your role: </span>
              {roles.length > 0
                ? roles.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")
                : "None / not logged in"}
            </p>
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-xl border-slate-200"
              onClick={() => router.back()}
            >
              Go back
            </Button>
            <Button
              className="h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white"
              onClick={async () => {
                try {
                  await dispatch(logoutUser()).unwrap();
                } catch {}
                router.replace(routespath.SIGNIN);
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
