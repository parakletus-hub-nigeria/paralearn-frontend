import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminAttendancePage } from "@/components/RMS/AdminAttendancePage";

export default function AttendancePage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminAttendancePage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}

