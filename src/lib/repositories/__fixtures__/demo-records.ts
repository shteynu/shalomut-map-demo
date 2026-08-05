import { MINIMUM_PRIVACY_THRESHOLD } from '../../survey-definition';
import { Organization, SurveyRound } from '../../types/backend';

/**
 * A school and a round, for tests only.
 *
 * These used to be exported from `src/lib/repositories/index.ts`, the barrel a
 * route handler imports its adapters from — so a ready-made organization with
 * an active round and a share code sat one import away from production code.
 * Nothing used them there, and nothing should: an empty database must read as
 * empty rather than as this school (backlog §7).
 *
 * They live under `__fixtures__` so the boundary is visible in the path, and
 * `scripts/check-runtime-fixtures.mjs` fails the build if a non-test module
 * imports them.
 */
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
