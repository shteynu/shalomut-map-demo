import assert from 'node:assert/strict';
import test from 'node:test';
import { PUT as saveSetup } from '../manager/setup/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
} from '@/lib/repositories';
import { overrideCoreRepositories } from '@/lib/composition-root';

/**
 * The refusal has to survive the round trip, not only the unit that phrases it:
 * a rule the route forgets to call is a rule nobody enforces.
 */

function payload(totalStaffCount: number, privacyThreshold: number) {
  return {
    organization: {
      name: 'בית ספר קטן',
      city: 'חיפה',
      schoolType: 'יסודי',
      totalStaffCount,
    },
    round: {
      title: 'סבב ראשון',
      privacyThreshold,
      // The route builds the day itself, so this is a date and not an instant.
      startDate: '2026-09-01',
      backgroundContext: {
        audience: 'כלל צוות ההוראה',
        classesPerGrade: { א: 2 },
        sicknessDaysThisQuarter: 3,
        newStaffMembers: 1,
        studentCount: 120,
        socioEconomicIndex: 5,
      },
    },
  };
}

function put(body: unknown) {
  return saveSetup(
    new Request('http://localhost/api/manager/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

test('a school that cannot reach its own threshold is refused, and told why', async () => {
  const orgRepo = new InMemoryOrganizationRepository();
  overrideCoreRepositories({ orgRepo, roundRepo: new InMemoryRoundRepository() });

  const response = await put(payload(8, 10));

  assert.strictEqual(response.status, 422);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /8/u);
  assert.match(body.error, /10/u);

  // Nothing was written: a refused round must not leave the school behind.
  assert.deepStrictEqual(await orgRepo.findAll(), []);
});
