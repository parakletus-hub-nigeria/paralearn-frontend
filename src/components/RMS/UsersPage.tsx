"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchAllUsers, deleteUser, reactivateUser, hardDeleteUser, getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { fetchClasses } from "@/reduxToolKit/admin/adminThunks";
import { exportStudentsToPDF, exportTeachersToPDF } from "@/lib/pdfExport";
import { Header } from "@/components/RMS/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddUserModal, UserType } from "@/components/RMS/AddUserModal";
import { EditUserModal } from "@/components/RMS/EditUserModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Download,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProductTour } from "@/components/common/ProductTour";

const usersTourSteps = [
  {
    target: '.users-directory-header',
    title: "School Directory",
    content: "Welcome to your school's directory! This is where you manage all students and teachers, track their status, and handle enrollments.",
    disableBeacon: true,
  },
  {
    target: '.users-filter-bar',
    title: "Powerful Search & Filters",
    content: "Easily find anyone by name, email, or ID. Use the role and class filters to drill down and see exactly who you need to manage.",
  },
  {
    target: '.users-add-button',
    title: "Enroll New Users",
    content: "Ready to expand? Click here to manually add a single student or teacher and get them started immediately.",
  },
  {
    target: '.users-action-menu',
    title: "Manage Individual Profiles",
    content: "Once you have users in your list, use the action menu on each row to view details, edit information, or remove accounts.",
  },
];


type UserRow = {
  id: string;
  dbId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "teacher" | "student" | "vp" | "accountant";
  classId?: string;
  className?: string;
  status: "active" | "inactive";
  avatar?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: string;
};

