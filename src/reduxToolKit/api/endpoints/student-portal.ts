import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Student Portal — consolidated dashboard overview
// Returns active assessments, submission status, recent submissions,
// financial invoice totals/balances, and term attendance summary
// ---------------------------------------------------------------------------
const studentPortalApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/student/dashboard-overview
    getStudentDashboardOverview: builder.query<any, void>({
      query: () => ({ url: "/api/proxy/student/dashboard-overview" }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "StudentDashboard" as const }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStudentDashboardOverviewQuery,
} = studentPortalApi;
