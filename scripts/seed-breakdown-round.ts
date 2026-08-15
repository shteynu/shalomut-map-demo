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
 *   npx tsx scripts/seed-breakdown-round.ts --respondent
 *
 * `--locked` writes the same questionnaire with four responses instead of
 * forty-one, which is below the threshold. That round is how the locked state
 * of the screen gets walked: it has a background question to group by and a
 * result that may not be read, which is the one combination the ordinary seed
 * cannot produce.
 *
 * `--respondent` opens the same questionnaire as an *active* round with no
 * responses, which is the only way to walk the questionnaire itself: the
 * respondent route serves `notFound()` for a round in any other status. It goes
 * into a school of its own, because a school has one active round at a time and
 * taking that slot from the existing one would close a round nobody asked to
 * close.
 *
 * It carries all three background shapes — single choice, a plain number and an
 * allocation grid — because the respondent screen now asks them, and a walk that
 * only meets one widget proves only one widget.
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
const RESPONDENT_SHARE_CODE = 'SHALOM-BACKGROUND';
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

/**
 * The other two background shapes, so the respondent walk meets all three. They
 * are only added to the `--respondent` round: the breakdown screen offers
 * neither a numeric nor an allocation question to group by, so putting them on
 * the analysis rounds would seed data nothing reads.
 */
const HOURS_QUESTION: SurveyDefinitionQuestion = {
  id: 'background_hours',
  kind: 'background',
  text: 'מספר שעות עבודה יומי ממוצע',
  required: false,
  enabled: true,
  answerMode: 'number',
};

const LOAD_GRID: SurveyDefinitionQuestion[] = [
  'הוראה בכיתה',
  'בדיקת מבחנים',
  'ישיבות צוות',
].map((text, index) => ({
  id: `background_load_${index + 1}`,
  kind: 'background',
  text,
  required: false,
  enabled: true,
  answerMode: 'allocation-100',
  allocationGroupId: 'load',
}));

/**
 * Two blocks, because one block proves only that a block renders.
 *
 * The second is on the seven-point frequency scale and the shorter of the two,
 * which is how the source instrument is shaped — `שאלון שחיקה` is fourteen
 * items on 1–7 while `משאבים בעבודה` is thirty on 1–5. What matters for the
 * walk is that the legend changes with the block and that a long block scrolls
 * under its own legend.
 */
const RESOURCE_BLOCK: SurveyDefinitionQuestion[] = [
  'יש לי את הכלים שאני צריך/ה כדי ללמד טוב',
  'אני מקבל/ת משוב שעוזר לי להשתפר',
  'הצוות סביבי זמין לעזרה כשצריך',
  'יש לי השפעה על סדר היום שלי',
  'ההנהלה מגבה אותי מול קשיים',
  'אני יודע/ת למי לפנות כשמשהו נתקע',
  'יש לי זמן להתכונן לשיעורים',
  'ההכשרות שאני מקבל/ת רלוונטיות לעבודה שלי',
].map((text, index) => ({
  id: `block_resource_${index + 1}`,
  kind: 'analytic',
  text,
  required: index < 6,
  enabled: true,
  sectionId: 'משאבים בעבודה',
  dimensionId: index % 2 === 0 ? 'social-resource' : 'self-expression',
  scaleId: 'likert-5-extent',
  polarity: 'positive',
}));

const BURNOUT_BLOCK: SurveyDefinitionQuestion[] = [
  'אני מרגיש/ה שחוק/ה בסוף יום העבודה',
  'קשה לי להתנתק מהעבודה בערב',
  'אני מרגיש/ה שאין לי אנרגיה למשפחה אחרי העבודה',
].map((text, index) => ({
  id: `block_burnout_${index + 1}`,
  kind: 'analytic',
  text,
  required: true,
  enabled: true,
  sectionId: 'שאלון שחיקה',
  dimensionId: 'balance',
  scaleId: 'likert-7-frequency',
  // A high answer here is bad for `balance`, which is the case the single
  // colour scale never had.
  polarity: 'negative',
}));

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

const RESPONDENT_ORGANIZATION_ID = 'local-respondent-walk-school';

/** Four responses in two categories: enough to group, too few to publish. */
const LOCKED_COHORTS: typeof COHORTS = [
  { categoryId: 'veteran', count: 2, bias: 0 },
  { categoryId: 'mid', count: 2, bias: 1 },
];

