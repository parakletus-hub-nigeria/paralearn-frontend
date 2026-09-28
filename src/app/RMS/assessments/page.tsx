import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminAssessmentsPage } from "@/components/RMS/AdminAssessmentsPage";

export default function AdminAssessments() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminAssessmentsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

