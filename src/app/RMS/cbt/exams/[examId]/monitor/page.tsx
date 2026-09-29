import CbtLiveMonitor from "@/components/CBT/CbtLiveMonitor";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <CbtLiveMonitor examId={resolvedParams.examId} />;
}
