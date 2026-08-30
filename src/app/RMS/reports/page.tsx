"use client";

import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import SideBar from "@/components/RMS/sideBar";
import RoleGuard from "@/components/protectedRoute/RoleGuard";
import { AdminReportsPage } from "@/components/RMS/AdminReportsPage";

const ReportsPage = () => {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp", "teacher"]}>
        <SideBar>
          <AdminReportsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
};

export default ReportsPage;
