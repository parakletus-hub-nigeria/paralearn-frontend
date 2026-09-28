import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Attendance endpoints
// ---------------------------------------------------------------------------
const attendanceApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/attendance?studentId=...&classId=...&session=...&term=...
    getAttendance: builder.query<
      any[],
      {
        studentId?: string;
        classId?: string;
        session: string;
        term: string;
      }
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params.studentId) q.set("studentId", params.studentId);
        if (params.classId) q.set("classId", params.classId);
        q.set("session", params.session);
        q.set("term", params.term);
        return { url: `/api/proxy/attendance?${q.toString()}` };
      },
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: [{ type: "Attendance" }],
    }),

    // POST /api/proxy/attendance
    recordAttendance: builder.mutation<
      any,
      {
        studentId: string;
        session: string;
        term: string;
        daysPresent: number;
        totalDays: number;
      }
    >({
      query: (body) => ({
        url: "/api/proxy/attendance",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Attendance" }],
    }),
    // GET /attendance/class/:classId/daily
    getDailyClassAttendance: builder.query<
      any[],
      { classId: string; date: string }
    >({
      query: ({ classId, date }) => ({
        url: `/api/proxy/attendance/class/${classId}/daily`,
        params: { date },
      }),
      transformResponse: (res: any) => {
        // The API returns { enrollmentId, student: {...}, attendance: {...} | null } items
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (result, error, { classId, date }) => [
        { type: "Attendance", id: `daily-${classId}-${date}` },
      ],
    }),

    // PATCH /attendance/bulk
    bulkUpdateAttendance: builder.mutation<
      any,
      {
        date: string;
        records: {
          id?: string;
          enrollmentId: string;
          status: "PRESENT" | "ABSENT" | "LATE";
          remarks?: string; // Adding remarks as it's in the UI
        }[];
      }
    >({
      query: (body) => ({
        url: "/api/proxy/attendance/bulk",
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (result, error, { date }) => [
        { type: "Attendance" }, 
        // We might want to be more specific here if possible, but general invalidation is safer for now
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAttendanceQuery,
  useRecordAttendanceMutation,
  useGetDailyClassAttendanceQuery,
  useBulkUpdateAttendanceMutation,
} = attendanceApi;
