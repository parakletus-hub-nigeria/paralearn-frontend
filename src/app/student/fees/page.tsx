"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { StudentHeader } from "@/components/Student/StudentHeader";
import {
  Lock,
  Loader2,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import {
  useGetMyInvoicesQuery,
  useInitializePaystackPaymentMutation,
  InvoiceRecord,
} from "@/reduxToolKit/api/endpoints/finance";
import { cn } from "@/lib/utils";

const fmtKobo = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  PARTIAL: "bg-orange-100 text-orange-800 border-orange-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  WAIVED: "bg-slate-100 text-slate-700 border-slate-200",
  OVERRIDDEN: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function StudentFeesPage() {
  const { data: rawData, isLoading, isFetching, refetch } = useGetMyInvoicesQuery();
  const [initPaystack, { isLoading: isInitializing }] = useInitializePaystackPaymentMutation();
  const invoices: InvoiceRecord[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.data)
      ? (rawData as any).data
      : [];

  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const totalFees = invoices.reduce((s: number, i: InvoiceRecord) => s + (i.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((s: number, i: InvoiceRecord) => s + (i.amountPaid || 0), 0);
  const totalBalance = totalFees - totalPaid;
  const hasUnpaid = invoices.some((i: InvoiceRecord) => i.status !== "PAID" && !i.adminOverride);
  const hasActiveOverride = invoices.some((i: InvoiceRecord) => i.adminOverride);

  const handlePay = async (invoice: InvoiceRecord) => {
    setPayingInvoiceId(invoice.id);
    try {
      const res = await initPaystack({ invoiceId: invoice.id }).unwrap();
      if (res?.authorizationUrl) {
        toast.info("Redirecting to secure Paystack payment gateway...");
        window.location.href = res.authorizationUrl;
      } else {
        toast.error("Could not obtain payment link from gateway. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to initialize payment checkout");
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedInvoiceId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <StudentHeader />
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentHeader />
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="sm" asChild className="gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground -ml-2">
                <Link href="/student/dashboard">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My School Fees &amp; Billing</h1>
            <p className="text-sm text-muted-foreground">
              View term invoices, itemized fee breakdowns, payment records, and pay online securely.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 h-9 text-xs self-start sm:self-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

      {/* Paywall Alert or Exemption Banner */}
      {hasUnpaid ? (
        <div className="flex items-start gap-3.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4.5 text-amber-900 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm text-amber-950">Report Card Access is Locked</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your terminal academic report cards are locked pending full fee settlement for this term.
              Outstanding balance: <strong className="font-mono">{fmtKobo(totalBalance)}</strong>. Complete your payment below to unlock instant access.
            </p>
          </div>
        </div>
      ) : hasActiveOverride ? (
        <div className="flex items-start gap-3.5 rounded-2xl border border-purple-200 bg-purple-50/80 p-4.5 text-purple-900 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-purple-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-sm text-purple-950">Administrative Exemption Active</p>
            <p className="text-xs text-purple-800 leading-relaxed">
              Your report cards are unlocked via an official administrative fee waiver or scholarship exemption.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 shadow-2xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">All School Fees Cleared</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              You have no outstanding fee balance. Your terminal report cards are fully unlocked.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Billed Fees", value: totalFees, color: "text-slate-900", icon: Receipt },
          { label: "Total Amount Paid", value: totalPaid, color: "text-emerald-700", icon: CheckCircle2 },
          {
            label: "Outstanding Balance",
            value: totalBalance,
            color: totalBalance > 0 ? "text-rose-600" : "text-emerald-700",
            icon: totalBalance > 0 ? AlertCircle : CheckCircle2,
          },
        ].map((s) => (
          <Card key={s.label} className="border-border shadow-xs">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{s.label}</span>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={cn("text-2xl font-bold font-mono", s.color)}>{fmtKobo(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoices List with Itemized Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Termly Fee Invoices</h2>
          <span className="text-xs text-muted-foreground">{invoices.length} Invoices</span>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No fee invoices have been issued to your account yet.
            </CardContent>
          </Card>
        ) : (
          invoices.map((inv: InvoiceRecord) => {
            const balanceKobo = inv.totalAmount - inv.amountPaid;
            const isExpanded = expandedInvoiceId === inv.id;
            const isPaying = payingInvoiceId === inv.id;

            return (
              <Card key={inv.id} className="border-border shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base text-slate-900">
                        {inv.termName || "Academic Term"} Invoice
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border",
                          STATUS_STYLES[inv.status] || "bg-gray-100 text-gray-800"
                        )}
                      >
                        {inv.status}
                      </span>
                      {inv.adminOverride && (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                          <ShieldCheck className="h-3 w-3" /> Exemption Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Invoice Ref: {inv.id} &bull; Due:{" "}
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-NG") : "End of Term"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p
                        className={cn(
                          "text-lg font-bold font-mono",
                          balanceKobo > 0 ? "text-rose-600" : "text-emerald-700"
                        )}
                      >
                        {fmtKobo(balanceKobo)}
                      </p>
                    </div>

                    {inv.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4" /> Paid
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handlePay(inv)}
                        disabled={isPaying || isInitializing}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        {isPaying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Pay Now via Paystack
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(inv.id)}
                      className="h-8 w-8 text-slate-500"
                      title="View Breakdown"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Itemized Fee Items and Payment History */}
                {isExpanded && (
                  <div className="border-t bg-slate-50/70 p-4 sm:p-5 space-y-4">
                    {/* Itemized breakdown */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                        Fee Breakdown Items
                      </p>
                      {inv.items && inv.items.length > 0 ? (
                        <div className="bg-white rounded-xl border divide-y text-xs">
                          {inv.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3">
                              <span className="text-slate-800 font-medium">{item.description}</span>
                              <span className="font-mono font-semibold text-slate-900">{fmtKobo(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border p-3 text-xs flex justify-between">
                          <span className="text-slate-700">Composite Term Fee</span>
                          <span className="font-mono font-semibold">{fmtKobo(inv.totalAmount)}</span>
                        </div>
                      )}
                    </div>

                    {/* Past Payments History */}
                    {inv.payments && inv.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                          Payment History
                        </p>
                        <div className="bg-white rounded-xl border divide-y text-xs">
                          {inv.payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-3">
                              <div>
                                <p className="font-medium text-slate-900">
                                  {p.method} Payment &bull; <span className="font-mono text-muted-foreground">{p.reference}</span>
                                </p>
                                <p className="text-2xs text-muted-foreground">
                                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-NG", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }) : "-"}
                                </p>
                              </div>
                              <span className="font-mono font-bold text-emerald-700">{fmtKobo(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
