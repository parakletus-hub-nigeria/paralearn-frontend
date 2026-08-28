"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Loader2, FileText, PlusCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID";

interface Invoice {
  id: string;
  studentName: string;
  className?: string;
  feeStructureName?: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  dueDate?: string;
}

interface FeeStructure { id: string; name: string; }

const fmt = (kobo: number) => "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PARTIAL: "bg-orange-100 text-orange-800",
  PAID:    "bg-green-100 text-green-800",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Generate modal
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ feeStructureId: "", term: "", session: "" });
  const [generating, setGenerating] = useState(false);

  // Manual payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ invoiceId: "", amount: "", method: "CASH", reference: "" });
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (search) params.search = search;
      const res = await apiClient.get("/fees/invoices", { params });
      const data = res.data?.data ?? res.data ?? [];
      setInvoices(Array.isArray(data) ? data : data.invoices ?? []);
      setTotalPages(res.data?.totalPages ?? 1);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient.get("/fees/fee-structures").then((r) => setFeeStructures(r.data?.data ?? r.data ?? []));
  }, []);

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleGenerate = async () => {
    if (!genForm.feeStructureId || !genForm.term || !genForm.session)
      return toast.error("Please fill all fields");
    setGenerating(true);
    try {
      const res = await apiClient.post("/fees/invoices/generate", genForm);
      toast.success(`Generated ${res.data?.count ?? ""} invoices successfully`);
      setGenOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to generate invoices");
    } finally {
      setGenerating(false);
    }
  };

  const handleManualPayment = async () => {
    if (!payForm.invoiceId || !payForm.amount) return toast.error("Invoice ID and amount are required");
    setPaying(true);
    try {
      const res = await apiClient.post("/fees/payments/manual", {
        invoiceId: payForm.invoiceId,
        amount: Math.round(parseFloat(payForm.amount) * 100),
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      setReceipt(res.data?.receiptReference ?? res.data?.reference ?? "MANUAL-XXXX");
      toast.success("Payment recorded successfully");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to record payment");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2">
            <FileText className="h-4 w-4" /> Generate Invoices
          </Button>
          <Button onClick={() => { setReceipt(""); setPayOpen(true); }} className="gap-2">
            <PlusCircle className="h-4 w-4" /> Record Manual Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by student name..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No invoices found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.studentName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.className ?? "-"}</TableCell>
                    <TableCell className="text-sm">{inv.feeStructureName ?? "-"}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Generate Invoices Modal */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Generate Invoices</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Fee Structure</Label>
              <Select value={genForm.feeStructureId} onValueChange={(v) => setGenForm({ ...genForm, feeStructureId: v })}>
                <SelectTrigger><SelectValue placeholder="Select fee structure..." /></SelectTrigger>
                <SelectContent>{feeStructures.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Term</Label>
              <Select value={genForm.term} onValueChange={(v) => setGenForm({ ...genForm, term: v })}>
                <SelectTrigger><SelectValue placeholder="Select term..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">First Term</SelectItem>
                  <SelectItem value="SECOND">Second Term</SelectItem>
                  <SelectItem value="THIRD">Third Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Session (e.g. 2025/2026)</Label>
              <Input placeholder="2025/2026" value={genForm.session} onChange={(e) => setGenForm({ ...genForm, session: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Modal */}
      <Dialog open={payOpen} onOpenChange={(o) => { setPayOpen(o); if (!o) setReceipt(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record Manual Payment</DialogTitle></DialogHeader>
          {receipt ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-lg">Payment Recorded!</p>
              <p className="text-sm text-muted-foreground">Receipt Reference</p>
              <p className="font-mono text-lg font-bold text-primary">{receipt}</p>
              <Button className="w-full" onClick={() => setPayOpen(false)}>Done</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Invoice ID</Label>
                  <Input placeholder="Paste invoice ID..." value={payForm.invoiceId} onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Amount Paid (Naira)</Label>
                  <Input type="number" min={0} placeholder="50000" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Payment Method</Label>
                  <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="POS">POS</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reference / Note (optional)</Label>
                  <Input placeholder="e.g. Teller no. 12345" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                <Button onClick={handleManualPayment} disabled={paying}>
                  {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record Payment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
