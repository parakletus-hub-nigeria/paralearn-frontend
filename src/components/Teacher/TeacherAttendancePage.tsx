"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchTeacherClasses } from "@/reduxToolKit/teacher/teacherThunks";
import {
  useGetDailyClassAttendanceQuery,
  useBulkUpdateAttendanceMutation,
} from "@/reduxToolKit/api/endpoints/attendance";
import { TeacherHeader } from "./TeacherHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCheck,
  Clock,
  Eye,
  MoreVertical,
  Save,
  Search,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";

const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  LATE: "LATE",
  ABSENT: "ABSENT",
} as const;

type AttendanceStatusType = keyof typeof ATTENDANCE_STATUS;
type TabType = "today" | "history";

interface AttendanceRecord {
  status: AttendanceStatusType;
  remarks: string;
}

export default function TeacherAttendancePage() {
  const dispatch = useDispatch<AppDispatch>();
  const { teacherClasses } = useSelector((s: RootState) => s.teacher);
  const { user } = useSelector((s: RootState) => s.user);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("today");

  // Dates
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  // History date picker — defaults to yesterday
  const [historyDateStr, setHistoryDateStr] = useState(
    format(subDays(today, 1), "yyyy-MM-dd")
  );

  // Derived: which date is currently being viewed
  const viewDateStr = activeTab === "today" ? todayStr : historyDateStr;
  const isReadOnly = activeTab === "history";

  // Class selection
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Draft State (only used in Today mode)
  const [draftAttendance, setDraftAttendance] = useState<
    Record<string, Partial<AttendanceRecord>>
  >({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Classes
  useEffect(() => {
    const teacherId = (user as any)?.id || (user as any)?.teacherId;
    if (teacherId) {
      dispatch(fetchTeacherClasses({ teacherId }));
    }
  }, [dispatch, user]);

  // Unique Classes for Dropdown
  const uniqueClasses = useMemo(() => {
    const classMap = new Map();
    (teacherClasses || []).forEach((item: any) => {
      const classId = item.class?.id || item.classId;
      const className = item.class?.name || item.className;
      if (classId && className && !classMap.has(classId)) {
        classMap.set(classId, { id: classId, name: className });
      }
    });
    return Array.from(classMap.values());
  }, [teacherClasses]);

  // Set default class
  useEffect(() => {
    if (!selectedClassId && uniqueClasses.length > 0) {
      setSelectedClassId(uniqueClasses[0].id);
    }
  }, [uniqueClasses, selectedClassId]);

  // Fetch Attendance Data (works for any date)
  const { data: attendanceData, isLoading, isError, refetch } = useGetDailyClassAttendanceQuery(
    { classId: selectedClassId, date: viewDateStr },
    { skip: !selectedClassId }
  );

  const [bulkUpdate, { isLoading: isSaving }] = useBulkUpdateAttendanceMutation();

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving) {
        e.preventDefault();
        e.returnValue = "Wait! Attendance is currently saving. Leaving now might corrupt the data.";
      } else if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved attendance changes.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  // Clear draft when switching to history tab
  useEffect(() => {
    if (isReadOnly) {
      setDraftAttendance({});
      setHasUnsavedChanges(false);
    }
  }, [isReadOnly]);

  // Helper: effective record (draft overrides server for Today mode)
  const getEffectiveRecord = (record: any): AttendanceRecord => {
    if (isReadOnly) {
      return {
        status: record.attendance?.status || "ABSENT",
        remarks: record.attendance?.remarks || "",
      };
    }
    const draft = draftAttendance[record.enrollmentId];
    return {
      status: draft?.status || record.attendance?.status || "ABSENT",
      remarks: draft?.remarks !== undefined ? draft.remarks : (record.attendance?.remarks || ""),
    };
  };

  // Handlers (Today mode only)
  const handleStatusChange = (enrollmentId: string, status: AttendanceStatusType) => {
    setDraftAttendance((prev) => ({
      ...prev,
      [enrollmentId]: { ...prev[enrollmentId], status },
    }));
    setHasUnsavedChanges(true);
  };

  const handleRemarkChange = (enrollmentId: string, remarks: string) => {
    setDraftAttendance((prev) => ({
      ...prev,
      [enrollmentId]: { ...prev[enrollmentId], remarks },
    }));
    setHasUnsavedChanges(true);
  };

  const handleMarkAllPresent = () => {
    // FIX #10: Apply only to the currently filtered/visible students
    if (!filteredData || filteredData.length === 0) return;
    const updates: Record<string, Partial<AttendanceRecord>> = {};
    filteredData.forEach((record: any) => {
      updates[record.enrollmentId] = {
        ...draftAttendance[record.enrollmentId],
        status: "PRESENT",
      };
    });
    setDraftAttendance((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    toast.success(
      filteredData.length === (studentOnlyData?.length || 0)
        ? "Marked all students as Present"
        : `Marked ${filteredData.length} visible students as Present`
    );
  };

  const handleSave = async () => {
    if (!studentOnlyData) return;
    // Don't blast the API with all-ABSENT if teacher hasn't touched anything yet
    if (Object.keys(draftAttendance).length === 0) {
      toast.warning("No attendance changes to save. Please mark at least one student.");
      return;
    }
    try {
      const records = studentOnlyData.map((record: any) => {
        const effective = getEffectiveRecord(record);
        return {
          id: record.attendance?.id, // CRITICAL: This prevents the backend from wiping untouched students on a secondary save.
          enrollmentId: record.enrollmentId,
          status: effective.status,
          remarks: effective.remarks,
        };
      });

      const presentCount = records.filter((r: any) => r.status === "PRESENT").length;
      const absentCount = records.filter((r: any) => r.status === "ABSENT").length;
      toast.info(`Sending: ${presentCount} Present, ${absentCount} Absent`);

      await bulkUpdate({ date: viewDateStr, records }).unwrap();
      toast.success("Attendance saved successfully");

      // Update the draft to match exactly what was saved.
      // This avoids a race condition where clearing the draft ({}) and then waiting
      // for the RTK Query cache refetch to re-seed it can interleave incorrectly,
      // leaving the draft empty and triggering the "no changes" guard on the next save.
      const confirmedDraft: Record<string, Partial<AttendanceRecord>> = {};
      records.forEach((r) => {
        confirmedDraft[r.enrollmentId] = { status: r.status, remarks: r.remarks };
      });
      setDraftAttendance(confirmedDraft);
      setHasUnsavedChanges(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || error?.message || "Failed to save attendance");
    }
  };

  // Strip teacher enrollments — only genuine students should appear in attendance.
  // The attendance API returns lightweight student objects with no `roles` field,
  // so role-based filtering is not possible here. Instead, use the `studentId` code
  // field (e.g. "STU-S-26-00001") as the discriminator: every real student in the
  // system is assigned this code, while teachers enrolled in a class will not have
  // a studentId value on their user record.
  const studentOnlyData = useMemo(() => {
    if (!attendanceData) return null;
    return (attendanceData as any[]).filter(
      (record: any) => !!record.student?.studentId,
    );
  }, [attendanceData]);

  // Filtered Data
  const filteredData = useMemo(() => {
    if (!studentOnlyData) return [];
    return studentOnlyData.filter((record: any) => {
      const fullName =
        `${record.student?.firstName} ${record.student?.lastName}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [studentOnlyData, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!studentOnlyData) return { total: 0, present: 0, late: 0, absent: 0 };
    let present = 0, late = 0, absent = 0;
    studentOnlyData.forEach((record: any) => {
      const { status } = getEffectiveRecord(record);
      if (status === "PRESENT") present++;
      else if (status === "LATE") late++;
      else absent++;
    });
    return { total: studentOnlyData.length, present, late, absent };
  }, [studentOnlyData, draftAttendance, isReadOnly]);

  const getInitials = (f?: string, l?: string) =>
    `${(f || "")[0] || ""}${(l || "")[0] || ""}`.toUpperCase() || "?";

  // ─── Render: Editable Status Buttons ───────────────────────────────────
  const renderStatusButtons = (enrollmentId: string, status: string, isMobile = false) => (
    <div className="inline-flex p-1 gap-1" style={{ borderRadius: "var(--radius-md)", background: "var(--surface-muted)" }}>
      {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => {
        const isActive = status === s;
        const activeBg = s === "PRESENT" ? "var(--emerald-signal)" : s === "LATE" ? "var(--amber-signal)" : "var(--crimson-signal)";
        const label = s[0];
        return (
          <button
            key={s}
            onClick={() => handleStatusChange(enrollmentId, s)}
            className={`flex items-center justify-center font-bold text-xs transition-all ${isMobile ? "w-8 h-8" : "w-9 h-8"}`}
            style={{
              borderRadius: "var(--radius-sm)",
              background: isActive ? activeBg : "",
              color: isActive ? "white" : "var(--foreground-muted)",
              boxShadow: isActive ? "var(--shadow-card)" : "",
            }}
            title={s.charAt(0) + s.slice(1).toLowerCase()}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  // ─── Render: Read-Only Status Badge (History mode) ───────────────────────
  const renderStatusBadge = (status: string, isMobile = false) => {
    const sz = isMobile ? "w-9 h-9" : "w-10 h-9";
    const cfg = status === "PRESENT"
      ? { bg: "var(--emerald-tint)", color: "var(--emerald-signal)", label: "P" }
      : status === "LATE"
      ? { bg: "var(--amber-tint)", color: "var(--amber-signal)", label: "L" }
      : { bg: "var(--crimson-tint)", color: "var(--crimson-signal)", label: "A" };
    return (
      <span className={`inline-flex items-center justify-center ${sz} font-bold text-xs`} style={{ borderRadius: "var(--radius-md)", background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="w-full min-h-screen pb-32 md:pb-20">
      <div className="hidden md:block">
        <TeacherHeader />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 sticky top-0 z-30 bg-white" style={{ borderBottom: "1px solid var(--border-fine)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "var(--violet-ink)" }}>
            P
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ color: "var(--foreground)" }}>ParaLearn</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
            {activeTab === "today" ? "TODAY" : "HISTORY"}
          </p>
          <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
            {activeTab === "today"
              ? format(today, "MMM d, yyyy")
              : format(parseISO(historyDateStr), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Class Attendance</h1>
            <p className="mt-1" style={{ color: "var(--foreground-muted)" }}>
              {isReadOnly
                ? "Viewing past attendance records — read only."
                : "Mark attendance and track student presence."}
            </p>
          </div>

          {/* ── Tab Switcher ── */}
          <div className="flex p-1 gap-1 self-start md:self-auto" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-muted)" }}>
            {(["today", "history"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all"
                style={{
                  borderRadius: "var(--radius-md)",
                  background: activeTab === tab ? "white" : "transparent",
                  color: activeTab === tab ? "var(--violet-ink)" : "var(--foreground-muted)",
                  boxShadow: activeTab === tab ? "var(--shadow-card)" : "none",
                }}
              >
                {tab === "today" ? <Sun className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {tab === "today" ? "Today" : "History"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Read-only Banner (History mode) ── */}
        {isReadOnly && (
          <div className="flex items-center gap-3 px-4 py-3 text-sm font-semibold" style={{ borderRadius: "var(--radius-lg)", background: "var(--amber-tint)", border: "1px solid color-mix(in oklch, var(--amber-signal) 25%, transparent)", color: "var(--amber-signal)" }}>
            <Eye className="w-4 h-4 flex-shrink-0" />
            <span>View-only · Past Record — you cannot edit historical attendance.</span>
          </div>
        )}

        {/* Controls Bar */}
        <div className="hidden md:flex bg-white p-4 flex-col md:flex-row gap-4 items-center justify-between" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <div className="hidden md:block absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="h-4 w-4" style={{ color: "var(--foreground-muted)" }} />
              </div>
              <Select
                value={selectedClassId}
                onValueChange={(val) => {
                  if (hasUnsavedChanges) {
                    if (!confirm("You have unsaved attendance changes. Are you sure you want to switch classes? Your changes will be lost.")) return;
                  }
                  setSelectedClassId(val);
                  setDraftAttendance({});
                  setHasUnsavedChanges(false);
                }}
              >
                <SelectTrigger className="pl-4 md:pl-10 h-11 w-full font-bold" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeTab === "today" ? (
              <div className="hidden md:flex items-center gap-2 px-4 h-11 font-bold min-w-[200px] justify-center" style={{ borderRadius: "var(--radius-lg)", background: "var(--violet-tint)", border: "1px solid color-mix(in oklch, var(--violet-ink) 15%, transparent)", color: "var(--violet-ink)" }}>
                <Sun className="w-4 h-4" />
                <span>{format(today, "eeee, d MMMM")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="date"
                  value={historyDateStr}
                  max={format(subDays(today, 1), "yyyy-MM-dd")}
                  onChange={(e) => {
                    if (e.target.value >= todayStr) {
                      toast.error("Cannot view attendance for today or future dates in History mode.");
                      return;
                    }
                    setHistoryDateStr(e.target.value);
                  }}
                  className="h-11 px-4 font-bold text-sm focus:outline-none w-full md:w-auto"
                  style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-fine)", background: "var(--surface-muted)", color: "var(--foreground)" }}
                />
              </div>
            )}
          </div>

          {!isReadOnly && (
            <button
              onClick={handleMarkAllPresent}
              className="flex items-center gap-2 h-11 font-bold px-6 transition-colors"
              style={{ borderRadius: "var(--radius-lg)", background: "var(--emerald-tint)", border: "1px solid color-mix(in oklch, var(--emerald-signal) 25%, transparent)", color: "var(--emerald-signal)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in oklch, var(--emerald-tint) 80%, white)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--emerald-tint)")}
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Present
            </button>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="md:hidden flex flex-col gap-3">
          <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setDraftAttendance({}); setHasUnsavedChanges(false); }}>
            <SelectTrigger className="h-12 w-full font-bold" style={{ borderRadius: "var(--radius-lg)", background: "var(--surface-muted)", borderColor: "var(--border-fine)", color: "var(--foreground)" }}>
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {uniqueClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!isReadOnly && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>Students ({filteredData.length})</span>
              <button
                onClick={handleMarkAllPresent}
                className="flex items-center gap-2 h-9 px-4 font-bold text-sm"
                style={{ borderRadius: "var(--radius-lg)", background: "var(--emerald-tint)", color: "var(--emerald-signal)" }}
              >
                <CheckCheck className="w-4 h-4" /> Mark All
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--foreground-muted)" }} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="pl-9 h-11 bg-white"
            style={{ borderRadius: "var(--radius-lg)", borderColor: "var(--border-fine)" }}
          />
        </div>

        {/* ─── Desktop Table View ─── */}
        <div className="hidden md:block bg-white overflow-x-auto" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <Table className="min-w-[800px]">
            <TableHeader style={{ background: "var(--surface-muted)" }}>
              <TableRow>
                <TableHead className="w-[80px] font-bold text-xs uppercase pl-8 py-5" style={{ color: "var(--foreground-muted)" }}>S/N</TableHead>
                <TableHead className="font-bold text-xs uppercase py-5" style={{ color: "var(--foreground-muted)" }}>Student Details</TableHead>
                <TableHead className="font-bold text-xs uppercase py-5 text-center" style={{ color: "var(--foreground-muted)" }}>Attendance Status</TableHead>
                <TableHead className="font-bold text-xs uppercase py-5" style={{ color: "var(--foreground-muted)" }}>{isReadOnly ? "Remark" : "Last Remark"}</TableHead>
                <TableHead className="w-[100px] font-bold text-xs uppercase py-5 text-right pr-8" style={{ color: "var(--foreground-muted)" }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center font-medium" style={{ color: "var(--crimson-signal)" }}>
                    Failed to load attendance data. Please try again.
                  </TableCell>
                </TableRow>
              ) : !attendanceData ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center" style={{ color: "var(--foreground-muted)" }}>
                    No attendance data found for this date/class.
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center" style={{ color: "var(--foreground-muted)" }}>
                    No students found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((record: any, index: number) => {
                  const { status, remarks } = getEffectiveRecord(record);
                  return (
                    <TableRow
                      key={record.enrollmentId}
                      className="group transition-colors"
                      style={{ borderBottom: "1px solid var(--border-fine)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <TableCell className="font-bold pl-8" style={{ color: "var(--foreground-muted)" }}>
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white" style={{ boxShadow: "var(--shadow-card)" }}>
                            <AvatarImage src={record?.student?.profilePicture} />
                            <AvatarFallback className="font-bold" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                              {getInitials(record.student.firstName, record.student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold" style={{ color: "var(--foreground)" }}>
                              {record.student.firstName} {record.student.lastName}
                            </p>
                            <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                              {record.student.studentId || "#PL-000"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {isReadOnly ? renderStatusBadge(status) : renderStatusButtons(record.enrollmentId, status)}
                      </TableCell>
                      <TableCell>
                        {isReadOnly ? (
                          <span className="text-sm italic" style={{ color: "var(--foreground-muted)" }}>{remarks || "—"}</span>
                        ) : (
                          <Input
                            maxLength={255}
                            value={remarks}
                            onChange={(e) => handleRemarkChange(record.enrollmentId, e.target.value)}
                            placeholder="Add remark..."
                            className="h-9 text-sm transition-all bg-transparent"
                            style={{ borderRadius: "var(--radius-md)", borderColor: "transparent" }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-medium)")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" style={{ color: "var(--foreground-muted)" }}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ─── Mobile Card View ─── */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)" }} />
            </div>
          ) : isError ? (
            <div className="text-center py-10 font-medium" style={{ color: "var(--crimson-signal)" }}>
              Failed to load attendance data. Please try again.
            </div>
          ) : !attendanceData ? (
            <div className="text-center py-10" style={{ color: "var(--foreground-muted)" }}>
              No attendance data found for this date/class.
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-10" style={{ color: "var(--foreground-muted)" }}>
              No students found matching your search.
            </div>
          ) : (
            filteredData.map((record: any) => {
              const { status } = getEffectiveRecord(record);
              return (
                <div
                  key={record.enrollmentId}
                  className="p-4 flex items-center justify-between"
                  style={{ background: "white", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12" style={{ border: "1px solid var(--border-fine)" }}>
                      <AvatarImage src={record?.student?.profilePicture} />
                      <AvatarFallback className="font-bold" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                        {getInitials(record.student.firstName, record.student.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-[15px]" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>
                        {record.student.firstName} {record.student.lastName}
                      </p>
                      <p className="text-xs font-bold" style={{ color: "var(--foreground-muted)" }}>
                        {record.student.studentId || "#PL-001"}
                      </p>
                    </div>
                  </div>
                  <div>
                    {isReadOnly
                      ? renderStatusBadge(status, true)
                      : renderStatusButtons(record.enrollmentId, status, true)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Persistent Footer ─── */}
      {/* Only shown in Today mode */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-40 md:pl-[280px]" style={{ background: "white", borderTop: "1px solid var(--border-fine)" }}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">

            {/* Mobile Footer Top */}
            <div className="flex md:hidden items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: "var(--emerald-signal)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "var(--amber-signal)" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "var(--crimson-signal)" }} />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--foreground-muted)" }}>
                {stats.present + stats.late + stats.absent}/{stats.total} Marked Complete
              </div>
            </div>

            {/* Desktop Progress */}
            <div className="hidden md:flex items-center gap-6 flex-1">
              <div className="flex flex-col gap-1 w-full max-w-md">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--foreground-muted)" }}>
                  <span>Marked Progress</span>
                  <span style={{ color: "var(--violet-ink)" }}>
                    {stats.present + stats.late + stats.absent} / {stats.total} Students
                  </span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      background: "var(--violet-ink)",
                      width: `${
                        stats.total
                          ? ((stats.present + stats.late + stats.absent) / stats.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              {/* Desktop Status Circles */}
              <div className="hidden md:flex items-center gap-2 mr-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)" }} title="Present">
                  {stats.present}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--amber-tint)", color: "var(--amber-signal)" }} title="Late">
                  {stats.late}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)" }} title="Absent">
                  {stats.absent}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="h-12 w-full md:w-auto px-8 font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "var(--violet-ink)", color: "white", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-card)", border: "none" }}
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Attendance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
