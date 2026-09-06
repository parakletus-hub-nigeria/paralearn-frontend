import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import SideBar from "@/components/RMS/sideBar";
import { CBTExamsPage } from "@/components/RMS/CBT/CBTExamsPage";

export default function CBTExamsRoutePage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <CBTExamsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
