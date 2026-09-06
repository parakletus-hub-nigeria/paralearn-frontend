import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import SideBar from "@/components/RMS/sideBar";
import { CBTExamDetailPage } from "@/components/RMS/CBT/CBTExamDetailPage";

export default function CBTExamDetailRoutePage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <CBTExamDetailPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
