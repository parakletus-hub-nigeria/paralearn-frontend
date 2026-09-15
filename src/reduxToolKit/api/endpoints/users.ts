import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Users endpoints
// ---------------------------------------------------------------------------
const usersApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/users — list all users
    getUsers: builder.query<any[], void>({
      query: () => ({ url: "/api/proxy/users" }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data ?? res ?? [];
        return Array.isArray(data) ? data : [];
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map((u: any) => ({ type: "User" as const, id: u.id })),
              { type: "UserList" as const },
            ]
          : [{ type: "UserList" as const }],
    }),

    // GET /api/proxy/users/lookup — lightweight user picker
    getUsersLookup: builder.query<
      { id: string; firstName: string; lastName: string; email: string; role: string; studentId?: string; teacherId?: string }[],
      { role?: string; search?: string; limit?: number } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params && params.role) q.set("role", params.role);
        if (params && params.search) q.set("search", params.search);
        if (params && params.limit) q.set("limit", String(params.limit));
        const qs = q.toString();
        return { url: `/api/proxy/users/lookup${qs ? `?${qs}` : ""}` };
      },
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: [{ type: "UserLookup" as const }],
    }),

    // GET /api/proxy/users — paginated users table with search & filters
    getUsersPaginated: builder.query<
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
      { page?: number; limit?: number; search?: string; role?: string; classId?: string } | void
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params && params.page) q.set("page", String(params.page));
        if (params && params.limit) q.set("limit", String(params.limit));
        if (params && params.search) q.set("search", params.search);
        if (params && params.role) q.set("role", params.role);
        if (params && params.classId) q.set("classId", params.classId);
        const qs = q.toString();
        return { url: `/api/proxy/users${qs ? `?${qs}` : ""}` };
      },
      transformResponse: (res: any) => {
        // Handle both paginated { data, pagination } and flat array responses
        if (res && Array.isArray(res.data) && res.pagination) return res;
        const data = Array.isArray(res) ? res : res?.data ?? [];
        const arr = Array.isArray(data) ? data : [];
        return {
          data: arr,
          pagination: { total: arr.length, page: 1, limit: arr.length, totalPages: 1, hasNextPage: false, hasPrevPage: false },
        };
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map((u: any) => ({ type: "User" as const, id: u.id })),
              { type: "UserList" as const },
            ]
          : [{ type: "UserList" as const }],
    }),

    // GET /api/proxy/users/:id
    getUserById: builder.query<any, string>({
      query: (userId) => ({ url: `/api/proxy/users/${userId}` }),
      providesTags: (_r, _e, id) => [{ type: "User", id }],
    }),

    // GET /api/proxy/users/me
    getCurrentUser: builder.query<any, void>({
      query: () => ({ url: "/api/proxy/users/me" }),
      providesTags: [{ type: "User", id: "ME" }],
    }),

    // GET /api/proxy/users?classId=...&role=student
    getStudentsByClass: builder.query<any[], { classId: string }>({
      query: ({ classId }) => ({
        url: `/api/proxy/users?classId=${classId}&role=student`,
      }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : res?.data ?? res ?? [];
        return Array.isArray(data) ? data : [];
      },
      providesTags: (_r, _e, { classId }) => [
        { type: "UserList", id: `class-${classId}` },
      ],
    }),

    // PATCH /api/proxy/users/:id
    updateUser: builder.mutation<
      any,
      {
        userId: string;
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
        address?: string;
        dateOfBirth?: string;
        gender?: string;
      }
    >({
      query: ({ userId, ...body }) => ({
        url: `/api/proxy/users/${userId}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { userId }) => [
        { type: "User", id: userId },
        { type: "UserList" },
      ],
    }),

    // DELETE /api/proxy/users/:id
    deleteUser: builder.mutation<{ userId: string; message: string }, string>({
      query: (userId) => ({
        url: `/api/proxy/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, userId) => [
        { type: "User", id: userId },
        { type: "UserList" },
      ],
    }),

    // POST /api/proxy/auth/change-password
    changePassword: builder.mutation<
      any,
      { currentPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: "/api/proxy/auth/change-password",
        method: "POST",
        data: body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUsersQuery,
  useGetUsersLookupQuery,
  useGetUsersPaginatedQuery,
  useGetUserByIdQuery,
  useGetCurrentUserQuery,
  useGetStudentsByClassQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useChangePasswordMutation,
} = usersApi;
