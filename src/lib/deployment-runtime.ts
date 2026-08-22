/**
 * Whether this process is a deployed runtime, in one place.
 *
 * The same three-line expression had been written out three times — in
 * `auth/jwt-session-provider.ts`, in `auth/manager-auth-service.ts` and, in a
 * weaker form, in `server/shared-secret.ts`, which asked only about
 * `VERCEL_ENV`. Two of them fail closed and the third failed open, so a
 * container running `NODE_ENV=production` outside Vercel demanded a session
 * secret and refused an unconfigured manager organization while handing the
 * machine-to-machine endpoints to anyone who asked. The audit of 2026-08-21
 * called that a disagreement rather than an exposure — Core runs on Vercel,
 * where the variable is always set — and it was right about both halves.
 *
 * The build is excluded deliberately. `next build` prerenders with
 * `NODE_ENV=production` and no deployment variables at all, so a predicate
 * that counted it would make every build demand the runtime's configuration.
 */

export interface DeploymentEnvironment {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  NEXT_PHASE?: string;
}

export function isDeployedRuntime(
  environment: DeploymentEnvironment = process.env,
): boolean {
  const isBuilding = environment.NEXT_PHASE === "phase-production-build";

  return (
    (environment.NODE_ENV === "production" ||
      Boolean(environment.VERCEL_ENV?.trim())) &&
    !isBuilding
  );
}
