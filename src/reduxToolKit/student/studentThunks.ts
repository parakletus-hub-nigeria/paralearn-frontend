import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "@/lib/api";

// Question interface based on usage in LiveExamInterface
export interface AssessmentQuestion {
  id: string;
  prompt?: string;
  questionText?: string; // Fallback for prompt
  text?: string;
  type: "MCQ" | "MULTI_SELECT" | "ESSAY" | "TEXT" | "TRUE_FALSE" | string;
  questionType?: string;
  choices?: { id: string; text: string }[];
  options?: { id: string; text: string }[]; // Fallback for choices
  marks: number;
}

export interface StudentAssessment {
  id: string;
  title: string;
  instructions: string;
  durationMins: number;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  totalMarks: number;
  passingMarks: number;
  questionCount: number;
  subject: {
    id: string;
    name: string;
    class: {
      id: string;
      name: string;
      code: string;
    };
  };
  category: {
    id: string;
    name: string;
  };
  submissions: {
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationSecs?: number;
  }[];
  status: "not_started" | "started" | "ended" | "submitted";
  isOnline?: boolean;
  questions?: AssessmentQuestion[]; // Added questions property
}

export interface StartAssessmentResponse {
  submissionId: string;
  status: string;
  startedAt: string;
  deadline: string;
}

// Fetch all available assessments for the student (K-12 System)
// Uses the optimized student/published endpoint (returns all statuses in one call)
// The backend filters to PUBLISHED assessments only (role-based authorization)
export const fetchStudentAssessments = createAsyncThunk(
  "student/fetchAssessments",
  async (_, { rejectWithValue }) => {
    try {
      console.log(
        "[fetchStudentAssessments] Fetching published assessments from backend in a single request...",
      );

      const res = await apiClient.get("/api/proxy/assessments/student/published");
      const rawData = res.data?.data || res.data || [];
      const rawCombined = Array.isArray(rawData) ? rawData : [];

      console.log(
        "[fetchStudentAssessments] Raw items returned:",
        rawCombined.length,
      );

      // Handle grouped response structure (grouped by subject)
      // Teacher endpoint returns: [ { name: "Subject", class: {...}, assessments: [...] }, ... ]
      let assessments: any[] = [];
      const isGrouped = rawCombined.some(
        (item: any) => item.assessments && Array.isArray(item.assessments),
      );

      if (isGrouped) {
        console.log(
          "[fetchStudentAssessments] Response is GROUPED by subject - flattening...",
        );
        rawCombined.forEach((group: any) => {
          if (group.assessments && Array.isArray(group.assessments)) {
            group.assessments.forEach((assess: any) => {
              // Calculate fallback status if missing
              let status = assess.status;
              if (!status) {
                const now = new Date();
                const startsAt = assess.startsAt ? new Date(assess.startsAt) : null;
                const endsAt = assess.endsAt ? new Date(assess.endsAt) : null;
                if (endsAt && now > endsAt) {
                  status = "ended";
                } else if (startsAt && now >= startsAt) {
                  status = "started";
                } else {
                  status = "not_started";
                }
              }

              assessments.push({
                ...assess,
                classId: group.class?.id || assess.classId,
                subjectId: group.id || group.subjectId,
                subject: {
                  id: group.id || group.subjectId,
                  name: group.name || "Unknown Subject",
                  code: group.code,
                },
                class: group.class || { id: "unknown", name: "Unknown Class" },
                isPublished: true,
                isOnline: assess.isOnline ?? assess.assessmentType === "online",
                status,
              });
            });
          }
        });
      } else {
        console.log(
          "[fetchStudentAssessments] Response is FLAT array - using directly",
        );
        assessments = rawCombined.map((a: any) => {
          // Calculate fallback status if missing
          let status = a.status;
          if (!status) {
            const now = new Date();
            const startsAt = a.startsAt ? new Date(a.startsAt) : null;
            const endsAt = a.endsAt ? new Date(a.endsAt) : null;
            if (endsAt && now > endsAt) {
              status = "ended";
            } else if (startsAt && now >= startsAt) {
              status = "started";
            } else {
              status = "not_started";
            }
          }

          return {
            ...a,
            isPublished: true,
            isOnline: a.isOnline ?? a.assessmentType === "online",
            status,
          };
        });
      }

      console.log(
        `[fetchStudentAssessments] Final flattened count: ${assessments.length} assessments`,
      );
      return assessments;
    } catch (error: any) {
      console.error(
        `[fetchStudentAssessments] Error:`,
        error.response?.data || error.message,
      );
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          "Failed to fetch assessments",
      );
    }
  },
);

// Fetch details for a specific assessment (Lobby/Exam)
export const fetchAssessmentDetails = createAsyncThunk(
  "student/fetchDetails",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(
        `/api/proxy/assessments/details/${id}`,
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch assessment details",
      );
    }
  },
);

// Start an assessment session
export const startAssessment = createAsyncThunk(
  "student/startAssessment",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy/assessments/${id}/start`,
        {
          deviceMeta: {
            userAgent: window.navigator.userAgent,
            platform: window.navigator.platform,
          },
        },
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(error.message || "Failed to start assessment");
    }
  },
);

// Submit assessment answers
export const submitAssessment = createAsyncThunk(
  "student/submitAssessment",
  async (
    { assessmentId, data }: { assessmentId: string; data: any },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiClient.post(
        `/api/proxy/assessments/${assessmentId}/submissions`,
        data,
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(error.message || "Failed to submit assessment");
    }
  },
);

// Sync offline submissions
export const syncOfflineSubmissions = createAsyncThunk(
  "student/syncOfflineSubmissions",
  async (submissions: any[], { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy/assessments/offline-submissions/sync`,
        {
          submissions,
        },
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(
        error.message || "Failed to sync offline submissions",
      );
    }
  },
);

// Fetch consolidated student dashboard overview
export const fetchStudentDashboardOverview = createAsyncThunk(
  "student/fetchDashboardOverview",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get("/api/proxy/student/dashboard-overview");
      return response.data?.data || response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.message || error?.message || "Failed to fetch student dashboard overview",
      );
    }
  },
);
