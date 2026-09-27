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

const EXAM_DEVICE_ID_KEY = "paralearn_exam_device_id";

const getExamDeviceId = () => {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(EXAM_DEVICE_ID_KEY);
    if (existing) return existing;

    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.localStorage.setItem(EXAM_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `volatile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

export const buildExamDeviceMeta = () => ({
  deviceId: getExamDeviceId(),
  userAgent: window.navigator.userAgent,
  platform: window.navigator.platform,
  language: window.navigator.language,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

// Fetch all available assessments for the student (K-12 System)
// Uses the optimized student/published endpoint (returns all statuses in one call)
// The backend filters to PUBLISHED assessments only (role-based authorization)
export const fetchStudentAssessments = createAsyncThunk(
  "student/fetchAssessments",
  async (_, { rejectWithValue }) => {
    try {
      const res = await apiClient.get("/api/proxy/assessments/student/published");
      const rawData = res.data?.data || res.data || [];
      const rawCombined = Array.isArray(rawData) ? rawData : [];

      const getStatus = (assessment: any) => {
        const submitted = assessment?.submissions?.some(
          (submission: any) =>
            ["submitted", "graded"].includes(submission.status) &&
            !!submission.finishedAt,
        );
        if (submitted || assessment?.status === "submitted") return "submitted";
        if (assessment?.status) return assessment.status;

        const now = new Date();
        const startsAt = assessment?.startsAt ? new Date(assessment.startsAt) : null;
        const endsAt = assessment?.endsAt ? new Date(assessment.endsAt) : null;
        if (endsAt && now > endsAt) return "ended";
        if (!startsAt || now >= startsAt) return "started";
        return "not_started";
      };

      const normalize = (assessment: any, group?: any) => {
        const classSubjects = Array.isArray(assessment.classSubjects)
          ? assessment.classSubjects
          : [];
        const firstClassSubject =
          classSubjects[0]?.classSubject || classSubjects[0];

        return {
          ...assessment,
          classId:
            assessment.classId ||
            group?.class?.id ||
            assessment.class?.id ||
            firstClassSubject?.classId ||
            firstClassSubject?.class?.id,
          subjectId:
            assessment.subjectId ||
            group?.id ||
            group?.subjectId ||
            assessment.subject?.id ||
            firstClassSubject?.subjectId ||
            firstClassSubject?.subject?.id,
          subject: assessment.subject ||
            firstClassSubject?.subject || {
              id: group?.id || group?.subjectId,
              name: group?.name || "Unknown Subject",
              code: group?.code,
            },
          class:
            assessment.class ||
            firstClassSubject?.class ||
            group?.class ||
            assessment.subject?.class,
          isPublished: true,
          isOnline:
            assessment.isOnline ??
            (assessment.assessmentType === "online" ||
              assessment.assessmentType === "cbt"),
          durationMins:
            assessment.durationMins ??
            assessment.duration ??
            assessment.durationMinutes ??
            0,
          questionCount:
            assessment.questionCount ??
            assessment.questionsCount ??
            assessment._count?.questions ??
            0,
          status: getStatus(assessment),
        };
      };

      // Handle grouped response structure (grouped by subject)
      // Teacher endpoint returns: [ { name: "Subject", class: {...}, assessments: [...] }, ... ]
      let assessments: any[] = [];
      const isGrouped = rawCombined.some(
        (item: any) => item.assessments && Array.isArray(item.assessments),
      );

      if (isGrouped) {
        rawCombined.forEach((group: any) => {
          if (group.assessments && Array.isArray(group.assessments)) {
            group.assessments.forEach((assess: any) => {
              assessments.push(normalize(assess, group));
            });
          }
        });
      } else {
        assessments = rawCombined.map((a: any) => normalize(a));
      }

      return assessments;
    } catch (error: any) {
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
          deviceMeta: buildExamDeviceMeta(),
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
