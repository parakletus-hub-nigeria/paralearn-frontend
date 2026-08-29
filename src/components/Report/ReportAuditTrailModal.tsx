"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, History, User, Clock, CheckCircle2 } from "lucide-react";
import { useGetReportAuditTrailQuery } from "@/reduxToolKit/api/endpoints/reports";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCardId: string;
  studentName?: string;
}

export function ReportAuditTrailModal({
  open,
  onOpenChange,
  reportCardId,
  studentName,
}: Props) {
  const { data: auditEvents = [], isLoading, isFetching } = useGetReportAuditTrailQuery(reportCardId, {
    skip: !open || !reportCardId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Digital Signature Audit Trail
          </DialogTitle>
          {studentName && (
            <p className="text-xs text-muted-foreground">Report Card for: {studentName}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No digital signature audit events recorded for this report card.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {auditEvents.map((event: any, i: number) => (
                <div key={event.id || i} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>

                  <div className="space-y-1 bg-slate-50 p-3 rounded-xl border text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900">
                        {event.action || event.event || "Signature Applied"}
                      </p>
                      <span className="text-2xs text-muted-foreground font-mono">
                        {event.createdAt || event.timestamp
                          ? new Date(event.createdAt || event.timestamp).toLocaleString("en-NG", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>
                        {event.actorName || event.signerName || "System"}{" "}
                        <Badge variant="outline" className="text-2xs px-1.5 py-0 font-medium">
                          {event.role || event.actorRole || "Signer"}
                        </Badge>
                      </span>
                    </div>

                    {event.remarks && (
                      <p className="text-2xs italic text-slate-600 bg-white p-2 rounded border mt-1">
                        &ldquo;{event.remarks}&rdquo;
                      </p>
                    )}

                    {event.checksum && (
                      <p className="font-mono text-2xs text-slate-500 truncate pt-1">
                        Digest: {event.checksum}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
