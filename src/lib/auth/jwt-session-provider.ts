import type { ISessionProvider } from "./domain-contract";
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

function base64UrlDecode(str: string): Uint8Array {
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
    activeOrganizationId: string,
    memberships: OrganizationMembership[],
    ttlSeconds = 86400,
  ): Promise<{ token: string; session: ManagerSession }> {
    const membership = memberships.find(
      (m) => m.organizationId === activeOrganizationId,
    );
    if (!membership) {
      throw new Error(
        `Manager is not a member of organization '${activeOrganizationId}'`,
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const session: ManagerSession = {
      managerId: manager.id,
      email: manager.email,
      activeOrganizationId,
      role: membership.role,
      memberships,
      issuedAt: now,
      expiresAt,
    };

    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      sub: manager.id,
      email: manager.email,
      org: activeOrganizationId,
      role: membership.role,
      mbs: memberships.map((m) => ({
        id: m.id,
        org: m.organizationId,
        role: m.role,
        status: m.status,
      })),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
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

      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes.buffer as ArrayBuffer,
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
        activeOrganizationId: payload.org,
        role: payload.role,
        memberships,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return null;
    }
  }

  async revokeSession(): Promise<void> {
    // JWT tokens are stateless; revocation can be handled via short TTL or a token blacklist if needed
  }
}
