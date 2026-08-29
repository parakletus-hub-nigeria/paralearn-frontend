import { paraApi } from "../baseApi";

export interface TenantResolutionData {
  id: string;
  name: string;
  subdomain: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  settings?: {
    motto?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
  };
}

export interface SchoolBrandingData {
  schoolId: string;
  name: string;
  subdomain: string;
  domain?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  motto?: string | null;
  landingPageEnabled?: boolean;
}

export interface UpdateSchoolBrandingPayload {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  motto?: string;
  domain?: string;
  logoUrl?: string;
  schoolName?: string;
  address?: string;
  phoneNumber?: string;
  website?: string;
}

// ---------------------------------------------------------------------------
// Tenant & School Branding API Endpoints
// ---------------------------------------------------------------------------
const tenantApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /tenant/resolve (Public)
    resolveTenant: builder.query<
      TenantResolutionData,
      { host?: string; subdomain?: string; domain?: string } | void
    >({
      query: (params) => ({
        url: "/tenant/resolve",
        params: params || undefined,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "Tenant" }],
    }),

    // GET /school-settings/branding (Protected: admin, accountant)
    getSchoolBranding: builder.query<SchoolBrandingData, void>({
      query: () => ({
        url: "/school-settings/branding",
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "SchoolSettings" }, { type: "Tenant" }],
    }),

    // PATCH /school-settings/branding (Protected: admin)
    updateSchoolBranding: builder.mutation<
      SchoolBrandingData,
      UpdateSchoolBrandingPayload
    >({
      query: (body) => ({
        url: "/school-settings/branding",
        method: "PATCH",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: [{ type: "SchoolSettings" }, { type: "Tenant" }],
    }),

    // GET /tenant/info (Backward-compatible school metadata)
    getTenantInfo: builder.query<any, void>({
      query: () => ({
        url: "/tenant/info",
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: [{ type: "Tenant" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useResolveTenantQuery,
  useLazyResolveTenantQuery,
  useGetSchoolBrandingQuery,
  useUpdateSchoolBrandingMutation,
  useGetTenantInfoQuery,
} = tenantApi;

export default tenantApi;
