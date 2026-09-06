import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminCommentsPage } from "@/components/RMS/AdminCommentsPage";

export default function CommentsPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminCommentsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

