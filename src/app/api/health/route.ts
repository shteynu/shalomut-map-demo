import { NextResponse } from 'next/server';

import { AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS } from '@/lib/ai-contract';
import {
  PRODUCER_CONTRACT_VERSION_ENV,
  PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
  resolveProducedAnalyticsContractVersion,
} from '@/lib/ai-contract-version';
import { resolveDeploymentCommit } from '@/lib/deployment-commit';

/**
 * What this deployment is and what it can do.
 *
 * The contract version is a legitimate thing to publish — it is already on
 * every wire payload — and having it answerable in one request is what makes
 * "which version is actually live?" a question with an answer, rather than an
 * inference from deployment variables nobody can read back.
 *
 * It deliberately imports the resolver and not `analytics.service`: that module
 * throws on an unsupported value the moment it loads, so importing it here
 * would take down the endpoint whose whole job is to report that failure.
 *
 * Nothing here is secret. No database, provider or credential state is
 * reported: an endpoint that says whether a secret is set is an endpoint that
 * tells an anonymous caller where to push.
 *
 * One variable's value does reach the response, and only one: `commit`, which
 * says which revision this deployment runs. It is published because the
 * repository is public, so the SHA is already public, and because the sibling
 * `/health` on the AI service has reported it all along — without it, "is the
 * deployed code the code I just pushed?" had an answer for one half of the
 * system and not the other. `resolveDeploymentCommit` publishes it only when
 * the value is provably a commit SHA and could be nothing else, which is what
 * keeps the rule this comment used to state absolutely.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  // Resolved before the branch: a deployment that cannot produce a contract
  // still runs a revision, and that is the first thing worth knowing about it.
  const commit = resolveDeploymentCommit();
  const produced = resolveProducedAnalyticsContractVersion(
    process.env[PRODUCER_CONTRACT_VERSION_ENV],
  );

  if (!produced.ok) {
    return NextResponse.json(
      {
        status: 'misconfigured',
        commit,
        error: produced.error,
        analytics: {
          producibleContractVersions: PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      commit,
      analytics: {
        // What Core emits right now, and whether that was chosen or inherited.
        producedContractVersion: produced.version,
        producedContractVersionSource: produced.source,
        producibleContractVersions: PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS,
        // What Core still accepts on a callback, which is wider: historical
        // versions stay readable long after they stop being produced.
        supportedContractVersions: AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
      },
    },
    { status: 200 },
  );
}
