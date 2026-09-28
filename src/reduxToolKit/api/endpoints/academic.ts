import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Academic Sessions & Terms endpoints
// ---------------------------------------------------------------------------
const academicApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/academic/sessions
    getAllSessions: builder.query<any[], void>({
      query: () => ({ url: "/api/proxy/academic/sessions" }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((s: any) => ({
                type: "Session" as const,
                id: s.id,
              })),
              { type: "SessionList" as const },
            ]
          : [{ type: "SessionList" as const }],
    }),

    // GET /api/proxy/academic/current
    getCurrentSession: builder.query<any, void>({
      query: () => ({ url: "/api/proxy/academic/current" }),
      providesTags: [{ type: "CurrentSession" as const }],
    }),

    // POST /api/proxy/academic/sessions
    createSession: builder.mutation<
      any,
      {
        session: string;
        startsAt: string;
        endsAt: string;
        terms: Array<{ term: string; startsAt: string; endsAt: string }>;
      }
    >({
      query: (body) => ({
        url: "/api/proxy/academic/sessions",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [
        { type: "SessionList" },
        { type: "CurrentSession" },
      ],
    }),

    // POST /api/proxy/academic/sessions/:sessionId/terms
    createTerm: builder.mutation<
      any,
      { sessionId: string; term: string; startsAt: string; endsAt: string }
    >({
      query: ({ sessionId, ...body }) => ({
        url: `/api/proxy/academic/sessions/${sessionId}/terms`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "SessionList" }, { type: "CurrentSession" }],
    }),

    // POST /api/proxy/academic/sessions/:sessionId/terms/:termId/activate
    activateTerm: builder.mutation<
      any,
      { sessionId: string; termId: string }
    >({
      query: ({ sessionId, termId }) => ({
        url: `/api/proxy/academic/sessions/${sessionId}/terms/${termId}/activate`,
        method: "POST",
      }),
      invalidatesTags: [
        { type: "SessionList" },
        { type: "CurrentSession" },
      ],
    }),

    // POST /api/proxy/onboarding/setup
    onboardingSetup: builder.mutation<any, any>({
      query: (body) => ({
        url: "/api/proxy/onboarding/setup",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [
        { type: "SessionList" },
        { type: "CurrentSession" },
        { type: "ClassList" },
        { type: "SubjectList" },
        { type: "GradingSystem" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAllSessionsQuery,
  useGetCurrentSessionQuery,
  useCreateSessionMutation,
  useCreateTermMutation,
  useActivateTermMutation,
  useOnboardingSetupMutation,
} = academicApi;
