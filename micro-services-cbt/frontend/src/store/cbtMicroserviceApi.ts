import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type CbtQuestionType = "MCQ" | "TRUE_FALSE" | "MULTI_SELECT" | "ESSAY" | "SHORT_ESSAY" | "LONG_ESSAY";

export interface CbtQuestion {
  id: string;
  prompt: string;
  type: CbtQuestionType;
  marks: number;
  section?: string;
  options?: Array<{
    id: string;
    text: string;
    keyLabel?: string;
  }>;
  explanation?: string;
}

export interface CbtExamDetail extends CbtExamItem {
  workspace?: {
    id: string;
    name: string;
    type?: string;
  };
  questions?: Array<{
    id: string;
    examId: string;
    questionId: string;
    orderIndex: number;
    question: CbtQuestion & {
      options?: Array<{
        id: string;
        text: string;
        keyLabel?: string;
        isCorrect?: boolean;
      }>;
      explanation?: string;
    };
  }>;
}

export interface ExaminerWorkspace {
  id: string;
  name: string;
  type: "INSTITUTION" | "STANDALONE_HALL" | string;
  ownerName?: string;
  ownerEmail: string;
  credits: number;
  apiKey?: string;
  webhookUrl?: string;
  createdAt?: string;
  _count?: {
    exams: number;
    questions: number;
  };
}

export interface CbtExamItem {
  id: string;
  workspaceId?: string;
  title: string;
  accessCode: string;
  durationMins: number;
  totalMarks?: number;
  totalQuestions?: number;
  isPublished?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxTabViolations?: number;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  showResultAfter?: boolean;
  createdAt?: string;
  _count?: {
    questions?: number;
    attempts?: number;
  };
}

export interface PublicExamLobby {
  id: string;
  accessCode: string;
  title: string;
  instructions?: string;
  accessType?: "ROSTER_ONLY" | "PUBLIC_LINK" | "ACCESS_CODE";
  durationMins: number;
  totalQuestions: number;
  totalMarks: number;
  maxTabViolations: number;
  workspaceName: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface StartAttemptRequest {
  accessCode: string;
  candidatePin?: string;
  candidateName: string;
  email?: string;
  phone?: string;
  studentId?: string;
  externalAttemptId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface StartAttemptResponse {
  isResumed: boolean;
  attemptId: string;
  externalAttemptId?: string | null;
  studentId?: string | null;
  examId: string;
  examTitle: string;
  candidateName: string;
  candidatePin: string;
  durationMins: number;
  deadline: string;
  remainingSeconds: number;
  violations: number;
  maxTabViolations: number;
  questions: CbtQuestion[];
  restoredAnswers: Record<string, any>;
}

export interface CandidateRecord {
  id: string;
  examId: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string | null;
  externalAttemptId?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "REGISTERED" | "STARTED" | "SUBMITTED" | "DISQUALIFIED";
  score?: number;
  totalMarks?: number;
  percentage?: number;
  launchUrl?: string;
  accessCode?: string;
  metadata?: Record<string, any> | null;
  createdAt?: string;
}

export interface AttemptReviewQuestion {
  id: string;
  prompt: string;
  type: CbtQuestionType;
  marks: number;
  options?: Array<{
    id: string;
    text: string;
    keyLabel?: string;
    isCorrect?: boolean;
  }>;
  explanation?: string;
  orderIndex?: number;
  answer?: string | string[] | Record<string, any> | null;
  marksAwarded?: number;
  isCorrect?: boolean | null;
}

export interface AttemptReviewPayload {
  attemptId: string;
  examId: string;
  examTitle: string;
  accessCode: string;
  institutionName?: string;
  candidateName: string;
  candidatePin: string;
  studentId?: string | null;
  status: "IN_PROGRESS" | "SUBMITTED" | "DISQUALIFIED";
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  violations: number;
  submittedAt?: string | null;
  questions: AttemptReviewQuestion[];
}

export const getCbtBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    // In any browser, relative URL `/api/cbt` always routes to Next.js API route on the same origin
    return "/api/cbt";
  }
  const envUrl = process.env.NEXT_PUBLIC_CBT_API_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/+$/, "");
  }
  return "http://localhost:3000/api/cbt";
};

export const CBT_MICROSERVICE_BASE_URL = getCbtBaseUrl();

const dynamicCbtBaseQuery = async (args: any, api: any, extraOptions: any) => {
  const baseUrl = getCbtBaseUrl();
  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      headers.set("Accept", "application/json");
      return headers;
    },
  });
  return rawBaseQuery(args, api, extraOptions);
};


