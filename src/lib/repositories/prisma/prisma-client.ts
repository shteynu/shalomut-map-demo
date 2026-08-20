import { Organization, QuestionAnswerRecord, RoundStatus, SurveyResponseRecord, SurveyRound } from '../../types/backend';
import { resolvePoolSsl } from './pool-options';

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
    deleteMany: (args?: any) => Promise<any>;
  };
  questionAnswer?: {
    deleteMany: (args?: any) => Promise<any>;
  };
  manager?: {
    findUnique: (args: any) => Promise<any>;
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

let globalPrisma: MinimalPrismaClient | null = null;

function createAdapterBackedClient(connectionString: string): MinimalPrismaClient {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString,
    ssl: resolvePoolSsl(connectionString),
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export function getPrismaClient(
  createClient: (connectionString: string) => MinimalPrismaClient =
    createAdapterBackedClient,
): MinimalPrismaClient | null {
  if (typeof process === 'undefined' || !process.env.DATABASE_URL) {
    return null;
  }

  if (!globalPrisma) {
    try {
      globalPrisma = createClient(process.env.DATABASE_URL);
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

  return globalPrisma;
}

/** Test seam: drops the cached client so a test can supply its own factory. */
export function resetPrismaClientForTests() {
  globalPrisma = null;
}
