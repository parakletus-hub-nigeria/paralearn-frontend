import { AdminAssessmentDetailsPage } from "@/components/RMS/AdminAssessmentDetailsPage";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";

export default function Page() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]} mode="block">
        <AdminAssessmentDetailsPage />
      </RoleGuard>
    </ProtectedRoute>
  );
}
