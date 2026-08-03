import { connection } from "next/server";
import { notFound } from "next/navigation";
import { SurveyFlow } from "@/components/survey";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";

export default async function SharedSurveyPage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  await connection();
  const { shareCode } = await params;
  const { roundRepo } = resolveCoreRepositories();
  const round = await roundRepo.findByShareCode(shareCode);

  if (!round || round.status !== "active") {
    notFound();
  }

  const definition =
    round.surveyDefinition ??
    createCanonicalSurveyDefinition(round.title, round.privacyThreshold);

  return (
    <SurveyFlow
      variant="public"
      shareCode={round.shareCode}
      surveyTitle={definition.title}
      introText={definition.introText}
      anonymityText={definition.anonymityText}
      questions={definition.questions.filter((question) => question.enabled)}
    />
  );
}
