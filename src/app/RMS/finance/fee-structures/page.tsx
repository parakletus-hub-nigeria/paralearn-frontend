"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";

type FeeType = "TUITION" | "PTA_LEVY" | "DEVELOPMENT_LEVY" | "OTHER";

interface FeeStructure {
  id: string;
  name: string;
  type: FeeType;
  amount: number; // kobo
  className?: string;
  classId?: string;
  description?: string;
  term?: string;
}

interface ClassItem { id: string; name: string; }

const FEE_TYPE_LABELS: Record<FeeType, string> = {
  TUITION: "Tuition",
  PTA_LEVY: "PTA Levy",
  DEVELOPMENT_LEVY: "Development Levy",
  OTHER: "Other",
};

const FEE_TYPE_COLORS: Record<FeeType, string> = {
  TUITION: "bg-blue-100 text-blue-800",
  PTA_LEVY: "bg-green-100 text-green-800",
  DEVELOPMENT_LEVY: "bg-purple-100 text-purple-800",
  OTHER: "bg-gray-100 text-gray-800",
};

const fmt = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const EMPTY_FORM = { name: "", type: "TUITION" as FeeType, amount: "", classId: "", description: "" };

export default function FeeStructuresPage() {
  const [list, setList] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    try {
      const [feesRes, classesRes] = await Promise.all([
        apiClient.get("/fees/fee-structures"),
        apiClient.get("/classes"),
      ]);
      setList(feesRes.data?.data ?? feesRes.data ?? []);
      setClasses(classesRes.data?.data ?? classesRes.data ?? []);
    } catch {
      toast.error("Failed to load fee structures");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (f: FeeStructure) => {
    setEditing(f);
    setForm({ name: f.name, type: f.type, amount: String(f.amount / 100), classId: f.classId ?? "", description: f.description ?? "" });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) return toast.error("Name and amount are required");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        amount: Math.round(parseFloat(form.amount) * 100),
        classId: form.classId || undefined,
        description: form.description || undefined,
      };
      if (editing) {
        await apiClient.patch(`/fees/fee-structures/${editing.id}`, payload);
        toast.success("Fee structure updated");
      } else {
        await apiClient.post("/fees/fee-structures", payload);
        toast.success("Fee structure created");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this fee structure? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/fees/fee-structures/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fee Structures</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Fee Structure
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No fee structures yet. Click &quot;New Fee Structure&quot; to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${FEE_TYPE_COLORS[f.type]}`}>
                        {FEE_TYPE_LABELS[f.type]}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{fmt(f.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.className ?? "All Classes"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Fee Structure" : "New Fee Structure"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="e.g. 2025/2026 First Term Tuition" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as FeeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TUITION">Tuition</SelectItem>
                  <SelectItem value="PTA_LEVY">PTA Levy</SelectItem>
                  <SelectItem value="DEVELOPMENT_LEVY">Development Levy</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount (Naira)</Label>
              <Input type="number" min={0} placeholder="50000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Class (optional — leave blank for all classes)</Label>
              <Select value={form.classId || "all"} onValueChange={(v) => setForm({ ...form, classId: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Additional details..." rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
