import { UsersPage } from "@/components/RMS/UsersPage";
import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";

export default function Users() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <UsersPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
