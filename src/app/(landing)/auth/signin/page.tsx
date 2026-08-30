"use client";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import Link from "next/link";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import AuthHeader from "@/components/auth/authHeader";
import { BiEnvelope } from "react-icons/bi";
import { toast } from "sonner";
import { handleError } from "@/lib/error-handler";
import { useRouter } from "next/navigation";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { AppDispatch } from "@/reduxToolKit/store";
import { pickRedirectPath } from "@/reduxToolKit/user/userUtils";

const Signin = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<
    "admin" | "accountant" | "vp" | "teacher" | "student"
  >("admin");
  const [institutionType, setInstitutionType] = useState<"k12" | "university">(
    "k12",
  );

  const dispatch = useDispatch<AppDispatch>();
  const { error, loading } = useSelector((state: any) => state.user);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const isValid = () => {
    if (loginMode === "admin" || loginMode === "accountant" || loginMode === "vp") {
      const emailRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return (emailRe.test(data.email) || data.email.trim().length >= 3) && data.password.length >= 4;
    }
    // Teacher / Student: username / student code / email
    return data.email.trim().length >= 2 && data.password.trim().length >= 4;
  };

  const submit = async () => {
    try {
      const result = await dispatch(
        loginUser({ ...data, institutionType }),
      ).unwrap();

      if (result && result.accessToken) {
        // Subdomain redirect happens inside the thunk — just show toast
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
    } catch (e: any) {
      handleError(
        e,
        "Login failed. Please check your credentials and try again.",
      );
    }
  };

  return (
    <div className="flex flex-col items-center w-[100%] min-h-[100vh] bg-[#F8F7FC]">
      <AuthHeader />
      <div className="border-[1px] border-[#641BC4] rounded-2xl w-[95%] sm:w-[500px] flex flex-col items-center justify-between py-[36px] bg-[#EDEAFB] mt-[30px] mb-12 shadow-md">
        <div className="flex flex-col items-center mb-5 text-center px-4">
          <p className="text-[20px] font-bold flex flex-row items-center space-x-2">
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
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
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
                className={`py-2 rounded-lg font-bold text-2xs sm:text-xs transition-all ${
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
              <span className="text-xs sm:text-sm font-medium" style={{ color: "var(--foreground)" }}>
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
              <span className="text-xs sm:text-sm font-medium" style={{ color: "var(--foreground)" }}>
                University / College
              </span>
            </label>
          </div>
        </div>

        {/* Credentials */}
        <div className="w-full space-y-3.5 px-4">
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
              className="border border-[#641BC4]/50 focus:border-[#641BC4] bg-white focus:border-2 focus:outline-none h-11 w-full px-3 rounded-lg text-sm"
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
            <label htmlFor="password" className="mb-2 text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={data.password}
                onChange={handleChange}
                className="border border-[#641BC4] focus:border-2 focus:outline-none h-11 w-full px-3 rounded-md text-base pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-lg"
                style={{ color: "var(--foreground-muted)" }}
              >
                {!showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: "var(--crimson-signal)" }}>{error}</p>}
        </div>

        <button
          onClick={submit}
          disabled={loading || !isValid()}
          style={
            isValid()
              ? { backgroundColor: "#641BC4" }
              : { backgroundColor: "#a166f0" }
          }
          className="w-full sm:w-3/4 rounded-xl font-semibold text-white h-12 flex flex-row items-center justify-center transition-colors duration-200 disabled:opacity-70 mt-6"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="w-full text-center mt-4 flex flex-col space-y-2 px-4">
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
          <p className="text-sm">
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-[#641BC4] font-semibold hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signin;
