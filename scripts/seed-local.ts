/**
 * Put a usable round into the local database.
 *
 * The deployed environment starts empty and fills up from real use. The local
 * one has no respondents, so every manual test would stop at the privacy lock:
 * ten answers are needed on the round and on every analysed question before the
 * dashboard unlocks. This writes an organization and two rounds, each with
 * twelve responses, through the same repositories the application uses.
 *
 * Two rounds, because one round can no longer do both jobs. The respondent
 * route serves `notFound()` for a round that is not `active`, so a share link
 * that opens the questionnaire needs an active round — while a round that is
 * still collecting publishes no numbers at all (ADR-030), so a dashboard worth
 * looking at needs a closed one. Seeding either alone leaves the other screen
 * dead:
 *
 *   - `סבב שנסגר` is `closed`, and it is the one whose map opens. Being closed
 *     is also what lets the AI analysis be triggered from the round screen,
 *     which has required a closed round since ADR-016 — so this line of the
 *     summary below stopped being true of the active round some time ago.
 *   - `סבב פעיל` is `active` and holds the share code, so `/answer/<code>`
 *     opens the questionnaire and accepts answers. Its own map stays locked,
 *     which is not a defect to fix in the seed: it is the product, and the
 *     round switcher on the locked screen reaches the closed round.
 *
 * The manager lands on the active round, because that is the round their school
 * is working on (`orderRoundsForManager`).
 *
 *   npx tsx scripts/seed-local.ts          add the round
 *   npx tsx scripts/seed-local.ts --reset  clear the database first
 *
 * It refuses to run against anything but a loopback database. The deployed data
 * is not this script's business, and a seeded round there would be a fake
 * school on a real dashboard.
 */
import 'dotenv/config';
import { resolveCoreRepositories } from '@/lib/composition-root';
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
  // `resolveCoreRepositories` is the entrypoint seam; a script is an
  // entrypoint. This used to call `getRepositories`, which the composition
  // root replaced — the seed had been failing at its first line ever since,
  // unnoticed until CI ran it.
  const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();

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

  async function seedRound(
    suffix: string,
    title: string,
    status: 'active' | 'closed',
    shareCode: string,
    // Older than the active one, so the manager still lands on the round their
    // school is working on rather than on last term's.
    createdAt: Date,
  ): Promise<string> {
    const roundId = `round_local_${suffix}_${SEEDED_AT.getTime()}`;
    await roundRepo.create({
      id: roundId,
      organizationId,
      title,
      status,
      shareCode,
      privacyThreshold: 10,
      startDate: createdAt,
      surveyDefinition: { ...definition, title },
      createdAt,
    });

    for (let index = 0; index < RESPONSE_COUNT; index++) {
      const response: SurveyResponseRecord = {
        id: `${roundId}_response_${index}`,
        roundId,
        submittedAt: createdAt,
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

    return roundId;
  }

  const closedRoundId = await seedRound(
    'closed',
    'סבב שנסגר',
    'closed',
    `${SHARE_CODE}-CLOSED`,
    new Date(SEEDED_AT.getTime() - 86_400_000),
  );
  const activeRoundId = await seedRound(
    'active',
    'סבב פעיל',
    'active',
    SHARE_CODE,
    SEEDED_AT,
  );

  console.log(
    [
      `Seeded ${host}:`,
      `  organization ${organizationId}`,
      `  closed round ${closedRoundId} (${SHARE_CODE}-CLOSED, threshold 10)`,
      `  active round ${activeRoundId} (${SHARE_CODE}, threshold 10)`,
      `  responses    ${RESPONSE_COUNT} × ${questions.length} answers on each`,
      '',
      'The closed round is above the privacy threshold, so its map opens and the',
      'AI analysis can be triggered for it from the round screen. The active one',
      `is what /answer/${SHARE_CODE} opens; its own map stays locked until it is`,
      'closed, and the round switcher on that screen reaches the closed round.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
