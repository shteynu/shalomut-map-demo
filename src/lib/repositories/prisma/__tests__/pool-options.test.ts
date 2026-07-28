import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePoolSsl } from '../pool-options';

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
