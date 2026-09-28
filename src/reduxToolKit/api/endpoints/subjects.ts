import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Subjects endpoints — post-migration (April 2026 model)
// Subjects are school-level; assigned to classes via ClassSubject join records.
// ---------------------------------------------------------------------------
const subjectsApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/subjects — school catalogue with classSubjects + teacherAssignments
    getSubjects: builder.query<any[], void>({
      query: () => ({
        url: "/api/proxy/subjects?include=teachers,teacherAssignments",
      }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: (result) =>
        result
          ? [
              ...result.map((s: any) => ({ type: "Subject" as const, id: s.id })),
              { type: "SubjectList" as const },
            ]
          : [{ type: "SubjectList" as const }],
    }),

    // GET /api/proxy/subjects/by-class/:classId ⭐ NEW — primary endpoint for class subject picker
    // Returns subjects with classSubjectId, subjectType, difficulty, isActive flattened
    getSubjectsByClass: builder.query<any[], string>({
      query: (classId) => ({
        url: `/api/proxy/subjects/by-class/${classId}`,
      }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: (_r, _e, classId) => [
        { type: "ClassSubject" as const, id: `class-${classId}` },
        { type: "SubjectList" as const, id: `class-${classId}` },
      ],
    }),

    // GET /api/proxy/subjects?teacherId=...
    getSubjectsByTeacher: builder.query<any[], string>({
      query: (teacherId) => ({
        url: `/api/proxy/subjects?teacherId=${teacherId}`,
      }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: (_r, _e, teacherId) => [
        { type: "SubjectList" as const, id: `teacher-${teacherId}` },
      ],
    }),

    // POST /api/proxy/subjects — classId is now optional
    createSubject: builder.mutation<
      any,
      {
        name: string;
        code?: string;
        classId?: string;
        subjectType?: string;
        difficulty?: string;
        description?: string;
      }
    >({
      query: (body) => ({
        url: "/api/proxy/subjects",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "SubjectList" }],
    }),

    // PATCH /api/proxy/subjects/:id — update name/code at school level
    updateSubject: builder.mutation<any, { id: string; name?: string; code?: string }>({
      query: ({ id, ...body }) => ({
        url: `/api/proxy/subjects/${id}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Subject" as const, id },
        { type: "SubjectList" as const },
      ],
    }),

    // DELETE /api/proxy/subjects/:id
    deleteSubject: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/proxy/subjects/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: "Subject" as const, id },
        { type: "SubjectList" as const },
        { type: "ClassSubject" as const },
      ],
    }),

    // POST /api/proxy/subjects/:id/classes ⭐ NEW — assign subject to a class (idempotent)
    assignSubjectToClass: builder.mutation<
      any,
      {
        subjectId: string;
        classId: string;
        subjectType?: string;
        difficulty?: string;
        description?: string;
      }
    >({
      query: ({ subjectId, ...body }) => ({
        url: `/api/proxy/subjects/${subjectId}/classes`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { subjectId }) => [
        { type: "Subject" as const, id: subjectId },
        { type: "SubjectList" as const },
        { type: "ClassSubject" as const },
      ],
    }),

    // DELETE /api/proxy/subjects/:id/classes/:classId ⭐ NEW — remove from one class only
    removeSubjectFromClass: builder.mutation<any, { subjectId: string; classId: string }>({
      query: ({ subjectId, classId }) => ({
        url: `/api/proxy/subjects/${subjectId}/classes/${classId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { subjectId, classId }) => [
        { type: "Subject" as const, id: subjectId },
        { type: "SubjectList" as const },
        { type: "ClassSubject" as const, id: `class-${classId}` },
      ],
    }),

    // POST /api/proxy/subjects/:id/assign-teacher (legacy — kept for backward compat)
    assignTeacherToSubject: builder.mutation<any, { subjectId: string; teacherId: string }>({
      query: ({ subjectId, teacherId }) => ({
        url: `/api/proxy/subjects/${subjectId}/assign-teacher`,
        method: "POST",
        data: { teacherId },
      }),
      invalidatesTags: (_r, _e, { subjectId }) => [
        { type: "Subject" as const, id: subjectId },
        { type: "SubjectList" as const },
      ],
    }),

    // POST /api/proxy/subjects/class-subjects/:classSubjectId/teachers ⭐ NEW
    assignTeacherToClassSubject: builder.mutation<any, { classSubjectId: string; teacherId: string }>({
      query: ({ classSubjectId, teacherId }) => ({
        url: `/api/proxy/subjects/class-subjects/${classSubjectId}/teachers`,
        method: "POST",
        data: { teacherId },
      }),
      invalidatesTags: [{ type: "SubjectList" as const }, { type: "ClassSubject" as const }],
    }),

    // GET /api/proxy/subjects/class-subjects/:classSubjectId/teachers ⭐ NEW
    getClassSubjectTeachers: builder.query<any[], string>({
      query: (classSubjectId) => ({
        url: `/api/proxy/subjects/class-subjects/${classSubjectId}/teachers`,
      }),
      transformResponse: (res: any) => (Array.isArray(res) ? res : []),
      providesTags: (_r, _e, id) => [{ type: "ClassSubject" as const, id }],
    }),

    // DELETE /api/proxy/subjects/class-subjects/:classSubjectId/teachers/:teacherId ⭐ NEW
    removeTeacherFromClassSubject: builder.mutation<any, { classSubjectId: string; teacherId: string }>({
      query: ({ classSubjectId, teacherId }) => ({
        url: `/api/proxy/subjects/class-subjects/${classSubjectId}/teachers/${teacherId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "SubjectList" as const }, { type: "ClassSubject" as const }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSubjectsQuery,
  useGetSubjectsByClassQuery,
  useGetSubjectsByTeacherQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
  useAssignSubjectToClassMutation,
  useRemoveSubjectFromClassMutation,
  useAssignTeacherToSubjectMutation,
  useAssignTeacherToClassSubjectMutation,
  useGetClassSubjectTeachersQuery,
  useRemoveTeacherFromClassSubjectMutation,
} = subjectsApi;
