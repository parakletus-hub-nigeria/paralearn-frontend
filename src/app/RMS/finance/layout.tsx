"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/reduxToolKit/store";
import { useRouter, usePathname } from "next/navigation";
import { routespath } from "@/lib/routepath";
import { LayoutDashboard, Banknote, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import SideBar from "@/components/RMS/sideBar";
import ProtectedRoute from "@/components/protectedRoute/protectedRoute";
import RoleGuard from "@/components/protectedRoute/RoleGuard";

const tabs = [
  { label: "Bursary Overview", href: routespath.FINANCE, icon: LayoutDashboard, exact: true },
  { label: "Fee Structures", href: routespath.FEE_STRUCTURES, icon: Banknote },
  { label: "Invoices & Billing", href: routespath.INVOICES, icon: FileText },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ProtectedRoute>
      <RoleGuard allow={["admin", "accountant", "principal"]}>
        <SideBar>
          <div className="flex flex-col h-full bg-slate-50/50">
            <div className="border-b bg-background px-6 pt-4 sticky top-0 z-10">
              <div className="flex gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                  const active = tab.exact
                    ? pathname === tab.href
                    : pathname === tab.href || pathname.startsWith(tab.href + "/");
                  return (
                    <button
                      key={tab.href}
                      onClick={() => router.push(tab.href)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                        active
                          ? "border-primary text-primary font-bold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">{children}</div>
          </div>
        </SideBar>
      </RoleGuard>
    </ProtectedRoute>
  );
}
