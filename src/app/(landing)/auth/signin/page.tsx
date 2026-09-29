"use client";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FaEye, FaEyeSlash, FaWhatsapp } from "react-icons/fa";
import { BiEnvelope } from "react-icons/bi";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import logo from "../../../../../public/mainLogo.svg";
import { toast } from "sonner";
import { handleError } from "@/lib/error-handler";
import { useRouter } from "next/navigation";
import { loginUser } from "@/reduxToolKit/user/userThunks";
import { AppDispatch } from "@/reduxToolKit/store";
import apiClient, { setAuthToken } from "@/lib/api";
import { saveSubdomainToStorage } from "@/lib/subdomainManager";
import { hydrateUserState } from "@/reduxToolKit/user/userSlice";
import {
  extractSubdomainFromUser,
  extractTokenAndUser,
  normalizeRoles,
  pickRedirectPath,
} from "@/reduxToolKit/user/userUtils";

const Signin = () => {
  const [data, setData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState("");
  const [whatsAppStep, setWhatsAppStep] = useState<
    "idle" | "opening" | "waiting" | "verified" | "error"
  >("idle");
  const [whatsAppError, setWhatsAppError] = useState("");
  const [whatsAppUrl, setWhatsAppUrl] = useState("");
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

  const redirectAfterAuth = async (payload: any) => {
    const { token, user } = extractTokenAndUser(payload);
    const accessToken = token || payload?.accessToken || payload?.data?.accessToken;
    if (!accessToken) throw new Error("No token received from server");

    const roles = normalizeRoles(user?.roles?.length ? user.roles : user);
    const subdomain = extractSubdomainFromUser(user, payload);
    if (!subdomain) throw new Error("School subdomain was not found");

    await setAuthToken(accessToken);
    saveSubdomainToStorage(subdomain);

    const userToSave = { ...(user || {}), roles, subdomain, institutionType: "k12" };
    try {
      localStorage.setItem("currentUser", JSON.stringify(userToSave));
    } catch {}

    dispatch(
      hydrateUserState({
        accessToken,
        user: userToSave,
        subdomain,
        institutionType: "k12",
      }),
    );

    const currentHost = window.location.host;
    const currentProtocol = window.location.protocol;
    const redirectPath = pickRedirectPath(roles, "k12");
    let newHost: string;

    if (currentHost.includes("localhost") || currentHost.includes("127.0.0.1")) {
      const port = currentHost.includes(":") ? currentHost.split(":")[1] : "";
      newHost = port ? `${subdomain}.localhost:${port}` : `${subdomain}.localhost`;
    } else {
      const hostParts = currentHost.split(".");
      const baseDomain = hostParts.length >= 2 ? hostParts.slice(-2).join(".") : currentHost;
      newHost = `${subdomain}.${baseDomain}`;
    }

    const urlObj = new URL(`${currentProtocol}//${newHost}${redirectPath}`);
    urlObj.searchParams.set("auth_token", accessToken);
    urlObj.searchParams.set("auth_user", encodeURIComponent(JSON.stringify(userToSave)));
    window.location.href = urlObj.toString();
  };

  const handleWhatsAppLogin = async () => {
    setWhatsAppLoading(true);
    setWhatsAppStep("opening");
    setWhatsAppError("");
    setWhatsAppUrl("");
    setWhatsAppStatus("Opening WhatsApp");

    try {
      const startRes = await apiClient.post("/api/proxy/auth/whatsapp/start", {
        expectedRole: loginMode,
      });
      const startData = startRes.data?.data || startRes.data;
      const challengeId = startData?.challengeId;
      const clientSecret = startData?.clientSecret;
      const whatsappUrl = startData?.whatsappUrl;

      if (!challengeId || !clientSecret || !whatsappUrl) {
        throw new Error("WhatsApp login could not start. Please try password login.");
      }

      setWhatsAppUrl(whatsappUrl);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setWhatsAppStep("waiting");
      setWhatsAppStatus("Waiting for WhatsApp confirmation");

      const startedAt = Date.now();
      let verified = false;
      while (Date.now() - startedAt < 5 * 60 * 1000) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusRes = await apiClient.post("/api/proxy/auth/whatsapp/status", {
          challengeId,
          clientSecret,
        });
        const statusData = statusRes.data?.data || statusRes.data;
        const status = statusData?.status;

        if (status === "VERIFIED") {
          verified = true;
          break;
        }
        if (status === "EXPIRED" || status === "CONSUMED") {
          throw new Error("This WhatsApp login request has expired. Start again.");
        }
      }

      if (!verified) throw new Error("WhatsApp login timed out. Start again.");

      setWhatsAppStep("verified");
      setWhatsAppStatus("Signing you in");
      const completeRes = await apiClient.post("/api/proxy/auth/whatsapp/complete", {
        challengeId,
        clientSecret,
      });
      toast.success("Logged in successfully");
      await redirectAfterAuth(completeRes.data);
    } catch (e: any) {
      setWhatsAppLoading(false);
      setWhatsAppStep("error");
      setWhatsAppError(
        e?.response?.data?.message ||
          e?.data?.message ||
          e?.message ||
          "WhatsApp login failed. Please try again.",
      );
      setWhatsAppStatus("Could not complete WhatsApp login");
      handleError(e, e?.message || "WhatsApp login failed. Please try again.");
    }
  };

  const closeWhatsAppModal = () => {
    if (whatsAppLoading && whatsAppStep !== "error") return;
    setWhatsAppStep("idle");
    setWhatsAppStatus("");
    setWhatsAppError("");
    setWhatsAppUrl("");
  };

  const submit = async () => {
    try {
      const result = await dispatch(
        loginUser({ ...data, institutionType, expectedRole: loginMode }),
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
    <div className="flex items-start justify-center w-full min-h-[100dvh] bg-[#F8F7FC] px-3 py-3 sm:items-center">
      {whatsAppStep !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4"
          style={{ background: "rgba(15, 23, 42, 0.46)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-login-title"
        >
          <div
            className="overflow-hidden"
            style={{
              width: "min(420px, calc(100vw - 32px))",
              maxHeight: "calc(100dvh - 32px)",
              background: "#fdfdff",
              border: "1px solid #d7eadf",
              borderRadius: 12,
              boxShadow: "0 18px 60px rgba(15, 23, 42, 0.2)",
            }}
          >
            <div
              className="flex items-start justify-between gap-4"
              style={{ borderBottom: "1px solid #e2e8f0", padding: "16px 18px" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: "#dff9d8",
                    color: "#128C45",
                  }}
                >
                  <FaWhatsapp className="text-[24px]" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="whatsapp-login-title"
                    className="text-base font-bold"
                    style={{ color: "#0f172a" }}
                  >
                    Login with WhatsApp
                  </h2>
                  <p className="mt-0.5 text-xs font-medium" style={{ color: "#64748b" }}>
                    Send the prepared message from your registered number.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWhatsAppModal}
                disabled={whatsAppLoading && whatsAppStep !== "error"}
                className="flex shrink-0 items-center justify-center transition-colors disabled:opacity-40"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  color: "#64748b",
                  background: "transparent",
                }}
                aria-label="Close WhatsApp login"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div style={{ padding: "24px 18px 18px" }}>
              <div
                className="mx-auto mb-5 flex items-center justify-center"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  background: whatsAppStep === "error" ? "#fddada" : "#dff9d8",
                  color: whatsAppStep === "error" ? "#e60023" : "#128C45",
                }}
              >
                {whatsAppStep === "verified" ? (
                  <CheckCircle2 className="h-9 w-9" />
                ) : whatsAppStep === "error" ? (
                  <AlertCircle className="h-9 w-9" />
                ) : (
                  <Loader2 className="h-9 w-9 animate-spin" />
                )}
              </div>

              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: "#0f172a" }}>
                  {whatsAppStep === "opening"
                    ? "Opening WhatsApp"
                    : whatsAppStep === "waiting"
                      ? "Waiting for your message"
                      : whatsAppStep === "verified"
                        ? "Verified successfully"
                        : "WhatsApp login failed"}
                </p>
                <p
                  className="mx-auto mt-2 text-sm leading-6"
                  style={{ maxWidth: 320, color: "#64748b" }}
                >
                  {whatsAppStep === "opening"
                    ? "Tap send in WhatsApp when it opens. We will match your registered number automatically."
                    : whatsAppStep === "waiting"
                      ? "Keep this page open after sending the prepared message. This usually takes a few seconds."
                      : whatsAppStep === "verified"
                        ? "Your account is verified. Setting up your secure session now."
                        : whatsAppError || "Please try again or use password login."}
                </p>
              </div>

              <div
                className="mt-5"
                style={{
                  border: "1px solid #d7eadf",
                  background: "#f2fbf5",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#128C45" }}>
                  <ShieldCheck className="h-4 w-4" />
                  Phone numberless login
                </div>
                <p className="mt-1 text-xs leading-5" style={{ color: "#475569" }}>
                  ParaLearn uses the phone number Meta sends from WhatsApp to find and sign in the matching user.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {whatsAppUrl && whatsAppStep !== "verified" && (
                  <button
                    type="button"
                    onClick={() => window.open(whatsAppUrl, "_blank", "noopener,noreferrer")}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 px-4 text-sm font-bold text-white transition-colors"
                    style={{ background: "#128C45", borderRadius: 8 }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open WhatsApp
                  </button>
                )}
                {whatsAppStep === "error" && (
                  <button
                    type="button"
                    onClick={handleWhatsAppLogin}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 px-4 text-sm font-bold text-white transition-colors"
                    style={{ background: "#128C45", borderRadius: 8 }}
                  >
                    <FaWhatsapp className="text-lg" />
                    Try again
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex items-center justify-between text-[11px] font-semibold"
              style={{
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#64748b",
                padding: "10px 18px",
              }}
            >
              <span>ParaLearn Auth</span>
              <span>Secure session</span>
            </div>
          </div>
        </div>
      )}

      <div className="border border-[#641BC4]/60 rounded-xl w-full max-w-[460px] flex flex-col items-center py-4 bg-[#EDEAFB] shadow-sm">
        <Link href="/" className="relative mb-2 block h-10 w-[118px] overflow-hidden">
          <Image src={logo} alt="ParaLearn" fill sizes="118px" className="object-contain" priority />
        </Link>

        <div className="flex flex-col items-center mb-3 text-center px-4">
          <p className="text-[18px] font-bold flex flex-row items-center space-x-2">
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
        <div className="w-full px-4 mb-3">
          <div className="grid grid-cols-5 gap-1 bg-white/80 p-1 rounded-lg border border-[#641BC4]/25 text-center">
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
                className={`h-9 rounded-md font-bold text-[11px] sm:text-xs transition-all ${
                  loginMode === tab.key
                    ? "bg-[#641BC4] text-white"
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
          <div className="flex justify-center gap-5 p-0">
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
        <div className="w-full space-y-3 px-4">
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
              className="border border-[#641BC4]/50 focus:border-[#641BC4] bg-white focus:border-2 focus:outline-none h-10 w-full px-3 rounded-lg text-sm"
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
            <label htmlFor="password" className="mb-1 text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={data.password}
                onChange={handleChange}
                className="border border-[#641BC4] focus:border-2 focus:outline-none h-10 w-full px-3 rounded-md text-sm pr-10"
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
          className="w-[calc(100%-2rem)] rounded-lg font-semibold text-white h-11 flex flex-row items-center justify-center transition-colors duration-200 disabled:opacity-70 mt-4"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="w-full text-center mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1 px-4 text-sm">
          <span>
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
          </span>
          <span style={{ color: "var(--foreground-muted)" }}>|</span>
          <span>
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-[#641BC4] font-semibold hover:underline"
            >
              Sign up
            </Link>
          </span>
        </div>

        <div className="w-full px-4 mt-4 pt-3 border-t border-[#641BC4]/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Login with WhatsApp</p>
              <p className="text-[11px] leading-4" style={{ color: "var(--foreground-muted)" }}>
                Send one prepared message from your registered number.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWhatsAppLogin}
              disabled={whatsAppLoading}
              className="h-10 px-4 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-60 inline-flex items-center justify-center gap-2 text-white"
              style={{ background: "#128C45" }}
            >
              <FaWhatsapp className="text-lg" />
              {whatsAppLoading ? "Waiting" : "Login with WhatsApp"}
            </button>
          </div>
          {whatsAppStatus && (
            <div className="mt-2 rounded-lg border border-[#dbe9ff] bg-[#dbe9ff] px-3 py-2 text-xs text-[#2a64f6]">
              {whatsAppStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signin;
