"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { selectAdminClasses, selectAdminClassDetails, selectStudents, selectTeachers } from "@/reduxToolKit/selectors";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  assignTeacherToClass,
  createClass,
  fetchClasses,
  fetchClassDetails,
  removeStudentFromClass,
  removeTeacherFromClass,
  deleteClass,
  updateClass,
  assignTeacherToClassSubject,
  removeTeacherFromClassSubject,
  fetchClassSubjects,
} from "@/reduxToolKit/admin/adminThunks";
import {
  clearAdminError,
  clearAdminSuccess,
} from "@/reduxToolKit/admin/adminSlice";
import { fetchAllUsers, getTenantInfo } from "@/reduxToolKit/user/userThunks";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  TrendingUp,
  MoreVertical,
  Download,
  X,
  Grid,
  List,
  UserMinus,
  Eye,
  Pencil,
  BookOpen,
  UserPlus,
  ShieldCheck,
  Check,
  Trash,
  AlertTriangle,
  GraduationCap,
} from "lucide-react";
import { ProductTour } from "@/components/common/ProductTour";
import { useSessionsAndTerms } from "@/hooks/useSessionsAndTerms";

const classTourSteps = [
  {
    target: ".classes-add-btn",
    content:
      "Create a new class here by providing a name, level, and capacity. Classes are the core containers that group students and teachers together.",
    disableBeacon: true,
  },
  {
    target: ".classes-filter-bar",
    content:
      "Use these filters to quickly narrow down classes by session, term, or level—especially useful once your school grows large.",
  },
  {
    target: ".classes-grid",
    content:
      "Each card here represents a class. Click on a card to view its enrolled students, assigned teachers, and detailed roster information.",
  },
];

const DEFAULT_PRIMARY = "#641BC4";

// Icon accent colors for class cards (uses design system tokens)
const classAccents = [
  { color: "var(--violet-ink)", tint: "var(--violet-tint)" },
  { color: "var(--emerald-signal)", tint: "var(--emerald-tint)" },
  { color: "var(--cobalt-signal)", tint: "var(--cobalt-tint)" },
  { color: "var(--amber-signal)", tint: "var(--amber-tint)" },
  { color: "var(--crimson-signal)", tint: "var(--crimson-tint)" },
];

