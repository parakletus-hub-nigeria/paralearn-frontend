"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { StudentHeader } from "@/components/Student/StudentHeader";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Lock,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  InvoiceRecord,
  useGetMyInvoicesQuery,
  useInitializePaystackPaymentMutation,
} from "@/reduxToolKit/api/endpoints/finance";

const fmtKobo = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const getInvoiceStatusStyle = (status: string) => {
  switch (status) {
    case "PAID":
      return { background: "var(--emerald-tint)", color: "var(--emerald-signal)" };
    case "PENDING":
    case "PARTIAL":
      return { background: "var(--amber-tint)", color: "var(--amber-signal)" };
    case "WAIVED":
    case "OVERRIDDEN":
      return { background: "var(--violet-tint)", color: "var(--violet-ink)" };
    default:
      return { background: "var(--surface-muted)", color: "var(--foreground-muted)" };
  }
};

export default function StudentFeesPage() {
  const { data: rawData, isLoading, isFetching, refetch } = useGetMyInvoicesQuery();
  const [initPaystack, { isLoading: isInitializing }] = useInitializePaystackPaymentMutation();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const invoices: InvoiceRecord[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.data)
      ? (rawData as any).data
      : [];

  const totalFees = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + (invoice.amountPaid || 0), 0);
  const totalBalance = Math.max(totalFees - totalPaid, 0);
  const hasUnpaid = invoices.some((invoice) => invoice.status !== "PAID" && !invoice.adminOverride);
  const hasActiveOverride = invoices.some((invoice) => invoice.adminOverride);

  const handlePay = async (invoice: InvoiceRecord) => {
    setPayingInvoiceId(invoice.id);
    try {
      const res = await initPaystack({ invoiceId: invoice.id }).unwrap();
      if (res?.authorizationUrl) {
        toast.info("Opening secure Paystack checkout");
        window.location.href = res.authorizationUrl;
        return;
      }
      toast.error("Payment link was not returned. Please try again.");
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to initialize payment");
    } finally {
      setPayingInvoiceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
        <StudentHeader />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="h-32 animate-pulse" style={{ background: "var(--chalk-white)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)" }} />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse" style={{ background: "var(--chalk-white)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)" }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-muted)" }}>
      <StudentHeader />

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/student/dashboard"
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: "var(--foreground-muted)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--emerald-signal)" }}>
              School Fees
            </p>
            <h1 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl" style={{ color: "var(--foreground)" }}>
              Fees and payments
            </h1>
            <p className="max-w-2xl text-sm md:text-base" style={{ color: "var(--foreground-muted)" }}>
              Review invoices, fee items, payment history, and complete outstanding payments through Paystack.
            </p>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--chalk-white)", color: "var(--foreground)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)" }}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mb-6 flex items-start gap-4 p-5" style={{ background: "var(--chalk-white)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center"
            style={{
              background: hasUnpaid ? "var(--amber-tint)" : hasActiveOverride ? "var(--violet-tint)" : "var(--emerald-tint)",
              color: hasUnpaid ? "var(--amber-signal)" : hasActiveOverride ? "var(--violet-ink)" : "var(--emerald-signal)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            {hasUnpaid ? <Lock className="h-6 w-6" /> : hasActiveOverride ? <ShieldCheck className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              {hasUnpaid ? "Report card access is locked" : hasActiveOverride ? "Administrative exemption active" : "All fees cleared"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
              {hasUnpaid
                ? `Outstanding balance: ${fmtKobo(totalBalance)}. Complete payment to unlock report card access.`
                : hasActiveOverride
                  ? "Your school has unlocked access with an official waiver or scholarship exemption."
                  : "You have no outstanding balance. Your report cards remain available."}
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total billed", value: totalFees, icon: Receipt, tone: "var(--foreground)" },
            { label: "Total paid", value: totalPaid, icon: CheckCircle2, tone: "var(--emerald-signal)" },
            { label: "Outstanding", value: totalBalance, icon: AlertCircle, tone: totalBalance > 0 ? "var(--amber-signal)" : "var(--emerald-signal)" },
          ].map((metric) => (
            <div key={metric.label} className="flex items-center gap-4 p-5" style={{ background: "var(--chalk-white)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex h-12 w-12 items-center justify-center" style={{ background: "var(--surface-muted)", color: metric.tone, borderRadius: "var(--radius-lg)" }}>
                <metric.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>{metric.label}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: metric.tone }}>{fmtKobo(metric.value)}</p>
              </div>
            </div>
          ))}
        </div>

        <section style={{ background: "var(--chalk-white)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border-fine)" }}>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>Invoices</h2>
              <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{invoices.length} record{invoices.length === 1 ? "" : "s"}</p>
            </div>
            <Banknote className="h-5 w-5" style={{ color: "var(--emerald-signal)" }} />
          </div>

          {invoices.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)", borderRadius: "var(--radius-xl)" }}>
                <Receipt className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>No invoices yet</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--foreground-muted)" }}>Your school has not issued a fee invoice to this account.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-fine)" }}>
              {invoices.map((invoice) => {
                const balanceKobo = Math.max(invoice.totalAmount - invoice.amountPaid, 0);
                const isExpanded = expandedInvoiceId === invoice.id;
                const isPaying = payingInvoiceId === invoice.id;
                const statusStyle = getInvoiceStatusStyle(invoice.status);

                return (
                  <article key={invoice.id}>
                    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
                            {invoice.termName || "Academic term"} invoice
                          </h3>
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={statusStyle}>
                            {invoice.status}
                          </span>
                          {invoice.adminOverride && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Exemption
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                          Ref: {invoice.id} • Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-NG") : "End of term"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        <div className="mr-1 text-left lg:text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Outstanding</p>
                          <p className="text-lg font-bold tabular-nums" style={{ color: balanceKobo > 0 ? "var(--amber-signal)" : "var(--emerald-signal)" }}>
                            {fmtKobo(balanceKobo)}
                          </p>
                        </div>

                        {invoice.status === "PAID" || balanceKobo === 0 ? (
                          <span className="inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)", borderRadius: "var(--radius-md)" }}>
                            <CheckCircle2 className="h-4 w-4" />
                            Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePay(invoice)}
                            disabled={isPaying || isInitializing}
                            className="inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ background: "var(--emerald-signal)", borderRadius: "var(--radius-md)", border: "none" }}
                          >
                            {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                            Pay with Paystack
                          </button>
                        )}

                        <button
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.id)}
                          className="flex h-10 w-10 items-center justify-center"
                          style={{ background: "var(--surface-muted)", color: "var(--foreground)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)" }}
                          title={isExpanded ? "Hide breakdown" : "View breakdown"}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
                        <div className="p-4" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>Fee breakdown</p>
                          <div className="space-y-2">
                            {(invoice.items?.length ? invoice.items : [{ id: "composite", description: "Composite term fee", amount: invoice.totalAmount }]).map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                                <span style={{ color: "var(--foreground-muted)" }}>{item.description}</span>
                                <span className="font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>{fmtKobo(item.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-4" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)" }}>
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>Payment history</p>
                          {invoice.payments?.length ? (
                            <div className="space-y-3">
                              {invoice.payments.map((payment) => (
                                <div key={payment.id} className="flex items-start justify-between gap-4 text-sm">
                                  <div>
                                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{payment.method} payment</p>
                                    <p className="text-xs tabular-nums" style={{ color: "var(--foreground-muted)" }}>
                                      {payment.reference} • {payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-NG") : "Date unavailable"}
                                    </p>
                                  </div>
                                  <span className="font-bold tabular-nums" style={{ color: "var(--emerald-signal)" }}>{fmtKobo(payment.amount)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No payment has been recorded for this invoice.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
