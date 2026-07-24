import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function clearDatabase() {
  console.log('🔄 Connecting to PostgreSQL database (Supabase)...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('🗑️  Clearing all data tables...');
    
    const answersDeleted = await prisma.questionAnswer.deleteMany({});
    console.log(` - Deleted ${answersDeleted.count} question answers`);

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
