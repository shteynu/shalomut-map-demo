/**
 * How a `pg` pool should be encrypted for a given connection string.
 *
 * Supabase terminates TLS with a certificate chain Node does not trust by
 * default, hence `rejectUnauthorized: false` for the deployed database. The
 * local Postgres container speaks no TLS at all, and `pg` asked for SSL against
 * it fails with "The server does not support SSL connections" — so the local
 * environment has to be recognised rather than configured, or every script
 * would need its own flag.
 */
export function resolvePoolSsl(
  connectionString: string,
): false | { rejectUnauthorized: false } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { rejectUnauthorized: false };
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

  return isLoopback ? false : { rejectUnauthorized: false };
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
  ssl: false | { rejectUnauthorized: false };
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
