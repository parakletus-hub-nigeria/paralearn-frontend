"use client";

import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import Link from "next/link";
import { FaEye, FaEyeSlash, FaWhatsapp } from "react-icons/fa";
import AuthHeader from "@/components/auth/authHeader";
import { toast } from "sonner";
import { handleError } from "@/lib/error-handler";
import { useRouter } from "next/navigation";
import { routespath } from "@/lib/routepath";
import { pickRedirectPath } from "@/reduxToolKit/user/userUtils";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { AppDispatch } from "@/reduxToolKit/store";
import { fetchCurrentSession } from "@/reduxToolKit/setUp/setUpThunk";
import apiClient from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail } from "lucide-react";
import WhatsAppAuthModal from "@/components/auth/WhatsAppAuthModal";

export default function SigninPage() {
  const [data, setData] = useState({ email: "", password: "" });
  const [institutionType, setInstitutionType] = useState<"k12" | "university">(
    "k12",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const { error, loading } = useSelector((state: any) => state.user);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const isValid = () => {
    return data.email.trim().length >= 3 && data.password.trim().length >= 4;
  };

  const submit = async () => {
    try {
      const result = await dispatch(
        loginUser({ ...data, institutionType }),
      ).unwrap();

      if (result && result.accessToken) {
        if (result.redirecting) {
          toast.success("Logged in successfully! Redirecting...");
          return;
        }
        toast.success("Logged in successfully!");

        const roles = result.user?.roles || [];
        const isAccountant =
          roles.some((r: any) =>
            ["accountant", "bursar", "finance"].includes(
              String(r).toLowerCase().trim(),
            ),
          ) &&
          !roles.some((r: any) =>
            ["admin", "principal"].includes(String(r).toLowerCase().trim()),
          );

        if (isAccountant) {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("redirectAfterLogin");
          }
          router.push(routespath.FINANCE);
          return;
        }

        const redirectPath =
          typeof window !== "undefined"
            ? sessionStorage.getItem("redirectAfterLogin")
            : null;

        if (redirectPath) {
          sessionStorage.removeItem("redirectAfterLogin");
          router.push(redirectPath);
          return;
        }

        const roleTarget = pickRedirectPath(roles, institutionType);
        if (roleTarget !== routespath.DASHBOARD) {
          router.push(roleTarget);
          return;
        }

        try {
          const sessionResult = await dispatch(fetchCurrentSession()).unwrap();

          if (sessionResult && sessionResult.sessionDetails) {
            router.push(routespath.DASHBOARD);
          } else {
            try {
              const allSessionsResp = await apiClient.get(
                `/api/proxy${routespath.API_GET_ALL_SESSIONS}`,
              );
              const sessions =
                allSessionsResp?.data?.data || allSessionsResp?.data || [];
              if (Array.isArray(sessions) && sessions.length > 0) {
                router.push(routespath.DASHBOARD);
              } else {
                router.push("/setup");
              }
            } catch {
              router.push(routespath.DASHBOARD);
            }
          }
        } catch (sessionError: any) {
          try {
            const allSessionsResp = await apiClient.get(
              `/api/proxy${routespath.API_GET_ALL_SESSIONS}`,
            );
            const sessions =
              allSessionsResp?.data?.data || allSessionsResp?.data || [];
            if (Array.isArray(sessions) && sessions.length > 0) {
              router.push(routespath.DASHBOARD);
            } else {
              router.push("/setup");
            }
          } catch {
            router.push(routespath.DASHBOARD);
          }
        }
      } else {
        toast.error("Login failed. No token received.");
      }
    } catch (e: any) {
      handleError(
        e,
        "Login failed. Please check your credentials and try again.",
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 via-white to-purple-50/30 pb-12">
      <AuthHeader />
      <div className="mt-8 w-[95%] max-w-md sm:mt-12">
        <Card className="w-full border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/50 shadow-primary/5 ring-1 ring-slate-200/60">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">
              Account Login
            </CardTitle>
            <p className="text-sm text-slate-500">
              Sign in to your ParaLearn account to continue
            </p>
          </CardHeader>
          <CardContent className="space-y-5 px-6 pb-6">
            <div className="flex gap-4 p-1 pb-3 justify-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="institutionType"
                  value="k12"
                  checked={institutionType === "k12"}
                  onChange={() => setInstitutionType("k12")}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-slate-700">
                  K-12 School
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="institutionType"
                  value="university"
                  checked={institutionType === "university"}
                  onChange={() => setInstitutionType("university")}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-slate-700">
                  University / College
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700">
                Email Address or Code
              </Label>
              <Input
                id="email"
                name="email"
                type="text"
                value={data.email}
                onChange={handleChange}
                placeholder="user@institution.edu or code"
                className="h-11 rounded-lg border-slate-300 bg-slate-50/50 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="h-11 rounded-lg border-slate-300 bg-slate-50/50 pr-10 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <FaEye className="h-4 w-4" />
                  ) : (
                    <FaEyeSlash className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <Button
              onClick={submit}
              disabled={loading || !isValid()}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary via-purple-700 to-primary font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In with Password"}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-[1px] bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Or continue with
              </span>
              <div className="flex-1 h-[1px] bg-slate-200" />
            </div>

            {/* 1-Click WhatsApp Sign In */}
            <button
              type="button"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="h-12 w-full rounded-xl bg-[#25D366] hover:bg-[#20bd5a] font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FaWhatsapp className="text-xl" />
              <span>1-Click Sign in with WhatsApp</span>
            </button>

            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <Link
                href={
                  institutionType === "university"
                    ? "/auth/uni-forgot-password"
                    : "/auth/forgot-password"
                }
                className="text-sm font-medium text-primary hover:underline hover:underline-offset-2"
              >
                Forgot password?
              </Link>
              <p className="text-sm text-slate-500">
                Do not have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-semibold text-primary hover:underline hover:underline-offset-2"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <WhatsAppAuthModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        institutionType={institutionType}
      />
    </div>
  );
}
