"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

type State = "loading" | "success" | "failed";

export default function PaymentCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) { setState("failed"); setMessage("No payment reference found."); return; }
    apiClient.get(`/fees/payments/verify/${reference}`)
      .then((r) => {
        const status = r.data?.status ?? r.data?.data?.status;
        if (status === "success" || status === "PAID") {
          setState("success");
        } else {
          setState("failed");
          setMessage(r.data?.message ?? "Payment could not be confirmed.");
        }
      })
      .catch(() => { setState("failed"); setMessage("Verification failed. Please contact your school bursar."); });
  }, [reference]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        {state === "loading" && (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />
            <p className="text-lg font-semibold">Verifying your payment&hellip;</p>
            <p className="text-sm text-muted-foreground">Please do not close this page.</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-700">Payment Verified!</p>
            <p className="text-sm text-muted-foreground">
              Your payment has been confirmed. Your report card is now unlocked.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild><Link href="/student/fees">View My Fees</Link></Button>
              <Button variant="outline" asChild><Link href="/student/dashboard">Go to Dashboard</Link></Button>
            </div>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-12 w-12 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-yellow-700">Verification Pending</p>
            <p className="text-sm text-muted-foreground">
              {message || "We could not confirm your payment at this time. If you were charged, please contact your school bursar with your reference number."}
            </p>
            {reference && (
              <p className="rounded bg-muted px-3 py-2 font-mono text-sm">Ref: {reference}</p>
            )}
            <Button variant="outline" asChild><Link href="/student/fees">Back to My Fees</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