/** The first analytic question of each dimension, in questionnaire order. */
function onePerDimension(
  questions: readonly SurveyDefinitionQuestion[],
): SurveyDefinitionQuestion[] {
  const taken = new Set<string>();

  return questions.filter((question) => {
    if (!isAnalyticQuestion(question) || taken.has(question.dimensionId)) {
      return false;
    }
    taken.add(question.dimensionId);
    return true;
  });
}

async function main() {
  const host = requireLocalDatabase();
  const isLocked = process.argv.includes('--locked');
  const isRespondentWalk = process.argv.includes('--respondent');
  const cohorts = isRespondentWalk ? [] : isLocked ? LOCKED_COHORTS : COHORTS;
  const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
  const organizationId = isRespondentWalk
    ? RESPONDENT_ORGANIZATION_ID
    : resolveManagerOrganizationId() ?? 'local-dev-organization';

  const existing = await orgRepo.findById(organizationId);
  if (!existing && !isRespondentWalk) {
    throw new Error(
      `No organization ${organizationId}. Run npx tsx scripts/seed-local.ts first.`,
    );
  }
  if (!existing && isRespondentWalk) {
    await orgRepo.create({
      id: organizationId,
      name: 'בית ספר להליכת משיבים',
      city: 'חיפה',
      schoolType: 'תיכון',
      totalStaffCount: 20,
      createdAt: SEEDED_AT,
    });
  }

  const canonical = createCanonicalSurveyDefinition(
    isRespondentWalk
      ? 'סבב מענה עם שאלות רקע'
      : isLocked
        ? 'סבב פילוח נעול'
        : 'סבב פילוח מקומי',
    10,
  );
  const definition = {
    ...canonical,
    questions: [
      // The respondent walk keeps one analytic question per dimension rather
      // than all twenty-four. It exists to reach the background widgets, and
      // sixteen extra colour taps before the first of them is a worse test, not
      // a fuller one. It cannot go below eight: the submit route parses the
      // definition with the activation rules, which require every dimension to
      // be covered, and a shorter questionnaire is refused with
      // `DEFINITION_INVALID` at the end of the walk.
      ...(isRespondentWalk
        ? onePerDimension(canonical.questions)
        : canonical.questions),
      ...(isRespondentWalk ? [...RESOURCE_BLOCK, ...BURNOUT_BLOCK] : []),
      TENURE_QUESTION,
      ROLE_QUESTION,
      ...(isRespondentWalk ? [HOURS_QUESTION, ...LOAD_GRID] : []),
    ],
  };
  const analyticQuestions = definition.questions
    .filter((question) => question.enabled)
    .filter(isAnalyticQuestion);

  let roundId = `round_breakdown_${SEEDED_AT.getTime()}`;
  // Unique per run, because the script is meant to be re-run and a share code
  // is unique across the database. The respondent walk gets a stable one: the
  // whole point of it is a link somebody opens by hand.
  const shareCode = isRespondentWalk
    ? RESPONDENT_SHARE_CODE
    : `${SHARE_CODE}${isLocked ? '-LOCKED' : ''}-${SEEDED_AT.getTime()}`;

  // The respondent walk's share code is stable, so a second run finds its own
  // round rather than colliding with it. Re-running is the normal case: the
  // questionnaire under walk changes while the widgets are being built.
  const alreadyThere = await roundRepo.findByShareCode(shareCode);
  if (alreadyThere) {
    await roundRepo.update(alreadyThere.id, { surveyDefinition: definition });
    roundId = alreadyThere.id;
  } else {
    await roundRepo.create({
      id: roundId,
      organizationId,
      title: definition.title,
      status: isRespondentWalk ? 'active' : 'closed',
      shareCode,
      privacyThreshold: 10,
      startDate: SEEDED_AT,
      surveyDefinition: definition,
      createdAt: SEEDED_AT,
    });
  }

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
      `  organization ${organizationId}`,
      `  round        ${roundId} (${shareCode}, ` +
        `${isRespondentWalk ? 'active' : 'closed'}, threshold 10)`,
      `  responses    ${written}`,
      ...cohorts.map(
        (cohort) =>
          `    ${(cohort.categoryId ?? 'no answer').padEnd(10)} ${cohort.count}`,
      ),
      '',
      isRespondentWalk
        ? `Open /answer/${shareCode} and answer it. Eight colour questions, ` +
          'then an eight-statement block on the 1–5 scale, a three-statement ' +
          'block on the 1–7 one, two single-choice questions, a numeric field ' +
          'and a three-row allocation grid — every widget is on the path.'
        : 'Open /breakdown and choose this round. `new` has four respondents, ' +
          'so it must be suppressed — and one more category must go with it, ' +
          'or the four would be recoverable by subtraction.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
