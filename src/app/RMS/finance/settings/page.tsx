"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Info,
  Power,
  RefreshCw,
} from "lucide-react";
import {
  useGetSettlementConfigQuery,
  useGetBanksQuery,
  useLazyVerifyBankAccountQuery,
  useSetupSettlementConfigMutation,
  useToggleSettlementActiveMutation,
} from "@/reduxToolKit/api/endpoints/finance";

export default function FinanceSettingsPage() {
  const {
    data: config,
    isLoading: configLoading,
    isFetching: configFetching,
    refetch: refetchConfig,
  } = useGetSettlementConfigQuery();

  const { data: banks = [], isLoading: banksLoading } = useGetBanksQuery();
  const [verifyBank, { isFetching: isVerifying }] = useLazyVerifyBankAccountQuery();
  const [setupConfig, { isLoading: isSaving }] = useSetupSettlementConfigMutation();
  const [toggleActive, { isLoading: isToggling }] = useToggleSettlementActiveMutation();

  const [selectedBankCode, setSelectedBankCode] = useState<string>("");
  const [selectedBankName, setSelectedBankName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [resolvedAccountName, setResolvedAccountName] = useState<string>("");
  const [verificationError, setVerificationError] = useState<string>("");

  // Handle auto-verify when account number hits 10 digits
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBankCode) {
      handleVerifyAccount();
    } else {
      setResolvedAccountName("");
      setVerificationError("");
    }
  }, [accountNumber, selectedBankCode]);

  const handleVerifyAccount = async () => {
    if (!selectedBankCode) {
      setVerificationError("Please select a bank first");
      return;
    }
    if (accountNumber.length !== 10) {
      setVerificationError("Account number must be 10 digits");
      return;
    }

    setVerificationError("");
    setResolvedAccountName("");

    try {
      const res = await verifyBank({
        accountNumber,
        bankCode: selectedBankCode,
      }).unwrap();

      if (res?.accountName) {
        setResolvedAccountName(res.accountName);
      } else {
        setVerificationError("Could not resolve account name. Check details.");
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Invalid account details";
      setVerificationError(msg);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankCode) {
      return toast.error("Please select a bank");
    }
    if (accountNumber.length !== 10) {
      return toast.error("Account number must be 10 digits");
    }
    if (!resolvedAccountName) {
      return toast.error("Please verify the account number first");
    }

    try {
      await setupConfig({
        accountNumber,
        bankCode: selectedBankCode,
        bankName: selectedBankName || undefined,
        chargeBearer: "subaccount",
      }).unwrap();

      toast.success("School settlement account configured successfully!");
      setAccountNumber("");
      setResolvedAccountName("");
      setSelectedBankCode("");
      setSelectedBankName("");
      refetchConfig();
    } catch (err: any) {
      toast.error(
        err?.data?.message || err?.message || "Failed to configure settlement account"
      );
    }
  };

  const handleToggleStatus = async () => {
    if (!config?.configured) return;
    try {
      await toggleActive({ isActive: !config.isActive }).unwrap();
      toast.success(
        !config.isActive
          ? "Online fee payments enabled"
          : "Online fee payments paused"
      );
      refetchConfig();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to toggle status");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Bank Account &amp; Settlement Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure the school's settlement bank account to receive fee payments directly from students via Paystack.
        </p>
      </div>

      {/* Current Configuration Status Banner */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                School Settlement Account Status
              </CardTitle>
              <CardDescription className="text-xs">
                Where student fee payments are automatically deposited
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchConfig()}
              disabled={configFetching}
              className="h-8 gap-1.5 text-xs rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {configLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading settlement configuration...
            </div>
          ) : config?.configured ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl border bg-white space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Bank Name</p>
                  <p className="text-sm font-bold text-slate-900">
                    {config.bankName || "Configured Bank"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border bg-white space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Account Name</p>
                  <p className="text-sm font-bold text-slate-900">
                    {config.accountName || "—"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border bg-white space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Account Number</p>
                  <p className="text-sm font-mono font-bold text-slate-900">
                    {config.accountNumberMasked || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-50/50 border border-purple-100">
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      config.isActive
                        ? "text-xs px-2.5 py-1 font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                        : "text-xs px-2.5 py-1 font-semibold bg-amber-100 text-amber-800 hover:bg-amber-100"
                    }
                  >
                    {config.isActive ? "● Active & Accepting Online Fees" : "⏸ Paused"}
                  </Badge>
                  <span className="text-xs text-slate-600">
                    Settlement: <strong>Direct to Bank (Next Business Day)</strong>
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={config.isActive ? "outline" : "default"}
                  onClick={handleToggleStatus}
                  disabled={isToggling}
                  className={
                    config.isActive
                      ? "h-8 text-xs font-semibold rounded-lg gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                      : "h-8 text-xs font-semibold rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  }
                >
                  <Power className="w-3.5 h-3.5" />
                  {isToggling ? "Updating..." : config.isActive ? "Pause Online Payments" : "Enable Online Payments"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Settlement Account Not Configured
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Students cannot pay school fees online until you connect a settlement bank account below. Once connected, school fees paid online will automatically settle directly into this account.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Setup Form */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <CardTitle className="text-sm font-bold text-slate-900">
            {config?.configured ? "Update Settlement Bank Account" : "Connect School Bank Account"}
          </CardTitle>
          <CardDescription className="text-xs">
            Enter the official institutional bank details. The account name will be verified in real time with the bank.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Bank <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedBankCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setSelectedBankCode(code);
                      const found = banks.find((b) => b.code === code);
                      setSelectedBankName(found?.name || "");
                    }}
                    disabled={banksLoading || isSaving}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-900"
                  >
                    <option value="">-- Choose Nigerian Bank --</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Account Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  10-Digit NUBAN Account Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 0123456789"
                    className="h-10 text-xs font-mono font-medium rounded-lg"
                    disabled={isSaving}
                  />
                  {isVerifying && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Resolved Account Name Feedback */}
            {resolvedAccountName && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">
                      Verified Account Name:
                    </p>
                    <p className="text-sm font-bold text-emerald-800">
                      {resolvedAccountName}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white text-2xs font-semibold">
                  Verified with Bank
                </Badge>
              </div>
            )}

            {verificationError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{verificationError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <Button
                type="submit"
                disabled={!resolvedAccountName || isSaving || !selectedBankCode}
                className="h-10 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Settlement Account...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Save &amp; Enable Settlement
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Information Box */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">How Student Payments &amp; Settlement Work</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>When students or parents pay invoices online via Paystack, the transaction is processed through a secure settlement subaccount.</li>
            <li>Net proceeds are settled directly into the school's bank account on the next business day (T+1).</li>
            <li>Offline payments (Cash, POS, Direct Transfer) can continue to be recorded manually on the Invoices &amp; Billing page.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
