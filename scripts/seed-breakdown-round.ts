/**
 * A local round that can actually be broken down by a background question.
 *
 * `seed-local.ts` writes the canonical 24, which are all analytic, so the
 * breakdown screen has nothing to group by there — it renders its empty state
 * and nothing else can be walked. This adds a second round carrying one
 * single-choice background question about tenure, with responses spread across
 * its categories on purpose:
 *
 *   - two categories comfortably above the threshold, with different scores, so
 *     the table has a difference in it to read;
 *   - one category deliberately below it, so the suppression is visible;
 *   - a few respondents who skipped the question, so the unanswered category is
 *     on screen too.
 *
 * The round is written `closed` rather than `active`: a school has one active
 * round at a time, and the local database already has one from `seed-local.ts`.
 * A closed round shows its results exactly the same way.
 *
 *   npx tsx scripts/seed-breakdown-round.ts
 *   npx tsx scripts/seed-breakdown-round.ts --locked
 *
 * `--locked` writes the same questionnaire with four responses instead of
 * forty-one, which is below the threshold. That round is how the locked state
 * of the screen gets walked: it has a background question to group by and a
 * result that may not be read, which is the one combination the ordinary seed
 * cannot produce.
 *
 * **What this does not prove.** The respondent screen cannot yet ask a
 * background question — that is phase 3 of the research-instrument plan and it
 * is not built. The submit API accepts these answers and this script writes
 * them through the same repository the API uses, so the stored shape is real;
 * what no browser has done yet is produce one by answering.
 *
 * Loopback only, for the same reason `seed-local.ts` is: a seeded school on the
 * deployed dashboard would be a fake school on a real screen.
 */
import 'dotenv/config';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import { resolveManagerOrganizationId } from '@/lib/auth/manager-auth-service';
import {
  isAnalyticQuestion,
  type AnswerValue,
  type SurveyDefinitionQuestion,
  type SurveyResponseRecord,
} from '@/lib/types/backend';

const SHARE_CODE = 'SHALOM-BREAKDOWN';
const SEEDED_AT = new Date();
const TENURE_QUESTION_ID = 'background_tenure';
const ROLE_QUESTION_ID = 'background_role';

/**
 * How many respondents land in each category. `new` is under the threshold of
 * ten on purpose — it is the row the screen has to refuse to publish, and the
 * closure rule then has to take a second row with it.
 */
const COHORTS: { categoryId: string | undefined; count: number; bias: number }[] = [
  { categoryId: 'veteran', count: 14, bias: 0 },
  { categoryId: 'mid', count: 12, bias: 1 },
  { categoryId: 'new', count: 4, bias: 2 },
  { categoryId: undefined, count: 11, bias: 1 },
];

/**
 * A second background question, so the screen's question picker has something
 * to pick between. One question would leave that control hidden and therefore
 * unwalked, and a school asks more than one thing about who is answering.
 */
const ROLE_QUESTION: SurveyDefinitionQuestion = {
  id: ROLE_QUESTION_ID,
  kind: 'background',
  text: 'מה התפקיד העיקרי שלך בבית הספר?',
  required: false,
  enabled: true,
  answerMode: 'single-choice',
  options: [
    { value: 'homeroom', label: 'מחנכ/ת כיתה' },
    { value: 'subject', label: 'מורה מקצועי/ת' },
  ],
};

const TENURE_QUESTION: SurveyDefinitionQuestion = {
  id: TENURE_QUESTION_ID,
  kind: 'background',
  text: 'כמה שנים את/ה עובד/ת בבית הספר?',
  required: false,
  enabled: true,
  answerMode: 'single-choice',
  options: [
    { value: 'new', label: 'עד שנה' },
    { value: 'mid', label: 'שנה עד חמש שנים' },
    { value: 'veteran', label: 'יותר מחמש שנים' },
  ],
};

/**
 * A colour per question, per respondent, leaning on the cohort's bias so the
 * groups differ from each other rather than all averaging to the same number.
 */
function answerFor(dimensionId: string, index: number, bias: number): AnswerValue {
  const step = (index + bias * 2) % 5;
  if (dimensionId === 'balance') return step < 2 + bias ? 'red' : 'yellow';
  if (dimensionId === 'organizational-climate') {
    return step < 1 + bias ? 'red' : step < 3 ? 'yellow' : 'green';
  }
  return step < bias ? 'yellow' : 'green';
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

/** Four responses in two categories: enough to group, too few to publish. */
const LOCKED_COHORTS: typeof COHORTS = [
  { categoryId: 'veteran', count: 2, bias: 0 },
  { categoryId: 'mid', count: 2, bias: 1 },
];

async function main() {
  const host = requireLocalDatabase();
  const isLocked = process.argv.includes('--locked');
  const cohorts = isLocked ? LOCKED_COHORTS : COHORTS;
  const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
  const organizationId = resolveManagerOrganizationId() ?? 'local-dev-organization';

  const existing = await orgRepo.findById(organizationId);
  if (!existing) {
    throw new Error(
      `No organization ${organizationId}. Run npx tsx scripts/seed-local.ts first.`,
    );
  }

  const canonical = createCanonicalSurveyDefinition(
    isLocked ? 'סבב פילוח נעול' : 'סבב פילוח מקומי',
    10,
  );
  const definition = {
    ...canonical,
    questions: [...canonical.questions, TENURE_QUESTION, ROLE_QUESTION],
  };
  const analyticQuestions = definition.questions
    .filter((question) => question.enabled)
    .filter(isAnalyticQuestion);

  const roundId = `round_breakdown_${SEEDED_AT.getTime()}`;
  await roundRepo.create({
    id: roundId,
    organizationId,
    title: definition.title,
    status: 'closed',
    // Unique per run: the script is meant to be re-run, and a share code is
    // unique across the database.
    shareCode: `${SHARE_CODE}${isLocked ? '-LOCKED' : ''}-${SEEDED_AT.getTime()}`,
    privacyThreshold: 10,
    startDate: SEEDED_AT,
    surveyDefinition: definition,
    createdAt: SEEDED_AT,
  });

  let written = 0;
  for (const cohort of cohorts) {
    for (let index = 0; index < cohort.count; index++) {
      const response: SurveyResponseRecord = {
        id: `${roundId}_response_${written}`,
        roundId,
        submittedAt: SEEDED_AT,
        answers: [
          ...analyticQuestions.map((question) => {
            const value = answerFor(question.dimensionId, index, cohort.bias);
            return {
              questionId: question.id,
              dimensionId: question.dimensionId,
              value,
              score: scoreFor(value),
            };
          }),
          // A background answer carries no dimension and no score, which is
          // exactly what makes it a background answer.
          ...(cohort.categoryId
            ? [{ questionId: TENURE_QUESTION_ID, value: cohort.categoryId }]
            : []),
          // Role splits across the tenure cohorts rather than lining up with
          // them, so the two questions produce genuinely different tables.
          {
            questionId: ROLE_QUESTION_ID,
            value: written % 3 === 0 ? 'homeroom' : 'subject',
          },
        ],
      };
      await surveyRepo.saveResponse(response);
      written += 1;
    }
  }

  console.log(
    [
      `Seeded ${host}:`,
      `  round     ${roundId} (${SHARE_CODE}, closed, threshold 10)`,
      `  responses ${written}`,
      ...cohorts.map(
        (cohort) =>
          `    ${(cohort.categoryId ?? 'no answer').padEnd(10)} ${cohort.count}`,
      ),
      '',
      'Open /breakdown and choose this round. `new` has four respondents, so it',
      'must be suppressed — and one more category must go with it, or the four',
      'would be recoverable by subtraction.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
