"use client";
import { QrCode, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureEntry {
  signerName: string;
  role: "Subject Teacher" | "Class Teacher" | "Principal" | string;
  signedAt: string;
}

interface Props {
  signatures: SignatureEntry[];
  checksum: string;
  isVerified: boolean;
}

const ROLE_STYLES: Record<string, string> = {
  "Subject Teacher": "bg-blue-100 text-blue-800",
  "Class Teacher":   "bg-purple-100 text-purple-800",
  "Principal":       "bg-green-100 text-green-800",
};

function fmt(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function SignatureBadge({ signatures, checksum, isVerified }: Props) {
  const verifyUrl = `https://pln.ng/verify/${checksum}`;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm">Digital Authentication</p>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified &amp; Tamper-Proof
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
            <Clock className="h-3.5 w-3.5" /> Pending Signatures
          </span>
        )}
      </div>

      {/* Signature rows */}
      <div className="divide-y text-sm">
        {signatures.length === 0 ? (
          <p className="py-2 text-muted-foreground text-xs">No signatures recorded yet.</p>
        ) : (
          signatures.map((sig, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", ROLE_STYLES[sig.role] ?? "bg-gray-100 text-gray-800")}>
                {sig.role}
              </span>
              <span className="flex-1 font-medium">{sig.signerName}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(sig.signedAt)}</span>
            </div>
          ))
        )}
      </div>

      {/* QR verification link */}
      {checksum && (
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <QrCode className="h-4 w-4 shrink-0" />
          <span className="truncate font-mono">{verifyUrl}</span>
        </a>
      )}
    </div>
  );
}
