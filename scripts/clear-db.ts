import 'dotenv/config';
import { resolvePoolSsl } from '@/lib/repositories/prisma/pool-options';

async function clearDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Which database is about to lose its rows is the only thing worth printing
  // here: the local container and the deployed Supabase are both plausible
  // targets, and the command reads the same either way.
  console.log(
    `🔄 Connecting to ${new URL(connectionString).hostname}...`,
  );

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
    console.log('🗑️  Clearing all data tables...');
    
    const answersDeleted = await prisma.questionAnswer.deleteMany({});
    console.log(` - Deleted ${answersDeleted.count} question answers`);

    const attemptsDeleted = await prisma.surveyAttempt.deleteMany({});
    console.log(` - Deleted ${attemptsDeleted.count} survey attempts`);

    const responsesDeleted = await prisma.surveyResponse.deleteMany({});
    console.log(` - Deleted ${responsesDeleted.count} survey responses`);

    const roundsDeleted = await prisma.surveyRound.deleteMany({});
    console.log(` - Deleted ${roundsDeleted.count} survey rounds`);

    const orgsDeleted = await prisma.organization.deleteMany({});
    console.log(` - Deleted ${orgsDeleted.count} organizations`);

    const counts = {
      organizations: await prisma.organization.count(),
      rounds: await prisma.surveyRound.count(),
      responses: await prisma.surveyResponse.count(),
      attempts: await prisma.surveyAttempt.count(),
      answers: await prisma.questionAnswer.count(),
    };

    console.log('✅ Database successfully cleared!');
    console.log('📊 Verification counts:', counts);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearDatabase();
