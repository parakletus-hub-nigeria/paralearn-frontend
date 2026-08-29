"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchClasses, fetchSubjects, fetchAssessments } from "@/reduxToolKit/admin/adminThunks";
import apiClient from "@/lib/api";
import { Header } from "@/components/RMS/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Plus,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import {
  useCreateAssessmentMutation,
  useCreateAssessmentCategoryMutation,
  useGetAssessmentCategoriesQuery,
} from "@/reduxToolKit/api/endpoints/assessments";
import { useCreateSubjectMutation } from "@/reduxToolKit/api/endpoints/subjects";

// Token: use var(--violet-ink) everywhere instead of a hardcoded primary color
const DEFAULT_PRIMARY = "#1e3a8a";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColDef {
  colIndex: number;
  subject: string;
  type: string; // "1st" | "2nd" | "exam"
}

interface ParsedStudent {
  name: string;
  scores: Record<number, number | null>; // colIndex → value
}

interface ParsedSheet {
  sheetName: string;
  cols: ColDef[];           // non-total columns only
  students: ParsedStudent[];
}

interface ColMapping {
  colIndex: number;
  subject: string;
  type: string;
  assessmentId: string; // "" = skip
}

interface SheetMapping {
  sheetName: string;
  classId: string;          // "" = skip sheet
  colMappings: ColMapping[];
}

interface MatchedStudent {
  parsedName: string;
  studentId: string;        // "" = unmatched / skip
  displayName: string;
  confidence: "exact" | "partial" | "none";
  scores: Record<number, number | null>;
}

interface UploadResult {
  sheetName: string;
  subject: string;
  type: string;
  sent: number;
  ok: number;
  failed: number;
  error?: string;
}

// ─── Excel Parsing ────────────────────────────────────────────────────────────

function normalizeType(raw: string): string {
  const t = raw.toLowerCase().trim();
  if (t.includes("1st") || t === "1" || t.includes("ca1") || t.includes("first")) return "1st";
  if (t.includes("2nd") || t === "2" || t.includes("ca2") || t.includes("second")) return "2nd";
  if (t.includes("exam") || t.includes("exm") || t.includes("3rd")) return "exam";
  if (t.includes("total") || t.includes("sum")) return "total";
  return t;
}

function parseWorkbook(file: File): Promise<ParsedSheet[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: "array" });
        const sheets: ParsedSheet[] = [];

        for (const sheetName of wb.SheetNames) {
          const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
            header: 1,
            defval: "",
          });
          if (rows.length < 3) continue;

          const row0 = rows[0] as any[];
          const row1 = rows[1] as any[];
          const maxCol = Math.max(row0.length, row1.length);

          // Build column map (forward-fill subject names from row 0)
          const cols: ColDef[] = [];
          let currentSubject = "";
          for (let c = 2; c < maxCol; c++) {
            const subjectCell = String(row0[c] ?? "").trim();
            const typeCell = String(row1[c] ?? "").trim();
            if (subjectCell) currentSubject = subjectCell;
            if (!currentSubject || !typeCell) continue;
            const nt = normalizeType(typeCell);
            if (nt === "total" || nt === "") continue;
            cols.push({ colIndex: c, subject: currentSubject, type: nt });
          }

          // Extract students (rows 2+)
          const students: ParsedStudent[] = [];
          for (let r = 2; r < rows.length; r++) {
            const row = rows[r] as any[];
            const name = String(row[1] ?? "").trim();
            if (!name || /^name/i.test(name)) continue;
            const scores: Record<number, number | null> = {};
            for (const col of cols) {
              const val = row[col.colIndex];
              const n = Number(val);
              scores[col.colIndex] = val !== "" && val !== undefined && !isNaN(n) ? n : null;
            }
            students.push({ name, scores });
          }

          if (students.length > 0 && cols.length > 0) {
            sheets.push({ sheetName, cols, students });
          }
        }
        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Student Name Matching ────────────────────────────────────────────────────

