import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Teacher Portal — consolidated context, grading queue, and class sheet
// ---------------------------------------------------------------------------
const teacherPortalApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/teacher/assigned-context
    // Returns class teacher roles, subject assignments, active academic session/term,
    // and total student counts in one ultra-fast response
    getTeacherAssignedContext: builder.query<any, void>({
      query: () => ({ url: "/api/proxy/teacher/assigned-context" }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "TeacherContext" as const }],
    }),

    // GET /api/proxy/teacher/grading-queue?assessmentId=...
    // Returns pending/ungraded assessment submissions for the teacher
    getTeacherGradingQueue: builder.query<
      any[],
      { assessmentId?: string } | void
    >({
      query: (params) => {
        const q = params && params.assessmentId
          ? `?assessmentId=${encodeURIComponent(params.assessmentId)}`
          : "";
        return { url: `/api/proxy/teacher/grading-queue${q}` };
      },
      transformResponse: (res: any) => {
        const data = res?.data ?? res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: [{ type: "GradingQueue" as const }],
    }),

    // GET /api/proxy/teacher/reports/class-sheet?classId=...&session=...&term=...
    // Pre-loads student psychomotor ratings and remarks for the entire class
    getTeacherClassSheet: builder.query<
      any,
      { classId: string; session: string; term: string }
    >({
      query: ({ classId, session, term }) => {
        const q = new URLSearchParams({ classId, session, term });
        return { url: `/api/proxy/teacher/reports/class-sheet?${q.toString()}` };
      },
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_r, _e, { classId }) => [
        { type: "TeacherClassSheet" as const, id: classId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTeacherAssignedContextQuery,
  useGetTeacherGradingQueueQuery,
  useGetTeacherClassSheetQuery,
} = teacherPortalApi;
