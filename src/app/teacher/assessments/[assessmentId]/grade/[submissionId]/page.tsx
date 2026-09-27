import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { TeacherGradingPage } from "@/components/Teacher/TeacherGradingPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["teacher", "admin", "principal", "vp"]} mode="block">
        <TeacherGradingPage />
      </RoleGuard>
    </ProtectedRoute>
  );
}
