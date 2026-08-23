import { Organization, QuestionAnswerRecord, RoundStatus, SurveyResponseRecord, SurveyRound } from '../../types/backend';
import { resolvePoolConfig } from './pool-options';

// Type definitions for minimal Prisma Client interface contract to ensure decouple execution
export interface MinimalPrismaClient {
  organization: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    deleteMany: (args?: any) => Promise<any>;
  };
  surveyRound: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
    deleteMany: (args?: any) => Promise<any>;
  };
  aiAnalysisRun?: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<{ count: number }>;
    deleteMany: (args?: any) => Promise<any>;
    /** Queue depth, for the stall detector. Counted rather than fetched. */
    count: (args?: any) => Promise<number>;
  };
  roundGoal?: {
    create: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    updateMany: (args: any) => Promise<{ count: number }>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
  surveyDefinitionVersion?: {
    create: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
  surveyAttempt?: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
  surveyResponse: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
    // One count per round for many rounds, which is what keeps a screen that
    // lists schools from asking per school.
    groupBy: (args: any) => Promise<any[]>;
    deleteMany: (args?: any) => Promise<any>;
  };
  questionAnswer?: {
    deleteMany: (args?: any) => Promise<any>;
  };
  manager?: {
    findUnique: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    upsert: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
  auditEvent?: {
    upsert: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    count: (args?: any) => Promise<number>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
  organizationMembership?: {
    findMany: (args: any) => Promise<any[]>;
    upsert: (args: any) => Promise<any>;
    deleteMany: (args?: any) => Promise<{ count: number }>;
  };
}

// Next.js compiles route handlers and React Server Components into separate
// module graphs, so a module-level variable caches one client per graph rather
// than one per process — the same reason `composition-root.ts` keeps its
// ephemeral repositories on `globalThis`. What a second graph costs here is not
// a second variable but a second connection pool, against a bound this file
// sets per pool and not per process.
const globalForPrisma = globalThis as typeof globalThis & {
  shalomutPrismaClient?: MinimalPrismaClient;
};

function createAdapterBackedClient(connectionString: string): MinimalPrismaClient {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  const pool = new Pool(resolvePoolConfig(connectionString));

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export function getPrismaClient(
  createClient: (connectionString: string) => MinimalPrismaClient =
    createAdapterBackedClient,
): MinimalPrismaClient | null {
  if (typeof process === 'undefined' || !process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForPrisma.shalomutPrismaClient) {
    try {
      globalForPrisma.shalomutPrismaClient = createClient(process.env.DATABASE_URL);
    } catch (error) {
      // Fail loudly. Returning null here degraded a configured-but-broken
      // database into empty in-memory repositories, where a client that never
      // initialized is indistinguishable from a database with no rows. That
      // hid a missing `prisma generate` behind plausible empty states.
      throw new Error(
        "DATABASE_URL is configured but the Prisma client could not be " +
          "initialized, so persistence is unavailable: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  return globalForPrisma.shalomutPrismaClient;
}

/** Test seam: drops the cached client so a test can supply its own factory. */
export function resetPrismaClientForTests() {
  delete globalForPrisma.shalomutPrismaClient;
}
