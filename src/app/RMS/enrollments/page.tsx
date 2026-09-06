import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminEnrollmentsPage } from "@/components/RMS/AdminEnrollmentsPage";

export default function EnrollmentsPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <AdminEnrollmentsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

