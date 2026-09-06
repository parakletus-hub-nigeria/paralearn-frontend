import { BulkUploadPage } from "@/components/RMS/BulkUploadPage";
import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";

export default function BulkUpload() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <BulkUploadPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
