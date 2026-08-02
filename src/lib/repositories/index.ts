import { MINIMUM_PRIVACY_THRESHOLD } from '../survey-definition';
import { Organization, SurveyRound } from '../types/backend';
import { InMemoryOrganizationRepository } from './in-memory/in-memory-organization.repository';
import { InMemoryAiAnalysisRunRepository } from './in-memory/in-memory-ai-analysis-run.repository';
import { InMemoryAiInsightsRepository } from './in-memory/in-memory-ai-insights.repository';
import { InMemoryRoundRepository } from './in-memory/in-memory-round.repository';
import { InMemorySurveyRepository } from './in-memory/in-memory-survey.repository';
import {
  IOrganizationRepository,
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IRoundRepository,
  ISurveyRepository,
} from './interfaces';
import { getPrismaClient } from './prisma/prisma-client';
import { PrismaOrganizationRepository } from './prisma/prisma-organization.repository';
import { PrismaAiAnalysisRunRepository } from './prisma/prisma-ai-analysis-run.repository';
import { PrismaAiInsightsRepository } from './prisma/prisma-ai-insights.repository';
import { PrismaRoundRepository } from './prisma/prisma-round.repository';
import { PrismaSurveyRepository } from './prisma/prisma-survey.repository';

export * from './interfaces';
export * from './in-memory/in-memory-organization.repository';
export * from './in-memory/in-memory-ai-analysis-run.repository';
export * from './in-memory/in-memory-ai-insights.repository';
export * from './in-memory/in-memory-round.repository';
export * from './in-memory/in-memory-survey.repository';
export * from './prisma/prisma-client';
export * from './prisma/prisma-organization.repository';
export * from './prisma/prisma-ai-analysis-run.repository';
export * from './prisma/prisma-ai-insights.repository';
export * from './prisma/prisma-round.repository';
export * from './prisma/prisma-survey.repository';

// Explicit fixtures for tests and opt-in demos. Runtime repositories must start
// empty so a missing database connection cannot masquerade as real data.
export const DEMO_ORGANIZATION: Organization = {
  id: 'org_demo_1',
  name: 'בית ספר שלום',
  city: 'תל אביב-יפו',
  schoolType: 'תיכון',
  totalStaffCount: 45,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const DEMO_ROUND: SurveyRound = {
  id: 'round_demo_1',
  organizationId: 'org_demo_1',
  title: 'סקר שלומות - מחצית א׳ תשפ״ו',
  status: 'active',
  shareCode: 'SHALOM-DEMO',
  privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
  startDate: new Date('2026-01-15T00:00:00.000Z'),
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
};

interface RepositoryState {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
  orgRepo: IOrganizationRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
}

const globalForRepositories = globalThis as typeof globalThis & {
  shalomutRepositoryState?: RepositoryState;
};

function createEmptyRepositoryState(): RepositoryState {
  // The insights repository refuses a result for a round nobody created, so it
  // needs the same round store the round repository serves.
  const roundRepo = new InMemoryRoundRepository();
  return {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(roundRepo),
    orgRepo: new InMemoryOrganizationRepository(),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository([]),
  };
}

// Next.js compiles route handlers and React Server Components into separate
// module graphs. Keeping the local fallback on globalThis lets both graphs see
// the same explicitly ephemeral development state.
const repositoryState =
  globalForRepositories.shalomutRepositoryState ??
  createEmptyRepositoryState();
globalForRepositories.shalomutRepositoryState = repositoryState;

export function getRepositories(): {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
  orgRepo: IOrganizationRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
} {
  const prisma = getPrismaClient();
  if (prisma) {
    return {
      aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
      aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
      orgRepo: new PrismaOrganizationRepository(prisma),
      roundRepo: new PrismaRoundRepository(prisma),
      surveyRepo: new PrismaSurveyRepository(prisma),
    };
  }

  return {
    aiAnalysisRunRepo: repositoryState.aiAnalysisRunRepo,
    aiInsightsRepo: repositoryState.aiInsightsRepo,
    orgRepo: repositoryState.orgRepo,
    roundRepo: repositoryState.roundRepo,
    surveyRepo: repositoryState.surveyRepo,
  };
}

export function setRepositories(repos: {
  aiAnalysisRunRepo?: IAiAnalysisRunRepository;
  aiInsightsRepo?: IAiInsightsRepository;
  orgRepo?: IOrganizationRepository;
  roundRepo?: IRoundRepository;
  surveyRepo?: ISurveyRepository;
}): void {
  if (repos.aiAnalysisRunRepo) repositoryState.aiAnalysisRunRepo = repos.aiAnalysisRunRepo;
  if (repos.orgRepo) repositoryState.orgRepo = repos.orgRepo;
  if (repos.roundRepo) {
    repositoryState.roundRepo = repos.roundRepo;
    // An insights store can only answer for the rounds it can see, so a
    // replaced round store gets a matching one unless the caller brought its
    // own.
    if (!repos.aiInsightsRepo) {
      repositoryState.aiInsightsRepo = new InMemoryAiInsightsRepository(
        repos.roundRepo,
      );
    }
  }
  if (repos.aiInsightsRepo) repositoryState.aiInsightsRepo = repos.aiInsightsRepo;
  if (repos.surveyRepo) repositoryState.surveyRepo = repos.surveyRepo;
}

export function resetDefaultRepositories(): void {
  Object.assign(repositoryState, createEmptyRepositoryState());
}
