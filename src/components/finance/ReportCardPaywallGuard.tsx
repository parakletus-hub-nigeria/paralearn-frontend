"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CreditCard, ShieldCheck, ArrowRight } from "lucide-react";
import apiClient from "@/lib/api";
import { routespath } from "@/lib/routepath";
import { cn } from "@/lib/utils";

export interface PaywallData {
  studentId?: string;
  term?: string;
  session?: string;
  invoiceId?: string;
  totalAmount?: number;
  amountPaid?: number;
  outstandingBalance?: number;
  formattedBalance?: string;
  paymentUrl?: string;
  adminOverride?: boolean;
  overrideReason?: string;
}

interface Props {
  children: React.ReactNode;
  /** Pass true to bypass the gate entirely (e.g. admin/staff preview) */
  adminOverride?: boolean;
  /** Optional override reason for audit banner */
  overrideReason?: string;
  /** If you already know the cleared status, pass it directly to skip the API call */
  isCleared?: boolean;
  /** Pass structured paywall error data caught from an HTTP 402 response */
  paywallData?: PaywallData | null;
  /** Optional custom class name for the wrapper */
  className?: string;
}

const fmtKobo = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

export default function ReportCardPaywallGuard({
  children,
  adminOverride: propAdminOverride,
  overrideReason: propOverrideReason,
  isCleared,
  paywallData,
  className,
}: Props) {
  const [loading, setLoading] = useState(isCleared === undefined && !paywallData && !propAdminOverride);
  const [cleared, setCleared] = useState(isCleared ?? false);
  const [activeOverride, setActiveOverride] = useState(propAdminOverride ?? false);
  const [overrideReason, setOverrideReason] = useState(propOverrideReason ?? "");
  const [balance, setBalance] = useState(0);
  const [formattedBalance, setFormattedBalance] = useState("");
  const [termLabel, setTermLabel] = useState("");
  const [paymentUrl, setPaymentUrl] = useState(routespath.STUDENT_FEES || "/student/fees");

  useEffect(() => {
    // 1. If explicit paywall data passed from an HTTP 402 error
    if (paywallData) {
      if (paywallData.adminOverride) {
        setActiveOverride(true);
        setOverrideReason(paywallData.overrideReason || "Administrative Exemption Active");
        setCleared(true);
      } else {
        setCleared(false);
        setBalance(paywallData.outstandingBalance || (paywallData.totalAmount || 0) - (paywallData.amountPaid || 0));
        setFormattedBalance(paywallData.formattedBalance || fmtKobo(paywallData.outstandingBalance || 0));
        setTermLabel(paywallData.term ? `${paywallData.term} ${paywallData.session || ""}`.trim() : "");
        if (paywallData.paymentUrl) setPaymentUrl(paywallData.paymentUrl);
      }
      setLoading(false);
      return;
    }

    // 2. If prop overrides passed directly
    if (propAdminOverride) {
      setActiveOverride(true);
      setCleared(true);
      setLoading(false);
      return;
    }

    if (isCleared !== undefined) {
      setCleared(isCleared);
      setLoading(false);
      return;
    }

    // 3. Fallback: Fetch student's fee statement
    apiClient
      .get("/fees/invoices/me")
      .then((r) => {
        const invoices: any[] = r.data?.data ?? r.data ?? [];
        const hasOverride = invoices.some((i: any) => i.adminOverride);
        if (hasOverride) {
          const overrideInv = invoices.find((i: any) => i.adminOverride);
          setActiveOverride(true);
          setOverrideReason(overrideInv?.overrideReason || "Administrative Fee Waiver Active");
          setCleared(true);
        } else {
          const outstanding = invoices.reduce(
            (s: number, i: any) => s + (Math.max(0, (i.totalAmount || 0) - (i.amountPaid || 0))),
            0
          );
          setBalance(outstanding);
          setFormattedBalance(fmtKobo(outstanding));
          setCleared(outstanding === 0);
        }
      })
      .catch((err: any) => {
        // In case of 402 from any sub-call
        if (err?.response?.status === 402) {
          const data = err.response.data?.data;
          setCleared(false);
          setBalance(data?.outstandingBalance || 0);
          setFormattedBalance(data?.formattedBalance || fmtKobo(data?.outstandingBalance || 0));
          setTermLabel(data?.term || "");
          if (data?.paymentUrl) setPaymentUrl(data.paymentUrl);
        } else {
          setCleared(false);
        }
      })
      .finally(() => setLoading(false));
  }, [propAdminOverride, propOverrideReason, isCleared, paywallData]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Active Admin Exemption / Scholarship: Render unlocked report card with discreet banner
  if (activeOverride) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-medium">
          <ShieldCheck className="h-4 w-4 text-purple-600 shrink-0" />
          <span>
            <strong>Official Exemption Active:</strong> {overrideReason || "Report card unlocked by School Administration"}
          </span>
        </div>
        {children}
      </div>
    );
  }

  // Cleared fees: Render unlocked content directly
  if (cleared) {
    return <>{children}</>;
  }

  // Locked Paywall Screen (HTTP 402 Gate)
  return (
    <div className={cn("relative rounded-2xl overflow-hidden border border-slate-200 bg-white", className)}>
      {/* Blurred background report card content */}
      <div className="pointer-events-none select-none blur-md opacity-30 overflow-hidden max-h-[480px] p-6">
        {children}
      </div>

      {/* Lock Overlay with Glassmorphic Card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-2xl border border-amber-200/80 shadow-2xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          {/* Lock Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Terminal Report Card Locked
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {termLabel
                ? `Fee clearance for ${termLabel} is pending.`
                : "Fee clearance for the current academic term is pending."}
            </p>
          </div>

          {/* Outstanding Balance Banner */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80">
            <p className="text-2xs font-semibold uppercase tracking-wider text-amber-800">
              Outstanding Balance
            </p>
            <p className="text-2xl font-bold font-mono text-rose-600 mt-0.5">
              {formattedBalance || fmtKobo(balance)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              asChild
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-xs"
            >
              <Link href={paymentUrl}>
                <CreditCard className="h-4 w-4" /> Pay Now via Paystack <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-2xs text-muted-foreground">
              Payments are confirmed instantly and your report card will be unlocked immediately upon verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
