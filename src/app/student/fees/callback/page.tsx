"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
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
      setMessage("No transaction reference found in callback.");
      return;
    }

    // Attempt verification via /fees/payments/verify?reference=...
    apiClient
      .get("/fees/payments/verify", { params: { reference } })
      .then((r) => {
        const data = r.data?.data ?? r.data;
        const status = data?.status || r.data?.status;
        if (status === "success" || status === "SUCCESS" || status === "PAID") {
          setState("success");
        } else {
          setState("failed");
          setMessage(r.data?.message || "Payment verification could not be confirmed.");
        }
      })
      .catch(() => {
        // Fallback to path param /fees/payments/verify/:reference
        apiClient
          .get(`/fees/payments/verify/${encodeURIComponent(reference)}`)
          .then((r) => {
            const data = r.data?.data ?? r.data;
            const status = data?.status || r.data?.status;
            if (status === "success" || status === "SUCCESS" || status === "PAID") {
              setState("success");
            } else {
              setState("failed");
              setMessage(r.data?.message || "Payment could not be verified.");
            }
          })
          .catch((err: any) => {
            setState("failed");
            setMessage(
              err?.response?.data?.message ||
                "Payment verification failed. If your bank account was debited, please contact your school bursar with your transaction reference."
            );
          });
      });
  }, [reference]);

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-border shadow-xs text-center space-y-6">
      {state === "loading" && (
        <div className="space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Verifying Your Payment</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Communicating with Paystack gateway... Please do not close or refresh this page.
            </p>
          </div>
          {reference && (
            <p className="font-mono text-2xs bg-slate-100 py-1.5 px-3 rounded-lg text-slate-600 truncate">
              Ref: {reference}
            </p>
          )}
        </div>
      )}

      {state === "success" && (
        <div className="space-y-4 py-2">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">Payment Confirmed!</h1>
            <p className="text-sm text-slate-600 mt-1">
              Your school fee payment has been successfully verified. Your academic report cards are now unlocked.
            </p>
          </div>

          {reference && (
            <div className="p-3 bg-slate-50 rounded-xl border text-xs">
              <span className="text-muted-foreground">Transaction Reference</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{reference}</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-2">
            <Button asChild className="gap-2 bg-emerald-600 hover:bg-emerald-700 font-semibold">
              <Link href={routespath.STUDENT_DASHBOARD}>
                Go to Student Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={routespath.STUDENT_FEES}>View Updated Fee Statement</Link>
            </Button>
          </div>
        </div>
      )}

      {state === "failed" && (
        <div className="space-y-4 py-2">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-9 w-9 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-950">Verification Pending</h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>

          {reference && (
            <div className="p-3 bg-slate-50 rounded-xl border text-xs">
              <span className="text-muted-foreground">Transaction Reference</span>
              <p className="font-mono font-bold text-slate-900 mt-0.5">{reference}</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-2">
            <Button asChild variant="outline">
              <Link href={routespath.STUDENT_FEES}>Back to Fee Portal</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={routespath.STUDENT_DASHBOARD}>Return to Dashboard</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-4 sm:p-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
