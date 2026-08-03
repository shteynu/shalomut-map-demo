import scoringBandsManifest from '../../contracts/scoring-bands.json';
import type { WellbeingStatus } from './shalomut-source';

/**
 * The one place a 0-100 score becomes a colour.
 *
 * The bands used to be three literal copies in Core and two more in Python, and
 * the only thing standing between them and a silent disagreement was the
 * cross-runtime corpus. They now come from `contracts/scoring-bands.json`,
 * which `ai-analytics-service/src/schemas/scoring_bands.py` reads as well, so
 * a methodology change after the pilot is one edit rather than six.
 *
 * This deliberately stays deployment-wide rather than round-scoped: Python
 * validates that a payload's status matches its score, so per-round bands
 * would have to travel inside the payload, which is new semantics for
 * contracts `1.0`-`6.0` and would need a version of its own.
 */
export interface ScoreBand {
  status: WellbeingStatus;
  min: number;
  max: number;
}

const STATUS_ORDER: WellbeingStatus[] = ['green', 'yellow', 'red'];
const LOWEST_SCORE = 0;
const HIGHEST_SCORE = 100;

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function loadScoringBands(manifest: unknown): ScoreBand[] {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Scoring bands manifest must be an object');
  }
  const rawBands = (manifest as { bands?: unknown }).bands;
  if (!Array.isArray(rawBands) || rawBands.length !== STATUS_ORDER.length) {
    throw new Error(
      `Scoring bands manifest must define ${STATUS_ORDER.length} bands`,
    );
  }

  const bands: ScoreBand[] = rawBands.map((rawBand, index) => {
    if (!rawBand || typeof rawBand !== 'object' || Array.isArray(rawBand)) {
      throw new Error(`Scoring band ${index} must be an object`);
    }
    const band = rawBand as Record<string, unknown>;
    const expectedStatus = STATUS_ORDER[index];
    if (band.status !== expectedStatus) {
      throw new Error(
        `Scoring band ${index} must have status '${expectedStatus}'`,
      );
    }
    if (!isInteger(band.min) || !isInteger(band.max)) {
      throw new Error(
        `Scoring band '${expectedStatus}' needs integer min and max`,
      );
    }
    if (band.min > band.max) {
      throw new Error(`Scoring band '${expectedStatus}' has min above max`);
    }
    return { status: expectedStatus, min: band.min, max: band.max };
  });

  // Descending order with no gap and no overlap. A gap would leave a score
  // without a colour, and an overlap would make the answer depend on which
  // copy of the lookup ran.
  if (bands[0].max !== HIGHEST_SCORE) {
    throw new Error(`Scoring bands must reach ${HIGHEST_SCORE}`);
  }
  if (bands[bands.length - 1].min !== LOWEST_SCORE) {
    throw new Error(`Scoring bands must start at ${LOWEST_SCORE}`);
  }
  for (let index = 1; index < bands.length; index++) {
    if (bands[index].max + 1 !== bands[index - 1].min) {
      throw new Error(
        `Scoring bands '${bands[index - 1].status}' and ` +
          `'${bands[index].status}' must be adjacent`,
      );
    }
  }

  return bands;
}

export const SCORING_BANDS: ScoreBand[] = loadScoringBands(
  scoringBandsManifest,
);

/**
 * Map a 0-100 score onto its band. A score outside that range cannot come from
 * an aggregate, so it takes the nearest band rather than inventing a fourth
 * status.
 */
export function statusForScore(score: number): WellbeingStatus {
  const band = SCORING_BANDS.find((candidate) => score >= candidate.min);
  return band ? band.status : SCORING_BANDS[SCORING_BANDS.length - 1].status;
}
