import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Dashboard — consolidated overview endpoint
// Replaces 6 separate HTTP requests on dashboard mount with 1 parallelized query
// ---------------------------------------------------------------------------
const dashboardApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/dashboard/overview
    getDashboardOverview: builder.query<
      {
        stats: {
          totalStudents: number;
          totalTeachers: number;
          totalSubjects: number;
          totalAssessments: number;
        };
        currentAcademic: {
          session: string;
          sessionId: string;
          term: string;
          termId: string;
        };
        recentAssessments: any[];
        recentReportCards: any[];
      },
      void
    >({
      query: () => ({ url: "/api/proxy/dashboard/overview" }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "Dashboard" as const }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDashboardOverviewQuery,
} = dashboardApi;
