"use client";
import { AcademicSessionsPage } from "@/components/RMS/AcademicSessionsPage";
import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";

export default function AcademicPage() {
  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "principal", "vp"]}>
        <SideBar>
          <AcademicSessionsPage />
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
