"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/reduxToolKit/store";
import { useRouter } from "next/navigation";
import { FaWhatsapp } from "react-icons/fa";
import {
  X,
  Clock,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  SUPPORTED_COUNTRIES,
  CountryCodeOption,
  normalizeWhatsAppNumber,
  isValidPhoneNumber,
  formatCountdown,
  parseChallengeTextFromUrl,
  generateQrCodeDataUrl,
  getSavedWhatsAppPhone,
  saveWhatsAppPhone,
} from "@/lib/whatsappAuthUtils";
import {
  startWhatsAppAuth,
  checkWhatsAppStatus,
  completeWhatsAppAuth,
} from "@/reduxToolKit/user/whatsappAuthThunks";
import { getSubdomain } from "@/lib/subdomainManager";

interface WhatsAppAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionType?: "k12" | "university";
  defaultSubdomain?: string | null;
  initialPhoneNumber?: string;
  autoStart?: boolean;
}

type ModalStage =
  | "PHONE_INPUT"
  | "AWAITING_MESSAGE"
  | "VERIFIED"
  | "EXPIRED"
  | "ERROR";

export default function WhatsAppAuthModal({
  isOpen,
  onClose,
  institutionType = "k12",
  defaultSubdomain,
  initialPhoneNumber,
  autoStart = false,
}: WhatsAppAuthModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  // Component state
  const [selectedCountry, setSelectedCountry] = useState<CountryCodeOption>(
    SUPPORTED_COUNTRIES[0]
  );
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [subdomainInput, setSubdomainInput] = useState(
    defaultSubdomain || getSubdomain() || ""
  );
  const [showSubdomainField, setShowSubdomainField] = useState(!getSubdomain());

  const [stage, setStage] = useState<ModalStage>("AWAITING_MESSAGE");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Challenge data
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(300);
  const [challengeText, setChallengeText] = useState<string>("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Polling ref to control interval and avoid overlapping requests
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const hasAutoStartedRef = useRef<boolean>(false);

  // Clean up all timers when modal is unmounted or closed
  const clearAllTimers = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Complete session issuance upon verification
  const handleCompleteLogin = useCallback(
    async (verifiedChallengeId: string) => {
      setIsLoading(true);
      try {
        const result = await dispatch(
          completeWhatsAppAuth({
            challengeId: verifiedChallengeId,
            subdomain: subdomainInput.trim() || undefined,
            institutionType,
          })
        ).unwrap();

        toast.success("Welcome back! Authenticated with WhatsApp.");

        if (result.redirecting) {
          return;
        }

        if (result.redirectPath) {
          router.push(result.redirectPath);
        }
        onClose();
      } catch (err: any) {
        setStage("ERROR");
        setErrorMessage(
          typeof err === "string"
            ? err
            : "Failed to finalize session. Please retry."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      dispatch,
      subdomainInput,
      institutionType,
      router,
      onClose,
    ]
  );

  // Initiate 1-Click WhatsApp Challenge (Zero Phone Input)
  const handleStartAuth = useCallback(
    async () => {
      setErrorMessage(null);
      setIsLoading(true);
      setStage("AWAITING_MESSAGE");

      try {
        const result = await dispatch(
          startWhatsAppAuth({
            subdomain: subdomainInput.trim() || undefined,
          })
        ).unwrap();

        setChallengeId(result.challengeId);
        setWhatsappUrl(result.whatsappUrl);
        setExpiresAt(result.expiresAt);

        const extractedText = parseChallengeTextFromUrl(result.whatsappUrl);
        setChallengeText(extractedText);

        // Generate high-resolution QR code
        generateQrCodeDataUrl(result.whatsappUrl, 200).then((url) => {
          if (url) setQrCodeDataUrl(url);
        });

        // 1-Click: Automatically trigger WhatsApp in new tab / app
        try {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
        } catch {
          // Browser popup blocker fallback
        }
      } catch (err: any) {
        setStage("ERROR");
        setErrorMessage(
          typeof err === "string"
            ? err
            : "Failed to initiate WhatsApp login. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [subdomainInput, dispatch]
  );

  // Auto-trigger 1-click when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentSubdomain = defaultSubdomain || getSubdomain();
      if (currentSubdomain) {
        setSubdomainInput(currentSubdomain);
        setShowSubdomainField(false);
      } else {
        setShowSubdomainField(true);
      }

      if (!hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        handleStartAuth();
      }
    } else {
      clearAllTimers();
      setStage("AWAITING_MESSAGE");
      setErrorMessage(null);
      setIsLoading(false);
      setChallengeId(null);
      setWhatsappUrl(null);
      setQrCodeDataUrl("");
      hasAutoStartedRef.current = false;
    }
    return () => clearAllTimers();
  }, [isOpen, defaultSubdomain, handleStartAuth, clearAllTimers]);

  // Countdown timer effect
  useEffect(() => {
    if (stage === "AWAITING_MESSAGE" && expiresAt) {
      const targetTime = new Date(expiresAt).getTime();
      const initialRemaining = Math.max(
        0,
        Math.floor((targetTime - Date.now()) / 1000)
      );
      setSecondsLeft(initialRemaining);

      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      countdownTimerRef.current = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.floor((targetTime - Date.now()) / 1000)
        );
        setSecondsLeft(remaining);

        if (remaining <= 0) {
          clearAllTimers();
          setStage("EXPIRED");
        }
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [stage, expiresAt, clearAllTimers]);

  // Real-time Status polling effect (1.5s interval)
  useEffect(() => {
    if (stage === "AWAITING_MESSAGE" && challengeId) {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

      const checkStatus = async () => {
        if (isPollingRef.current) return;
        isPollingRef.current = true;

        try {
          const result = await dispatch(
            checkWhatsAppStatus({
              challengeId,
              subdomain: subdomainInput || undefined,
            })
          ).unwrap();

          if (result.status === "VERIFIED") {
            clearAllTimers();
            setStage("VERIFIED");
            handleCompleteLogin(challengeId);
          } else if (result.status === "EXPIRED") {
            clearAllTimers();
            setStage("EXPIRED");
          }
        } catch (err: any) {
          console.debug("[WhatsApp Auth Polling] Transient poll check:", err);
        } finally {
          isPollingRef.current = false;
        }
      };

      const initialTimeout = setTimeout(checkStatus, 1200);
      pollingTimerRef.current = setInterval(checkStatus, 1800);

      return () => {
        clearTimeout(initialTimeout);
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      };
    }
  }, [stage, challengeId, subdomainInput, dispatch, clearAllTimers, handleCompleteLogin]);

  const handleCopyChallenge = () => {
    if (challengeText) {
      navigator.clipboard.writeText(challengeText);
      setCopiedText(true);
      toast.success("Verification code copied!");
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md overflow-hidden bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all">
        {/* Top Accent Gradient Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#641BC4]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#25D366]/15 text-[#25D366] shadow-inner">
              <FaWhatsapp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  1-Click WhatsApp Login
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <Zap className="w-2.5 h-2.5 mr-0.5 fill-current" />
                  Fast
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instant passwordless authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4">
          {/* ========================================================= */}
          {/* STAGE: AWAITING_MESSAGE (1-CLICK RADAR & AUTO-POLLING)    */}
          {/* ========================================================= */}
          {stage === "AWAITING_MESSAGE" && (
            <div className="space-y-4 text-center">
              {/* Pulsing Radar Visual */}
              <div className="relative flex items-center justify-center w-20 h-20 mx-auto my-2">
                <div className="absolute inset-0 rounded-full bg-[#25D366]/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-[#25D366]/30 animate-pulse" />
                <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30">
                  <FaWhatsapp className="w-7 h-7" />
                </div>
              </div>

              {/* Instruction Headline */}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Send the message in WhatsApp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  We opened WhatsApp with a prepared verification message.
                  Tap <span className="font-semibold text-slate-800 dark:text-slate-200">Send</span> and
                  this screen will automatically log you in.
                </p>
              </div>

              {/* Real-time Countdown Timer Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-mono text-slate-600 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-[#25D366]" />
                <span>Expires in: {formatCountdown(secondsLeft)}</span>
              </div>

              {/* Action 1: 1-Click WhatsApp Button (Fallback if popup blocked) */}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
                >
                  <FaWhatsapp className="w-5 h-5" />
                  <span>Tap to Open WhatsApp & Send</span>
                  <ExternalLink className="w-4 h-4 opacity-80" />
                </a>
              )}

              {/* Action 2: Pre-filled Message display with 1-click copy */}
              {challengeText && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-left">
                  <div className="flex items-center justify-between text-2xs text-slate-400 mb-1">
                    <span>Message preview</span>
                    <button
                      type="button"
                      onClick={handleCopyChallenge}
                      className="flex items-center gap-1 text-[#641BC4] dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy text</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 break-all select-all">
                    {challengeText}
                  </p>
                </div>
              )}

              {/* Action 3: Desktop QR Code Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {showQrCode
                      ? "Hide QR code"
                      : "Using WhatsApp on computer? Scan QR code"}
                  </span>
                </button>

                {showQrCode && (qrCodeDataUrl || whatsappUrl) && (
                  <div className="mt-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 inline-block shadow-lg animate-in zoom-in-95 duration-150">
                    <img
                      src={qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(whatsappUrl || "")}`}
                      alt="WhatsApp Auth QR Code"
                      className="w-44 h-44 mx-auto rounded-lg"
                    />
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-2">
                      Scan with your phone&apos;s camera to open WhatsApp instantly
                    </p>
                  </div>
                )}
              </div>

              {/* Return to edit phone number */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    clearAllTimers();
                    setStage("PHONE_INPUT");
                  }}
                  className="text-xs text-[#641BC4] dark:text-purple-400 hover:underline font-medium cursor-pointer"
                >
                  Entered the wrong number? Change phone number
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STAGE 3: VERIFIED (INSTANT SUCCESS STATE)                 */}
          {/* ========================================================= */}
          {stage === "VERIFIED" && (
            <div className="py-6 text-center space-y-3">
              <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Verified Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setting up your secure session and redirecting to your dashboard...
              </p>
              <div className="flex justify-center pt-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#25D366]" />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STAGE 4: EXPIRED                                          */}
          {/* ========================================================= */}
          {stage === "EXPIRED" && (
            <div className="py-4 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Verification Expired
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  For your security, WhatsApp login challenges expire after 5
                  minutes. Click below to generate a fresh 1-click login.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleStartAuth()}
                className="w-full h-11 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* STAGE 5: ERROR                                            */}
          {/* ========================================================= */}
          {stage === "ERROR" && (
            <div className="py-4 text-center space-y-4">
              <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Authentication Failed
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-xs mx-auto">
                  {errorMessage || "An unexpected error occurred during login."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStage("PHONE_INPUT");
                  setErrorMessage(null);
                }}
                className="w-full h-11 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Return to Phone Entry</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-2xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span>Powered by</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              ParaLearn Auth
            </span>
          </div>
          <span className="font-mono">End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
}
