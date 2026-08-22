import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

/**
 * Incoming rate limiting, which this application had none of.
 *
 * `POST /api/auth/login` accepted passwords as fast as they arrived — one
 * manager account, one password, and nothing counting the guesses. That is the
 * endpoint this module exists for. The respondent's submission is here too,
 * but for a different reason and with a very different number; see
 * `RATE_LIMITS`.
 *
 * Two things this is honest about rather than quiet about:
 *
 * - **Without a shared store it is a speed bump, not a limit.** The deployment
 *   is serverless: every instance keeps its own counter, so the real ceiling is
 *   the limit times however many instances the platform happens to be running.
 *   Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and the counter
 *   moves to Redis, shared by every instance, which is the version that
 *   actually holds. Nothing else changes — no dependency, no code path the
 *   owner has to switch on.
 * - **It keys on the client address, so an address with no client identity is
 *   not limited.** Behind Vercel `x-forwarded-for` is set by the platform and
 *   cannot be spoofed by the caller. A server reached directly — local
 *   development, the browser smoke, a container with no proxy — has no such
 *   header, and this refuses to invent one: keying everything under a single
 *   bucket would rate-limit a test suite and a school's whole staffroom as if
 *   they were one attacker.
 */

export type RateLimitPolicy = {
  /** Short, stable, and part of the storage key. */
  name: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  /**
   * Ten guesses per five minutes. There is one manager account per deployment
   * (ADR-020), so an attacker's whole search space is one password — this is
   * the number that decides whether guessing it is feasible. A manager who
   * mistypes twice never sees it.
   */
  managerLogin: {
    name: "manager-login",
    limit: 10,
    windowSeconds: 300,
  },
  /**
   * Sixty submissions per five minutes, which is deliberately loose.
   *
   * A staffroom answers from one school network, so every teacher in the
   * building shares one address. The realistic burst — a staff meeting where
   * the link goes out and forty people answer — must not look like abuse, and
   * a limit tuned for a scripted attack would refuse exactly the moment the
   * product is working. Forty answers inside five minutes is already faster
   * than the questionnaire can be read; sixty leaves room and still stops a
   * script writing thousands of rows.
   *
   * This is not the defence against stuffing, and it never was. The line that
   * stood here said the attempt token hash was — but that value is computed in
   * the respondent's own browser and rotating it costs nothing, so refusing a
   * repeat of one stops a double click and not a script. What bounds a round
   * since 2026-08-22 is the ceiling in `survey/response-ceiling.ts`, which is
   * honest about bounding the rows rather than the ratio.
   */
  surveySubmission: {
    name: "survey-submission",
    limit: 60,
    windowSeconds: 300,
  },
  /**
   * The delivery beacon, in its own bucket rather than sharing the one above.
   *
   * Sharing would let a flood of reports refuse a real submission, which
   * inverts the whole point: the report is the disposable half of the pair and
   * the answers are not. The number matches the submission limit because a
   * client fires at most one report per submission and only when the first
   * attempt threw, so a staffroom cannot reach it without the submissions
   * having been refused first.
   */
  surveyDeliveryReport: {
    name: "survey-delivery-report",
    limit: 60,
    windowSeconds: 300,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitDecision = {
  allowed: boolean;
  /** Seconds until the window resets. Zero when the caller was not limited. */
  retryAfterSeconds: number;
};

const ALLOWED: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };

/**
 * The address the request came from, or `null` when there is nothing
 * trustworthy to key on.
 *
 * `x-forwarded-for` may carry a chain; the client is the first entry. On
 * Vercel the platform writes this header itself, so a caller cannot prepend a
 * fake address to escape their bucket.
 */
export function clientAddress(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const address = first || headers.get("x-real-ip")?.trim() || "";

  return address && !isLoopback(address) ? address : null;
}

/**
 * A request that appears to come from the machine it is running on is not a
 * client this can meaningfully limit.
 *
 * This is not a convenience for tests, though it is what keeps the browser
 * smoke from rate-limiting itself: Next's own server fills in
 * `x-forwarded-for` from the socket, so every request to a locally served
 * build arrives as `::1`, and the whole suite — twelve sign-ins across
 * fifteen tests — lands in one bucket and starts refusing itself at the
 * eleventh. Found exactly that way, by the suite going red.
 *
 * It is also correct on the deployment, where the platform writes the real
 * client address and loopback never appears. A caller cannot reach the
 * deployed origin claiming to be `127.0.0.1`.
 */
function isLoopback(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/gu, "");

  return (
    normalized === "::1" ||
    normalized === "localhost" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("::ffff:127.")
  );
}

