/**
 * Run the AI pipeline locally on a round that is actually unlocked.
 *
 * The only round on the database has three responses, so every local run of the
 * real chain stops at the privacy lock and never reaches the provider. This
 * builds a synthetic round with enough answers in memory, drives the real Core
 * MCP handler over it, and pipes the result through the real Python pipeline —
 * no database, no server, no manager login.
 *
 *   AI_ANALYTICS_CONTRACT_VERSION=6.0 npx tsx scripts/local-unlocked-pipeline.ts
 *
 * The contract version is required and has no default. This script is how the
 * cost and provenance of a round get looked at, and a version nobody typed is
 * the one nobody checks: until 2026-08-19 it defaulted to `5.0` while the
 * deployment produced `6.0`, so three runs measured an adaptation branch
 * nothing runs and the numbers were read as if they were about production.
 * Name the version you mean — `6.0` for what the deployment produces.
 *
 * Export the provider key first (`GEMINI_API_KEY=...`) to exercise the model.
 * Without one the pipeline still completes and reports `heuristic` provenance,
 * which proves everything except the provider call itself.
 */
import { spawnSync } from "node:child_process";
import {
  aiServiceRoot,
  requireAiServicePython,
} from "./ai-service-python.mjs";
import { POST as mcpHandler } from "@/app/api/mcp/route";
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from "@/lib/repositories";
import { PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS } from "@/lib/ai-contract-version";
import { overrideCoreRepositories } from "@/lib/composition-root";
import { surveyInstrument } from "@/lib/shalomut-source";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";
import type {
  AnswerValue,
  SurveyResponseRecord,
} from "@/lib/types/backend";

const RESPONSE_COUNT = 12;
const ROUND_ID = "round_local_unlocked";
const ORGANIZATION_ID = "org_local_unlocked";

/**
 * A flat round teaches nothing: the interesting output needs dimensions the
 * model has a reason to talk about, and questions whose answers are split
 * rather than uniform.
 */
function answerFor(
  dimensionId: string,
  responseIndex: number,
): AnswerValue {
  if (dimensionId === "balance") {
    return responseIndex % 3 === 0 ? "yellow" : "red";
  }
  if (dimensionId === "organizational-climate") {
    return responseIndex % 2 === 0 ? "green" : "red";
  }
  if (dimensionId === "workload") {
    return responseIndex % 4 === 0 ? "red" : "yellow";
  }
  return responseIndex % 5 === 0 ? "yellow" : "green";
}

function scoreFor(value: AnswerValue): number {
  return value === "green" ? 100 : value === "yellow" ? 60 : 0;
}

/**
 * The version this run produces, or a usage message and no run.
 *
 * Only the unset case is checked here. A value this deployment cannot produce
 * has already been refused by the time this runs: `analytics.service.ts`
 * resolves the variable when it is first imported, which the import of the MCP
 * route at the top of this file triggers, and it throws there. Repeating that
 * check would read as the guard while never being the guard.
 *
 * Unset is what falls through, because unset is a documented default
 * everywhere else in Core. It must not be one here: this script is how the cost
 * and provenance of a round get looked at, and until 2026-08-19 it quietly
 * chose `5.0` while the deployment produced `6.0`, so three runs measured an
 * adaptation branch nothing runs.
 */
function requireContractVersion(): string {
  const requested = process.env.AI_ANALYTICS_CONTRACT_VERSION?.trim();
  if (requested) {
    return requested;
  }

  console.error(
    "AI_ANALYTICS_CONTRACT_VERSION is required and has no default.\n" +
      `Producible versions: ${PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS.join(", ")}. ` +
      "The deployment produces 6.0.\n" +
      "  AI_ANALYTICS_CONTRACT_VERSION=6.0 npx tsx " +
      "scripts/local-unlocked-pipeline.ts",
  );
  process.exit(1);
}

