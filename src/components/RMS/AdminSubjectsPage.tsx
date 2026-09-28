"use client";

import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { selectAdminSubjects, selectTeachers } from "@/reduxToolKit/selectors";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import {
  assignTeacherToSubject,
  createSubject,
  assignSubjectToClass,
  removeSubjectFromClass,
  updateSubjectDetails,
  fetchClasses,
  fetchSubjects,
} from "@/reduxToolKit/admin/adminThunks";
import { clearAdminError, clearAdminSuccess } from "@/reduxToolKit/admin/adminSlice";
import { fetchAllUsers, getTenantInfo } from "@/reduxToolKit/user/userThunks";
import {
  useDeleteSubjectMutation,
  useAssignTeacherToClassSubjectMutation,
  useRemoveTeacherFromClassSubjectMutation,
} from "@/reduxToolKit/api/endpoints/subjects";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  UserPlus,
  Link,
  Unlink,
} from "lucide-react";
import { ProductTour } from "@/components/common/ProductTour";

const subjectTourSteps = [
  {
    target: '.subjects-create-btn',
    content: "Create a new subject by defining its name, code, and class level. Subjects are linked directly to classes and assigned to specific teachers.",
    disableBeacon: true,
  },
  {
    target: '.subjects-filter-bar',
    content: "Filter subjects by class or level to keep your curriculum organized, especially when managing a large number of subjects across different classes.",
  },
  {
    target: '.subjects-table',
    content: "This table lists all your subjects. Click the 'Assign' button on any row to link a teacher to that subject, which enables them to create assessments and enter scores.",
  },
];

const DEFAULT_PRIMARY = "#641BC4";

