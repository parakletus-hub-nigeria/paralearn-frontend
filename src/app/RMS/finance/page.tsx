"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import Link from "next/link";
import { RootState } from "@/reduxToolKit/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Loader2,
  RefreshCw,
  Plus,
  FileText,
  Banknote,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { useGetBursaryDashboardQuery } from "@/reduxToolKit/api/endpoints/finance";
import { routespath } from "@/lib/routepath";
import { cn } from "@/lib/utils";

const fmtKobo = (kobo: number) =>
  "\u20a6" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });

const METHOD_STYLES: Record<string, string> = {
  CASH: "bg-emerald-100 text-emerald-800 border-emerald-200",
  POS: "bg-blue-100 text-blue-800 border-blue-200",
  BANK_TRANSFER: "bg-purple-100 text-purple-800 border-purple-200",
  PAYSTACK: "bg-teal-100 text-teal-800 border-teal-200",
  MONNIFY: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export default function BursaryDashboardPage() {
  const { classes } = useSelector((s: RootState) => s.admin);
  const currentSession = useSelector((s: RootState) => s.setUp.currentSession);

  const [termFilter, setTermFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  const queryParams = {
    ...(termFilter !== "all" ? { termId: termFilter } : {}),
    ...(classFilter !== "all" ? { classId: classFilter } : {}),
  };

  const { data, isLoading, isFetching, refetch } = useGetBursaryDashboardQuery(queryParams);

  const summary = data?.summary || {
    totalExpectedKobo: 0,
    formattedTotalExpected: "₦0.00",
    totalCollectedKobo: 0,
    formattedTotalCollected: "₦0.00",
    totalOutstandingKobo: 0,
    formattedTotalOutstanding: "₦0.00",
    collectionRatePercentage: 0,
  };

  const distribution = data?.distribution || {
    totalInvoices: 0,
    paid: { count: 0, percentage: 0 },
    partial: { count: 0, percentage: 0 },
    pending: { count: 0, percentage: 0 },
    waived: { count: 0, percentage: 0 },
    overridden: { count: 0, percentage: 0 },
  };

  const recentPayments = data?.recentPayments || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bursary &amp; Finance Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor revenue collection, fee settlements, student debt, and recent payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Class filter */}
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

          <Button variant="outline" size="sm" asChild className="gap-1.5 h-9 text-xs">
            <Link href={routespath.FEE_STRUCTURES}>
              <Banknote className="h-3.5 w-3.5" />
              Fee Structures
            </Link>
          </Button>

          <Button size="sm" asChild className="gap-1.5 h-9 text-xs bg-emerald-700 hover:bg-emerald-800 text-white">
            <Link href={routespath.INVOICES}>
              <Plus className="h-3.5 w-3.5" />
              Manage Invoices
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 1. Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Expected */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Total Expected Revenue</span>
                  <Banknote className="h-4 w-4 text-slate-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold font-mono text-slate-900">
                  {summary.formattedTotalExpected || fmtKobo(summary.totalExpectedKobo)}
                </p>
                <p className="text-2xs text-muted-foreground mt-1">
                  Across {distribution.totalInvoices} issued invoices
                </p>
              </CardContent>
            </Card>

            {/* Total Collected */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Total Collected</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold font-mono text-emerald-700">
                  {summary.formattedTotalCollected || fmtKobo(summary.totalCollectedKobo)}
                </p>
                <p className="text-2xs text-emerald-700 font-medium mt-1">
                  {summary.collectionRatePercentage.toFixed(1)}% of total expected
                </p>
              </CardContent>
            </Card>

            {/* Outstanding Balance */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Outstanding Debt</span>
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold font-mono text-rose-700">
                  {summary.formattedTotalOutstanding || fmtKobo(summary.totalOutstandingKobo)}
                </p>
                <p className="text-2xs text-rose-600 font-medium mt-1">
                  Locked behind Paywall Guard
                </p>
              </CardContent>
            </Card>

            {/* Collection Efficiency */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Collection Rate</span>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold text-blue-700">
                  {summary.collectionRatePercentage.toFixed(1)}%
                </p>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, summary.collectionRatePercentage))}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2. Settlement Distribution & Overrides */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Invoice Settlement Breakdown
                </CardTitle>
                <CardDescription>
                  Distribution of fee statuses across all enrolled students.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Fully Paid
                    </p>
                    <p className="text-xl font-bold text-emerald-900 mt-1">
                      {distribution.paid.count}
                    </p>
                    <p className="text-2xs text-emerald-700">{distribution.paid.percentage.toFixed(1)}%</p>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Partial Payment
                    </p>
                    <p className="text-xl font-bold text-amber-900 mt-1">
                      {distribution.partial.count}
                    </p>
                    <p className="text-2xs text-amber-700">{distribution.partial.percentage.toFixed(1)}%</p>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <p className="text-xs text-rose-800 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Unpaid / Pending
                    </p>
                    <p className="text-xl font-bold text-rose-900 mt-1">
                      {distribution.pending.count}
                    </p>
                    <p className="text-2xs text-rose-700">{distribution.pending.percentage.toFixed(1)}%</p>
                  </div>

                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <p className="text-xs text-purple-800 font-medium flex items-center gap-1">
                      <ShieldAlert className="h-3.5 w-3.5" /> Admin Overrides
                    </p>
                    <p className="text-xl font-bold text-purple-900 mt-1">
                      {distribution.overridden.count}
                    </p>
                    <p className="text-2xs text-purple-700">{distribution.overridden.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Short-cuts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                <CardDescription>Direct navigation to bursary operations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Button variant="outline" className="w-full justify-between h-11 text-xs" asChild>
                  <Link href={routespath.INVOICES}>
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Generate Term Invoices
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-between h-11 text-xs" asChild>
                  <Link href={routespath.FEE_STRUCTURES}>
                    <span className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" /> Configure Fee Structures
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-between h-11 text-xs" asChild>
                  <Link href={routespath.INVOICES}>
                    <span className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-emerald-600" /> Record Offline Payment (POS/Cash)
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 3. Recent Payment Transaction Ledger */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Payment Ledger</CardTitle>
                  <CardDescription>
                    Latest transactions received via online gateways, bank transfers, POS, and cash.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-2xs font-mono">
                  {recentPayments.length} Recent
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentPayments.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="w-[180px]">Reference</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Term &amp; Session</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((p) => (
                      <TableRow key={p.id || p.reference}>
                        <TableCell className="font-mono text-xs font-medium">
                          {p.reference}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm text-slate-900">{p.studentName}</p>
                          {p.studentEmail && (
                            <p className="text-2xs text-muted-foreground">{p.studentEmail}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.term ? `${p.term} (${p.session || ""})` : "-"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold border",
                              METHOD_STYLES[p.method] || "bg-gray-100 text-gray-800"
                            )}
                          >
                            {p.method}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-emerald-700">
                          {p.formattedAmount || fmtKobo(p.amountKobo)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
