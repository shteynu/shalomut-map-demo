import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePoolConfig, resolvePoolSsl } from '../pool-options';

test('the deployed database keeps TLS with an untrusted chain accepted', () => {
  assert.deepEqual(
    resolvePoolSsl(
      'postgresql://postgres:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres',
    ),
    { rejectUnauthorized: false },
  );
});

test('a loopback database gets no TLS, because the container speaks none', () => {
  for (const connectionString of [
    'postgresql://shalomut:shalomut@localhost:5433/shalomut',
    'postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut',
  ]) {
    assert.equal(resolvePoolSsl(connectionString), false);
  }
});

test('sslmode=disable is honoured wherever the host is', () => {
  assert.equal(
    resolvePoolSsl('postgresql://user:pass@db.example.com:5432/app?sslmode=disable'),
    false,
  );
});

test('an unparseable connection string falls back to the encrypted setting', () => {
  assert.deepEqual(resolvePoolSsl('not-a-url'), { rejectUnauthorized: false });
});

test('the pool is bounded: a finite size, a finite wait and a finite idle', () => {
  const config = resolvePoolConfig(
    'postgresql://user:pass@db.example.com:5432/app',
  );

  // `pg`'s defaults are ten connections and an unbounded wait, which is one
  // pool's worth of demand multiplied by however many warm instances exist,
  // and exhaustion presenting as a hang rather than an error.
  assert.equal(config.max, 2);
  assert.ok(
    config.connectionTimeoutMillis > 0,
    'an unbounded wait turns exhaustion into a hung request',
  );
  assert.ok(config.idleTimeoutMillis > 0, 'idle connections must be returned');
});

test('the pool config carries the same SSL decision the pool always made', () => {
  assert.equal(
    resolvePoolConfig('postgresql://user:pass@localhost:5432/app').ssl,
    false,
  );
  assert.deepEqual(
    resolvePoolConfig('postgresql://user:pass@db.example.com:5432/app').ssl,
    { rejectUnauthorized: false },
  );
});
