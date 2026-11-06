import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

/**
 * RTK Query client for the RMS backend (paralearn-rms-backend), reached through the
 * same-origin proxy at /api/rms so the session token stays in an httpOnly cookie.
 */
export const RMS_API_BASE = "/api/rms";

// ── Types ────────────────────────────────────────────────────────────────────
export type RmsBatchStatus =
  | "UPLOADED"
  | "PARSING"
  | "PARSED"
  | "RENDERING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";

export const RMS_TERMS = ["First Term", "Second Term", "Third Term"] as const;

export interface RmsAccount {
  id: string;
  name: string;
  email: string;
}

export interface RmsWorkspace {
  id: string;
  name: string;
  logoUrl?: string | null;
  motto?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  primaryColor?: string | null;
}

export interface RmsSession {
  account: RmsAccount;
  workspace: RmsWorkspace;
}

export interface RmsBatchClass {
  id: string;
  name: string;
  studentCount?: number;
  subjects?: string[];
  status?: "PENDING" | "COMPLETED" | "FAILED";
  pdfReady?: boolean;
}

/** An error-level issue makes the parse fatal (batch FAILED); PARSED batches only carry warnings */
export interface RmsBatchIssue {
  level: "error" | "warning";
  message: string;
  sheet?: string | null;
  row?: number | null;
}

export interface RmsBatch {
  id: string;
  fileName?: string | null;
  session: string;
  term: string;
  status: RmsBatchStatus;
  totalStudents: number;
  renderedCount: number;
  failedCount: number;
  classes: RmsBatchClass[];
  issues: RmsBatchIssue[];
  autoGenerate?: boolean;
  /** 0-100, computed by the backend */
  progress?: number;
  error?: string | null;
  createdAt: string;
  parsedAt?: string | null;
  queuedAt?: string | null;
  completedAt?: string | null;
}

export interface RmsStudentRow {
  id: string;
  classId: string;
  /** Row in the uploaded sheet */
  rowNumber?: number;
  name: string;
  admissionNo?: string | null;
  average: number | null;
  grade?: string | null;
  position?: number | null;
  /** DONE means the card is rendered */
  status: "PENDING" | "DONE" | "FAILED";
  error?: string | null;
  pdfReady?: boolean;
}

export interface RmsUploadArgs {
  file: File;
  session: string;
  term: string;
  autoGenerate: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// PARSED waits for the school to press Generate; COMPLETED, COMPLETED_WITH_ERRORS and FAILED are final
export const RMS_ACTIVE_STATUSES: RmsBatchStatus[] = ["UPLOADED", "PARSING", "RENDERING"];
/** With autoGenerate, PARSED lasts only until the backend queues rendering, so keep polling through it */
export const isAutoStarting = (batch?: Pick<RmsBatch, "status" | "autoGenerate">) =>
  batch?.status === "PARSED" && batch.autoGenerate === true;
export const isBatchActive = (batch?: Pick<RmsBatch, "status" | "autoGenerate">) =>
  !!batch && (RMS_ACTIVE_STATUSES.includes(batch.status) || isAutoStarting(batch));

/** Download URLs are plain links: the session cookie rides along on navigation */
export const rmsDownloadUrls = {
  sampleSheet: () => `${RMS_API_BASE}/templates/result-sheet`,
  classPdf: (batchId: string, classId: string) =>
    `${RMS_API_BASE}/batches/${encodeURIComponent(batchId)}/classes/${encodeURIComponent(classId)}/pdf`,
  studentPdf: (batchId: string, studentId: string) =>
    `${RMS_API_BASE}/batches/${encodeURIComponent(batchId)}/students/${encodeURIComponent(studentId)}/pdf`,
};

/** Backend validation messages come back as a string or a string[] */
export function rmsErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = (error as { data?: { message?: unknown } } | undefined)?.data;
  const message = data?.message;
  if (Array.isArray(message)) return message.join("; ");
  if (typeof message === "string" && message.trim()) return message;
  if ((error as { status?: unknown })?.status === "FETCH_ERROR") return "Can't reach the results service. Check your connection.";
  return fallback;
}

export function currentAcademicSession(now = new Date()): string {
  // Nigerian sessions start in September
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}

