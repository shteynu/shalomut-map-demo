import assert from 'node:assert';
import test from 'node:test';
import {
  createEphemeralRepositories,
  createPersistentRepositories,
  overrideCoreRepositories,
  resetCoreRepositories,
  resolveCoreRepositories,
  runInTransaction,
  TRANSACTION_MAX_WAIT_MS,
  TRANSACTION_TIMEOUT_MS,
} from '../composition-root';
import { InMemoryRoundRepository } from '../repositories';
import { PrismaRoundRepository } from '../repositories/prisma/prisma-round.repository';
import {
  resetPrismaClientForTests,
  type MinimalPrismaClient,
} from '../repositories/prisma/prisma-client';
import { DEMO_ROUND } from '../repositories/__fixtures__/demo-records';

const STUB_CLIENT = {} as MinimalPrismaClient;

async function withoutDatabase(run: () => Promise<void> | void) {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  resetCoreRepositories();

  try {
    await run();
  } finally {
    resetCoreRepositories();
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
    resetPrismaClientForTests();
  }
}

test('resolving the composition root hands an entrypoint the full set', async () => {
  await withoutDatabase(() => {
    const repositories = resolveCoreRepositories();

    assert.notStrictEqual(repositories.aiAnalysisRunRepo, undefined);
    assert.notStrictEqual(repositories.aiInsightsRepo, undefined);
    assert.notStrictEqual(repositories.orgRepo, undefined);
    assert.notStrictEqual(repositories.roundRepo, undefined);
    assert.notStrictEqual(repositories.surveyRepo, undefined);
  });
});

test('the ephemeral wiring does not invent demo records when no database is configured', async () => {
  await withoutDatabase(async () => {
    const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();

    assert.deepStrictEqual(await orgRepo.findAll(), []);
    assert.strictEqual(await roundRepo.findById(DEMO_ROUND.id), null);
    assert.strictEqual(await surveyRepo.getResponseCount(DEMO_ROUND.id), 0);
  });
});

test('a configured database wins over the ephemeral fallback', async () => {
  await withoutDatabase(() => {
    // A client is the only thing that decides this: with one, an entrypoint
    // must reach the durable adapters even though the local set is populated.
    overrideCoreRepositories({
      roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    });

    assert.ok(
      resolveCoreRepositories(STUB_CLIENT).roundRepo instanceof
        PrismaRoundRepository,
    );
    assert.ok(
      resolveCoreRepositories(null).roundRepo instanceof InMemoryRoundRepository,
    );
  });
});

test('a replaced round repository brings a matching insights repository', async () => {
  await withoutDatabase(async () => {
    // Injecting only the round store is the common shape in route tests; the
    // insights store must still recognise the rounds that store holds.
    overrideCoreRepositories({
      roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    });

    const { aiInsightsRepo } = resolveCoreRepositories();
    assert.strictEqual(
      await aiInsightsRepo.save(DEMO_ROUND.id, { status: 'success' }),
      true,
    );
  });
});

test('an installed double is dropped by a reset', async () => {
  await withoutDatabase(async () => {
    overrideCoreRepositories({
      roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    });
    assert.notStrictEqual(
      await resolveCoreRepositories().roundRepo.findById(DEMO_ROUND.id),
      null,
    );

    resetCoreRepositories();
    assert.strictEqual(
      await resolveCoreRepositories().roundRepo.findById(DEMO_ROUND.id),
      null,
    );
  });
});

test('the factories build a whole set without reading the environment', () => {
  const persistent = createPersistentRepositories(STUB_CLIENT);
  assert.ok(persistent.roundRepo instanceof PrismaRoundRepository);

  const ephemeral = createEphemeralRepositories();
  assert.ok(ephemeral.roundRepo instanceof InMemoryRoundRepository);
  // Two calls must not share state, or a test could leak into the next one.
  assert.notStrictEqual(ephemeral.roundRepo, createEphemeralRepositories().roundRepo);
});

test('a transaction hands the work a set built over the transaction client', async () => {
  // The point of the seam: what `work` writes through goes to the transaction
  // and not to the pool, which is what makes five deletes across five
  // repositories one write.
  const transactionClient = {} as MinimalPrismaClient;
  const calls: { options?: unknown }[] = [];
  const client = {
    $transaction: async (
      work: (tx: MinimalPrismaClient) => Promise<unknown>,
      options?: unknown,
    ) => {
      calls.push({ options });
      return work(transactionClient);
    },
  } as unknown as MinimalPrismaClient;

  const seen = await runInTransaction(
    async (repositories) => repositories.roundRepo,
    client,
  );

  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].options, {
    timeout: TRANSACTION_TIMEOUT_MS,
    maxWait: TRANSACTION_MAX_WAIT_MS,
  });
  assert.ok(seen instanceof PrismaRoundRepository);
});

test('a store with no transaction to offer still runs the work', async () => {
  // The in-memory wiring, and a double. Not a silent downgrade: one process
  // mutating a `Map` has no half-applied state for a transaction to protect
  // against, and the store that does have one always brings a `$transaction`.
  await withoutDatabase(async () => {
    const local = await runInTransaction(
      async (repositories) => repositories.roundRepo,
      null,
    );
    assert.ok(local instanceof InMemoryRoundRepository);

    const stubbed = await runInTransaction(
      async (repositories) => repositories.roundRepo,
      STUB_CLIENT,
    );
    assert.ok(stubbed instanceof PrismaRoundRepository);
  });
});

test('a transaction sees the doubles a test installed', async () => {
  // Without this the seam would be untestable from a route test: the route
  // resolves once for authorization and again for the erasure, and both have to
  // land on the same installed store.
  await withoutDatabase(async () => {
    const roundRepo = new InMemoryRoundRepository([DEMO_ROUND]);
    overrideCoreRepositories({ roundRepo });

    const seen = await runInTransaction(
      async (repositories) => repositories.roundRepo,
      null,
    );

    assert.strictEqual(seen, roundRepo);
  });
});