async function main() {
  // The in-memory repositories are the point: a stray DATABASE_URL would send
  // this at the real database instead.
  delete process.env.DATABASE_URL;
  const contractVersion = requireContractVersion();
  process.env.AI_ANALYTICS_CONTRACT_VERSION = contractVersion;
  console.log(`Contract: producing ${contractVersion}`);

  const definition = createCanonicalSurveyDefinition("סבב בדיקה מקומי", 10);
  const questions = definition.questions.filter((question) => question.enabled);

  const responses: SurveyResponseRecord[] = Array.from(
    { length: RESPONSE_COUNT },
    (_, responseIndex) => ({
      id: `${ROUND_ID}_response_${responseIndex}`,
      roundId: ROUND_ID,
      submittedAt: new Date("2026-07-28T12:00:00.000Z"),
      answers: questions.map((question) => {
        const value = answerFor(question.dimensionId, responseIndex);
        return {
          questionId: question.id,
          dimensionId: question.dimensionId,
          value,
          score: scoreFor(value),
        };
      }),
    }),
  );

  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      {
        id: ORGANIZATION_ID,
        name: "בית ספר בדיקה מקומי",
        city: "חיפה",
        schoolType: "תיכון",
        totalStaffCount: 20,
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
      },
    ]),
    roundRepo: new InMemoryRoundRepository([
      {
        id: ROUND_ID,
        organizationId: ORGANIZATION_ID,
        title: definition.title,
        status: "closed",
        shareCode: "SHALOM-LOCAL",
        privacyThreshold: 10,
        startDate: new Date("2026-07-28T12:00:00.000Z"),
        surveyDefinition: definition,
        createdAt: new Date("2026-07-28T12:00:00.000Z"),
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(responses),
  });

  const mcpResponse = await mcpHandler(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ROUND_ID,
        method: "tools/call",
        params: {
          name: "get_round_analytics",
          arguments: { roundId: ROUND_ID },
        },
      }),
    }),
  );

  if (mcpResponse.status !== 200) {
    throw new Error(`MCP returned ${mcpResponse.status}`);
  }

  const envelope = await mcpResponse.json();
  const analytics = JSON.parse(envelope.result.content[0].text);

  console.log(
    `MCP: contract ${analytics.contractVersion}, ${analytics.totalResponses} responses, ` +
      `threshold ${analytics.privacyThreshold}, locked ${analytics.isLocked}, ` +
      `${Object.keys(analytics.questionAggregates ?? {}).length} question aggregates`,
  );

  if (analytics.isLocked) {
    throw new Error("The fixture came back locked; nothing to send to the model.");
  }

  const python = spawnSync(
    requireAiServicePython("The local pipeline run"),
    ["-m", "src.pipeline_cli"],
    {
      cwd: aiServiceRoot,
      input: JSON.stringify(analytics),
      encoding: "utf8",
    },
  );

  // Always, not only on failure. The service's own log lines — `adaptation=`,
  // `outcome=usage`, every refusal and its detail — go to stderr, and they are
  // most of what a run is for: the stone list below says what was produced, and
  // these say what it cost and which gate turned anything away. Captured and
  // dropped on success, a paid round answers half the question it was run for.
  if (python.stderr) {
    process.stderr.write(python.stderr);
  }

  if (python.status !== 0) {
    throw new Error(`Python pipeline exited ${python.status}`);
  }

  const result = JSON.parse(python.stdout);
  // The payload keys stones by dimension id; the shape has moved between
  // contract versions, so read it defensively rather than assuming an array.
  const stoneMap: Record<string, Record<string, unknown>> =
    result.stones ?? result.result?.stones ?? {};
  const stones = Object.entries(stoneMap);

  console.log(
    `Python: status ${result.status}, contract ${result.contractVersion}, ${stones.length} stones`,
  );

  for (const [dimensionId, stone] of stones) {
    const provenance =
      (stone.generationProvenance as Record<string, unknown>) ?? {};
    console.log(
      `  ${dimensionId}: ${stone.status} ${stone.score} — ` +
        `${provenance.outcome ?? "n/a"} (attempts ${provenance.attempts ?? "n/a"})`,
    );
  }

  const summary =
    result.overallPsychologicalSummary ??
    result.result?.overallPsychologicalSummary;
  if (summary) {
    console.log(`Summary: ${summary}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
