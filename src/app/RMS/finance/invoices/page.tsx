"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { RootState, AppDispatch } from "@/reduxToolKit/store";
import { fetchClasses } from "@/reduxToolKit/admin/adminThunks";
import { fetchAllSessions } from "@/reduxToolKit/setUp/setUpThunk";
import { fetchCurrentSession } from "@/reduxToolKit/setUp/setUpSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  FileText,
  Search,
  CheckCircle2,
  Receipt,
  Plus,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  CreditCard,
  AlertTriangle,
  MoreVertical,
  Banknote,
  Percent,
} from "lucide-react";
import {
  useGetInvoicesQuery,
  useGenerateInvoicesMutation,
  useRecordManualPaymentMutation,
  useApplyFeeOverrideMutation,
  useRevokeFeeOverrideMutation,
  InvoiceRecord,
  InvoiceStatus,
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

export default function InvoicesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { classes } = useSelector((s: RootState) => s.admin);
  const currentUser = useSelector((s: RootState) => s.user.user);
  const currentSession = useSelector((s: RootState) => s.setUp.currentSession);
  const sessions = useSelector((s: RootState) => s.setUp.sessions);

  const activeTermId = currentSession?.termDetails?.id || "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("all");

  const queryParams = {
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(classFilter !== "all" ? { classId: classFilter } : {}),
  };

  const { data: invoices = [], isLoading, isFetching, refetch } = useGetInvoicesQuery(queryParams);

  useEffect(() => {
    dispatch(fetchClasses(undefined));
    dispatch(fetchAllSessions());
    dispatch(fetchCurrentSession());
  }, [dispatch]);

  // Generate modal
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    termId: activeTermId,
    classId: "all",
    dueDate: "",
  });
  const [generateInvoices, { isLoading: isGenerating }] = useGenerateInvoicesMutation();

  // Manual payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    invoiceId: "",
    amountNaira: "",
    method: "CASH" as "CASH" | "POS" | "BANK_TRANSFER",
    note: "",
  });
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [recordPayment, { isLoading: isRecording }] = useRecordManualPaymentMutation();
  const [receiptReference, setReceiptReference] = useState("");

  // Override / Exemption Modal
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [selectedOverrideInvoice, setSelectedOverrideInvoice] = useState<InvoiceRecord | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [applyOverride, { isLoading: isApplyingOverride }] = useApplyFeeOverrideMutation();
  const [revokeOverride, { isLoading: isRevokingOverride }] = useRevokeFeeOverrideMutation();

  const filteredInvoices = invoices.filter((inv: InvoiceRecord) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.studentName?.toLowerCase().includes(q) ||
      inv.studentEmail?.toLowerCase().includes(q) ||
      inv.className?.toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q)
    );
  });

  const handleGenerate = async () => {
    if (!genForm.termId && !activeTermId) {
      return toast.error("Please select an academic term");
    }

    try {
      const res = await generateInvoices({
        termId: genForm.termId || activeTermId,
        classId: genForm.classId === "all" ? undefined : genForm.classId,
        dueDate: genForm.dueDate ? new Date(genForm.dueDate).toISOString() : undefined,
      }).unwrap();

      toast.success(`Generated ${res.generated} invoices successfully (${res.skipped} already exist)`);
      setGenOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to generate invoices");
    }
  };

  const openPaymentModal = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    const balance = invoice.totalAmount - invoice.amountPaid;
    setPayForm({
      invoiceId: invoice.id,
      amountNaira: String(balance / 100),
      method: "POS",
      note: "",
    });
    setReceiptReference("");
    setPayOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payForm.invoiceId) return toast.error("Invoice ID is missing");
    if (!payForm.amountNaira || Number(payForm.amountNaira) <= 0) {
      return toast.error("Please enter a valid amount");
    }

    try {
      const amountKobo = Math.round(parseFloat(payForm.amountNaira) * 100);
      const res = await recordPayment({
        invoiceId: payForm.invoiceId,
        amount: amountKobo,
        method: payForm.method,
        note: payForm.note.trim() || undefined,
      }).unwrap();

      setReceiptReference(res.reference || `REC-${Date.now().toString().slice(-6)}`);
      toast.success("Payment recorded successfully");
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to record payment");
    }
  };

  const openOverrideModal = (invoice: InvoiceRecord) => {
    setSelectedOverrideInvoice(invoice);
    setOverrideReason(invoice.overrideReason || "");
    setOverrideOpen(true);
  };

  const handleApplyOverride = async () => {
    if (!selectedOverrideInvoice) return;
    if (!overrideReason.trim()) {
      return toast.error("Please enter an official reason for granting this paywall exemption");
    }

    try {
      const adminName = (currentUser as any)?.name || (currentUser as any)?.firstName || "School Bursar";
      await applyOverride({
        invoiceId: selectedOverrideInvoice.id,
        adminOverride: true,
        overrideReason: overrideReason.trim(),
        adminName,
      }).unwrap();

      toast.success("Paywall exemption granted successfully");
      setOverrideOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to apply fee override");
    }
  };

  const handleRevokeOverride = async () => {
    if (!selectedOverrideInvoice) return;

    try {
      await revokeOverride({ invoiceId: selectedOverrideInvoice.id }).unwrap();
      toast.success("Paywall exemption revoked. Report cards re-locked for outstanding balance.");
      setOverrideOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to revoke fee override");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Invoices &amp; Fee Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate batch student invoices, track settlements, record offline payments, and manage paywall exemptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 h-9 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>

          <Button onClick={() => setGenOpen(true)} className="gap-1.5 h-9 text-xs">
            <Plus className="h-4 w-4" /> Generate Invoices
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student name, email, class, or invoice ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes?.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="Status: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="WAIVED">Waived</SelectItem>
            <SelectItem value="OVERRIDDEN">Overridden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <p className="font-semibold text-slate-800">No Invoices Found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No billing invoices match your current search and filter criteria. Click &quot;Generate Invoices&quot; to issue new ones.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Total Fee</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv: InvoiceRecord) => {
                  const balanceKobo = inv.totalAmount - inv.amountPaid;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <p className="font-medium text-sm text-slate-900">{inv.studentName || "Student"}</p>
                        {inv.studentEmail && (
                          <p className="text-2xs text-muted-foreground">{inv.studentEmail}</p>
                        )}
                        {inv.adminOverride && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-2xs text-purple-700 font-semibold">
                            <ShieldCheck className="h-3 w-3" /> Exemption Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.className || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-slate-900">
                        {fmtKobo(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700">
                        {fmtKobo(inv.amountPaid)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs font-bold",
                          balanceKobo > 0 ? "text-rose-600" : "text-emerald-700"
                        )}
                      >
                        {fmtKobo(balanceKobo)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border",
                            STATUS_STYLES[inv.status] || "bg-gray-100 text-gray-800"
                          )}
                        >
                          {inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-NG") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPaymentModal(inv)}
                              className="gap-1 h-8 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                              title="Record Offline Payment"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openOverrideModal(inv)}
                            className={cn(
                              "h-8 px-2 text-xs font-medium gap-1",
                              inv.adminOverride
                                ? "text-purple-700 hover:bg-purple-50"
                                : "text-slate-600 hover:bg-slate-100"
                            )}
                            title="Manage Paywall Exemption"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {inv.adminOverride ? "Exempt" : "Override"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoices Modal */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Batch Invoices</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Academic Term</Label>
              <Select
                value={genForm.termId || activeTermId}
                onValueChange={(v) => setGenForm({ ...genForm, termId: v })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Current Active Term" />
                </SelectTrigger>
                <SelectContent>
                  {sessions && sessions.length > 0 ? (
                    sessions.flatMap((s: any) =>
                      (s.terms || []).map((t: any) => (
                        <SelectItem key={t.id || t.name} value={t.id || t.name}>
                          {s.session} — {t.name || t.term || "Term"}
                        </SelectItem>
                      ))
                    )
                  ) : activeTermId ? (
                    <SelectItem value={activeTermId}>
                      Current Active Term ({currentSession?.session || "Active Session"})
                    </SelectItem>
                  ) : (
                    <SelectItem value="active_term">Current Active Term</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Class (Optional)</Label>
              <Select
                value={genForm.classId}
                onValueChange={(v) => setGenForm({ ...genForm, classId: v })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="All Enrolled Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Enrolled Classes (School-wide)</SelectItem>
                  {classes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Due Date (Optional)</Label>
              <Input
                type="date"
                value={genForm.dueDate}
                onChange={(e) => setGenForm({ ...genForm, dueDate: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Invoices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Offline Payment Modal */}
      <Dialog
        open={payOpen}
        onOpenChange={(o) => {
          setPayOpen(o);
          if (!o) setReceiptReference("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Offline Payment</DialogTitle>
          </DialogHeader>

          {receiptReference ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="font-bold text-lg text-slate-900">Payment Recorded Successfully!</p>
              <p className="text-xs text-muted-foreground">Official Receipt Reference</p>
              <p className="font-mono text-lg font-bold text-primary">{receiptReference}</p>
              <Button className="w-full mt-2" onClick={() => setPayOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                {selectedInvoice && (
                  <div className="p-3 bg-slate-50 rounded-xl border text-xs space-y-1">
                    <p className="font-semibold text-slate-900">
                      Student: {selectedInvoice.studentName}
                    </p>
                    <p className="text-muted-foreground">
                      Outstanding Balance:{" "}
                      <strong className="text-rose-600">
                        {fmtKobo(selectedInvoice.totalAmount - selectedInvoice.amountPaid)}
                      </strong>
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Amount Received in Naira (₦)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={payForm.amountNaira}
                    onChange={(e) => setPayForm({ ...payForm, amountNaira: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <Select
                    value={payForm.method}
                    onValueChange={(v: any) => setPayForm({ ...payForm, method: v })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POS">POS Terminal</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Direct Bank Transfer</SelectItem>
                      <SelectItem value="CASH">Physical Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Teller No. / Reference Note (Optional)</Label>
                  <Input
                    placeholder="e.g. POS-STANBIC-98765"
                    value={payForm.note}
                    onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPayOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRecordPayment} disabled={isRecording} className="gap-2">
                  {isRecording && <Loader2 className="h-4 w-4 animate-spin" />}
                  Record &amp; Issue Receipt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Administrative Exemption / Override Modal */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Administrative Fee Exemption
            </DialogTitle>
          </DialogHeader>

          {selectedOverrideInvoice && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border space-y-1">
                <p className="font-semibold text-slate-900">
                  Student: {selectedOverrideInvoice.studentName}
                </p>
                <p className="text-muted-foreground">
                  Outstanding Balance:{" "}
                  <strong className="text-rose-600">
                    {fmtKobo(selectedOverrideInvoice.totalAmount - selectedOverrideInvoice.amountPaid)}
                  </strong>{" "}
                  (Debt remains intact on accounting ledger)
                </p>
              </div>

              {selectedOverrideInvoice.adminOverride ? (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
                  <div className="flex items-center gap-2 text-purple-900 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-purple-600" />
                    <span>Exemption is currently ACTIVE</span>
                  </div>
                  <p className="text-purple-800">
                    <strong>Reason:</strong> {selectedOverrideInvoice.overrideReason || "Not specified"}
                  </p>
                  {selectedOverrideInvoice.overrideAdminName && (
                    <p className="text-2xs text-purple-700">
                      Granted by: <strong>{selectedOverrideInvoice.overrideAdminName}</strong> on{" "}
                      {selectedOverrideInvoice.overrideAt
                        ? new Date(selectedOverrideInvoice.overrideAt).toLocaleDateString("en-NG")
                        : "N/A"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground leading-relaxed">
                    Granting an administrative exemption unlocks the student&apos;s terminal report cards without clearing or forgiving the debt on the school ledger.
                  </p>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Exemption / Scholarship Reason (Required)</Label>
                    <Input
                      placeholder="e.g. Full Academic Merit Scholarship / Hardship Exemption"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Close
            </Button>

            {selectedOverrideInvoice?.adminOverride ? (
              <Button
                variant="destructive"
                onClick={handleRevokeOverride}
                disabled={isRevokingOverride}
                className="gap-1.5 text-xs"
              >
                {isRevokingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                Revoke Exemption
              </Button>
            ) : (
              <Button
                onClick={handleApplyOverride}
                disabled={isApplyingOverride}
                className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isApplyingOverride ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Grant Exemption
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
