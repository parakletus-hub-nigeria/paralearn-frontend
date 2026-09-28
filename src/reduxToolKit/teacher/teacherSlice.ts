"use client";

import { createSlice } from "@reduxjs/toolkit";
import type {
  AcademicCurrent,
  Assessment,
  TeacherComment,
} from "./teacherThunks";
import {
  addComment,
  bulkUploadScoresExcel,
  fetchAcademicCurrent,
  fetchAssessmentDetail,
  fetchAssessmentSubmissions,
  fetchAssessmentsByStatus,
  fetchAssessmentsByClassSubject,
  fetchBookletPreview,
  fetchMyAssessments,
  fetchMyComments,
  fetchScoresByAssessmentTeacher,
  fetchTeacherClasses,
  gradeAnswer,
  createTeacherAssessment,
  publishAssessment,
  submitReportsForApproval,
  uploadOfflineScores,
  fetchClassStudents,
  fetchClassSubjects,
  fetchAssessmentCategories,
  updateTeacherAssessment,
  deleteTeacherAssessment,
} from "./teacherThunks";

type TeacherState = {
  academicCurrent: AcademicCurrent | null;
  assessments: Assessment[];
  assessmentsByStatus: Record<string, Assessment[]>;
  assessmentsByClassSubject: Assessment[];
  selectedAssessment: Assessment | null;
  submissions: any[];
  teacherClasses: any[];
  classStudents: any[];
  classSubjects: any[];
  assessmentCategories: any[];
  scores: any[];
  comments: TeacherComment[];
  bookletPreview: any | null;
  loading: boolean;
  assessmentsLoading: boolean;
  classesLoading: boolean;
  categoriesLoading: boolean;
  error: string | null;
  success: string | null;
};

const initialState: TeacherState = {
  academicCurrent: null,
  assessments: [],
  assessmentsByStatus: {},
  assessmentsByClassSubject: [],
  selectedAssessment: null,
  submissions: [],
  teacherClasses: [],
  classStudents: [],
  classSubjects: [],
  assessmentCategories: [],
  scores: [],
  comments: [],
  bookletPreview: null,
  loading: false,
  assessmentsLoading: false,
  classesLoading: false,
  categoriesLoading: false,
  error: null,
  success: null,
};

