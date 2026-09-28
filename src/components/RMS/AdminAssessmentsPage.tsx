"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  fetchClasses,
  fetchAssessments,
  fetchSubjects,
  deleteAssessment,
  createAssessment,
  fetchAssessmentCategoriesMap,
} from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import {
  clearAdminError,
  clearAdminSuccess,
} from "@/reduxToolKit/admin/adminSlice";
import { Header } from "@/components/RMS/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  MoreVertical,
  Calculator,
  BookOpen,
  FileText,
  Target,
  Filter,
  AlertCircle,
  Eye,
  Settings,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { ManageCategoriesDialog } from "./ManageCategoriesDialog";
import { ProductTour } from "@/components/common/ProductTour";

const assessmentTourSteps = [
  {
    target: ".assessments-info-banner",
    title: "Assessments Overview",
    content:
      "Assessments are created by teachers — your role here is to monitor and oversee all school-wide exam activity across classes and subjects.",
    disableBeacon: true,
  },
  {
    target: ".assessments-manage-categories-btn",
    title: "Manage Categories",
    content:
      "Click here to define your school's assessment categories (e.g., CA, Exam, Project). These categories are what teachers use when creating assessments.",
  },
  {
    target: ".assessments-filter-bar",
    title: "Monitor Academic Progress",
    content:
      "Use these filters to drill into assessments by class, status, or type to monitor teacher activity across the school.",
  },
];

// Assessment icon based on subject
const getAssessmentIcon = (subjectName: string) => {
  const name = (subjectName || "").toLowerCase();
  if (name.includes("math")) return Calculator;
  if (
    name.includes("science") ||
    name.includes("physics") ||
    name.includes("chemistry") ||
    name.includes("biology")
  )
    return Target;
  if (name.includes("english") || name.includes("literature")) return BookOpen;
  return FileText;
};

const getStatusStyle = (status?: string) => {
  if (status === "started" || status === "active") {
    return { background: "var(--emerald-tint)", color: "var(--emerald-signal)", label: "Active" };
  }
  if (status === "ended") {
    return { background: "var(--surface-muted)", color: "var(--foreground-muted)", label: "Ended" };
  }
  if (status === "pending" || status === "not_started") {
    return { background: "var(--amber-tint)", color: "var(--amber-signal)", label: "Pending" };
  }
  return { background: "var(--violet-tint)", color: "var(--violet-ink)", label: "Draft" };
};

const getIconBg = (subjectName: string) => {
  const name = (subjectName || "").toLowerCase();
  if (name.includes("math")) return { background: "var(--violet-tint)", color: "var(--violet-ink)" };
  if (name.includes("physics")) return { background: "var(--cobalt-tint)", color: "var(--cobalt-signal)" };
  if (name.includes("english") || name.includes("history"))
    return { background: "var(--crimson-tint)", color: "var(--crimson-signal)" };
  if (name.includes("geo")) return { background: "var(--emerald-tint)", color: "var(--emerald-signal)" };
  return { background: "var(--surface-muted)", color: "var(--foreground-muted)" };
};

