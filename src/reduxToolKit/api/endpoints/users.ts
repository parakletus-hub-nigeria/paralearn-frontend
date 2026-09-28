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
  useGetUserByIdQuery,
  useGetCurrentUserQuery,
  useGetStudentsByClassQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useChangePasswordMutation,
} = usersApi;
