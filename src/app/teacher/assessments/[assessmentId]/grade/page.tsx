import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { TeacherGradingPage } from "@/components/Teacher/TeacherGradingPage";

export default function GradeAssessmentPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["teacher"]} mode="block">
        <TeacherGradingPage />
      </RoleGuard>
    </ProtectedRoute>
  );
}