// ── Base query ───────────────────────────────────────────────────────────────
const rawBaseQuery = fetchBaseQuery({
  baseUrl: RMS_API_BASE,
  credentials: "same-origin",
  prepareHeaders: (headers) => {
    headers.set("Accept", "application/json");
    return headers;
  },
});

export const RMS_SESSION_EXPIRED_EVENT = "rms:session-expired";

const rmsBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  if (result.error?.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(RMS_SESSION_EXPIRED_EVENT));
  }
  return result;
};

// ── API ──────────────────────────────────────────────────────────────────────
export const rmsApi = createApi({
  reducerPath: "rmsApi",
  baseQuery: rmsBaseQuery,
  tagTypes: ["Session", "Workspace", "Batch", "Students"],
  endpoints: (build) => ({
    // Session (cookie set by /api/rms/session/*)
    getMe: build.query<RmsSession, void>({
      query: () => "/auth/me",
      providesTags: ["Session"],
    }),
    login: build.mutation<RmsSession, { email: string; password: string }>({
      query: (body) => ({ url: "/session/login", method: "POST", body }),
      invalidatesTags: ["Session", "Workspace", "Batch"],
    }),
    signup: build.mutation<RmsSession, { name: string; email: string; password: string; schoolName: string }>({
      query: (body) => ({ url: "/session/signup", method: "POST", body }),
      invalidatesTags: ["Session", "Workspace", "Batch"],
    }),
    logout: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: "/session/logout", method: "POST" }),
    }),

    // Workspace branding
    getWorkspace: build.query<RmsWorkspace, void>({
      query: () => "/workspace",
      providesTags: ["Workspace"],
    }),
    updateWorkspace: build.mutation<RmsWorkspace, Partial<Omit<RmsWorkspace, "id">>>({
      query: (body) => ({ url: "/workspace", method: "PATCH", body }),
      invalidatesTags: ["Workspace", "Session"],
    }),

    // Batches
    listBatches: build.query<RmsBatch[], void>({
      query: () => "/batches",
      transformResponse: (res: RmsBatch[] | { items?: RmsBatch[]; batches?: RmsBatch[] }) =>
        Array.isArray(res) ? res : res.items || res.batches || [],
      providesTags: (res) => [
        { type: "Batch", id: "LIST" },
        ...(res || []).map((b) => ({ type: "Batch" as const, id: b.id })),
      ],
    }),
    getBatch: build.query<RmsBatch, string>({
      query: (id) => `/batches/${encodeURIComponent(id)}`,
      transformResponse: (res: RmsBatch | { batch: RmsBatch }) => ("batch" in res ? res.batch : res),
      providesTags: (_res, _err, id) => [{ type: "Batch", id }],
    }),
    uploadBatch: build.mutation<RmsBatch, RmsUploadArgs>({
      query: ({ file, session, term, autoGenerate }) => {
        const form = new FormData();
        form.append("file", file);
        form.append("session", session);
        form.append("term", term);
        form.append("autoGenerate", String(autoGenerate));
        return { url: "/batches", method: "POST", body: form };
      },
      transformResponse: (res: RmsBatch | { batch: RmsBatch }) => ("batch" in res ? res.batch : res),
      invalidatesTags: [{ type: "Batch", id: "LIST" }],
    }),
    generateBatch: build.mutation<unknown, string>({
      query: (id) => ({ url: `/batches/${encodeURIComponent(id)}/generate`, method: "POST" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Batch", id }, { type: "Batch", id: "LIST" }, "Students"],
    }),
    getBatchStudents: build.query<RmsStudentRow[], { batchId: string; classId?: string }>({
      query: ({ batchId, classId }) => ({
        url: `/batches/${encodeURIComponent(batchId)}/students`,
        params: classId ? { classId } : undefined,
      }),
      transformResponse: (res: RmsStudentRow[] | { items?: RmsStudentRow[]; students?: RmsStudentRow[] }) =>
        Array.isArray(res) ? res : res.items || res.students || [],
      providesTags: ["Students"],
    }),
  }),
});

export const {
  useGetMeQuery,
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useGetWorkspaceQuery,
  useUpdateWorkspaceMutation,
  useListBatchesQuery,
  useGetBatchQuery,
  useUploadBatchMutation,
  useGenerateBatchMutation,
  useGetBatchStudentsQuery,
} = rmsApi;
