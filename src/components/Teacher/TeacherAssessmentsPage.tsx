"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  createTeacherAssessment,
  fetchMyAssessments,
  fetchTeacherClasses,
  fetchClassSubjects,
  fetchAcademicCurrent,
  fetchAssessmentCategories,
  updateTeacherAssessment,
  deleteTeacherAssessment,
  publishAssessment,
} from "@/reduxToolKit/teacher/teacherThunks";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";
import { TeacherHeader } from "./TeacherHeader";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreVertical,
  Clock,
  RefreshCcw,
  FileText,
  Edit,
  BarChart3,
  X,
  BookOpen,
  ClipboardList,
  Grid3X3,
  List,
  CheckCircle,
  PlayCircle,
  Sparkles,
  Send,
  Trash2,
} from "lucide-react";
import { routespath } from "@/lib/routepath";
import { toast } from "sonner";

import { ProductTour } from "@/components/common/ProductTour";

const teacherAssessmentsTourSteps = [
  {
    target: ".teacher-assessments-create-btn",
    content:
      "Create a new assessment here. You can set it as an online exam for students to take directly on the platform, or an offline assessment where you record scores manually.",
    disableBeacon: true,
  },
  {
    target: ".teacher-assessments-stats",
    content:
      "These status counts give you a live overview of all your assessments — how many are active (live now), not yet started, or have ended.",
  },
  {
    target: ".teacher-assessments-filter-bar",
    content:
      "Use these filters to narrow down your assessment list by class, subject, or status. The search bar also lets you find a specific assessment by title.",
  },
];

const statusConfig: Record<string, { background: string; color: string; icon: typeof CheckCircle; label: string }> = {
  started: { background: "var(--emerald-tint)", color: "var(--emerald-signal)", icon: PlayCircle, label: "Active" },
  active: { background: "var(--emerald-tint)", color: "var(--emerald-signal)", icon: PlayCircle, label: "Active" },
  ended: { background: "var(--surface-muted)", color: "var(--foreground-muted)", icon: CheckCircle, label: "Ended" },
  not_started: { background: "var(--amber-tint)", color: "var(--amber-signal)", icon: Clock, label: "Not Started" },
  draft: { background: "var(--surface-muted)", color: "var(--foreground-muted)", icon: FileText, label: "Draft" },
};

