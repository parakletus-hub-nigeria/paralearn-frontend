"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Lock, Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID";
interface Invoice {
  id: string;
  feeStructureName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  dueDate?: string;
}

const fmt = (kobo: number) => "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PARTIAL: "bg-orange-100 text-orange-800",
  PAID:    "bg-green-100 text-green-800",
};

export default function StudentFeesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get("/fees/invoices/my-invoices")
      .then((r) => setInvoices(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load fee information"))
      .finally(() => setLoading(false));
  }, []);

  const totalFees    = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid    = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalBalance = invoices.reduce((s, i) => s + i.balance, 0);
  const hasUnpaid    = invoices.some((i) => i.status !== "PAID");

  const handlePay = async (invoice: Invoice) => {
    setPayingId(invoice.id);
    try {
      const res = await apiClient.post("/fees/payments/initialize", { invoiceId: invoice.id });
      const url = res.data?.authorization_url ?? res.data?.data?.authorization_url;
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Could not get payment link. Please try again.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to initialize payment");
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <h1 className="text-2xl font-bold">My Fees</h1>

      {/* Fee Lock Notice */}
      {hasUnpaid && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <Lock className="h-5 w-5 mt-0.5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">Report Cards are Locked</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              Your report cards will be unlocked once full fee payment is received.
              Outstanding balance: <strong>{fmt(totalBalance)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Fees", value: totalFees, color: "text-foreground" },
          { label: "Amount Paid", value: totalPaid, color: "text-green-600" },
          { label: "Outstanding Balance", value: totalBalance, color: totalBalance > 0 ? "text-red-600" : "text-green-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={cn("text-xl font-bold font-mono", s.color)}>{fmt(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No invoices found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.feeStructureName}</TableCell>
                    <TableCell className="font-mono text-sm">{fmt(inv.totalAmount)}</TableCell>
                    <TableCell className="font-mono text-sm text-green-700">{fmt(inv.paidAmount)}</TableCell>
                    <TableCell className={cn("font-mono text-sm", inv.balance > 0 ? "text-red-600" : "text-green-700")}>{fmt(inv.balance)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-NG") : "-"}
                    </TableCell>
                    <TableCell>
                      {inv.status === "PAID" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <Button size="sm" onClick={() => handlePay(inv)} disabled={payingId === inv.id} className="gap-1">
                          {payingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />}
                          Pay Now
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
