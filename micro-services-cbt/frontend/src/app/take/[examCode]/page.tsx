import CandidateLobby from "@/components/CBT/CandidateLobby";

interface PageProps {
  params: Promise<{
    examCode: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const examCode = decodeURIComponent(resolvedParams.examCode);

  return <CandidateLobby examCode={examCode} />;
}
