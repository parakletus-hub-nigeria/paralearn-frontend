import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import SideBar from "@/components/RMS/sideBar";
import { CBTDashboardPage } from "@/components/RMS/CBT/CBTDashboardPage";

export default function CBTPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <CBTDashboardPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
