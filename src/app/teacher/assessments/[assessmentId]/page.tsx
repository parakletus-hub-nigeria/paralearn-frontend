import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ assessmentId: string }>;
};

export default async function TeacherAssessmentEntryPage({ params }: Props) {
  const { assessmentId } = await params;
  redirect(`/teacher/assessments/${assessmentId}/grade`);
}
