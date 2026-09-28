import { Suspense } from "react";
import LiveExamInterface from "@/components/Student/LiveExamInterface";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LiveExamInterface />
    </Suspense>
  );
}
