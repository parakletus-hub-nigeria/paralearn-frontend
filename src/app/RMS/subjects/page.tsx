import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminSubjectsPage } from "@/components/RMS/AdminSubjectsPage";

export default function SubjectsPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminSubjectsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