export const UsersPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { students, teachers, loading, tenantInfo } = useSelector((s: RootState) => s.user);
  const { classes } = useSelector((s: RootState) => s.admin);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student" | "vp" | "accountant">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<UserType>("student");
  
  // Action menu state
  const [viewUserModal, setViewUserModal] = useState<UserRow | null>(null);
  const [editUserModal, setEditUserModal] = useState<UserRow | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    dispatch(fetchAllUsers());
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
  }, [dispatch]);

  // Create a map of class IDs to class names
  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.id, c.name);
    }
    return map;
  }, [classes]);

  // Build unified user list
  const allUsers = useMemo<UserRow[]>(() => {
    const studentRows: UserRow[] = (students || []).map((s: any) => {
      // Get classId from various possible locations in the response
      // Check enrollments array first (might be most recent structure)
      const firstEnrollment = s.enrollments?.[0] || s.enrollment || {};
      const classId = s.classId || firstEnrollment.classId || s.class?.id || firstEnrollment.class?.id || "";
      // Look up class name from our classes map, or use the one from the response
      const className = classNameById.get(classId) || s.className || s.class?.name || firstEnrollment.class?.name || "";
      
      // Also check if student profile has studentProfile with class info
      const profile = s.studentProfile || s.profile || {};
      const profileClassId = profile.classId || "";
      const profileClassName = classNameById.get(profileClassId) || profile.class?.name || "";
      
      return {
        id: s.studentId || profile.studentId || s.id || "",
        dbId: s.id || "",
        firstName: s.firstName || "",
        lastName: s.lastName || "",
        email: s.email || "",
        role: "student" as const,
        classId: classId || profileClassId,
        className: className || profileClassName,
        status: s.isActive === false ? "inactive" : "active",
        avatar: s.avatar || "",
        phoneNumber: s.phoneNumber || "",
        dateOfBirth: s.dateOfBirth,
        address: s.address || "",
      };
    });

    const teacherRows: UserRow[] = (teachers || []).map((t: any) => {
      const src = t?.user ?? t?.profile ?? t ?? {};
      // Teachers may have multiple classes, but we'll show their primary/first class
      const classId = t.classId || t.primaryClassId || src.classId || "";
      const className = classNameById.get(classId) || t.className || src.className || "";
      
      return {
        id: t?.teacherId || t?.teacherCode || t?.staffId || t?.code || src?.teacherId || t?.id || "",
        dbId: t.id ?? src.id ?? "",
        firstName: src.firstName ?? t?.firstName ?? "",
        lastName: src.lastName ?? t?.lastName ?? "",
        email: src.email ?? t?.email ?? "",
        role: "teacher" as const,
        classId,
        className,
        status: t.isActive === false || src.isActive === false ? "inactive" : "active",
        avatar: src.avatar || t?.avatar || "",
        phoneNumber: src.phoneNumber ?? t?.phoneNumber ?? "",
        dateOfBirth: src.dateOfBirth ?? t?.dateOfBirth,
        address: src.address ?? t?.address ?? "",
      };
    });

    return [...studentRows, ...teacherRows];
  }, [students, teachers, classNameById]);

  // Filter and search
  const filteredUsers = useMemo(() => {
    let result = allUsers;

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    if (classFilter !== "all") {
      result = result.filter((u) => u.classId === classFilter);
    }

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (u) =>
          u.firstName.toLowerCase().includes(term) ||
          u.lastName.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.id.toLowerCase().includes(term)
      );
    }

    return result;
  }, [allUsers, roleFilter, classFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, classFilter]);

  const handleExport = () => {
    let exported = false;
    
    if (roleFilter === "teacher" || (roleFilter === "all" && teachers.length > 0)) {
      const teacherData = teachers.map((item: any) => {
        const src = item?.user ?? item?.profile ?? item ?? {};
        return {
          id: item?.teacherId || item?.teacherCode || item?.staffId || item?.id || "N/A",
          name: `${src.firstName ?? item?.firstName ?? ""} ${src.lastName ?? item?.lastName ?? ""}`.trim() || "N/A",
          email: src.email ?? item?.email ?? "N/A",
          dateOfBirth: src.dateOfBirth ? new Date(src.dateOfBirth).toLocaleDateString() : "N/A",
          phoneNumber: src.phoneNumber ?? item?.phoneNumber ?? "N/A",
          address: src.address ?? item?.address ?? "N/A",
        };
      });
      exportTeachersToPDF(teacherData);
      exported = true;
    }
    
    if (roleFilter === "student" || (roleFilter === "all" && students.length > 0)) {
      const studentData = students.map((item: any) => ({
        id: item.studentId || "N/A",
        name: `${item.firstName} ${item.lastName}`,
        email: item.email || "N/A",
        dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString() : "N/A",
        address: item.address || "N/A",
        phoneNumber: item.phoneNumber || "N/A",
        guardianName: item.guardianName || "N/A",
        guardianPhone: item.guardianPhone || "N/A",
      }));
      exportStudentsToPDF(studentData);
      exported = true;
    }

    if (exported) {
      toast.success(
        roleFilter === "all" 
          ? "Users directory exported successfully!" 
          : `${roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}s exported successfully!`
      );
    }
  };

  // Action handlers
  const handleViewUser = (user: UserRow) => {
    setViewUserModal(user);
  };

  const handleEditUser = (user: UserRow) => {
    setEditUserModal(user);
  };

  const handleHardDeleteUser = async (user: UserRow) => {
    if (confirm(`WARNING: This is a permanent action.\nAre you sure you want to permanently delete ${user.firstName} ${user.lastName}?`)) {
      try {
        await dispatch(hardDeleteUser(user.dbId)).unwrap();
        toast.success(`User ${user.firstName} permanently deleted`);
        dispatch(fetchAllUsers());
      } catch (error: any) {
        toast.error(error || "Failed to permanently delete user");
      }
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "??";
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedUsers.map((u) => u.dbId));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const getAvatarAccent = (name: string) => {
    const accents = [
      { bg: "var(--violet-tint)", color: "var(--violet-ink)" },
      { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
      { bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
      { bg: "var(--amber-tint)", color: "var(--amber-signal)" },
      { bg: "var(--crimson-tint)", color: "var(--crimson-signal)" },
    ];
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % accents.length;
    return accents[index];
  };

  return (
    <div className="w-full">
      <ProductTour tourKey="admin_users_page" steps={usersTourSteps} />
      <Header 
        schoolLogo={tenantInfo?.logoUrl} 
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Page Header */}
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
          <div>
            <h1 className="users-directory-header" style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: "clamp(1.25rem, 2vw, 1.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>Directory</h1>
            <p style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Manage student and teacher access, roles, and class enrollments.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button variant="outline" onClick={handleExport} className="h-10 gap-2" style={{ borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
              <Download className="w-4 h-4" />Export
            </Button>
            <Button onClick={() => { setAddModalType("student"); setAddModalOpen(true); }} className="users-add-button h-10 gap-2 text-white" style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600 }}>
              <Plus className="w-4 h-4" />Add User
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="users-filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--text-secondary)", pointerEvents: "none" }} />
            <Input placeholder="Search by name, email, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 36, height: 40, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
              <SelectTrigger style={{ height: 40, width: 140, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="teacher">Teachers</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="vp">Vice Principals</SelectItem>
                <SelectItem value="accountant">Accountants</SelectItem>
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger style={{ height: 40, width: 160, borderRadius: "var(--radius-md)", borderColor: "var(--border-fine)", fontSize: 13 }}>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading && allUsers.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Loading users...</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: "#ffffff", border: "1px solid var(--border-fine)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                      <th style={{ padding: "12px 16px", width: 40 }}>
                        <input type="checkbox" checked={paginatedUsers.length > 0 && selectedIds.length === paginatedUsers.length} onChange={(e) => handleSelectAll(e.target.checked)} style={{ accentColor: "var(--violet-ink)" }} />
                      </th>
                      {["User Name", "Role", "Class", "Status", "Actions"].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 4 ? "center" : "left", fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", padding: "12px 12px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, idx) => {
                      const accent = getAvatarAccent(`${user.firstName}${user.lastName}`);
                      return (
                        <tr key={user.dbId || idx} style={{ borderBottom: "1px solid var(--border-fine)", background: "#ffffff", transition: "background var(--dur-fast)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}>
                          <td style={{ padding: "12px 16px" }}>
                            <input type="checkbox" checked={selectedIds.includes(user.dbId)} onChange={(e) => toggleSelectUser(user.dbId, e.target.checked)} style={{ accentColor: "var(--violet-ink)" }} />
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: accent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: accent.color, flexShrink: 0 }}>
                                {getInitials(user.firstName, user.lastName)}
                              </div>
                              <div>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{user.firstName} {user.lastName}</p>
                                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <span className={user.role === "teacher" ? "badge badge-active" : "badge badge-info"} style={{ fontSize: 11 }}>
                              {user.role === "teacher" ? "Teacher" : "Student"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            {user.className ? (
                              <div>
                                <p style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)", margin: 0 }}>{user.className}</p>
                                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Enrolled</p>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{user.role === "student" ? "Not enrolled" : "—"}</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: user.status === "active" ? "var(--emerald-signal)" : "var(--border-medium)", flexShrink: 0, display: "inline-block" }} />
                              <span style={{ fontSize: 13, color: "var(--foreground)", textTransform: "capitalize" }}>{user.status}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 12px", textAlign: "center" }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="users-action-menu" style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}>
                                  <MoreVertical style={{ width: 15, height: 15 }} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" style={{ minWidth: 160 }}>
                                <DropdownMenuItem onClick={() => handleViewUser(user)} className="cursor-pointer gap-2 py-2"><Eye className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditUser(user)} className="cursor-pointer gap-2 py-2"><Pencil className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />Edit User</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleHardDeleteUser(user)} className="cursor-pointer gap-2 py-2" style={{ color: "var(--crimson-signal)" }}><Trash2 className="w-4 h-4" />Delete Permanently</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedUsers.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: "64px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No users found matching your criteria.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {filteredUsers.length > 0 && totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Showing <strong style={{ color: "var(--foreground)" }}>{(page - 1) * ITEMS_PER_PAGE + 1}</strong>–<strong style={{ color: "var(--foreground)" }}>{Math.min(page * ITEMS_PER_PAGE, filteredUsers.length)}</strong> of <strong style={{ color: "var(--foreground)" }}>{filteredUsers.length}</strong>
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>Previous</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ height: 32, padding: "0 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-fine)", background: "#ffffff", fontSize: 13, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        type={addModalType}
        onTypeChange={setAddModalType}
        primaryColor="var(--violet-ink)"
        onSuccess={() => {
          dispatch(fetchAllUsers());
          setAddModalOpen(false);
        }}
      />

      {/* View User Modal */}
      {viewUserModal && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }} onClick={() => setViewUserModal(null)} />
          <div style={{ position: "relative", background: "#ffffff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-dialog)", width: "100%", maxWidth: 460, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid var(--border-fine)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {(() => {
                  const accent = getAvatarAccent(`${viewUserModal.firstName}${viewUserModal.lastName}`);
                  return (
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: accent.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: accent.color, flexShrink: 0 }}>
                      {getInitials(viewUserModal.firstName, viewUserModal.lastName)}
                    </div>
                  );
                })()}
                <div>
                  <h2 style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif", fontSize: 16, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{viewUserModal.firstName} {viewUserModal.lastName}</h2>
                  <span className={viewUserModal.role === "teacher" ? "badge badge-active" : "badge badge-info"} style={{ fontSize: 11, marginTop: 5, display: "inline-flex" }}>{viewUserModal.role === "teacher" ? "Teacher" : "Student"}</span>
                </div>
              </div>
              <button onClick={() => setViewUserModal(null)} style={{ padding: 6, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: <Mail style={{ width: 15, height: 15 }} />, label: "Email", value: viewUserModal.email || "—", accent: { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" } },
                { icon: <Phone style={{ width: 15, height: 15 }} />, label: "Phone", value: viewUserModal.phoneNumber || "—", accent: { bg: "var(--emerald-tint)", color: "var(--emerald-signal)" } },
                { icon: <Calendar style={{ width: 15, height: 15 }} />, label: "Date of Birth", value: viewUserModal.dateOfBirth ? new Date(viewUserModal.dateOfBirth).toLocaleDateString() : "—", accent: { bg: "var(--amber-tint)", color: "var(--amber-signal)" } },
                { icon: <MapPin style={{ width: 15, height: 15 }} />, label: "Address", value: viewUserModal.address || "—", accent: { bg: "var(--violet-tint)", color: "var(--violet-ink)" } },
                ...(viewUserModal.className ? [{ icon: <Eye style={{ width: 15, height: 15 }} />, label: "Class", value: viewUserModal.className, accent: { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" } }] : []),
              ].map(({ icon, label, value, accent }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--surface-muted)" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: accent.bg, display: "flex", alignItems: "center", justifyContent: "center", color: accent.color, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{value}</p>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--surface-muted)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-muted)", border: "1px solid var(--border-fine)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "var(--text-secondary)", letterSpacing: "0.05em" }}>ID</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>User ID</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", margin: 0, fontFamily: "'Geist Mono', ui-monospace, monospace" }}>{viewUserModal.id}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-fine)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-muted)" }}>
              <Button variant="outline" onClick={() => setViewUserModal(null)} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13 }}>Close</Button>
              <Button onClick={() => { handleEditUser(viewUserModal); setViewUserModal(null); }} style={{ height: 40, borderRadius: "var(--radius-md)", fontSize: 13, fontWeight: 600, background: "var(--violet-ink)", color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
                <Pencil style={{ width: 13, height: 13 }} />Edit User
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Edit User Modal */}
      <EditUserModal
        open={!!editUserModal}
        onOpenChange={(open) => !open && setEditUserModal(null)}
        user={editUserModal}
        primaryColor="var(--violet-ink)"
        classes={classes}
        onSuccess={() => {
          dispatch(fetchAllUsers());
        }}
      />
    </div>
  );
};
