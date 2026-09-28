import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Assessments endpoints
// ---------------------------------------------------------------------------
const assessmentsApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/assessments/:status
    getAssessmentsByStatus: builder.query<any[], string>({
      query: (status) => ({ url: `/api/proxy/assessments/${status}` }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((a: any) => ({
                type: "Assessment" as const,
                id: a.id,
              })),
              { type: "AssessmentList" as const },
            ]
          : [{ type: "AssessmentList" as const }],
    }),

    // GET /api/proxy/assessments — paginated with server-side filters
    getAssessmentsPaginated: builder.query<
      {
        data: any[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasNextPage: boolean;
          hasPrevPage: boolean;
        };
      },
      {
        classId?: string;
        subjectId?: string;
        term?: string;
        session?: string;
        type?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params && params.classId) q.set("classId", params.classId);
        if (params && params.subjectId) q.set("subjectId", params.subjectId);
        if (params && params.term) q.set("term", params.term);
        if (params && params.session) q.set("session", params.session);
        if (params && params.type) q.set("type", params.type);
        if (params && params.page) q.set("page", String(params.page));
        if (params && params.limit) q.set("limit", String(params.limit));
        const qs = q.toString();
        return { url: `/api/proxy/assessments${qs ? `?${qs}` : ""}` };
      },
      transformResponse: (res: any) => {
        if (res && Array.isArray(res.data) && res.pagination) return res;
        const data = Array.isArray(res) ? res : [];
        return {
          data,
          pagination: { total: data.length, page: 1, limit: data.length, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((a: any) => ({ type: "Assessment" as const, id: a.id })),
              { type: "AssessmentList" as const },
            ]
          : [{ type: "AssessmentList" as const }],
    }),

    // GET /api/proxy/assessments/details/:id (updated to avoid :status collision)
    getAssessmentById: builder.query<any, string>({
      query: (id) => ({ url: `/api/proxy/assessments/details/${id}` }),
      providesTags: (_r, _e, id) => [{ type: "Assessment", id }],
    }),

    // GET /api/proxy/assessments/:id/submissions
    getAssessmentSubmissions: builder.query<any[], string>({
      query: (assessmentId) => ({
        url: `/api/proxy/assessments/${assessmentId}/submissions`,
      }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (_r, _e, id) => [{ type: "Assessment", id: `subs-${id}` }],
    }),

    // GET /api/proxy/assessment-categories
    getAssessmentCategories: builder.query<any[], void>({
      query: () => ({ url: "/api/proxy/assessment-categories" }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((c: any) => ({
                type: "AssessmentCategory" as const,
                id: c.id,
              })),
              { type: "AssessmentCategory" as const, id: "LIST" },
            ]
          : [{ type: "AssessmentCategory" as const, id: "LIST" }],
    }),

    // POST /api/proxy/assessments
    createAssessment: builder.mutation<any, any>({
      query: (body) => ({
        url: "/api/proxy/assessments",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "AssessmentList" }],
    }),

    // PATCH /api/proxy/assessments/:id
    updateAssessment: builder.mutation<
      any,
      { assessmentId: string; data: any }
    >({
      query: ({ assessmentId, data }) => ({
        url: `/api/proxy/assessments/${assessmentId}`,
        method: "PATCH",
        data,
      }),
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "Assessment", id: assessmentId },
        { type: "AssessmentList" },
      ],
    }),

    // POST /api/proxy/assessments/:id/publish
    publishAssessment: builder.mutation<
      any,
      { assessmentId: string; publish: boolean }
    >({
      query: ({ assessmentId, publish }) => ({
        url: `/api/proxy/assessments/${assessmentId}/publish`,
        method: "POST",
        data: { publish },
      }),
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "Assessment", id: assessmentId },
        { type: "AssessmentList" },
      ],
    }),

    // POST /api/proxy/assessments/:id/questions/bulk
    bulkUploadQuestions: builder.mutation<
      any,
      { assessmentId: string; file: File }
    >({
      query: ({ assessmentId, file }) => {
        const form = new FormData();
        form.append("file", file);
        return {
          url: `/api/proxy/assessments/${assessmentId}/questions/bulk`,
          method: "POST",
          data: form,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "Assessment", id: assessmentId },
      ],
    }),

    // POST /api/proxy/assessment-categories
    createAssessmentCategory: builder.mutation<
      any,
      { name: string; code: string; weight: number; description?: string }
    >({
      query: (body) => ({
        url: "/api/proxy/assessment-categories",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "AssessmentCategory", id: "LIST" }],
    }),

    // DELETE /api/proxy/assessment-categories/:id
    deleteAssessmentCategory: builder.mutation<string, string>({
      query: (id) => ({
        url: `/api/proxy/assessment-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "AssessmentCategory", id: "LIST" }],
    }),

    // POST /api/proxy/assessments/submissions/:sid/answers/:aid/grade
    gradeAnswer: builder.mutation<
      any,
      { submissionId: string; answerId: string; marksAwarded: number; comment?: string }
    >({
      query: ({ submissionId, answerId, ...body }) => ({
        url: `/api/proxy/assessments/submissions/${submissionId}/answers/${answerId}/grade`,
        method: "POST",
        data: body,
      }),
    }),

    // POST /api/proxy/assessments/:id/class-subjects ⭐ NEW — link assessment to ClassSubject
    linkAssessmentToClassSubject: builder.mutation<any, { assessmentId: string; classSubjectId: string }>({
      query: ({ assessmentId, classSubjectId }) => ({
        url: `/api/proxy/assessments/${assessmentId}/class-subjects`,
        method: "POST",
        data: { classSubjectId },
      }),
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "Assessment" as const, id: assessmentId },
      ],
    }),

    // DELETE /api/proxy/assessments/:id/class-subjects/:classSubjectId ⭐ NEW — unlink
    unlinkAssessmentFromClassSubject: builder.mutation<
      any,
      { assessmentId: string; classSubjectId: string }
    >({
      query: ({ assessmentId, classSubjectId }) => ({
        url: `/api/proxy/assessments/${assessmentId}/class-subjects/${classSubjectId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "Assessment" as const, id: assessmentId },
      ],
    }),

    // GET /api/proxy/assessments/:id/class-subjects ⭐ NEW — list class-subject links
    getAssessmentClassSubjects: builder.query<any[], string>({
      query: (assessmentId) => ({
        url: `/api/proxy/assessments/${assessmentId}/class-subjects`,
      }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: (_r, _e, id) => [{ type: "Assessment" as const, id: `cs-${id}` }],
    }),

    // DELETE /api/proxy/assessments/:id
    deleteAssessment: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/proxy/assessments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Assessment", id },
        { type: "AssessmentList" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAssessmentsByStatusQuery,
  useGetAssessmentsPaginatedQuery,
  useGetAssessmentByIdQuery,
  useGetAssessmentSubmissionsQuery,
  useGetAssessmentCategoriesQuery,
  useCreateAssessmentMutation,
  useUpdateAssessmentMutation,
  usePublishAssessmentMutation,
  useBulkUploadQuestionsMutation,
  useCreateAssessmentCategoryMutation,
  useDeleteAssessmentCategoryMutation,
  useGradeAnswerMutation,
  useLinkAssessmentToClassSubjectMutation,
  useUnlinkAssessmentFromClassSubjectMutation,
  useGetAssessmentClassSubjectsQuery,
  useDeleteAssessmentMutation,
} = assessmentsApi;
