"use client";

import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { AppDispatch, RootState } from "@/reduxToolKit/store";
import { fetchAllUsers, getTenantInfo } from "@/reduxToolKit/user/userThunks";
import { bulkEnrollStudents, fetchClasses, fetchClassDetails, removeStudentFromClass, previewSchoolPromotion, executeSchoolPromotion } from "@/reduxToolKit/admin/adminThunks";
import type { PromotionPreviewResponse, ClassItem } from "@/reduxToolKit/admin/adminThunks";
import { fetchCurrentSession } from "@/reduxToolKit/setUp/setUpThunk";
import { AddStudentDialog } from "@/components/RMS/dialogs";
import { Header } from "@/components/RMS/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge"; // used in ClassPromotionTab
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, X, Users, BarChart3, FileText, ArrowRight, AlertCircle, CheckCircle2, RefreshCw, ChevronDown } from "lucide-react";
import { ProductTour } from "@/components/common/ProductTour";

const enrollmentTourSteps = [
  {
    target: '.enrollment-class-selector',
    content: "Start by selecting a class from this dropdown to view its enrolled students and available capacity.",
    disableBeacon: true,
  },
  {
    target: '.enrollment-add-student-btn',
    content: "Click here to add a new student directly and enroll them into the currently selected class.",
  },
  {
    target: '.enrollment-student-list',
    content: "This table shows all students currently enrolled in the selected class. You can remove students or view their details from here.",
  },
];

const DEFAULT_PRIMARY = "#641BC4";