// Design-system class badge accents
const classBadgeAccents = [
  { bg: "var(--violet-tint)", color: "var(--violet-ink)" },
  { bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
  { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
  { bg: "var(--amber-tint)", color: "var(--amber-signal)" },
  { bg: "var(--crimson-tint)", color: "var(--crimson-signal)" },
];

const getAccentByIndex = (idx: number) => classBadgeAccents[idx % classBadgeAccents.length];

export function AdminSubjectsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { subjects, classes, loading, error, success, schoolSettings } = useSelector(selectAdminSubjects);
  const teachers = useSelector(selectTeachers);
  const { tenantInfo } = useSelector((s: RootState) => s.user);
  const primaryColor = schoolSettings?.primaryColor || DEFAULT_PRIMARY;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [classFilter, setClassFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    code: "",
    classIds: [] as string[],
    description: "",
  });
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [deleteSubjectName, setDeleteSubjectName] = useState("");
  const [deleteSubject, { isLoading: deleting }] = useDeleteSubjectMutation();
  const [assignTeacherToClassSubject] = useAssignTeacherToClassSubjectMutation();
  const [removeTeacherFromClassSubject] = useRemoveTeacherFromClassSubjectMutation();

  // Edit subject (name/code at school level)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Manage class assignments for a subject
  const [showManageClassesModal, setShowManageClassesModal] = useState(false);
  const [managingSubject, setManagingSubject] = useState<any>(null);
  const [manageClassLoading, setManageClassLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchSubjects());
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
    // Only fetch users if the teachers list is not already populated
    if (!teachers || teachers.length === 0) {
      dispatch(fetchAllUsers());
    }
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

  // Create class name lookup
  const classById = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of classes) map.set(c.id, c);
    return map;
  }, [classes]);


  // Filter subjects — new model: classSubjects[] array instead of classId
  const filtered = useMemo(() => {
    let result = subjects;

    // Filter by class using classSubjects[] join records
    if (classFilter !== "all") {
      result = result.filter((s: any) => {
        const cs: any[] = s.classSubjects || [];
        // Fallback to legacy classId for backward compat
        return cs.some((c: any) => c.classId === classFilter) || s.classId === classFilter;
      });
    }

    // Filter by level via class lookup
    if (levelFilter !== "all") {
      result = result.filter((s: any) => {
        const cs: any[] = s.classSubjects || [];
        // Check classSubjects[].class
        if (cs.some((c: any) => {
          const cls = c.class || classById.get(c.classId);
          return cls?.level === levelFilter || cls?.name === levelFilter;
        })) return true;
        // Legacy fallback
        const cls = classById.get(s.classId);
        return cls?.level === levelFilter || cls?.name === levelFilter;
      });
    }

    // Search
    const term = debouncedSearch.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(term) ||
          (s.code || "").toLowerCase().includes(term)
      );
    }

    return result;
  }, [subjects, classFilter, levelFilter, debouncedSearch, classById]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedSubjects = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, classFilter, levelFilter]);

  const handleCreateSubject = async () => {
    if (!form.name.trim()) return toast.error("Subject name is required");
    try {
      // Step 1: Create the school-level subject (classId optional)
      const firstClassId = form.classIds[0];
      const created = await dispatch(
        createSubject({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          // Pass first classId inline if provided — backend auto-links it
          classId: firstClassId || undefined,
          description: form.description.trim() || undefined,
        })
      ).unwrap();

      // Step 2: Assign remaining classes (if any) via POST /subjects/:id/classes
      const remainingClassIds = form.classIds.slice(1);
      if (remainingClassIds.length > 0 && created?.id) {
        await Promise.all(
          remainingClassIds.map((classId) =>
            dispatch(assignSubjectToClass({ subjectId: created.id, classId })).unwrap()
          )
        );
      }

      toast.success(
        form.classIds.length > 1
          ? `Subject created and assigned to ${form.classIds.length} classes`
          : form.classIds.length === 1
            ? "Subject created and assigned to class"
            : "Subject created in school catalogue"
      );
      setForm({ name: "", code: "", classIds: [], description: "" });
      setShowCreateModal(false);
      dispatch(fetchSubjects());
    } catch (e: any) {
      toast.error(typeof e === "string" ? e : e?.message || "Failed to create subject");
    }
  };

  const handleEditSubject = async () => {
    if (!editSubject) return;
    if (!editForm.name.trim()) return toast.error("Subject name is required");
    setEditLoading(true);
    try {
      await dispatch(updateSubjectDetails({ id: editSubject.id, name: editForm.name.trim(), code: editForm.code.trim() || undefined })).unwrap();
      toast.success("Subject updated");
      setShowEditModal(false);
      setEditSubject(null);
      dispatch(fetchSubjects());
    } catch (e: any) {
      toast.error(typeof e === "string" ? e : e?.message || "Failed to update subject");
    } finally {
      setEditLoading(false);
    }
  };

  const handleAssignToClass = async (classId: string) => {
    if (!managingSubject) return;
    setManageClassLoading(true);
    try {
      await dispatch(assignSubjectToClass({ subjectId: managingSubject.id, classId })).unwrap();
      toast.success("Subject assigned to class");
      dispatch(fetchSubjects());
      // Update local managing subject state
      const res = await dispatch(fetchSubjects()).unwrap();
      const updated = (res as any[])?.find((s: any) => s.id === managingSubject.id);
      if (updated) setManagingSubject(updated);
    } catch (e: any) {
      toast.error(typeof e === "string" ? e : e?.message || "Failed to assign to class");
    } finally {
      setManageClassLoading(false);
    }
  };

  const handleRemoveFromClass = async (classId: string) => {
    if (!managingSubject) return;
    if (!confirm("Remove this subject from the class? The subject stays in the school catalogue.")) return;
    setManageClassLoading(true);
    try {
      await dispatch(removeSubjectFromClass({ subjectId: managingSubject.id, classId })).unwrap();
      toast.success("Subject removed from class");
      dispatch(fetchSubjects());
      const res = await dispatch(fetchSubjects()).unwrap();
      const updated = (res as any[])?.find((s: any) => s.id === managingSubject.id);
      if (updated) setManagingSubject(updated);
    } catch (e: any) {
      toast.error(typeof e === "string" ? e : e?.message || "Failed to remove from class");
    } finally {
      setManageClassLoading(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deleteSubjectId) return;
    try {
      await deleteSubject(deleteSubjectId).unwrap();
      toast.success("Subject deleted successfully");
      dispatch(fetchSubjects());
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Failed to delete subject");
    } finally {
      setDeleteSubjectId(null);
      setDeleteSubjectName("");
    }
  };

  // assignClassSubjectId: the classSubjectId to scope teacher assignment to
  // null means "no specific class" — falls back to legacy school-wide endpoint
  const [assignClassSubjectId, setAssignClassSubjectId] = useState<string | null>(null);

  const handleAssignTeacher = async () => {
    if (!selectedSubject) return toast.error("Please select a subject");
    if (!assignTeacherId) return toast.error("Please select a teacher");
    try {
      if (assignClassSubjectId) {
        // New model: assign to specific class-subject
        await assignTeacherToClassSubject({ classSubjectId: assignClassSubjectId, teacherId: assignTeacherId }).unwrap();
      } else {
        // Legacy fallback: school-wide assignment
        await dispatch(assignTeacherToSubject({ subjectId: selectedSubject.id, teacherId: assignTeacherId })).unwrap();
      }
      toast.success("Teacher assigned successfully");
      setAssignTeacherId("");
      setAssignClassSubjectId(null);
      setShowAssignModal(false);
      setSelectedSubject(null);
      dispatch(fetchSubjects());
    } catch (e: any) {
      toast.error(typeof e === "string" ? e : e?.data?.message || "Failed to assign teacher");
    }
  };

  // Open assign modal — if subject has classSubjects, pick the first classSubjectId
  // so we default to the new scoped assignment
  const openAssignModal = (subject: any, classSubjectId?: string) => {
    setSelectedSubject(subject);
    setAssignTeacherId("");
    // Use explicitly passed classSubjectId, or first classSubject from subject
    const csId = classSubjectId ?? subject.classSubjects?.[0]?.id ?? null;
    setAssignClassSubjectId(csId);
    setShowAssignModal(true);
  };

  // Create a map of teacher IDs to teacher data for lookup
  const teacherById = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of (teachers || [])) {
      map.set(t.id, t);
    }
    return map;
  }, [teachers]);

  const getTeacherInfo = (subject: any) => {
    // 1. New model: teachers[] from GET /subjects/by-class (class-scoped TeacherClassSubject)
    if (subject.teachers?.length > 0) {
      return subject.teachers[0].teacher ?? null;
    }

    // 2. Legacy: teacherAssignments[] from GET /subjects (school-wide TeacherSubject)
    if (subject.teacherAssignments?.length > 0) {
      const a = subject.teacherAssignments[0];
      return a.teacher ?? teacherById.get(a.teacherId) ?? null;
    }

    // 3. Direct teacher field or teacherId lookup
    if (subject.teacher) return subject.teacher;
    if (subject.teacherId) return teacherById.get(subject.teacherId);

    return null;
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase() || "?";
  };

  const getAvatarAccent = (name: string) => {
    const accents = [
      { bg: "var(--violet-tint)", color: "var(--violet-ink)" },
      { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
      { bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
      { bg: "var(--amber-tint)", color: "var(--amber-signal)" },
      { bg: "var(--crimson-tint)", color: "var(--crimson-signal)" },
    ];
    const index = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % accents.length;
    return accents[index];
  };

  return (
    <div className="w-full">
      <ProductTour tourKey="admin_subjects" steps={subjectTourSteps} />
      <Header 
        schoolLogo={tenantInfo?.logoUrl} 
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Page Header */}
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: "clamp(1.25rem, 2vw, 1.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>Subject Management</h1>
            <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Manage curriculum, assign teachers, and organize classes.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="subjects-create-btn h-10 gap-2 text-white"
            style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600 }}
          >
            <Plus className="w-4 h-4" />
            Create Subject
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="subjects-filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--text-secondary)", pointerEvents: "none" }} />
            <Input
              placeholder="Search by subject code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger style={{ height: 40, width: 160, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Loading subjects...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="subjects-table" style={{ background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                      {["Subject Code", "Subject Name", "Classes", "Assigned Teacher", "Actions"].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 4 ? "center" : "left", fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: i === 0 ? "12px 20px" : "12px 12px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSubjects.map((subject: any, idx) => {
                      const classSubjects: any[] = subject.classSubjects || [];
                      const globalIdx = (page - 1) * ITEMS_PER_PAGE + idx;
                      const teacher = getTeacherInfo(subject);
                      const teacherName = teacher?.name || `${teacher?.firstName || ""} ${teacher?.lastName || ""}`.trim();
                      const teacherAccent = teacher ? getAvatarAccent(teacherName) : null;

                      return (
                        <tr
                          key={subject.id || idx}
                          style={{ borderBottom: "1px solid var(--border-fine)", background: "#ffffff", transition: "background var(--dur-fast)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                        >
                          <td style={{ padding: "14px 20px" }}>
                            <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 12, color: "var(--text-secondary)", background: "var(--surface-muted)", padding: "3px 8px", borderRadius: "var(--radius-xs)" }}>
                              {subject.code || "—"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 12px" }}>
                            <span style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{subject.name}</span>
                          </td>
                          <td style={{ padding: "14px 12px" }}>
                            {classSubjects.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {classSubjects.slice(0, 3).map((cs: any, i: number) => {
                                  const accent = getAccentByIndex(globalIdx + i);
                                  const name = cs.class?.name || classById.get(cs.classId)?.name || cs.classId;
                                  return (
                                    <span key={cs.id || i} style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-xs)", background: accent.bg, color: accent.color, fontSize: 11, fontWeight: 600 }}>
                                      {name}
                                    </span>
                                  );
                                })}
                                {classSubjects.length > 3 && (
                                  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "var(--surface-muted)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }}>
                                    +{classSubjects.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>No classes</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 12px" }}>
                            {teacher && teacherAccent ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: teacherAccent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: teacherAccent.color, flexShrink: 0 }}>
                                  {teacher.name
                                    ? teacher.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                                    : getInitials(teacher.firstName, teacher.lastName)
                                  }
                                </div>
                                <div>
                                  <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{teacherName || "Teacher"}</p>
                                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Subject Teacher</p>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => openAssignModal(subject)}
                                style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}
                              >
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <UserPlus style={{ width: 14, height: 14 }} />
                                </div>
                                <span style={{ fontStyle: "italic" }}>Unassigned</span>
                              </button>
                            )}
                          </td>
                          <td style={{ padding: "14px 12px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                              <button onClick={() => { setEditSubject(subject); setEditForm({ name: subject.name, code: subject.code || "" }); setShowEditModal(true); }} style={{ padding: 7, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }} title="Edit">
                                <Pencil style={{ width: 14, height: 14 }} />
                              </button>
                              <button onClick={() => openAssignModal(subject)} style={{ padding: 7, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }} title="Assign teacher">
                                <UserPlus style={{ width: 14, height: 14 }} />
                              </button>
                              <button onClick={() => { setManagingSubject(subject); setShowManageClassesModal(true); }} style={{ padding: 7, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--cobalt-signal)" }} title="Manage classes">
                                <Link style={{ width: 14, height: 14 }} />
                              </button>
                              <button onClick={() => { setDeleteSubjectId(subject.id); setDeleteSubjectName(subject.name); }} style={{ padding: 7, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--crimson-signal)" }} title="Delete">
                                <Trash2 style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedSubjects.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "64px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
                          No subjects found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {filtered.length > 0 && totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Showing <strong style={{ color: "var(--foreground)" }}>{(page - 1) * ITEMS_PER_PAGE + 1}</strong>–<strong style={{ color: "var(--foreground)" }}>{Math.min(page * ITEMS_PER_PAGE, filtered.length)}</strong> of <strong style={{ color: "var(--foreground)" }}>{filtered.length}</strong>
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>Previous</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const maxVis = 5;
                    let start = Math.max(1, page - Math.floor(maxVis / 2));
                    const end = Math.min(totalPages, start + maxVis - 1);
                    if (end - start + 1 < maxVis) start = Math.max(1, end - maxVis + 1);
                    return start + i;
                  }).map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: page === p ? "var(--violet-ink)" : "#ffffff", color: page === p ? "#ffffff" : "var(--foreground)", fontSize: 13, fontWeight: page === p ? 600 : 400, cursor: "pointer" }}>{p}</button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Subject Modal */}
      {showCreateModal && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => { setShowCreateModal(false); setForm({ name: "", code: "", classIds: [], description: "" }); }} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 620, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Create Subject</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Add a new subject to one or more classes</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); setForm({ name: "", code: "", classIds: [], description: "" }); }} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Subject Name</label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Mathematics" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Code</label>
                  <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. MATH101" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13, fontFamily: "'Geist Mono', ui-monospace, monospace" }} />
                  {form.classIds.length > 1 && form.code.trim() && <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>A class suffix will be appended for each class.</p>}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Description (Optional)</label>
                  <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                    Classes {form.classIds.length > 0 && <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>({form.classIds.length} selected)</span>}
                  </label>
                  {form.classIds.length > 0 && <button type="button" onClick={() => setForm((p) => ({ ...p, classIds: [] }))} style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>}
                </div>
                <div style={{ border: "1px solid var(--border-fine)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {classes.map((c) => {
                      const checked = form.classIds.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-fine)", background: checked ? "var(--violet-tint)" : "#ffffff" }}>
                          <Checkbox checked={checked} onCheckedChange={(val) => setForm((p) => ({ ...p, classIds: val ? [...p.classIds, c.id] : p.classIds.filter((id) => id !== c.id) }))} />
                          <span style={{ fontSize: 13, color: "var(--foreground)" }}>{c.name}{c.level ? <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>({c.level})</span> : null}</span>
                        </label>
                      );
                    })}
                    {classes.length === 0 && <p style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>No classes found</p>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => setShowCreateModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
              <Button onClick={handleCreateSubject} disabled={loading} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>
                {loading ? "Creating..." : form.classIds.length > 1 ? `Create ${form.classIds.length} Subjects` : "Create Subject"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteSubjectId && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => { setDeleteSubjectId(null); setDeleteSubjectName(""); }} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 400, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
              <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Delete Subject</h2>
              <button onClick={() => { setDeleteSubjectId(null); setDeleteSubjectName(""); }} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Are you sure you want to delete <strong style={{ color: "var(--foreground)" }}>{deleteSubjectName}</strong>? Teacher assignments will also be removed. Associated assessments will be unlinked but not deleted.
              </p>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => { setDeleteSubjectId(null); setDeleteSubjectName(""); }} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
              <Button onClick={handleDeleteSubject} disabled={deleting} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--crimson-signal)", color: "#ffffff", border: "none" }}>{deleting ? "Deleting..." : "Delete"}</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Subject Modal */}
      {showEditModal && editSubject && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowEditModal(false)} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 420, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Edit Subject</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Updates the school-wide subject name and code</p>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Subject Name</label>
                <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Mathematics" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Code</label>
                <Input value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. MTH101" style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13, fontFamily: "'Geist Mono', ui-monospace, monospace" }} />
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => setShowEditModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
              <Button onClick={handleEditSubject} disabled={editLoading} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>{editLoading ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Class Assignments Modal */}
      {showManageClassesModal && managingSubject && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowManageClassesModal(false)} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 480, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Manage Classes</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Assign or remove <strong style={{ color: "var(--foreground)" }}>{managingSubject.name}</strong> from classes</p>
              </div>
              <button onClick={() => setShowManageClassesModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "12px 24px", overflowY: "auto", flex: 1 }}>
              {classes.map((cls: any) => {
                const assigned = (managingSubject.classSubjects || []).some((cs: any) => cs.classId === cls.id);
                return (
                  <div key={cls.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "var(--radius-md)", marginBottom: 4 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{cls.name}</p>
                      {cls.level && <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>{cls.level}</p>}
                    </div>
                    {assigned ? (
                      <button onClick={() => handleRemoveFromClass(cls.id)} disabled={manageClassLoading} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--crimson-signal)", background: "var(--crimson-tint)", border: "none", padding: "6px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                        <Unlink style={{ width: 12, height: 12 }} />Remove
                      </button>
                    ) : (
                      <button onClick={() => handleAssignToClass(cls.id)} disabled={manageClassLoading} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--emerald-signal)", background: "var(--emerald-tint)", border: "none", padding: "6px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                        <Link style={{ width: 12, height: 12 }} />Assign
                      </button>
                    )}
                  </div>
                );
              })}
              {classes.length === 0 && <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "24px 0", fontSize: 13 }}>No classes found</p>}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", background: "var(--surface-muted)", flexShrink: 0 }}>
              <Button variant="outline" onClick={() => setShowManageClassesModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Done</Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Assign Teacher Modal */}
      {showAssignModal && selectedSubject && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setShowAssignModal(false)} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 420, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Assign Teacher</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0" }}>Assign a teacher to <strong style={{ color: "var(--foreground)" }}>{selectedSubject.name}</strong></p>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {selectedSubject.classSubjects?.length > 1 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Assign for Class</label>
                  <Select value={assignClassSubjectId ?? ""} onValueChange={(v) => setAssignClassSubjectId(v || null)}>
                    <SelectTrigger style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10002 }}>
                      {selectedSubject.classSubjects.map((cs: any) => {
                        const name = cs.class?.name ?? classById.get(cs.classId)?.name ?? cs.classId;
                        return <SelectItem key={cs.id} value={cs.id}>{name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Teacher will be scoped to this class only</p>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Select Teacher</label>
                <div style={{ position: "relative", zIndex: 10001 }}>
                  <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                    <SelectTrigger style={{ height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                      <SelectValue placeholder="Choose a teacher" />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10002 }}>
                      {(teachers || []).map((t: any) => {
                        const name = `${t.firstName || ""} ${t.lastName || ""}`.trim();
                        return (
                          <SelectItem key={t.id} value={t.id}>{name || t.email || t.id}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => setShowAssignModal(false)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Cancel</Button>
              <Button onClick={handleAssignTeacher} disabled={loading} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff" }}>{loading ? "Assigning..." : "Assign Teacher"}</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
