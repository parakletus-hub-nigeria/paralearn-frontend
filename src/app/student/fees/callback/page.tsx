"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Receipt } from "lucide-react";
import { StudentHeader } from "@/components/Student/StudentHeader";
import { routespath } from "@/lib/routepath";

type CallbackState = "loading" | "success" | "failed";

function CallbackContent() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) {
      setState("failed");
      setMessage("No transaction reference was found in the payment callback.");
      return;
    }

    apiClient
      .get("/fees/payments/verify", { params: { reference } })
      .then((res) => {
        const data = res.data?.data ?? res.data;
        const status = data?.status || res.data?.status;
        if (status === "success" || status === "SUCCESS" || status === "PAID") {
          setState("success");
        } else {
          setState("failed");
          setMessage(res.data?.message || "Payment verification could not be confirmed.");
        }
      })
      .catch(() => {
        apiClient
          .get(`/fees/payments/verify/${encodeURIComponent(reference)}`)
          .then((res) => {
            const data = res.data?.data ?? res.data;
            const status = data?.status || res.data?.status;
            if (status === "success" || status === "SUCCESS" || status === "PAID") {
              setState("success");
            } else {
              setState("failed");
              setMessage(res.data?.message || "Payment could not be verified.");
            }
          })
          .catch((err: any) => {
            setState("failed");
            setMessage(
              err?.response?.data?.message ||
                "Payment verification failed. If your account was debited, contact your school bursar with the transaction reference.",
            );
          });
      });
  }, [reference]);

  const isSuccess = state === "success";
  const isFailed = state === "failed";
  const iconBg = isSuccess
    ? "var(--emerald-tint)"
    : isFailed
      ? "var(--amber-tint)"
      : "var(--surface-muted)";
  const iconColor = isSuccess
    ? "var(--emerald-signal)"
    : isFailed
      ? "var(--amber-signal)"
      : "var(--violet-ink)";

  return (
    <div className="mx-auto max-w-xl p-6 text-center" style={{ background: "var(--chalk-white)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center" style={{ background: iconBg, color: iconColor, borderRadius: "var(--radius-xl)" }}>
        {state === "loading" ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-8 w-8" />
        ) : (
          <AlertTriangle className="h-8 w-8" />
        )}
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: iconColor }}>
        Payment Verification
      </p>
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
        {state === "loading" ? "Verifying payment" : isSuccess ? "Payment confirmed" : "Verification pending"}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
        {state === "loading"
          ? "We are confirming the transaction with Paystack. Keep this page open."
          : isSuccess
            ? "Your school fee payment has been verified. Report card access has been updated."
            : message}
      </p>

      {reference && (
        <div className="mt-6 p-4 text-left" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
            <Receipt className="h-4 w-4" />
            Transaction reference
          </div>
          <p className="mt-1 truncate text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{reference}</p>
        </div>
      )}

      {state !== "loading" && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={routespath.STUDENT_DASHBOARD}
            className="inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-semibold text-white"
            style={{ background: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
          >
            Student Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={routespath.STUDENT_FEES}
            className="inline-flex h-11 items-center justify-center px-5 text-sm font-semibold"
            style={{ background: "var(--chalk-white)", color: "var(--foreground)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)" }}
          >
            Fee Statement
          </Link>
        </div>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <StudentHeader />
      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--violet-ink)" }} />
            </div>
          }
        >
          <CallbackContent />
        </Suspense>
      </main>
    </div>
  );
}
