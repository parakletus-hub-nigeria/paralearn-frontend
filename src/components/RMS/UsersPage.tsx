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
  ShieldCheck,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProductTour } from "@/components/common/ProductTour";

const usersTourSteps = [
  {
    target: '.users-directory-header',
    title: "School Directory",
    content: "Welcome to your school's directory! This is where you manage all students, teachers, administrators, bursars, and vice principals.",
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
    content: "Ready to expand? Click here to manually add a student, teacher, vice principal, or bursar.",
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
  role: "teacher" | "student" | "vp" | "accountant" | "admin" | "principal";
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
  const { users, students, teachers, vps, accountants, loading, tenantInfo } = useSelector((s: RootState) => s.user);
  const { classes } = useSelector((s: RootState) => s.admin);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student" | "vp" | "accountant" | "admin">("all");
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
    const rawList = (users && users.length > 0)
      ? users
      : [
          ...(students || []),
          ...(teachers || []),
          ...(vps || []),
          ...(accountants || []),
        ];

    const seen = new Set<string>();
    const rows: UserRow[] = [];

    for (const u of rawList) {
      const dbId = u.id || "";
      if (seen.has(dbId)) continue;
      seen.add(dbId);

      const roles = Array.isArray(u.roles)
        ? u.roles.map((r: any) => (r.role?.name || r.name || r || "").toLowerCase())
        : [String(u.role || "").toLowerCase()];

      let primaryRole: UserRow["role"] = "student";
      if (roles.includes("admin")) primaryRole = "admin";
      else if (roles.includes("principal")) primaryRole = "principal";
      else if (roles.includes("vp") || roles.includes("vice_principal")) primaryRole = "vp";
      else if (roles.includes("accountant") || roles.includes("bursar")) primaryRole = "accountant";
      else if (roles.includes("teacher")) primaryRole = "teacher";
      else if (roles.includes("student")) primaryRole = "student";

      const firstEnrollment = u.enrollments?.[0] || u.enrollment || {};
      const classId = u.classId || firstEnrollment.classId || u.class?.id || firstEnrollment.class?.id || "";
      const className = classNameById.get(classId) || u.className || u.class?.name || firstEnrollment.class?.name || "";

      const displayId =
        u.studentId ||
        u.teacherId ||
        u.staffId ||
        u.code ||
        "";

      rows.push({
        id: displayId,
        dbId,
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        email: u.email || "",
        role: primaryRole,
        classId,
        className,
        status: u.isActive === false ? "inactive" : "active",
        avatar: u.profilePicture || u.avatar || "",
        phoneNumber: u.phoneNumber || "",
        dateOfBirth: u.dateOfBirth,
        address: u.address || "",
      });
    }

    return rows;
  }, [users, students, teachers, vps, accountants, classNameById]);

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

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedUsers.map((u) => u.dbId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    try {
      await dispatch(deleteUser(user.dbId)).unwrap();
      toast.success("User deleted successfully");
      dispatch(fetchAllUsers());
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user");
    }
  };

  const handleEditUser = (user: UserRow) => {
    setEditUserModal(user);
  };

  const getInitials = (first?: string, last?: string, fallbackEmail?: string) => {
    const f = (first || "").trim();
    const l = (last || "").trim();
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f) return f.slice(0, 2).toUpperCase();
    if (l) return l.slice(0, 2).toUpperCase();
    if (fallbackEmail) return fallbackEmail.slice(0, 2).toUpperCase();
    return "PL";
  };

  const getAvatarAccent = (name: string) => {
    const accents = [
      { bg: "var(--violet-tint)", color: "var(--violet-ink)" },
      { bg: "var(--cobalt-tint)", color: "var(--cobalt-signal)" },
      { bg: "var(--emerald-tint)", color: "var(--emerald-signal)" },
      { bg: "var(--amber-tint)", color: "var(--amber-signal)" },
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return accents[Math.abs(hash) % accents.length];
  };

  const renderRoleBadge = (role: UserRow["role"]) => {
    switch (role) {
      case "teacher":
        return (
          <span className="badge badge-active" style={{ fontSize: 11 }}>
            Teacher
          </span>
        );
      case "vp":
        return (
          <span
            className="badge"
            style={{
              fontSize: 11,
              background: "#EDE9FE",
              color: "#6D28D9",
              border: "1px solid rgba(109, 40, 217, 0.2)",
              fontWeight: 700,
            }}
          >
            Vice Principal
          </span>
        );
      case "accountant":
        return (
          <span
            className="badge"
            style={{
              fontSize: 11,
              background: "#ECFDF5",
              color: "#047857",
              border: "1px solid rgba(4, 120, 87, 0.2)",
              fontWeight: 700,
            }}
          >
            Bursar / Finance
          </span>
        );
      case "admin":
      case "principal":
        return (
          <span
            className="badge"
            style={{
              fontSize: 11,
              background: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid rgba(29, 78, 216, 0.2)",
              fontWeight: 700,
            }}
          >
            {role === "principal" ? "Principal" : "Administrator"}
          </span>
        );
      case "student":
      default:
        return (
          <span className="badge badge-info" style={{ fontSize: 11 }}>
            Student
          </span>
        );
    }
  };

  const roleLabels: Record<string, string> = {
    student: "Student",
    teacher: "Teacher",
    vp: "Vice Principal",
    accountant: "Bursar / Accountant",
    admin: "Administrator",
    principal: "Principal",
  };

  return (
    <div className="users-page-container" style={{ padding: "0 0 40px 0" }}>
      <ProductTour steps={usersTourSteps} tourKey="users_directory_tour_v1" />
      <div className="users-directory-header" style={{ marginBottom: 24 }}>
        <Header schoolLogo={tenantInfo?.logoUrl} schoolName={tenantInfo?.name || "ParaLearn School"} />
      </div>

      {/* Filter and Action Bar */}
      <div
        className="users-filter-bar panel-card"
        style={{
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px", maxWidth: 360 }}>
            <Search
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 15,
                height: 15,
                color: "var(--text-tertiary)",
              }}
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, or ID..."
              style={{
                paddingLeft: 32,
                height: 36,
                fontSize: 13,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-fine)",
                background: "var(--surface-muted)",
              }}
            />
          </div>

          {/* Role Filter */}
          <Select
            value={roleFilter}
            onValueChange={(val: any) => {
              setRoleFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              style={{
                height: 36,
                width: 170,
                fontSize: 13,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-fine)",
                background: "var(--surface-muted)",
              }}
            >
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="vp">Vice Principals (VP)</SelectItem>
              <SelectItem value="accountant">Bursars / Finance</SelectItem>
              <SelectItem value="admin">Administrators</SelectItem>
            </SelectContent>
          </Select>

          {/* Class Filter */}
          <Select
            value={classFilter}
            onValueChange={(val) => {
              setClassFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              style={{
                height: 36,
                width: 160,
                fontSize: 13,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-fine)",
                background: "var(--surface-muted)",
              }}
            >
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                style={{
                  height: 36,
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-fine)",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Download style={{ width: 14, height: 14 }} />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                const data = (students || []).map((s: any) => ({
                  id: s.code || s.id || "",
                  name: [s.firstName, s.lastName].filter(Boolean).join(" ") || s.name || "",
                  email: s.user?.email || s.email || "",
                  dateOfBirth: s.dateOfBirth || "",
                  address: s.address || "",
                  phoneNumber: s.phoneNumber || "",
                  guardianName: s.guardianName || "",
                  guardianPhone: s.guardianPhone || "",
                }));
                exportStudentsToPDF(data);
              }}
                className="text-xs cursor-pointer"
              >
                Export Students (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                const data = (teachers || []).map((t: any) => ({
                  id: t.code || t.id || "",
                  name: [t.firstName, t.lastName].filter(Boolean).join(" ") || t.name || "",
                  email: t.user?.email || t.email || "",
                  dateOfBirth: t.dateOfBirth || "",
                  phoneNumber: t.phoneNumber || "",
                  address: t.address || "",
                }));
                exportTeachersToPDF(data);
              }}
                className="text-xs cursor-pointer"
              >
                Export Teachers (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="users-add-button btn-primary"
                style={{
                  height: 36,
                  padding: "0 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus style={{ width: 15, height: 15 }} />
                Add User
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  setAddModalType("student");
                  setAddModalOpen(true);
                }}
                className="text-xs cursor-pointer flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Add Student
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAddModalType("teacher");
                  setAddModalOpen(true);
                }}
                className="text-xs cursor-pointer flex items-center gap-2"
              >
                <Briefcase className="w-4 h-4 text-emerald-600" />
                Add Teacher
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAddModalType("vp");
                  setAddModalOpen(true);
                }}
                className="text-xs cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Add Vice Principal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setAddModalType("accountant");
                  setAddModalOpen(true);
                }}
                className="text-xs cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                Add Bursar / Finance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Directory Table */}
      <div className="panel-card" style={{ padding: "20px 24px" }}>
        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: 14 }}>Loading directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-secondary)" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
              No users found
            </p>
            <p style={{ fontSize: 13 }}>
              {search || roleFilter !== "all" || classFilter !== "all"
                ? "Try adjusting your search query or filters."
                : "Get started by adding students, teachers, or administrators."}
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, padding: "10px 12px", textAlign: "left" }}>
                      <input
                        type="checkbox"
                        checked={
                          paginatedUsers.length > 0 &&
                          selectedIds.length === paginatedUsers.length
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: "pointer", borderRadius: 3 }}
                      />
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>User</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Class</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                    <th style={{ width: 60, padding: "10px 12px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => {
                    const accent = getAvatarAccent(`${user.firstName}${user.lastName}`);
                    const isSelected = selectedIds.includes(user.dbId);

                    return (
                      <tr
                        key={user.dbId || user.id}
                        style={{
                          borderBottom: "1px solid var(--border-fine)",
                          background: isSelected ? "var(--violet-tint)" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "12px 12px" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOne(user.dbId, e.target.checked)}
                            style={{ cursor: "pointer", borderRadius: 3 }}
                          />
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: accent.bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: 12,
                                color: accent.color,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(user.firstName, user.lastName, user.email)}
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0, lineHeight: 1.3 }}>
                                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "School Staff"}
                              </p>
                              <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0, fontFamily: "'Geist Mono', ui-monospace, monospace" }}>
                                {user.id || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {renderRoleBadge(user.role)}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <p style={{ fontSize: 12, color: "var(--foreground)", margin: 0, fontWeight: 500 }}>
                            {user.email || "—"}
                          </p>
                          {user.phoneNumber && (
                            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                              {user.phoneNumber}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {user.className ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                              {user.className}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span
                            className={user.status === "active" ? "badge badge-active" : "badge badge-inactive"}
                            style={{ fontSize: 11 }}
                          >
                            {user.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 12px", textAlign: "center" }}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="users-action-menu"
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "var(--radius-sm)",
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                <MoreVertical style={{ width: 14, height: 14 }} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setViewUserModal(user)}
                                className="text-xs cursor-pointer flex items-center gap-2"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditUser(user)}
                                className="text-xs cursor-pointer flex items-center gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(user)}
                                className="text-xs cursor-pointer text-red-600 focus:text-red-600 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
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
                  <div style={{ marginTop: 5 }}>
                    {renderRoleBadge(viewUserModal.role)}
                  </div>
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
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, fontWeight: 500 }}>User ID / Code</p>
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