function matchByName(name: string, enrolled: any[]): { student: any; confidence: MatchedStudent["confidence"] } | null {
  const norm = name.toLowerCase().replace(/[,._\-]+/g, " ").replace(/\s+/g, " ").trim();
  const normParts = norm.split(" ").filter(Boolean);

  // Pass 1: exact full-name match (both orderings)
  for (const e of enrolled) {
    const fl = `${e.firstName ?? ""} ${e.lastName ?? ""}`.toLowerCase().trim();
    const lf = `${e.lastName ?? ""} ${e.firstName ?? ""}`.toLowerCase().trim();
    if (fl === norm || lf === norm) return { student: e, confidence: "exact" };
  }

  // Pass 2: all tokens of the DB name appear somewhere in the Excel name
  for (const e of enrolled) {
    const first = (e.firstName ?? "").toLowerCase().trim();
    const last = (e.lastName ?? "").toLowerCase().trim();
    const dbParts = [first, last].filter(Boolean);
    if (dbParts.length > 0 && dbParts.every((p) => normParts.includes(p))) {
      return { student: e, confidence: "exact" };
    }
  }

  // Pass 3: partial — Excel name contains the last name OR first name (min 3 chars)
  for (const e of enrolled) {
    const first = (e.firstName ?? "").toLowerCase().trim();
    const last = (e.lastName ?? "").toLowerCase().trim();
    const longFirst = first.length >= 3;
    const longLast = last.length >= 3;
    if ((longLast && norm.includes(last)) || (longFirst && norm.includes(first))) {
      return { student: e, confidence: "partial" };
    }
  }

  return null;
}

function buildMatches(students: ParsedStudent[], enrolled: any[]): MatchedStudent[] {
  return students.map((s) => {
    const hit = matchByName(s.name, enrolled);
    return {
      parsedName: s.name,
      studentId: hit?.student?.id ?? "",
      displayName: hit ? `${hit.student.firstName ?? ""} ${hit.student.lastName ?? ""}`.trim() : "",
      confidence: hit?.confidence ?? "none",
      scores: s.scores,
    };
  });
}

// ─── Unique combos helper ──────────────────────────────────────────────────────

