"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchScoresByAssessment, fetchClasses, fetchSubjects, fetchAssessments, bulkUploadScores } from "@/reduxToolKit/admin/adminThunks";
import { clearAdminError, clearAdminSuccess } from "@/reduxToolKit/admin/adminSlice";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { generateTemplate } from "@/lib/templates";
import { Header } from "@/components/RMS/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, FileText, Copy, TrendingUp, BookOpen, Calendar, Target, AlertCircle, Eye, Upload, FileSpreadsheet, TableProperties } from "lucide-react";
import Link from "next/link";

const getGrade = (score: number, maxMarks: number) => {
  if (!maxMarks) return { letter: "—", bg: "var(--surface-muted)", color: "var(--foreground-muted)" };
  const percentage = (score / maxMarks) * 100;
  if (percentage >= 80) return { letter: "A", bg: "var(--emerald-signal)", color: "#fff" };
  if (percentage >= 70) return { letter: "B", bg: "var(--cobalt-signal)", color: "#fff" };
  if (percentage >= 60) return { letter: "C", bg: "var(--amber-signal)", color: "#fff" };
  if (percentage >= 50) return { letter: "D", bg: "var(--violet-ink)", color: "#fff" };
  return { letter: "F", bg: "var(--crimson-signal)", color: "#fff" };
};

