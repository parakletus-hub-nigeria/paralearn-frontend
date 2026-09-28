"use client";

import { createSlice } from "@reduxjs/toolkit";

const CBT_IDS_KEY = "cbt_exam_ids";
const loadCBTIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CBT_IDS_KEY) || "[]"); } catch { return []; }
};
const saveCBTIds = (ids: string[]) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CBT_IDS_KEY, JSON.stringify(ids)); } catch {}
};
import type { AssessmentItem, ClassItem, SchoolStatistics, SubjectItem } from "./adminThunks";
import {
  addCommentAdmin,
  approveReports,
  assignTeacherToClass,
  assignTeacherToSubject,
  bulkAddComments,
  bulkEnrollStudents,
  bulkUploadQuestions,
  bulkUploadScores,
  createAssessment,
  createClass,
  createSubject,
  enrollStudentToClass,
  fetchAttendance,
  fetchApprovalQueue,
  fetchAssessments,
  fetchBookletPreviewAdmin,
  fetchClasses,
  fetchClassDetails,
  fetchStudentComments,
  fetchGradingSystem,
  fetchGradingTemplates,
  fetchSchoolStatistics,
  fetchSchoolSettings,
  fetchScoresByAssessment,
  fetchSubjects,
  fetchTeacherAssignedClasses,
  publishAssessmentAdmin,
  recordAttendance,
  removeStudentFromClass,
  removeTeacherFromClass,
  updateAssessment,
  updateClass,
  updateGradingSystem,
  updateSchoolSettings,
  fetchAssessmentCategoriesMap,
  createAssessmentCategory,
  deleteAssessmentCategory,
  deleteAssessment,
  fetchAssessmentSubmissions,
  assignTeacherToClassSubject,
  removeTeacherFromClassSubject,
  fetchClassSubjects,
  deleteClass,
  fetchAssessmentDetail,
  fetchCBTExams,
  previewSchoolPromotion,
  executeSchoolPromotion,
  type PromotionPreviewResponse,
} from "./adminThunks";

type AdminState = {
  loading: boolean;
  error: string | null;
  success: string | null;

  classes: ClassItem[];
  subjects: SubjectItem[];
  assessments: AssessmentItem[];

  scores: any[];

  schoolStatistics: SchoolStatistics | null;
  approvalQueue: any[];
  bookletPreview: any | null;

  schoolSettings: any | null;
  gradingTemplates: any[];
  gradingSystem: any | null;
  attendance: any[];
  comments: any[];

  // Class details with enrolled students
  selectedClassDetails: any | null;
  // Teacher's assigned classes
  // Teacher's assigned classes
  teacherClasses: any | null;
  assessmentCategories: any[];
  selectedAssessment: AssessmentItem | null;
  assessmentSubmissions: any[];
  selectedClassSubjects: any[];

  promotionPreview: PromotionPreviewResponse | null;
  promotionLoading: boolean;
  promotionError: string | null;
  cbtExamIds: string[];
};

const ensureString = (val: any, fallback: string): string => {
  if (typeof val === "string" && val.trim()) return val;
  if (val && typeof val === "object" && val.message && typeof val.message === "string") return val.message;
  return fallback;
};

