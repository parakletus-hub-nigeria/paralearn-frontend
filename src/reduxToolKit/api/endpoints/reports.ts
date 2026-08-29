import { paraApi } from "../baseApi";

// ---------------------------------------------------------------------------
// Reports endpoints
// ---------------------------------------------------------------------------
const reportsApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/proxy/reports/school/statistics?session=...&term=...
    getSchoolStatistics: builder.query<
      any,
      { session: string; term: string }
    >({
      query: ({ session, term }) => ({
        url: `/api/proxy/reports/school/statistics?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      }),
      providesTags: [{ type: "Statistics" }],
    }),

    // GET /api/proxy/reports/approval-queue?status=...
    getApprovalQueue: builder.query<any[], string | void>({
      query: (status = "pending") => ({
        url: `/api/proxy/reports/approval-queue?status=${encodeURIComponent(status as string)}`,
      }),
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: [{ type: "ApprovalQueue" }],
    }),

    // GET /api/proxy/reports/class/:id/booklet-preview?session=...&term=...
    getBookletPreview: builder.query<
      any,
      { classId: string; session: string; term: string }
    >({
      query: ({ classId, session, term }) => ({
        url: `/api/proxy/reports/class/${classId}/booklet-preview?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      }),
      providesTags: (_r, _e, { classId }) => [
        { type: "BookletPreview", id: classId },
      ],
    }),

    // GET /api/proxy/grades/report-cards/:studentId?session=...&term=...
    getStudentReportCard: builder.query<
      any,
      { studentId: string; session: string; term: string }
    >({
      query: ({ studentId, session, term }) => ({
        url: `/api/proxy/grades/report-cards/${studentId}?session=${encodeURIComponent(session)}&term=${encodeURIComponent(term)}`,
      }),
      providesTags: (_r, _e, { studentId }) => [
        { type: "ReportCard", id: studentId },
      ],
    }),

    // GET /api/proxy/reports/report-cards?classId=...&session=...&term=...
    getReportCards: builder.query<
      any[],
      { classId?: string; session?: string; term?: string }
    >({
      query: (params) => {
        const q = new URLSearchParams();
        if (params.classId) q.set("classId", params.classId);
        if (params.session) q.set("session", params.session);
        if (params.term) q.set("term", params.term);
        return { url: `/api/proxy/reports/report-cards?${q.toString()}` };
      },
      transformResponse: (res: any) => {
        const data = Array.isArray(res) ? res : [];
        return data;
      },
      providesTags: [{ type: "ReportCard", id: "LIST" }],
    }),

    // POST /api/proxy/reports/approve
    approveReports: builder.mutation<
      any,
      {
        action: "approve" | "reject" | "publish";
        reportCardIds: string[];
        rejectionReason?: string;
      }
    >({
      query: (body) => ({
        url: "/api/proxy/reports/approve",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [
        { type: "ApprovalQueue" },
        { type: "ReportCard", id: "LIST" },
      ],
    }),

    // POST /api/proxy/reports/submit-for-approval
    submitForApproval: builder.mutation<any, any>({
      query: (body) => ({
        url: "/api/proxy/reports/submit-for-approval",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "ApprovalQueue" }],
    }),

    // POST /api/proxy/reports/generate-and-notify
    generateAndNotify: builder.mutation<any, any>({
      query: (body) => ({
        url: "/api/proxy/reports/generate-and-notify",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [
        { type: "ReportCard", id: "LIST" },
        { type: "Report" },
      ],
    }),

    // GET /api/proxy/reports/student/:studentId/:classId/report-card/pdf
    // Queues async PDF generation; optionally specify a selection templateId
    queueReportCardPdf: builder.query<
      { message: string; jobId: string },
      { studentId: string; classId: string; session: string; term: string; templateId?: string }
    >({
      query: ({ studentId, classId, session, term, templateId }) => {
        const q = new URLSearchParams({ session, term });
        if (templateId) q.set("templateId", templateId);
        return {
          url: `/api/proxy/reports/student/${studentId}/${classId}/report-card/pdf?${q.toString()}`,
        };
      },
    }),

    // DELETE /api/proxy/reports/report-cards/:id
    deleteReportCard: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/proxy/reports/report-cards/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "ReportCard", id: "LIST" }],
    }),

    // DELETE /api/proxy/reports/class/:classId/report-cards?session=...&term=...
    deleteClassReportCards: builder.mutation<
      any,
      { classId: string; session: string; term: string }
    >({
      query: ({ classId, session, term }) => {
        const q = new URLSearchParams({ session, term });
        return {
          url: `/api/proxy/reports/class/${classId}/report-cards?${q.toString()}`,
          method: "DELETE",
        };
      },
      invalidatesTags: [{ type: "ReportCard", id: "LIST" }],
    }),

    // DELETE /api/proxy/reports/class-jobs/:id
    deleteClassReportCardJob: builder.mutation<any, string>({
      query: (id) => ({
        url: `/api/proxy/reports/class-jobs/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "ReportCard", id: "LIST" }],
    }),

    // GET /api/proxy/reports/verify/:signatureProof (Public Verification Portal)
    verifyReportSignature: builder.query<
      {
        verified: boolean;
        student: {
          name: string;
          id: string;
          class: string;
          term: string;
          session: string;
        };
        academicSummary: {
          totalScore: number;
          average: number;
          position?: string;
          decision?: string;
        };
        signatures: Array<{
          role: string;
          signerName: string;
          signedAt: string;
        }>;
        verificationProof: string;
        verifiedAt: string;
      },
      string
    >({
      query: (signatureProof) => ({
        url: `/api/proxy/reports/verify/${encodeURIComponent(signatureProof)}`,
      }),
      transformResponse: (res: any) => res?.data ?? res,
    }),

    // GET /api/proxy/reports/:id/audit-trail (Digital Signature Audit Log)
    getReportAuditTrail: builder.query<any[], string>({
      query: (id) => ({
        url: `/api/proxy/reports/${id}/audit-trail`,
      }),
      transformResponse: (res: any) => {
        const data = res?.data ?? res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: (_r, _e, id) => [{ type: "SignatureAudit", id }],
    }),

    // POST /api/proxy/reports/report-cards/:id/sign (Teacher/Principal Signature)
    signReportCard: builder.mutation<
      any,
      { reportCardId: string; role: string; remarks?: string }
    >({
      query: ({ reportCardId, ...body }) => ({
        url: `/api/proxy/reports/report-cards/${reportCardId}/sign`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: (_r, _e, { reportCardId }) => [
        { type: "ReportCard" },
        { type: "SignatureAudit", id: reportCardId },
        { type: "ApprovalQueue" },
      ],
    }),

    // POST /api/proxy/reports/share/bulk (Bulk Dispatch via BullMQ Queue)
    bulkShareReports: builder.mutation<
      {
        success: boolean;
        message: string;
        data?: { queued: number; skipped: number; jobIds: string[] };
      },
      { studentIds: string[]; term: string; session: string }
    >({
      query: (body) => ({
        url: "/api/proxy/reports/share/bulk",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
    }),

    // POST /api/proxy/reports/report-cards/:id/share/whatsapp
    shareReportCardWhatsapp: builder.mutation<
      any,
      { reportCardId: string; phone: string }
    >({
      query: ({ reportCardId, phone }) => ({
        url: `/api/proxy/reports/report-cards/${reportCardId}/share/whatsapp`,
        method: "POST",
        data: { phone },
      }),
      transformResponse: (res: any) => res?.data ?? res,
    }),

    // POST /api/proxy/reports/report-cards/:id/share/email
    shareReportCardEmail: builder.mutation<
      any,
      { reportCardId: string; email: string }
    >({
      query: ({ reportCardId, email }) => ({
        url: `/api/proxy/reports/report-cards/${reportCardId}/share/email`,
        method: "POST",
        data: { email },
      }),
      transformResponse: (res: any) => res?.data ?? res,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSchoolStatisticsQuery,
  useGetApprovalQueueQuery,
  useGetBookletPreviewQuery,
  useGetStudentReportCardQuery,
  useGetReportCardsQuery,
  useApproveReportsMutation,
  useSubmitForApprovalMutation,
  useGenerateAndNotifyMutation,
  useLazyQueueReportCardPdfQuery,
  useDeleteReportCardMutation,
  useDeleteClassReportCardsMutation,
  useDeleteClassReportCardJobMutation,
  useVerifyReportSignatureQuery,
  useLazyVerifyReportSignatureQuery,
  useGetReportAuditTrailQuery,
  useSignReportCardMutation,
  useBulkShareReportsMutation,
  useShareReportCardWhatsappMutation,
  useShareReportCardEmailMutation,
} = reportsApi;
