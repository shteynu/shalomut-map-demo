import dimensionTextsManifest from "../../contracts/wellbeing-dimensions.json";

/**
 * The eight dimensions of the model, and only their identity.
 *
 * This is the one list the union in `shalomut-source.ts`, the eight stones on
 * the map and the aggregate's `dimensionScores` all have to agree on. It is
 * declared here rather than derived from the manifest so that a dimension is
 * still a compile-time thing: the map has eight hand-tuned organic shapes with
 * positions chosen by eye, so a ninth entry in a JSON file would be a stone
 * nobody drew, discovered at runtime. The loader below refuses a manifest that
 * disagrees with this list, which is what keeps the two honest.
 */
export type WellbeingDimensionId =
  | "self-expression"
  | "professional-competence"
  | "social-resource"
  | "balance"
  | "management-support"
  | "certainty"
  | "organizational-climate"
  | "meaning";

/**
 * The order every screen lists the dimensions in — the map, the dimension
 * pages and the breakdown table. It used to match between them by coincidence.
 */
export const WELLBEING_DIMENSION_IDS: readonly WellbeingDimensionId[] = [
  "self-expression",
  "professional-competence",
  "social-resource",
  "balance",
  "management-support",
  "certainty",
  "organizational-climate",
  "meaning",
] as const;

/**
 * What a reader is shown for one dimension. Four strings and nothing else: no
 * score, no question, no geometry.
 *
 * `label` and `conceptLabel` are two different names on purpose — the formal
 * one and the one the map and dashboard use — and for five of the eight they
 * happen to be the same word. `sourceLabel` is provenance: the heading this
 * dimension had in the Google form the instrument came from, which is
 * sometimes richer than the label the product settled on. Nothing renders it;
 * it is here so the methodology can be traced back without opening the form.
 */
export interface WellbeingDimensionTexts {
  id: WellbeingDimensionId;
  label: string;
  conceptLabel: string;
  subtitle: string;
  sourceLabel: string;
}

const TEXT_FIELDS = [
  "label",
  "conceptLabel",
  "subtitle",
  "sourceLabel",
] as const;

function readText(
  entry: Record<string, unknown>,
  field: (typeof TEXT_FIELDS)[number],
  id: string,
): string {
  const value = entry[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Dimension '${id}' needs a non-empty ${field}`);
  }
  return value;
}

/**
 * Read the manifest, or refuse to start.
 *
 * The manifest may change what a dimension is *called*; it may not change
 * which dimensions there are. A missing entry would leave a stone on the map
 * with no name and an aggregate key with no reader, and an unknown one would
 * be a dimension nothing can display — so both are errors here rather than
 * `undefined` somewhere later.
 */
export function loadDimensionTexts(
  manifest: unknown,
): WellbeingDimensionTexts[] {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Dimension texts manifest must be an object");
  }

  const raw = (manifest as { dimensions?: unknown }).dimensions;
  if (!Array.isArray(raw)) {
    throw new Error("Dimension texts manifest must define dimensions");
  }
  if (raw.length !== WELLBEING_DIMENSION_IDS.length) {
    throw new Error(
      `Dimension texts manifest must define exactly ` +
        `${WELLBEING_DIMENSION_IDS.length} dimensions, not ${raw.length}`,
    );
  }

  return raw.map((rawEntry, index) => {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error(`Dimension ${index} must be an object`);
    }
    const entry = rawEntry as Record<string, unknown>;
    const expectedId = WELLBEING_DIMENSION_IDS[index];

    // Position rather than lookup, so the manifest also fixes the order the
    // screens read the dimensions in. A reordered manifest is a reordered map.
    if (entry.id !== expectedId) {
      throw new Error(
        `Dimension ${index} must be '${expectedId}', not '${String(entry.id)}'`,
      );
    }

    return {
      id: expectedId,
      label: readText(entry, "label", expectedId),
      conceptLabel: readText(entry, "conceptLabel", expectedId),
      subtitle: readText(entry, "subtitle", expectedId),
      sourceLabel: readText(entry, "sourceLabel", expectedId),
    };
  });
}

export const WELLBEING_DIMENSION_TEXTS: WellbeingDimensionTexts[] =
  loadDimensionTexts(dimensionTextsManifest);

export function dimensionTextsFor(
  id: WellbeingDimensionId,
): WellbeingDimensionTexts {
  const texts = WELLBEING_DIMENSION_TEXTS.find(
    (candidate) => candidate.id === id,
  );
  // Unreachable while the loader holds, and cheaper to state than to leave the
  // caller reading `undefined.conceptLabel` if it ever stops holding.
  if (!texts) throw new Error(`No texts for dimension '${id}'`);
  return texts;
}
