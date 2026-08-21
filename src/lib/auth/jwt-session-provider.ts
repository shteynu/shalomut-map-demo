import type { ISessionProvider, SessionMintOptions } from "./domain-contract";
import { absoluteDeadlineFrom, ttlSecondsWithin } from "./session-lifetime";
import type {
  Manager,
  ManagerSession,
  OrganizationMembership,
} from "./types";

const DEFAULT_SECRET = "shalomut-map-dev-session-secret-must-be-configured-in-production";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  const isBuilding = process.env.NEXT_PHASE === "phase-production-build";
  const isDeployedRuntime =
    (process.env.NODE_ENV === "production" ||
      Boolean(process.env.VERCEL_ENV?.trim())) &&
    !isBuilding;

  if (isDeployedRuntime && !secret) {
    throw new Error(
      "SESSION_SECRET environment variable must be configured in production/deployed environment.",
    );
  }

  return secret || DEFAULT_SECRET;
}

/**
 * Which secret this runtime signs and verifies with — never the secret itself.
 *
 * A Next.js application runs the middleware and the route handlers in two
 * different runtimes, and each one resolves `process.env` its own way. When
 * they disagree, one of them issues tokens the other refuses, and every symptom
 * points at the login screen instead. Naming the source is what separates
 * "this browser holds a stale token" from "these two runtimes are not reading
 * the same configuration".
 */
