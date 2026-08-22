import 'dotenv/config';
import { resolvePoolConfig } from '@/lib/repositories/prisma/pool-options';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';

/**
 * Give every round that has no questionnaire snapshot the one it is already
 * being read against.
 *
 * `SurveyRound.surveyDefinition` is nullable, and a round holding null is
 * scored against `surveyInstrument.questions` — the canonical 24 — through the
 * default parameter of `SurveyService.validateInput`, `processSubmission` and
 * `AnalyticsService`. That fallback is why "replace the default questionnaire"
 * cannot simply delete those 24: a round with no snapshot would stop being
 * validated and aggregated, and its stored answers, keyed by the old question
 * ids, would no longer match anything.
 *
 * Writing the snapshot down makes the implicit explicit. **It changes no
 * round's behaviour** — the definition written is exactly the one the fallback
 * was already supplying — and it is what lets the fallback be removed later
 * without a silent change of meaning.
 *
 * Idempotent: a round that already has a definition is left alone, so this can
 * be re-run and can be run against both databases independently.
 *
 * Usage:
 *   npx tsx scripts/backfill-round-definitions.ts            # report only
 *   npx tsx scripts/backfill-round-definitions.ts --confirm  # write
 */
async function backfillRoundDefinitions() {
  const confirm = process.argv.slice(2).includes('--confirm');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  console.log(`🔄 Connecting to ${new URL(connectionString).hostname}...`);

  const { PrismaClient, Prisma } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const pg = require('pg');

  const pool = new pg.Pool(resolvePoolConfig(connectionString));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // `Prisma.DbNull`, not `null`. On a nullable `Json` column Prisma treats a
  // bare `null` as ambiguous between a SQL NULL and a stored JSON `null`, and
  // silently matches neither — the first run of this script reported "every
  // round already carries a snapshot" while a round with a NULL column sat in
  // front of it.
  const hasNoDefinition = { surveyDefinition: { equals: Prisma.DbNull } };

  try {
    const rounds = await prisma.surveyRound.findMany({
      where: hasNoDefinition,
      select: {
        id: true,
        title: true,
        status: true,
        privacyThreshold: true,
        organization: { select: { name: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (rounds.length === 0) {
      console.log('✅ Every round already carries a questionnaire snapshot.');
      return;
    }

    console.log(`\nRounds with no snapshot: ${rounds.length}`);
    for (const round of rounds) {
      console.log(
        `  ${round.id}  ${round.organization.name} / ${round.title}` +
          `  [${round.status}]  ${round._count.responses} responses`,
      );
    }

    if (!confirm) {
      console.log(
        '\nReport only. Re-run with --confirm to write the canonical ' +
          'snapshot onto each of them.',
      );
      return;
    }

    let written = 0;
    for (const round of rounds) {
      // The round's own title and threshold, because that is what the
      // fallback's `createCanonicalSurveyDefinition(round.title,
      // round.privacyThreshold)` produced at read time. Anything else would
      // change what the round says about itself.
      const definition = createCanonicalSurveyDefinition(
        round.title,
        round.privacyThreshold,
      );

      // Guarded on still being null, so two runs racing cannot overwrite a
      // definition a manager saved in between.
      const result = await prisma.surveyRound.updateMany({
        where: { id: round.id, ...hasNoDefinition },
        data: { surveyDefinition: definition },
      });
      written += result.count;
    }

    console.log(`\n✅ Wrote a snapshot onto ${written} of ${rounds.length} rounds.`);
    if (written !== rounds.length) {
      console.log(
        '   The difference is rounds that gained a definition while this ran.',
      );
    }
  } finally {
    await pool.end();
  }
}

backfillRoundDefinitions().catch((error) => {
  console.error(error);
  process.exit(1);
});
