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
