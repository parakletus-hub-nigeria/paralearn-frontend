import { Suspense } from "react";
import CbtAuthGateway from "@/components/CBT/CbtAuthGateway";

export const metadata = {
  title: "Examiner Access & Sign In | ParaLearn CBT",
  description: "Sign in with your school account or create an independent tutorial hall to test candidates.",
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--border-fine)] border-t-[var(--violet-ink)] animate-spin" />
        </div>
      }
    >
      <CbtAuthGateway />
    </Suspense>
  );
}
