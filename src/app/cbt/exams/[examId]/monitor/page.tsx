import CbtLiveMonitor from "@/components/CBT/CbtLiveMonitor";

interface PageProps {
  params: Promise<{
    examId: string;
  }> | {
    examId: string;
  };
}

export default async function CbtExamMonitorPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  return <CbtLiveMonitor examId={resolvedParams?.examId || ""} />;
}
