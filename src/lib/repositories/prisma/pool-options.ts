import { SUPABASE_ROOT_CA_2021 } from './supabase-root-ca';

/**
 * How a `pg` pool should be encrypted for a given connection string.
 *
 * Three cases, and only three. A loopback host gets no TLS, because the local
 * Postgres container speaks none and `pg` asked for SSL against it fails with
 * "The server does not support SSL connections" — so the local environment is
 * recognised rather than configured, or every script would need its own flag.
 * `sslmode=disable` says the same thing explicitly, wherever the host is.
 * Everything else is encrypted **and verified**.
 *
 * There is no fourth case. Until 2026-08-22 there was: any non-loopback host
 * got `rejectUnauthorized: false`, which encrypts the connection to whoever
 * answers rather than to the database. `supabase-root-ca.ts` carries the
 * authority that replaced it and how it was obtained.
 */
export type PoolSsl =
  | false
  | {
      readonly ca: string;
      readonly rejectUnauthorized: true;
      /**
       * The name the certificate has to carry. Set from the connection string
       * rather than left to `pg` to infer, so the check is stated here where it
       * can be read and tested instead of inherited from a dependency's
       * behaviour. Absent only when the connection string does not parse, in
       * which case nothing is going to connect anyway.
       */
      readonly servername?: string;
    };

/**
 * The certificate authority to verify against.
 *
 * `DATABASE_CA_CERT` replaces the shipped root — for the day Supabase rotates
 * its authority before this repository does, or for a database somewhere else.
 * It must be a PEM; anything else is ignored rather than quietly turning
 * verification into a connection to nobody in particular.
 */
function certificateAuthority(): string {
  const configured = process.env.DATABASE_CA_CERT?.trim();

  return configured?.includes('-----BEGIN CERTIFICATE-----')
    ? configured
    : SUPABASE_ROOT_CA_2021;
}

export function resolvePoolSsl(connectionString: string): PoolSsl {
  const verified = {
    ca: certificateAuthority(),
    rejectUnauthorized: true,
  } as const;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return verified;
  }

  if (url.searchParams.get('sslmode') === 'disable') {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const isLoopback =
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host.startsWith('127.');

  return isLoopback ? false : { ...verified, servername: url.hostname };
}

/*
 * How large a `pg` pool may get, and how long a caller waits for a connection.
 *
 * `pg` defaults to ten connections and an unbounded wait. Both defaults are
 * wrong here in the same direction. Every warm serverless instance holds its
 * own pool, so the fleet's demand on Supabase's pooler is ten times however
 * many instances happen to be warm — a number nobody chose and nothing
 * reports. And an unbounded wait turns exhaustion into a request that hangs
 * until the platform kills it, which reaches the manager as a blank screen
 * rather than as an error anyone can act on.
 *
 * Two connections is what the code actually asks for: nothing in this
 * repository opens an interactive transaction, and the widest concurrency in
 * the tree is one `Promise.all` over two reads in the administrator overview.
 */
const POOL_MAX_CONNECTIONS = 2;
const POOL_CONNECTION_TIMEOUT_MS = 10_000;
// `pg`'s own default today. Pinned so that it stays a decision of this file
// rather than of whichever version of `pg` is installed.
const POOL_IDLE_TIMEOUT_MS = 10_000;

export interface PoolConfig {
  connectionString: string;
  ssl: PoolSsl;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

/**
 * The whole of how this project connects to Postgres, in one place: the
 * runtime pool and every script build theirs from here, so a bound that holds
 * for a serverless instance is not quietly absent from a script against the
 * same database.
 */
export function resolvePoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    ssl: resolvePoolSsl(connectionString),
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
  };
}
