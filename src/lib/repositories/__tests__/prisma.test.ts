import assert from 'node:assert';
import test from 'node:test';
import {
  PrismaAiInsightsRepository,
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { surveyInstrument } from '../../shalomut-source';

/**
 * Deletes every stored record whose fields all match `where`; an absent or
 * empty `where` clears the store, the way `clear-db.ts` calls it.
 */
function deleteMatching(store: Map<string, any>, where?: any) {
  let count = 0;
  for (const [key, record] of store) {
    const matches =
      !where ||
      Object.entries(where).every(([field, value]) => record[field] === value);
    if (matches) {
      store.delete(key);
      count++;
    }
  }
  return { count };
}

function createMockPrismaClient(): MinimalPrismaClient {
  const orgs = new Map<string, any>();
  const rounds = new Map<string, any>();
  const responses = new Map<string, any>();

  return {
    organization: {
      create: async ({ data }: any) => {
        orgs.set(data.id, { ...data });
        return data;
      },
      findUnique: async ({ where }: any) => orgs.get(where.id) || null,
      findMany: async () => Array.from(orgs.values()),
      update: async ({ where, data }: any) => {
        const existing = orgs.get(where.id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data };
        orgs.set(where.id, updated);
        return updated;
      },
      deleteMany: async (args?: any) => deleteMatching(orgs, args?.where),
    },
    surveyRound: {
      create: async ({ data }: any) => {
        rounds.set(data.id, { ...data });
        return data;
      },
      findUnique: async ({ where }: any) => rounds.get(where.id) || null,
      findFirst: async ({ where }: any) => {
        for (const r of rounds.values()) {
          if (
            where.shareCode?.equals &&
            r.shareCode.toLowerCase() === where.shareCode.equals.toLowerCase()
          ) {
            return r;
          }
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const results = [];
        for (const r of rounds.values()) {
          if (!where?.organizationId || r.organizationId === where.organizationId) {
            results.push(r);
          }
        }
        return results;
      },
      update: async ({ where, data }: any) => {
        const existing = rounds.get(where.id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data };
        rounds.set(where.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: any) => {
        const existing = rounds.get(where.id);
        if (!existing) return { count: 0 };

        if (where.aiInsights === null && existing.aiInsights != null) {
          return { count: 0 };
        }

        if (Array.isArray(where.OR)) {
          const claimedAt = existing.aiInsightsUpdatedAt
            ? new Date(existing.aiInsightsUpdatedAt)
            : null;
          const leaseCutoff = where.OR.find(
            (clause: any) => clause.aiInsightsUpdatedAt?.lt,
          )?.aiInsightsUpdatedAt.lt as Date | undefined;
          const leaseExpired =
            claimedAt === null ||
            (leaseCutoff !== undefined && claimedAt < leaseCutoff);
          if (!leaseExpired) return { count: 0 };
        }

        rounds.set(where.id, { ...existing, ...data });
        return { count: 1 };
      },
      deleteMany: async (args?: any) => deleteMatching(rounds, args?.where),
    },
    surveyResponse: {
      create: async ({ data, include }: any) => {
        const answers = data.answers?.create || [];
        const record = {
          ...data,
          answers,
        };
        responses.set(data.id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        const results = [];
        for (const res of responses.values()) {
          if (!where?.roundId || res.roundId === where.roundId) {
            results.push(res);
          }
        }
        return results;
      },
      findFirst: async ({ where }: any) => {
        for (const res of responses.values()) {
          if (
            res.roundId === where.roundId &&
            res.anonymousTokenHash === where.anonymousTokenHash
          ) {
            return res;
          }
        }
        return null;
      },
      count: async ({ where }: any) => {
        let count = 0;
        for (const res of responses.values()) {
          if (!where?.roundId || res.roundId === where.roundId) {
            count++;
          }
        }
        return count;
      },
      // Only the shape the repository asks for: group by round, count all,
      // restricted to a named list. A round with no responses is absent from
      // the result, which is what PostgreSQL answers too.
      groupBy: async ({ where }: any) => {
        const wanted: string[] | undefined = where?.roundId?.in;
        const counts = new Map<string, number>();
        for (const res of responses.values()) {
          if (wanted && !wanted.includes(res.roundId)) continue;
          counts.set(res.roundId, (counts.get(res.roundId) ?? 0) + 1);
        }
        return Array.from(counts, ([roundId, all]) => ({
          roundId,
          _count: { _all: all },
        }));
      },
      deleteMany: async (args?: any) => deleteMatching(responses, args?.where),
    },
  };
}

test('PrismaOrganizationRepository integrates with Prisma Client contract', async () => {
  const mockPrisma = createMockPrismaClient();
  const orgRepo = new PrismaOrganizationRepository(mockPrisma);

  const org = await orgRepo.create({
    id: 'org_prisma_1',
    name: 'בית ספר גורדון',
    city: 'תל אביב',
    schoolType: 'יסודי',
    totalStaffCount: 25,
    createdAt: new Date(),
  });

  assert.strictEqual(org.id, 'org_prisma_1');
  const found = await orgRepo.findById('org_prisma_1');
  assert.strictEqual(found?.name, 'בית ספר גורדון');

  const updated = await orgRepo.update('org_prisma_1', {
    totalStaffCount: 31,
  });
  assert.strictEqual(updated?.totalStaffCount, 31);
});

test('PrismaRoundRepository creates rounds and updates status', async () => {
  const mockPrisma = createMockPrismaClient();
  const roundRepo = new PrismaRoundRepository(mockPrisma);

  const round = await roundRepo.create({
    id: 'round_prisma_1',
    organizationId: 'org_prisma_1',
    title: 'סקר מחצית א',
    status: 'active',
    shareCode: 'SHALOM-PRISMA',
    privacyThreshold: 10,
    startDate: new Date(),
    createdAt: new Date(),
  });

  assert.strictEqual(round.shareCode, 'SHALOM-PRISMA');
  assert.strictEqual(round.backgroundContext, undefined);

  const byCode = await roundRepo.findByShareCode('SHALOM-PRISMA');
  assert.strictEqual(byCode?.id, 'round_prisma_1');

  const updated = await roundRepo.updateStatus(
    'round_prisma_1',
    'closed',
    'active',
  );
  assert.strictEqual(updated.outcome, 'written');
  assert.strictEqual(
    updated.outcome === 'written' ? updated.round.status : null,
    'closed',
  );

  const configured = await roundRepo.update('round_prisma_1', {
    backgroundContext: {
      notes: 'רקע ניהולי',
      audience: 'all-staff',
      sicknessDaysThisQuarter: 3,
      newStaffMembers: 2,
      studentCount: 400,
      socioEconomicIndex: 6,
      classesPerGrade: { א: 3 },
    },
  });
  assert.deepStrictEqual(configured?.backgroundContext, {
    notes: 'רקע ניהולי',
    audience: 'all-staff',
    sicknessDaysThisQuarter: 3,
    newStaffMembers: 2,
    studentCount: 400,
    socioEconomicIndex: 6,
    classesPerGrade: { א: 3 },
  });
});

test('PrismaRoundRepository normalizes partial persisted background context', async () => {
  const mockPrisma = createMockPrismaClient();
  const roundRepo = new PrismaRoundRepository(mockPrisma);

  await mockPrisma.surveyRound.create({
    data: {
      id: 'round_legacy_background',
      organizationId: 'org_prisma_1',
      title: 'Legacy background context',
      status: 'active',
      shareCode: 'SHALOM-LEGACY',
      privacyThreshold: 10,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      backgroundContext: {
        note: 'Disposable E2E smoke round. Safe to delete.',
      },
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    },
  });

  const persisted = await roundRepo.findById('round_legacy_background');

  assert.deepStrictEqual(persisted?.backgroundContext, {
    notes: '',
    audience: 'all-staff',
    sicknessDaysThisQuarter: 0,
    newStaffMembers: 0,
    studentCount: 0,
    socioEconomicIndex: 1,
    classesPerGrade: {},
  });
  assert.strictEqual(persisted?.backgroundContext?.classesPerGrade['א'], undefined);
});

test('PrismaRoundRepository returns an isolated questionnaire snapshot', async () => {
  const mockPrisma = createMockPrismaClient();
  const roundRepo = new PrismaRoundRepository(mockPrisma);
  const definition = createCanonicalSurveyDefinition('Prisma snapshot', 10);

  await roundRepo.create({
    id: 'round_prisma_snapshot',
    organizationId: 'org_prisma_1',
    title: 'Prisma snapshot',
    status: 'active',
    shareCode: 'SHALOM-PRISMA-SNAPSHOT',
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: definition,
    createdAt: new Date(),
  });

  const firstRead = await roundRepo.findById('round_prisma_snapshot');
  firstRead!.surveyDefinition!.questions[0].text = 'mutated caller text';
  const secondRead = await roundRepo.findById('round_prisma_snapshot');
  assert.strictEqual(
    secondRead?.surveyDefinition?.questions[0].text,
    surveyInstrument.questions[0].text,
  );
});

test('PrismaAiInsightsRepository persists AI insights across repository instances', async () => {
  const mockPrisma = createMockPrismaClient();
  const writer = new PrismaAiInsightsRepository(mockPrisma);

  await new PrismaRoundRepository(mockPrisma).create({
    id: 'round_ai_insights',
    organizationId: 'org_prisma_1',
    title: 'AI insights persistence',
    status: 'closed',
    shareCode: 'SHALOM-AI',
    privacyThreshold: 10,
    startDate: new Date(),
    createdAt: new Date(),
  });

  const insights = {
    contractVersion: '1.0',
    roundId: 'round_ai_insights',
    status: 'success',
  };

  assert.strictEqual(await writer.save('round_ai_insights', insights), true);

  const reader = new PrismaAiInsightsRepository(mockPrisma);
  assert.deepStrictEqual(
    await reader.findByRoundId('round_ai_insights'),
    insights,
  );
  assert.strictEqual(await reader.save('missing_round', insights), false);

  await reader.deleteByRoundId('round_ai_insights');
  assert.strictEqual(await writer.findByRoundId('round_ai_insights'), null);
});

test('PrismaSurveyRepository saves responses and counts total submissions', async () => {
  const mockPrisma = createMockPrismaClient();
  const surveyRepo = new PrismaSurveyRepository(mockPrisma);

  await surveyRepo.saveResponse({
    id: 'resp_prisma_1',
    roundId: 'round_prisma_1',
    anonymousTokenHash: 'token_hash_99',
    answers: [
      {
        questionId: 'q1',
        dimensionId: 'self-expression',
        value: 'green',
        score: 100,
      },
    ],
    submittedAt: new Date(),
  });

  const count = await surveyRepo.getResponseCount('round_prisma_1');
  assert.strictEqual(count, 1);

  const hasSubmitted = await surveyRepo.hasTokenSubmitted('round_prisma_1', 'token_hash_99');
  assert.strictEqual(hasSubmitted, true);

  const responses = await surveyRepo.findResponsesByRoundId('round_prisma_1');
  assert.strictEqual(responses.length, 1);
  assert.strictEqual(responses[0].answers[0].score, 100);
});
