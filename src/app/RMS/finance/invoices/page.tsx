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
  CreditCard,
  AlertTriangle,
  Eye,
  User,
  Calendar,
  Building,
  DollarSign,
} from "lucide-react";
import {
  useGetInvoicesQuery,
  useGenerateInvoicesMutation,
  useRecordManualPaymentMutation,
  useApplyFeeOverrideMutation,
  useRevokeFeeOverrideMutation,
  InvoiceRecord,
} from "@/reduxToolKit/api/endpoints/finance";
import { cn } from "@/lib/utils";

const fmtKobo = (kobo: number) =>
  "\u20a6" + ((kobo || 0) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

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

  // View invoice details modal
  const [viewOpen, setViewOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<InvoiceRecord | null>(null);

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

      const createdMsg = res.generated > 0 ? (res.generated + " created") : "";
      const updatedMsg = res.updated > 0 ? (res.updated + " updated") : "";
      const summary = [createdMsg, updatedMsg].filter(Boolean).join(", ");

      toast.success(
        summary
          ? "Invoices processed: " + summary + " (" + (res.skipped || 0) + " skipped)"
          : "Invoices up to date (" + (res.skipped || 0) + " skipped)"
      );
      setGenOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to generate invoices");
    }
  };

  const openViewModal = (invoice: InvoiceRecord) => {
    setViewInvoice(invoice);
    setViewOpen(true);
  };

  const openPaymentModal = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    const balance = invoice.totalAmount - invoice.amountPaid;
    setPayForm({
      invoiceId: invoice.id,
      amountNaira: String(Math.max(0, balance / 100)),
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

      setReceiptReference(res.reference || ("REC-" + Date.now().toString().slice(-6)));
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
                    <TableRow key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell>
                        <p className="font-medium text-sm text-slate-900">{inv.studentName || "Student"}</p>
                        {inv.studentEmail && (
                          <p className="text-xs text-muted-foreground">{inv.studentEmail}</p>
                        )}
                        {inv.adminOverride && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-purple-700 font-semibold">
                            <ShieldCheck className="h-3.5 w-3.5" /> Exemption Active
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">
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
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openViewModal(inv)}
                            className="h-8 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 gap-1"
                            title="View Invoice Breakdown"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>

                          {inv.status !== "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPaymentModal(inv)}
                              className="gap-1 h-8 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
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

      {/* View Invoice Details Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span className="text-lg font-bold text-slate-900">Invoice Details</span>
              {viewInvoice && (
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    STATUS_STYLES[viewInvoice.status] || "bg-gray-100 text-gray-800"
                  )}
                >
                  {viewInvoice.status}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewInvoice && (
            <div className="space-y-5 pt-2">
              {/* Student & Term Info Grid */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">Student Name</span>
                  <p className="text-slate-900 font-semibold text-sm mt-0.5">{viewInvoice.studentName || "Student"}</p>
                  {viewInvoice.studentEmail && (
                    <p className="text-muted-foreground">{viewInvoice.studentEmail}</p>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Class &amp; Level</span>
                  <p className="text-slate-900 font-semibold text-sm mt-0.5">{viewInvoice.className || "School-wide"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Academic Term</span>
                  <p className="text-slate-700 font-medium mt-0.5">{viewInvoice.termName || "Current Term"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Due Date</span>
                  <p className="text-slate-700 font-medium mt-0.5">
                    {viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString("en-NG") : "Not specified"}
                  </p>
                </div>
              </div>

              {/* Line Items Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Itemized Fee Breakdown
                </h4>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2.5 px-3 text-left font-medium">Description</th>
                        <th className="py-2.5 px-3 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewInvoice.items && viewInvoice.items.length > 0 ? (
                        viewInvoice.items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td className="py-2.5 px-3 text-slate-800 font-medium">{item.description}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {fmtKobo(item.amount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-slate-400">
                            No individual line items
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-700">Total Billed</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {fmtKobo(viewInvoice.totalAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 text-emerald-700">Amount Paid</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                          {fmtKobo(viewInvoice.amountPaid)}
                        </td>
                      </tr>
                      <tr className="border-t border-slate-200">
                        <td className="py-2.5 px-3 text-slate-900 font-bold">Outstanding Balance</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          {fmtKobo(viewInvoice.totalAmount - viewInvoice.amountPaid)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Payment History */}
              {viewInvoice.payments && viewInvoice.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Payment Receipts
                  </h4>
                  <div className="space-y-1.5">
                    {viewInvoice.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{p.method}</span>
                            <span className="text-2xs font-mono text-slate-500">{p.reference}</span>
                          </div>
                          <p className="text-2xs text-muted-foreground mt-0.5">
                            {p.paidAt ? new Date(p.paidAt).toLocaleString("en-NG") : "Recorded"}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          +{fmtKobo(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Override Banner */}
              {viewInvoice.adminOverride && (
                <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-purple-700" />
                    <span>Administrative Paywall Exemption Active</span>
                  </div>
                  <p className="text-purple-700">
                    Reason: {viewInvoice.overrideReason || "Granted by Bursary/Administration"}
                  </p>
                  {viewInvoice.overrideAdminName && (
                    <p className="text-2xs text-purple-600">
                      Authorized by: {viewInvoice.overrideAdminName}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>
              Close
            </Button>
            {viewInvoice && viewInvoice.status !== "PAID" && (
              <Button
                size="sm"
                onClick={() => {
                  setViewOpen(false);
                  openPaymentModal(viewInvoice);
                }}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invoices Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Batch Invoices</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              This generates or synchronizes termly billing invoices for all enrolled students matching active fee structures. Existing payments are preserved.
            </p>

            <div className="space-y-2">
              <Label className="text-xs">Academic Term</Label>
              <Select
                value={genForm.termId || activeTermId}
                onValueChange={(val) => setGenForm((p) => ({ ...p, termId: val }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.flatMap((s: any) =>
                    s.terms?.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {s.session} - {t.term} {t.isActive ? "(Current Active)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Target Class (Optional)</Label>
              <Select
                value={genForm.classId}
                onValueChange={(val) => setGenForm((p) => ({ ...p, classId: val }))}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes (Entire School)</SelectItem>
                  {classes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Payment Due Date (Optional)</Label>
              <Input
                type="date"
                value={genForm.dueDate}
                onChange={(e) => setGenForm((p) => ({ ...p, dueDate: e.target.value }))}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Generate Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Payment Dialog */}
      <Dialog
        open={payOpen}
        onOpenChange={(val) => {
          setPayOpen(val);
          if (!val) setReceiptReference("");
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
              <p className="font-bold text-slate-900 text-lg">Payment Confirmed</p>
              <p className="text-xs text-muted-foreground">
                Payment receipt has been generated and the invoice balance has been updated.
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border font-mono text-xs text-slate-700">
                Ref: {receiptReference}
              </div>
              <Button size="sm" className="w-full" onClick={() => setPayOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {selectedInvoice && (
                <div className="p-3 rounded-lg bg-slate-50 border text-xs space-y-1">
                  <p className="font-semibold text-slate-900">
                    Student: {selectedInvoice.studentName}
                  </p>
                  <p className="text-muted-foreground">
                    Total: {fmtKobo(selectedInvoice.totalAmount)} | Paid:{" "}
                    {fmtKobo(selectedInvoice.amountPaid)}
                  </p>
                  <p className="font-bold text-rose-600">
                    Balance: {fmtKobo(selectedInvoice.totalAmount - selectedInvoice.amountPaid)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={payForm.method}
                  onValueChange={(val: any) => setPayForm((p) => ({ ...p, method: val }))}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POS">POS Terminal</SelectItem>
                    <SelectItem value="CASH">Cash at Bursary</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Direct Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Amount Paid (NGN)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={payForm.amountNaira}
                  onChange={(e) => setPayForm((p) => ({ ...p, amountNaira: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Payment Note / Bank Ref (Optional)</Label>
                <Input
                  placeholder="e.g. Stanbic Transfer / POS Slip #12345"
                  value={payForm.note}
                  onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPayOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleRecordPayment} disabled={isRecording}>
                  {isRecording ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Confirm &amp; Issue Receipt
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Fee Override Modal */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-purple-700" />
              Paywall Exemption Override
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Granting an exemption allows the student to view, download, and receive report cards even if their fees are unpaid. The underlying financial debt remains on record.
            </p>

            {selectedOverrideInvoice && (
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs space-y-1">
                <p className="font-semibold text-purple-950">
                  Student: {selectedOverrideInvoice.studentName}
                </p>
                <p className="text-purple-800">
                  Current Status: {selectedOverrideInvoice.status} | Outstanding:{" "}
                  {fmtKobo(selectedOverrideInvoice.totalAmount - selectedOverrideInvoice.amountPaid)}
                </p>
                {selectedOverrideInvoice.adminOverride && (
                  <div className="flex items-center gap-2 text-purple-900 font-semibold pt-1">
                    <CheckCircle2 className="h-4 w-4 text-purple-700" />
                    Exemption currently ACTIVE
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">
                Official Justification / Reason <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Scholarship recipient / Approved by Principal"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            {selectedOverrideInvoice?.adminOverride ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeOverride}
                disabled={isRevokingOverride}
                className="gap-1 text-xs"
              >
                {isRevokingOverride ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                <ShieldX className="h-3.5 w-3.5" /> Revoke Exemption
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOverrideOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyOverride}
                disabled={isApplyingOverride}
                className="gap-1 text-xs bg-purple-700 hover:bg-purple-800 text-white"
              >
                {isApplyingOverride ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                <ShieldCheck className="h-3.5 w-3.5" /> Grant Exemption
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
