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
 * The two rounds no longer ask the same questionnaire. The closed one carries
 * two background questions so that `/breakdown` has something to group by and
 * something to switch between; the active one deliberately carries neither,
 * because it is the round the respondent end-to-end test fills in and that test
 * knows only the wellbeing stones. The closed round also carries the goals
 * `/goals` lists, which would otherwise need a paid analysis run before that
 * screen said anything.
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
import { isBackgroundQuestion } from '@/lib/types/backend';
import type {
  AnswerValue,
  BackgroundSurveyQuestion,
  SurveyDefinition,
  SurveyResponseRecord,
} from '@/lib/types/backend';
import type { WellbeingDimensionId } from '@/lib/shalomut-source';
import type { RoundGoalStatus } from '@/lib/types/round-goal';

/**
 * Thirty rather than twelve, which is what the breakdown screen costs.
 *
 * Twelve cleared the privacy threshold for the round as a whole, and that was
 * all any screen needed while every published number was about everyone in the
 * round. `/breakdown` publishes numbers about *groups*, and a group is judged
 * against the same threshold of ten — so twelve respondents split into groups
 * are twelve respondents in groups of six, and the entire table comes back
 * blanked. See `tenureFor` for how the thirty are divided.
 */
const RESPONSE_COUNT = 30;
const SHARE_CODE = 'SHALOM-LOCAL';
const SEEDED_AT = new Date();

/**
 * A flat round teaches nothing: the dashboard is only worth looking at when the
 * dimensions differ and the answers inside a question are split.
 */
function answerFor(
  dimensionId: string,
  responseIndex: number,
  tenure: string | undefined,
): AnswerValue {
  // The one dimension the seeded round makes depend on tenure, and the reason
  // `/breakdown` is worth opening. `answerFor` otherwise varies an answer by
  // response index while the tenure groups are contiguous blocks of indices, so
  // the two published columns held the same distribution and the table compared
  // a group with itself — a screen that reads the same whether the columns are
  // mapped correctly or mirrored proves nothing about the code that built it.
  if (dimensionId === 'social-resource') {
    return tenure === 'veteran'
      ? responseIndex % 5 === 0
        ? 'yellow'
        : 'green'
      : responseIndex % 3 === 0
        ? 'green'
        : 'yellow';
  }
  if (dimensionId === 'balance') {
    return responseIndex % 3 === 0 ? 'yellow' : 'red';
  }
  if (dimensionId === 'organizational-climate') {
    return responseIndex % 2 === 0 ? 'green' : 'red';
  }
  // `certainty`, not `workload`: the eight dimension ids are fixed in
  // `wellbeing-dimensions.ts` and `workload` is not one of them, so this branch
  // had never once been taken and the seeded map varied three dimensions while
  // claiming four.
  if (dimensionId === 'certainty') {
    return responseIndex % 4 === 0 ? 'red' : 'yellow';
  }
  return responseIndex % 5 === 0 ? 'yellow' : 'green';
}

function scoreFor(value: AnswerValue): number {
  return value === 'green' ? 100 : value === 'yellow' ? 60 : 0;
}

/**
 * The background questions the seeded round asks.
 *
 * The canonical instrument is analytic from end to end, so a seeded round had
 * no question `/breakdown` could group by and every walk of that screen read
 * its empty state. They are added to the closed round only. The active round is
 * the one `e2e/respondent-answers.spec.ts` fills in, and that test answers
 * every step by clicking one of the three wellbeing stones — which a
 * single-choice demographic step does not offer.
 *
 * Two of them rather than one, because the chooser that switches between them
 * renders nothing at all below two (`breakdown-question-picker.tsx`), and a
 * control no seeded round can display is a control nobody has ever looked at.
 */
const TENURE_QUESTION: BackgroundSurveyQuestion = {
  id: 'background-tenure',
  text: 'כמה שנים את/ה מלמד/ת?',
  required: false,
  enabled: true,
  kind: 'background',
  answerMode: 'single-choice',
  options: [
    { value: 'veteran', label: 'מעל עשר שנים' },
    { value: 'mid', label: 'שלוש עד עשר שנים' },
    { value: 'new', label: 'עד שלוש שנים' },
  ],
};

