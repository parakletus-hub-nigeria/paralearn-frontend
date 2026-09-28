"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchClasses } from "@/reduxToolKit/admin/adminThunks";
import { getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { useGetDailyClassAttendanceQuery, useBulkUpdateAttendanceMutation } from "@/reduxToolKit/api/endpoints/attendance";
import { Header } from "@/components/RMS/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCheck, MoreVertical, Save, Search, Sun, Calendar as LucideCalendar } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  LATE: "LATE",
  ABSENT: "ABSENT",
} as const;

type AttendanceStatusType = keyof typeof ATTENDANCE_STATUS;

interface AttendanceRecord {
  status: AttendanceStatusType;
  remarks: string;
}

export function AdminAttendancePage() {
  const dispatch = useDispatch<AppDispatch>();
  const { classes } = useSelector((s: RootState) => s.admin);
  const { tenantInfo } = useSelector((s: RootState) => s.user);

  // State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Draft State: Stores ONLY the changes made by the user.
  const [draftAttendance, setDraftAttendance] = useState<
    Record<string, Partial<AttendanceRecord>>
  >({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch Tenant Info on mount
  useEffect(() => {
    dispatch(getTenantInfo());
    dispatch(fetchClasses(undefined)); // Fetch all classes (matching AdminClassesPage)
  }, [dispatch]);

  // Set default class if available and not selected
  useEffect(() => {
    if (!selectedClassId && classes && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);


  // Format date for API
  const dateStr = format(currentDate, "yyyy-MM-dd");

  // Fetch Attendance Query
  const { data: attendanceData, isLoading, isError, refetch } = useGetDailyClassAttendanceQuery(
    { classId: selectedClassId, date: dateStr },
    { skip: !selectedClassId }
  );

  const [bulkUpdate, { isLoading: isSaving }] = useBulkUpdateAttendanceMutation();

  // Warn before unload if there are unsaved changes or if saving is in progress
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

  // Reset draft when class or date changes (only on actual changes, not re-renders)
  const prevClassIdRef = { current: selectedClassId };
  const prevDateRef = { current: dateStr };


  // Helper to get effective record
  const getEffectiveRecord = (record: any): AttendanceRecord => {
    const draft = draftAttendance[record.enrollmentId];
    return {
      status: draft?.status || record.attendance?.status || "ABSENT",
      remarks: draft?.remarks !== undefined ? draft.remarks : (record.attendance?.remarks || ""),
    };
  };

  // Handlers
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
      filteredData.length === (attendanceData?.length || 0)
        ? "Marked all students as Present"
        : `Marked ${filteredData.length} visible students as Present`
    );
  };

  const handleSave = async () => {
    if (!attendanceData) return;
    if (Object.keys(draftAttendance).length === 0) {
      toast.warning("No attendance changes to save. Please mark at least one student.");
      return;
    }
    try {
      const records = attendanceData.map((record: any) => {
        const effective = getEffectiveRecord(record);
        return {
          id: record.attendance?.id, // CRITICAL: This was missing in the original code, causing the backend to wipe untouched students on a 2nd save.
          enrollmentId: record.enrollmentId,
          status: effective.status,
          remarks: effective.remarks,
        };
      });

      const presentCount = records.filter((r: any) => r.status === "PRESENT").length;
      const absentCount = records.filter((r: any) => r.status === "ABSENT").length;
      toast.info(`Saving: ${presentCount} Present, ${absentCount} Absent`);

      await bulkUpdate({ date: dateStr, records }).unwrap();
      toast.success("Attendance saved successfully");

      // Update the draft to mirror exactly what was just saved.
      // Avoids the race condition where clearing the draft and waiting for the RTK Query
      // cache refetch to re-seed it can interleave incorrectly, leaving the draft empty
      // and breaking any subsequent save.
      const confirmedDraft: Record<string, Partial<AttendanceRecord>> = {};
      records.forEach((r) => {
        confirmedDraft[r.enrollmentId] = { status: r.status, remarks: r.remarks };
      });
      setDraftAttendance(confirmedDraft);
      setHasUnsavedChanges(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to save attendance");
    }
  };

  // Filtered Data
  const filteredData = useMemo(() => {
    if (!attendanceData) return [];
    return attendanceData.filter((record: any) => {
      const fullName = `${record.student?.firstName} ${record.student?.lastName}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [attendanceData, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!attendanceData) return { total: 0, present: 0, late: 0, absent: 0 };
    let present = 0, late = 0, absent = 0;
    attendanceData.forEach((record: any) => {
      const { status } = getEffectiveRecord(record);
      if (status === "PRESENT") present++;
      else if (status === "LATE") late++;
      else absent++;
    });
    return { total: attendanceData.length, present, late, absent };
  }, [attendanceData, draftAttendance]);

  const getInitials = (f?: string, l?: string) =>
    `${(f || "")[0] || ""}${(l || "")[0] || ""}`.toUpperCase() || "?";

  const renderStatusButtons = (enrollmentId: string, status: string, isMobile = false) => (
    <div className="inline-flex p-1 gap-1" style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-md)" }}>
      {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => {
        const active = status === s;
        const activeBg = s === "PRESENT" ? "var(--emerald-signal)" : s === "LATE" ? "var(--amber-signal)" : "var(--crimson-signal)";
        return (
          <button
            key={s}
            onClick={() => handleStatusChange(enrollmentId, s)}
            title={s.charAt(0) + s.slice(1).toLowerCase()}
            className="flex items-center justify-center font-bold text-xs transition-all"
            style={{
              width: isMobile ? 32 : 36,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: active ? activeBg : "transparent",
              color: active ? "#fff" : "var(--foreground-muted)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.15)" : "none",
            }}
          >
            {s[0]}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full min-h-screen pb-32 md:pb-20">
      <Header
        schoolLogo={tenantInfo?.logoUrl}
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)", fontFamily: "var(--font-manrope)" }}>Admin Attendance</h1>
            <p className="mt-1" style={{ color: "var(--foreground-muted)" }}>
              Manage daily attendance for any class.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white p-4 flex flex-col lg:flex-row gap-4 items-center justify-between" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-center">
            
            {/* Class Selector */}
            <div className="relative w-full md:w-64">
                <Select
                    value={selectedClassId}
                    onValueChange={(val) => {
                      if (hasUnsavedChanges) {
                        if (!confirm("You have unsaved attendance changes. Are you sure you want to switch classes? Your changes will be lost.")) {
                          return;
                        }
                      }
                      setSelectedClassId(val);
                      setDraftAttendance({}); // Clear draft when switching class
                      setHasUnsavedChanges(false);
                    }}
                >
                    <SelectTrigger className="pl-4 h-11 font-bold w-full" style={{ background: "var(--surface-muted)", borderColor: "var(--border-medium)", borderRadius: "var(--radius-xl)", color: "var(--foreground)" }}>
                    <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                    {classes?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Date Picker */}
            <div className="relative w-full md:w-auto">
                <Popover>
                    <PopoverTrigger 
                        className={cn(
                            buttonVariants({ variant: "outline" }),
                            "w-full md:w-[240px] pl-3 text-left font-normal h-11",
                            !currentDate && "text-muted-foreground"
                        )}
                        style={{ borderRadius: "var(--radius-xl)" }}
                    >
                        {currentDate ? (
                            format(currentDate, "PPP")
                        ) : (
                            <span>Pick a date</span>
                        )}
                        <LucideCalendar className="ml-auto h-4 w-4 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={currentDate}
                            onSelect={(date) => {
                              if (date) {
                                if (hasUnsavedChanges) {
                                  if (!confirm("You have unsaved attendance changes. Are you sure you want to change the date? Your changes will be lost.")) {
                                    return;
                                  }
                                }
                                setCurrentDate(date as Date);
                                setDraftAttendance({}); // Clear draft when switching date
                                setHasUnsavedChanges(false);
                              }
                            }}
                            disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                            }
                        />
                    </PopoverContent>
                </Popover>
            </div>
            
            <div
              className="hidden md:flex items-center gap-2 px-4 h-11 font-bold min-w-[150px] justify-center"
              style={{ background: "var(--violet-tint)", color: "var(--violet-ink)", borderRadius: "var(--radius-md)", border: "1px solid color-mix(in oklch, var(--violet-ink) 15%, transparent)" }}
            >
               <Sun className="w-4 h-4" />
               <span>{format(currentDate, "eeee")}</span>
            </div>

          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
             <Button
                onClick={handleMarkAllPresent}
                className="h-11 font-bold px-6"
                style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)", border: "1px solid color-mix(in oklch, var(--emerald-signal) 20%, transparent)", borderRadius: "var(--radius-md)" }}
                disabled={!selectedClassId || isLoading}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark All Present
             </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white overflow-x-auto" style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--border-fine)", boxShadow: "var(--shadow-card)" }}>
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border-fine)" }}>
                <TableHead className="w-[80px] font-semibold text-xs uppercase pl-8 py-5" style={{ color: "var(--foreground-muted)" }}>S/N</TableHead>
                <TableHead className="font-semibold text-xs uppercase py-5" style={{ color: "var(--foreground-muted)" }}>Student Details</TableHead>
                <TableHead className="font-semibold text-xs uppercase py-5 text-center" style={{ color: "var(--foreground-muted)" }}>Attendance Status</TableHead>
                <TableHead className="font-semibold text-xs uppercase py-5" style={{ color: "var(--foreground-muted)" }}>Last Remark</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs uppercase py-5 text-right pr-8" style={{ color: "var(--foreground-muted)" }}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center"><div className="flex justify-center"><div className="h-8 w-8 rounded-full" style={{ border: "3px solid var(--border-fine)", borderTopColor: "var(--violet-ink)", animation: "spin 0.6s linear infinite" }}></div></div></TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center font-medium" style={{ color: "var(--crimson-signal)" }}>Failed to load attendance data. Please try again.</TableCell>
                </TableRow>
              ) : !selectedClassId ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center" style={{ color: "var(--foreground-muted)" }}>Please select a class to view attendance.</TableCell>
                </TableRow>
              ) : !attendanceData || attendanceData.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center" style={{ color: "var(--foreground-muted)" }}>No students found for this class.</TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center" style={{ color: "var(--foreground-muted)" }}>No students found matching your search.</TableCell>
                </TableRow>
              ) : (
                filteredData.map((record: any, index: number) => {
                  const { status, remarks } = getEffectiveRecord(record);
                  return (
                    <TableRow
                    key={record.enrollmentId}
                    className="group transition-colors"
                    style={{ borderTop: "1px solid var(--border-fine)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--violet-tint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                      <TableCell className="font-bold pl-8" style={{ color: "var(--foreground-muted)", fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(2, "0")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={record?.student?.profilePicture} />
                            <AvatarFallback className="font-bold" style={{ background: "var(--violet-tint)", color: "var(--violet-ink)" }}>
                              {getInitials(record.student.firstName, record.student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold" style={{ color: "var(--foreground)" }}>{record.student.firstName} {record.student.lastName}</p>
                            <p className="text-xs font-medium" style={{ color: "var(--foreground-muted)", fontFamily: "var(--font-geist-mono)" }}>{record.student.studentId || "#PL-000"}</p>
                            {record.student.gender && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface-muted)", color: "var(--foreground-muted)" }}>{record.student.gender}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{renderStatusButtons(record.enrollmentId, status)}</TableCell>
                      <TableCell>
                        <Input maxLength={255} value={remarks} onChange={(e) => handleRemarkChange(record.enrollmentId, e.target.value)} placeholder="Add remark..." className="h-9 text-sm transition-all" style={{ background: "transparent", borderColor: "transparent", borderRadius: "var(--radius-md)" }} />
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-slate-600"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end"><DropdownMenuItem>View Profile</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

       {/* Persistent Footer */}
       <div className="fixed bottom-0 left-0 right-0 bg-white p-4 z-40 md:pl-[280px]" style={{ borderTop: "1px solid var(--border-fine)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
            
            {/* Desktop Progress */}
            <div className="hidden md:flex items-center gap-6 flex-1">
                <div className="flex flex-col gap-1 w-full max-w-md">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        <span>Marked Progress</span>
                        <span style={{ color: "var(--violet-ink)" }}>{stats.present + stats.late + stats.absent} / {stats.total} Students</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-muted)" }}>
                        <div
                            className="h-full transition-all duration-500"
                            style={{ width: `${stats.total ? ((stats.present + stats.late + stats.absent) / stats.total) * 100 : 0}%`, background: "var(--violet-ink)" }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="hidden md:flex items-center gap-2 mr-4">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--emerald-tint)", color: "var(--emerald-signal)" }} title="Present">{stats.present}</div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--amber-tint)", color: "var(--amber-signal)" }} title="Late">{stats.late}</div>
                     <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--crimson-tint)", color: "var(--crimson-signal)" }} title="Absent">{stats.absent}</div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    className="h-12 w-full md:w-auto px-8 text-white font-bold disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    style={{ backgroundColor: "var(--violet-ink)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)" }}
                >
                    {isSaving ? (
                        <>Saving...</>
                    ) : (
                        <>
                            <Save className="w-5 h-5 mr-2" />
                            Save Attendance
                        </>
                    )}
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
