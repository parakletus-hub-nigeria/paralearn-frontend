import { paraApi } from "../baseApi";

export interface BursarySummary {
  totalExpectedKobo: number;
  formattedTotalExpected: string;
  totalCollectedKobo: number;
  formattedTotalCollected: string;
  totalOutstandingKobo: number;
  formattedTotalOutstanding: string;
  collectionRatePercentage: number;
}

export interface BursaryDistributionItem {
  count: number;
  percentage: number;
}

export interface BursaryDistribution {
  totalInvoices: number;
  paid: BursaryDistributionItem;
  partial: BursaryDistributionItem;
  pending: BursaryDistributionItem;
  waived: BursaryDistributionItem;
  overridden: BursaryDistributionItem;
}

export interface RecentPaymentItem {
  id: string;
  reference: string;
  amountKobo: number;
  formattedAmount: string;
  platformFeeKobo?: number;
  method: "CASH" | "BANK_TRANSFER" | "POS" | "PAYSTACK" | "MONNIFY" | string;
  status: "SUCCESS" | "FAILED" | "PENDING" | string;
  paidAt: string;
  createdAt: string;
  studentName: string;
  studentEmail?: string;
  term?: string;
  session?: string;
  invoiceId?: string;
}

export interface BursaryDashboardResponse {
  summary: BursarySummary;
  distribution: BursaryDistribution;
  recentPayments: RecentPaymentItem[];
}

export interface FeeStructureItem {
  id: string;
  termId: string;
  name: string;
  classLevel?: string | null;
  amount: number; // in kobo
  isActive?: boolean;
  type?: string;
  createdAt?: string;
  term?: {
    id: string;
    term: string;
    session?: {
      id: string;
      session: string;
    };
  };
}

export interface CreateFeeStructurePayload {
  termId: string;
  name: string;
  classLevel?: string;
  amount: number; // in kobo
  isActive?: boolean;
  type?: string;
}

export interface GenerateInvoicesPayload {
  termId: string;
  classId?: string;
  studentIds?: string[];
  dueDate?: string;
}

export interface GenerateInvoicesResponse {
  generated: number;
  skipped: number;
  invoices?: any[];
}

export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "WAIVED" | "OVERRIDDEN";

export interface InvoiceItemDetail {
  id: string;
  description: string;
  amount: number; // in kobo
}

export interface FeePaymentRecord {
  id: string;
  amount: number; // in kobo
  method: string;
  status: string;
  paidAt: string;
  reference: string;
}

export interface InvoiceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  className?: string;
  classId?: string;
  termId: string;
  termName?: string;
  sessionName?: string;
  totalAmount: number; // in kobo
  amountPaid: number; // in kobo
  balance?: number; // totalAmount - amountPaid
  status: InvoiceStatus;
  dueDate?: string;
  adminOverride?: boolean;
  overrideReason?: string;
  overrideAdminName?: string;
  overrideAt?: string;
  items?: InvoiceItemDetail[];
  payments?: FeePaymentRecord[];
  createdAt: string;
}

export interface RecordManualPaymentPayload {
  invoiceId: string;
  amount: number; // in kobo
  method: "CASH" | "BANK_TRANSFER" | "POS" | string;
  note?: string;
}

export interface RecordManualPaymentResponse {
  id: string;
  reference: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string;
  invoice: InvoiceRecord;
}