export function describeSessionSecretSource(): "configured" | "built-in" {
  return process.env.SESSION_SECRET?.trim() ? "configured" : "built-in";
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * The `<ArrayBuffer>` is load-bearing for the caller, not decoration: without
 * it the bytes widen to `ArrayBufferLike`, which `BufferSource` does not
 * accept, and the only way back is the `.buffer` that broke verification in
 * the middleware's realm.
 */
function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class JwtSessionProvider implements ISessionProvider {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || getSessionSecret();
  }

  async createSession(
    manager: Manager,
    activeOrganizationId: string | null,
    memberships: OrganizationMembership[],
    options: SessionMintOptions = {},
  ): Promise<{ token: string; session: ManagerSession }> {
    const membership = activeOrganizationId
      ? memberships.find((m) => m.organizationId === activeOrganizationId)
      : null;
    if (activeOrganizationId && !membership) {
      throw new Error(
        `Manager is not a member of organization '${activeOrganizationId}'`,
      );
    }
    // A platform administrator belongs to no school and names none until they
    // open one. Everybody else has exactly one and the token must say so:
    // a session with no school and no flag would read every screen as
    // "choose a school" with nothing to choose.
    if (!activeOrganizationId && !manager.isPlatformAdministrator) {
      throw new Error(
        "A school user's session must name the school it is read inside",
      );
    }

    const now = new Date();
    // A renewal hands back the deadline its predecessor carried; a sign-in
    // names none and starts one. That single line is the difference between a
    // window that slides and a session nobody can end by waiting.
    const absoluteExpiresAt =
      options.absoluteExpiresAt ?? absoluteDeadlineFrom(now);
    const ttlSeconds =
      options.ttlSeconds ?? ttlSecondsWithin(absoluteExpiresAt, now);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: ManagerSession = {
      managerId: manager.id,
      email: manager.email,
      activeOrganizationId,
      role: membership?.role ?? "admin",
      memberships,
      isPlatformAdministrator: manager.isPlatformAdministrator,
      issuedAt: now,
      expiresAt,
      absoluteExpiresAt,
    };

    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sub: manager.id,
      email: manager.email,
      org: activeOrganizationId,
      role: membership?.role ?? "admin",
      // Short, like every other claim here, and absent rather than false for a
      // school user: a token minted before administrators existed decodes as
      // "not an administrator", which is the safe reading of silence.
      ...(manager.isPlatformAdministrator ? { adm: true } : {}),
      mbs: memberships.map((m) => ({
        id: m.id,
        org: m.organizationId,
        role: m.role,
        status: m.status,
      })),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      // The only claim a renewal copies rather than recomputes. Required on the
      // way back in — see `verifyToken` — so a token minted before this claim
      // existed cannot be renewed into one that has it.
      abs: Math.floor(absoluteExpiresAt.getTime() / 1000),
    };

    const encoder = new TextEncoder();
    const encodedHeader = base64UrlEncode(
      encoder.encode(JSON.stringify(header)),
    );
    const encodedPayload = base64UrlEncode(
      encoder.encode(JSON.stringify(payload)),
    );
    const dataToSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);

    const key = await getCryptoKey(this.secret);
    const signature = await crypto.subtle.sign("HMAC", key, dataToSign);
    const encodedSignature = base64UrlEncode(signature);

    const token = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

    return { token, session };
  }

  async verifyToken(token: string): Promise<ManagerSession | null> {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    try {
      const key = await getCryptoKey(this.secret);
      const encoder = new TextEncoder();
      const dataToVerify = encoder.encode(
        `${encodedHeader}.${encodedPayload}`,
      );
      const signatureBytes = base64UrlDecode(encodedSignature);

      // The bytes, not `signatureBytes.buffer`. The middleware runs in a
      // sandbox with its own realm, so an ArrayBuffer created there fails the
      // `instanceof ArrayBuffer` check inside SubtleCrypto and the call throws
      // before it ever looks at a signature — on Node 20, where CI runs, while
      // newer Node happens not to trip on it. A typed array is detected by
      // `ArrayBuffer.isView`, which does not care which realm made it.
      //
      // Every manager session was refused by the middleware and accepted by
      // the route handlers, so the product looked exactly like a wrong
      // password. Only the browser smoke could see it.
      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        dataToVerify,
      );

      if (!isValid) return null;

      const payloadJson = new TextDecoder().decode(
        base64UrlDecode(encodedPayload),
      );
      const payload = JSON.parse(payloadJson);

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp && nowSeconds > payload.exp) {
        return null; // Expired
      }

      // Absent, not merely past, is also a refusal — the safe reading of
      // silence, the same one `adm` gets three lines down. The claim arrived
      // with the short session, so a token without it is a 24-hour token minted
      // before the deadline existed, and honouring it would mean the one class
      // of session this phase exists to end outlives the phase. The cost is
      // that whoever is signed in when this deploys signs in once more.
      if (typeof payload.abs !== "number" || nowSeconds > payload.abs) {
        return null;
      }

      const memberships: OrganizationMembership[] = (payload.mbs || []).map(
        (m: { id: string; org: string; role: string; status: string }) => ({
          id: m.id,
          managerId: payload.sub,
          organizationId: m.org,
          role: m.role as "admin" | "manager",
          status: m.status as "active" | "invited" | "suspended",
          createdAt: new Date(),
        }),
      );

      return {
        managerId: payload.sub,
        email: payload.email,
        activeOrganizationId: payload.org ?? null,
        role: payload.role,
        memberships,
        isPlatformAdministrator: payload.adm === true,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
        absoluteExpiresAt: new Date(payload.abs * 1000),
      };
    } catch (error) {
      // A malformed token is refused above, by the shape checks and the
      // signature, and reaching here means the verification itself broke —
      // which is a fact about this runtime, not about the caller. Swallowing
      // it is what let a cross-realm ArrayBuffer refuse every session for
      // three CI runs while reading as a wrong password.
      console.warn(
        `[auth] session verification failed to run: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async revokeSession(): Promise<void> {
    // Still nothing to do, and now for a stated reason rather than a pending
    // one. A JWT is not held anywhere it could be deleted from, so revocation
    // is the short window plus the database re-read at renewal
    // (`/api/auth/session/renew`): taking a membership away stops the next
    // renewal, and the token that is still in the browser dies on its own
    // within `SESSION_TTL_SECONDS`. A blacklist would close that last window
    // and is a different design; it is not what phase 5 asked for.
  }
}
