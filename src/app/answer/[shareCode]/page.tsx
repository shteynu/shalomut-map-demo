import { connection } from "next/server";
import { notFound } from "next/navigation";
import { SurveyFlow } from "@/components/survey";
import { getRepositories } from "@/lib/repositories";

export default async function SharedSurveyPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  await connection();
  const { shareCode } = await params;
  const { roundRepo } = getRepositories();
  const round = await roundRepo.findByShareCode(shareCode);

  if (!round || round.status !== "active") {
    notFound();
  }

  return (
    <SurveyFlow
      variant="public"
      shareCode={round.shareCode}
      surveyTitle={round.title}
    />
  );
}
