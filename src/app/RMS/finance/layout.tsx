"use client";
import { useSelector } from "react-redux";
import { RootState } from "@/reduxToolKit/store";
import { useRouter, usePathname } from "next/navigation";
import { routespath } from "@/lib/routepath";
import { Banknote, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Fee Structures", href: routespath.FEE_STRUCTURES, icon: Banknote },
  { label: "Invoices",       href: routespath.INVOICES,       icon: FileText  },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSelector((s: RootState) => s.user.user);
  const roles: string[] = (user as any)?.roles ?? [];
  const allowed = roles.some((r) => ["admin", "accountant"].includes(r));

  if (!allowed) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 pt-4">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <button
                key={tab.href}
                onClick={() => router.push(tab.href)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary"
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
  );
}
