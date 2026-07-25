interface RuntimeEnvironment {
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASSWORD?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export interface BasicAuthRequest {
  pathname: string;
  method: string;
  authorization: string | null;
}

export type BasicAuthDecision = "allow" | "challenge" | "unconfigured";

/**
 * Respondents answer anonymously through an unguessable share code and must
 * never be asked for manager credentials.
 */
const RESPONDENT_PREFIXES = ["/answer/", "/api/survey/"];

const AI_INSIGHTS_PATH = /^\/api\/rounds\/[^/]+\/ai-insights\/?$/;

export function isRespondentRoute(pathname: string) {
  return RESPONDENT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Routes that the external AI service calls with their own shared secret. They
 * carry no browser session, so a Basic challenge would only break them. The GET
 * on the AI insights path returns manager analytics and stays behind the gate.
 */
export function isMachineAuthenticatedRoute(pathname: string, method: string) {
  if (pathname === "/api/mcp" || pathname === "/api/mcp/") return true;
  return method === "POST" && AI_INSIGHTS_PATH.test(pathname);
}

export function decideBasicAuth(
  request: BasicAuthRequest,
  environment: RuntimeEnvironment = process.env,
): BasicAuthDecision {
  if (isRespondentRoute(request.pathname)) return "allow";
  if (isMachineAuthenticatedRoute(request.pathname, request.method)) {
    return "allow";
  }

  const expectedUser = environment.BASIC_AUTH_USER?.trim();
  const expectedPassword = environment.BASIC_AUTH_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    const isDeployedRuntime =
      environment.NODE_ENV === "production" ||
      Boolean(environment.VERCEL_ENV?.trim());

    // Fail closed: a deployment without credentials must not silently serve
    // manager surfaces to anyone who finds the URL.
    return isDeployedRuntime ? "unconfigured" : "allow";
  }

  const supplied = decodeBasicCredentials(request.authorization);
  if (!supplied) return "challenge";

  const userMatches = timingSafeEqual(supplied.user, expectedUser);
  const passwordMatches = timingSafeEqual(supplied.password, expectedPassword);

  return userMatches && passwordMatches ? "allow" : "challenge";
}

function decodeBasicCredentials(header: string | null) {
  if (!header) return null;

  const separatorIndex = header.indexOf(" ");
  if (separatorIndex < 0) return null;
  if (header.slice(0, separatorIndex).toLowerCase() !== "basic") return null;

  let decoded: string;
  try {
    decoded = atob(header.slice(separatorIndex + 1).trim());
  } catch {
    return null;
  }

  const colonIndex = decoded.indexOf(":");
  if (colonIndex < 0) return null;

  return {
    user: decoded.slice(0, colonIndex),
    password: decoded.slice(colonIndex + 1),
  };
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}
