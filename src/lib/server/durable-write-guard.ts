import { NextResponse } from "next/server";

interface RuntimeEnvironment {
  DATABASE_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export function isDurableWriteUnavailable(
  environment: RuntimeEnvironment = process.env,
) {
  const isDeployedRuntime =
    environment.NODE_ENV === "production" ||
    Boolean(environment.VERCEL_ENV?.trim());
  const hasDatabase = Boolean(environment.DATABASE_URL?.trim());

  return isDeployedRuntime && !hasDatabase;
}

export function getDurableWriteGuardResponse() {
  if (!isDurableWriteUnavailable()) return null;

  return NextResponse.json(
    {
      error:
        "Persistent storage is not configured. This deployment cannot save data.",
    },
    { status: 503 },
  );
}
