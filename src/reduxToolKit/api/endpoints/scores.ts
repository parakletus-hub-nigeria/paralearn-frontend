import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Scores endpoints
// ---------------------------------------------------------------------------
const scoresApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/scores/assessment/:assessmentId
    getScoresByAssessment: builder.query<any[], string>({
      query: (assessmentId) => ({
        url: `/api/proxy/scores/assessment/${assessmentId}`,
      }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (_r, _e, id) => [
        { type: "ScoreList", id },
      ],
    }),

    // POST /api/proxy/assessments/:id/scores
    submitScores: builder.mutation<
      any,
      { assessmentId: string; scores: any[] }
    >({
      query: ({ assessmentId, ...body }) => ({
        url: `/api/proxy/assessments/${assessmentId}/scores`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "ScoreList", id: assessmentId },
      ],
    }),

    // POST /api/proxy/scores/bulk?assessmentId=...
    bulkUploadScores: builder.mutation<
      any,
      { assessmentId: string; file: File }
    >({
      query: ({ assessmentId, file }) => {
        const form = new FormData();
        form.append("file", file);
        return {
          url: `/api/proxy/scores/bulk?assessmentId=${encodeURIComponent(assessmentId)}`,
          method: "POST",
          data: form,
          headers: { "Content-Type": "multipart/form-data" },
        };
      },
      invalidatesTags: (_r, _e, { assessmentId }) => [
        { type: "ScoreList", id: assessmentId },
      ],
    }),

    // ── Student-facing endpoints (isPublished: true filter applied server-side) ──

    // GET /api/proxy/scores/my?session=&term=&subjectId=
    getMyScores: builder.query<
      any[],
      { session?: string; term?: string; subjectId?: string }
    >({
      query: ({ session, term, subjectId } = {}) => {
        const q = new URLSearchParams();
        if (session) q.set("session", session);
        if (term) q.set("term", term);
        if (subjectId) q.set("subjectId", subjectId);
        return { url: `/api/proxy/scores/my?${q.toString()}` };
      },
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: [{ type: "ScoreList", id: "MY" }],
    }),

    // GET /api/proxy/scores/my/assessment/:id
    getMyScoreForAssessment: builder.query<any, string>({
      query: (assessmentId) => ({
        url: `/api/proxy/scores/my/assessment/${assessmentId}`,
      }),
      providesTags: (_r, _e, id) => [{ type: "ScoreList", id: `MY_${id}` }],
    }),

    // GET /api/proxy/scores/my/result?session=&term=
    // Full term result for the logged-in student — all subjects, percentages, breakdown by assessment type
    getMyTermResult: builder.query<
      any,
      { session: string; term: string }
    >({
      query: ({ session, term }) => ({
        url: `/api/proxy/scores/my/result?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      }),
      providesTags: (_r, _e, { session, term }) => [
        { type: "ScoreList", id: `MY_RESULT_${session}_${term}` },
      ],
    }),

    // GET /api/proxy/scores/student/:id/result?session=&term=
    // Teacher/admin view of a student's full term result
    getStudentTermResult: builder.query<
      any,
      { studentId: string; session: string; term: string }
    >({
      query: ({ studentId, session, term }) => ({
        url: `/api/proxy/scores/student/${studentId}/result?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      }),
      providesTags: (_r, _e, { studentId }) => [
        { type: "ScoreList", id: `RESULT_${studentId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetScoresByAssessmentQuery,
  useSubmitScoresMutation,
  useBulkUploadScoresMutation,
  useGetMyScoresQuery,
  useGetMyScoreForAssessmentQuery,
  useGetMyTermResultQuery,
  useGetStudentTermResultQuery,
} = scoresApi;