export function TeacherAssessmentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    assessments,
    teacherClasses,
    academicCurrent,
    assessmentCategories,
    loading,
    assessmentsLoading,
    classesLoading,
  } = useSelector((s: RootState) => s.teacher);
  const { user } = useSelector((s: RootState) => s.user);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  // classSubjectId is stored separately to link assessment after creation
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<
    string | null
  >(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form State
  const [createForm, setCreateForm] = useState({
    title: "",
    classId: "",
    subjectId: "",
    categoryId: "",
    totalMarks: "100",
    duration: "60",
    session: "",
    term: "",
    isOnline: "false",
    startsAt: "",
    endsAt: "",
    instructions: "",
    questions: [] as any[],
  });

  // Question Builder State
  const [newQuestion, setNewQuestion] = useState({
    text: "",
    type: "MCQ",
    marks: "1",
    options: [
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
    correctAnswer: "",
  });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditAssessment, setSelectedEditAssessment] =
    useState<any>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    totalMarks: "",
    durationMins: "",
    startsAt: "",
    endsAt: "",
    instructions: "",
  });

  const refreshData = async (force = false) => {
    const teacherId = (user as any)?.id || (user as any)?.teacherId;

    // Load academic info and categories in parallel
    if (force || !academicCurrent) dispatch(fetchAcademicCurrent());
    if (force || assessmentCategories.length === 0)
      dispatch(fetchAssessmentCategories());

    // IMPORTANT: Fetch teacher classes FIRST so assessments can be filtered by teacher's assignments
    if (teacherId && (force || teacherClasses.length === 0)) {
      try {
        await dispatch(fetchTeacherClasses({ teacherId })).unwrap();
      } catch (err) {
        console.error(
          "[TeacherAssessmentsPage] Failed to fetch teacher classes:",
          err,
        );
      }
    }

    // Then fetch assessments (uses teacher classes from redux state to filter)
    if (force || assessments.length === 0) {
      dispatch(fetchMyAssessments());
    }
  };

  useEffect(() => {
    refreshData();
  }, [dispatch, user]);

  // Get dynamic session/term options
  const { currentSession, currentTerm } = useSessionsAndTerms();

  // Pre-fill session from current academic (API)
  useEffect(() => {
    if (currentSession && !createForm.session) {
      setCreateForm((p) => ({ ...p, session: currentSession }));
    }
    if (currentTerm && !createForm.term) {
      setCreateForm((p) => ({ ...p, term: currentTerm }));
    }
  }, [currentSession, currentTerm, createForm.session, createForm.term]);

  // Extract unique classes
  const uniqueClasses = useMemo(() => {
    const classMap = new Map<string, any>();
    (teacherClasses || []).forEach((item: any) => {
      const classId = item.class?.id || item.classId || item.id;
      const className = item.class?.name || item.className || item.name;
      if (classId && className && !classMap.has(classId)) {
        classMap.set(classId, { id: classId, name: className });
      }
    });
    return Array.from(classMap.values());
  }, [teacherClasses]);

  // Fetch subjects when class is selected in create form
  useEffect(() => {
    if (!createForm.classId) {
      setClassSubjects([]);
      return;
    }

    setLoadingSubjects(true);
    dispatch(fetchClassSubjects(createForm.classId))
      .unwrap()
      .then((data) => {
        // Validate teacher is actually assigned to this class
        const isTeacherAssignedToClass = teacherClasses?.some((item: any) => {
          const itemClassId = item.class?.id || item.classId || item.id;
          return itemClassId === createForm.classId;
        });

        if (!isTeacherAssignedToClass) {
          console.warn(
            "[TeacherAssessmentsPage] Teacher not assigned to selected class",
            {
              selectedClassId: createForm.classId,
              teacherClasses: teacherClasses?.map(
                (c: any) => c.classId || c.class?.id,
              ),
            },
          );
          toast.error("You are not assigned to this class");
          setClassSubjects([]);
          return;
        }

        setClassSubjects(data || []);
      })
      .catch((err) => {
        console.error(
          "[TeacherAssessmentsPage] Failed to fetch subjects:",
          err,
        );
        toast.error("Failed to load subjects for this class");
        setClassSubjects([]);
      })
      .finally(() => setLoadingSubjects(false));
  }, [dispatch, createForm.classId, teacherClasses]);

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    let result = assessments;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((a: any) => a.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((a: any) =>
        typeFilter === "online" ? a.isOnline : !a.isOnline,
      );
    }

    // Class filter
    if (classFilter !== "all") {
      result = result.filter((a: any) => a.classId === classFilter);
    }

    // Search
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (a: any) =>
          (a.title || "").toLowerCase().includes(term) ||
          (a.subject?.name || "").toLowerCase().includes(term),
      );
    }

    return result;
  }, [assessments, statusFilter, typeFilter, classFilter, search]);

  // Assessment stats
  const stats = useMemo(
    () => ({
      total: assessments.length,
      active: assessments.filter((a: any) => a.status === "started").length,
      ended: assessments.filter((a: any) => a.status === "ended").length,
      notStarted: assessments.filter((a: any) => a.status === "not_started")
        .length,
    }),
    [assessments],
  );

  const handleCreate = async () => {
    try {
      if (!createForm.title.trim()) return toast.error("Title is required");
      if (!createForm.classId) return toast.error("Please select a class");
      if (!createForm.subjectId) return toast.error("Please select a subject");
      if (!selectedClassSubjectId)
        return toast.error(
          "Invalid class-subject combination. Please select both class and subject correctly.",
        );
      if (!createForm.categoryId)
        return toast.error("Please select a category");
      if (!createForm.startsAt) return toast.error("Start date is required");
      if (!createForm.endsAt) return toast.error("End date is required");

      console.log(
        "[TeacherAssessmentsPage] Creating assessment with classSubjectIds",
        {
          title: createForm.title,
          classSubjectIds: [selectedClassSubjectId],
          categoryId: createForm.categoryId,
        },
      );

      // NEW FLOW: Backend handles class-subject linking atomically
      // Pass classSubjectIds + classId/subjectId for redundancy and proper response normalization
      const created = await dispatch(
        createTeacherAssessment({
          title: createForm.title.trim(),
          classSubjectIds: [selectedClassSubjectId], // REFACTORED: Atomic linkage
          classId: createForm.classId, // Include for response normalization & error recovery
          subjectId: createForm.subjectId, // Include for response normalization & error recovery
          categoryId: createForm.categoryId,
          totalMarks: createForm.totalMarks
            ? Number(createForm.totalMarks)
            : 100,
          durationMins: createForm.duration ? Number(createForm.duration) : 60,
          session: createForm.session || currentSession,
          term: createForm.term,
          assessmentType: createForm.isOnline === "true" ? "online" : "offline",
          startsAt: createForm.startsAt
            ? new Date(createForm.startsAt).toISOString()
            : undefined,
          endsAt: createForm.endsAt
            ? new Date(createForm.endsAt).toISOString()
            : undefined,
          instructions: createForm.instructions,
          questions: createForm.isOnline === "true" ? createForm.questions : [],
        }),
      ).unwrap();

      console.log("[TeacherAssessmentsPage] Assessment created successfully", {
        assessmentId: created?.id,
        classSubjectId: selectedClassSubjectId,
      });

      toast.success("Assessment created successfully");
      setShowCreateModal(false);
      setSelectedClassSubjectId(null);
      setCreateForm({
        title: "",
        classId: "",
        subjectId: "",
        categoryId: "",
        totalMarks: "100",
        duration: "60",
        session: currentSession || "",
        term: currentTerm || "",
        isOnline: "false",
        startsAt: "",
        endsAt: "",
        instructions: "",
        questions: [],
      });
      refreshData(true);
    } catch (e: any) {
      console.error("[TeacherAssessmentsPage] Failed to create assessment", {
        error: e?.data || e?.message || e,
      });
      toast.error(e || "Failed to create assessment");
    }
  };

  const handleEditClick = (assessment: any) => {
    setSelectedEditAssessment(assessment);
    setEditForm({
      title: assessment.title || "",
      totalMarks: String(assessment.totalMarks ?? assessment.marks ?? 100),
      durationMins: String(
        assessment.durationMins ??
          assessment.durationMinutes ??
          assessment.duration ??
          60,
      ),
      startsAt: assessment.startsAt
        ? new Date(assessment.startsAt).toISOString().slice(0, 16)
        : "",
      endsAt: assessment.endsAt
        ? new Date(assessment.endsAt).toISOString().slice(0, 16)
        : "",
      instructions: assessment.instructions || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateAssessment = async () => {
    if (!selectedEditAssessment) return;
    try {
      await dispatch(
        updateTeacherAssessment({
          id: selectedEditAssessment.id,
          data: {
            title: editForm.title.trim() || undefined,
            totalMarks: editForm.totalMarks
              ? Number(editForm.totalMarks)
              : undefined,
            durationMins: editForm.durationMins
              ? Number(editForm.durationMins)
              : undefined,
            startsAt: editForm.startsAt
              ? new Date(editForm.startsAt).toISOString()
              : undefined,
            endsAt: editForm.endsAt
              ? new Date(editForm.endsAt).toISOString()
              : undefined,
            instructions: editForm.instructions,
          },
        }),
      ).unwrap();
      setShowEditModal(false);
      refreshData(true);
      toast.success("Assessment updated successfully");
    } catch (e: any) {
      toast.error(e || "Failed to update assessment");
    }
  };

  const handlePublishToggle = async (publish: boolean) => {
    if (!selectedEditAssessment) return;
    try {
      await dispatch(
        publishAssessment({ assessmentId: selectedEditAssessment.id, publish }),
      ).unwrap();
      refreshData(true);
      toast.success(
        `Assessment ${publish ? "published" : "unpublished"} successfully`,
      );
    } catch (e: any) {
      toast.error(
        e || `Failed to ${publish ? "publish" : "unpublish"} assessment`,
      );
    }
  };

  const handlePublish = async (assessmentId: string) => {
    try {
      await dispatch(
        publishAssessment({ assessmentId, publish: true }),
      ).unwrap();
      toast.success("Assessment published and is now active!");
      refreshData(true);
    } catch (e: any) {
      toast.error(e || "Failed to publish assessment");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this assessment? This action cannot be undone.",
      )
    ) {
      try {
        await dispatch(deleteTeacherAssessment(id)).unwrap();
        dispatch(fetchMyAssessments());
      } catch (e: any) {
        toast.error(e || "Failed to delete assessment");
      }
    }
  };

  const getClassName = (classId: string) => {
    const cls = uniqueClasses.find((c: any) => c.id === classId);
    return cls?.name || "Unknown";
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.draft;
  };

  return (
    <div className="w-full">
      <TeacherHeader />
      <ProductTour
        tourKey="teacher_assessments"
        steps={teacherAssessmentsTourSteps}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="p-6 md:p-8" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", background: "var(--surface-muted)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                Assessment Management
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
                Create, manage, and grade your assessments
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => refreshData(true)}
                disabled={assessmentsLoading || classesLoading}
                variant="outline"
                className="h-10 w-10 p-0"
                style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}
                title="Refresh Data"
              >
                <RefreshCcw className={`w-4 h-4 ${assessmentsLoading ? "animate-spin" : ""}`} style={{ color: "var(--foreground-muted)" }} />
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="teacher-assessments-create-btn h-10 px-5 text-white font-semibold gap-2"
                style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
              >
                <Plus className="w-4 h-4" />
                Create Assessment
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="teacher-assessments-stats grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Total", value: stats.total, bg: "white", color: "var(--foreground)", border: "var(--border-fine)" },
              { label: "Active", value: stats.active, bg: "var(--emerald-tint)", color: "var(--emerald-signal)", border: "color-mix(in oklch, var(--emerald-signal) 20%, transparent)" },
              { label: "Not Started", value: stats.notStarted, bg: "var(--amber-tint)", color: "var(--amber-signal)", border: "color-mix(in oklch, var(--amber-signal) 20%, transparent)" },
              { label: "Ended", value: stats.ended, bg: "var(--surface-muted)", color: "var(--foreground-muted)", border: "var(--border-fine)" },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3" style={{ borderRadius: "var(--radius-lg)", background: stat.bg, border: `1px solid ${stat.border}` }}>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-sm" style={{ color: stat.color, opacity: 0.8 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="teacher-assessments-filter-bar bg-white p-4" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
              <Input placeholder="Search assessments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 bg-white" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }} />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-11 w-full sm:w-[160px] bg-white" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: "var(--radius-md)" }}>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map((cls: any) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full sm:w-[140px] bg-white" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: "var(--radius-md)" }}>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="started">Active</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-11 w-full sm:w-[120px] bg-white" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }}>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent style={{ borderRadius: "var(--radius-md)" }}>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 p-1 ml-auto" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-muted)" }}>
              {(["grid", "list"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} className="p-2 transition-all" style={{ borderRadius: "var(--radius-md)", background: viewMode === mode ? "white" : "transparent", color: viewMode === mode ? "var(--foreground)" : "var(--foreground-muted)", boxShadow: viewMode === mode ? "var(--shadow-card)" : "none" }}>
                  {mode === "grid" ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment Cards */}
        {assessmentsLoading && assessments.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="bg-white p-10 text-center" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <ClipboardList className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--border-medium)" }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>No Assessments Found</h3>
            <p className="max-w-md mx-auto mb-4" style={{ color: "var(--foreground-muted)" }}>
              {search || statusFilter !== "all" || classFilter !== "all" ? "Try adjusting your filters" : "Create your first assessment to get started."}
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="h-11 px-6 text-white font-semibold gap-2" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
              <Plus className="w-4 h-4" /> Create Assessment
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAssessments.map((assessment: any, idx: number) => {
              const status = assessment.status || "draft";
              const statusStyle = getStatusConfig(status);
              const StatusIcon = statusStyle.icon;
              const duration =
                assessment.durationMinutes ??
                assessment.durationMins ??
                assessment.duration ??
                30;
              const bgPattern = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

              return (
                <div
                  key={assessment.id || idx}
                  className="bg-white overflow-hidden transition-all"
                  style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "var(--shadow-card)")}
                >
                  {/* Card Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-11 h-11 flex items-center justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                        <ClipboardList className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: statusStyle.background, color: statusStyle.color }}>
                        <StatusIcon className="w-3 h-3" />
                        {statusStyle.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 line-clamp-1 pr-24 relative" style={{ color: "var(--foreground)" }}>
                      {assessment.title}
                      <div className="absolute top-0 right-0 flex items-center gap-1">
                        <button
                          onClick={() => handleEditClick(assessment)}
                          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold transition-colors"
                          style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-muted)", color: "var(--foreground-muted)", border: "1px solid var(--border-fine)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--violet-tint)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--violet-ink)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--foreground-muted)"; }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 transition-colors" style={{ borderRadius: "var(--radius-sm)", background: "var(--surface-muted)", border: "1px solid var(--border-fine)", color: "var(--foreground-muted)" }}>
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" style={{ borderRadius: "var(--radius-md)" }} className="min-w-[140px] z-50">
                            <DropdownMenuItem onClick={() => handleDelete(assessment.id)} className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer text-sm">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </h3>
                    <p className="text-sm flex items-center gap-2 mb-4" style={{ color: "var(--foreground-muted)" }}>
                      <BookOpen className="w-4 h-4" />
                      {assessment.subject?.name || "Subject"} • {getClassName(assessment.classId)}
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 text-center py-3" style={{ borderTop: "1px solid var(--border-fine)", borderBottom: "1px solid var(--border-fine)" }}>
                      <div>
                        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                          {assessment.totalMarks ?? assessment.marks ?? 100}
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Marks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                          {duration}m
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Duration</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                          {(() => {
                            const subs = assessment.submissions || [];
                            if (Array.isArray(subs) && subs.length > 0) {
                              return subs.filter((s: any) => {
                                const st = (s.status || "").toLowerCase();
                                return (
                                  st !== "in_progress" &&
                                  st !== "in progress" &&
                                  st !== "not_started"
                                );
                              }).length;
                            }
                            return (
                              assessment.submissionCount ??
                              assessment._count?.submissions ??
                              0
                            );
                          })()}
                        </p>
                        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Submitted</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-4 grid grid-cols-2 gap-2" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
                    {assessment.isOnline ? (
                      <>
                        {status !== "ended" && (
                          <Link href={`/teacher/question-drafting?assessmentId=${assessment.id}`}
                            className="flex items-center justify-center gap-2 h-10 text-sm font-semibold transition-colors col-span-2 mb-1 bg-white"
                            style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--violet-ink)" }}
                          >
                            <Sparkles className="w-4 h-4" />
                            Draft Questions
                          </Link>
                        )}
                        {status === "not_started" ? (
                          <Button onClick={() => handlePublish(assessment.id)} className="flex items-center justify-center gap-2 h-10 text-sm font-semibold text-white col-span-2" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                            <Send className="w-4 h-4" />
                            Publish Assessment
                          </Button>
                        ) : (
                          <Link href={`${routespath.TEACHER_ASSESSMENTS}/${assessment.id}`} className="flex items-center justify-center gap-2 h-10 text-sm font-semibold text-white col-span-2" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                            <BarChart3 className="w-4 h-4" />
                            Grade Submissions
                          </Link>
                        )}
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEditClick(assessment)} className="flex items-center justify-center gap-2 h-10 text-sm font-semibold bg-white transition-colors" style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}>
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <Link href={`${routespath.TEACHER_SCORES}?assessmentId=${assessment.id}`} className="flex items-center justify-center gap-2 h-10 text-sm font-semibold text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                          <BarChart3 className="w-4 h-4" />
                          Grade
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white overflow-hidden" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                  <th className="text-left py-4 px-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Assessment</th>
                  <th className="text-left py-4 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Class</th>
                  <th className="text-center py-4 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Marks</th>
                  <th className="text-center py-4 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Duration</th>
                  <th className="text-center py-4 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Status</th>
                  <th className="text-right py-4 px-5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((assessment: any, idx: number) => {
                  const status = assessment.status || "draft";
                  const statusStyle = getStatusConfig(status);

                  return (
                    <tr
                      key={assessment.id || idx}
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)" }}>
                            <ClipboardList className="w-5 h-5" style={{ color: "var(--violet-ink)" }} />
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: "var(--foreground)" }}>{assessment.title}</p>
                            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>{assessment.subject?.name || "Subject"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3" style={{ color: "var(--foreground-muted)" }}>{getClassName(assessment.classId)}</td>
                      <td className="py-4 px-3 text-center font-semibold" style={{ color: "var(--foreground)" }}>{assessment.totalMarks ?? assessment.marks ?? 100}</td>
                      <td className="py-4 px-3 text-center" style={{ color: "var(--foreground-muted)" }}>{assessment.durationMinutes ?? assessment.durationMins ?? assessment.duration ?? 30}m</td>
                      <td className="py-4 px-3 text-center">
                        <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5" style={{ borderRadius: "var(--radius-sm)", background: statusStyle.background, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {assessment.isOnline ? (
                            <div className="flex items-center gap-2">
                              {status !== "ended" && (
                                <Link href={`/teacher/question-drafting?assessmentId=${assessment.id}`}>
                                  <Button variant="outline" size="sm" className="h-9 gap-1" style={{ borderRadius: "var(--radius-md)", borderColor: "color-mix(in oklch, var(--violet-ink) 30%, transparent)", color: "var(--violet-ink)", background: "var(--violet-tint)" }}>
                                    <Sparkles className="w-4 h-4" /> Questions
                                  </Button>
                                </Link>
                              )}
                              {status === "not_started" ? (
                                <Button onClick={() => handlePublish(assessment.id)} size="sm" className="h-9 text-white gap-1" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                                  <Send className="w-4 h-4" /> Publish
                                </Button>
                              ) : (
                                <Link href={`${routespath.TEACHER_ASSESSMENTS}/${assessment.id}`}>
                                  <Button size="sm" className="h-9 text-white gap-1" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                                    <BarChart3 className="w-4 h-4" /> Grade
                                  </Button>
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-9 gap-1" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)" }} onClick={() => handleEditClick(assessment)}>
                                <Edit className="w-4 h-4" /> Edit
                              </Button>
                              <Link href={`${routespath.TEACHER_SCORES}?assessmentId=${assessment.id}`}>
                                <Button size="sm" className="h-9 text-white gap-1" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                                  <BarChart3 className="w-4 h-4" /> Grade
                                </Button>
                              </Link>
                            </div>
                          )}

                          {/* Delete Dropdown for List View */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 ml-1 transition-colors" style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground-muted)" }}>
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-xl min-w-[140px]"
                            >
                              <DropdownMenuItem
                                onClick={() => handleDelete(assessment.id)}
                                className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer text-sm"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Assessment Modal */}
      {showCreateModal &&
        isMounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white w-full max-w-lg mx-4 overflow-hidden" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
              {/* Modal Header */}
              <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-fine)", background: "var(--violet-tint)" }}>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Create New Assessment</h2>
                  <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>Create a quiz, exam, or homework</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.5)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    Title *
                  </label>
                  <Input
                    value={createForm.title}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g., Mid-Term Mathematics Test"
                    className="mt-2 h-11 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Class *
                    </label>
                    <Select
                      value={createForm.classId}
                      onValueChange={(v) => {
                        setCreateForm((p) => ({
                          ...p,
                          classId: v,
                          subjectId: "",
                        }));
                        setSelectedClassSubjectId(null);
                      }}
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[10000]">
                        {uniqueClasses.map((cls: any) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Subject *
                    </label>
                    <Select
                      value={createForm.subjectId}
                      onValueChange={(v) => {
                        // New model: each subject has classSubjectId from by-class endpoint
                        const subj = classSubjects.find((s: any) => s.id === v);
                        setSelectedClassSubjectId(subj?.classSubjectId ?? null);
                        setCreateForm((p) => ({ ...p, subjectId: v }));
                      }}
                      disabled={!createForm.classId || loadingSubjects}
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue
                          placeholder={
                            loadingSubjects ? "Loading..." : "Select Subject"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[10000]">
                        {classSubjects.map((subj: any) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name}
                            {subj.subjectType && (
                              <span className="text-slate-400 ml-1 text-xs">
                                ({subj.subjectType})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Category *
                    </label>
                    <Select
                      value={createForm.categoryId}
                      onValueChange={(v) =>
                        setCreateForm((p) => ({ ...p, categoryId: v }))
                      }
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[10000]">
                        {assessmentCategories.length === 0 ? (
                          <div className="p-2 text-sm text-slate-500 text-center">
                            No categories found. Ask Admin to create them.
                          </div>
                        ) : (
                          assessmentCategories.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name} ({cat.weight}%)
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Total Marks
                    </label>
                    <Input
                      type="number"
                      value={createForm.totalMarks}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          totalMarks: e.target.value,
                        }))
                      }
                      placeholder="100"
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Start Date
                    </label>
                    <Input
                      type="datetime-local"
                      value={createForm.startsAt}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          startsAt: e.target.value,
                        }))
                      }
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      End Date
                    </label>
                    <Input
                      type="datetime-local"
                      value={createForm.endsAt}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, endsAt: e.target.value }))
                      }
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Assessment Type
                    </label>
                    <Select
                      value={createForm.isOnline}
                      onValueChange={(v) =>
                        setCreateForm((p) => ({ ...p, isOnline: v }))
                      }
                    >
                      <SelectTrigger className="mt-2 h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[10000]">
                        <SelectItem value="false">
                          Offline / Paper-based
                        </SelectItem>
                        <SelectItem value="true">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Duration (mins)
                    </label>
                    <Input
                      type="number"
                      value={createForm.duration}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          duration: e.target.value,
                        }))
                      }
                      placeholder="60"
                      className="mt-2 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    Instructions
                  </label>
                  <textarea
                    value={createForm.instructions}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        instructions: e.target.value,
                      }))
                    }
                    className="mt-2 w-full p-3 text-sm focus:outline-none"
                    style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                    rows={3}
                    placeholder="Instructions for students..."
                  />
                </div>

                {/* Online Questions Builder Removed */}
                {createForm.isOnline === "true" && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="p-4 flex items-center gap-3" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)", border: "1px solid color-mix(in oklch, var(--violet-ink) 20%, transparent)" }}>
                      <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--violet-ink)" }} />
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: "var(--foreground)" }}>AI Question Drafter Available</h3>
                        <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>Create the assessment first, then click "Draft Questions" to use our new AI tools.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 flex items-center justify-end gap-3" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="h-11 px-6" style={{ borderRadius: "var(--radius-md)" }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={loading} className="h-11 px-6 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                  {loading ? "Creating..." : "Create Assessment"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Edit Assessment Modal */}
      {showEditModal &&
        selectedEditAssessment &&
        isMounted &&
        createPortal(
          <div className="fixed inset-0 z-[500] flex items-center justify-center">
            <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => setShowEditModal(false)} />
            <div className="relative bg-white w-full max-w-lg mx-4 p-6 max-h-[90vh] flex flex-col" style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}>
              <div className="flex justify-between items-center mb-6 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                  <div className="w-8 h-8 flex items-center justify-center" style={{ borderRadius: "var(--radius-md)", background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                    <Edit className="w-4 h-4" />
                  </div>
                  Edit Assessment
                </h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 transition-colors" style={{ borderRadius: "var(--radius-md)", color: "var(--foreground-muted)" }} onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-muted)")} onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "")}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 pb-2 flex-grow custom-scrollbar">
                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    Assessment Title
                  </label>
                  <Input
                    type="text"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, title: e.target.value }))
                    }
                    className="mt-1 h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Total Marks
                    </label>
                    <Input
                      type="number"
                      value={editForm.totalMarks}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          totalMarks: e.target.value,
                        }))
                      }
                      className="mt-1 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Duration (mins)
                    </label>
                    <Input
                      type="number"
                      value={editForm.durationMins}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          durationMins: e.target.value,
                        }))
                      }
                      className="mt-1 h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Start Date
                    </label>
                    <Input
                      type="datetime-local"
                      value={editForm.startsAt}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, startsAt: e.target.value }))
                      }
                      className="mt-1 h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      End Date
                    </label>
                    <Input
                      type="datetime-local"
                      value={editForm.endsAt}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, endsAt: e.target.value }))
                      }
                      className="mt-1 h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    Instructions
                  </label>
                  <textarea
                    value={editForm.instructions}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        instructions: e.target.value,
                      }))
                    }
                    className="mt-1 w-full p-3 text-sm focus:outline-none"
                    style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)" }}
                    rows={3}
                  />
                </div>

                <div className="pt-4 flex flex-col gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-fine)" }}>
                  <Button onClick={handleUpdateAssessment} className="w-full h-11 text-white font-semibold" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}>
                    Save Changes
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handlePublishToggle(true)}
                      variant="outline"
                      disabled={selectedEditAssessment.status === "started" || selectedEditAssessment.status === "active"}
                      className="flex-1 h-11 font-semibold"
                      style={{ borderRadius: "var(--radius-md)", borderColor: "color-mix(in oklch, var(--emerald-signal) 30%, transparent)", color: "var(--emerald-signal)" }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Publish
                    </Button>
                    <Button
                      onClick={() => handlePublishToggle(false)}
                      variant="outline"
                      disabled={selectedEditAssessment.status === "not_started" || selectedEditAssessment.status === "draft"}
                      className="flex-1 h-11 font-semibold"
                      style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", color: "var(--foreground-muted)" }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Unpublish
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
