import capabilitiesManifest from '../../contracts/capabilities.json';

export interface ContractCapabilities {
  isSemanticContract: boolean;
  supportsDynamicQuestions: boolean;
  supportsBackgroundContext: boolean;
  supportsScoreDistribution: boolean;
  supportsPartialMaps: boolean;
  supportsAdaptationOutcome: boolean;
  hasOverallSummarySentenceLimit: boolean;
  stoneInterpretationSentenceLimit: '2' | '2-5';
}

export const CONTRACT_REGISTRY: Record<string, ContractCapabilities> = capabilitiesManifest.versions as Record<string, ContractCapabilities>;

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
