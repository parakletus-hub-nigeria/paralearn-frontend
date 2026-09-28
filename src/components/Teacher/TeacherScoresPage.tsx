"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchTeacherClasses,
  fetchAssessmentsByClassSubject,
  fetchScoresByAssessmentTeacher,
  uploadOfflineScores,
  bulkUploadScoresExcel,
  fetchClassStudents,
  fetchClassSubjects,
  publishAssessment,
} from "@/reduxToolKit/teacher/teacherThunks";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";
import { TeacherHeader } from "./TeacherHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Upload,
  Save,
  TrendingUp,
  GraduationCap,
  BookOpen,
  ClipboardList,
  CheckCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

import { ProductTour } from "@/components/common/ProductTour";

const teacherScoresTourSteps = [
  {
    target: ".teacher-scores-filter-bar",
    content:
      "Start by selecting a class, subject, and term. The score sheet below will populate with your enrolled students ready for you to fill in their scores.",
    disableBeacon: true,
  },
  {
    target: ".teacher-scores-table",
    content:
      "This is the live score sheet. Click any cell to enter or edit a student's score for each assessment. Changes are tracked automatically and highlighted.",
  },
  {
    target: ".teacher-scores-save-btn",
    content:
      "Once you've entered all scores, click 'Save Scores' to push them to the system. You can also download a CSV template to fill offline and import it back.",
  },
];

