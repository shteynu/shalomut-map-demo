import assert from 'node:assert';
import test from 'node:test';
import {
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';

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

  const byCode = await roundRepo.findByShareCode('SHALOM-PRISMA');
  assert.strictEqual(byCode?.id, 'round_prisma_1');

  const updated = await roundRepo.updateStatus('round_prisma_1', 'closed');
  assert.strictEqual(updated?.status, 'closed');
});

test('PrismaRoundRepository persists AI insights across repository instances', async () => {
  const mockPrisma = createMockPrismaClient();
  const writer = new PrismaRoundRepository(mockPrisma);

  await writer.create({
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

  assert.strictEqual(
    await writer.saveAiInsights('round_ai_insights', insights),
    true,
  );

  const reader = new PrismaRoundRepository(mockPrisma);
  assert.deepStrictEqual(
    await reader.getAiInsights('round_ai_insights'),
    insights,
  );
  assert.strictEqual(
    await reader.saveAiInsights('missing_round', insights),
    false,
  );
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