export function AdminEnrollmentsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { students, teachers, tenantInfo } = useSelector((s: RootState) => s.user);
  const { classes, selectedClassDetails, promotionPreview, promotionLoading, promotionError } = useSelector((s: RootState) => s.admin);
  const schoolSettings = useSelector((s: RootState) => s.admin.schoolSettings);
  const { currentSession } = useSelector((s: RootState) => s.setUp);
  const primaryColor = schoolSettings?.primaryColor || DEFAULT_PRIMARY;

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loadingClassDetails, setLoadingClassDetails] = useState(false);

  // Promotion overrides: map of studentId -> targetClassId
  const [promotionOverrides, setPromotionOverrides] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    dispatch(fetchAllUsers());
    dispatch(fetchClasses(undefined));
    dispatch(getTenantInfo());
    dispatch(fetchCurrentSession());
  }, [dispatch]);

  const currentSessionName = currentSession?.session || "";
  const newSessionName = useMemo(() => {
    if (!currentSessionName) return "";
    const parts = currentSessionName.split("/");
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        return `${start + 1}/${end + 1}`;
      }
    }
    const year = parseInt(currentSessionName, 10);
    if (!isNaN(year)) {
      return String(year + 1);
    }
    return currentSessionName;
  }, [currentSessionName]);

  // Load class details when a class is selected
  useEffect(() => {
    if (selectedClassId) {
      setLoadingClassDetails(true);
      dispatch(fetchClassDetails(selectedClassId))
        .finally(() => setLoadingClassDetails(false));
    }
  }, [selectedClassId, dispatch]);

  // Get selected class info
  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  // Get enrolled students for the selected class
  const enrolledStudents = useMemo(() => {
    if (!selectedClassDetails) return [];
    
    // Create a set of teacher IDs to filter them out of the student list
    // This prevents confusion if a teacher was mistakenly enrolled in the database
    const teacherIds = new Set(teachers?.map((t: any) => t.id) || []);
    
    const enrollments = selectedClassDetails.enrollments || selectedClassDetails.students || [];
    return enrollments
      .map((e: any) => ({
        ...(e.student || e),
        enrolledAt: e.enrolledAt || e.createdAt || e.student?.createdAt,
      }))
      .filter((s: any) => !teacherIds.has(s.id));
  }, [selectedClassDetails, teachers]);

  const enrolledStudentIds = useMemo(() => {
    return new Set(enrolledStudents.map((s: any) => s.id));
  }, [enrolledStudents]);

  // Get available students (only those not enrolled in ANY class)
  const availableStudents = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    
    let available = students.filter((s: any) => {
      // 1. Skip if already in the currently selected class
      if (enrolledStudentIds.has(s.id)) return false;
      
      // 2. Skip if already enrolled in ANY other class
      const firstEnrollment = s.enrollments?.[0] || s.enrollment || {};
      const profile = s.studentProfile || s.profile || {};
      const existingClassId = s.classId || firstEnrollment.classId || s.class?.id || firstEnrollment.class?.id || profile.classId || "";
      
      return !existingClassId;
    });
    
    if (term) {
      available = available.filter((s: any) => {
        const name = `${s?.firstName || ""} ${s?.lastName || ""}`.toLowerCase();
        const studentId = String(s?.studentId || s?.code || "").toLowerCase();
        return name.includes(term) || studentId.includes(term);
      });
    }
    
    return available;
  }, [students, enrolledStudentIds, debouncedSearch]);

  // Enroll a single student
  const enrollStudent = async (studentId: string) => {
    if (!selectedClassId) return toast.error("Please select a class first");
    
    setEnrolling(studentId);
    try {
      await dispatch(bulkEnrollStudents({ 
        classId: selectedClassId, 
        studentIds: [studentId] 
      })).unwrap();
      toast.success("Student enrolled successfully");
      dispatch(fetchClassDetails(selectedClassId));
    } catch (error: any) {
      toast.error(error || "Failed to enroll student");
    } finally {
      setEnrolling(null);
    }
  };

  // Remove a student from class
  const removeStudent = async (studentId: string) => {
    if (!selectedClassId) return;
    
    setRemoving(studentId);
    try {
      await dispatch(removeStudentFromClass({ 
        classId: selectedClassId, 
        studentId 
      })).unwrap();
      toast.success("Student removed from class");
      dispatch(fetchClassDetails(selectedClassId));
    } catch (error: any) {
      toast.error(error || "Failed to remove student");
    } finally {
      setRemoving(null);
    }
  };


  // Get class teacher name
  const classTeacher = useMemo(() => {
    if (!selectedClassDetails) return null;
    const teachers = selectedClassDetails.teacherAssignments || selectedClassDetails.teachers || [];
    const classTeacherAssignment = teachers.find((t: any) => t.isClassTeacher);
    if (classTeacherAssignment) {
      const teacher = classTeacherAssignment.teacher || classTeacherAssignment;
      return `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "Not assigned";
    }
    return teachers[0]?.teacher?.firstName 
      ? `${teachers[0].teacher.firstName} ${teachers[0].teacher.lastName || ""}`.trim()
      : "Not assigned";
  }, [selectedClassDetails]);


  const capacity = selectedClass?.capacity || 30;
  const enrolled = enrolledStudents.length;
  const capacityPercent = Math.min((enrolled / capacity) * 100, 100);

  return (
    <div className="w-full">
      <ProductTour tourKey="admin_enrollments" steps={enrollmentTourSteps} />
      <Header 
        schoolLogo={tenantInfo?.logoUrl} 
        schoolName={tenantInfo?.name || "ParaLearn School"}
      />

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Enrollment Manager</h1>
          <p className="text-slate-500 mt-1">
            Manage registration and student allocation for{" "}
            <span className="font-semibold text-slate-700">
              {selectedClass?.name || "your classes"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Class Selector */}
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="enrollment-class-selector h-11 w-[200px] rounded-xl bg-white">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddStudentDialog>
            <Button
              className="enrollment-add-student-btn h-11 rounded-xl text-white font-semibold gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <UserPlus className="w-4 h-4" />
              Add New Student
            </Button>
          </AddStudentDialog>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="enrollment" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl flex flex-col sm:flex-row h-auto w-full sm:w-fit">
          <TabsTrigger value="enrollment" className="rounded-lg px-4 sm:px-6 py-2 sm:py-1.5 data-[state=active]:bg-white w-full sm:w-auto">
            <Users className="w-4 h-4 mr-2" />
            Enrollment Portal
          </TabsTrigger>
          <TabsTrigger value="stats" className="rounded-lg px-4 sm:px-6 py-2 sm:py-1.5 data-[state=active]:bg-white w-full sm:w-auto">
            <BarChart3 className="w-4 h-4 mr-2" />
            Class Stats
          </TabsTrigger>
          <TabsTrigger value="promotion" className="rounded-lg px-4 sm:px-6 py-2 sm:py-1.5 data-[state=active]:bg-white w-full sm:w-auto">
            <FileText className="w-4 h-4 mr-2" />
            Class Promotion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollment" className="mt-6">
          {!selectedClassId ? (
            <Card className="p-12 rounded-2xl border-slate-100 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900">Select a Class</h3>
              <p className="text-slate-500 mt-2 max-w-md mx-auto">
                Choose a class from the dropdown above to manage student enrollments.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available Students Panel */}
              <Card className="rounded-2xl border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Available Students</h3>
                      <p className="text-sm text-slate-500 mt-0.5">{availableStudents.length} total</p>
                    </div>
                  </div>
                  
                  {/* Search */}
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search students by name or ID..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50"
                    />
                  </div>
                </div>

                {/* Students List */}
                <div className="max-h-[500px] overflow-y-auto">
                  {availableStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-medium">No available students</p>
                      <p className="text-sm mt-1">All students are enrolled or no match found.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {availableStudents.map((student: any) => (
                        <div 
                          key={student.id} 
                          className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 shadow-sm">
                              <img 
                                src={student.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id || student.studentId}`} 
                                alt=""
                                className="w-full h-full object-cover bg-slate-50"
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-sm text-slate-500">
                                ID: {student.studentId || student.code || "—"}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => enrollStudent(student.id)}
                            disabled={enrolling === student.id}
                            className="h-9 px-4 rounded-lg text-white font-medium"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {enrolling === student.id ? "..." : "Enroll"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Class Roster Panel */}
              <Card className="rounded-2xl border-slate-100 overflow-hidden" style={{ backgroundColor: primaryColor }}>
                <div className="p-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{selectedClass?.name} Roster</h3>
                      <p className="text-white/80 text-sm mt-0.5">
                        CLASS TEACHER: {classTeacher?.toUpperCase() || "NOT ASSIGNED"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/70">Capacity</p>
                      <p className="text-2xl font-bold">{enrolled}/{capacity}</p>
                    </div>
                  </div>
                  
                  {/* Capacity Progress Bar */}
                  <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                </div>

                {/* Enrolled Students List */}
                <div className="bg-white rounded-t-3xl -mt-3">
                  <div className="p-4 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Currently Enrolled
                    </p>
                  </div>
                  
                  <div className="max-h-[380px] overflow-y-auto">
                    {loadingClassDetails ? (
                      <div className="p-8 text-center text-slate-500">
                        <div 
                          className="w-8 h-8 border-2 border-slate-200 rounded-full animate-spin mx-auto mb-2"
                          style={{ borderTopColor: primaryColor }}
                        />
                        <p className="text-sm">Loading students...</p>
                      </div>
                    ) : enrolledStudents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-medium">No students enrolled</p>
                        <p className="text-sm mt-1">Enroll students from the left panel.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {enrolledStudents.map((student: any) => (
                          <div 
                            key={student.id} 
                            className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                          >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 shadow-sm">
                              <img 
                                src={student?.profilePicture || student?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student?.id || student?.studentId || 'student'}`} 
                                alt=""
                                className="w-full h-full object-cover bg-slate-50"
                              />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Reg: {student.studentId || student.code || "—"}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeStudent(student.id)}
                              disabled={removing === student.id}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              {removing === student.id ? (
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Export Button */}
                  <div className="p-4 border-t border-slate-100">
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl border-slate-200 gap-2"
                      onClick={() => toast.info("PDF export coming soon!")}
                    >
                      <FileText className="w-4 h-4" />
                      Export Class List (PDF)
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <Card className="p-8 rounded-2xl border-slate-100 text-center">
            <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Class Statistics</h3>
            <p className="text-slate-500 mt-2">
              Enrollment statistics and analytics coming soon.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="promotion" className="mt-6">
          <ClassPromotionTab
            classes={classes}
            promotionPreview={promotionPreview}
            promotionLoading={promotionLoading}
            promotionError={promotionError}
            promotionOverrides={promotionOverrides}
            setPromotionOverrides={setPromotionOverrides}
            executing={executing}
            primaryColor={primaryColor}
            currentSessionName={currentSessionName}
            newSessionName={newSessionName}
            onPreview={() => {
              if (!currentSessionName) {
                toast.error("Active academic session not set. Please set it up first.");
                return;
              }
              dispatch(previewSchoolPromotion({ currentSession: currentSessionName, newSession: newSessionName }));
            }}
            onExecute={async () => {
              if (!currentSessionName) {
                toast.error("Active academic session not set.");
                return;
              }
              setExecuting(true);
              try {
                const overridesMap: Record<string, { status: string; toClassId?: string }> = {};
                
                Object.entries(promotionOverrides).forEach(([studentId, targetClassId]) => {
                  let fromClassId = "";
                  if (promotionPreview?.classes) {
                    for (const cls of promotionPreview.classes) {
                      const hasStudent = cls.students.some((s: any) => s.studentId === studentId);
                      if (hasStudent) {
                        fromClassId = cls.fromClass.id;
                        break;
                      }
                    }
                  }
                  const isRepeat = fromClassId && targetClassId === fromClassId;
                  overridesMap[studentId] = {
                    status: isRepeat ? "repeated" : "promoted",
                    toClassId: targetClassId,
                  };
                });

                await dispatch(
                  executeSchoolPromotion({
                    currentSession: currentSessionName,
                    newSession: newSessionName,
                    overrides: overridesMap,
                  }),
                ).unwrap();
                toast.success("Class promotion executed successfully");
                setPromotionOverrides({});
                dispatch(fetchClasses(undefined));
              } catch (e: any) {
                toast.error(e || "Failed to execute promotion");
              } finally {
                setExecuting(false);
              }
            }}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ─── Class Promotion Tab ──────────────────────────────────────────────────────

type ClassPromotionTabProps = {
  classes: ClassItem[];
  promotionPreview: PromotionPreviewResponse | null;
  promotionLoading: boolean;
  promotionError: string | null;
  promotionOverrides: Record<string, string>;
  setPromotionOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  executing: boolean;
  primaryColor: string;
  onPreview: () => void;
  onExecute: () => void;
  currentSessionName: string;
  newSessionName: string;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  promote:  { label: "Promote",  color: "bg-emerald-100 text-emerald-700" },
  graduate: { label: "Graduate", color: "bg-blue-100 text-blue-700" },
  repeat:   { label: "Repeat",   color: "bg-amber-100 text-amber-700" },
};

function ClassPromotionTab({
  classes,
  promotionPreview,
  promotionLoading,
  promotionError,
  promotionOverrides,
  setPromotionOverrides,
  executing,
  primaryColor,
  onPreview,
  onExecute,
  currentSessionName,
  newSessionName,
}: ClassPromotionTabProps) {
  const previewClasses = promotionPreview?.classes ?? [];
  const totalStudents  = previewClasses.reduce((n, c) => n + (c.students?.length ?? 0), 0);
  const summary = promotionPreview?.summary ?? {};

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="rounded-2xl border-slate-100 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">School-Wide Class Promotion</h3>
            <p className="text-sm text-slate-500 mt-1">
              Preview which students will be promoted, graduated, or held back before committing
              any changes. You can override individual students using the dropdowns below.
            </p>
            {currentSessionName ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Active Session:</span>
                <Badge variant="outline" className="border-purple-200 bg-purple-50/50 text-purple-700">
                  {currentSessionName}
                </Badge>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span>Next Session:</span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50/50 text-emerald-700">
                  {newSessionName}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-amber-600 mt-2 font-medium">
                No active academic session detected. Please set up the current session first.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={onPreview}
              disabled={promotionLoading}
              className="h-10 rounded-xl border-slate-200 gap-2 w-full sm:w-auto"
            >
              <RefreshCw className={`w-4 h-4 ${promotionLoading ? "animate-spin" : ""}`} />
              {promotionPreview ? "Re-run Preview" : "Preview Promotion"}
            </Button>
            {promotionPreview && (
              <Button
                onClick={onExecute}
                disabled={executing || promotionLoading}
                className="h-10 rounded-xl text-white font-semibold gap-2 w-full sm:w-auto"
                style={{ backgroundColor: primaryColor }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {executing ? "Executing…" : "Execute Promotion"}
              </Button>
            )}
          </div>
        </div>

        {/* Summary pills */}
        {promotionPreview && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
              {totalStudents} students total
            </span>
            {Object.entries(summary).map(([action, count]) => {
              const meta = ACTION_LABELS[action] ?? { label: action, color: "bg-slate-100 text-slate-600" };
              return (
                <span key={action} className={`text-xs px-3 py-1 rounded-full font-medium ${meta.color}`}>
                  {count} {meta.label.toLowerCase()}
                </span>
              );
            })}
          </div>
        )}
      </Card>

      {/* Error */}
      {promotionError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {promotionError}
        </div>
      )}

      {/* Loading skeleton */}
      {promotionLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-2xl border-slate-100 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="h-10 bg-slate-100 rounded-xl" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!promotionLoading && !promotionPreview && !promotionError && (
        <Card className="p-10 rounded-2xl border-slate-100 text-center">
          <ArrowRight className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">Run a Preview First</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
            Click "Preview Promotion" to see a dry-run of how each student will be moved
            before any changes are saved.
          </p>
        </Card>
      )}

      {/* Per-class breakdown */}
      {!promotionLoading && previewClasses.length > 0 && (
        <div className="space-y-4">
          {previewClasses.map((cls, idx) => (
            <Card key={idx} className="rounded-2xl border-slate-100 overflow-hidden">
              {/* Class header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-slate-900 truncate">{cls.fromClass?.name}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-600 truncate">
                    {cls.toClass?.name ?? <span className="italic text-slate-400">No next class</span>}
                  </span>
                </div>
                <Badge variant="secondary" className="shrink-0 self-start sm:self-auto">
                  {cls.students?.length ?? 0} students
                </Badge>
              </div>

              {/* Students */}
              {(cls.students?.length ?? 0) === 0 ? (
                <p className="p-4 text-sm text-slate-400 text-center">No students in this class.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cls.students.map((student) => {
                    const meta = ACTION_LABELS[student.action] ?? { label: student.action, color: "bg-slate-100 text-slate-600" };
                    const override = promotionOverrides[student.studentId];
                    return (
                      <div
                        key={student.studentId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-slate-500">
                              {(student.studentName || "?")[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{student.studentName}</p>
                            {student.studentIdNumber && (
                              <p className="text-xs text-slate-400">{student.studentIdNumber}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${meta.color}`}>
                            {meta.label}
                          </span>

                          {/* Override select */}
                          <div className="relative">
                            <select
                              value={override ?? ""}
                              onChange={(e) =>
                                setPromotionOverrides((prev) => {
                                  const next = { ...prev };
                                  if (e.target.value) next[student.studentId] = e.target.value;
                                  else delete next[student.studentId];
                                  return next;
                                })
                              }
                              className="text-xs h-8 pl-3 pr-7 rounded-lg border border-slate-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-200 cursor-pointer"
                            >
                              <option value="">Default</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                          </div>

                          {override && (
                            <button
                              onClick={() =>
                                setPromotionOverrides((prev) => {
                                  const next = { ...prev };
                                  delete next[student.studentId];
                                  return next;
                                })
                              }
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                              title="Clear override"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
