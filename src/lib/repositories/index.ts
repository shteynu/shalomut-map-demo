import { Organization, SurveyRound } from '../types/backend';
import { InMemoryOrganizationRepository } from './in-memory/in-memory-organization.repository';
import { InMemoryRoundRepository } from './in-memory/in-memory-round.repository';
import { InMemorySurveyRepository } from './in-memory/in-memory-survey.repository';
import {
  IOrganizationRepository,
  IRoundRepository,
  ISurveyRepository,
} from './interfaces';
import { getPrismaClient } from './prisma/prisma-client';
import { PrismaOrganizationRepository } from './prisma/prisma-organization.repository';
import { PrismaRoundRepository } from './prisma/prisma-round.repository';
import { PrismaSurveyRepository } from './prisma/prisma-survey.repository';

export * from './interfaces';
export * from './in-memory/in-memory-organization.repository';
export * from './in-memory/in-memory-round.repository';
export * from './in-memory/in-memory-survey.repository';
export * from './prisma/prisma-client';
export * from './prisma/prisma-organization.repository';
export * from './prisma/prisma-round.repository';
export * from './prisma/prisma-survey.repository';

// Default Seed Data for Dev/Testing/Demo
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
  privacyThreshold: 10,
  startDate: new Date('2026-01-15T00:00:00.000Z'),
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
};

let defaultOrgRepo: IOrganizationRepository = new InMemoryOrganizationRepository([
  DEMO_ORGANIZATION,
]);
let defaultRoundRepo: IRoundRepository = new InMemoryRoundRepository([
  DEMO_ROUND,
]);
let defaultSurveyRepo: ISurveyRepository = new InMemorySurveyRepository([]);

export function getRepositories(): {
  orgRepo: IOrganizationRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
} {
  const prisma = getPrismaClient();
  if (prisma) {
    return {
      orgRepo: new PrismaOrganizationRepository(prisma),
      roundRepo: new PrismaRoundRepository(prisma),
      surveyRepo: new PrismaSurveyRepository(prisma),
    };
  }

  return {
    orgRepo: defaultOrgRepo,
    roundRepo: defaultRoundRepo,
    surveyRepo: defaultSurveyRepo,
  };
}

export function setRepositories(repos: {
  orgRepo?: IOrganizationRepository;
  roundRepo?: IRoundRepository;
  surveyRepo?: ISurveyRepository;
}): void {
  if (repos.orgRepo) defaultOrgRepo = repos.orgRepo;
  if (repos.roundRepo) defaultRoundRepo = repos.roundRepo;
  if (repos.surveyRepo) defaultSurveyRepo = repos.surveyRepo;
}

export function resetDefaultRepositories(): void {
  defaultOrgRepo = new InMemoryOrganizationRepository([DEMO_ORGANIZATION]);
  defaultRoundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
  defaultSurveyRepo = new InMemorySurveyRepository([]);
}