export interface ImportableClassItem {
  id: string;
  name: string;
  code: string | null;
  level: number | null;
  stream: string | null;
  activeStudents: number;
}

export interface FetchImportableClassesResponse {
  success: boolean;
  user: { id: string; name: string; email: string };
  accessTier: "ADMIN" | "TEACHER";
  classes: ImportableClassItem[];
  totalClasses: number;
  totalAvailableStudents: number;
}

export interface ImportCandidatesResponse {
  success: boolean;
  imported: number;
  newlyCreated: number;
  updated: number;
  examId: string;
  examTitle: string;
  classesImported: string[];
  message: string;
  candidates: Array<{
    id: string;
    candidateName: string;
    candidatePin: string;
    studentId: string | null;
    email: string | null;
  }>;
}

export const cbtMicroserviceApi = createApi({
  reducerPath: "cbtMicroserviceApi",
  baseQuery: dynamicCbtBaseQuery,
  tagTypes: ["CbtWorkspace", "CbtExam", "CbtQuestion", "CbtCandidate", "CbtAttempt", "CbtMonitor"],
  endpoints: (builder) => ({
    examinerLogin: builder.mutation<ExaminerWorkspace, { email: string; password?: string }>({
      query: (body) => ({
        url: "/workspaces/login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtWorkspace"],
    }),

    registerStandaloneWorkspace: builder.mutation<
      ExaminerWorkspace,
      { name: string; ownerName: string; email: string; webhookUrl?: string }
    >({
      query: (body) => ({
        url: "/workspaces/standalone",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtWorkspace"],
    }),

    listWorkspaceExams: builder.query<CbtExamItem[], string>({
      query: (workspaceId) => ({
        url: "/exams",
        params: { workspaceId },
      }),
      providesTags: ["CbtExam"],
    }),

    createCbtExam: builder.mutation<CbtExamItem, Partial<CbtExamItem> & { workspaceId: string; title: string }>({
      query: (body) => ({
        url: "/exams",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtExam", "CbtWorkspace"],
    }),

    getCbtExam: builder.query<CbtExamDetail, string>({
      query: (examId) => `/exams/${encodeURIComponent(examId)}`,
      providesTags: (_result, _error, examId) => [{ type: "CbtExam", id: examId }],
    }),

    updateCbtExam: builder.mutation<CbtExamItem, Partial<CbtExamItem> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/exams/${encodeURIComponent(id)}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: "CbtExam", id: arg.id }, "CbtExam"],
    }),

    createQuestion: builder.mutation<CbtQuestion, Omit<CbtQuestion, "id"> & { workspaceId: string; type: CbtQuestionType }>({
      query: (body) => ({
        url: "/questions",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtQuestion", "CbtExam"],
    }),

    updateQuestion: builder.mutation<Partial<CbtQuestion>, Partial<CbtQuestion> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/questions/${encodeURIComponent(id)}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["CbtQuestion", "CbtExam"],
    }),

    bulkCreateQuestions: builder.mutation<
      { count: number; questions: CbtQuestion[] },
      { workspaceId: string; examId?: string; questions: Array<Omit<CbtQuestion, "id"> & { workspaceId: string; type: CbtQuestionType }> }
    >({
      query: (body) => ({
        url: "/questions/bulk",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtQuestion", "CbtExam"],
    }),

    attachQuestions: builder.mutation<CbtExamItem, { examId: string; questionIds: string[] }>({
      query: ({ examId, questionIds }) => ({
        url: `/exams/${encodeURIComponent(examId)}/questions`,
        method: "POST",
        body: { questionIds },
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: "CbtExam", id: arg.examId }, "CbtExam"],
    }),

    getExamByCode: builder.query<PublicExamLobby, string>({
      query: (accessCode) => `/exams/code/${encodeURIComponent(accessCode)}`,
      providesTags: (_result, _error, accessCode) => [{ type: "CbtExam", id: accessCode }],
    }),

    startAttempt: builder.mutation<StartAttemptResponse, StartAttemptRequest>({
      query: (body) => ({
        url: "/attempts/start",
        method: "POST",
        body,
      }),
      invalidatesTags: ["CbtAttempt", "CbtMonitor", "CbtCandidate"],
    }),

    bufferAnswer: builder.mutation<boolean, { attemptId: string; questionId: string; selectedVal: any }>({
      query: ({ attemptId, questionId, selectedVal }) => ({
        url: `/attempts/${attemptId}/answer`,
        method: "POST",
        body: { questionId, selectedVal },
      }),
      transformResponse: () => true,
    }),

    recordTelemetry: builder.mutation<
      { disqualified: boolean; violations: number; remainingViolations?: number; message?: string },
      { attemptId: string; eventType: string; questionIdx?: number }
    >({
      query: ({ attemptId, eventType, questionIdx }) => ({
        url: `/attempts/${attemptId}/telemetry`,
        method: "POST",
        body: { eventType, questionIdx, timestamp: new Date().toISOString() },
      }),
      invalidatesTags: ["CbtAttempt", "CbtMonitor", "CbtCandidate"],
    }),

    submitAttempt: builder.mutation<any, { attemptId: string; finalAnswers?: Record<string, any>; autoSubmitted?: boolean }>({
      query: ({ attemptId, finalAnswers, autoSubmitted }) => ({
        url: `/attempts/${attemptId}/submit`,
        method: "POST",
        body: { finalAnswers, autoSubmitted },
      }),
      invalidatesTags: ["CbtAttempt", "CbtMonitor", "CbtCandidate"],
    }),

    getResultSlip: builder.query<any, string>({
      query: (attemptId) => `/attempts/${attemptId}/slip`,
      providesTags: (_result, _error, attemptId) => [{ type: "CbtAttempt", id: attemptId }],
    }),

    getAttemptReview: builder.query<AttemptReviewPayload, string>({
      query: (attemptId) => `/attempts/${attemptId}/review`,
      providesTags: (_result, _error, attemptId) => [{ type: "CbtAttempt", id: attemptId }],
    }),

    manualGradeAttempt: builder.mutation<
      AttemptReviewPayload,
      { attemptId: string; answers: Array<{ questionId: string; marksAwarded: number; feedback?: string }> }
    >({
      query: ({ attemptId, answers }) => ({
        url: `/attempts/${attemptId}/manual-grade`,
        method: "POST",
        body: { answers },
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "CbtAttempt", id: arg.attemptId },
        "CbtMonitor",
        "CbtCandidate",
      ],
    }),

    getLiveMonitor: builder.query<any, string>({
      query: (examId) => `/exams/${examId}/monitor`,
      providesTags: (_result, _error, examId) => [{ type: "CbtMonitor", id: examId }],
    }),

    listCandidates: builder.query<CandidateRecord[], { examId: string; search?: string }>({
      query: ({ examId, search }) => ({
        url: "/candidates",
        params: { examId, ...(search ? { search } : {}) },
      }),
      providesTags: (_result, _error, arg) => [{ type: "CbtCandidate", id: arg.examId }],
    }),

    upsertCandidate: builder.mutation<
      CandidateRecord,
      {
        examId: string;
        candidateName: string;
        candidatePin: string;
        studentId?: string;
        email?: string;
        phone?: string;
        metadata?: Record<string, any>;
      }
    >({
      query: (body) => ({
        url: "/candidates",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [{ type: "CbtCandidate", id: arg.examId }, "CbtMonitor"],
    }),

    
    fetchImportableClasses: builder.mutation<
      FetchImportableClassesResponse,
      { workspaceId: string; email: string }
    >({
      query: (body) => ({
        url: "/import/classes",
        method: "POST",
        body,
      }),
    }),

    importCandidatesFromParalearn: builder.mutation<
      ImportCandidatesResponse,
      {
        workspaceId: string;
        examId: string;
        examTitle?: string;
        email: string;
        classIds: string[];
        autoGeneratePin?: boolean;
      }
    >({
      query: (body) => ({
        url: "/import/candidates",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: "CbtCandidate", id: arg.examId },
        "CbtMonitor",
      ],
    }),

    deleteCandidate: builder.mutation<CandidateRecord, { id: string; examId?: string }>({
      query: ({ id }) => ({
        url: `/candidates/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, arg) => [
        ...(arg.examId ? [{ type: "CbtCandidate" as const, id: arg.examId }] : []),
        "CbtMonitor",
      ],
    }),
  }),
});

export const {
  useExaminerLoginMutation,
  useRegisterStandaloneWorkspaceMutation,
  useListWorkspaceExamsQuery,
  useCreateCbtExamMutation,
  useGetCbtExamQuery,
  useUpdateCbtExamMutation,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useBulkCreateQuestionsMutation,
  useAttachQuestionsMutation,
  useGetExamByCodeQuery,
  useStartAttemptMutation,
  useBufferAnswerMutation,
  useRecordTelemetryMutation,
  useSubmitAttemptMutation,
  useGetResultSlipQuery,
  useLazyGetAttemptReviewQuery,
  useManualGradeAttemptMutation,
  useGetLiveMonitorQuery,
  useListCandidatesQuery,
  useUpsertCandidateMutation,
  useDeleteCandidateMutation,
  useFetchImportableClassesMutation,
  useImportCandidatesFromParalearnMutation,
} = cbtMicroserviceApi;
