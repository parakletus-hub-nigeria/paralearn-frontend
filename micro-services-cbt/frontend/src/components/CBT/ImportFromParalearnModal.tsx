"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GraduationCap,
  School,
  CheckCircle2,
  Users,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFetchImportableClassesMutation,
  useImportCandidatesFromParalearnMutation,
  ImportableClassItem,
} from "@cbt/store/cbtMicroserviceApi";

interface ImportFromParalearnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  examId: string;
  examTitle: string;
  defaultEmail?: string;
  onSuccess?: () => void;
}

export function ImportFromParalearnModal({
  open,
  onOpenChange,
  workspaceId,
  examId,
  examTitle,
  defaultEmail = "",
  onSuccess,
}: ImportFromParalearnModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [importMode, setImportMode] = useState<"ALL" | "SPECIFIC">("ALL");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoGeneratePin, setAutoGeneratePin] = useState(true);

  // RTK Query Mutations
  const [fetchClasses, { data: classData, isLoading: isLoadingClasses, error: fetchError, reset: resetFetch }] =
    useFetchImportableClassesMutation();
  const [importCandidates, { isLoading: isImporting }] = useImportCandidatesFromParalearnMutation();

  useEffect(() => {
    if (defaultEmail && !email) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);

  // When modal opens, automatically fetch classes if email and workspaceId exist
  useEffect(() => {
    if (open && workspaceId && email.trim()) {
      handleFetchClasses();
    }
  }, [open, workspaceId]);

  // When classes load, select all by default
  useEffect(() => {
    if (classData?.classes) {
      setSelectedClassIds(classData.classes.map((c) => c.id));
    }
  }, [classData]);

  const handleFetchClasses = async () => {
    if (!email.trim() || !workspaceId) return;
    try {
      await fetchClasses({ workspaceId, email: email.trim() }).unwrap();
    } catch (err: any) {
      console.error("Failed to fetch classes:", err);
    }
  };

  const availableClasses = classData?.classes || [];

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return availableClasses;
    const q = searchQuery.toLowerCase();
    return availableClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.stream && c.stream.toLowerCase().includes(q)) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [availableClasses, searchQuery]);

  const totalSelectedStudents = useMemo(() => {
    const selectedSet = new Set(selectedClassIds);
    return availableClasses
      .filter((c) => selectedSet.has(c.id))
      .reduce((sum, c) => sum + (c.activeStudents || 0), 0);
  }, [availableClasses, selectedClassIds]);

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAll = () => {
    setSelectedClassIds(availableClasses.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedClassIds([]);
  };

  const handleExecuteImport = async () => {
    if (!examId) {
      toast.error("Please select an active exam first.");
      return;
    }

    const classIdsToImport = importMode === "ALL" ? availableClasses.map((c) => c.id) : selectedClassIds;

    if (classIdsToImport.length === 0) {
      toast.error("Please select at least one class to import.");
      return;
    }

    try {
      const result = await importCandidates({
        workspaceId,
        examId,
        email: email.trim(),
        classIds: classIdsToImport,
        autoGeneratePin,
      }).unwrap();

      toast.success(
        result.message || `Successfully imported ${result.imported} candidates into ${examTitle}!`
      );
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to import candidates from ParaLearn Core.";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl bg-white border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#641bc4]/5 via-[#641bc4]/10 to-transparent p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#641bc4] text-white flex items-center justify-center shadow-md shadow-[#641bc4]/20">
              <School className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Import Candidates from ParaLearn
                <Badge className="bg-violet-100 text-[#641bc4] hover:bg-violet-100 border-violet-200 text-[10px] font-bold">
                  School SIS
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Directly sync classes and enrolled students from your school into{" "}
                <span className="font-bold text-slate-700">"{examTitle || "Current Exam"}"</span>.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Email & Scope Bar */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-[#641bc4]" />
              <span className="font-semibold text-slate-600">Verifying as:</span>
              <span className="font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                {email || "admin@brightfuture.ng"}
              </span>
            </div>

            {classData && (
              <Badge
                className={
                  classData.accessTier === "ADMIN"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold"
                    : "bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-bold"
                }
              >
                {classData.accessTier === "ADMIN" ? "👑 Full School Access" : "📚 Teacher Scoped Access"}
              </Badge>
            )}
          </div>

          {/* Loading State */}
          {isLoadingClasses && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#641bc4] animate-spin" />
              <p className="text-sm font-bold text-slate-700">Connecting to ParaLearn School Database...</p>
              <p className="text-xs text-slate-400">Resolving your permissions and school class rosters</p>
            </div>
          )}

          {/* Error State */}
          {!isLoadingClasses && fetchError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Could not fetch classes from ParaLearn</span>
              </div>
              <p className="text-xs text-red-600">
                {(fetchError as any)?.data?.message ||
                  (fetchError as any)?.message ||
                  "Ensure your user account is registered in this school and ParaLearn Core backend is online."}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFetchClasses}
                className="h-8 text-xs font-bold border-red-300 text-red-700 hover:bg-red-100/50 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </Button>
            </div>
          )}

          {/* Main Loaded Content */}
          {!isLoadingClasses && classData && (
            <div className="space-y-4">
              {/* Import Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">What would you like to import?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("ALL");
                      handleSelectAll();
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      importMode === "ALL"
                        ? "border-[#641bc4] bg-[#641bc4]/5 ring-2 ring-[#641bc4]/15"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                        importMode === "ALL" ? "border-[#641bc4] bg-[#641bc4]" : "border-slate-300"
                      }`}
                    >
                      {importMode === "ALL" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Import All Classes</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Enroll all {classData.totalAvailableStudents} students from all {availableClasses.length} classes
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode("SPECIFIC")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      importMode === "SPECIFIC"
                        ? "border-[#641bc4] bg-[#641bc4]/5 ring-2 ring-[#641bc4]/15"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${
                        importMode === "SPECIFIC" ? "border-[#641bc4] bg-[#641bc4]" : "border-slate-300"
                      }`}
                    >
                      {importMode === "SPECIFIC" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Select Specific Classes</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Tick only the classes taking this test
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Specific Class Picker */}
              {importMode === "SPECIFIC" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Filter classes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-xs border-slate-200"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[11px] font-bold text-[#641bc4] hover:underline px-1.5"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-[11px] font-bold text-slate-500 hover:underline px-1.5"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Class Checkbox Grid */}
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                    {filteredClasses.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">No classes match your search</div>
                    ) : (
                      filteredClasses.map((cls) => {
                        const isChecked = selectedClassIds.includes(cls.id);
                        return (
                          <div
                            key={cls.id}
                            onClick={() => handleToggleClass(cls.id)}
                            className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked ? "bg-violet-50/50 hover:bg-violet-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#641bc4]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                              <div>
                                <span className="text-xs font-bold text-slate-900">{cls.name}</span>
                                {cls.stream && (
                                  <span className="text-[11px] text-slate-400 ml-1.5">Stream {cls.stream}</span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono text-slate-600 bg-white">
                              {cls.activeStudents} {cls.activeStudents === 1 ? "student" : "students"}
                            </Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* PIN Generation Options */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Auto-Generate 6-Digit PINs</div>
                    <div className="text-[11px] text-slate-500">
                      Creates unique random numeric passcodes for each student.
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoGeneratePin}
                  onChange={(e) => setAutoGeneratePin(e.target.checked)}
                  className="w-4 h-4 accent-[#641bc4] rounded cursor-pointer"
                />
              </div>

              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#641bc4]" />
                  <span className="text-xs font-bold text-violet-950">
                    Ready to import {importMode === "ALL" ? classData.totalAvailableStudents : totalSelectedStudents}{" "}
                    candidates
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-violet-700">
                  {importMode === "ALL" ? availableClasses.length : selectedClassIds.length} classes selected
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={
              isLoadingClasses ||
              isImporting ||
              !classData ||
              (importMode === "SPECIFIC" && selectedClassIds.length === 0)
            }
            onClick={handleExecuteImport}
            className="h-9 px-4 text-xs font-bold bg-[#641bc4] hover:bg-[#5214a3] text-white flex items-center gap-1.5 rounded-xl shadow-md shadow-[#641bc4]/20"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Importing Students...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  Import {importMode === "ALL" ? classData?.totalAvailableStudents || 0 : totalSelectedStudents}{" "}
                  Candidates
                </span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
