import capabilitiesManifest from '../../contracts/capabilities.json';

export interface ContractCapabilities {
  isSemanticContract: boolean;
  supportsDynamicQuestions: boolean;
  supportsBackgroundContext: boolean;
  supportsScoreDistribution: boolean;
  supportsPartialMaps: boolean;
  supportsAdaptationOutcome: boolean;
  usesStructuredDimensionSummary: boolean;
  usesNarrativeMetrics: boolean;
  hasOverallSummarySentenceLimit: boolean;
  stoneInterpretationSentenceLimit: '2' | '2-5';
}

const BOOLEAN_CAPABILITY_FIELDS = [
  'isSemanticContract',
  'supportsDynamicQuestions',
  'supportsBackgroundContext',
  'supportsScoreDistribution',
  'supportsPartialMaps',
  'supportsAdaptationOutcome',
  'usesStructuredDimensionSummary',
  'usesNarrativeMetrics',
  'hasOverallSummarySentenceLimit',
] as const;

export function loadContractRegistry(
  manifest: unknown,
): Record<string, ContractCapabilities> {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Contract capabilities manifest must be an object');
  }
  const versions = (manifest as { versions?: unknown }).versions;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) {
    throw new Error('Contract capabilities manifest must define versions');
  }

  const registry: Record<string, ContractCapabilities> = {};
  for (const [version, rawCapabilities] of Object.entries(versions)) {
    if (
      !rawCapabilities ||
      typeof rawCapabilities !== 'object' ||
      Array.isArray(rawCapabilities)
    ) {
      throw new Error(`Capabilities for ${version} must be an object`);
    }
    const capabilities = rawCapabilities as Record<string, unknown>;
    for (const field of BOOLEAN_CAPABILITY_FIELDS) {
      if (typeof capabilities[field] !== 'boolean') {
        throw new Error(`Capabilities for ${version} require boolean ${field}`);
      }
    }
    if (
      capabilities.stoneInterpretationSentenceLimit !== '2' &&
      capabilities.stoneInterpretationSentenceLimit !== '2-5'
    ) {
      throw new Error(
        `Capabilities for ${version} have an invalid stone interpretation limit`,
      );
    }
    registry[version] = capabilities as unknown as ContractCapabilities;
  }
  return registry;
}

export const CONTRACT_REGISTRY = Object.freeze(
  loadContractRegistry(capabilitiesManifest),
);

export function getCapabilities(version: string): ContractCapabilities {
  const capabilities = CONTRACT_REGISTRY[version];
  if (!capabilities) {
    throw new Error(`Unknown contract version: ${version}`);
  }
  return capabilities;
}

export function isVersionSupported(version: string): boolean {
  return version in CONTRACT_REGISTRY;
}
