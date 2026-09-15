import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Classes endpoints
// ---------------------------------------------------------------------------
const classesApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/classes
    getClasses: builder.query<
      any[],
      { level?: string; isActive?: boolean } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params && params.level) q.set("level", params.level);
        if (params && typeof params.isActive === "boolean")
          q.set("isActive", String(params.isActive));
        const qs = q.toString();
        return { url: `/api/proxy/classes${qs ? `?${qs}` : ""}` };
      },
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((c: any) => ({
                type: "Class" as const,
                id: c.id,
              })),
              { type: "ClassList" as const },
            ]
          : [{ type: "ClassList" as const }],
    }),

    // GET /api/proxy/classes/lookup — lightweight selector (id, name, code, level, stream)
    getClassesLookup: builder.query<
      { id: string; name: string; code?: string; level?: string | number; stream?: string }[],
      void
    >({
      query: () => ({ url: "/api/proxy/classes/lookup" }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: [{ type: "ClassLookup" as const }],
    }),

    // GET /api/proxy/classes — paginated classes table with studentCount/teacherCount
    getClassesPaginated: builder.query<
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
      { page?: number; limit?: number; search?: string; level?: string } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params && params.page) q.set("page", String(params.page));
        if (params && params.limit) q.set("limit", String(params.limit));
        if (params && params.search) q.set("search", params.search);
        if (params && params.level) q.set("level", params.level);
        return { url: `/api/proxy/classes${q.toString() ? `?${q}` : ""}` };
      },
      transformResponse: (res: any) => {
        // Handle both paginated { data, pagination } and flat array responses
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
              ...result.data.map((c: any) => ({ type: "Class" as const, id: c.id })),
              { type: "ClassList" as const },
            ]
          : [{ type: "ClassList" as const }],
    }),

    // GET /api/proxy/classes/:id/roster — student enrollments with guardian info
    getClassRoster: builder.query<any[], string>({
      query: (classId) => ({ url: `/api/proxy/classes/${classId}/roster` }),
      transformResponse: (res: any) => {
        const data = res?.students || res?.data || res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: (_r, _e, classId) => [
        { type: "UserList", id: `roster-${classId}` },
      ],
    }),

    // GET /api/proxy/classes/:id
    getClassById: builder.query<any, string>({
      query: (classId) => ({ url: `/api/proxy/classes/${classId}` }),
      providesTags: (_r, _e, id) => [{ type: "Class", id }],
    }),

    // GET /api/proxy/classes/teacher/:teacherId
    getTeacherClasses: builder.query<any[], string>({
      query: (teacherId) => ({
        url: `/api/proxy/classes/teacher/${teacherId}`,
      }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: (_r, _e, teacherId) => [
        { type: "ClassList", id: `teacher-${teacherId}` },
      ],
    }),

    // GET /api/proxy/reports/teacher/:teacherId/classes
    getTeacherAssignedClasses: builder.query<any, string>({
      query: (teacherId) => ({
        url: `/api/proxy/reports/teacher/${teacherId}/classes`,
      }),
      providesTags: (_r, _e, teacherId) => [
        { type: "ClassList", id: `assigned-${teacherId}` },
      ],
    }),

    // POST /api/proxy/classes
    createClass: builder.mutation<
      any,
      {
        name: string;
        level?: number;
        stream?: string;
        capacity?: number;
        academicYear?: string;
      }
    >({
      query: (body) => ({
        url: "/api/proxy/classes",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "ClassList" }],
    }),

    // POST /api/proxy/classes/:id/teachers
    assignTeacherToClass: builder.mutation<
      any,
      { classId: string; teacherId: string }
    >({
      query: ({ classId, teacherId }) => ({
        url: `/api/proxy/classes/${classId}/teachers`,
        method: "POST",
        data: { teacherId },
      }),
      invalidatesTags: (_r, _e, { classId }) => [
        { type: "Class", id: classId },
      ],
    }),

    // DELETE /api/proxy/classes/:id/teachers/:tid
    removeTeacherFromClass: builder.mutation<
      any,
      { classId: string; teacherId: string }
    >({
      query: ({ classId, teacherId }) => ({
        url: `/api/proxy/classes/${classId}/teachers/${teacherId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { classId }) => [
        { type: "Class", id: classId },
      ],
    }),

    // POST /api/proxy/classes/:id/enroll
    enrollStudent: builder.mutation<
      any,
      { classId: string; studentId: string }
    >({
      query: ({ classId, studentId }) => ({
        url: `/api/proxy/classes/${classId}/enroll`,
        method: "POST",
        data: { studentId },
      }),
      invalidatesTags: (_r, _e, { classId }) => [
        { type: "Class", id: classId },
        { type: "UserList", id: `class-${classId}` },
      ],
    }),

    // POST /api/proxy/classes/:id/students (bulk)
    bulkEnrollStudents: builder.mutation<
      any,
      { classId: string; studentIds: string[] }
    >({
      query: ({ classId, studentIds }) => ({
        url: `/api/proxy/classes/${classId}/students`,
        method: "POST",
        data: { studentIds },
      }),
      invalidatesTags: (_r, _e, { classId }) => [
        { type: "Class", id: classId },
        { type: "UserList", id: `class-${classId}` },
      ],
    }),

    // DELETE /api/proxy/classes/:id/enroll/:studentId
    removeStudent: builder.mutation<
      any,
      { classId: string; studentId: string }
    >({
      query: ({ classId, studentId }) => ({
        url: `/api/proxy/classes/${classId}/enroll/${studentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { classId }) => [
        { type: "Class", id: classId },
        { type: "UserList", id: `class-${classId}` },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetClassesQuery,
  useGetClassesLookupQuery,
  useGetClassesPaginatedQuery,
  useGetClassRosterQuery,
  useGetClassByIdQuery,
  useGetTeacherClassesQuery,
  useGetTeacherAssignedClassesQuery,
  useCreateClassMutation,
  useAssignTeacherToClassMutation,
  useRemoveTeacherFromClassMutation,
  useEnrollStudentMutation,
  useBulkEnrollStudentsMutation,
  useRemoveStudentMutation,
} = classesApi;