const STAGE_QUESTION: BackgroundSurveyQuestion = {
  id: 'background-stage',
  text: 'באיזו שכבה את/ה מלמד/ת בעיקר?',
  required: false,
  enabled: true,
  kind: 'background',
  answerMode: 'single-choice',
  options: [
    { value: 'primary', label: 'יסודי' },
    { value: 'middle', label: 'חטיבת ביניים' },
    { value: 'upper', label: 'חטיבה עליונה' },
  ],
};

/**
 * Which tenure group one response falls into, or `undefined` for a respondent
 * who skipped the question — background questions are optional, and the screen
 * reports the people who skipped as a category of their own.
 *
 * The four sizes are chosen rather than even. A breakdown is only worth looking
 * at when both of its states are on the screen at once, so ten `veteran` and
 * ten `mid` reach the threshold and publish, while five `new` and five who
 * skipped fall under it and are blanked. Five and five rather than seven and
 * three because the blanks on a line must also account for at least ten people
 * between them (`privacy/cell-suppression.ts`, rule 2) — otherwise the table is
 * closed under subtraction by blanking a third group, and the screen loses the
 * published half it exists to show.
 */
function tenureFor(responseIndex: number): string | undefined {
  if (responseIndex < 10) return 'veteran';
  if (responseIndex < 20) return 'mid';
  if (responseIndex < 25) return 'new';
  return undefined;
}

/**
 * Which teaching stage one response reports.
 *
 * Ten, ten and ten, so this table publishes every group and blanks nothing —
 * the opposite state to the tenure table, and the reason for asking two
 * questions rather than one. It also cuts across the tenure blocks instead of
 * following them, so the two tables really do divide the same thirty people
 * differently rather than showing one partition under two headings.
 *
 * The extra step every third response is what keeps it from lining up with
 * `answerFor`, which varies its answers every second, third, fourth and fifth
 * response. A plain `responseIndex % 3` gave three groups of ten that each
 * matched one of those cycles exactly, and the balance row came out as 60, 0
 * and 0 — three columns that read as a broken screen rather than as data.
 */
function stageFor(responseIndex: number): string | undefined {
  const stages = ['primary', 'middle', 'upper'];
  return stages[(responseIndex + Math.floor(responseIndex / 3)) % stages.length];
}

/** What one response answers a background question with, if it answers at all. */
function backgroundAnswerFor(
  questionId: string,
  responseIndex: number,
): string | undefined {
  if (questionId === TENURE_QUESTION.id) return tenureFor(responseIndex);
  if (questionId === STAGE_QUESTION.id) return stageFor(responseIndex);
  return undefined;
}

/**
 * Goals on the closed round, one per status.
 *
 * A goal is normally born from an AI recommendation the manager pressed, which
 * needs a paid analysis run before `/goals` has anything on it at all. These
 * are written here instead so the screen can be read without one, and one goal
 * per status because the three states are the whole vocabulary of the feature:
 * the two groups the screen sorts into (`פתוחים`, `הושלמו`) are both non-empty
 * only when a `done` goal exists beside the others.
 *
 * The dimensions are the two the seeded answers actually score badly, so the
 * goals read as decisions someone made after looking at the map rather than as
 * filler.
 */
