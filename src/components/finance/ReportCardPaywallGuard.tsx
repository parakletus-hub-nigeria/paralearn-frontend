"use client";
import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  /** Pass true to bypass the gate entirely (e.g. admin/staff preview) */
  adminOverride?: boolean;
  /** If you already know the cleared status, pass it directly to skip the API call */
  isCleared?: boolean;
}

const fmt = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

export default function ReportCardPaywallGuard({ children, adminOverride, isCleared }: Props) {
  const [loading, setLoading]   = useState(isCleared === undefined);
  const [cleared, setCleared]   = useState(isCleared ?? false);
  const [balance, setBalance]   = useState(0);

  useEffect(() => {
    if (adminOverride || isCleared !== undefined) { setLoading(false); return; }
    apiClient.get("/fees/invoices/my-invoices")
      .then((r) => {
        const invoices: any[] = r.data?.data ?? r.data ?? [];
        const outstanding = invoices.reduce((s: number, i: any) => s + (i.balance ?? 0), 0);
        setBalance(outstanding);
        setCleared(outstanding === 0);
      })
      .catch(() => setCleared(false))
      .finally(() => setLoading(false));
  }, [adminOverride, isCleared]);

  if (adminOverride) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cleared) return <>{children}</>;

  return (
    <div className="relative min-h-48">
      {/* Blurred children underneath */}
      <div className="pointer-events-none select-none blur-sm opacity-40 overflow-hidden max-h-64">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/80 backdrop-blur-sm p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <Lock className="h-9 w-9 text-yellow-600" />
        </div>
        <div>
          <p className="text-lg font-bold">Report Card Locked</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Complete your school fee payment to access this report card.
          </p>
          {balance > 0 && (
            <p className="mt-2 font-semibold text-red-600 text-sm">
              Outstanding balance: {fmt(balance)}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/student/fees">Pay Now</Link>
        </Button>
      </div>
    </div>
  );
}
