"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { RootState } from "@/reduxToolKit/store";
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
import { MessageCircle, Mail, Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useBulkShareReportsMutation } from "@/reduxToolKit/api/endpoints/reports";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  selectedStudentIds?: string[];
  classId?: string;
  className?: string;
}

export function BulkShareReportModal({
  open,
  onOpenChange,
  selectedStudentIds = [],
  classId,
  className,
}: Props) {
  const currentSession = useSelector((s: RootState) => s.setUp.currentSession);
  const sessions = useSelector((s: RootState) => s.setUp.sessions);
  const classes = useSelector((s: RootState) => s.admin.classes);

  const activeTerm = currentSession?.termDetails?.term || "First Term";
  const activeSessionName = currentSession?.sessionDetails?.session || "2025/2026";

  const [term, setTerm] = useState(activeTerm);
  const [sessionName, setSessionName] = useState(activeSessionName);
  const [targetClass, setTargetClass] = useState(classId || "all");
  const [queuedResult, setQueuedResult] = useState<{
    queued: number;
    skipped: number;
    jobIds: string[];
  } | null>(null);

  const [bulkShare, { isLoading: isDispatching }] = useBulkShareReportsMutation();

  const handleBulkDispatch = async () => {
    // If specific student IDs passed, use them; otherwise, get students in target class or all
    let studentIdsToSend = selectedStudentIds;

    if (studentIdsToSend.length === 0) {
      const targetClassObj: any = classes?.find((c: any) => c.id === targetClass);
      if (targetClassObj?.students && targetClassObj.students.length > 0) {
        studentIdsToSend = targetClassObj.students.map((s: any) => s.id || s._id);
      }
    }

    if (studentIdsToSend.length === 0 && targetClass !== "all") {
      return toast.error("No enrolled students found in the selected class");
    }

    try {
      const res = await bulkShare({
        studentIds: studentIdsToSend.length > 0 ? studentIdsToSend : ["ALL_ENROLLED"],
        term,
        session: sessionName,
      }).unwrap();

      setQueuedResult(res.data || { queued: studentIdsToSend.length, skipped: 0, jobIds: [] });
      toast.success(res.message || "Bulk report card dispatch queued successfully");
    } catch (e: any) {
      toast.error(e?.data?.message || e?.message || "Failed to dispatch bulk reports");
    }
  };

  const handleClose = () => {
    setQueuedResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5 text-primary" />
            Bulk Multi-Channel Report Dispatch
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Dispatches WhatsApp templates with verified links and PDF email attachments to parents.
          </p>
        </DialogHeader>

        {queuedResult ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-lg text-slate-900">Dispatch Queued Successfully!</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Asynchronous BullMQ background workers are actively delivering reports to parent WhatsApp numbers and email inboxes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-2xs text-emerald-800 font-semibold uppercase">Queued Jobs</p>
                <p className="text-2xl font-extrabold text-emerald-900 font-mono mt-0.5">
                  {queuedResult.queued}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <p className="text-2xs text-muted-foreground font-semibold uppercase">Skipped</p>
                <p className="text-2xl font-extrabold text-slate-700 font-mono mt-0.5">
                  {queuedResult.skipped}
                </p>
              </div>
            </div>

            <Button className="w-full mt-2" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Delivery Channel Notice */}
            <div className="p-3 bg-slate-50 rounded-xl border flex items-center justify-around text-slate-700">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp Template
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="flex items-center gap-1.5 font-semibold text-blue-800">
                <Mail className="h-4 w-4 text-blue-600" /> Email PDF Attachment
              </span>
            </div>

            {/* Target Scope */}
            {selectedStudentIds.length > 0 ? (
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                <p className="font-semibold text-primary">Selected Recipients</p>
                <p className="text-slate-600">
                  Targeting <strong>{selectedStudentIds.length}</strong> selected student report cards.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Class</Label>
                <Select value={targetClass} onValueChange={setTargetClass}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="All Classes" />
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
            )}

            {/* Academic Session & Term */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Academic Session</Label>
                <Select value={sessionName} onValueChange={setSessionName}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions?.map((s: any) => (
                      <SelectItem key={s.id || s.session} value={s.session}>
                        {s.session}
                      </SelectItem>
                    ))}
                    {(!sessions || sessions.length === 0) && (
                      <SelectItem value={activeSessionName}>{activeSessionName}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Academic Term</Label>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Term">First Term</SelectItem>
                    <SelectItem value="Second Term">Second Term</SelectItem>
                    <SelectItem value="Third Term">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {!queuedResult && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkDispatch}
              disabled={isDispatching}
              className="gap-2 bg-primary text-primary-foreground font-semibold"
            >
              {isDispatching && <Loader2 className="h-4 w-4 animate-spin" />}
              Dispatch Report Cards
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
