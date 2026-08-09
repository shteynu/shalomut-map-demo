import 'dotenv/config';
import { resolvePoolSsl } from '@/lib/repositories/prisma/pool-options';

/**
 * Delete named schools and rounds, rather than the whole database.
 *
 * `db:clear` empties every table, which is right for a local reset and wrong
 * for the deployed endpoint: the schools there are the manager's own, and a
 * smoke walk leaves a handful of throwaway ones beside them. This removes only
 * the ids it is given.
 *
 * Every relation cascades from `Organization` and from `SurveyRound`, so a
 * school takes its rounds, goals, questionnaire versions, AI runs, responses
 * and answers with it, and a round takes everything below it. Nothing here has
 * to delete in order.
 *
 * Usage:
 *   npx tsx scripts/clear-test-data.ts --school=<id> [--round=<id>] --confirm
 *
 * Without `--confirm` it only reports what it would delete.
 */

interface Target {
  schools: string[];
  rounds: string[];
  confirm: boolean;
}

function parseArguments(argv: string[]): Target {
  const target: Target = { schools: [], rounds: [], confirm: false };

  for (const argument of argv) {
    if (argument === '--confirm') {
      target.confirm = true;
      continue;
    }

    const match = /^--(school|round)=(.+)$/.exec(argument);
    if (!match) {
      throw new Error(`Unrecognised argument: ${argument}`);
    }

    if (match[1] === 'school') target.schools.push(match[2]);
    else target.rounds.push(match[2]);
  }

  if (target.schools.length === 0 && target.rounds.length === 0) {
    throw new Error(
      'Nothing to delete. Pass at least one --school=<id> or --round=<id>.',
    );
  }

  return target;
}

async function clearTestData() {
  const target = parseArguments(process.argv.slice(2));

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Which database is about to lose rows is the one thing worth printing: the
  // local container and the deployed Supabase are both plausible targets and
  // the command reads the same either way.
  console.log(`🔄 Connecting to ${new URL(connectionString).hostname}...`);

  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const pg = require('pg');

  const pool = new pg.Pool({
    connectionString,
    ssl: resolvePoolSsl(connectionString),
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Read before writing, and name what was found. An id that is already gone
    // is reported rather than treated as a failure, so re-running is safe.
    const schools = await prisma.organization.findMany({
      where: { id: { in: target.schools } },
      select: { id: true, name: true, _count: { select: { rounds: true } } },
    });
    const rounds = await prisma.surveyRound.findMany({
      where: { id: { in: target.rounds } },
      select: {
        id: true,
        title: true,
        status: true,
        organization: { select: { name: true } },
        _count: { select: { responses: true } },
      },
    });

    for (const id of target.schools) {
      const found = schools.find((school: { id: string }) => school.id === id);
      console.log(
        found
          ? ` • school ${id} — ${found.name} (${found._count.rounds} rounds)`
          : ` • school ${id} — not present, nothing to delete`,
      );
    }
    for (const id of target.rounds) {
      const found = rounds.find((round: { id: string }) => round.id === id);
      console.log(
        found
          ? ` • round  ${id} — ${found.organization.name} / ${found.title}` +
              ` (${found.status}, ${found._count.responses} responses)`
          : ` • round  ${id} — not present, nothing to delete`,
      );
    }

    if (!target.confirm) {
      console.log('\nDry run. Re-run with --confirm to delete the above.');
      return;
    }

    // Rounds first: deleting a school cascades its rounds away, and a round id
    // that belonged to a school on the same command line would otherwise look
    // like it had vanished on its own.
    const roundsDeleted = await prisma.surveyRound.deleteMany({
      where: { id: { in: target.rounds } },
    });
    const schoolsDeleted = await prisma.organization.deleteMany({
      where: { id: { in: target.schools } },
    });

    console.log(
      `\n✅ Deleted ${schoolsDeleted.count} schools and ` +
        `${roundsDeleted.count} rounds, with everything below them.`,
    );
    console.log('📊 Remaining:', {
      organizations: await prisma.organization.count(),
      rounds: await prisma.surveyRound.count(),
      responses: await prisma.surveyResponse.count(),
      answers: await prisma.questionAnswer.count(),
    });
  } catch (error) {
    console.error('❌ Error clearing test data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearTestData().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
