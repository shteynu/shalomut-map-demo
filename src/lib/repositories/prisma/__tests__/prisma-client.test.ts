import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPrismaClient,
  resetPrismaClientForTests,
  type MinimalPrismaClient,
} from '../prisma-client';

const STUB_CLIENT = {} as MinimalPrismaClient;

function withDatabaseUrl(value: string | undefined, run: () => void) {
  const previous = process.env.DATABASE_URL;
  resetPrismaClientForTests();

  if (value === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = value;
  }

  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
    resetPrismaClientForTests();
  }
}

test('no database URL means no Prisma client and no error', () => {
  withDatabaseUrl(undefined, () => {
    assert.strictEqual(
      getPrismaClient(() => STUB_CLIENT),
      null,
    );
  });
});

test('a configured database URL builds the client from the connection string', () => {
  withDatabaseUrl('postgresql://configured/db', () => {
    let seen: string | undefined;
    const client = getPrismaClient((connectionString) => {
      seen = connectionString;
      return STUB_CLIENT;
    });

    assert.strictEqual(client, STUB_CLIENT);
    assert.strictEqual(seen, 'postgresql://configured/db');
  });
});

test('a broken client fails loudly instead of degrading to empty repositories', () => {
  // Returning null here used to make a client that never initialized look
  // exactly like a database with no rows.
  withDatabaseUrl('postgresql://configured/db', () => {
    assert.throws(
      () =>
        getPrismaClient(() => {
          throw new Error('Cannot find module @prisma/client');
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /persistence is unavailable/);
        assert.match(error.message, /Cannot find module @prisma\/client/);
        return true;
      },
    );
  });
});

test('the cached client lives on globalThis, not in one module graph', () => {
  // Next.js compiles route handlers and RSC into separate module graphs. A
  // module-level cache is one client — and therefore one connection pool — per
  // graph, which is how a process ends up with more pools than anyone bounded.
  withDatabaseUrl('postgresql://configured/db', () => {
    getPrismaClient(() => STUB_CLIENT);

    const holder = globalThis as typeof globalThis & {
      shalomutPrismaClient?: MinimalPrismaClient;
    };
    assert.strictEqual(holder.shalomutPrismaClient, STUB_CLIENT);
  });
});

test('a second module graph reuses the client the first one built', () => {
  withDatabaseUrl('postgresql://configured/db', () => {
    const first = getPrismaClient(() => STUB_CLIENT);

    let built = false;
    const second = getPrismaClient(() => {
      built = true;
      return {} as MinimalPrismaClient;
    });

    assert.strictEqual(second, first);
    assert.equal(built, false, 'a second client is a second connection pool');
  });
});
