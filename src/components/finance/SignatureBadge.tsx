"use client";

import Link from "next/link";
import { QrCode, CheckCircle2, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignatureEntry {
  signerName: string;
  role: "Subject Teacher" | "Class Teacher" | "Principal" | "CLASS_TEACHER" | "PRINCIPAL" | string;
  signedAt: string;
}

interface Props {
  signatures: SignatureEntry[];
  checksum: string;
  isVerified: boolean;
  className?: string;
}

const ROLE_STYLES: Record<string, string> = {
  "Subject Teacher": "bg-blue-100 text-blue-800 border-blue-200",
  "Class Teacher": "bg-purple-100 text-purple-800 border-purple-200",
  CLASS_TEACHER: "bg-purple-100 text-purple-800 border-purple-200",
  Principal: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PRINCIPAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const ROLE_LABELS: Record<string, string> = {
  CLASS_TEACHER: "Class Teacher",
  PRINCIPAL: "Principal (Institutional Approval)",
  "Class Teacher": "Class Teacher",
  Principal: "Principal",
  "Subject Teacher": "Subject Teacher",
};

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function SignatureBadge({ signatures = [], checksum, isVerified, className }: Props) {
  const localVerifyUrl = checksum ? `/verify/${checksum}` : "#";

  return (
    <div className={cn("rounded-2xl border bg-card p-4 space-y-4 shadow-2xs", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="font-bold text-xs text-slate-900 uppercase tracking-wider">
            Digital Authentication Chain
          </p>
        </div>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-2xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Verified &amp; Tamper-Proof
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-2xs font-bold text-amber-800">
            <Clock className="h-3 w-3 text-amber-600" /> Pending Signatures
          </span>
        )}
      </div>

      {/* Signature rows */}
      <div className="divide-y text-xs">
        {signatures.length === 0 ? (
          <p className="py-2 text-muted-foreground text-2xs">No digital signatures recorded yet.</p>
        ) : (
          signatures.map((sig, i) => (
            <div key={i} className="flex items-center justify-between py-2 gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold border",
                    ROLE_STYLES[sig.role] ?? "bg-gray-100 text-gray-800"
                  )}
                >
                  {ROLE_LABELS[sig.role] ?? sig.role}
                </span>
                <span className="font-semibold text-slate-900">{sig.signerName}</span>
              </div>
              <span className="text-2xs text-muted-foreground whitespace-nowrap">
                {fmtDate(sig.signedAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Public verification portal link */}
      {checksum && (
        <Link
          href={localVerifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border bg-slate-50/80 px-3 py-2 text-2xs text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <QrCode className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-mono font-medium">Verify Proof: {checksum}</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1.5" />
        </Link>
      )}
    </div>
  );
}
