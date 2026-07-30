import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// The same two files Next.js reads, in the same order of precedence, so the
// inspector looks at the database the application looks at — the local one.
// To inspect the deployed database, pass its URL on the command line:
// a real environment variable outranks both files.
//
// `.env.staging.local` used to be read first and won over everything, which
// silently pointed this script at the deployed Supabase whatever `.env` said.
// There is no staging environment any more; that file is not consulted.
for (const envFile of ['.env.local', '.env']) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) continue;

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    // An empty value must not shadow a real one in the next file: dotenv treats
    // "" as a value, and the inspector then quietly runs with no database.
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

import { getRepositories } from '../src/lib/repositories';
import { getPrismaClient } from '../src/lib/repositories/prisma/prisma-client';

async function main() {
  const targetRoundId = process.argv[2];

  console.log('=== Shalomut AI Provenance Inspector ===\n');

  const prisma = getPrismaClient();
  let roundId = targetRoundId;
  let aiInsights: any = null;
  let roundTitle = '';

  if (prisma) {
    console.log('Using Prisma Database connection...');
    if (!roundId) {
      const firstRound = await prisma.surveyRound.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (firstRound) {
        roundId = firstRound.id;
        roundTitle = firstRound.title;
        aiInsights = firstRound.aiInsights;
      }
    } else {
      const found = await prisma.surveyRound.findFirst({
        where: {
          OR: [{ id: roundId }, { shareCode: roundId }],
        },
      });
      if (found) {
        roundId = found.id;
        roundTitle = found.title;
        aiInsights = found.aiInsights;
      }
    }
  } else {
    console.log('No Prisma client available, fallback to repository abstraction...');
    const repos = getRepositories();
    if (!roundId) {
      const orgs = await repos.orgRepo.findAll();
      for (const org of orgs) {
        const rounds = await repos.roundRepo.findByOrganizationId(org.id);
        if (rounds.length > 0) {
          roundId = rounds[0].id;
          roundTitle = rounds[0].title;
          aiInsights = await repos.roundRepo.getAiInsights(roundId);
          break;
        }
      }
    } else {
      const found = (await repos.roundRepo.findById(roundId)) || (await repos.roundRepo.findByShareCode(roundId));
      if (found) {
        roundId = found.id;
        roundTitle = found.title;
        aiInsights = await repos.roundRepo.getAiInsights(roundId);
      }
    }
  }

  if (!roundId) {
    console.log('No round found in database or repository.');
    process.exit(1);
  }

  console.log(`Round ID: ${roundId}`);
  console.log(`Round Title: ${roundTitle || 'N/A'}`);

  if (!aiInsights) {
    console.log('\nResult: No aiInsights persisted for this round yet.');
    process.exit(0);
  }

  console.log(`Contract Version: ${aiInsights.contractVersion || 'N/A'}`);
  console.log(`AI Insights Status: ${aiInsights.status || 'N/A'}`);
  console.log(`Processed At: ${aiInsights.processedAt || 'N/A'}`);
  console.log(`Overall Summary: ${aiInsights.overallPsychologicalSummary || 'N/A'}`);
  console.log(`Payload Keys: ${Object.keys(aiInsights).join(', ')}`);

  // Handle difference between stones array vs dimensionScores / stones map
  let stonesList: any[] = [];
  if (Array.isArray(aiInsights.stones)) {
    stonesList = aiInsights.stones;
  } else if (aiInsights.stones && typeof aiInsights.stones === 'object') {
    stonesList = Object.entries(aiInsights.stones).map(([id, val]: [string, any]) => ({
      dimensionId: id,
      ...val,
    }));
  } else if (aiInsights.dimensionScores && typeof aiInsights.dimensionScores === 'object') {
    stonesList = Object.entries(aiInsights.dimensionScores).map(([id, val]: [string, any]) => ({
      dimensionId: id,
      ...val,
    }));
  }

  console.log(`\n--- Stones / Dimensions Provenance (${stonesList.length} items) ---`);

  let llmCount = 0;
  let fallbackCount = 0;
  let otherCount = 0;

  for (const stone of stonesList) {
    const prov = stone.generationProvenance || {};
    const outcome = prov.outcome || 'unknown';
    const attempts = prov.attempts ?? 'N/A';
    const retryCount = prov.retryCount ?? 'N/A';
    const dimId = stone.dimensionId || stone.id || 'unknown';

    // A deterministic fallback now arrives by two roads and they mean opposite
    // things about the provider: a green dimension the switch kept away from it
    // spent no attempt, while one that was asked and refused spent all of them.
    // Reading the attempt count for that is exactly the kind of inference a
    // diagnostic should do for its reader.
    const note =
      outcome === 'deterministic_fallback'
        ? attempts === 0
          ? '  ← not asked (ONLY_LLM_FOR_PROBLEMATIC)'
          : '  ← asked and refused'
        : '';

    console.log(
      `Dimension: ${dimId.padEnd(25)} | Outcome: ${outcome.padEnd(22)} | Attempts: ${attempts} | Retries: ${retryCount}${note}`
    );

    if (outcome === 'llm') {
      llmCount++;
    } else if (outcome === 'deterministic_fallback' || outcome === 'heuristic') {
      fallbackCount++;
    } else {
      otherCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total stones: ${stonesList.length}`);
  console.log(`LLM generated: ${llmCount}`);
  console.log(`Fallback / Heuristic: ${fallbackCount}`);
  console.log(`Other: ${otherCount}`);

  if (stonesList.length > 0 && llmCount === 0) {
    console.log(
      '\n⚠️ WARNING: All stones used deterministic_fallback / heuristic. LLM is NOT operating correctly (check LLM_API_KEY or contract validations).'
    );
  } else if (llmCount > 0) {
    console.log('\n✅ SUCCESS: LLM is operating and generating responses!');
  }
}

main().catch((err) => {
  console.error('Error running provenance inspector:', err);
  process.exit(1);
});
