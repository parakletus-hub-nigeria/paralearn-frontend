import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import SideBar from "@/components/RMS/sideBar";
import { CBTQuestionBankPage } from "@/components/RMS/CBT/CBTQuestionBankPage";

export default function CBTQuestionBankRoutePage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <CBTQuestionBankPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
