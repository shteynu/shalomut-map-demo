import { Organization, QuestionAnswerRecord, RoundStatus, SurveyResponseRecord, SurveyRound } from '../../types/backend';

// Type definitions for minimal Prisma Client interface contract to ensure decouple execution
export interface MinimalPrismaClient {
  organization: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
  surveyRound: {
    create: (args: any) => Promise<any>;
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    update: (args: any) => Promise<any>;
  };
  surveyResponse: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
}

let globalPrisma: MinimalPrismaClient | null = null;

export function getPrismaClient(): MinimalPrismaClient | null {
  if (typeof process === 'undefined' || !process.env.DATABASE_URL) {
    return null;
  }

  if (!globalPrisma) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const { Pool } = require('pg');

      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      const adapter = new PrismaPg(pool);
      globalPrisma = new PrismaClient({ adapter });
    } catch (error) {
      console.error('Failed to initialize Prisma client with adapter:', error);
      return null;
    }
  }

  return globalPrisma;
}