const teacherSlice = createSlice({
  name: "teacher",
  initialState,
  reducers: {
    clearTeacherError: (state) => {
      state.error = null;
    },
    clearTeacherSuccess: (state) => {
      state.success = null;
    },
    clearSelectedAssessment: (state) => {
      state.selectedAssessment = null;
      state.submissions = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAcademicCurrent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAcademicCurrent.fulfilled, (state, action) => {
        state.loading = false;
        state.academicCurrent = action.payload;
      })
      .addCase(fetchAcademicCurrent.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to load academic session";
      });

    builder
      .addCase(fetchMyAssessments.pending, (state) => {
        state.assessmentsLoading = true;
        state.error = null;
      })
      .addCase(fetchMyAssessments.fulfilled, (state, action) => {
        state.assessmentsLoading = false;
        state.assessments = action.payload;
      })
      .addCase(fetchMyAssessments.rejected, (state, action) => {
        state.assessmentsLoading = false;
        state.error =
          (action.payload as string) || "Failed to load assessments";
      });

    builder
      .addCase(fetchTeacherClasses.pending, (state) => {
        state.classesLoading = true;
        state.error = null;
      })
      .addCase(fetchTeacherClasses.fulfilled, (state, action) => {
        state.classesLoading = false;
        state.teacherClasses = action.payload;
      })
      .addCase(fetchTeacherClasses.rejected, (state, action) => {
        state.classesLoading = false;
        state.error =
          (action.payload as string) || "Failed to load teacher classes";
      });

    builder
      .addCase(createTeacherAssessment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTeacherAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Assessment created";
        // Add the newly created assessment to the list
        if (action.payload?.id) {
          const payload = action.payload;
          // Log response to verify classId/subjectId are properly returned
          console.log("[teacherSlice] Assessment created, response has:", {
            id: payload.id,
            classId: payload.classId,
            subjectId: payload.subjectId,
            classSubjectIds: payload.classSubjectIds,
            hasNestedClass: !!payload.class?.id,
            hasNestedSubject: !!payload.subject?.id,
          });

          const newAssessment = {
            id: payload.id,
            title: payload.title || "Untitled Assessment",
            classId: payload.classId || payload.class?.id, // Fallback to nested class
            subjectId: payload.subjectId || payload.subject?.id, // Fallback to nested subject
            totalMarks: payload.totalMarks ?? 100,
            duration: payload.durationMins ?? payload.duration ?? 60,
            status: "not_started",
            isOnline: payload.assessmentType === "online",
            ...payload,
          };

          // Warn if classId is missing - helps debug response structure issues
          if (!newAssessment.classId) {
            console.warn(
              "[teacherSlice] WARNING: Assessment created but classId not found in response",
              { assessmentId: newAssessment.id, response: payload },
            );
          }

          // Check if assessment already exists to avoid duplicates
          if (!state.assessments.find((a) => a.id === newAssessment.id)) {
            state.assessments.unshift(newAssessment);
          }
        }
      })
      .addCase(createTeacherAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to create assessment";
      });

    // Fetch Assessments by Class/Subject
    builder
      .addCase(fetchAssessmentsByClassSubject.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.assessmentsByClassSubject = [];
      })
      .addCase(fetchAssessmentsByClassSubject.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentsByClassSubject = action.payload;
      })
      .addCase(fetchAssessmentsByClassSubject.rejected, (state, action) => {
        state.loading = false;
        state.assessmentsByClassSubject = [];
        state.error =
          (action.payload as string) ||
          "Failed to load assessments for class/subject";
      });

    builder
      .addCase(fetchAssessmentsByStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssessmentsByStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.assessmentsByStatus[action.payload.status] = action.payload.items;
      })
      .addCase(fetchAssessmentsByStatus.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to load assessments";
      });

    builder
      .addCase(fetchAssessmentDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.selectedAssessment = null;
      })
      .addCase(fetchAssessmentDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedAssessment = action.payload;
      })
      .addCase(fetchAssessmentDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load assessment";
      });

    builder
      .addCase(fetchAssessmentSubmissions.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.submissions = [];
      })
      .addCase(fetchAssessmentSubmissions.fulfilled, (state, action) => {
        state.loading = false;
        state.submissions = action.payload;
      })
      .addCase(fetchAssessmentSubmissions.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to load submissions";
      });

    builder
      .addCase(fetchScoresByAssessmentTeacher.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.scores = [];
      })
      .addCase(fetchScoresByAssessmentTeacher.fulfilled, (state, action) => {
        state.loading = false;
        state.scores = action.payload;
      })
      .addCase(fetchScoresByAssessmentTeacher.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load scores";
      });

    builder
      .addCase(publishAssessment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(publishAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Publish status updated";
        // Update the status of the published/unpublished assessment in state immediately using the updated dates
        const payload = action.payload as any;
        const assessmentId = payload?.id;
        const isPublished = payload?.isPublished;
        if (assessmentId) {
          state.assessments = state.assessments.map((a) => {
            if (a.id === assessmentId) {
              const startsAt = payload.startsAt ?? a.startsAt;
              const endsAt = payload.endsAt ?? a.endsAt;
              let status = "draft";
              if (isPublished) {
                const now = new Date();
                const start = startsAt ? new Date(startsAt) : null;
                const end = endsAt ? new Date(endsAt) : null;
                if (end && now > end) {
                  status = "ended";
                } else if (start && now >= start) {
                  status = "started";
                } else {
                  status = "not_started";
                }
              }
              return {
                ...a,
                ...payload,
                status,
                isPublished,
              };
            }
            return a;
          });
        }
      })
      .addCase(publishAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to update publish state";
      });

    builder
      .addCase(gradeAnswer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(gradeAnswer.fulfilled, (state) => {
        state.loading = false;
        state.success = "Answer graded";
      })
      .addCase(gradeAnswer.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to grade answer";
      });

    builder
      .addCase(uploadOfflineScores.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadOfflineScores.fulfilled, (state) => {
        state.loading = false;
        state.success = "Scores uploaded";
      })
      .addCase(uploadOfflineScores.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to upload scores";
      });

    builder
      .addCase(bulkUploadScoresExcel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkUploadScoresExcel.fulfilled, (state) => {
        state.loading = false;
        state.success = "Bulk scores uploaded";
      })
      .addCase(bulkUploadScoresExcel.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to bulk upload scores";
      });

    builder
      .addCase(addComment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addComment.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Comment added";
        // Optimistic: append if it looks like a comment object
        if (action.payload?.studentId && action.payload?.comment) {
          state.comments = [action.payload, ...state.comments];
        }
      })
      .addCase(addComment.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to add comment";
      });

    builder
      .addCase(fetchMyComments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyComments.fulfilled, (state, action) => {
        state.loading = false;
        state.comments = action.payload;
      })
      .addCase(fetchMyComments.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || "Failed to load comments";
      });

    builder
      .addCase(fetchBookletPreview.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.bookletPreview = null;
      })
      .addCase(fetchBookletPreview.fulfilled, (state, action) => {
        state.loading = false;
        state.bookletPreview = action.payload;
      })
      .addCase(fetchBookletPreview.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to load booklet preview";
      });

    builder
      .addCase(submitReportsForApproval.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitReportsForApproval.fulfilled, (state) => {
        state.loading = false;
        state.success = "Submitted for approval";
      })
      .addCase(submitReportsForApproval.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to submit for approval";
      });

    builder
      .addCase(fetchClassStudents.pending, (state) => {
        state.classStudents = [];
      })
      .addCase(fetchClassStudents.fulfilled, (state, action) => {
        state.classStudents = action.payload;
      })
      .addCase(fetchClassStudents.rejected, (state) => {
        state.classStudents = [];
      });

    builder
      .addCase(fetchClassSubjects.pending, (state) => {
        state.classSubjects = [];
      })
      .addCase(fetchClassSubjects.fulfilled, (state, action) => {
        state.classSubjects = action.payload;
      })
      .addCase(fetchClassSubjects.rejected, (state) => {
        state.classSubjects = [];
      });

    // Assessment Categories
    builder
      .addCase(fetchAssessmentCategories.pending, (state) => {
        state.categoriesLoading = true;
      })
      .addCase(fetchAssessmentCategories.fulfilled, (state, action) => {
        state.categoriesLoading = false;
        state.assessmentCategories = action.payload;
      })
      .addCase(fetchAssessmentCategories.rejected, (state) => {
        state.categoriesLoading = false;
        // Non-critical, just empty list
        state.assessmentCategories = [];
      });

    // Update Assessment
    builder
      .addCase(updateTeacherAssessment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTeacherAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Assessment updated successfully";
        // Merge the updated fields into the matching assessment in state
        if (action.payload?.id) {
          state.assessments = state.assessments.map((a) =>
            a.id === action.payload.id ? { ...a, ...action.payload } : a,
          );
        }
      })
      .addCase(updateTeacherAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to update assessment";
      });

    // Delete Assessment
    builder
      .addCase(deleteTeacherAssessment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTeacherAssessment.fulfilled, (state, action) => {
        state.loading = false;
        state.assessments = state.assessments.filter(
          (a) => a.id !== action.payload,
        );
        state.success = "Assessment deleted successfully";
      })
      .addCase(deleteTeacherAssessment.rejected, (state, action) => {
        state.loading = false;
        state.error =
          (action.payload as string) || "Failed to delete assessment";
      });
  },
});

export const {
  clearTeacherError,
  clearTeacherSuccess,
  clearSelectedAssessment,
} = teacherSlice.actions;
export default teacherSlice.reducer;
