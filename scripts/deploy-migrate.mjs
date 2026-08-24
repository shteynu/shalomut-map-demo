import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Apply pending migrations as part of the deployed build.
 *
 * Until 2026-08-22 no deploy path applied migrations at all. The build command
 * ran `prisma generate` and never `prisma migrate deploy`; the CI job ran
 * `vercel deploy --prod` with no migration step; and Vercel builds every push
 * to `main` on its own, so even a CI job would not have covered the path most
 * deployments actually take. A schema change therefore reached production code
 * before it reached the production schema, and in that window Prisma selects
 * the model's columns by name and every read of the changed table answers 500
 * rather than falling back. That cost a broken deployment on 2026-08-04 and a
 * hand step after every schema change since.
 *
 * The build is the only place that covers every path, because every path ends
 * in a Vercel build. So this runs there, and the build fails when it cannot.
 *
 * What this buys and what it costs, stated rather than discovered: the schema
 * now moves *ahead* of the alias, because the build finishes before the new
 * deployment starts serving. An additive migration is safe in that window; a
 * destructive one breaks the deployment that is still serving, which is the
 * old failure with the two sides swapped. Additive-first is now a rule rather
 * than a preference — see ADR-031.
 */

const TRANSACTION_POOLER_PORT = '6543';

/**
 * Where the pinned certificate authority is written down, once.
 *
 * The runtime pool reads it from this module as a TypeScript constant; this
 * script cannot, because it is plain ESM run by `node` during a Vercel build
 * with no TypeScript loader in front of it. Copying the PEM here would make two
 * sources of truth for a value whose whole point is that it was checked, so the
 * certificate is extracted from that file's text instead. A second certificate
 * appearing there, or none, is an error rather than a guess.
 */
const CERTIFICATE_SOURCE = path.join(
  'src',
  'lib',
  'repositories',
  'prisma',
  'supabase-root-ca.ts',
);

const CERTIFICATE_PATTERN =
  /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;


/**
 * Whether this build should migrate, and with which connection string.
 *
 * Keyed on `VERCEL_ENV` rather than on an opt-in variable of our own. An
 * opt-in would be one more switch that can sit quietly in the off position,
 * which is the shape of the defect this replaces.
 */
export function resolveMigrationPlan(env, platform = process.platform) {
  if (env.VERCEL_ENV !== 'production') {
    return {
      run: false,
      reason:
        `VERCEL_ENV is ${env.VERCEL_ENV ? `"${env.VERCEL_ENV}"` : 'unset'}, ` +
        'so this build serves nothing and migrates nothing',
    };
  }

  const url = env.DIRECT_URL;

  if (!url) {
    return {
      run: false,
      fatal: true,
      reason:
        'DIRECT_URL is not set on this deployment. Migrations need a session-' +
        'mode connection, which DATABASE_URL is not: it points at the ' +
        'transaction-mode pooler, where the advisory lock `prisma migrate` ' +
        'takes does not survive. Set DIRECT_URL to the direct connection ' +
        'string for the same database.',
    };
  }

  const misread = describeUnusablePooler(url);
  if (misread) {
    return { run: false, fatal: true, reason: misread };
  }

  const unverifiable = describeUnverifiablePlatform(platform);
  if (unverifiable) {
    return { run: false, fatal: true, reason: unverifiable };
  }

  return { run: true, url: hardenConnectionString(url) };
}

/**
 * Why this refuses to migrate from a Mac, and why that is not a limitation
 * anyone will meet.
 *
 * Prisma's migration engine does not read `sslrootcert` — that was measured
 * rather than assumed, on both platforms and in both directions: with the right
 * certificate, with a decoy, and with a path that does not exist, the outcome
 * never changed. `sslmode=verify-full` is worse than useless: the connector
 * accepts only `prefer`, `disable` and `require`, so an unrecognised value
 * silently falls back to `prefer` and the connection is *less* verified than
 * the operator believes. What does work is replacing the trust store for the
 * one child process, which OpenSSL reads from `SSL_CERT_FILE` — and only
 * OpenSSL. On macOS the engine goes through Security.framework, which ignores
 * that variable, so verification cannot be turned on there at all.
 *
 * A build runs on Linux, and this script runs only in a build (`VERCEL_ENV`
 * above). So the refusal is a statement about what this script can promise
 * rather than a step anybody has to work around: `npm run db:migrate:deploy` is
 * the unverified path and stays available for a developer's own database.
 */
export function describeUnverifiablePlatform(platform) {
  if (platform === 'linux') return null;

  return (
    `This script cannot verify the database certificate on ${platform}: ` +
    'Prisma reaches TLS through the platform trust store, and only the ' +
    'OpenSSL one can be replaced for a single process (`SSL_CERT_FILE`). ' +
    'Migrating unverified is what this refusal exists to prevent. A ' +
    'deployed build runs on Linux; for a local database use ' +
    '`npm run db:migrate:deploy`.'
  );
}

