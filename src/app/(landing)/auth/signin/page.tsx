"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/reduxToolKit/store";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash, FaWhatsapp } from "react-icons/fa";
import { BiEnvelope } from "react-icons/bi";
import { toast } from "sonner";
import { handleError } from "@/lib/error-handler";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { pickRedirectPath } from "@/reduxToolKit/user/userUtils";
import AuthHeader from "@/components/auth/authHeader";
import WhatsAppAuthModal from "@/components/auth/WhatsAppAuthModal";

const Signin = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [institutionType, setInstitutionType] = useState<"k12" | "university">("k12");
  const [loginMode, setLoginMode] = useState<
    "admin" | "accountant" | "vp" | "teacher" | "student"
  >("admin");

  const [data, setData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // WhatsApp 1-Click State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const isValid = () => {
    return Boolean(data.email && data.password);
  };

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid()) return;

    setLoading(true);
    setError(null);

    try {
      const result: any = await dispatch(
        loginUser({
          email: data.email,
          password: data.password,
          institutionType,
        })
      ).unwrap();

      if (result && result.accessToken) {
        if (result.redirecting) {
          toast.success("Logged in successfully! Redirecting...");
          return;
        }

        toast.success("Logged in successfully!");
        const roles = result.user?.roles || [];
        router.push(pickRedirectPath(roles, institutionType));
      } else {
        toast.error("Login failed. No token received.");
      }
    } catch (err: any) {
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Invalid email or password. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-[100%] min-h-[100vh] bg-[#F8F7FC]">
      <AuthHeader />
      <div className="border-[1px] border-[#641BC4] rounded-2xl w-[95%] sm:w-[500px] flex flex-col items-center justify-between py-[36px] bg-[#EDEAFB] mt-[30px] mb-12 shadow-md">
        <div className="flex flex-col items-center mb-5 text-center px-4">
          <p className="text-[20px] font-bold flex flex-row items-center space-x-2 text-slate-900">
            <BiEnvelope className="text-[#641BC4]" />{" "}
            <span>
              {loginMode === "admin"
                ? "Admin & Principal Login"
                : loginMode === "accountant"
                  ? "Bursar / Finance Login"
                  : loginMode === "vp"
                    ? "Vice Principal (VP) Login"
                    : loginMode === "teacher"
                      ? "Teacher Login"
                      : "Student Login"}
            </span>
          </p>
          <p className="text-xs sm:text-sm mt-1 text-slate-600">
            {loginMode === "admin"
              ? "Login to your administrator or principal account"
              : loginMode === "accountant"
                ? "Manage school finances, invoices, and fees"
                : loginMode === "vp"
                  ? "Review grades, assessments, and approvals"
                  : loginMode === "teacher"
                    ? "Login with your email or teacher code"
                    : "Login with your student code (e.g. BFA-S-26-0001)"}
          </p>
        </div>

        {/* Role tabs */}
        <div className="w-full px-4 mb-4">
          <div className="grid grid-cols-5 gap-1 bg-white/70 p-1 rounded-xl border border-[#641BC4]/30 text-center">
            {[
              { key: "admin", label: "Admin" },
              { key: "accountant", label: "Bursar" },
              { key: "vp", label: "VP" },
              { key: "teacher", label: "Teacher" },
              { key: "student", label: "Student" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLoginMode(tab.key as any)}
                className={`py-2 rounded-lg font-bold text-2xs sm:text-xs transition-all cursor-pointer ${
                  loginMode === tab.key
                    ? "bg-[#641BC4] text-white shadow-sm"
                    : "text-slate-700 hover:bg-white/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Institution type */}
        <div className="w-full px-4 mb-3">
          <div className="flex justify-center gap-6 p-1 pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="institutionType"
                value="k12"
                checked={institutionType === "k12"}
                onChange={() => setInstitutionType("k12")}
                className="w-4 h-4 text-[#641BC4]"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-800">
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
                className="w-4 h-4 text-[#641BC4]"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-800">
                University / College
              </span>
            </label>
          </div>
        </div>

        {/* Credentials */}
        <form onSubmit={submit} className="w-full space-y-3.5 px-4">
          <div className="flex flex-col w-full">
            <label htmlFor="email" className="mb-1 text-xs sm:text-sm font-semibold text-slate-800">
              {loginMode === "admin"
                ? "Admin / Principal Email"
                : loginMode === "accountant"
                  ? "Bursar / Accountant Email"
                  : loginMode === "vp"
                    ? "Vice Principal Email"
                    : loginMode === "teacher"
                      ? "Email or Teacher Code"
                      : "Student Code or Email"}
            </label>
            <input
              id="email"
              name="email"
              type="text"
              value={data.email}
              onChange={handleChange}
              className="border border-[#641BC4]/50 focus:border-[#641BC4] bg-white focus:border-2 focus:outline-none h-11 w-full px-3 rounded-lg text-sm text-slate-800"
              placeholder={
                loginMode === "admin"
                  ? "admin@brightfuture.ng"
                  : loginMode === "accountant"
                    ? "bursar@brightfuture.ng"
                    : loginMode === "vp"
                      ? "vp@brightfuture.ng"
                      : loginMode === "teacher"
                        ? "e.g. TCH-26-00001 or teacher@school.ng"
                        : "e.g. BFA-S-26-0001"
              }
            />
          </div>

          <div className="flex flex-col w-full">
            <label htmlFor="password" className="mb-1 text-xs sm:text-sm font-semibold text-slate-800">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={data.password}
                onChange={handleChange}
                className="border border-[#641BC4]/50 focus:border-[#641BC4] bg-white focus:border-2 focus:outline-none h-11 w-full px-3 rounded-lg text-sm pr-10 text-slate-800"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {!showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isValid()}
            className="w-full rounded-xl font-semibold text-white h-12 flex flex-row items-center justify-center transition-colors duration-200 disabled:opacity-70 mt-4 bg-[#641BC4] hover:bg-[#5214a3] cursor-pointer shadow-sm"
          >
            {loading ? "Signing in..." : "Sign In with Password"}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 my-4 px-4">
          <div className="flex-1 h-[1px] bg-[#641BC4]/30" />
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Or continue with
          </span>
          <div className="flex-1 h-[1px] bg-[#641BC4]/30" />
        </div>

        {/* WhatsApp 1-Click Button */}
        <div className="w-full px-4">
          <button
            type="button"
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="w-full rounded-xl font-semibold text-white h-12 flex flex-row items-center justify-center gap-2.5 transition-colors duration-200 bg-[#25D366] hover:bg-[#20bd5a] shadow-sm cursor-pointer"
          >
            <FaWhatsapp className="text-xl" />
            <span>1-Click Sign in with WhatsApp</span>
          </button>
        </div>

        {/* Footer links */}
        <div className="w-full text-center mt-5 flex flex-col space-y-2 px-4">
          <p>
            <Link
              href={
                institutionType === "university"
                  ? "/auth/uni-forgot-password"
                  : "/auth/forgot-password"
              }
              className="text-[#641BC4] font-semibold text-sm hover:underline"
            >
              Forgot password?
            </Link>
          </p>
          <p className="text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-[#641BC4] font-semibold hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* WhatsApp Auth Modal */}
      <WhatsAppAuthModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        institutionType={institutionType}
      />
    </div>
  );
};

export default Signin;
