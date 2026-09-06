import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import SideBar from "@/components/RMS/sideBar";
import { CBTResultsPage } from "@/components/RMS/CBT/CBTResultsPage";

export default function CBTResultsRoutePage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <CBTResultsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
