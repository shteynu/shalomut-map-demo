import {
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_V4_CONTRACT_VERSION,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  AI_ANALYTICS_V6_CONTRACT_VERSION,
} from './ai-contract';

/**
 * Which analytics contract this deployment produces, and whether the
 * configuration that chooses it makes sense.
 *
 * Kept apart from `analytics.service.ts` on purpose: that module fails on an
 * unsupported value the moment it is imported, which is what stops a
 * misconfigured deployment. Something still has to be able to *report* the
 * misconfiguration, so the resolver lives here and answers without throwing.
 */

/** The environment variable that selects the produced version. */
export const PRODUCER_CONTRACT_VERSION_ENV = 'AI_ANALYTICS_CONTRACT_VERSION';

/**
 * Versions Core can emit. `1.0` and `2.0` are immutable historical exchanges
 * that no current round produces, so naming them here would offer a rollback
 * that the analytics calculator cannot actually perform.
 *
 * The type is written as literals rather than derived from the manifests: a
 * manifest is imported JSON, so its `version` widens to `string`, and deriving
 * the type from it would erase the union that `RoundAnalyticsV3Result` depends
 * on. The values still come from the manifests, and the check below fails the
 * import if the two ever disagree — so the literals cannot quietly go stale.
 */
export type ProducedAnalyticsContractVersion =
  | '3.0'
  | '4.0'
  | '5.0'
  | '6.0';

export const PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS: readonly ProducedAnalyticsContractVersion[] =
  Object.freeze(['3.0', '4.0', '5.0', '6.0'] as const);

{
  const fromManifests = [
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_V4_CONTRACT_VERSION,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_V6_CONTRACT_VERSION,
  ];
  const declared = PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS.join(', ');
  if (fromManifests.join(', ') !== declared) {
    throw new Error(
      'The producible analytics contract versions no longer match the ' +
        `contract manifests: manifests say ${fromManifests.join(', ')}, ` +
        `this module says ${declared}.`,
    );
  }
}

/**
 * What an unset variable means. Every current consumer accepts 5.0 and the
 * deployed producer already uses it, so an absent variable must preserve the
 * complete current payload rather than silently drop background context and
 * score distributions by falling back to 3.0. A misspelled value still fails
 * closed below.
 */
export const DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION: ProducedAnalyticsContractVersion =
  '5.0';

export type ResolvedProducerContractVersion =
  | {
      ok: true;
      version: ProducedAnalyticsContractVersion;
      source: 'default' | 'configured';
    }
  | { ok: false; error: string };

export class UnsupportedProducerContractVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedProducerContractVersionError';
  }
}

function isProducible(
  value: string,
): value is ProducedAnalyticsContractVersion {
  return (PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS as readonly string[]).includes(
    value,
  );
}

/**
 * Reads the configured value without throwing, so a caller can report the
 * problem rather than become it.
 *
 * The message never repeats the configured value: this feeds a public endpoint,
 * and echoing whatever a variable happens to hold is how a misplaced secret
 * gets published. The value is worth naming in a thrown error, which stays in
 * logs, and that is where it appears.
 */
export function resolveProducedAnalyticsContractVersion(
  rawValue: string | undefined,
): ResolvedProducerContractVersion {
  const value = rawValue?.trim();

  if (!value) {
    return {
      ok: true,
      version: DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
      source: 'default',
    };
  }

  if (!isProducible(value)) {
    return {
      ok: false,
      error:
        `${PRODUCER_CONTRACT_VERSION_ENV} is set to a version this deployment ` +
        `cannot produce. Supported values are ` +
        `${PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS.join(', ')}, or leave it ` +
        `empty for ${DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION}.`,
    };
  }

  return { ok: true, version: value, source: 'configured' };
}

/**
 * The produced version, or a thrown error.
 *
 * A typo used to fall through to the oldest contract, so a deployment meant to
 * emit `5.0` would quietly emit `3.0` instead: rounds lose the school context
 * and the score distributions, nothing reports an error, and the only symptom
 * is thinner analysis nobody can trace back to a configuration value.
 */
export function getProducedAnalyticsContractVersion(
  env: Record<string, string | undefined> = process.env,
): ProducedAnalyticsContractVersion {
  const resolved = resolveProducedAnalyticsContractVersion(
    env[PRODUCER_CONTRACT_VERSION_ENV],
  );

  if (!resolved.ok) {
    throw new UnsupportedProducerContractVersionError(
      `${resolved.error} Configured value: ` +
        `'${env[PRODUCER_CONTRACT_VERSION_ENV]}'.`,
    );
  }

  return resolved.version;
}
