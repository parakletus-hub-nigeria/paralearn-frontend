import CbtQuestionStudio from "@/components/CBT/CbtQuestionStudio";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <CbtQuestionStudio examId={resolvedParams.examId} />;
}