const initialState: AdminState = {
  loading: false,
  error: null,
  success: null,
  classes: [],
  subjects: [],
  assessments: [],
  scores: [],
  schoolStatistics: null,
  approvalQueue: [],
  bookletPreview: null,
  schoolSettings: null,
  gradingTemplates: [],
  gradingSystem: null,
  attendance: [],
  comments: [],
  selectedClassDetails: null,
  teacherClasses: null,
  assessmentCategories: [],
  selectedAssessment: null,
  assessmentSubmissions: [],
  selectedClassSubjects: [],

  promotionPreview: null,
  promotionLoading: false,
  promotionError: null,
  cbtExamIds: loadCBTIds(),
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.error = null;
    },
    clearAdminSuccess: (state) => {
      state.success = null;
    },
    clearBookletPreview: (state) => {
      state.bookletPreview = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state: AdminState) => {
      state.loading = true;
      state.error = null;
      state.success = null;
    };
    const rejected = (state: AdminState, action: any, fallback: string) => {
      state.loading = false;
      state.error = ensureString(action.payload, fallback);
    };

    builder
      .addCase(fetchClasses.pending, pending)
      .addCase(fetchClasses.fulfilled, (state, action) => {
        state.loading = false;
        state.classes = action.payload;
      })
      .addCase(fetchClasses.rejected, (state, action) => rejected(state, action, "Failed to load classes"))

      .addCase(fetchClassSubjects.pending, pending)
      .addCase(fetchClassSubjects.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedClassSubjects = action.payload;
      })
      .addCase(fetchClassSubjects.rejected, (state, action) => rejected(state, action, "Failed to load class subjects"))

      .addCase(assignTeacherToClassSubject.pending, pending)
      .addCase(assignTeacherToClassSubject.fulfilled, (state) => {
        state.loading = false;
        state.success = "Teacher assigned successfully";
      })
      .addCase(assignTeacherToClassSubject.rejected, (state, action) => rejected(state, action, "Failed to assign teacher"))

      .addCase(removeTeacherFromClassSubject.pending, pending)
      .addCase(removeTeacherFromClassSubject.fulfilled, (state) => {
        state.loading = false;
        state.success = "Teacher removed successfully";
      })
      .addCase(removeTeacherFromClassSubject.rejected, (state, action) => rejected(state, action, "Failed to remove teacher"));

    builder
      .addCase(createClass.pending, pending)
      .addCase(createClass.fulfilled, (state, action) => {
        state.loading = false;
        state.classes = [action.payload, ...state.classes];
        state.success = "Class created";
      })
      .addCase(createClass.rejected, (state, action) => rejected(state, action, "Failed to create class"));

    builder
      .addCase(updateClass.pending, pending)
      .addCase(updateClass.fulfilled, (state, action) => {
        state.loading = false;
        state.classes = state.classes.map((c) =>
          c.id === action.payload.id ? action.payload : c
        );
        state.success = "Class updated";
      })
      .addCase(updateClass.rejected, (state, action) =>
        rejected(state, action, "Failed to update class")
      );


    builder
      .addCase(deleteClass.pending, pending)
      .addCase(deleteClass.fulfilled, (state, action) => {
        state.loading = false;
        state.classes = state.classes.filter((c) => c.id !== action.payload);
        state.success = "Class deleted";
      })
      .addCase(deleteClass.rejected, (state, action) => rejected(state, action, "Failed to delete class"));

    builder
      .addCase(assignTeacherToClass.pending, pending)
      .addCase(assignTeacherToClass.fulfilled, (state) => {
        state.loading = false;
        state.success = "Teacher assigned to class";
      })
      .addCase(assignTeacherToClass.rejected, (state, action) => rejected(state, action, "Failed to assign teacher"));

    builder
      .addCase(enrollStudentToClass.pending, pending)
      .addCase(enrollStudentToClass.fulfilled, (state) => {
        state.loading = false;
        state.success = "Student enrolled successfully";
      })
      .addCase(enrollStudentToClass.rejected, (state, action) => rejected(state, action, "Failed to enroll student"));

    builder
      .addCase(fetchSubjects.pending, pending)
      .addCase(fetchSubjects.fulfilled, (state, action) => {
        state.loading = false;
        state.subjects = action.payload;
      })
      .addCase(fetchSubjects.rejected, (state, action) => rejected(state, action, "Failed to load subjects"));

    builder
      .addCase(createSubject.pending, pending)
      .addCase(createSubject.fulfilled, (state, action) => {
        state.loading = false;
        state.subjects = [action.payload, ...state.subjects];
        state.success = "Subject created";
      })
      .addCase(createSubject.rejected, (state, action) => rejected(state, action, "Failed to create subject"));

    builder
      .addCase(assignTeacherToSubject.pending, pending)
      .addCase(assignTeacherToSubject.fulfilled, (state) => {
        state.loading = false;
        state.success = "Teacher assigned to subject successfully";
      })
      .addCase(assignTeacherToSubject.rejected, (state, action) => rejected(state, action, "Failed to assign teacher"));

    builder
      .addCase(fetchAssessments.pending, pending)
      .addCase(fetchAssessments.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = action.payload;
        // Capture IDs of any online exams the backend returns
        const ids = new Set(state.cbtExamIds);
        for (const a of action.payload) {
          if (a?.id && !!a.isOnline) ids.add(a.id);
        }
        state.cbtExamIds = Array.from(ids);
        saveCBTIds(state.cbtExamIds);
      })
      .addCase(fetchAssessments.rejected, (state, action) => rejected(state, action, "Failed to load assessments"));

    builder
      .addCase(fetchCBTExams.pending, pending)
      .addCase(fetchCBTExams.fulfilled, (state, action) => {
        state.loading = false;
        // Merge CBT exams into the assessments array without overwriting offline ones
        const byId = new Map(state.assessments.map((a) => [a.id, a]));
        for (const a of action.payload) if (a?.id) byId.set(a.id, a);
        state.assessments = Array.from(byId.values());
      })
      .addCase(fetchCBTExams.rejected, (state, action) => rejected(state, action, "Failed to load CBT exams"));

    builder
      .addCase(createAssessment.pending, pending)
      .addCase(createAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = [action.payload, ...state.assessments];
        state.success = "Assessment created";
        // Check the request arg (not the response) — backend may not echo isOnline back
        const sentOnline = (action.meta.arg as any)?.isOnline;
        if (action.payload?.id && (sentOnline === true || sentOnline === "true")) {
          if (!state.cbtExamIds.includes(action.payload.id)) {
            state.cbtExamIds = [action.payload.id, ...state.cbtExamIds];
            saveCBTIds(state.cbtExamIds);
          }
        }
      })
      .addCase(createAssessment.rejected, (state, action) => rejected(state, action, "Failed to create assessment"));

    builder
      .addCase(updateAssessment.pending, pending)
      .addCase(updateAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = state.assessments.map((a) => (a.id === action.payload.id ? action.payload : a));
        state.success = "Assessment updated";
      })
      .addCase(updateAssessment.rejected, (state, action) => rejected(state, action, "Failed to update assessment"));

    builder
      .addCase(deleteAssessment.pending, pending)
      .addCase(deleteAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = state.assessments.filter((a) => a.id !== action.payload);
        state.cbtExamIds = state.cbtExamIds.filter((id) => id !== action.payload);
        saveCBTIds(state.cbtExamIds);
        state.success = "Assessment deleted";
      })
      .addCase(deleteAssessment.rejected, (state, action) => rejected(state, action, "Failed to delete assessment"));

    builder
      .addCase(publishAssessmentAdmin.pending, pending)
      .addCase(publishAssessmentAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Publish status updated";
        const payload = action.payload as any;
        if (payload?.id) {
          state.assessments = state.assessments.map((a: any) =>
            a.id === payload.id
              ? { ...a, status: payload.isPublished ? "started" : "not_started", isPublished: payload.isPublished }
              : a
          );
        }
      })
      .addCase(publishAssessmentAdmin.rejected, (state, action) => rejected(state, action, "Failed to publish assessment"));

    builder
      .addCase(bulkUploadQuestions.pending, pending)
      .addCase(bulkUploadQuestions.fulfilled, (state) => {
        state.loading = false;
        state.success = "Questions uploaded";
      })
      .addCase(bulkUploadQuestions.rejected, (state, action) => rejected(state, action, "Failed to upload questions"));

    builder
      .addCase(fetchScoresByAssessment.pending, pending)
      .addCase(fetchScoresByAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.scores = action.payload;
      })
      .addCase(fetchScoresByAssessment.rejected, (state, action) => rejected(state, action, "Failed to load scores"));

    builder
      .addCase(bulkUploadScores.pending, pending)
      .addCase(bulkUploadScores.fulfilled, (state) => {
        state.loading = false;
        state.success = "Scores uploaded";
      })
      .addCase(bulkUploadScores.rejected, (state, action) => rejected(state, action, "Failed to upload scores"));

    builder
      .addCase(fetchSchoolStatistics.pending, pending)
      .addCase(fetchSchoolStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.schoolStatistics = action.payload;
      })
      .addCase(fetchSchoolStatistics.rejected, (state, action) => rejected(state, action, "Failed to load statistics"));

    builder
      .addCase(fetchApprovalQueue.pending, pending)
      .addCase(fetchApprovalQueue.fulfilled, (state, action) => {
        state.loading = false;
        state.approvalQueue = action.payload;
      })
      .addCase(fetchApprovalQueue.rejected, (state, action) => rejected(state, action, "Failed to load approval queue"));

    builder
      .addCase(approveReports.pending, pending)
      .addCase(approveReports.fulfilled, (state) => {
        state.loading = false;
        state.success = "Reports updated";
      })
      .addCase(approveReports.rejected, (state, action) => rejected(state, action, "Failed to update reports"));

    builder
      .addCase(fetchBookletPreviewAdmin.pending, pending)
      .addCase(fetchBookletPreviewAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.bookletPreview = action.payload;
      })
      .addCase(fetchBookletPreviewAdmin.rejected, (state, action) =>
        rejected(state, action, "Failed to load booklet preview")
      );

    builder
      .addCase(fetchSchoolSettings.pending, pending)
      .addCase(fetchSchoolSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.schoolSettings = action.payload;
      })
      .addCase(fetchSchoolSettings.rejected, (state, action) =>
        rejected(state, action, "Failed to load school settings")
      );

    builder
      .addCase(updateSchoolSettings.pending, pending)
      .addCase(updateSchoolSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.schoolSettings = action.payload;
        state.success = "School settings updated";
      })
      .addCase(updateSchoolSettings.rejected, (state, action) =>
        rejected(state, action, "Failed to update school settings")
      );

    builder
      .addCase(fetchGradingTemplates.pending, pending)
      .addCase(fetchGradingTemplates.fulfilled, (state, action) => {
        state.loading = false;
        state.gradingTemplates = action.payload;
      })
      .addCase(fetchGradingTemplates.rejected, (state, action) =>
        rejected(state, action, "Failed to load grading templates")
      );

    builder
      .addCase(fetchGradingSystem.pending, pending)
      .addCase(fetchGradingSystem.fulfilled, (state, action) => {
        state.loading = false;
        state.gradingSystem = action.payload;
      })
      .addCase(fetchGradingSystem.rejected, (state, action) =>
        rejected(state, action, "Failed to load grading system")
      );

    builder
      .addCase(updateGradingSystem.pending, pending)
      .addCase(updateGradingSystem.fulfilled, (state, action) => {
        state.loading = false;
        state.gradingSystem = action.payload;
        state.success = "Grading system updated";
      })
      .addCase(updateGradingSystem.rejected, (state, action) =>
        rejected(state, action, "Failed to update grading system")
      );

    builder
      .addCase(recordAttendance.pending, pending)
      .addCase(recordAttendance.fulfilled, (state) => {
        state.loading = false;
        state.success = "Attendance recorded";
      })
      .addCase(recordAttendance.rejected, (state, action) =>
        rejected(state, action, "Failed to record attendance")
      );

    builder
      .addCase(fetchAttendance.pending, pending)
      .addCase(fetchAttendance.fulfilled, (state, action) => {
        state.loading = false;
        state.attendance = action.payload;
      })
      .addCase(fetchAttendance.rejected, (state, action) =>
        rejected(state, action, "Failed to fetch attendance")
      );

    builder
      .addCase(fetchStudentComments.pending, pending)
      .addCase(fetchStudentComments.fulfilled, (state, action) => {
        state.loading = false;
        state.comments = action.payload;
      })
      .addCase(fetchStudentComments.rejected, (state, action) =>
        rejected(state, action, "Failed to fetch comments")
      );

    builder
      .addCase(addCommentAdmin.pending, pending)
      .addCase(addCommentAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Comment added";
        if (action.payload) state.comments = [action.payload, ...state.comments];
      })
      .addCase(addCommentAdmin.rejected, (state, action) =>
        rejected(state, action, "Failed to add comment")
      );

    builder
      .addCase(bulkAddComments.pending, pending)
      .addCase(bulkAddComments.fulfilled, (state) => {
        state.loading = false;
        state.success = "Comments added";
      })
      .addCase(bulkAddComments.rejected, (state, action) =>
        rejected(state, action, "Failed to bulk add comments")
      );

    // Fetch class details with enrolled students
    builder
      .addCase(fetchClassDetails.pending, pending)
      .addCase(fetchClassDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedClassDetails = action.payload;
        
        // Update the counts in the global classes list if we find a match
        if (action.payload && action.payload.id) {
          state.classes = state.classes.map(cls => {
            if (cls.id === action.payload.id) {
              // Extract fresh counts from the detailed roster
              const enrollments = action.payload.enrollments || action.payload.students || [];
              const teacherAssignments = action.payload.teacherAssignments || action.payload.teachers || [];
              
              const teacherIds = new Set(teacherAssignments.map((a: any) => (a.teacherId || a.teacher?.id || a.id)));
              
              const studentCount = Array.isArray(enrollments) 
                ? enrollments.filter((e: any) => {
                    const studentId = e.studentId || e.student?.id || e.id;
                    const isAssignedTeacher = teacherIds.has(studentId);
                    
                    if (!isAssignedTeacher) return true;
                    
                    // If they are assigned as a teacher, only exclude them if they actually have a 'teacher' role
                    const studentObj = e.student || e;
                    const roles = studentObj.roles || (studentObj.user?.roles) || [];
                    const hasTeacherRole = Array.isArray(roles) && roles.some((r: any) => 
                      (r.role?.name === 'teacher') || (r.name === 'teacher') || (r === 'teacher')
                    );
                    
                    // If we have role info and it's not teacher, keep them as student
                    // If we DON'T have role info, we'll err on the side of counting them as students (per user request)
                    return !hasTeacherRole;
                  }).length 
                : (cls.studentCount || 0);
              
              const teacherCount = Array.isArray(teacherAssignments) ? teacherAssignments.length : (cls.teacherCount || 0);
              
              return {
                ...cls,
                studentCount,
                teacherCount,
                enrollments,
                teacherAssignments,
                _count: {
                  ...cls._count,
                  enrollments: studentCount,
                  teacherAssignments: teacherCount
                }
              };
            }
            return cls;
          });
        }
      })
      .addCase(fetchClassDetails.rejected, (state, action) =>
        rejected(state, action, "Failed to fetch class details")
      );

    // Bulk enroll students
    builder
      .addCase(bulkEnrollStudents.pending, pending)
      .addCase(bulkEnrollStudents.fulfilled, (state) => {
        state.loading = false;
        state.success = "Students enrolled successfully";
      })
      .addCase(bulkEnrollStudents.rejected, (state, action) =>
        rejected(state, action, "Failed to enroll students")
      );

    // Remove student from class
    builder
      .addCase(removeStudentFromClass.pending, pending)
      .addCase(removeStudentFromClass.fulfilled, (state) => {
        state.loading = false;
        state.success = "Student removed from class";
      })
      .addCase(removeStudentFromClass.rejected, (state, action) =>
        rejected(state, action, "Failed to remove student")
      );

    // Fetch teacher assigned classes
    builder
      .addCase(fetchTeacherAssignedClasses.pending, pending)
      .addCase(fetchTeacherAssignedClasses.fulfilled, (state, action) => {
        state.loading = false;
        state.teacherClasses = action.payload;
      })
      .addCase(fetchTeacherAssignedClasses.rejected, (state, action) =>
        rejected(state, action, "Failed to fetch teacher classes")
      );

    // Remove teacher from class
    builder
      .addCase(removeTeacherFromClass.pending, pending)
      .addCase(removeTeacherFromClass.fulfilled, (state) => {
        state.loading = false;
        state.success = "Teacher removed from class";
      })
      .addCase(removeTeacherFromClass.rejected, (state, action) =>
        rejected(state, action, "Failed to remove teacher")
      );
  // Assessment Categories
    builder
      .addCase(fetchAssessmentCategoriesMap.pending, pending)
      .addCase(fetchAssessmentCategoriesMap.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentCategories = action.payload;
      })
      .addCase(fetchAssessmentCategoriesMap.rejected, (state, action) =>
        rejected(state, action, "Failed to load assessment categories")
      );

    builder
      .addCase(createAssessmentCategory.pending, pending)
      .addCase(createAssessmentCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentCategories = [action.payload, ...state.assessmentCategories];
        state.success = "Assessment category created";
      })
      .addCase(createAssessmentCategory.rejected, (state, action) =>
        rejected(state, action, "Failed to create assessment category")
      );

    builder
      .addCase(deleteAssessmentCategory.pending, pending)
      .addCase(deleteAssessmentCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentCategories = state.assessmentCategories.filter((c) => c.id !== action.payload);
        state.success = "Assessment category deleted";
      })
      .addCase(deleteAssessmentCategory.rejected, (state, action) =>
        rejected(state, action, "Failed to delete assessment category")
      );

    // Assessment Details
    builder
      .addCase(fetchAssessmentDetail.pending, pending)
      .addCase(fetchAssessmentDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedAssessment = action.payload;
      })
      .addCase(fetchAssessmentDetail.rejected, (state, action) =>
        rejected(state, action, "Failed to load assessment details")
      );

    builder
      .addCase(fetchAssessmentSubmissions.pending, pending)
      .addCase(fetchAssessmentSubmissions.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentSubmissions = action.payload;
      })
      .addCase(fetchAssessmentSubmissions.rejected, (state, action) =>
        rejected(state, action, "Failed to load assessment submissions")
      );

    // Class Promotion
    builder
      .addCase(previewSchoolPromotion.pending, (state) => {
        state.promotionLoading = true;
        state.promotionError = null;
        state.promotionPreview = null;
      })
      .addCase(previewSchoolPromotion.fulfilled, (state, action) => {
        state.promotionLoading = false;
        state.promotionPreview = action.payload;
      })
      .addCase(previewSchoolPromotion.rejected, (state, action) => {
        state.promotionLoading = false;
        state.promotionError = ensureString(action.payload, "Failed to preview promotion");
      });

    builder
      .addCase(executeSchoolPromotion.pending, (state) => {
        state.promotionLoading = true;
        state.promotionError = null;
      })
      .addCase(executeSchoolPromotion.fulfilled, (state) => {
        state.promotionLoading = false;
        state.promotionPreview = null;
      })
      .addCase(executeSchoolPromotion.rejected, (state, action) => {
        state.promotionLoading = false;
        state.promotionError = ensureString(action.payload, "Failed to execute promotion");
      });
  },
});

export const { clearAdminError, clearAdminSuccess, clearBookletPreview } = adminSlice.actions;
export default adminSlice.reducer;