const SEEDED_GOALS: readonly {
  dimensionId: WellbeingDimensionId;
  title: string;
  body: string;
  status: RoundGoalStatus;
}[] = [
  {
    dimensionId: 'balance',
    title: 'לקבוע יום בשבוע בלי ישיבות אחרי שעות ההוראה',
    body:
      'רוב הצוות סימן אדום באיזון בין העבודה לחיים הפרטיים. יום קבוע ופנוי ' +
      'משיבות הוא הצעד שאפשר להתחיל בו החודש, בלי לשנות את מערכת השעות.',
    status: 'in_progress',
  },
  {
    dimensionId: 'certainty',
    title: 'להודיע על שינויים במערכת לפחות שבוע מראש',
    body:
      'תחושת הוודאות נמוכה, והשינויים שמגיעים ביום ההוראה עצמו הם מה שהצוות ' +
      'מדווח עליו. לוח זמנים קבוע להודעות הוא שינוי ניהולי ולא תקציבי.',
    status: 'selected',
  },
  {
    dimensionId: 'organizational-climate',
    title: 'לפתוח כל ישיבת צוות בעדכון קצר מהשטח',
    body:
      'האקלים הארגוני מפוצל בין מי שמרגיש שותף למי שלא. חמש דקות פתיחה שבהן ' +
      'מדבר מי שאינו בהנהלה כבר שינו את מהלך הישיבות.',
    status: 'done',
  },
];

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
  const { orgRepo, roundRepo, surveyRepo, roundGoalRepo } =
    resolveCoreRepositories();

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

  const canonical = createCanonicalSurveyDefinition('סבב בדיקה מקומי', 10);
  const withBackground: SurveyDefinition = {
    ...canonical,
    questions: [...canonical.questions, TENURE_QUESTION, STAGE_QUESTION],
  };

  async function seedRound(
    suffix: string,
    title: string,
    status: 'active' | 'closed',
    shareCode: string,
    // Older than the active one, so the manager still lands on the round their
    // school is working on rather than on last term's.
    createdAt: Date,
    definition: SurveyDefinition,
  ): Promise<string> {
    const questions = definition.questions.filter((question) => question.enabled);

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
        // `flatMap`, because a background answer is not one per question per
        // response: a respondent who skipped the demographic question stores
        // nothing for it, which is what puts them in the unanswered category
        // rather than in one of the declared ones.
        answers: questions.flatMap((question) => {
          if (isBackgroundQuestion(question)) {
            const choice = backgroundAnswerFor(question.id, index);
            return choice ? [{ questionId: question.id, value: choice }] : [];
          }

          const value = answerFor(question.dimensionId, index, tenureFor(index));
          return [
            {
              questionId: question.id,
              dimensionId: question.dimensionId,
              value,
              score: scoreFor(value),
            },
          ];
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
    withBackground,
  );
  const activeRoundId = await seedRound(
    'active',
    'סבב פעיל',
    'active',
    SHARE_CODE,
    SEEDED_AT,
    canonical,
  );

  // On the closed round, because that is the round with results behind it and
  // the one the goals could honestly have come from.
  for (const goal of SEEDED_GOALS) {
    const result = await roundGoalRepo.create(closedRoundId, {
      dimensionId: goal.dimensionId,
      title: goal.title,
      body: goal.body,
    });
    // A goal is born `selected`; the other two states are reached the way a
    // manager reaches them, by moving an existing goal.
    if (goal.status !== 'selected') {
      await roundGoalRepo.updateStatus(closedRoundId, result.goal.id, goal.status);
    }
  }

  console.log(
    [
      `Seeded ${host}:`,
      `  organization ${organizationId}`,
      `  closed round ${closedRoundId} (${SHARE_CODE}-CLOSED, threshold 10)`,
      `  active round ${activeRoundId} (${SHARE_CODE}, threshold 10)`,
      `  responses    ${RESPONSE_COUNT} on each round`,
      `  goals        ${SEEDED_GOALS.length} on the closed round`,
      '',
      'The closed round is above the privacy threshold, so its map opens and the',
      'AI analysis can be triggered for it from the round screen. The active one',
      `is what /answer/${SHARE_CODE} opens; its own map stays locked until it is`,
      'closed, and the round switcher on that screen reaches the closed round.',
      '',
      'Only the closed round asks the background questions, so /breakdown is the',
      'second screen after the map that the round switcher has to be used to',
      'reach. Grouped by tenure, two of its four groups publish and two are',
      'blanked; grouped by teaching stage, all three publish. /goals is not',
      'round-scoped and shows the three seeded goals whichever round is chosen.',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
