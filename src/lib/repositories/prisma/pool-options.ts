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
