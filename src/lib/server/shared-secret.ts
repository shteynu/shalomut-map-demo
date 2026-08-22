import { createHash, timingSafeEqual } from 'node:crypto';

import { isDeployedRuntime } from '@/lib/deployment-runtime';

/**
 * The machine-to-machine door: the AI service and the MCP data layer both
 * arrive here holding a shared secret rather than a session.
 *
 * Two things changed on 2026-08-22, both named by the audit of 2026-08-21.
 *
 * **It used to fail open on runtimes it did not recognize.** An unset secret
 * authorized the caller whenever `VERCEL_ENV` was also unset — a reasonable
 * shape for local development, and a hole anywhere else that is deployed. Core
 * runs on Vercel, where the variable is always present, so nothing was exposed;
 * what was wrong is that the file decided "am I deployed?" differently from the
 * two auth modules that ask the same question. It now asks
 * `isDeployedRuntime`, so a container with `NODE_ENV=production` and no Vercel
 * around it is closed like everything else.
 *
 * **And it compared with `===`.** A string comparison returns as soon as two
 * bytes differ, so the time it takes leaks how much of the secret a guess got
 * right — the attack that turns 2^256 guesses into a few thousand. This is a
 * small risk over a network and a free thing to remove.
 */
export function hasConfiguredSharedSecret(
  request: Request,
  environmentVariable: string,
): boolean {
  const expectedSecret = process.env[environmentVariable];
  if (!expectedSecret) {
    /*
     * Unconfigured. Off a deployed runtime this is the local pipeline running
     * without secrets, which `docs/local-environment.md` discourages and this
     * still permits; on one, it is a misconfiguration, and an open door is the
     * worst possible answer to it.
     */
    return !isDeployedRuntime();
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return false;

  return constantTimeEquals(authorization, `Bearer ${expectedSecret}`);
}

/**
 * Compared as digests rather than as strings, which fixes the length leak too:
 * `timingSafeEqual` throws on inputs of different lengths, so feeding it the
 * raw values would answer "wrong length" instantly and "wrong bytes" slowly.
 * Two SHA-256 digests are always 32 bytes.
 */
function constantTimeEquals(left: string, right: string): boolean {
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest();

  return timingSafeEqual(digest(left), digest(right));
}

export function createSharedSecretHeaders(
  environmentVariable: string,
): Record<string, string> {
  const secret = process.env[environmentVariable];
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}
