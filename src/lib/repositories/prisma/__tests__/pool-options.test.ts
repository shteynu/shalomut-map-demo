import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { resolvePoolConfig, resolvePoolSsl } from '../pool-options';
import { SUPABASE_ROOT_CA_2021 } from '../supabase-root-ca';

const DEPLOYED =
  'postgresql://postgres:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

test('the deployed database is encrypted and its certificate is checked', () => {
  const ssl = resolvePoolSsl(DEPLOYED);

  assert.notEqual(ssl, false);
  assert.ok(ssl);
  assert.equal(
    ssl.rejectUnauthorized,
    true,
    'encryption without verification is a conversation with whoever answers',
  );
  assert.ok(ssl.ca.includes('-----BEGIN CERTIFICATE-----'));
  assert.equal(ssl.servername, 'aws-1-ap-northeast-2.pooler.supabase.com');
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

test('an unparseable connection string still verifies rather than trusting anyone', () => {
  const ssl = resolvePoolSsl('not-a-url');

  assert.ok(ssl);
  assert.equal(ssl.rejectUnauthorized, true);
  // No host was readable, so there is no name to pin. `pg` will not connect to
  // an unparseable string either; what matters is that the fallback fails
  // closed instead of reintroducing the branch this change removed.
  assert.equal(ssl.servername, undefined);
});

/**
 * The whole point of the change, stated as a property rather than as three
 * examples: no connection string produces an encrypted-but-unverified pool.
 * The old code returned exactly that for every non-loopback host.
 */
test('no connection string can produce encryption without verification', () => {
  for (const connectionString of [
    DEPLOYED,
    'postgresql://user:pass@db.example.com:5432/app',
    'postgresql://user:pass@10.0.0.5:5432/app',
    'postgresql://user:pass@127.0.0.1.evil.example:5432/app',
    'postgresql://user:pass@localhost.evil.example:5432/app',
    'postgresql://user:pass@[::1]:5432/app?sslmode=require',
    'not-a-url',
    '',
  ]) {
    const ssl = resolvePoolSsl(connectionString);
    if (ssl === false) continue;
    assert.equal(
      ssl.rejectUnauthorized,
      true,
      `${connectionString} was encrypted without verification`,
    );
  }
});

/**
 * A host that merely starts with a loopback-looking string is not loopback.
 * `127.0.0.1.evil.example` resolves wherever its owner points it, and the
 * loopback branch is the one branch that turns TLS off entirely.
 */
test('a hostname that only looks like loopback is not treated as loopback', () => {
  assert.notEqual(
    resolvePoolSsl('postgresql://user:pass@localhost.evil.example:5432/app'),
    false,
  );
});

test('the shipped authority is the Supabase root, not something that expired', () => {
  const certificate = new X509Certificate(SUPABASE_ROOT_CA_2021);

  assert.equal(certificate.subject.includes('Supabase Root 2021 CA'), true);
  // Self-signed: a root is its own issuer, which is what makes it an anchor.
  assert.equal(certificate.subject, certificate.issuer);
  assert.equal(
    certificate.fingerprint256,
    '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA',
    'this is the fingerprint the deployed pooler chain was checked against',
  );
  assert.ok(
    new Date(certificate.validTo) > new Date(),
    'the shipped authority has expired, and every connection now fails closed',
  );
});

test('DATABASE_CA_CERT replaces the shipped root, and rubbish does not', () => {
  const previous = process.env.DATABASE_CA_CERT;
  try {
    const replacement =
      '-----BEGIN CERTIFICATE-----\nnot-really\n-----END CERTIFICATE-----';
    process.env.DATABASE_CA_CERT = replacement;
    assert.equal((resolvePoolSsl(DEPLOYED) as { ca: string }).ca, replacement);

    // Not a PEM: the shipped root stands rather than the pool being built with
    // an authority that trusts nothing, or — far worse — no authority at all.
    process.env.DATABASE_CA_CERT = 'oops';
    assert.equal(
      (resolvePoolSsl(DEPLOYED) as { ca: string }).ca,
      SUPABASE_ROOT_CA_2021,
    );
  } finally {
    if (previous === undefined) delete process.env.DATABASE_CA_CERT;
    else process.env.DATABASE_CA_CERT = previous;
  }
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

test('the pool config carries the same SSL decision the resolver made', () => {
  assert.equal(
    resolvePoolConfig('postgresql://user:pass@localhost:5432/app').ssl,
    false,
  );
  assert.deepEqual(
    resolvePoolConfig(DEPLOYED).ssl,
    resolvePoolSsl(DEPLOYED),
  );
});
