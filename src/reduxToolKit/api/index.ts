// ---------------------------------------------------------------------------
// Barrel export — import all endpoint injections so they register with paraApi
// ---------------------------------------------------------------------------
export { paraApi } from "./baseApi";

// Auth
export {
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from "./endpoints/auth";

// Users
export {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useGetCurrentUserQuery,
  useGetStudentsByClassQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useChangePasswordMutation,
} from "./endpoints/users";

// Academic Sessions
export {
  useGetAllSessionsQuery,
  useGetCurrentSessionQuery,
  useCreateSessionMutation,
  useActivateTermMutation,
  useOnboardingSetupMutation,
} from "./endpoints/academic";

// Classes
export {
  useGetClassesQuery,
  useGetClassByIdQuery,
  useGetTeacherClassesQuery,
  useGetTeacherAssignedClassesQuery,
  useCreateClassMutation,
  useAssignTeacherToClassMutation,
  useRemoveTeacherFromClassMutation,
  useEnrollStudentMutation,
  useBulkEnrollStudentsMutation,
  useRemoveStudentMutation,
} from "./endpoints/classes";

// Subjects
export {
  useGetSubjectsQuery,
  useGetSubjectsByClassQuery,
  useGetSubjectsByTeacherQuery,
  useCreateSubjectMutation,
  useAssignTeacherToSubjectMutation,
} from "./endpoints/subjects";

// Assessments
export {
  useGetAssessmentsByStatusQuery,
  useGetAssessmentByIdQuery,
  useGetAssessmentSubmissionsQuery,
  useGetAssessmentCategoriesQuery,
  useCreateAssessmentMutation,
  useUpdateAssessmentMutation,
  usePublishAssessmentMutation,
  useBulkUploadQuestionsMutation,
  useCreateAssessmentCategoryMutation,
  useDeleteAssessmentCategoryMutation,
  useGradeAnswerMutation,
} from "./endpoints/assessments";

// Scores
export {
  useGetScoresByAssessmentQuery,
  useSubmitScoresMutation,
  useBulkUploadScoresMutation,
} from "./endpoints/scores";

// Comments
export {
  useGetMyCommentsQuery,
  useGetStudentCommentsQuery,
  useAddCommentMutation,
  useBulkAddCommentsMutation,
} from "./endpoints/comments";

// Reports
export {
  useGetSchoolStatisticsQuery,
  useGetApprovalQueueQuery,
  useGetBookletPreviewQuery,
  useGetStudentReportCardQuery,
  useGetReportCardsQuery,
  useApproveReportsMutation,
  useSubmitForApprovalMutation,
  useGenerateAndNotifyMutation,
  useVerifyReportSignatureQuery,
  useLazyVerifyReportSignatureQuery,
  useGetReportAuditTrailQuery,
  useSignReportCardMutation,
  useBulkShareReportsMutation,
  useShareReportCardWhatsappMutation,
  useShareReportCardEmailMutation,
} from "./endpoints/reports";

// Attendance
export {
  useGetAttendanceQuery,
  useRecordAttendanceMutation,
} from "./endpoints/attendance";

// Settings & Branding
export {
  useGetSchoolSettingsQuery,
  useUpdateSchoolSettingsMutation,
  useGetGradingSystemQuery,
  useUpdateGradingSystemMutation,
  useGetGradingTemplatesQuery,
  useGetTenantInfoQuery,
  useUpdateBrandingMutation,
} from "./endpoints/settings";

// Tenant Resolution & Visual Identity (v1.5)
export {
  useResolveTenantQuery,
  useLazyResolveTenantQuery,
  useGetSchoolBrandingQuery,
  useUpdateSchoolBrandingMutation,
} from "./endpoints/tenant";

// Finance & Bursary (v1.5)
export {
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
} from "./endpoints/finance";

// Psychomotor & Affective Domain (v1.5)
export {
  useSavePsychomotorRatingsMutation,
  useGetPsychomotorRatingsQuery,
  useLazyGetPsychomotorRatingsQuery,
} from "./endpoints/psychomotor";