/**
 * Addresses are hashed before they are stored, and salted with a secret the
 * deployment already has.
 *
 * The consent screen promises a respondent that their address is not kept
 * beside their answers. A counter is not an answer, but a bucket of plain
 * addresses sitting in Redis would still be a list of who opened the
 * questionnaire and when — so it never exists. An unsalted hash would not help
 * much either, since the whole IPv4 space can be hashed in minutes; the salt
 * is what makes the stored key meaningless outside this deployment.
 */
function storageKey(policy: RateLimitPolicy, address: string): string {
  const salt =
    process.env.RATE_LIMIT_KEY_SALT?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";
  const digest = createHash("sha256")
    .update(`${policy.name}:${address}:${salt}`)
    .digest("hex")
    .slice(0, 32);

  return `shalomut:rl:${policy.name}:${digest}`;
}

interface RateLimitStore {
  /** Counts one hit and returns the running total inside the window. */
  increment(key: string, windowSeconds: number): Promise<number>;
}

/**
 * Per-instance counters. Correct on one long-lived server, partial on
 * serverless — the reason `UPSTASH_REDIS_REST_URL` exists.
 */
class InMemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      this.sweep(now);
      return 1;
    }

    existing.count += 1;
    return existing.count;
  }

  /**
   * Expired windows are dropped on write rather than on a timer: a timer in a
   * serverless function is a handle that outlives the request it belongs to.
   */
  private sweep(now: number) {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

/**
 * Upstash over its REST API, on purpose — no client library, so this adds no
 * dependency and works unchanged on every runtime the app is deployed to.
 *
 * `EXPIRE ... NX` sets the window only on the first hit, so a burst cannot
 * keep pushing the reset further away.
 */
class UpstashRateLimitStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const response = await fetch(`${this.url.replace(/\/$/u, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSeconds), "NX"],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Upstash answered ${response.status}`);
    }

    const results = (await response.json()) as { result?: unknown }[];
    const count = Number(results?.[0]?.result);
    if (!Number.isFinite(count)) {
      throw new Error("Upstash returned no count for INCR");
    }

    return count;
  }
}

let store: RateLimitStore | null = null;

export function resolveRateLimitStore(): RateLimitStore {
  if (store) return store;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  store =
    url && token
      ? new UpstashRateLimitStore(url, token)
      : new InMemoryRateLimitStore();

  return store;
}

/** Test seam. Also what a runtime would call if the configuration changed. */
export function resetRateLimitStore(next: RateLimitStore | null = null) {
  store = next;
}

export async function consumeRateLimit(
  headers: Headers,
  policy: RateLimitPolicy,
): Promise<RateLimitDecision> {
  const address = clientAddress(headers);
  if (!address) return ALLOWED;

  try {
    const count = await resolveRateLimitStore().increment(
      storageKey(policy, address),
      policy.windowSeconds,
    );

    if (count <= policy.limit) return ALLOWED;

    return { allowed: false, retryAfterSeconds: policy.windowSeconds };
  } catch (error) {
    /*
     * Fail open, and say so out loud.
     *
     * A limiter that cannot reach its store has two ways to be wrong: let
     * guesses through, or lock the school's only manager out of their own
     * dashboard because Redis is having an afternoon. The first is recoverable
     * and the second is an outage the product caused itself, so an unreachable
     * store degrades to the behaviour that existed before this module.
     */
    console.error(
      "Rate limit store unavailable; request allowed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return ALLOWED;
  }
}

/**
 * The refusal, shaped like the other guards in `src/lib/server`: `null` means
 * carry on, a response means stop.
 */
export async function getRateLimitResponse(
  headers: Headers,
  policy: RateLimitPolicy,
): Promise<NextResponse | null> {
  const decision = await consumeRateLimit(headers, policy);
  if (decision.allowed) return null;

  return NextResponse.json(
    {
      error: "יותר מדי בקשות. נסו שוב בעוד מספר דקות.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: { "Retry-After": String(decision.retryAfterSeconds) },
    },
  );
}
