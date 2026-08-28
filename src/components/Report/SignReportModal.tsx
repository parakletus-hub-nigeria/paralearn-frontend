"use client";
import { useState } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Loader2 } from "lucide-react";
import SignatureBadge from "@/components/finance/SignatureBadge";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reportCardId: string;
  studentName?: string;
  currentSignatures?: Array<{ signerName: string; role: string; signedAt: string }>;
  checksum?: string;
  isVerified?: boolean;
  onSignedSuccess?: () => void;
}

export function SignReportModal({
  open,
  onOpenChange,
  reportCardId,
  studentName,
  currentSignatures = [],
  checksum = "",
  isVerified = false,
  onSignedSuccess,
}: Props) {
  const [role, setRole] = useState<"Subject Teacher" | "Class Teacher" | "Principal">("Class Teacher");
  const [remarks, setRemarks] = useState("");
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    setSigning(true);
    try {
      await apiClient.post(`/reports/report-cards/${reportCardId}/sign`, {
        role,
        remarks: remarks || undefined,
      });
      toast.success(`Report card signed as ${role}`);
      onSignedSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to sign report card");
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Digital Sign-off &amp; Authentication
          </DialogTitle>
          {studentName && (
            <p className="text-xs text-muted-foreground">Student: {studentName}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Signatures status */}
          <SignatureBadge
            signatures={currentSignatures}
            checksum={checksum}
            isVerified={isVerified}
          />

          {/* Sign Action */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-semibold text-foreground">Sign as:</p>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Subject Teacher">Subject Teacher</SelectItem>
                <SelectItem value="Class Teacher">Class Teacher</SelectItem>
                <SelectItem value="Principal">Principal (Final Approval)</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sign-off Remarks (Optional)</Label>
              <Textarea
                placeholder="e.g. Good academic progress this term."
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSign} disabled={signing} className="gap-2">
            {signing && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign &amp; Authenticate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