export function AdminClassesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { classes, loading, error, success, schoolSettings: adminSchoolSettings } = useSelector(selectAdminClasses);
  const { selectedClassDetails, selectedClassSubjects } = useSelector(selectAdminClassDetails);
  const students = useSelector(selectStudents);
  const teachers = useSelector(selectTeachers);
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  const [assigningSubjectId, setAssigningSubjectId] = useState<string | null>(
    null,
  );
  const [subjectTeacherId, setSubjectTeacherId] = useState("");
  const primaryColor = adminSchoolSettings?.primaryColor || DEFAULT_PRIMARY;

  const { sessionOptions, currentSession } = useSessionsAndTerms();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [sessionFilter, setSessionFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const CLASSES_PER_PAGE = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classToDelete, setClassToDelete] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    level: "",
    stream: "",
    capacity: "",
    academicYear: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    level: "",
    stream: "",
    capacity: "",
    academicYear: "",
  });
  const [assignTeacherId, setAssignTeacherId] = useState("");

  const usersFetchedRef = useRef(false);

  useEffect(() => {
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
    // Only fetch users if not already loaded
    if (!usersFetchedRef.current && (!students || students.length === 0)) {
      usersFetchedRef.current = true;
      dispatch(fetchAllUsers());
    }
  }, []);

  useEffect(() => {
    if (currentSession && !sessionFilter) {
      setSessionFilter(currentSession);
    }
  }, [currentSession, sessionFilter]);

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

  const filtered = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return classes;
    return classes.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(term) ||
        String(c.level ?? "")
          .toLowerCase()
          .includes(term),
    );
  }, [classes, debouncedQ]);

  const totalClassPages = Math.ceil(filtered.length / CLASSES_PER_PAGE);
  const paginatedClasses = useMemo(() => {
    const start = (page - 1) * CLASSES_PER_PAGE;
    return filtered.slice(start, start + CLASSES_PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const submit = async () => {
    try {
      if (!form.name.trim()) return toast.error("Class name is required");
      await dispatch(
        createClass({
          name: form.name.trim(),
          level: Number(form.level) || undefined,
          stream: form.stream.trim() || undefined,
          capacity: Number(form.capacity) || undefined,
          academicYear: form.academicYear.trim() || undefined,
        }),
      ).unwrap();
      setForm({
        name: "",
        level: "",
        stream: "",
        capacity: "",
        academicYear: "",
      });
      setShowCreateModal(false);
      dispatch(fetchClasses(undefined));
    } catch (e: any) {
      toast.error(e || "Failed to create class");
    }
  };

  const assignClassTeacher = async () => {
    try {
      if (!selectedClass) return toast.error("Please select a class");
      if (!assignTeacherId) return toast.error("Please select a teacher");
      await dispatch(
        assignTeacherToClass({
          classId: selectedClass.id,
          teacherId: assignTeacherId,
        }),
      ).unwrap();
      setAssignTeacherId("");
      setShowAssignModal(false);
      setSelectedClass(null);
      // Refresh class details if viewing
      if (showDetailsModal && selectedClass) {
        dispatch(fetchClassDetails(selectedClass.id));
      }
    } catch (e: any) {
      toast.error(e || "Failed to assign teacher");
    }
  };

  const handleDeleteClass = async () => {
    if (!classToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteClass(classToDelete.id)).unwrap();
      setShowDeleteModal(false);
      setClassToDelete(null);
    } catch (e: any) {
      toast.error(e || "Failed to delete class");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateClass = async () => {
    if (!selectedClass) return;
    try {
      if (!editForm.name.trim()) return toast.error("Class name is required");
      setIsUpdating(true);
      await dispatch(
        updateClass({
          id: selectedClass.id,
          data: {
            name: editForm.name.trim(),
            level: Number(editForm.level) || undefined,
            stream: editForm.stream.trim() || undefined,
            capacity: Number(editForm.capacity) || undefined,
            academicYear: editForm.academicYear.trim() || undefined,
          },
        }),
      ).unwrap();
      setShowEditModal(false);
      setSelectedClass(null);
    } catch (e: any) {
      toast.error(e || "Failed to update class");
    } finally {
      setIsUpdating(false);
    }
  };

  const viewClassDetails = async (cls: any) => {
    setSelectedClass(cls);

    // Check if we have cached roster info
    const hasCache = !!(cls.enrollments || cls.teacherAssignments);

    setShowDetailsModal(true);

    // Always fetch subjects in background or foreground
    dispatch(fetchClassSubjects(cls.id));

    if (hasCache) {
      // Instant load from cache
      setLoadingDetails(false);
      // Still refresh in background to ensure latest data
      dispatch(fetchClassDetails(cls.id));
    } else {
      // Traditional load with spinner
      setLoadingDetails(true);
      try {
        await dispatch(fetchClassDetails(cls.id)).unwrap();
      } catch (e: any) {
        toast.error(e || "Failed to load class details");
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      await dispatch(
        removeStudentFromClass({ classId: selectedClass.id, studentId }),
      ).unwrap();
      dispatch(fetchClassDetails(selectedClass.id));
    } catch (e: any) {
      toast.error(e || "Failed to remove student");
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedClass) return;
    try {
      await dispatch(
        removeTeacherFromClass({ classId: selectedClass.id, teacherId }),
      ).unwrap();
      dispatch(fetchClassDetails(selectedClass.id));
    } catch (e: any) {
      toast.error(e || "Failed to remove teacher");
    }
  };

  const handleAssignSubjectTeacher = async (
    classSubjectId: string,
    teacherId: string,
  ) => {
    try {
      if (!teacherId) return toast.error("Please select a teacher");
      await dispatch(
        assignTeacherToClassSubject({ classSubjectId, teacherId }),
      ).unwrap();
      setAssigningSubjectId(null);
      setSubjectTeacherId("");
      if (selectedClass) {
        dispatch(fetchClassSubjects(selectedClass.id));
        dispatch(fetchClassDetails(selectedClass.id));
      }
    } catch (e: any) {
      toast.error(e || "Failed to assign subject teacher");
    }
  };

  const handleRemoveSubjectTeacher = async (
    classSubjectId: string,
    teacherId: string,
  ) => {
    try {
      await dispatch(
        removeTeacherFromClassSubject({ classSubjectId, teacherId }),
      ).unwrap();
      if (selectedClass) {
        dispatch(fetchClassSubjects(selectedClass.id));
        dispatch(fetchClassDetails(selectedClass.id));
      }
    } catch (e: any) {
      toast.error(e || "Failed to remove subject teacher");
    }
  };

  const getAccentByIndex = (idx: number) =>
    classAccents[idx % classAccents.length];

  // Helper to get actual student count
  const getStudentCountForClass = (classId: string, backendCount?: number) => {
    if (!students) return backendCount || 0;

    const localCount = students.filter((s: any) => {
      // 1. First ensure they are NOT a teacher or admin by checking roles
      const studentObj = s.studentProfile || s.profile || s.user || s;
      const roles = studentObj.roles || s.roles || studentObj.user?.roles || [];
      const roleStr = String(studentObj.role || s.role || "").toLowerCase();

      const isTeacherOrAdmin =
        (Array.isArray(roles) &&
          roles.some((r: any) => {
            const name = String(
              r.role?.name || r.name || r || "",
            ).toLowerCase();
            return name === "teacher" || name === "admin" || name === "staff";
          })) ||
        roleStr === "teacher" ||
        roleStr === "admin" ||
        roleStr === "staff";

      if (isTeacherOrAdmin) return false;

      // 2. Check ALL possible class associations recursively
      const enrollments = Array.isArray(s.enrollments)
        ? s.enrollments
        : s.enrollment
          ? [s.enrollment]
          : [];
      const profile = s.studentProfile || s.profile || {};

      const hasEnrollmentMatch = enrollments.some(
        (e: any) => e.classId === classId || e.class?.id === classId,
      );
      if (hasEnrollmentMatch) return true;

      // check direct property or profiles
      return (
        s.classId === classId ||
        s.class?.id === classId ||
        profile.classId === classId ||
        profile.class?.id === classId
      );
    }).length;

    // Use the maximum of local and backend counts to ensure we don't undercount
    // backendCount here will include the refined calculation from the adminSlice
    return Math.max(localCount, backendCount || 0);
  };

  // Helper to get actual teacher count
  const getTeacherCountForClass = (classId: string, backendCount?: number) => {
    const localCount = teachers
      ? teachers.filter((t: any) => {
          // Check various possible class assignment fields for teachers
          const profile = t.teacherProfile || t.profile || {};
          const assignments = Array.isArray(t.teacherAssignments)
            ? t.teacherAssignments
            : t.teacherAssignment
              ? [t.teacherAssignment]
              : [];
          const classList = Array.isArray(t.classes) ? t.classes : [];

          return (
            t.classId === classId ||
            t.primaryClassId === classId ||
            t.assignedClasses?.includes(classId) ||
            classList.some(
              (c: any) => c.id === classId || c.classId === classId,
            ) ||
            assignments.some((a: any) => a.classId === classId) ||
            profile.classId === classId ||
            (t.subjects &&
              Array.isArray(t.subjects) &&
              t.subjects.some((s: any) => s.classId === classId))
          );
        }).length
      : 0;

    return Math.max(localCount, backendCount || 0);
  };

  const handleExportRosters = () => {
    if (filtered.length === 0) return toast.error("No classes to export");

    // CSV Headers
    const headers = [
      "Class Name",
      "Level",
      "Stream",
      "Students",
      "Teachers",
      "Capacity",
      "Academic Year",
    ];

    // CSV Rows
    const rows = filtered.map((cls) => {
      const bStudentCount =
        cls.studentCount ??
        cls._count?.enrollments ??
        cls._count?.students ??
        0;
      const bTeacherCount =
        cls.teacherCount ??
        cls._count?.teacherAssignments ??
        cls._count?.teachers ??
        0;

      return [
        cls.name || "",
        cls.level || "",
        cls.stream || "A",
        getStudentCountForClass(cls.id, bStudentCount),
        getTeacherCountForClass(cls.id, bTeacherCount),
        cls.capacity || "",
        cls.academicYear || sessionFilter || "",
      ];
    });

    // Construct CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `school_rosters_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Rosters exported successfully");
  };

  // Get enrolled students and teachers from class details
  // Handle various possible response structures
  const classStudents = useMemo(() => {
    // Prioritize the real-time detailed object, fall back to the class list item cache
    const source =
      selectedClassDetails?.id === selectedClass?.id
        ? selectedClassDetails
        : selectedClass;

    if (!source) return [];

    // Check multiple possible paths for students
    const enrollments =
      source.enrollments ||
      source.students ||
      source.data?.enrollments ||
      source.data?.students ||
      [];
    const list = Array.isArray(enrollments) ? enrollments : [];

    // Filter out users who are teachers or admins
    return list.filter((e: any) => {
      const studentObj = e.student || e.user || e;
      const studentId = studentObj?.id || e.studentId || e.id;
      const email = (studentObj?.email || e.email || "").toLowerCase();

      // 1. Check explicit roles
      const roles = studentObj.roles || studentObj.user?.roles || [];
      const roleStr = String(studentObj.role || "").toLowerCase();

      const hasRestrictedRole =
        (Array.isArray(roles) &&
          roles.some((r: any) => {
            const name = String(
              r.role?.name || r.name || r || "",
            ).toLowerCase();
            return name === "teacher" || name === "admin" || name === "staff";
          })) ||
        roleStr === "teacher" ||
        roleStr === "admin" ||
        roleStr === "staff";

      if (hasRestrictedRole) return false;

      // 2. Cross-reference with global teachers list for extra safety
      if (teachers && teachers.length > 0) {
        const isActuallyTeacher = teachers.some(
          (t: any) =>
            (t.id === studentId && studentId) ||
            (t.email?.toLowerCase() === email && email) ||
            (t.teacherId === studentId && studentId),
        );
        if (isActuallyTeacher) return false;
      }

      return true;
    });
  }, [selectedClassDetails, selectedClass]);

  const classTeachers = useMemo(() => {
    const source =
      selectedClassDetails?.id === selectedClass?.id
        ? selectedClassDetails
        : selectedClass;

    if (!source) return [];

    // Check multiple possible paths for teacher assignments
    let assignments =
      source.teacherAssignments ||
      source.teachers ||
      source.classTeachers ||
      source.data?.teacherAssignments ||
      source.data?.teachers ||
      [];

    // If no teachers found in source, check if any teachers in the users list are assigned to this class
    if (
      (!assignments || assignments.length === 0) &&
      source.id &&
      teachers &&
      teachers.length > 0
    ) {
      const classId = source.id;
      const matchedTeachers = teachers.filter((t: any) => {
        // Check various possible class assignment fields
        return (
          t.classId === classId ||
          t.primaryClassId === classId ||
          t.assignedClasses?.includes(classId) ||
          t.classes?.some((c: any) => c.id === classId || c.classId === classId)
        );
      });
      if (matchedTeachers.length > 0) {
        assignments = matchedTeachers.map((t: any) => ({ teacher: t }));
      }
    }

    return Array.isArray(assignments) ? assignments : [];
  }, [selectedClassDetails, selectedClass, teachers]);

  return (
    <div className="w-full">
      <ProductTour tourKey="admin_classes" steps={classTourSteps} />
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Page Header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: "clamp(1.25rem, 2vw, 1.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>
            Class Management
          </h1>
          <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            Create classes, assign teachers, and view enrolled students.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Button
            variant="outline"
            className="h-10 gap-2"
            style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}
            onClick={handleExportRosters}
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="classes-add-btn h-10 gap-2 text-white"
            style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" />
            Add Class
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="classes-filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--text-secondary)", pointerEvents: "none" }} />
          <Input
            placeholder="Search by class name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger style={{ height: 40, width: 160, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessionOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div style={{ display: "flex", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "#ffffff" }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{ padding: "0 10px", background: viewMode === "grid" ? "var(--surface-muted)" : "transparent", transition: "background var(--dur-fast)" }}
            >
              <Grid style={{ width: 15, height: 15, color: viewMode === "grid" ? "var(--foreground)" : "var(--text-secondary)" }} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{ padding: "0 10px", background: viewMode === "list" ? "var(--surface-muted)" : "transparent", transition: "background var(--dur-fast)" }}
            >
              <List style={{ width: 15, height: 15, color: viewMode === "list" ? "var(--foreground)" : "var(--text-secondary)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Classes Grid/List */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Loading classes...</p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="classes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1/-1", padding: "64px 0", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Users style={{ width: 22, height: 22, color: "var(--text-secondary)" }} />
              </div>
              <p style={{ fontWeight: 600, color: "var(--foreground)", fontSize: 14 }}>No classes found</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>Create your first class to get started</p>
            </div>
          ) : (
            paginatedClasses.map((cls: any, idx) => {
              const accent = getAccentByIndex(idx);
              const bStudentCount = cls.studentCount ?? cls._count?.enrollments ?? cls._count?.students ?? 0;
              const bTeacherCount = cls.teacherCount ?? cls._count?.teacherAssignments ?? cls._count?.teachers ?? 0;
              const studentCount = getStudentCountForClass(cls.id, bStudentCount);
              const teacherCount = getTeacherCountForClass(cls.id, bTeacherCount);
              const fillPct = cls.capacity ? Math.min((studentCount / cls.capacity) * 100, 100) : 0;

              return (
                <div
                  key={cls.id}
                  style={{ background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", padding: 20, display: "flex", flexDirection: "column", gap: 16, transition: "box-shadow var(--dur-smooth) var(--ease-out-expo), transform var(--dur-smooth) var(--ease-out-expo)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-hover)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-card)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: accent.tint, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 800, fontSize: 14, color: accent.color }}>
                          {(cls.name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--foreground)", margin: 0, lineHeight: 1.3 }}>{cls.name}</p>
                        <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 12, color: "var(--text-secondary)", margin: 0, marginTop: 2 }}>
                          {cls.level ? `Level ${cls.level}` : "No level"}{cls.stream ? ` · Stream ${cls.stream}` : ""}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center" }}>
                          <MoreVertical style={{ width: 15, height: 15 }} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" style={{ width: 148 }}>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedClass(cls); setEditForm({ name: cls.name || "", level: String(cls.level || ""), stream: cls.stream || "", capacity: String(cls.capacity || ""), academicYear: cls.academicYear || "" }); setShowEditModal(true); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer" onClick={() => { setClassToDelete(cls); setShowDeleteModal(true); }}>
                          <Trash className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users style={{ width: 14, height: 14, color: "var(--text-secondary)" }} />
                      <span style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{studentCount}</span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>students</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <GraduationCap style={{ width: 14, height: 14, color: "var(--cobalt-signal)" }} />
                      <span style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{teacherCount}</span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>teachers</span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  {cls.capacity ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Capacity</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{studentCount} / {cls.capacity}</span>
                      </div>
                      <div style={{ height: 4, background: "var(--surface-muted)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${fillPct}%`, background: fillPct >= 90 ? "var(--crimson-signal)" : fillPct >= 70 ? "var(--amber-signal)" : accent.color, borderRadius: "var(--radius-pill)", transition: "width var(--dur-smooth)" }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 4 }} />
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <button
                      style={{ flex: 1, height: 36, background: "var(--violet-ink)", color: "#ffffff", border: "none", borderRadius: "var(--radius-md)", fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "opacity var(--dur-fast)" }}
                      onClick={() => viewClassDetails(cls)}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <Eye style={{ width: 14, height: 14 }} /> View Details
                    </button>
                    <button
                      style={{ width: 36, height: 36, background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", transition: "background var(--dur-fast)" }}
                      onClick={() => { setSelectedClass(cls); setShowAssignModal(true); }}
                      title="Assign teacher"
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <UserPlus style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Class Card */}
          {filtered.length > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ border: "2px dashed var(--border-medium)", borderRadius: "var(--radius-lg)", minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "transparent", cursor: "pointer", transition: "border-color var(--dur-fast), background var(--dur-fast)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--violet-ink)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--violet-tint)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-medium)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--violet-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus style={{ width: 20, height: 20, color: "var(--violet-ink)" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: "var(--violet-ink)", margin: 0 }}>Add New Class</p>
                <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 12, color: "var(--text-secondary)", margin: 0, marginTop: 2 }}>Create a new class</p>
              </div>
            </button>
          )}
        </div>
      ) : (
        /* List View */
        <div style={{ background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                  {["Class Name", "Level", "Students", "Teachers", "Capacity", "Actions"].map((h, i) => (
                    <th key={h} style={{ textAlign: i <= 1 ? "left" : "center", fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: i === 0 ? "12px 20px" : "12px 12px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedClasses.map((cls: any, idx) => {
                  const bStudentCount = cls.studentCount ?? cls._count?.enrollments ?? cls._count?.students ?? 0;
                  const bTeacherCount = cls.teacherCount ?? cls._count?.teacherAssignments ?? cls._count?.teachers ?? 0;
                  const studentCount = getStudentCountForClass(cls.id, bStudentCount);
                  const teacherCount = getTeacherCountForClass(cls.id, bTeacherCount);
                  const accent = getAccentByIndex(idx);
                  return (
                    <tr
                      key={cls.id}
                      style={{ borderBottom: "1px solid var(--border-fine)", background: "#ffffff", transition: "background var(--dur-fast)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                    >
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: accent.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontWeight: 800, fontSize: 12, color: accent.color }}>{(cls.name || "?")[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)", margin: 0 }}>{cls.name}</p>
                            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>{cls.stream ? `Stream ${cls.stream}` : "Stream A"}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 12px", fontSize: 13, color: "var(--text-secondary)" }}>{cls.level || "—"}</td>
                      <td style={{ padding: "14px 12px", textAlign: "center", fontWeight: 600, fontSize: 14, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{studentCount}</td>
                      <td style={{ padding: "14px 12px", textAlign: "center", fontWeight: 600, fontSize: 14, color: "var(--cobalt-signal)", fontVariantNumeric: "tabular-nums" }}>{teacherCount}</td>
                      <td style={{ padding: "14px 12px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>{cls.capacity || "—"}</td>
                      <td style={{ padding: "14px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <button
                            style={{ height: 32, padding: "0 12px", background: "var(--violet-ink)", color: "#ffffff", border: "none", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                            onClick={() => viewClassDetails(cls)}
                          >
                            <Eye style={{ width: 13, height: 13 }} /> View
                          </button>
                          <button
                            style={{ width: 32, height: 32, background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}
                            onClick={() => { setSelectedClass(cls); setEditForm({ name: cls.name || "", level: String(cls.level || ""), stream: cls.stream || "", capacity: String(cls.capacity || ""), academicYear: cls.academicYear || "" }); setShowEditModal(true); }}
                            title="Edit"
                          >
                            <Pencil style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            style={{ width: 32, height: 32, background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--crimson-signal)" }}
                            onClick={() => { setClassToDelete(cls); setShowDeleteModal(true); }}
                            title="Delete"
                          >
                            <Trash style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalClassPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Showing <strong style={{ color: "var(--foreground)" }}>{(page - 1) * CLASSES_PER_PAGE + 1}</strong>–<strong style={{ color: "var(--foreground)" }}>{Math.min(page * CLASSES_PER_PAGE, filtered.length)}</strong> of <strong style={{ color: "var(--foreground)" }}>{filtered.length}</strong>
          </p>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>Previous</button>
            {Array.from({ length: totalClassPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: page === p ? "var(--violet-ink)" : "#ffffff", color: page === p ? "#ffffff" : "var(--foreground)", fontSize: 13, fontWeight: page === p ? 600 : 400, cursor: "pointer" }}>{p}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalClassPages, p + 1))} disabled={page === totalClassPages} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page === totalClassPages ? "not-allowed" : "pointer", opacity: page === totalClassPages ? 0.4 : 1 }}>Next</button>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowCreateModal(false)} />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 460, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Create Class</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Add a new class to your school</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Class Name</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. JSS 1A" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Level</label>
                    <Input value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))} placeholder="e.g. JSS1" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Stream</label>
                    <Input value={form.stream} onChange={(e) => setForm((p) => ({ ...p, stream: e.target.value }))} placeholder="e.g. A" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Capacity</label>
                    <Input value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="e.g. 40" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Academic Year</label>
                    <Input value={form.academicYear} onChange={(e) => setForm((p) => ({ ...p, academicYear: e.target.value }))} placeholder={currentSession || "2024/2025"} style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
                <Button variant="outline" onClick={() => setShowCreateModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
                <Button onClick={submit} disabled={loading} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>{loading ? "Creating..." : "Create Class"}</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Edit Class Modal */}
      {showEditModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowEditModal(false)} />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 460, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Edit Class</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Update class details</p>
                </div>
                <button onClick={() => setShowEditModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
              </div>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Class Name</label>
                  <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. JSS 1A" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Level</label>
                    <Input value={editForm.level} onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))} placeholder="e.g. JSS1" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Stream</label>
                    <Input value={editForm.stream} onChange={(e) => setEditForm((p) => ({ ...p, stream: e.target.value }))} placeholder="e.g. A" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Capacity</label>
                    <Input value={editForm.capacity} onChange={(e) => setEditForm((p) => ({ ...p, capacity: e.target.value }))} placeholder="e.g. 40" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Academic Year</label>
                    <Input value={editForm.academicYear} onChange={(e) => setEditForm((p) => ({ ...p, academicYear: e.target.value }))} placeholder={currentSession || "2024/2025"} style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
                <Button variant="outline" onClick={() => setShowEditModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
                <Button onClick={handleUpdateClass} disabled={isUpdating} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>{isUpdating ? "Updating..." : "Update Class"}</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Assign Teacher Modal */}
      {showAssignModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowAssignModal(false)} />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 420, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Assign Class Teacher</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Assign a teacher to {selectedClass?.name || "this class"}</p>
                </div>
                <button onClick={() => setShowAssignModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Select Teacher</label>
                <div style={{ position: "relative", zIndex: 10001 }}>
                  <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                    <SelectTrigger style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                      <SelectValue placeholder="Choose a teacher" />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10002 }}>
                      {(teachers || []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{`${t.firstName || ""} ${t.lastName || ""}`.trim() || t.email || t.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
                <Button variant="outline" onClick={() => setShowAssignModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
                <Button onClick={assignClassTeacher} disabled={loading} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>{loading ? "Assigning..." : "Assign Teacher"}</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Class Details Modal */}
      {showDetailsModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowDetailsModal(false)} />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)", flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{selectedClass?.name || "Class Details"}</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 6px" }}>Level: {selectedClass?.level || "—"} · Capacity: {selectedClass?.capacity || "—"}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className="badge badge-active" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Users style={{ width: 12, height: 12 }} />{classStudents.length} Students</span>
                    <span className="badge badge-info" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><GraduationCap style={{ width: 12, height: 12 }} />{classTeachers.length} Teachers</span>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", flexShrink: 0 }}><X style={{ width: 16, height: 16 }} /></button>
              </div>

              {/* Body */}
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
                {loadingDetails ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
                  </div>
                ) : (
                  <>
                    {/* Teachers */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <h3 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <GraduationCap style={{ width: 15, height: 15, color: "var(--cobalt-signal)" }} />Assigned Teachers ({classTeachers.length})
                        </h3>
                        <button
                          onClick={() => { setShowDetailsModal(false); setShowAssignModal(true); }}
                          style={{ height: 30, padding: "0 10px", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-sm)", background: "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--foreground)" }}
                        ><Plus style={{ width: 12, height: 12 }} />Add</button>
                      </div>
                      {classTeachers.length === 0 ? (
                        <div style={{ padding: 14, borderRadius: "var(--radius-md)", background: "var(--amber-tint)", border: "1px solid var(--amber-signal)", opacity: 0.8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>No teachers assigned yet.</p>
                          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Use the "+" button on the class card to assign a class teacher, or assign via the Subjects page.</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {classTeachers.map((t: any, idx: number) => {
                            const teacher = t.teacher || t;
                            const isClassTeacher = t.type === "class_teacher" || !t.subjectName;
                            const subjectName = t.subjectName || teacher?.subjectName;
                            return (
                              <div key={`${teacher?.id || "-"}-${idx}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "#ffffff" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isClassTeacher ? "var(--cobalt-tint)" : "var(--violet-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: isClassTeacher ? "var(--cobalt-signal)" : "var(--violet-ink)" }}>
                                    {(teacher?.firstName?.[0] || "T").toUpperCase()}
                                  </div>
                                  <div>
                                    <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{`${teacher?.firstName || ""} ${teacher?.lastName || ""}`.trim() || "Teacher"}</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                      <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>{teacher?.email || teacher?.teacherId || "—"}</p>
                                      <span className={isClassTeacher ? "badge badge-info" : "badge badge-pending"} style={{ fontSize: 10 }}>{isClassTeacher ? "Class Teacher" : subjectName || "Subject Teacher"}</span>
                                    </div>
                                  </div>
                                </div>
                                {isClassTeacher && (
                                  <button onClick={() => handleRemoveTeacher(teacher?.id)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }} title="Remove">
                                    <UserMinus style={{ width: 14, height: 14 }} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Subjects */}
                    <div style={{ borderTop: "1px solid var(--border-fine)", paddingTop: 20, marginBottom: 24 }}>
                      <h3 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <BookOpen style={{ width: 15, height: 15, color: "var(--violet-ink)" }} />Subjects & Specialists ({selectedClassSubjects.length})
                      </h3>
                      {selectedClassSubjects.length === 0 ? (
                        <div style={{ padding: 14, borderRadius: "var(--radius-md)", border: "2px dashed var(--border-medium)", textAlign: "center" }}>
                          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>No subjects assigned to this class yet.</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {selectedClassSubjects.map((subject: any) => {
                            const assignedTeachers = subject.teachers || [];
                            const isAssigning = assigningSubjectId === subject.classSubjectId;
                            return (
                              <div key={subject.classSubjectId} style={{ padding: 14, borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "#ffffff" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--violet-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      <BookOpen style={{ width: 16, height: 16, color: "var(--violet-ink)" }} />
                                    </div>
                                    <div>
                                      <p style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{subject.name}</p>
                                      <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                                        <span className="badge badge-draft" style={{ fontSize: 10, textTransform: "uppercase" }}>{subject.subjectType || "Core"}</span>
                                        {subject.difficulty && <span className="badge badge-draft" style={{ fontSize: 10, textTransform: "uppercase" }}>{subject.difficulty}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  {!isAssigning && (
                                    <button
                                      onClick={() => setAssigningSubjectId(subject.classSubjectId)}
                                      style={{ height: 30, padding: "0 10px", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-sm)", background: "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--violet-ink)" }}
                                    ><UserPlus style={{ width: 12, height: 12 }} />{assignedTeachers.length > 0 ? "Add Support" : "Assign"}</button>
                                  )}
                                </div>

                                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                  {assignedTeachers.length === 0 && !isAssigning && (
                                    <p style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, margin: 0 }}>
                                      <AlertTriangle style={{ width: 12, height: 12, color: "var(--amber-signal)" }} />No specialist assigned.
                                    </p>
                                  )}
                                  {assignedTeachers.map((t: any) => (
                                    <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: "var(--radius-sm)", background: "var(--surface-muted)" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--violet-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--violet-ink)" }}>
                                          {(t.teacher?.firstName?.[0] || t.teacher?.lastName?.[0] || "T").toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{t.teacher?.firstName} {t.teacher?.lastName}</span>
                                        {t.type === "primary" && <span className="badge badge-active" style={{ fontSize: 10 }}>Primary</span>}
                                      </div>
                                      <button onClick={() => handleRemoveSubjectTeacher(subject.classSubjectId, t.teacherId)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", borderRadius: "var(--radius-xs)" }}>
                                        <X style={{ width: 12, height: 12 }} />
                                      </button>
                                    </div>
                                  ))}
                                  {isAssigning && (
                                    <div style={{ padding: 10, borderRadius: "var(--radius-md)", background: "var(--violet-tint)", border: "1px solid var(--border-fine)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                      <p style={{ fontSize: 10, fontWeight: 700, color: "var(--violet-ink)", textTransform: "uppercase", margin: 0, width: "100%" }}>Choose Specialist</p>
                                      <Select value={subjectTeacherId} onValueChange={setSubjectTeacherId}>
                                        <SelectTrigger style={{ height: 34, minWidth: 200, fontSize: 12, borderColor: "var(--border-fine)", background: "#ffffff", borderRadius: "var(--radius-sm)" }}>
                                          <SelectValue placeholder="Select from directory..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(teachers || []).map((t: any) => (
                                            <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <button onClick={() => handleAssignSubjectTeacher(subject.classSubjectId, subjectTeacherId)} style={{ height: 34, padding: "0 12px", background: "var(--violet-ink)", color: "#ffffff", border: "none", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                                        <Check style={{ width: 12, height: 12 }} />Assign
                                      </button>
                                      <button onClick={() => { setAssigningSubjectId(null); setSubjectTeacherId(""); }} style={{ height: 34, padding: "0 10px", background: "transparent", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer", color: "var(--text-secondary)" }}>Cancel</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Students */}
                    <div style={{ borderTop: "1px solid var(--border-fine)", paddingTop: 20 }}>
                      <h3 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 700, fontSize: 13, color: "var(--foreground)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <Users style={{ width: 15, height: 15, color: "var(--emerald-signal)" }} />Enrolled Students ({classStudents.length})
                      </h3>
                      {classStudents.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>No students enrolled yet. Go to Enrollments to add students.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                          {classStudents.map((e: any, idx: number) => {
                            const student = e.student || e;
                            return (
                              <div key={student?.id || idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-fine)", background: "#ffffff" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--emerald-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "var(--emerald-signal)" }}>
                                    {(student?.firstName?.[0] || "S").toUpperCase()}
                                  </div>
                                  <div>
                                    <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{`${student?.firstName || ""} ${student?.lastName || ""}`.trim() || "Student"}</p>
                                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0", fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{student?.studentId || student?.email || "—"}</p>
                                  </div>
                                </div>
                                <button onClick={() => handleRemoveStudent(student?.id)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }} title="Remove">
                                  <UserMinus style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", background: "var(--surface-muted)", flexShrink: 0 }}>
                <Button variant="outline" onClick={() => setShowDetailsModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Close</Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal &&
        classToDelete &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.55)" }} onClick={() => !isDeleting && setShowDeleteModal(false)} />
            <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 420, padding: "28px 28px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--crimson-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle style={{ width: 24, height: 24, color: "var(--crimson-signal)" }} />
                </div>
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 17, fontWeight: 800, color: "var(--foreground)", margin: "0 0 6px" }}>Delete Class?</h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
                    Are you sure you want to delete <strong style={{ color: "var(--foreground)" }}>{classToDelete.name}</strong>? This cannot be undone. Enrolled students will lose their class assignment.
                  </p>
                </div>
                <div style={{ display: "flex", width: "100%", gap: 10, marginTop: 8 }}>
                  <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting} style={{ flex: 1, height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600 }}>Cancel</Button>
                  <Button onClick={handleDeleteClass} disabled={isDeleting} style={{ flex: 1, height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--crimson-signal)", color: "#ffffff", border: "none" }}>
                    {isDeleting ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />Deleting...
                      </span>
                    ) : "Delete Class"}
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
