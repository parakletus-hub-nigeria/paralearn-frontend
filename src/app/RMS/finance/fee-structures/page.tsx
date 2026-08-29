"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { RootState } from "@/reduxToolKit/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Loader2, Banknote, CheckCircle, RefreshCw } from "lucide-react";
import {
  useGetFeeStructuresQuery,
  useCreateFeeStructureMutation,
  FeeStructureItem,
} from "@/reduxToolKit/api/endpoints/finance";

type FeeType = "TUITION" | "PTA_LEVY" | "DEVELOPMENT_LEVY" | "OTHER";

const FEE_TYPE_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  PTA_LEVY: "PTA Levy",
  DEVELOPMENT_LEVY: "Development Levy",
  OTHER: "Other",
};

const FEE_TYPE_COLORS: Record<string, string> = {
  TUITION: "bg-blue-100 text-blue-800 border-blue-200",
  PTA_LEVY: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DEVELOPMENT_LEVY: "bg-purple-100 text-purple-800 border-purple-200",
  OTHER: "bg-gray-100 text-gray-800 border-gray-200",
};

const fmtKobo = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

export default function FeeStructuresPage() {
  const { classes } = useSelector((s: RootState) => s.admin);
  const currentSession = useSelector((s: RootState) => s.setUp.currentSession);
  const sessions = useSelector((s: RootState) => s.setUp.sessions);

  const [termFilter, setTermFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const activeTermId = currentSession?.termDetails?.id || "";

  const [form, setForm] = useState({
    name: "",
    type: "TUITION" as FeeType,
    amountNaira: "",
    classLevel: "all",
    termId: activeTermId,
  });

  useEffect(() => {
    if (activeTermId && !form.termId) {
      setForm((prev) => ({ ...prev, termId: activeTermId }));
    }
  }, [activeTermId, form.termId]);

  const { data: feeStructures = [], isLoading, isFetching, refetch } = useGetFeeStructuresQuery(
    termFilter !== "all" ? { termId: termFilter } : undefined
  );

  const [createFeeStructure, { isLoading: isCreating }] = useCreateFeeStructureMutation();

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error("Please enter a fee name");
    if (!form.amountNaira || isNaN(Number(form.amountNaira)) || Number(form.amountNaira) <= 0) {
      return toast.error("Please enter a valid amount in Naira");
    }
    if (!form.termId) {
      return toast.error("Please select an academic term");
    }

    try {
      const amountKobo = Math.round(parseFloat(form.amountNaira) * 100);
      await createFeeStructure({
        termId: form.termId,
        name: form.name.trim(),
        classLevel: form.classLevel === "all" ? undefined : form.classLevel,
        amount: amountKobo,
        type: form.type,
        isActive: true,
      }).unwrap();

      toast.success("Fee structure created successfully");
      setOpen(false);
      setForm({
        name: "",
        type: "TUITION",
        amountNaira: "",
        classLevel: "all",
        termId: activeTermId,
      });
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to create fee structure");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee Structures</h1>
          <p className="text-sm text-muted-foreground">
            Define termly billing items (Tuition, PTA, Development Levies) applied during invoice generation.
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
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>

          <Button onClick={() => setOpen(true)} className="gap-1.5 h-9 text-xs">
            <Plus className="h-4 w-4" /> New Fee Structure
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : feeStructures.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Banknote className="h-6 w-6" />
              </div>
              <p className="font-semibold text-slate-800">No Fee Structures Created Yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Fee structures define mandatory or optional levies billed to students each term. Click below to add one.
              </p>
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 mt-2">
                <Plus className="h-3.5 w-3.5" /> Add Fee Structure
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead>Fee Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Target Class</TableHead>
                  <TableHead className="text-right">Amount (NGN)</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures.map((f: FeeStructureItem) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium text-slate-900">{f.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border ${
                          FEE_TYPE_COLORS[f.type || "TUITION"] || FEE_TYPE_COLORS.OTHER
                        }`}
                      >
                        {FEE_TYPE_LABELS[f.type || "TUITION"] || f.type || "Tuition"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.classLevel ? (
                        <Badge variant="outline" className="font-mono text-2xs">
                          {f.classLevel}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-600 font-medium">School-wide (All Classes)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900">
                      {fmtKobo(f.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Fee Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fee Title / Name</Label>
              <Input
                placeholder="e.g. First Term Tuition / Science Lab Levy"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as FeeType })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TUITION">Tuition</SelectItem>
                    <SelectItem value="PTA_LEVY">PTA Levy</SelectItem>
                    <SelectItem value="DEVELOPMENT_LEVY">Development Levy</SelectItem>
                    <SelectItem value="OTHER">Other Levy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount in Naira (₦)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="50000"
                  value={form.amountNaira}
                  onChange={(e) => setForm({ ...form, amountNaira: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Class Level (Optional)</Label>
              <Select
                value={form.classLevel}
                onValueChange={(v) => setForm({ ...form, classLevel: v })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">School-wide (All Classes)</SelectItem>
                  {classes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Fee Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
