import CbtQuestionStudio from "@cbt/components/CBT/CbtQuestionStudio";

interface PageProps {
  params: Promise<{
    examId: string;
  }> | {
    examId: string;
  };
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  return <CbtQuestionStudio examId={resolvedParams?.examId || ""} />;
}
