import { createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "@/lib/api";
import { routespath } from "@/lib/routepath";

// Types for academic sessions
export interface TermInput {
  term: string;
  startsAt: string;
  endsAt: string;
}

export interface CreateSessionInput {
  session: string;
  startsAt: string;
  endsAt: string;
  terms: TermInput[];
}

export interface Term {
  id: string;
  sessionId: string;
  term: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt?: string;
}

export interface AcademicSession {
  id: string;
  schoolId: string;
  session: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  terms: Term[];
  createdAt?: string;
}

export interface CurrentSessionResponse {
  session: string;
  term: string;
  sessionDetails: AcademicSession;
  termDetails: Term;
}

// Create Academic Session Terms
export const createAcademicSession = createAsyncThunk(
  "setUp/createAcademicSession",
  async (data: CreateSessionInput, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy${routespath.API_CREATE_ACADEMIC_SESSION}`,
        data
      );

      // Check if backend returned success: false with a message
      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to create academic session";
        console.error("[Create Academic Session Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      // If success is true or undefined, proceed normally
      if (!response.data?.success && response.data?.data) {
        // Some APIs might return data even if success is not explicitly true
        return response.data.data;
      }

      return response.data.data;
    } catch (error: any) {
      // Handle actual HTTP errors (4xx, 5xx)
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create academic session";

      console.error("[Create Academic Session Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Get All Academic Sessions
export const fetchAllSessions = createAsyncThunk(
  "setUp/fetchAllSessions",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/api/proxy${routespath.API_GET_ALL_SESSIONS}`);

      // Check if backend returned success: false with a message
      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to fetch sessions";
        console.error("[Fetch All Sessions Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data || [];
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch academic sessions";

      console.error("[Fetch All Sessions Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Get Current Active Session & Term
export const fetchCurrentSession = createAsyncThunk(
  "setUp/fetchCurrentSession",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/api/proxy${routespath.API_GET_CURRENT_SESSION}`);

      // Check if backend returned success: false with a message
      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to fetch current session";
        console.error("[Fetch Current Session Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch current session";

      console.error("[Fetch Current Session Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Update Current Academic Session
export interface UpdateSessionInput {
  id: string;
  session: string;
  startsAt: string;
  endsAt: string;
  terms: {
    id?: string;
    term: string;
    startsAt: string;
    endsAt: string;
  }[];
}

export const updateCurrentSession = createAsyncThunk(
  "setUp/updateCurrentSession",
  async (data: UpdateSessionInput, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy${routespath.API_UPDATE_CURRENT_SESSION}`,
        data
      );

      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to update academic session";
        console.error("[Update Academic Session Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update academic session";

      console.error("[Update Academic Session Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Activate Term
export const activateTerm = createAsyncThunk(
  "setUp/activateTerm",
  async (
    { sessionId, termId }: { sessionId: string; termId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.post(
        `/api/proxy${routespath.API_CREATE_ACADEMIC_SESSION}/${sessionId}/terms/${termId}/activate`
      );

      // Check if backend returned success: false with a message
      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to activate term";
        console.error("[Activate Term Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to activate term";

      console.error("[Activate Term Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Create Class
export interface CreateClassInput {
  name: string;
  level: number;
  stream: string;
  capacity: number;
}

export interface CreateClassResponse {
  id: string;
  name: string;
  level: number;
  stream: string;
  capacity: number;
  studentCount: number;
}

export const createClass = createAsyncThunk(
  "setUp/createClass",
  async (data: CreateClassInput, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy${routespath.API_CREATE_CLASS}`,
        data
      );

      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to create class";
        console.error("[Create Class Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data as CreateClassResponse;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create class";

      console.error("[Create Class Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Create Subject
export interface CreateSubjectInput {
  name: string;
  code: string;
  classId?: string;
  description?: string;
}

export interface CreateSubjectResponse {
  id: string;
  name: string;
  code: string;
  classId?: string | null;
  description?: string;
}

export const createSubject = createAsyncThunk(
  "setUp/createSubject",
  async (data: CreateSubjectInput, { rejectWithValue }) => {
    try {
      const response = await apiClient.post(
        `/api/proxy${routespath.API_CREATE_SUBJECT}`,
        data
      );

      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to create subject";
        console.error("[Create Subject Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data as CreateSubjectResponse;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to create subject";

      console.error("[Create Subject Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Assign Subject to Class
export interface AssignSubjectToClassInput {
  subjectId: string;
  classId: string;
  subjectType?: string;
  difficulty?: string;
  description?: string;
}

export const assignSubjectToClass = createAsyncThunk(
  "setUp/assignSubjectToClass",
  async (data: AssignSubjectToClassInput, { rejectWithValue }) => {
    try {
      const { subjectId, ...body } = data;
      const response = await apiClient.post(
        `/api/proxy/subjects/${subjectId}/classes`,
        body
      );

      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to assign subject to class";
        console.error("[Assign Subject Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to assign subject to class";

      console.error("[Assign Subject Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Update Grading Scale
export interface GradeBoundary {
  letter?: string;
  grade?: string;
  min: number;
  max: number;
  description: string;
}

export interface UpdateGradingScaleInput {
  gradeBoundaries: GradeBoundary[];
}

export interface UpdateGradingScaleResponse {
  gradeBoundaries: GradeBoundary[];
}

export const updateGradingScale = createAsyncThunk(
  "setUp/updateGradingScale",
  async (data: UpdateGradingScaleInput, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(
        `/api/proxy${routespath.API_UPDATE_GRADING_SCALE}`,
        data
      );

      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to update grading scale";
        console.error("[Update Grading Scale Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data as UpdateGradingScaleResponse;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to update grading scale";

      console.error("[Update Grading Scale Error]", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Consolidated Onboarding Setup - Creates session, classes, subjects, and grading scale in one call
export interface OnboardingSetupInput {
  currentSession: string;
  currentTerm: string;
  session: {
    session: string;
    startsAt: string;
    endsAt: string;
    terms: Array<{
      term: string;
      startsAt: string;
      endsAt: string;
    }>;
  };
  classes: Array<{
    localId?: string;
    name: string;
    level: number;
    stream: string;
    capacity: number;
  }>;
  subjects: Array<{
    name: string;
    code: string;
    classId?: string;
    classIds?: string[];
    description?: string;
  }>;
  gradingSystem?: string;
  gradeBoundaries: GradeBoundary[];
  settings?: Record<string, unknown>;
  selectedReportCardTemplateIds?: string[];
}

export interface OnboardingSetupResponse {
  sessionId: string;
  termIds: string[];
  classIds: string[];
  subjectIds: string[];
  gradingScaleId: string;
}

export const onboardingSetup = createAsyncThunk(
  "setUp/onboardingSetup",
  async (data: OnboardingSetupInput, { rejectWithValue }) => {
    const endpoint = `/api/proxy${routespath.API_ONBOARDING_SETUP}`;
    
    try {
      // Log removed
      const response = await apiClient.post(endpoint, data);

      // Check if backend returned success: false with a message
      if (response.data?.success === false) {
        const errorMessage = response.data?.message || "Failed to complete onboarding setup";
        console.error("[Onboarding Setup Error]", errorMessage);
        return rejectWithValue(errorMessage);
      }

      return response.data.data as OnboardingSetupResponse;
    } catch (error: any) {
      // Enhanced error logging
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to complete onboarding setup";

      console.error("[Onboarding Setup Error]", {
        message: errorMessage,
        endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
      });

      // Provide more helpful error message for 404
      if (error.response?.status === 404) {
        return rejectWithValue(
          `Endpoint not found: ${endpoint}. Please verify the backend endpoint exists at /onboarding/setup`
        );
      }

      return rejectWithValue(errorMessage);
    }
  }
);
