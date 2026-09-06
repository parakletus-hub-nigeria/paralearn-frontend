import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminClassesPage } from "@/components/RMS/AdminClassesPage";

export default function ClassesPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminClassesPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