export function TeacherScoresPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { teacherClasses, assessmentsByClassSubject, loading } = useSelector(
    (s: RootState) => s.teacher,
  );
  const { user } = useSelector((s: RootState) => s.user);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [search, setSearch] = useState("");

  // Get dynamic session/term options
  const { allTermOptions, currentTerm: apiCurrentTerm } = useSessionsAndTerms();

  // Set default term from API
  useEffect(() => {
    if (apiCurrentTerm && !selectedTerm) {
      setSelectedTerm(apiCurrentTerm);
    }
  }, [apiCurrentTerm, selectedTerm]);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingScores, setExistingScores] = useState<any[]>([]);
  const [editedScores, setEditedScores] = useState<
    Map<string, Map<string, string>>
  >(new Map()); // studentId -> assessmentId -> score

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadAssessmentId, setUploadAssessmentId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assessment publish state
  const [publishingAssessmentId, setPublishingAssessmentId] = useState<string | null>(null);

  const handlePublishToggle = async (assessmentId: string, currentlyPublished: boolean) => {
    setPublishingAssessmentId(assessmentId);
    try {
      await dispatch(
        publishAssessment({ assessmentId, publish: !currentlyPublished }),
      ).unwrap();
      toast.success(
        currentlyPublished
          ? "Assessment unpublished — students can no longer see scores"
          : "Assessment published — students can now view their scores",
      );
    } catch (e: any) {
      toast.error(e || `Failed to ${currentlyPublished ? "unpublish" : "publish"} assessment`);
    } finally {
      setPublishingAssessmentId(null);
    }
  };

  // Extract unique classes
  const uniqueClasses = useMemo(() => {
    const classMap = new Map<string, any>();
    (teacherClasses || []).forEach((item: any) => {
      const classId = item.class?.id || item.classId || item.id;
      const className = item.class?.name || item.className || item.name;
      const studentCount =
        item.class?.studentCount ||
        item.class?.enrollmentCount ||
        item.studentCount ||
        item.enrollmentCount ||
        0;
      if (classId && className && !classMap.has(classId)) {
        classMap.set(classId, { id: classId, name: className, studentCount });
      }
    });
    return Array.from(classMap.values());
  }, [teacherClasses]);

  // Fetch teacher's classes on mount
  useEffect(() => {
    const teacherId = (user as any)?.id || (user as any)?.teacherId;
    if (teacherId) {
      dispatch(fetchTeacherClasses({ teacherId }));
    }
  }, [dispatch, user]);

  // Load subjects when class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }
    setLoadingSubjects(true);
    dispatch(fetchClassSubjects(selectedClassId))
      .unwrap()
      .then((data) => setSubjects(data || []))
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [dispatch, selectedClassId]);

  // Fetch assessments when both class and subject are selected
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      return;
    }
    setLoadingScores(true);
    dispatch(
      fetchAssessmentsByClassSubject({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
      }),
    )
      .unwrap()
      .catch(() => {
        console.error("[TeacherScoresPage] Failed to fetch assessments");
      })
      .finally(() => setLoadingScores(false));
  }, [dispatch, selectedClassId, selectedSubjectId]);

  // Load students when class is selected
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);

    // First fetch basic student list from class
    dispatch(fetchClassStudents(selectedClassId))
      .unwrap()
      .then(async (data) => {
        if (data && data.length > 0) {
          try {
            // Fetch ONLY users with role=student — this is the authoritative whitelist.
            // The enrollment response does NOT include roles on student objects, so we
            // cannot filter by role on the enrollment data itself. Instead, we cross-reference
            // against the student-only users list.
            const usersResp = await apiClient.get("/api/proxy/users?role=student");
            const usersData = usersResp.data;
            const studentUsers: any[] = usersData?.data || usersData || [];

            // Build an ID set of confirmed students
            const studentIdSet = new Set(studentUsers.map((u: any) => u.id));

            const enrichedStudents = data
              .filter((student: any) => studentIdSet.has(student.id))
              .map((student: any) => {
                const match = studentUsers.find((u: any) => u.id === student.id);
                return { ...student, ...match };
              });

            setStudents(enrichedStudents);
          } catch (error) {
            console.error("[TeacherScores] Failed to fetch student data:", error);
            // Fallback: enrollment records include studentId (e.g. STU-S-26-00001) for real
            // students. Teachers enrolled in a class won't have this code field.
            setStudents(data.filter((u: any) => !!u.studentId));
          }
        } else {
          setStudents([]);
        }
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [dispatch, selectedClassId]);

  // Filter assessments by class and subject
  // Use assessments for the selected class/subject - no need to filter further
  const relevantAssessments = useMemo(() => {
    return assessmentsByClassSubject || [];
  }, [assessmentsByClassSubject]);

  // Load existing scores for ALL relevant assessments in parallel
  useEffect(() => {
    if (relevantAssessments.length === 0) {
      setExistingScores([]);
      setEditedScores(new Map());
      return;
    }

    setLoadingScores(true);

    // For each assessment, determine strategy:
    //   - Online (CBT) → read submission scores already embedded in the assessment object
    //   - Offline      → hit /scores/assessment/:id as usual
    Promise.all(
      relevantAssessments.map(async (assessment: any) => {
        const isOnline =
          assessment.assessmentType === "online" ||
          assessment.isOnline === true;

        if (isOnline) {
          try {
            const res = await apiClient.get(
              `/api/proxy/assessments/${assessment.id}/submissions`,
            );
            const submissions = res.data?.data || res.data || [];

            // CBT scores come from submissions — pick the latest one per student
            const gradedByStudent = new Map<string, any>();

            submissions.forEach((sub: any) => {
              if (sub.studentId) {
                // Keep the most-recently-created submission per student
                const existing = gradedByStudent.get(sub.studentId);
                if (
                  !existing ||
                  new Date(sub.createdAt) > new Date(existing.createdAt)
                ) {
                  gradedByStudent.set(sub.studentId, sub);
                }
              }
            });

            // Convert to a shape compatible with the offline score format
            const scores = Array.from(gradedByStudent.values()).map(
              (sub: any) => ({
                studentId: sub.studentId,
                marksAwarded: sub.score ?? 0,
                score: sub.score ?? 0,
                assessmentId: assessment.id,
              }),
            );

            return { assessmentId: assessment.id, scores };
          } catch (e) {
            console.error(
              `[TeacherScores] Failed to fetch CBT submissions for ${assessment.id}`,
              e,
            );
            return { assessmentId: assessment.id, scores: [] };
          }
        }

        // Offline — fetch from dedicated scores endpoint
        try {
          const result = await dispatch(
            fetchScoresByAssessmentTeacher(assessment.id),
          ).unwrap();
          return { assessmentId: assessment.id, scores: result || [] };
        } catch (e) {
          console.error(
            `Failed to fetch scores for assessment ${assessment.id}`,
            e,
          );
          return { assessmentId: assessment.id, scores: [] };
        }
      }),
    )
      .then((results) => {
        const allScores = results.flatMap((r) => r.scores);
        setExistingScores(allScores);

        // Populate editedScores map: StudentId → AssessmentId → Score
        const scoreMap = new Map<string, Map<string, string>>();

        results.forEach(({ assessmentId, scores }) => {
          scores.forEach((s: any) => {
            const studentId = s.studentId || s.student?.id;
            if (studentId) {
              if (!scoreMap.has(studentId)) {
                scoreMap.set(studentId, new Map());
              }
              // Prefer marksAwarded, fall back to score
              const val =
                s.marksAwarded?.toString() ?? s.score?.toString() ?? "";
              scoreMap.get(studentId)!.set(assessmentId, val);
            }
          });
        });

        setEditedScores(scoreMap);
      })
      .catch(() => {
        // FIX #6: Promise.all outer catch — show error instead of silently leaving empty
        toast.error("Failed to load scores. Please refresh and try again.");
      })
      .finally(() => setLoadingScores(false));
  }, [dispatch, relevantAssessments]);

  // Calculate composite Total per student (sum of all assessment scores)
  const getStudentTotal = (studentId: string) => {
    const studentScores = editedScores.get(studentId);
    if (!studentScores) return 0;

    let total = 0;
    studentScores.forEach((val) => {
      total += parseFloat(val) || 0;
    });
    return total;
  };

  // Calculate class average based on Totals
  const classAverage = useMemo(() => {
    if (editedScores.size === 0) return 0;
    let totalSum = 0;
    let count = 0;

    editedScores.forEach((_, studentId) => {
      const studentTotal = getStudentTotal(studentId);
      if (studentTotal > 0) {
        totalSum += studentTotal;
        count++;
      }
    });

    return count > 0 ? Math.round(totalSum / count) : 0;
  }, [editedScores]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const term = search.toLowerCase();
    return students.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(term) ||
        (s.studentId || "").toLowerCase().includes(term),
    );
  }, [students, search]);

  const handleScoreChange = (
    studentId: string,
    assessmentId: string,
    value: string,
  ) => {
    // Clamp to valid range [0, totalMarks]
    const assessment = relevantAssessments.find(
      (a: any) => a.id === assessmentId,
    );
    const max = assessment?.totalMarks || 100;
    const numVal = parseFloat(value);
    const clamped = !isNaN(numVal)
      ? String(Math.min(max, Math.max(0, numVal)))
      : value;

    setEditedScores((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(studentId)) {
        newMap.set(studentId, new Map());
      }
      const studentScores = new Map(newMap.get(studentId)!);
      studentScores.set(assessmentId, clamped);
      newMap.set(studentId, studentScores);
      return newMap;
    });
  };

  const getGrade = (total: number) => {
    if (total >= 70) return { grade: "A", badgeBg: "var(--emerald-signal)", scoreColor: "var(--emerald-signal)" };
    if (total >= 60) return { grade: "B", badgeBg: "var(--cobalt-signal)", scoreColor: "var(--cobalt-signal)" };
    if (total >= 50) return { grade: "C", badgeBg: "var(--amber-signal)", scoreColor: "var(--amber-signal)" };
    if (total >= 40) return { grade: "D", badgeBg: "oklch(0.62 0.19 45)", scoreColor: "oklch(0.62 0.19 45)" };
    return { grade: "F", badgeBg: "var(--crimson-signal)", scoreColor: "var(--crimson-signal)" };
  };

  const handleSaveScores = async () => {
    if (!selectedClassId) return toast.error("Please select a class");
    if (relevantAssessments.length === 0)
      return toast.error("No assessments available");
    if (students.length === 0) return toast.error("No students found");

    // Group scores by assessmentId: { assessmentId -> [{studentId, marksAwarded, maxMarks}] }
    const scoresByAssessment = new Map<
      string,
      Array<{ studentId: string; marksAwarded: number; maxMarks: number }>
    >();

    relevantAssessments.forEach((assessment: any) => {
      const maxMarks = assessment.totalMarks || 100;
      const scoresForAssessment: Array<{
        studentId: string;
        marksAwarded: number;
        maxMarks: number;
      }> = [];

      students.forEach((student: any) => {
        const studentId = student.id;
        const rawVal = editedScores.get(studentId)?.get(assessment.id);
        const marksAwarded = parseFloat(rawVal ?? "");

        if (!isNaN(marksAwarded)) {
          scoresForAssessment.push({ studentId, marksAwarded, maxMarks });
        }
      });

      if (scoresForAssessment.length > 0) {
        scoresByAssessment.set(assessment.id, scoresForAssessment);
      }
    });

    if (scoresByAssessment.size === 0)
      return toast.error("No valid scores to save");

    setSaving(true);
    try {
      // Execute uploads in parallel
      const uploadPromises = Array.from(scoresByAssessment.entries()).map(
        ([assessmentId, scores]) => {
          return dispatch(
            uploadOfflineScores({ assessmentId, scores }),
          ).unwrap();
        },
      );

      await Promise.all(uploadPromises);
      toast.success(
        `Detailed scores saved successfully for ${uploadPromises.length} assessments`,
      );

      // Reload logic omitted to prevent breaking UI state if it fails, but user gets success toast
    } catch (e: any) {
      toast.error(
        e?.data?.message || e?.message || "Failed to save some scores",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleImport = () => {
    // Only allow import if we have offline assessments and students
    const offlineAssessments = relevantAssessments.filter(
      (a: any) => !a.isOnline,
    );
    if (offlineAssessments.length === 0) {
      toast.info("No offline assessments available to import scores for.");
      return;
    }
    if (students.length === 0) {
      toast.info("No students loaded in this class.");
      return;
    }
    setUploadAssessmentId(offlineAssessments[0].id);
    setShowUploadModal(true);
  };

  const handleDownloadTemplate = () => {
    if (!uploadAssessmentId || students.length === 0) return;
    const assessment = relevantAssessments.find(
      (a: any) => a.id === uploadAssessmentId,
    );
    if (!assessment) return;

    // Create a template pre-filled with the students currently in the table
    const data = students.map((s) => ({
      studentId: s.studentId || s.id,
      studentName: `${s.firstName || ""} ${s.lastName || ""} (Reference Only — do not edit)`,
      marksAwarded: "", // Teacher fills this
      remarks: "",
    }));

    const filename = `scores_template_${(assessment.title || "assessment").replace(/\s+/g, "_")}.xlsx`;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    const wscols = Object.keys(data[0]).map(() => ({ wch: 30 }));
    ws["!cols"] = wscols;
    XLSX.utils.book_append_sheet(wb, ws, "Scores Template");
    XLSX.writeFile(wb, filename);

    toast.success("Template downloaded successfully");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadAssessmentId) {
      toast.error("Please select an assessment.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          toast.error("The uploaded file is empty.");
          return;
        }

        const assessment = relevantAssessments.find(
          (a: any) => a.id === uploadAssessmentId,
        );
        const maxMarks = assessment?.totalMarks || 100;
        let importCount = 0;

        setEditedScores((prev) => {
          const newMap = new Map(prev);

          data.forEach((row) => {
            // Try to find the student ID column
            const rawStudentId =
              row.studentId ||
              row.studentID ||
              row["Student ID"] ||
              row["StudentId"];
            const rawMarks =
              row.marksAwarded ||
              row.Marks ||
              row["Marks Awarded"] ||
              row.score ||
              row.Score;

            if (!rawStudentId || rawMarks === undefined || rawMarks === "")
              return;

            // Match student ID robustly
            const studentIdStr = String(rawStudentId).trim().toLowerCase();
            const studentMatch = students.find(
              (s) =>
                (s.id && String(s.id).toLowerCase() === studentIdStr) ||
                (s.studentId &&
                  String(s.studentId).toLowerCase() === studentIdStr) ||
                (s.admissionNo &&
                  String(s.admissionNo).toLowerCase() === studentIdStr),
            );

            if (studentMatch) {
              let marksNum = parseFloat(rawMarks);
              if (isNaN(marksNum)) return;

              // Clamp the imported value
              marksNum = Math.min(maxMarks, Math.max(0, marksNum));

              if (!newMap.has(studentMatch.id)) {
                newMap.set(studentMatch.id, new Map());
              }
              const studentScores = new Map(newMap.get(studentMatch.id)!);
              studentScores.set(uploadAssessmentId, String(marksNum));
              newMap.set(studentMatch.id, studentScores);
              importCount++;
            }
          });
          return newMap;
        });

        if (importCount > 0) {
          toast.success(`Successfully imported ${importCount} scores.`);
          setShowUploadModal(false);
        } else {
          toast.error(
            "Could not match any student IDs from the file. Please ensure you used the downloaded template.",
          );
        }
      } catch (err) {
        console.error("Error reading Excel", err);
        toast.error(
          "Failed to parse the file. Please upload a valid Excel or CSV.",
        );
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  const selectedSubject = subjects.find((s: any) => s.id === selectedSubjectId);

  const totalEntries = Array.from(editedScores.values()).reduce(
    (acc, map) => acc + map.size,
    0,
  );

  return (
    <div className="w-full">
      <TeacherHeader />
      <ProductTour tourKey="teacher_scores" steps={teacherScoresTourSteps} />

      <div className="overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5" style={{ borderBottom: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
          <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                Score Sheet
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                {selectedSubject?.name || "Select a subject"} • {selectedTerm} •{" "}
                {new Date().getFullYear()}/{new Date().getFullYear() + 1}
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 sm:h-11 w-full sm:w-[220px]"
                style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-fine)" }}
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="teacher-scores-filter-bar px-4 sm:px-6 py-4" style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Class */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                <GraduationCap className="w-3.5 h-3.5" /> Class
              </span>
              <Select
                value={selectedClassId}
                onValueChange={(v) => {
                  setSelectedClassId(v);
                  setSelectedSubjectId("");
                }}
              >
                <SelectTrigger className="h-10 sm:h-11 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {uniqueClasses.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--foreground-muted)" }}>
                <BookOpen className="w-3.5 h-3.5" /> Subject
              </span>
              <Select
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                disabled={!selectedClassId || loadingSubjects}
              >
                <SelectTrigger className="h-10 sm:h-11 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue
                    placeholder={
                      loadingSubjects ? "Loading..." : "Select Subject"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {subjects.map((subj: any) => (
                    <SelectItem key={subj.id} value={subj.id}>
                      {subj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Term */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                Term
              </span>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="h-10 sm:h-11 w-full rounded-xl border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {allTermOptions.map((opt) => (
                    <SelectItem key={opt.id || opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class Average */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
                Class Average
              </span>
              <div className="flex items-center gap-2 h-10 sm:h-11 px-3 sm:px-4" style={{ borderRadius: "var(--radius-lg)", border: "1px solid color-mix(in oklch, var(--emerald-signal) 25%, transparent)", background: "var(--emerald-tint)" }}>
                <span className="text-xl sm:text-2xl font-bold" style={{ color: "var(--emerald-signal)" }}>
                  {classAverage}%
                </span>
                <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5" style={{ color: "var(--emerald-signal)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Score Table */}
        <div className="teacher-scores-table overflow-x-auto">
          {loadingStudents || loadingScores ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-10 w-10 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
            </div>
          ) : !selectedClassId ? (
            <div className="text-center py-20" style={{ color: "var(--foreground-muted)" }}>
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Select a class to view students</p>
            </div>
          ) : !selectedSubjectId ? (
            <div className="text-center py-20" style={{ color: "var(--foreground-muted)" }}>
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Select a subject to view assessments</p>
            </div>
          ) : relevantAssessments.length === 0 ? (
            <div className="text-center py-20" style={{ color: "var(--foreground-muted)" }}>
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No assessments found for this subject</p>
              <p className="text-sm mt-1 opacity-75">Create an assessment to start grading</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-20" style={{ color: "var(--foreground-muted)" }}>
              <p className="font-medium">No students found in this class</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden px-4 pb-4">
                {filteredStudents.map((student: any, idx: number) => {
                  const studentId = student.id;
                  const displayId =
                    student.studentId ||
                    student.code ||
                    student.admissionNo ||
                    "—";
                  const studentTotal = getStudentTotal(studentId);
                  const { grade, badgeBg, scoreColor } = getGrade(studentTotal);

                  return (
                    <div
                      key={studentId || idx}
                      className="p-4 mb-3 bg-white"
                      style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}
                    >
                      {/* Student Header */}
                      <div className="flex items-start justify-between mb-3 pb-3" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                        <div className="flex-1">
                          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--foreground-muted)" }}>
                            Student ID
                          </div>
                          <div className="font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                            {displayId}
                          </div>
                        </div>
                        <div className="text-right text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {idx + 1}
                        </div>
                      </div>

                      {/* Student Name */}
                      <div className="mb-4">
                        <h3 className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
                          {student.firstName} {student.lastName}
                        </h3>
                      </div>

                      {/* Assessment Scores */}
                      <div className="space-y-3 mb-4">
                        {relevantAssessments.map((assessment: any) => {
                          const score =
                            editedScores.get(studentId)?.get(assessment.id) ||
                            "";
                          const max = assessment.totalMarks || 100;
                          const isOnline =
                            assessment.assessmentType === "online" ||
                            assessment.isOnline === true;
                          const isPublished = !!assessment.isPublished;
                          const isToggling = publishingAssessmentId === assessment.id;

                          return (
                            <div key={assessment.id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs flex items-center gap-1.5" style={{ color: "var(--foreground-muted)" }}>
                                  {assessment.title} ({max})
                                  {isOnline && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold leading-none" style={{ background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" }}>
                                      CBT
                                    </span>
                                  )}
                                </label>
                                {idx === 0 && (
                                  <button
                                    onClick={() => handlePublishToggle(assessment.id, isPublished)}
                                    disabled={isToggling}
                                    className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                                    style={isPublished
                                      ? { background: "var(--emerald-tint)", color: "var(--emerald-signal)" }
                                      : { background: "var(--amber-tint)", color: "var(--amber-signal)" }}
                                  >
                                    {isToggling ? "…" : isPublished ? "Published" : "Unpublished"}
                                  </button>
                                )}
                              </div>
                              <div
                                onClick={() => {
                                  if (isOnline)
                                    toast.info(
                                      "You cannot overwrite CBT scores manually.",
                                    );
                                }}
                              >
                                <Input
                                  type="number"
                                  min="0"
                                  max={max}
                                  value={score}
                                  onChange={(e) => {
                                    if (isOnline) return;
                                    handleScoreChange(
                                      studentId,
                                      assessment.id,
                                      e.target.value,
                                    );
                                  }}
                                  readOnly={isOnline}
                                  placeholder="—"
                                  className="h-11 text-base"
                                  style={isOnline
                                    ? { borderRadius: "var(--radius-md)", background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground-muted)", cursor: "not-allowed" }
                                    : { borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total and Grade */}
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-fine)" }}>
                        <div>
                          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--foreground-muted)" }}>
                            Total Score
                          </div>
                          <span className="font-bold text-2xl" style={{ color: studentTotal > 0 ? scoreColor : "var(--foreground-muted)" }}>
                            {studentTotal > 0 ? studentTotal : "—"}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide mb-1 text-right" style={{ color: "var(--foreground-muted)" }}>
                            Grade
                          </div>
                          {studentTotal > 0 ? (
                            <span
                              className="inline-flex items-center justify-center w-12 h-12 text-white font-bold text-lg"
                              style={{ borderRadius: "var(--radius-lg)", background: badgeBg }}
                            >
                              {grade}
                            </span>
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-muted)" }}>
                              <span className="text-lg" style={{ color: "var(--foreground-muted)" }}>—</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block relative">
                <div className="overflow-x-auto" style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)" }}>
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr style={{ background: "var(--foreground)", color: "white" }}>
                        <th className="sticky left-0 z-10 text-left font-semibold py-3 sm:py-4 px-3 sm:px-5 text-xs sm:text-sm w-[50px] sm:w-[60px]" style={{ background: "var(--foreground)" }}>
                          S/N
                        </th>
                        <th className="sticky left-[50px] sm:left-[60px] z-10 text-left font-semibold py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm min-w-[100px] sm:min-w-[120px]" style={{ background: "var(--foreground)" }}>
                          ID
                        </th>
                        <th className="sticky left-[150px] sm:left-[180px] z-10 text-left font-semibold py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm min-w-[150px] sm:min-w-[200px]" style={{ background: "var(--foreground)" }}>
                          NAME
                        </th>
                        {/* Dynamic Assessment Columns */}
                        {relevantAssessments.map((assessment: any) => {
                          const isOnline =
                            assessment.assessmentType === "online" ||
                            assessment.isOnline === true;
                          const isPublished = !!assessment.isPublished;
                          const isToggling = publishingAssessmentId === assessment.id;
                          return (
                            <th
                              key={assessment.id}
                              className="text-center font-semibold py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm min-w-[100px] sm:min-w-[120px]"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="truncate max-w-[80px] sm:max-w-none flex items-center justify-center gap-1">
                                  {assessment.title}
                                  {isOnline && (
                                    <span className="px-1 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold leading-none translate-y-[0.5px]" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                                      CBT
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] opacity-70">
                                  ({assessment.totalMarks || 100})
                                </span>
                                <button
                                  onClick={() => handlePublishToggle(assessment.id, isPublished)}
                                  disabled={isToggling}
                                  title={isPublished ? "Click to unpublish (hide from students)" : "Click to publish (show scores to students)"}
                                  className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                                  style={isPublished
                                    ? { background: "var(--emerald-tint)", color: "var(--emerald-signal)" }
                                    : { background: "var(--amber-tint)", color: "var(--amber-signal)" }}
                                >
                                  {isToggling ? "…" : isPublished ? "Published" : "Unpublished"}
                                </button>
                              </div>
                            </th>
                          );
                        })}
                        <th className="text-center font-semibold py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm w-[80px] sm:w-[100px]" style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                          TOTAL
                        </th>
                        <th className="text-center font-semibold py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm w-[70px] sm:w-[80px]">
                          GRADE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student: any, idx: number) => {
                        const studentId = student.id;
                        const displayId =
                          student.studentId ||
                          student.code ||
                          student.admissionNo ||
                          "—";
                        const studentTotal = getStudentTotal(studentId);
                        const { grade, badgeBg, scoreColor } =
                          getGrade(studentTotal);

                        return (
                          <tr
                            key={studentId || idx}
                            className="transition-colors"
                            style={{ borderBottom: "1px solid var(--border-fine)", background: idx % 2 === 0 ? "white" : "var(--surface-muted)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "white" : "var(--surface-muted)")}
                          >
                            <td className="sticky left-0 z-10 bg-inherit py-3 sm:py-4 px-3 sm:px-5 text-xs sm:text-sm font-medium" style={{ color: "var(--foreground-muted)" }}>
                              {idx + 1}
                            </td>
                            <td className="sticky left-[50px] sm:left-[60px] z-10 bg-inherit py-3 sm:py-4 px-2 sm:px-3 text-xs sm:text-sm font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                              {displayId}
                            </td>
                            <td className="sticky left-[150px] sm:left-[180px] z-10 bg-inherit py-3 sm:py-4 px-2 sm:px-3">
                              <span className="font-semibold text-xs sm:text-sm" style={{ color: "var(--foreground)" }}>
                                {student.firstName} {student.lastName}
                              </span>
                            </td>

                            {/* Dynamic Assessment Inputs */}
                            {relevantAssessments.map((assessment: any) => {
                              const score =
                                editedScores
                                  .get(studentId)
                                  ?.get(assessment.id) || "";
                              const max = assessment.totalMarks || 100;
                              const isOnline =
                                assessment.assessmentType === "online" ||
                                assessment.isOnline === true;

                              return (
                                <td
                                  key={assessment.id}
                                  className="py-3 sm:py-4 px-2 sm:px-3 text-center"
                                >
                                  <div
                                    onClick={() => {
                                      if (isOnline)
                                        toast.info(
                                          "You cannot overwrite CBT scores manually.",
                                        );
                                    }}
                                  >
                                    <Input
                                      type="number"
                                      min="0"
                                      max={max}
                                      value={score}
                                      onChange={(e) => {
                                        if (isOnline) return;
                                        handleScoreChange(
                                          studentId,
                                          assessment.id,
                                          e.target.value,
                                        );
                                      }}
                                      readOnly={isOnline}
                                      placeholder="—"
                                      className="h-8 sm:h-10 w-[60px] sm:w-[70px] text-xs sm:text-sm text-center mx-auto"
                                      style={isOnline
                                        ? { borderRadius: "var(--radius-md)", background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground-muted)", cursor: "not-allowed" }
                                        : { borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}
                                    />
                                  </div>
                                </td>
                              );
                            })}

                            <td className="py-3 sm:py-4 px-2 sm:px-3 text-center" style={{ borderLeft: "1px solid var(--border-fine)" }}>
                              <span className="font-bold text-base sm:text-lg" style={{ color: studentTotal > 0 ? scoreColor : "var(--foreground-muted)" }}>
                                {studentTotal > 0 ? studentTotal : "—"}
                              </span>
                            </td>
                            <td className="py-3 sm:py-4 px-2 sm:px-3 text-center">
                              {studentTotal > 0 ? (
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 text-white font-bold text-xs sm:text-sm"
                                  style={{ borderRadius: "var(--radius-md)", background: badgeBg }}
                                >
                                  {grade}
                                </span>
                              ) : (
                                <span style={{ color: "var(--foreground-muted)" }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedClassId &&
          selectedSubjectId &&
          filteredStudents.length > 0 && (
            <div className="px-4 sm:px-6 py-4" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  {totalEntries > 0 ? (
                    <>
                      <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--amber-signal)" }} />
                      <span className="text-xs sm:text-sm" style={{ color: "var(--foreground)" }}>
                        Ready to save scores
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                      <span className="text-xs sm:text-sm" style={{ color: "var(--foreground-muted)" }}>
                        No scores entered yet
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    className="flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 text-sm flex-1 sm:flex-none font-medium"
                    style={{ borderRadius: "var(--radius-lg)", border: "1px solid color-mix(in oklch, var(--emerald-signal) 30%, transparent)", color: "var(--emerald-signal)" }}
                    onClick={handleImport}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--emerald-tint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <Upload className="w-4 h-4" />
                    Bulk Upload
                  </button>
                  <button
                    className="flex items-center gap-2 h-10 sm:h-11 px-4 sm:px-5 text-sm flex-1 sm:flex-none font-medium disabled:opacity-50"
                    style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)", color: "var(--foreground-muted)" }}
                    disabled={totalEntries === 0}
                    onClick={() => setEditedScores(new Map())}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleSaveScores}
                    disabled={saving || totalEntries === 0}
                    className="teacher-scores-save-btn flex items-center gap-2 h-10 sm:h-11 px-5 sm:px-6 text-white font-semibold text-sm flex-1 sm:flex-none disabled:opacity-50"
                    style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-ink)" }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save Scores"}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Upload Scores</DialogTitle>
            <DialogDescription>
              Select an offline assessment, download the template, fill it, and
              upload the file.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Assessment
              </label>
              <Select
                value={uploadAssessmentId}
                onValueChange={setUploadAssessmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Assessment" />
                </SelectTrigger>
                <SelectContent>
                  {relevantAssessments
                    .filter((a: any) => !a.isOnline)
                    .map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title} ({a.totalMarks} marks)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <Button
                onClick={handleDownloadTemplate}
                variant="outline"
                className="w-full flex justify-between items-center"
                style={{ background: "var(--surface-muted)" }}
              >
                <span>1. Download Pre-filled Template</span>
                <Download className="w-4 h-4" />
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  title="Upload Filled Template"
                />
                <Button
                  variant="outline"
                  className="w-full flex justify-between items-center text-white pointer-events-none border-none"
                  style={{ background: "var(--violet-ink)" }}
                >
                  <span>2. Upload Filled Template</span>
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
