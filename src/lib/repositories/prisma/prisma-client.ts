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
      // Lazy load @prisma/client if DATABASE_URL is set
      const { PrismaClient } = require('@prisma/client');
      globalPrisma = new PrismaClient();
    } catch {
      return null;
    }
  }

  return globalPrisma;
}
