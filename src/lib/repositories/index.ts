import { MINIMUM_PRIVACY_THRESHOLD } from '../survey-definition';
import { Organization, SurveyRound } from '../types/backend';

// The catalogue of ports and adapters. Which adapter the application actually
// runs against is decided in `src/lib/composition-root.ts`, the only module
// that constructs a repository.
export * from './interfaces';
export * from './in-memory/in-memory-organization.repository';
export * from './in-memory/in-memory-ai-analysis-run.repository';
export * from './in-memory/in-memory-ai-insights.repository';
export * from './in-memory/in-memory-round-goal.repository';
export * from './in-memory/in-memory-round.repository';
export * from './in-memory/in-memory-survey.repository';
export * from './prisma/prisma-client';
export * from './prisma/prisma-organization.repository';
export * from './prisma/prisma-ai-analysis-run.repository';
export * from './prisma/prisma-ai-insights.repository';
export * from './prisma/prisma-round-goal.repository';
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