function uniqueCols(cols: ColDef[]): ColDef[] {
  const seen = new Set<string>();
  return cols.filter((c) => {
    const k = `${c.subject}|${c.type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDot({ n, current, label, color }: { n: number; current: number; label: string; color: string }) {
  const done = current > n;
  const active = current === n;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          done ? "text-white" : active ? "text-white" : "bg-slate-100 text-slate-400"
        }`}
        style={done || active ? { backgroundColor: color } : undefined}
      >
        {done ? <CheckCircle2 className="w-5 h-5" /> : n}
      </div>
      <span className={`text-xs font-medium ${active ? "text-slate-900" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}

function StepLine({ done, color }: { done: boolean; color: string }) {
  return (
    <div className="flex-1 h-0.5 mb-5 transition-all" style={{ backgroundColor: done ? color : "#e2e8f0" }} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BulkScoreImportPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { classes, subjects, assessments } = useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const schoolSettings = useSelector((s: RootState) => s.admin.schoolSettings);
  const primaryColor = schoolSettings?.primaryColor || DEFAULT_PRIMARY;

  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsing, setParsing] = useState(false);
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([]);
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [enrolledBySheet, setEnrolledBySheet] = useState<Record<string, any[]>>({});
  const [matchedBySheet, setMatchedBySheet] = useState<Record<string, MatchedStudent[]>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // ── Create-assessments state (type → category mapping) ──────────────────────
  const [typeCategoryMap, setTypeCategoryMap] = useState<Record<string, string>>({});
  const [typeNewCategoryName, setTypeNewCategoryName] = useState<Record<string, string>>({});
  const [globalMaxMarks, setGlobalMaxMarks] = useState(100);
  const [globalStartsAt, setGlobalStartsAt] = useState("");
  const [creatingAll, setCreatingAll] = useState(false);

  const { data: categories = [] } = useGetAssessmentCategoriesQuery();
  const [createAssessmentMut] = useCreateAssessmentMutation();
  const [createCategoryMut] = useCreateAssessmentCategoryMutation();
  const [createSubjectMut] = useCreateSubjectMutation();

  useEffect(() => {
    dispatch(fetchClasses(undefined));
    dispatch(fetchSubjects());
    dispatch(fetchAssessments());
  }, [dispatch]);

  // ── Step 1: parse file ──────────────────────────────────────────────────────

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setParsing(true);
    try {
      const sheets = await parseWorkbook(file);
      if (!sheets.length) {
        toast.error("No score data detected. Check the file format.");
        return;
      }
      setParsedSheets(sheets);
      setSheetMappings(
        sheets.map((sh) => ({
          sheetName: sh.sheetName,
          classId: "",
          colMappings: uniqueCols(sh.cols).map((c) => ({
            colIndex: c.colIndex,
            subject: c.subject,
            type: c.type,
            assessmentId: "",
          })),
        }))
      );
      setStep(2);
      toast.success(`Parsed ${sheets.length} sheet(s) successfully`);
    } catch (err: any) {
      toast.error("Failed to parse file: " + (err?.message ?? "Unknown error"));
    } finally {
      setParsing(false);
    }
  };

  // ── Step 2: mapping helpers ─────────────────────────────────────────────────

  const updateClassId = (sheetName: string, classId: string) =>
    setSheetMappings((prev) =>
      prev.map((m) => (m.sheetName === sheetName ? { ...m, classId, colMappings: m.colMappings.map((c) => ({ ...c, assessmentId: "" })) } : m))
    );

  const updateAssessmentId = (sheetName: string, colIndex: number, raw: string) => {
    // Normalise sentinel → empty string so upload code never sees "__skip__"
    const assessmentId = raw === "__skip__" ? "" : raw;
    setSheetMappings((prev) =>
      prev.map((m) =>
        m.sheetName !== sheetName
          ? m
          : { ...m, colMappings: m.colMappings.map((c) => (c.colIndex === colIndex ? { ...c, assessmentId } : c)) }
      )
    );
  };

  const assessmentsForClass = (classId: string) =>
    classId ? assessments.filter((a: any) => a.classId === classId) : [];

  const suggestAssessment = (classId: string, subject: string, type: string) => {
    const pool = assessmentsForClass(classId);
    const subjectMatch = subjects.find(
      (s: any) =>
        s.classId === classId &&
        (s.name ?? "").toLowerCase().includes(subject.toLowerCase().split(" ")[0])
    );
    if (!subjectMatch) return pool;
    const bySubject = pool.filter((a: any) => a.subjectId === subjectMatch.id);
    if (!bySubject.length) return pool;
    // Prefer assessments whose title contains the type hint
    const withType = bySubject.filter((a: any) => (a.title ?? "").toLowerCase().includes(type));
    return withType.length ? withType : bySubject;
  };

  const findSubjectId = (classId: string, subjectName: string): string | null => {
    const norm = subjectName.toLowerCase().trim();
    const forClass = subjects.filter((s: any) => s.classId === classId);
    const exact = forClass.find((s: any) => (s.name ?? "").toLowerCase() === norm);
    if (exact) return exact.id;
    const firstWord = norm.split(" ")[0];
    const partial = forClass.find((s: any) => (s.name ?? "").toLowerCase().includes(firstWord));
    return partial?.id ?? null;
  };

  // All unique types detected across every uploaded sheet
  const allDetectedTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const sheet of parsedSheets) for (const col of sheet.cols) seen.add(col.type);
    return Array.from(seen);
  }, [parsedSheets]);

  const typeLabel = (t: string) =>
    t === "1st" ? "1st CA" : t === "2nd" ? "2nd CA" : t === "exam" ? "Exam" : t;

  const handleCreateAll = async () => {
    // Must have at least one type mapped to a category
    const typesWithCategory = allDetectedTypes.filter((t) => typeCategoryMap[t]);
    if (typesWithCategory.length === 0) {
      toast.error("Assign a category to at least one assessment type first.");
      return;
    }
    // Must have at least one sheet with a class
    if (!sheetMappings.some((m) => m.classId)) {
      toast.error("Select a class for at least one sheet first.");
      return;
    }

    setCreatingAll(true);
    try {
      // Step 1: Resolve / create categories for each type
      const resolvedCategoryId: Record<string, string> = {};
      for (const type of allDetectedTypes) {
        const catId = typeCategoryMap[type];
        if (!catId) continue;
        if (catId === "__new__") {
          const catName = (typeNewCategoryName[type] || typeLabel(type)).trim();
          const newCat = await createCategoryMut({
            name: catName,
            code: catName.toUpperCase().replace(/\s+/g, "_").slice(0, 10),
            weight: 100,
          }).unwrap();
          resolvedCategoryId[type] = newCat.id;
        } else {
          resolvedCategoryId[type] = catId;
        }
      }

      const startsAt = globalStartsAt || new Date().toISOString().split("T")[0];
      // subject cache: "classId|subjectName" -> subjectId
      const subjectCache: Record<string, string> = {};

      // Pre-populate cache from existing subjects
      for (const s of subjects as any[]) {
        if (s.classId && s.name && s.id) subjectCache[`${s.classId}|${s.name}`] = s.id;
      }

      const globalBySubjectType: Record<string, Record<string, string>> = {};
      // globalBySubjectType[sheetName]["subject|type"] = assessmentId

      // Step 2: For each sheet, create subjects + assessments
      for (const mapping of sheetMappings) {
        if (!mapping.classId) continue;
        const sheet = parsedSheets.find((s) => s.sheetName === mapping.sheetName);
        if (!sheet) continue;

        globalBySubjectType[mapping.sheetName] = {};
        const cols = uniqueCols(sheet.cols);

        for (const col of cols) {
          const categoryId = resolvedCategoryId[col.type];
          if (!categoryId) continue; // type not mapped — skip

          // Ensure subject exists
          const cacheKey = `${mapping.classId}|${col.subject}`;
          if (!subjectCache[cacheKey]) {
            try {
              const res = await createSubjectMut({ name: col.subject, classId: mapping.classId }).unwrap();
              const sid = res?.data?.id ?? res?.id;
              if (sid) subjectCache[cacheKey] = sid;
            } catch {
              toast.error(`Could not create subject "${col.subject}" — skipping`);
              continue;
            }
          }
          const subjectId = subjectCache[cacheKey];
          if (!subjectId) continue;

          // Create assessment
          const title = `${col.subject} - ${typeLabel(col.type)}`;
          try {
            const result = await createAssessmentMut({
              title,
              subjectId,
              categoryId,
              totalMarks: globalMaxMarks,
              startsAt: new Date(startsAt).toISOString(),
              assessmentType: "offline",
            }).unwrap();
            const assessmentId = result?.data?.id ?? result?.id;
            if (assessmentId) globalBySubjectType[mapping.sheetName][`${col.subject}|${col.type}`] = assessmentId;
          } catch (err: any) {
            toast.error(`Failed to create "${title}": ${err?.data?.message ?? err?.message ?? "error"}`);
          }
        }
      }

      // Step 3: Refresh Redux state
      await Promise.all([dispatch(fetchAssessments()), dispatch(fetchSubjects())]);

      // Step 4: Auto-fill all column mappings
      setSheetMappings((prev) =>
        prev.map((m) => {
          const lookup = globalBySubjectType[m.sheetName];
          if (!lookup) return m;
          const sheet = parsedSheets.find((s) => s.sheetName === m.sheetName);
          return {
            ...m,
            colMappings: m.colMappings.map((c) => {
              if (c.assessmentId) return c;
              const colDef = sheet?.cols.find((sc) => sc.colIndex === c.colIndex);
              const mapped = colDef ? lookup[`${colDef.subject}|${colDef.type}`] : undefined;
              return mapped ? { ...c, assessmentId: mapped } : c;
            }),
          };
        })
      );

      const total = Object.values(globalBySubjectType).reduce((a, m) => a + Object.keys(m).length, 0);
      toast.success(`Created ${total} assessment(s) across all sheets and mapped columns`);
    } catch (err: any) {
      toast.error("Failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setCreatingAll(false);
    }
  };

  // Only requires at least one sheet to have a class mapped.
  // Columns can all be skipped — the upload step handles that gracefully.
  const canProceed = useMemo(() => sheetMappings.some((m) => m.classId), [sheetMappings]);

  const allSkipped = useMemo(
    () => sheetMappings.filter((m) => m.classId).every((m) => m.colMappings.every((c) => !c.assessmentId)),
    [sheetMappings]
  );

  // ── Step 3: fetch enrolled students + match ─────────────────────────────────

  const fetchAndMatch = async () => {
    setLoadingStudents(true);
    try {
      const enrolled: Record<string, any[]> = {};
      const matched: Record<string, MatchedStudent[]> = {};

      for (const mapping of sheetMappings) {
        if (!mapping.classId) continue;
        const sheet = parsedSheets.find((s) => s.sheetName === mapping.sheetName);
        if (!sheet) continue;

        let students: any[] = [];
        try {
          const res = await apiClient.get(`/api/proxy/classes/${mapping.classId}`);
          // Mirror exact logic from teacher fetchClassStudents thunk
          const classData = res.data?.data || res.data || {};
          if (classData.students && Array.isArray(classData.students)) {
            students = classData.students;
          } else if (classData.enrollments && Array.isArray(classData.enrollments)) {
            students = classData.enrollments
              .map((e: any) => e.student || e)
              .filter((s: any) => s && (s.id || s.firstName));
          }
        } catch {
          toast.error(`Could not load students for "${mapping.sheetName}"`);
        }
        if (students.length === 0) {
          toast.warning(`No enrolled students found for "${mapping.sheetName}" — scores will be skipped`);
        }

        enrolled[mapping.sheetName] = students;
        matched[mapping.sheetName] = buildMatches(sheet.students, students);
      }

      setEnrolledBySheet(enrolled);
      setMatchedBySheet(matched);
      setStep(3);
    } catch (err: any) {
      toast.error("Failed to load student data: " + (err?.message ?? "Unknown error"));
    } finally {
      setLoadingStudents(false);
    }
  };

  const updateMatch = (sheetName: string, idx: number, studentId: string) => {
    const enrolled = enrolledBySheet[sheetName] ?? [];
    const student = enrolled.find((e) => e.id === studentId);
    setMatchedBySheet((prev) => {
      const list = [...(prev[sheetName] ?? [])];
      list[idx] = {
        ...list[idx],
        studentId,
        displayName: student ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() : "",
        confidence: studentId ? "exact" : "none",
      };
      return { ...prev, [sheetName]: list };
    });
  };

  // ── Step 4: upload ──────────────────────────────────────────────────────────

  const handleUpload = async () => {
    setUploading(true);
    setStep(4);

    type Task = {
      sheetName: string; subject: string; type: string;
      assessmentId: string; scores: { studentId: string; marksAwarded: number; maxMarks: number }[];
    };

    const tasks: Task[] = [];

    for (const mapping of sheetMappings) {
      if (!mapping.classId) continue;
      const sheet = parsedSheets.find((s) => s.sheetName === mapping.sheetName);
      if (!sheet) continue;
      const matched = matchedBySheet[mapping.sheetName] ?? [];

      for (const cm of mapping.colMappings) {
        if (!cm.assessmentId || cm.assessmentId === "__skip__") continue;
        // Find the actual colIndex(es) for this subject+type in the sheet
        const relCols = sheet.cols.filter((c) => c.subject === cm.subject && c.type === cm.type);
        const assessment = assessments.find((a: any) => a.id === cm.assessmentId);
        const maxMarks: number = assessment?.totalMarks ?? 100;
        const scores: { studentId: string; marksAwarded: number; maxMarks: number }[] = [];

        for (const ms of matched) {
          if (!ms.studentId) continue;
          for (const col of relCols) {
            const v = ms.scores[col.colIndex];
            if (v !== null && v !== undefined) {
              scores.push({ studentId: ms.studentId, marksAwarded: v, maxMarks });
              break;
            }
          }
        }
        if (scores.length) tasks.push({ sheetName: mapping.sheetName, subject: cm.subject, type: cm.type, assessmentId: cm.assessmentId, scores });
      }
    }

    // ── Diagnostic: log breakdown so issues are visible in console ──────────────
    for (const mapping of sheetMappings) {
      if (!mapping.classId) continue;
      const matched = matchedBySheet[mapping.sheetName] ?? [];
      const mapped = mapping.colMappings.filter((c) => c.assessmentId);
      const matchedStudents = matched.filter((m) => m.studentId);
      console.info(`[BulkImport] Sheet "${mapping.sheetName}": ${matched.length} students (${matchedStudents.length} matched), ${mapping.colMappings.length} columns (${mapped.length} mapped to assessments)`);
      if (mapped.length === 0) console.warn(`[BulkImport]   ⚠ No columns mapped — did assessment creation succeed?`);
      if (matchedStudents.length === 0) console.warn(`[BulkImport]   ⚠ No students matched — check name format in Excel vs database`);
    }
    console.info(`[BulkImport] Total tasks to upload: ${tasks.length}`);

    if (tasks.length === 0) {
      // Figure out why and show a helpful toast
      const hasNoMapped = sheetMappings.filter((m) => m.classId).every((m) => m.colMappings.every((c) => !c.assessmentId));
      const hasNoMatched = Object.values(matchedBySheet).every((arr) => arr.every((s) => !s.studentId));
      if (hasNoMapped) toast.error("No columns are mapped to assessments. Select or create assessments in step 2 first.");
      else if (hasNoMatched) toast.error("No students were matched. Check the names in your Excel match the enrolled students.");
      else toast.warning("Nothing to upload — all score cells may be empty.");
    }

    setProgress({ done: 0, total: tasks.length });
    const uploadResults: UploadResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      try {
        await apiClient.post(`/api/proxy/assessments/${t.assessmentId}/scores`, { scores: t.scores });
        uploadResults.push({ sheetName: t.sheetName, subject: t.subject, type: t.type, sent: t.scores.length, ok: t.scores.length, failed: 0 });
      } catch (err: any) {
        uploadResults.push({
          sheetName: t.sheetName, subject: t.subject, type: t.type,
          sent: t.scores.length, ok: 0, failed: t.scores.length,
          error: err?.response?.data?.message ?? err?.message ?? "Unknown error",
        });
      }
      setProgress({ done: i + 1, total: tasks.length });
    }

    setResults(uploadResults);
    setUploading(false);
    const totalOk = uploadResults.reduce((a, r) => a + r.ok, 0);
    const totalFailed = uploadResults.reduce((a, r) => a + r.failed, 0);
    if (totalFailed === 0) toast.success(`All done! ${totalOk} score(s) uploaded.`);
    else toast.error(`${totalOk} succeeded, ${totalFailed} failed.`);
  };

  const reset = () => {
    setParsedSheets([]); setSheetMappings([]); setEnrolledBySheet({});
    setMatchedBySheet([]  as any); setResults([]); setStep(1); setUploading(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bulk Score Import</h1>
          <p className="text-sm text-slate-500 mt-1">
            Upload a school record sheet (Excel) and map each column to an assessment.
          </p>
        </div>
        <Link href="/RMS/scores">
          <Button variant="outline" className="rounded-xl border-slate-200 gap-2 h-10">
            <ArrowLeft className="w-4 h-4" /> Back to Scores
          </Button>
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8 px-2">
        {[
          { n: 1, label: "Upload" },
          { n: 2, label: "Map Columns" },
          { n: 3, label: "Review Students" },
          { n: 4, label: "Import" },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <StepDot n={s.n} current={step} label={s.label} color={primaryColor} />
            {i < arr.length - 1 && <StepLine done={step > s.n} color={primaryColor} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-violet-500" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-900">Upload your record sheet</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Supports multi-sheet Excel files (.xlsx / .xls). Each sheet should have subject columns
              with <strong>1st</strong>, <strong>2nd</strong>, and <strong>Exam</strong> sub-columns.
            </p>
          </div>
          <div
            className="w-full max-w-lg border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all"
            onClick={() => fileRef.current?.click()}
          >
            {parsing ? (
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            ) : (
              <Upload className="w-8 h-8 text-slate-400" />
            )}
            <p className="text-sm text-slate-500 font-medium">
              {parsing ? "Parsing file…" : "Click to choose file or drag and drop"}
            </p>
            <p className="text-xs text-slate-400">.xlsx, .xls accepted</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={parsing} />
          </div>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && (
        <div className="space-y-5">

          {/* ── Create Assessments Panel ── */}
          {allDetectedTypes.length > 0 && (
            <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-violet-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                    <Wand2 className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Auto-Create Assessments</p>
                    <p className="text-xs text-slate-500">Assign a category to each assessment type, then create all at once.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Type → Category rows */}
                {allDetectedTypes.map((type) => (
                  <div key={type} className="flex items-center gap-3 flex-wrap">
                    <Badge className="rounded-lg bg-violet-50 text-violet-700 border-0 text-sm font-semibold w-20 justify-center py-1.5">
                      {typeLabel(type)}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                    <Select
                      value={typeCategoryMap[type] || ""}
                      onValueChange={(v) => setTypeCategoryMap((prev) => ({ ...prev, [type]: v }))}
                    >
                      <SelectTrigger className="h-9 w-52 rounded-xl border-slate-200 text-sm">
                        <SelectValue placeholder="— Select category —" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="__new__">
                          <span className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" /> Create new category
                          </span>
                        </SelectItem>
                        {(categories as any[]).map((cat: any) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {typeCategoryMap[type] === "__new__" && (
                      <Input
                        className="h-9 w-44 rounded-xl border-slate-200 text-sm"
                        placeholder={`Category name (e.g. ${typeLabel(type)})`}
                        value={typeNewCategoryName[type] || ""}
                        onChange={(e) => setTypeNewCategoryName((prev) => ({ ...prev, [type]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}

                {/* Global settings row */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-slate-600 whitespace-nowrap">Max Marks:</Label>
                    <Input
                      type="number"
                      className="h-9 w-24 rounded-xl border-slate-200 text-sm"
                      value={globalMaxMarks}
                      min={1}
                      onChange={(e) => setGlobalMaxMarks(Number(e.target.value) || 100)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-slate-600 whitespace-nowrap">Starts At:</Label>
                    <Input
                      type="date"
                      className="h-9 w-44 rounded-xl border-slate-200 text-sm"
                      value={globalStartsAt}
                      onChange={(e) => setGlobalStartsAt(e.target.value)}
                    />
                  </div>
                  <Button
                    className="ml-auto rounded-xl gap-2 text-white"
                    style={{ backgroundColor: primaryColor }}
                    disabled={creatingAll || !sheetMappings.some((m) => m.classId) || allDetectedTypes.every((t) => !typeCategoryMap[t])}
                    onClick={handleCreateAll}
                  >
                    {creatingAll
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                      : <><Wand2 className="w-4 h-4" /> Create All Assessments</>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sheetMappings.map((mapping) => {
            const sheet = parsedSheets.find((s) => s.sheetName === mapping.sheetName)!;
            return (
              <div key={mapping.sheetName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Sheet header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{mapping.sheetName}</p>
                      <p className="text-xs text-slate-500">{sheet.students.length} students · {mapping.colMappings.length} assessment column(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 font-medium">Map to class:</span>
                    <Select value={mapping.classId || "__skip__"} onValueChange={(v) => updateClassId(mapping.sheetName, v === "__skip__" ? "" : v)}>
                      <SelectTrigger className="h-10 w-[180px] rounded-xl border-slate-200">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="__skip__">— Skip this sheet —</SelectItem>
                        {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Column mappings */}
                {mapping.classId && (
                  <div className="divide-y divide-slate-50">
                    {mapping.colMappings.map((cm) => {
                      const suggestions = suggestAssessment(mapping.classId, cm.subject, cm.type);
                      const pool = assessmentsForClass(mapping.classId);
                      return (
                        <div key={cm.colIndex} className="px-6 py-3 flex items-center gap-4">
                          <div className="flex items-center gap-2 w-56 flex-shrink-0">
                            <Badge className="rounded-lg bg-violet-50 text-violet-700 border-0 text-xs font-medium">
                              {cm.subject}
                            </Badge>
                            <Badge className="rounded-lg bg-slate-100 text-slate-600 border-0 text-xs font-medium">
                              {cm.type}
                            </Badge>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          <div className="flex-1">
                            <Select
                              value={cm.assessmentId || "__skip__"}
                              onValueChange={(v) => updateAssessmentId(mapping.sheetName, cm.colIndex, v)}
                            >
                              <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl max-h-60">
                                <SelectItem value="__skip__">— Skipped —</SelectItem>
                                {/* Suggested group */}
                                {suggestions.length > 0 && suggestions.length < pool.length && (
                                  <>
                                    <div className="px-3 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wide">Suggested</div>
                                    {suggestions.map((a: any) => (
                                      <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                                    ))}
                                    <div className="px-3 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wide">All</div>
                                  </>
                                )}
                                {pool.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })}

          {allSkipped && canProceed && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              All columns are set to <strong>Skipped</strong>. Select assessments for the columns you want to upload, or proceed to skip everything.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" className="rounded-xl border-slate-200 gap-2" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              className="rounded-xl gap-2 text-white"
              style={{ backgroundColor: primaryColor }}
              disabled={!canProceed || loadingStudents}
              onClick={fetchAndMatch}
            >
              {loadingStudents
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading students…</>
                : <>Review Students <ChevronRight className="w-4 h-4" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review students ── */}
      {step === 3 && (
        <div className="space-y-5">
          {sheetMappings.filter((m) => m.classId).map((mapping) => {
            const matched = matchedBySheet[mapping.sheetName] ?? [];
            const enrolled = enrolledBySheet[mapping.sheetName] ?? [];
            const exact = matched.filter((m) => m.confidence === "exact").length;
            const partial = matched.filter((m) => m.confidence === "partial").length;
            const none = matched.filter((m) => m.confidence === "none").length;

            return (
              <div key={mapping.sheetName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{mapping.sheetName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{exact} matched</span>
                      {partial > 0 && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{partial} partial</span>}
                      {none > 0 && <span className="text-xs text-red-500 font-medium flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{none} unmatched</span>}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-5">Name in File</th>
                        <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Status</th>
                        <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Matched Student</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.map((ms, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="py-3 px-5 text-sm font-medium text-slate-800">{ms.parsedName}</td>
                          <td className="py-3 px-3">
                            {ms.confidence === "exact" && <Badge className="rounded-lg bg-emerald-50 text-emerald-700 border-0 text-xs">Exact</Badge>}
                            {ms.confidence === "partial" && <Badge className="rounded-lg bg-amber-50 text-amber-700 border-0 text-xs">Partial</Badge>}
                            {ms.confidence === "none" && <Badge className="rounded-lg bg-red-50 text-red-600 border-0 text-xs">No match</Badge>}
                          </td>
                          <td className="py-3 px-3 min-w-[200px]">
                            <Select
                              value={ms.studentId}
                              onValueChange={(v) => updateMatch(mapping.sheetName, idx, v === "__none__" ? "" : v)}
                            >
                              <SelectTrigger className="h-9 rounded-xl border-slate-200 text-sm">
                                <SelectValue placeholder="— Skip student —" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl max-h-52">
                                <SelectItem value="__none__">— Skip student —</SelectItem>
                                {enrolled.map((e: any) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {`${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || e.studentId || e.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" className="rounded-xl border-slate-200 gap-2" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              className="rounded-xl gap-2 text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={handleUpload}
            >
              Start Import <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Upload / Results ── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          {uploading ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <Loader2 className="w-12 h-12 animate-spin text-violet-500" />
              <div className="text-center">
                <p className="font-bold text-slate-900 text-lg">Uploading scores…</p>
                <p className="text-slate-500 text-sm mt-1">{progress.done} of {progress.total} assessment(s) done</p>
              </div>
              <div className="w-full max-w-sm bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, backgroundColor: primaryColor }}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Import Complete</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {results.reduce((a, r) => a + r.ok, 0)} scores uploaded · {results.reduce((a, r) => a + r.failed, 0)} failed
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 overflow-hidden mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-5">Sheet</th>
                      <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Subject</th>
                      <th className="text-left text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Type</th>
                      <th className="text-center text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Sent</th>
                      <th className="text-center text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">OK</th>
                      <th className="text-center text-xs text-slate-500 font-semibold uppercase tracking-wide py-3 px-3">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-3 px-5 text-sm text-slate-700 font-medium">{r.sheetName}</td>
                        <td className="py-3 px-3 text-sm text-slate-600">{r.subject}</td>
                        <td className="py-3 px-3">
                          <Badge className="rounded-lg bg-slate-100 text-slate-600 border-0 text-xs">{r.type}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center text-sm text-slate-600">{r.sent}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-semibold text-emerald-600">{r.ok}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {r.failed > 0
                            ? <span className="text-sm font-semibold text-red-500" title={r.error}>{r.failed}</span>
                            : <span className="text-sm text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" className="rounded-xl border-slate-200 gap-2" onClick={reset}>
                  <RefreshCw className="w-4 h-4" /> Import Another File
                </Button>
                <Link href="/RMS/scores">
                  <Button className="rounded-xl text-white gap-2" style={{ backgroundColor: primaryColor }}>
                    View Scores
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
