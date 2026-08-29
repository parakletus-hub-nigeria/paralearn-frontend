import { createApi } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import apiClient from "@/lib/api";
import type { AxiosRequestConfig, AxiosError } from "axios";

// ---------------------------------------------------------------------------
// Axios-based baseQuery — reuses the app's apiClient (auth, refresh, subdomain)
// ---------------------------------------------------------------------------
export interface AxiosBaseQueryArgs {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: AxiosRequestConfig["data"];
  params?: AxiosRequestConfig["params"];
  headers?: AxiosRequestConfig["headers"];
}

export const axiosBaseQuery: BaseQueryFn<
  AxiosBaseQueryArgs,
  unknown,
  { status?: number; data?: unknown; message?: string }
> = async ({ url, method = "GET", data, params, headers }, api) => {
  try {
    // For super-admin routes inject X-Tenant-Subdomain from the K-12 admin session.
    // Auth itself is handled by the accessToken cookie set during login (withCredentials: true).
    const state = (api as any).getState() as any;
    const k12Subdomain = state?.superAdmin?.k12Subdomain;
    const mergedHeaders: Record<string, string> = { ...(headers as any) };
    if (url.includes("/super-admin/") && k12Subdomain) {
      mergedHeaders["X-Tenant-Subdomain"] = k12Subdomain;
    }

    const result = await apiClient({
      url,
      method,
      data,
      params,
      headers: mergedHeaders,
    });
    // Unwrap common response envelope: { success, data, message }
    return { data: result.data?.data ?? result.data };
  } catch (axiosError) {
    const err = axiosError as AxiosError<{ message?: string; error?: string }>;
    return {
      error: {
        status: err.response?.status,
        data: err.response?.data,
        message:
          err.response?.data?.message ??
          err.response?.data?.error ??
          err.message ??
          "An unknown error occurred",
      },
    };
  }
};

// ---------------------------------------------------------------------------
// Central API slice — all domain endpoint files inject into this
// ---------------------------------------------------------------------------
export const paraApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  keepUnusedDataFor: 30,
  tagTypes: [
    "User",
    "UserList",
    "Session",
    "SessionList",
    "CurrentSession",
    "Class",
    "ClassList",
    "Subject",
    "SubjectList",
    "ClassSubject",
    "Assessment",
    "AssessmentList",
    "AssessmentCategory",
    "Score",
    "ScoreList",
    "Comment",
    "CommentList",
    "Report",
    "ReportCard",
    "ApprovalQueue",
    "Attendance",
    "SchoolSettings",
    "GradingSystem",
    "GradingTemplate",
    "Tenant",
    "BookletPreview",
    "Statistics",
    "ReportCardTemplate",
    "SchoolReportCardTemplate",
    "K12Schools",
    "FeeStructure",
    "FeeStructureList",
    "Invoice",
    "InvoiceList",
    "FeePayment",
    "BursaryDashboard",
    "PsychomotorRating",
    "SignatureAudit",
    "DigitalSignature",
  ] as const,
  endpoints: () => ({}), // injected by domain files
});