export function AdminScoresPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { scores, classes, subjects, assessments, loading, error, success } = useSelector(
    (s: RootState) => s.admin
  );
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("1st Term");
  const [selectedAssessment, setSelectedAssessment] = useState<string>("");
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(fetchClasses(undefined));
    dispatch(fetchSubjects());
    dispatch(fetchAssessments());
    dispatch(getTenantInfo());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearAdminError());
    }
    if (success) {
      toast.success(success);
      dispatch(clearAdminSuccess());
    }
  }, [error, success, dispatch]);

  // Filter assessments by class and subject
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (selectedClass && a.classId !== selectedClass) return false;
      if (selectedSubject && a.subjectId !== selectedSubject) return false;
      return true;
    });
  }, [assessments, selectedClass, selectedSubject]);

  // Get current assessment info
  const currentAssessment = useMemo(() => {
    return assessments.find((a) => a.id === selectedAssessment);
  }, [assessments, selectedAssessment]);

  const currentSubjectName = useMemo(() => {
    const s = subjects.find((s: any) => s.id === selectedSubject);
    return s?.name || "Select Subject";
  }, [subjects, selectedSubject]);

  const currentClassName = useMemo(() => {
    const c = classes.find((c) => c.id === selectedClass);
    return c?.name || "Select Class";
  }, [classes, selectedClass]);

  // Filter scores by search
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return scores;
    return scores.filter(
      (s: any) =>
        String(s?.studentId || s?.student?.id || "").toLowerCase().includes(term) ||
        String(s?.student?.firstName || "").toLowerCase().includes(term) ||
        String(s?.student?.lastName || "").toLowerCase().includes(term)
    );
  }, [scores, q]);

  // Calculate class average
  const classAverage = useMemo(() => {
    if (scores.length === 0) return 0;
    const total = scores.reduce((acc: number, s: any) => {
      const score = s?.marksAwarded ?? s?.score ?? 0;
      return acc + score;
    }, 0);
    return Math.round((total / scores.length) * 10) / 10;
  }, [scores]);

  const loadScores = async () => {
    try {
      if (!selectedAssessment) return toast.error("Please select an assessment");
      await dispatch(fetchScoresByAssessment(selectedAssessment)).unwrap();
    } catch (e: any) {
      toast.error(e || "Failed to load scores");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedAssessment) {
      toast.error("Please select an assessment before uploading scores");
      e.target.value = "";
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Only Excel (.xlsx, .xls) or CSV files are supported");
      e.target.value = "";
      return;
    }
    try {
      setUploading(true);
      const result = await dispatch(bulkUploadScores({ assessmentId: selectedAssessment, file })).unwrap();
      const { successfulRecords, failedRecords, totalRecords } = result?.data || result || {};
      if (totalRecords !== undefined) {
        toast.success(`Upload complete: ${successfulRecords ?? totalRecords} processed${failedRecords ? `, ${failedRecords} failed` : ""}`);
      } else {
        toast.success("Scores uploaded successfully");
      }
      // Reload scores to reflect upload
      await dispatch(fetchScoresByAssessment(selectedAssessment)).unwrap();
    } catch (err: any) {
      toast.error(err || "Failed to upload scores");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const exportScores = () => {
    if (scores.length === 0) {
      toast.error("No scores to export");
      return;
    }
    
    const headers = ["Student ID", "Student Name", "Marks Awarded", "Max Marks", "Percentage", "Grade"];
    const rows = scores.map((s: any) => {
      const studentId = s?.studentId || s?.student?.studentId || s?.student?.id || "";
      const name = s?.student ? `${s.student.firstName || ""} ${s.student.lastName || ""}`.trim() : "";
      const marksAwarded = s?.marksAwarded ?? s?.score ?? 0;
      const maxMarks = s?.maxMarks ?? currentAssessment?.totalMarks ?? 100;
      const percentage = maxMarks > 0 ? Math.round((marksAwarded / maxMarks) * 100) : 0;
      const grade = getGrade(marksAwarded, maxMarks);
      return [studentId, name, marksAwarded, maxMarks, `${percentage}%`, grade.letter];
    });

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scores-${currentAssessment?.title || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Scores exported successfully");
  };

  return (
    <div className="w-full">
      <Header 
        schoolLogo={tenantInfo?.logoUrl} 
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Info Banner */}
      <div
        className="rounded-xl p-4 mb-6 flex items-start justify-between gap-3"
        style={{ background: "var(--cobalt-tint)", border: "1px solid color-mix(in oklch, var(--cobalt-signal) 20%, transparent)" }}
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--cobalt-signal)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--cobalt-signal)" }}>Score Management</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--cobalt-signal)", opacity: 0.85 }}>
              View, export, or bulk-upload scores. To import a full school record sheet (multiple subjects &amp; classes),
              use the Import Wizard.
            </p>
          </div>
        </div>
        <Link href="/RMS/scores/import" className="flex-shrink-0">
          <Button
            variant="outline"
            className="h-9 gap-2 text-sm whitespace-nowrap"
            style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", color: "var(--cobalt-signal)" }}
          >
            <TableProperties className="w-4 h-4" /> Import Wizard
          </Button>
        </Link>
      </div>

      {/* Score Sheet Header */}
      <div className="bg-white p-6 mb-6" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
              Score Overview
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
              {currentAssessment?.title || "Select an assessment"} • {currentAssessment?.session || "Academic Session"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <Input
                placeholder="Search student by name or ID..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10 h-11 w-[280px]"
                style={{ borderRadius: "var(--radius-xl)", borderColor: "var(--border-medium)", background: "var(--surface-muted)" }}
              />
            </div>
            <Button
              variant="outline"
              className="h-11 gap-2"
              style={{ borderRadius: "var(--radius-xl)", borderColor: "var(--border-medium)" }}
              onClick={exportScores}
              disabled={scores.length === 0}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl p-4" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Subject</span>
            </div>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="h-10" style={{ borderRadius: "var(--radius-md)", border: "none", background: "#ffffff", boxShadow: "var(--shadow-card)" }}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Copy className="w-4 h-4" style={{ color: "var(--emerald-signal)" }} />
              <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Class</span>
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-10" style={{ borderRadius: "var(--radius-md)", border: "none", background: "#ffffff", boxShadow: "var(--shadow-card)" }}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-fine)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Term</span>
            </div>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="h-10" style={{ borderRadius: "var(--radius-md)", border: "none", background: "#ffffff", boxShadow: "var(--shadow-card)" }}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="1st Term">1st Term</SelectItem>
                <SelectItem value="2nd Term">2nd Term</SelectItem>
                <SelectItem value="3rd Term">3rd Term</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl p-4" style={{ background: "var(--violet-tint)", border: "1px solid color-mix(in oklch, var(--violet-ink) 20%, transparent)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: "var(--violet-ink)" }} />
              <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--violet-ink)" }}>Class Average</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold" style={{ color: "var(--violet-ink)" }}>{classAverage}</span>
              {classAverage > 0 && (
                <span className="text-xs font-medium flex items-center gap-0.5" style={{ color: "var(--emerald-signal)" }}>
                  <TrendingUp className="w-3 h-3" />
                  pts
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Selection */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
              <SelectTrigger className="h-11" style={{ borderRadius: "var(--radius-xl)", borderColor: "var(--border-medium)" }}>
                <SelectValue placeholder="Select Assessment" />
              </SelectTrigger>
              <SelectContent>
                {filteredAssessments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={loadScores}
            disabled={loading || !selectedAssessment}
            className="h-11 text-white gap-2"
            style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
          >
            <Eye className="w-4 h-4" />
            {loading ? "Loading..." : "View Scores"}
          </Button>
        </div>

        {/* Bulk Upload Section */}
        <div className="mt-4 pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ borderTop: "1px solid var(--border-fine)" }}>
          <div className="flex items-center gap-2 flex-1">
            <FileSpreadsheet className="w-4 h-4 flex-shrink-0" style={{ color: "var(--foreground-muted)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Bulk Score Upload</p>
              <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Download the template, fill in scores, then upload for the selected assessment.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              className="h-10 gap-2 text-sm"
              style={{ borderRadius: "var(--radius-xl)", borderColor: "var(--border-medium)" }}
              onClick={() => generateTemplate("scores")}
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleBulkUpload}
            />
            <Button
              className="h-10 gap-2 text-white text-sm"
              style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
              disabled={!selectedAssessment || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload Scores"}
            </Button>
          </div>
        </div>
      </div>

      {/* Score Table (View Only) */}
      <div className="bg-white overflow-x-auto" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
        <table className="w-full min-w-[700px]">
          <thead>
            <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
              <th className="text-left font-semibold text-xs uppercase tracking-wide py-4 px-5 w-[100px]" style={{ color: "var(--foreground-muted)" }}>Student ID</th>
              <th className="text-left font-semibold text-xs uppercase tracking-wide py-4 px-3" style={{ color: "var(--foreground-muted)" }}>Student Name</th>
              <th className="text-center font-semibold text-xs uppercase tracking-wide py-4 px-3" style={{ color: "var(--foreground-muted)" }}>Marks Awarded</th>
              <th className="text-center font-semibold text-xs uppercase tracking-wide py-4 px-3" style={{ color: "var(--foreground-muted)" }}>Max Marks</th>
              <th className="text-center font-semibold text-xs uppercase tracking-wide py-4 px-3" style={{ color: "var(--foreground-muted)" }}>Percentage</th>
              <th className="text-center font-semibold text-xs uppercase tracking-wide py-4 px-3" style={{ color: "var(--foreground-muted)" }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((score: any, idx: number) => {
              const studentId = score?.student?.studentId || score?.studentId || score?.student?.id || `S-${idx + 101}`;
              const studentName = score?.student
                ? `${score.student.firstName || ""} ${score.student.lastName || ""}`.trim()
                : score?.studentName || "Student";
              const marksAwarded = score?.marksAwarded ?? score?.score ?? 0;
              const maxMarks = score?.maxMarks ?? currentAssessment?.totalMarks ?? 100;
              const percentage = maxMarks > 0 ? Math.round((marksAwarded / maxMarks) * 100) : 0;
              const grade = getGrade(marksAwarded, maxMarks);

              return (
                <tr
                  key={score?.id || idx}
                  className="transition-colors"
                  style={{ borderTop: "1px solid var(--border-fine)", background: idx % 2 === 1 ? "var(--surface-muted)" : "white" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 1 ? "var(--surface-muted)" : "white")}
                >
                  <td className="py-4 px-5 text-sm font-medium" style={{ color: "var(--foreground-muted)", fontFamily: "var(--font-geist-mono)", fontVariantNumeric: "tabular-nums" }}>{studentId}</td>
                  <td className="py-4 px-3">
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>{studentName}</span>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className="font-bold" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{marksAwarded}</span>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span style={{ color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>{maxMarks}</span>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span
                      className="font-semibold"
                      style={{ color: percentage >= 70 ? "var(--emerald-signal)" : percentage >= 50 ? "var(--amber-signal)" : "var(--crimson-signal)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {percentage}%
                    </span>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 text-sm font-bold"
                      style={{ borderRadius: "var(--radius-md)", background: grade.bg, color: grade.color }}
                    >
                      {grade.letter}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
                  <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No scores loaded</p>
                  <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>Select an assessment and click "View Scores"</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      {scores.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Total Students</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>{scores.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Highest Score</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--emerald-signal)" }}>
              {Math.max(...scores.map((s: any) => s?.marksAwarded ?? s?.score ?? 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Lowest Score</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--crimson-signal)" }}>
              {Math.min(...scores.map((s: any) => s?.marksAwarded ?? s?.score ?? 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>Pass Rate</p>
            <p className="text-2xl font-bold mt-1" style={{ color: "var(--cobalt-signal)" }}>
              {Math.round(
                (scores.filter((s: any) => {
                  const marks = s?.marksAwarded ?? s?.score ?? 0;
                  const max = s?.maxMarks ?? currentAssessment?.totalMarks ?? 100;
                  return (marks / max) * 100 >= 50;
                }).length / scores.length) * 100
              )}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
