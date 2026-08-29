"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Loader2, History } from "lucide-react";
import SignatureBadge from "@/components/finance/SignatureBadge";
import { useSignReportCardMutation } from "@/reduxToolKit/api/endpoints/reports";
import { ReportAuditTrailModal } from "./ReportAuditTrailModal";

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
  const [auditTrailOpen, setAuditTrailOpen] = useState(false);

  const [signReportCard, { isLoading: isSigning }] = useSignReportCardMutation();

  const handleSign = async () => {
    try {
      await signReportCard({
        reportCardId,
        role,
        remarks: remarks.trim() || undefined,
      }).unwrap();

      toast.success(`Report card signed as ${role}`);
      onSignedSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to sign report card");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Digital Sign-off &amp; Authentication
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuditTrailOpen(true)}
                className="h-8 text-2xs gap-1 text-primary"
              >
                <History className="h-3.5 w-3.5" />
                Audit Trail
              </Button>
            </div>
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
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Apply Your Signature
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Signing Role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Subject Teacher">Subject Teacher</SelectItem>
                    <SelectItem value="Class Teacher">Class Teacher (Submission)</SelectItem>
                    <SelectItem value="Principal">Principal (Final Approval)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sign-off Remarks (Optional)</Label>
                <Textarea
                  placeholder="e.g. Excellent conduct and remarkable academic performance this term."
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSign} disabled={isSigning} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSigning && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign &amp; Authenticate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Modal */}
      <ReportAuditTrailModal
        open={auditTrailOpen}
        onOpenChange={setAuditTrailOpen}
        reportCardId={reportCardId}
        studentName={studentName}
      />
    </>
  );
}
