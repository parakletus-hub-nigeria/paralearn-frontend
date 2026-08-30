import { paraApi } from "../baseApi";

export interface SavePsychomotorPayload {
  reportCardId: string;
  studentId?: string;
  ratings: Record<string, number>;
}

export interface PsychomotorRecord {
  id?: string;
  reportCardId: string;
  studentId?: string;
  ratings: Record<string, number>;
  updatedAt?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Psychomotor & Affective Domain Endpoints (v1.5)
// ---------------------------------------------------------------------------
const psychomotorApi = paraApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /psychomotor/ratings
    savePsychomotorRatings: builder.mutation<
      { success: boolean; data: PsychomotorRecord },
      SavePsychomotorPayload
    >({
      query: (body) => ({
        url: "/psychomotor/ratings",
        method: "POST",
        data: body,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      invalidatesTags: (_r, _e, { reportCardId }) => [
        { type: "PsychomotorRating" },
        { type: "ReportCard", id: reportCardId },
      ],
    }),

    // GET /psychomotor/ratings?reportCardId=...&studentId=...
    getPsychomotorRatings: builder.query<
      PsychomotorRecord,
      { reportCardId: string; studentId?: string }
    >({
      query: (params) => ({
        url: "/psychomotor/ratings",
        params,
      }),
      transformResponse: (res: any) => res?.data ?? res,
      providesTags: (_r, _e, { reportCardId }) => [
        { type: "PsychomotorRating", id: reportCardId },
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useSavePsychomotorRatingsMutation,
  useGetPsychomotorRatingsQuery,
  useLazyGetPsychomotorRatingsQuery,
} = psychomotorApi;

export default psychomotorApi;
