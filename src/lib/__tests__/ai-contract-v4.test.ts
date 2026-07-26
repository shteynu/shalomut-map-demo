import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_ANALYTICS_V4_CONTRACT_VERSION,
  AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
  validateStoneMapResult,
  type StoneMapResult,
} from "../ai-contract";

test("validateStoneMapResult accepts contract 4.0 payloads with backgroundContext provenance", () => {
  assert.ok(
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS.includes("4.0" as any),
  );

  const sampleStones: Record<string, any> = {};
  const dimensions = [
    "self-expression",
    "professional-competence",
    "social-resource",
    "balance",
    "management-support",
    "certainty",
    "organizational-climate",
    "meaning",
  ];

  const dimHebrewNames: Record<string, string> = {
    "self-expression": "ביטוי עצמי",
    "professional-competence": "מסוגלות מקצועית",
    "social-resource": "קשרים חברתיים",
    balance: "איזון",
    "management-support": "עורף מקצועי",
    certainty: "ודאות",
    "organizational-climate": "אקלים ארגוני",
    meaning: "משמעות",
  };

  const hash = "sha256:88489e112233445566778899aabbccddeeff00112233445566778899aabbccdd";

  for (const d of dimensions) {
    sampleStones[d] = {
      dimensionId: d,
      dimensionNameHebrew: dimHebrewNames[d],
      status: "green",
      score: 85.0,
      psychologicalInterpretation: "הממד מציג חוזקה משמעותית בצוות. מומלץ להמשיך ולשמר את התהליכים הקיימים.",
      recommendedInterventions: [
        {
          id: `rec-${d}-1`,
          dimensionId: d,
          status: "green",
          source: "ISO45003",
          title: "כותרת פעולה בעברית",
          summary: "תקציר המלצה בעברית",
          actionable_steps: ["צעד ראשון בעברית", "צעד שני בעברית"],
        },
      ],
      metrics: [
        {
          questionId: `q-${d}-1`,
          label: "נוסח שאלה מדויק בעברית",
          value: "85.0 מתוך 100",
          averageScore: 85.0,
          responseCount: 15,
        },
      ],
      generationProvenance: {
        outcome: "llm",
        attempts: 1,
        retryCount: 0,
        sourceQuestionIds: [`q-${d}-1`],
        surveyDefinitionHash: hash,
        backgroundContextIncluded: true,
      },
    };
  }

  const validPayload: StoneMapResult = {
    contractVersion: AI_ANALYTICS_V4_CONTRACT_VERSION,
    roundId: "test-round-v4-uuid",
    processedAt: new Date().toISOString(),
    surveyDefinitionHash: hash,
    isLocked: false,
    status: "success",
    overallPsychologicalSummary: "תקציר כללי מצרפי בעברית עבור כל שמונת הממדים.",
    stones: sampleStones,
  };

  const result = validateStoneMapResult(validPayload, "test-round-v4-uuid");
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.contractVersion, "4.0");
    assert.strictEqual(
      result.value.stones?.["self-expression"].generationProvenance?.backgroundContextIncluded,
      true,
    );
  }
});