/**
 * The two parameters that turn verification on, on a connection string that
 * may already carry others.
 *
 * `sslmode=require` says TLS is not optional, and `sslaccept=strict` says the
 * certificate is checked rather than accepted — the default is
 * `accept_invalid_certs`, which is the whole finding. Neither says *against
 * what*: that is `SSL_CERT_FILE`, set on the child process below.
 */
export function hardenConnectionString(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('sslmode', 'require');
  parsed.searchParams.set('sslaccept', 'strict');
  return parsed.toString();
}

/**
 * The certificate this connection is allowed to end at.
 *
 * The same rule the runtime pool follows, including the escape hatch:
 * `DATABASE_CA_CERT` replaces the pinned root for the day Supabase rotates its
 * authority before this repository does, and a value that is not a PEM is
 * ignored rather than quietly turning verification into a connection to nobody
 * in particular. There is no way to switch verification off.
 */
export function resolveCertificateAuthority(env, readFile) {
  const configured = env.DATABASE_CA_CERT?.trim();
  if (configured?.includes('-----BEGIN CERTIFICATE-----')) return configured;

  return readPinnedCertificate(readFile);
}

/**
 * The pinned root, read out of the module that owns it and its provenance.
 *
 * Exactly one certificate, because two would mean the file gained a second
 * authority that nobody decided between, and none would mean this script is
 * reading the wrong file — both of which are worth a failed build rather than a
 * connection verified against something unexamined.
 */
export function readPinnedCertificate(readFile) {
  const source = readFile(CERTIFICATE_SOURCE);
  const found = source.match(CERTIFICATE_PATTERN) ?? [];

  if (found.length !== 1) {
    throw new Error(
      `${CERTIFICATE_SOURCE} holds ${found.length} certificates; this script ` +
        'needs exactly one. If the pinned authority changed, change it there ' +
        'and let this read it.',
    );
  }

  return `${found[0]}\n`;
}

/**
 * The one misconfiguration worth naming, because it is the one that looks
 * right: DATABASE_URL copied into DIRECT_URL. Both are the same database and
 * the same credentials, and only the port and the pooling mode differ, so the
 * error Prisma gives for it is about a lock rather than about a variable.
 */
export function describeUnusablePooler(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'DIRECT_URL is not a URL this script can read.';
  }

  if (parsed.searchParams.get('pgbouncer') === 'true') {
    return (
      'DIRECT_URL carries `pgbouncer=true`, so it is the pooled connection ' +
      'string rather than the direct one. Migrations need the direct one.'
    );
  }

  if (parsed.port === TRANSACTION_POOLER_PORT) {
    return (
      `DIRECT_URL points at port ${TRANSACTION_POOLER_PORT}, which is the ` +
      'transaction-mode pooler and is almost certainly DATABASE_URL copied ' +
      'by mistake. Migrations need the direct connection string.'
    );
  }

  return null;
}

function prismaBinary() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const local = path.join(here, '..', 'node_modules', '.bin', 'prisma');
  return existsSync(local) ? local : 'prisma';
}

function main() {
  const plan = resolveMigrationPlan(process.env);

  if (!plan.run) {
    if (plan.fatal) {
      console.error(`[deploy-migrate] refusing to build: ${plan.reason}`);
      process.exit(1);
    }

    console.log(`[deploy-migrate] skipped: ${plan.reason}`);
    return;
  }

  /*
   * The trust store for this one child, and nothing else in the build.
   *
   * `SSL_CERT_FILE` replaces the authorities OpenSSL would otherwise accept,
   * rather than adding to them, which is the property wanted here: this
   * connection has exactly one known peer, so a certificate for the pooler
   * signed by any other authority — a public one included — is refused. The
   * scope is the spawned process, so nothing else the build talks to changes.
   */
  let certificatePath;
  try {
    const certificateDirectory = mkdtempSync(
      path.join(os.tmpdir(), 'shalomut-db-ca-'),
    );
    certificatePath = path.join(certificateDirectory, 'root.pem');
    writeFileSync(
      certificatePath,
      resolveCertificateAuthority(process.env, (file) =>
        readFileSync(file, 'utf-8'),
      ),
    );
  } catch (error) {
    // Named rather than thrown, because the stack trace of a build step says
    // nothing about which of two files a person has to open.
    console.error(
      `[deploy-migrate] refusing to build: ${error.message}\n` +
        '[deploy-migrate] migrating without a certificate to verify against ' +
        'is the defect this step exists to close.',
    );
    process.exit(1);
  }

  console.log('[deploy-migrate] applying pending migrations before the build');

  const result = spawnSync(prismaBinary(), ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DIRECT_URL: plan.url,
      SSL_CERT_FILE: certificatePath,
    },
  });

  if (result.error) {
    console.error(`[deploy-migrate] could not run: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
