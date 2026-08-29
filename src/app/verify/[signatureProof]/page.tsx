"use client";

import { use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Printer,
  FileCheck,
  User,
  GraduationCap,
  Calendar,
  Award,
  Hash,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVerifyReportSignatureQuery } from "@/reduxToolKit/api/endpoints/reports";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ signatureProof: string }>;
}

export default function PublicVerificationPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const signatureProof = resolvedParams.signatureProof || "";

  const { data, isLoading, isError, error } = useVerifyReportSignatureQuery(signatureProof, {
    skip: !signatureProof,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">Verifying Cryptographic Signature</h1>
          <p className="text-xs text-muted-foreground max-w-sm">
            Validating HMAC-SHA256 checksum and digital certification chain with the official registry...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data?.verified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
            <ShieldAlert className="h-9 w-9" />
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold px-3 py-1">
              Verification Failed
            </Badge>
            <h1 className="text-xl font-bold text-slate-900">Unverified or Tampered Certificate</h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              The cryptographic proof provided does not match any authenticated academic record in the official registry, or the underlying grades have been altered.
            </p>
          </div>

          {signatureProof && (
            <div className="p-3 bg-slate-50 rounded-xl border text-xs text-left">
              <span className="text-muted-foreground block text-2xs uppercase tracking-wider">Proof Hash Submitted</span>
              <p className="font-mono text-2xs text-slate-800 break-all mt-0.5">{signatureProof}</p>
            </div>
          )}

          <div className="pt-2">
            <Button asChild variant="outline" className="w-full text-xs">
              <Link href="/">Return to Official Portal</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { student, academicSummary, signatures = [], verificationProof, verifiedAt } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 p-4 sm:p-8 flex flex-col items-center justify-center print:bg-white print:p-0">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none">
        {/* Top Verified Header Bar */}
        <div className="bg-emerald-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-emerald-100">Official Verification Portal</p>
              <p className="text-sm font-extrabold">Authenticated Academic Document</p>
            </div>
          </div>

          <Badge className="bg-white text-emerald-800 font-bold hover:bg-white text-xs px-2.5 py-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Tamper-Proof
          </Badge>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Institution & Student Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Name</p>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">{student.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  <User className="h-3.5 w-3.5 text-slate-400" /> {student.id}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-400" /> {student.class}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                <Calendar className="h-3.5 w-3.5" />
                {student.term} &bull; {student.session}
              </span>
            </div>
          </div>

          {/* Academic Summary Metrics */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Certified Academic Summary
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border text-center">
                <p className="text-2xs text-muted-foreground font-medium">Total Score</p>
                <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                  {academicSummary.totalScore}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border text-center">
                <p className="text-2xs text-muted-foreground font-medium">Term Average</p>
                <p className="text-xl font-bold font-mono text-primary mt-1">
                  {academicSummary.average.toFixed(1)}%
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border text-center">
                <p className="text-2xs text-muted-foreground font-medium">Class Position</p>
                <p className="text-xl font-bold text-slate-800 mt-1">
                  {academicSummary.position || "N/A"}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                <p className="text-2xs text-emerald-800 font-medium">Final Decision</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">
                  {academicSummary.decision || "PASSED"}
                </p>
              </div>
            </div>
          </div>

          {/* Digital Signature Chain */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
              Multi-Tier Digital Certification Chain
            </p>
            <div className="space-y-2.5">
              {signatures.map((sig, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                      ✓
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{sig.signerName}</p>
                      <p className="text-2xs text-muted-foreground">
                        Role: <strong className="text-slate-700">{sig.role}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Digitally Sealed
                    </span>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      {sig.signedAt
                        ? new Date(sig.signedAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Verified"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Hash & Verification Stamp */}
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-muted-foreground text-2xs">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" /> HMAC-SHA256 Checksum Proof
              </span>
              <span>
                Verified: {verifiedAt ? new Date(verifiedAt).toLocaleString("en-NG") : "Instant"}
              </span>
            </div>
            <p className="text-2xs text-slate-700 break-all font-semibold select-all">
              {verificationProof || signatureProof}
            </p>
          </div>

          {/* Print / Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 print:hidden">
            <p className="text-2xs text-muted-foreground text-center sm:text-left">
              This document was authenticated via the official ParaLearn Cryptographic Registry.
            </p>

            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 text-xs h-9">
              <Printer className="h-3.5 w-3.5" />
              Print Verification Slip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
