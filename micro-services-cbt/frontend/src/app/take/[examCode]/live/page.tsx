import CandidateLiveExam from "@cbt/components/CBT/CandidateLiveExam";

interface PageProps {
  params: Promise<{
    examCode: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const examCode = decodeURIComponent(resolvedParams.examCode);

  return <CandidateLiveExam examCode={examCode} />;
}