export function AdminAssessmentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { assessments, classes, subjects, loading, error, success } =
    useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const { assessmentCategories } = useSelector((s: RootState) => s.admin);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    classIds: [] as string[], // multi-class
    subjectNames: [] as string[], // de-duplicated subject names across selected classes
    categoryId: "",
    totalMarks: "",
    passingMarks: "",
    isOnline: false,
    durationMins: "",
    term: "",
    instructions: "",
    startsAt: "",
    endsAt: "", // explicit end date
  });

  useEffect(() => {
    dispatch(fetchAssessments());
    dispatch(fetchClasses(undefined));
    dispatch(fetchSubjects());
    dispatch(getTenantInfo());
    dispatch(fetchAssessmentCategoriesMap());
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearAdminError());
    }
    if (success) {
      toast.success(success);
      dispatch(clearAdminSuccess());
    }
  }, [error, success]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const subjectNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) map.set(s.id, s.name);
    return map;
  }, [subjects]);

  const filtered = useMemo(() => {
    let result = assessments;

    if (statusFilter !== "all") {
      result = result.filter((a) => {
        if (statusFilter === "active")
          return a.status === "started" || a.status === "active";
        if (statusFilter === "draft")
          return a.status === "not_started" || !a.status;
        if (statusFilter === "ended") return a.status === "ended";
        return true;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((a) =>
        typeFilter === "online" ? a.isOnline : !a.isOnline,
      );
    }

    if (classFilter !== "all") {
      result = result.filter((a) => a.classId === classFilter);
    }

    const term = q.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (a) =>
          (a.title || "").toLowerCase().includes(term) ||
          (subjectNameById.get(a.subjectId || "") || "")
            .toLowerCase()
            .includes(term),
      );
    }

    return result;
  }, [assessments, statusFilter, typeFilter, classFilter, q, subjectNameById]);

  // New model: subjects have classSubjects[] instead of classId
  // Build flat list of { subjectId, subjectName, classId, classSubjectId } for selected classes
  const subjectsInSelectedClasses = useMemo(() => {
    if (form.classIds.length === 0) return [];
    const flat: Array<{
      subjectId: string;
      name: string;
      classId: string;
      classSubjectId: string;
    }> = [];
    for (const s of subjects) {
      const cs: any[] = s.classSubjects || [];
      for (const c of cs) {
        if (form.classIds.includes(c.classId)) {
          flat.push({
            subjectId: s.id,
            name: s.name,
            classId: c.classId,
            classSubjectId: c.id,
          });
        }
      }
      // Legacy fallback: subject has direct classId
      if (cs.length === 0 && s.classId && form.classIds.includes(s.classId)) {
        flat.push({
          subjectId: s.id,
          name: s.name,
          classId: s.classId,
          classSubjectId: "",
        });
      }
    }
    return flat;
  }, [subjects, form.classIds]);

  // De-duplicated subject names across all selected classes (sorted)
  const uniqueSubjectNames = useMemo(() => {
    const names = new Set<string>();
    subjectsInSelectedClasses.forEach((s) => names.add(s.name));
    return Array.from(names).sort();
  }, [subjectsInSelectedClasses]);

  // How many of the selected classes have each subject name
  const subjectClassCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const name of uniqueSubjectNames) {
      counts[name] = subjectsInSelectedClasses.filter(
        (s) => s.name === name,
      ).length;
    }
    return counts;
  }, [uniqueSubjectNames, subjectsInSelectedClasses]);

  const resetForm = () => {
    setForm({
      title: "",
      classIds: [],
      subjectNames: [],
      categoryId: "",
      totalMarks: "",
      passingMarks: "",
      isOnline: false,
      durationMins: "",
      term: "",
      instructions: "",
      startsAt: "",
      endsAt: "",
    });
  };

  const handleCreateAssessment = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (form.classIds.length === 0)
      return toast.error("Please select at least one class");
    if (form.subjectNames.length === 0)
      return toast.error("Select at least one subject");
    if (!form.startsAt) return toast.error("Start date is required");

    // Build pairs from new model flat list (classSubjectId included)
    const pairs = subjectsInSelectedClasses.filter((s) =>
      form.subjectNames.includes(s.name),
    );
    if (pairs.length === 0)
      return toast.error("No matching subjects found for the selected classes");

    setCreating(true);
    try {
      const created = await Promise.all(
        pairs.map(({ classId, subjectId, classSubjectId }) => {
          const start = new Date(form.startsAt);
          const duration = form.durationMins ? Number(form.durationMins) : 60;

          // Use explicit end date if provided, otherwise calculate it
          const end = form.endsAt
            ? new Date(form.endsAt)
            : new Date(start.getTime() + duration * 60000);

          return dispatch(
            createAssessment({
              title: form.title.trim(),
              classSubjectIds: classSubjectId ? [classSubjectId] : [],
              categoryId: form.categoryId || undefined,
              totalMarks: form.totalMarks ? Number(form.totalMarks) : undefined,
              passingMarks: form.passingMarks
                ? Number(form.passingMarks)
                : undefined,
              isOnline: form.isOnline,
              duration,
              durationMins: duration,
              term: form.term || undefined,
              instructions: form.instructions || undefined,
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
              questions: [],
            }),
          ).unwrap();
        }),
      );

      toast.success(
        `${pairs.length} assessment${pairs.length > 1 ? "s" : ""} created successfully`,
      );
      resetForm();
      setShowCreateModal(false);
      dispatch(fetchAssessments());
    } catch (e: any) {
      toast.error(e || "Failed to create assessment(s)");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this assessment? This action cannot be undone.",
      )
    ) {
      try {
        await dispatch(deleteAssessment(id)).unwrap();
        // toast is handled by success/error in useEffect, but we could add one here if needed
      } catch (error) {
        // error handling is managed by useEffect
      }
    }
  };

  return (
    <div className="w-full">
      <ProductTour tourKey="admin_assessments" steps={assessmentTourSteps} />
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
            Assessments Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)" }}>
            Create and monitor assessments across all classes and subjects.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ManageCategoriesDialog>
            <Button
              variant="outline"
              className="assessments-manage-categories-btn gap-2"
              style={{ borderColor: "var(--border-fine)", borderRadius: "var(--radius-md)" }}
            >
              <Settings className="w-4 h-4" /> Manage Categories
            </Button>
          </ManageCategoriesDialog>
          <Button
            className="gap-2 text-white shadow-sm"
            style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" /> Create Assessment
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="assessments-info-banner rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ background: "var(--cobalt-tint)", border: "1px solid color-mix(in oklch, var(--cobalt-signal) 20%, transparent)" }}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--cobalt-signal)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--cobalt-signal)" }}>
            Assessment Management
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--cobalt-signal)", opacity: 0.85 }}>
            Create assessments for one or more subjects at once by selecting a
            class and checking the subjects. Teachers can also create
            assessments from their dashboard.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="assessments-filter-bar flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          <Input
            placeholder="Search assessments..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 rounded-xl shadow-sm"
            style={{ borderColor: "var(--border-medium)", background: "white" }}
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-11 w-full sm:w-[150px] rounded-xl shadow-sm" style={{ borderColor: "var(--border-medium)", background: "white" }}>
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-full sm:w-[150px] rounded-xl shadow-sm" style={{ borderColor: "var(--border-medium)", background: "white" }}>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-11 w-full sm:w-[140px] rounded-xl shadow-sm" style={{ borderColor: "var(--border-medium)", background: "white" }}>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-11 w-11 p-0 rounded-xl shadow-sm"
            style={{ borderColor: "var(--border-medium)", background: "white" }}
          >
            <Filter className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Total Assessments
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground)" }}>
            {assessments.length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Active
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--emerald-signal)" }}>
            {
              assessments.filter(
                (a) => a.status === "started" || a.status === "active",
              ).length
            }
          </p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Pending
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--amber-signal)" }}>
            {
              assessments.filter((a) => a.status === "not_started" || !a.status)
                .length
            }
          </p>
        </div>
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--foreground-muted)" }}>
            Completed
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "var(--foreground-muted)" }}>
            {assessments.filter((a) => a.status === "ended").length}
          </p>
        </div>
      </div>

      {/* Assessment Cards Grid */}
      {loading && assessments.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div
              className="inline-block rounded-full h-10 w-10 mb-4"
              style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }}
            />
            <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>Loading assessments...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((assessment) => {
            const subjectName =
              subjectNameById.get(assessment.subjectId || "") || "Subject";
            const className =
              classNameById.get(assessment.classId || "") || "Class";
            const statusStyle = getStatusStyle(assessment.status);
            const Icon = getAssessmentIcon(subjectName);
            const iconBg = getIconBg(subjectName);

            return (
              <div
                key={assessment.id}
                className="bg-white p-5 transition-all"
                style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 flex items-center justify-center flex-shrink-0"
                      style={{ borderRadius: "var(--radius-lg)", ...iconBg }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold line-clamp-1" style={{ color: "var(--foreground)" }}>
                        {assessment.title}
                      </h3>
                      <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                        {subjectName} • {className}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-lg transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <MoreVertical className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onClick={() => handleDelete(assessment.id)}
                        className="cursor-pointer"
                        style={{ color: "var(--crimson-signal)" }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col gap-3 mb-4 mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                      style={{ borderRadius: "var(--radius-sm)", background: statusStyle.background, color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </span>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium"
                      style={{ borderRadius: "var(--radius-sm)", background: assessment.isOnline !== false ? "var(--cobalt-tint)" : "var(--surface-muted)", color: assessment.isOnline !== false ? "var(--cobalt-signal)" : "var(--foreground-muted)" }}
                    >
                      {assessment.isOnline !== false ? "Online" : "Offline"}
                    </span>
                    {assessment.session && (
                      <span className="text-xs font-medium tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                        • {assessment.session}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {(assessment as any)._count?.submissions ??
                        (assessment as any).submittedCount ??
                        (assessment as any).submissionCount ??
                        "—"}
                    </p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                      Submitted
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {assessment.totalMarks ? `${assessment.totalMarks}` : "—"}
                    </p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                      Total Marks
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {assessment.durationMins ?? assessment.duration ?? "—"}
                    </p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--foreground-muted)" }}>
                      Minutes
                    </p>
                  </div>
                </div>

                {/* View Details Button */}
                <Link
                  href={`/RMS/assessments/${assessment.id}`}
                  className="block"
                >
                  <button
                    className="w-full h-10 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", color: "var(--foreground)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </Link>
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-full py-16 text-center">
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--border-medium)" }} />
              <p className="font-medium" style={{ color: "var(--foreground-muted)" }}>No assessments found</p>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-muted)", opacity: 0.7 }}>
                Create an assessment or wait for teachers to create them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Assessment Modal */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(15,23,42,0.5)" }}
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            />
            <div
              className="relative bg-white w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
              style={{ borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)" }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border-fine)" }}>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    Create Assessments
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                    Select multiple classes and subjects — one assessment is
                    created per matching pair
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="p-2 rounded-lg"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <X className="w-5 h-5" style={{ color: "var(--foreground-muted)" }} />
                </button>
              </div>

              {/* Body — wider modal, 3 columns: details | classes | subjects */}
              <div className="px-6 py-5 overflow-y-auto flex-1 grid grid-cols-3 gap-5">
                {/* Col 1 — assessment details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Assessment Title <span style={{ color: "var(--crimson-signal)" }}>*</span>
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="e.g. First Term Exam"
                      className="mt-2 h-10 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Category
                    </label>
                    <Select
                      value={form.categoryId}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, categoryId: v }))
                      }
                    >
                      <SelectTrigger className="mt-2 h-10 rounded-xl text-sm">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl z-[99999]">
                        {assessmentCategories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Total Marks
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={form.totalMarks}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, totalMarks: e.target.value }))
                        }
                        placeholder="100"
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Pass Mark
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={form.passingMarks}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            passingMarks: e.target.value,
                          }))
                        }
                        placeholder="50"
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Duration (mins)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={form.durationMins}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            durationMins: e.target.value,
                          }))
                        }
                        placeholder="60"
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Term
                      </label>
                      <Select
                        value={form.term}
                        onValueChange={(v) =>
                          setForm((p) => ({ ...p, term: v }))
                        }
                      >
                        <SelectTrigger className="mt-2 h-10 rounded-xl text-sm">
                          <SelectValue placeholder="Term" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl z-[99999]">
                          <SelectItem value="1st Term">1st Term</SelectItem>
                          <SelectItem value="2nd Term">2nd Term</SelectItem>
                          <SelectItem value="3rd Term">3rd Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        Start Date <span style={{ color: "var(--crimson-signal)" }}>*</span>
                      </label>
                      <Input
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, startsAt: e.target.value }))
                        }
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        End Date
                      </label>
                      <Input
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, endsAt: e.target.value }))
                        }
                        className="mt-2 h-10 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Checkbox
                      id="isOnline"
                      checked={form.isOnline}
                      onCheckedChange={(v) =>
                        setForm((p) => ({ ...p, isOnline: !!v }))
                      }
                    />
                    <label
                      htmlFor="isOnline"
                      className="text-sm font-medium cursor-pointer" style={{ color: "var(--foreground)" }}
                    >
                      Online (CBT)
                    </label>
                  </div>
                </div>

                {/* Col 2 — multi-class select */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Classes <span style={{ color: "var(--crimson-signal)" }}>*</span>
                      {form.classIds.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--foreground-muted)" }}>
                          ({form.classIds.length})
                        </span>
                      )}
                    </label>
                    {form.classIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            classIds: [],
                            subjectNames: [],
                          }))
                        }
                        className="text-xs"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl overflow-hidden flex-1" style={{ border: "1px solid var(--border-medium)" }}>
                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors" style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-fine)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                    >
                      <Checkbox
                        checked={
                          form.classIds.length === classes.length &&
                          classes.length > 0
                        }
                        onCheckedChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            classIds: v ? classes.map((c) => c.id) : [],
                            subjectNames: [],
                          }))
                        }
                      />
                      <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                        Select All
                      </span>
                    </label>
                    <div className="max-h-64 overflow-y-auto" style={{ borderColor: "var(--border-fine)" }}>
                      {classes.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                          style={{ borderBottom: "1px solid var(--border-fine)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Checkbox
                            checked={form.classIds.includes(c.id)}
                            onCheckedChange={(v) =>
                              setForm((p) => ({
                                ...p,
                                classIds: v
                                  ? [...p.classIds, c.id]
                                  : p.classIds.filter((id) => id !== c.id),
                                subjectNames: [], // reset subjects when classes change
                              }))
                            }
                          />
                          <span className="text-sm" style={{ color: "var(--foreground)" }}>
                            {c.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Col 3 — subject names (de-duplicated across selected classes) */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Subjects <span style={{ color: "var(--crimson-signal)" }}>*</span>
                      {form.subjectNames.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--foreground-muted)" }}>
                          ({form.subjectNames.length})
                        </span>
                      )}
                    </label>
                    {form.subjectNames.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, subjectNames: [] }))
                        }
                        className="text-xs"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {form.classIds.length === 0 ? (
                    <div className="rounded-xl flex items-center justify-center flex-1 text-xs text-center px-3" style={{ border: "1px solid var(--border-medium)", color: "var(--foreground-muted)" }}>
                      Select classes first
                    </div>
                  ) : uniqueSubjectNames.length === 0 ? (
                    <div className="rounded-xl flex items-center justify-center flex-1 text-xs text-center px-3" style={{ border: "1px solid var(--border-medium)", color: "var(--foreground-muted)" }}>
                      No subjects in selected classes
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden flex-1" style={{ border: "1px solid var(--border-medium)" }}>
                      <label className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors" style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-fine)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      >
                        <Checkbox
                          checked={
                            form.subjectNames.length ===
                            uniqueSubjectNames.length
                          }
                          onCheckedChange={(v) =>
                            setForm((p) => ({
                              ...p,
                              subjectNames: v ? [...uniqueSubjectNames] : [],
                            }))
                          }
                        />
                        <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                          Select All
                        </span>
                      </label>
                      <div className="max-h-64 overflow-y-auto">
                        {uniqueSubjectNames.map((name) => (
                          <label
                            key={name}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                            style={{ borderBottom: "1px solid var(--border-fine)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <Checkbox
                              checked={form.subjectNames.includes(name)}
                              onCheckedChange={(v) =>
                                setForm((p) => ({
                                  ...p,
                                  subjectNames: v
                                    ? [...p.subjectNames, name]
                                    : p.subjectNames.filter((n) => n !== name),
                                }))
                              }
                            />
                            <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>
                              {name}
                            </span>
                            {subjectClassCount[name] > 1 && (
                              <span className="text-xs shrink-0" style={{ color: "var(--foreground-muted)" }}>
                                {subjectClassCount[name]} classes
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0" style={{ borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)" }}>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {form.classIds.length > 0 && form.subjectNames.length > 0
                    ? (() => {
                        let count = 0;
                        for (const classId of form.classIds) {
                          count += subjects.filter((s: any) => {
                            const cs: any[] = s.classSubjects || [];
                            const matchesClass =
                              cs.some((c) => c.classId === classId) ||
                              s.classId === classId;
                            return (
                              matchesClass && form.subjectNames.includes(s.name)
                            );
                          }).length;
                        }
                        return `${count} assessment${count !== 1 ? "s" : ""} will be created`;
                      })()
                    : "Select classes and subjects to see count"}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="h-11 px-6 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAssessment}
                    disabled={creating}
                    className="h-11 px-6 text-white"
                    style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)" }}
                  >
                    {creating ? "Creating..." : "Create Assessments"}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