// ---------------------------------------------------------------------------
// Finance & Bursary Endpoints
// ---------------------------------------------------------------------------
const financeApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /fees/bursary/dashboard
    getBursaryDashboard: builder.query<
      BursaryDashboardResponse,
      { termId?: string; sessionId?: string; classId?: string } | void
    >({
      query: (params) => ({
        url: "/fees/bursary/dashboard",
        params: params || undefined,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "BursaryDashboard" }],
    }),

    // GET /fees/structures
    getFeeStructures: builder.query<FeeStructureItem[], { termId?: string } | void>({
      query: (params) => ({
        url: "/fees/structures",
        params: params || undefined,
      }),
      transformResponse: (res: any) => {
        const data = res?.data ?? res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: [{ type: "FeeStructureList" }],
    }),

    // POST /fees/structures
    createFeeStructure: builder.mutation<FeeStructureItem, CreateFeeStructurePayload>({
      query: (body) => ({
        url: "/fees/structures",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "FeeStructureList" }, { type: "BursaryDashboard" }],
    }),

    // POST /fees/invoices/generate
    generateInvoices: builder.mutation<GenerateInvoicesResponse, GenerateInvoicesPayload>({
      query: (body) => ({
        url: "/fees/invoices/generate",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "InvoiceList" }, { type: "BursaryDashboard" }],
    }),

    // GET /fees/invoices
    getInvoices: builder.query<
      InvoiceRecord[],
      { termId?: string; status?: string; studentId?: string; classId?: string } | void
    >({
      query: (params) => ({
        url: "/fees/invoices",
        params: params || undefined,
      }),
      transformResponse: (res: any) => {
        const data = res?.data ?? res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: [{ type: "InvoiceList" }],
    }),

    // POST /fees/invoices/:id/payments/manual
    recordManualPayment: builder.mutation<
      RecordManualPaymentResponse,
      RecordManualPaymentPayload
    >({
      query: ({ invoiceId, ...body }) => ({
        url: `/fees/invoices/${invoiceId}/payments/manual`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [
        { type: "InvoiceList" },
        { type: "BursaryDashboard" },
        { type: "FeePayment" },
      ],
    }),

    // GET /fees/invoices/me (Student Portal)
    getMyInvoices: builder.query<InvoiceRecord[], void>({
      query: () => ({
        url: "/fees/invoices/me",
      }),
      transformResponse: (res: any) => {
        const data = res?.data ?? res;
        return Array.isArray(data) ? data : [];
      },
      providesTags: [{ type: "Invoice", id: "ME" }],
    }),

    // POST /fees/payments/paystack/initialize (Student Paystack Checkout)
    initializePaystackPayment: builder.mutation<
      { authorizationUrl: string; reference: string },
      { invoiceId: string }
    >({
      query: (body) => ({
        url: "/fees/payments/paystack/initialize",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
    }),

    // GET /fees/payments/verify (Verify Paystack transaction)
    verifyPayment: builder.query<any, { reference: string }>({
      query: ({ reference }) => ({
        url: `/fees/payments/verify`,
        params: { reference },
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [
        { type: "Invoice", id: "ME" },
        { type: "InvoiceList" },
        { type: "BursaryDashboard" },
      ],
    }),

    // POST /fees/invoices/:id/override (Grant Fee Exemption)
    applyFeeOverride: builder.mutation<
      InvoiceRecord,
      { invoiceId: string; adminOverride: boolean; overrideReason: string; adminName?: string }
    >({
      query: ({ invoiceId, ...body }) => ({
        url: `/fees/invoices/${invoiceId}/override`,
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [
        { type: "InvoiceList" },
        { type: "Invoice", id: "ME" },
        { type: "BursaryDashboard" },
      ],
    }),

    // DELETE /fees/invoices/:id/override (Revoke Fee Exemption)
    revokeFeeOverride: builder.mutation<InvoiceRecord, { invoiceId: string }>({
      query: ({ invoiceId }) => ({
        url: `/fees/invoices/${invoiceId}/override`,
        method: "DELETE",
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [
        { type: "InvoiceList" },
        { type: "Invoice", id: "ME" },
        { type: "BursaryDashboard" },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetBursaryDashboardQuery,
  useGetFeeStructuresQuery,
  useCreateFeeStructureMutation,
  useGenerateInvoicesMutation,
  useGetInvoicesQuery,
  useRecordManualPaymentMutation,
  useGetMyInvoicesQuery,
  useInitializePaystackPaymentMutation,
  useVerifyPaymentQuery,
  useLazyVerifyPaymentQuery,
  useApplyFeeOverrideMutation,
  useRevokeFeeOverrideMutation,
} = financeApi;

export default financeApi;
