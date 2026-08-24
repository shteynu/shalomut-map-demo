import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  describeUnusablePooler,
  describeUnverifiablePlatform,
  hardenConnectionString,
  readPinnedCertificate,
  resolveCertificateAuthority,
  resolveMigrationPlan,
} from './deploy-migrate.mjs';

const DIRECT = 'postgresql://user:pass@aws-1.pooler.supabase.com:5432/postgres';
const POOLED = 'postgresql://user:pass@aws-1.pooler.supabase.com:6543/postgres';

test('a local build migrates nothing', () => {
  // `npm run build` is part of `npm run verify:core`. A verification command
  // that writes to a database is not a verification command.
  const plan = resolveMigrationPlan({ DIRECT_URL: DIRECT });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, undefined);
  assert.match(plan.reason, /VERCEL_ENV is unset/);
});

test('a preview build migrates nothing, even with a connection string', () => {
  // Previews share the one deployed database. A branch that is not merged has
  // no business moving its schema.
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'preview',
    DIRECT_URL: DIRECT,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, undefined);
  assert.match(plan.reason, /"preview"/);
});

test('a production build migrates, over a connection it verifies', () => {
  const plan = resolveMigrationPlan(
    { VERCEL_ENV: 'production', DIRECT_URL: DIRECT },
    'linux',
  );

  assert.equal(plan.run, true);
  // The URL is not passed through: it comes back saying TLS is required and
  // the certificate is checked. Until 2026-08-24 it was passed through, and
  // the default `sslaccept` is `accept_invalid_certs`.
  assert.equal(
    plan.url,
    `${DIRECT}?sslmode=require&sslaccept=strict`,
  );
});

test('the two parameters survive a connection string that already has some', () => {
  const url = hardenConnectionString(`${DIRECT}?schema=public&connect_timeout=30`);

  const params = new URL(url).searchParams;
  assert.equal(params.get('schema'), 'public');
  assert.equal(params.get('connect_timeout'), '30');
  assert.equal(params.get('sslmode'), 'require');
  assert.equal(params.get('sslaccept'), 'strict');
});

test('a platform whose trust store cannot be replaced refuses to migrate', () => {
  // Measured, not assumed: Prisma ignores `sslrootcert`, and the only lever
  // that turns verification on is `SSL_CERT_FILE`, which OpenSSL reads and
  // macOS's Security.framework does not. A build runs on Linux; anywhere else
  // this script can only migrate unverified, so it does not migrate.
  const plan = resolveMigrationPlan(
    { VERCEL_ENV: 'production', DIRECT_URL: DIRECT },
    'darwin',
  );

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, true);
  assert.match(plan.reason, /cannot verify the database certificate on darwin/);
  assert.equal(describeUnverifiablePlatform('linux'), null);
});

test('the pinned certificate is the one the runtime pool verifies against', () => {
  // One authority, read out of the module that owns it and its provenance,
  // because a second copy is a second thing to rotate and only one of them
  // would be.
  const { SUPABASE_ROOT_CA_2021 } = fs
    .readFileSync('src/lib/repositories/prisma/supabase-root-ca.ts', 'utf-8')
    .match(/(?<SUPABASE_ROOT_CA_2021>-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----)/u).groups;

  const read = readPinnedCertificate((file) => fs.readFileSync(file, 'utf-8'));

  assert.equal(read.trim(), SUPABASE_ROOT_CA_2021);
});

test('a source with no certificate, or two, is an error rather than a guess', () => {
  assert.throws(
    () => readPinnedCertificate(() => 'export const NOTHING = "";'),
    /holds 0 certificates/,
  );
  assert.throws(
    () =>
      readPinnedCertificate(
        () =>
          '-----BEGIN CERTIFICATE-----a-----END CERTIFICATE-----' +
          '-----BEGIN CERTIFICATE-----b-----END CERTIFICATE-----',
      ),
    /holds 2 certificates/,
  );
});

test('DATABASE_CA_CERT replaces the pinned root and cannot switch verification off', () => {
  const pem = '-----BEGIN CERTIFICATE-----other-----END CERTIFICATE-----';
  const pinned = () => '-----BEGIN CERTIFICATE-----pinned-----END CERTIFICATE-----';

  assert.equal(resolveCertificateAuthority({ DATABASE_CA_CERT: pem }, pinned), pem);
  // Not a PEM: ignored, rather than quietly becoming an empty trust store —
  // which is a connection to nobody in particular, or to anybody.
  assert.match(
    resolveCertificateAuthority({ DATABASE_CA_CERT: 'false' }, pinned),
    /pinned/,
  );
  assert.match(resolveCertificateAuthority({}, pinned), /pinned/);
});

test('a production build with no direct connection fails instead of shipping', () => {
  // The whole point. Continuing here would deploy code against a schema nobody
  // migrated, which is the defect this script exists to close.
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'production',
    DATABASE_URL: POOLED,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, true);
  assert.match(plan.reason, /DIRECT_URL is not set/);
});

test('the pooled connection string is refused by port and by flag', () => {
  // DATABASE_URL copied into DIRECT_URL is the same database and the same
  // credentials; only the port and the pooling mode differ, so it looks right.
  assert.match(describeUnusablePooler(POOLED), /transaction-mode pooler/);
  assert.match(
    describeUnusablePooler(`${DIRECT}?pgbouncer=true`),
    /pooled connection/,
  );
  assert.equal(describeUnusablePooler(DIRECT), null);
});

test('a production build refuses a pooled DIRECT_URL rather than failing on a lock', () => {
  const plan = resolveMigrationPlan({
    VERCEL_ENV: 'production',
    DIRECT_URL: POOLED,
  });

  assert.equal(plan.run, false);
  assert.equal(plan.fatal, true);
  assert.match(plan.reason, /6543/);
});

test('an unreadable DIRECT_URL is named as unreadable', () => {
  assert.match(describeUnusablePooler('not-a-url'), /not a URL/);
});
