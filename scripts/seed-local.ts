/**
 * Put a usable round into the local database.
 *
 * The deployed environment starts empty and fills up from real use. The local
 * one has no respondents, so every manual test would stop at the privacy lock:
 * ten answers are needed on the round and on every analysed question before the
 * dashboard unlocks. This writes an organization, one closed round and twelve
 * responses through the same repositories the application uses.
 *
 *   npx tsx scripts/seed-local.ts          add the round
 *   npx tsx scripts/seed-local.ts --reset  clear the database first
 *
 * It refuses to run against anything but a loopback database. The deployed data
 * is not this script's business, and a seeded round there would be a fake
 * school on a real dashboard.
 */
import 'dotenv/config';
import { getRepositories } from '@/lib/repositories';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import { resolveManagerOrganizationId } from '@/lib/auth/manager-auth-service';
import type { AnswerValue, SurveyResponseRecord } from '@/lib/types/backend';

const RESPONSE_COUNT = 12;
const SHARE_CODE = 'SHALOM-LOCAL';
const SEEDED_AT = new Date();

/**
 * A flat round teaches nothing: the dashboard is only worth looking at when the
 * dimensions differ and the answers inside a question are split.
 */
function answerFor(dimensionId: string, responseIndex: number): AnswerValue {
  if (dimensionId === 'balance') {
    return responseIndex % 3 === 0 ? 'yellow' : 'red';
  }
  if (dimensionId === 'organizational-climate') {
    return responseIndex % 2 === 0 ? 'green' : 'red';
  }
  if (dimensionId === 'workload') {
    return responseIndex % 4 === 0 ? 'red' : 'yellow';
  }
  return responseIndex % 5 === 0 ? 'yellow' : 'green';
}

function scoreFor(value: AnswerValue): number {
  return value === 'green' ? 100 : value === 'yellow' ? 60 : 0;
}

function requireLocalDatabase(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is empty, so there is no database to seed. Point it at ' +
        'the local container from compose.yaml (see .env.example).',
    );
  }

  const host = new URL(connectionString).hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' || host === '::1' || host.startsWith('127.');

  if (!isLoopback) {
    throw new Error(
      `DATABASE_URL points at ${host}. This script only seeds the local ` +
        'database; the deployed one fills up from real use.',
    );
  }

  return host;
}

async function main() {
  const host = requireLocalDatabase();
  const { orgRepo, roundRepo, surveyRepo } = getRepositories();

  if (process.argv.includes('--reset')) {
    const { execSync } = require('node:child_process');
    execSync('npx tsx scripts/clear-db.ts', { stdio: 'inherit' });
  }

  // The same id the manager session is scoped to, so a seeded round is visible
  // to a manager who signs in rather than sitting in an organization nobody
  // can reach.
  const organizationId = resolveManagerOrganizationId() ?? 'local-dev-organization';

  const existing = await orgRepo.findById(organizationId);
  if (!existing) {
    await orgRepo.create({
      id: organizationId,
      name: 'בית ספר בדיקה מקומי',
      city: 'חיפה',
      schoolType: 'תיכון',
      totalStaffCount: 20,
      createdAt: SEEDED_AT,
    });
  }

  const definition = createCanonicalSurveyDefinition('סבב בדיקה מקומי', 10);
  const questions = definition.questions.filter((question) => question.enabled);

  const roundId = `round_local_${SEEDED_AT.getTime()}`;
  await roundRepo.create({
    id: roundId,
    organizationId,
    title: definition.title,
    status: 'closed',
    shareCode: SHARE_CODE,
    privacyThreshold: 10,
    startDate: SEEDED_AT,
    surveyDefinition: definition,
    createdAt: SEEDED_AT,
  });

  for (let index = 0; index < RESPONSE_COUNT; index++) {
    const response: SurveyResponseRecord = {
      id: `${roundId}_response_${index}`,
      roundId,
      submittedAt: SEEDED_AT,
      answers: questions.map((question) => {
        const value = answerFor(question.dimensionId, index);
        return {
          questionId: question.id,
          dimensionId: question.dimensionId,
          value,
          score: scoreFor(value),
        };
      }),
    };
    await surveyRepo.saveResponse(response);
  }

  console.log(
    [
      `Seeded ${host}:`,
      `  organization ${organizationId}`,
      `  round        ${roundId} (${SHARE_CODE}, closed, threshold 10)`,
      `  responses    ${RESPONSE_COUNT} × ${questions.length} answers`,
      '',
      'The round is above the privacy threshold, so the dashboard unlocks and',
      'the AI analysis can be triggered from the round screen.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
