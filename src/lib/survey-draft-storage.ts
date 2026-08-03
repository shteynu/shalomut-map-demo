/**
 * The unfinished answers of one anonymous attempt, kept in the browser.
 *
 * Nothing here reaches the server. A refresh used to destroy the whole
 * questionnaire, so the draft exists to survive that — and only that. It lives
 * in `sessionStorage` rather than `localStorage` on purpose: the product
 * advertises filling several questionnaires on a shared staff computer, and
 * durable storage would show one person's answers to the next. The boundary is
 * therefore explicit — the progress survives a refresh and a failed request,
 * not the closing of the tab.
 *
 * Every function that decides something is pure. Reading, writing and deleting
 * are thin wrappers around them, so the whole fail-closed policy below is
 * tested without a DOM.
 */

import { isAttemptToken } from './survey-attempt-token';
import type { AnswerValue, SurveyDefinitionQuestion } from './types/backend';

export const SURVEY_DRAFT_SCHEMA_VERSION = 1;

/**
 * What a draft may hold.
 *
 * The list is deliberately short. There is no organization name, respondent
 * name, email, address, free text or server response id, and there must never
 * be: a draft that could be tied back to a person would defeat the anonymity
 * the questionnaire promises on its own consent screen.
 */
export interface SurveyDraftV1 {
  schemaVersion: typeof SURVEY_DRAFT_SCHEMA_VERSION;
  shareCode: string;
  questionnaireFingerprint: string;
  attemptToken: string;
  answers: Record<string, AnswerValue>;
  currentIndex: number;
  consentAcceptedAt: string;
  updatedAt: string;
}

export type SurveyDraftRejection =
  | 'absent'
  | 'malformed'
  | 'unknown-version'
  | 'share-code-mismatch'
  | 'fingerprint-mismatch'
  | 'invalid-answers'
  | 'missing-token';

export interface SurveyDraftExpectation {
  shareCode: string;
  questionnaireFingerprint: string;
  questionIds: ReadonlySet<string>;
  questionCount: number;
}

export type SurveyDraftParseResult =
  | { ok: true; draft: SurveyDraftV1 }
  | { ok: false; reason: SurveyDraftRejection };

export type SurveyDraftWriteResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'quota' };

const ANSWER_VALUES: readonly AnswerValue[] = ['green', 'yellow', 'red'];

/** One key per share code, so two questionnaires on one tab cannot collide. */
export function surveyDraftStorageKey(shareCode: string): string {
  return `shalomut:survey-draft:v${SURVEY_DRAFT_SCHEMA_VERSION}:${shareCode}`;
}

/**
 * Identifies the questionnaire a draft belongs to.
 *
 * Synchronous and not cryptographic, both on purpose. `crypto.subtle` is only
 * available in a secure context, so hashing here would make recovery fail on
 * origins where the questionnaire itself still works; and an `await` inside
 * hydration would open a window in which the save effect writes the empty
 * initial state over a draft that was about to be read. A plain function closes
 * that race instead of guarding it.
 *
 * Question order is part of the identity because the draft restores a position,
 * not just a set of answers.
 */
export function questionnaireFingerprint(
  questions: readonly Pick<
    SurveyDefinitionQuestion,
    'id' | 'dimensionId' | 'text' | 'answerMode'
  >[],
): string {
  const serialized = JSON.stringify(
    questions.map(({ id, dimensionId, text, answerMode }) => [
      id,
      dimensionId,
      text,
      answerMode,
    ]),
  );

  // FNV-1a, 32 bits. A collision would restore answers into a different
  // questionnaire of the same shape for a single respondent, which is why the
  // text of every question is part of the input rather than just its id.
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function createSurveyDraft(
  input: Omit<SurveyDraftV1, 'schemaVersion' | 'updatedAt'>,
  now: Date = new Date(),
): SurveyDraftV1 {
  return {
    ...input,
    schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
    updatedAt: now.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Turns stored text into a draft, or says why it will not.
 *
 * Fail closed everywhere except the cursor. Answers that no longer match the
 * questionnaire are discarded whole rather than partially reconstructed —
 * guessing which of them still apply would silently attribute a respondent's
 * answer to a question they never read. `currentIndex` is the one exception:
 * clamping a cursor costs nothing, while throwing away every answer because a
 * position drifted would be the larger loss.
 */
export function parseSurveyDraft(
  raw: string | null,
  expected: SurveyDraftExpectation,
): SurveyDraftParseResult {
  if (raw === null) return { ok: false, reason: 'absent' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!isRecord(parsed)) return { ok: false, reason: 'malformed' };

  if (parsed.schemaVersion !== SURVEY_DRAFT_SCHEMA_VERSION) {
    return { ok: false, reason: 'unknown-version' };
  }

  if (parsed.shareCode !== expected.shareCode) {
    return { ok: false, reason: 'share-code-mismatch' };
  }

  if (parsed.questionnaireFingerprint !== expected.questionnaireFingerprint) {
    return { ok: false, reason: 'fingerprint-mismatch' };
  }

  if (!isAttemptToken(parsed.attemptToken)) {
    return { ok: false, reason: 'missing-token' };
  }

  if (
    !isNonEmptyString(parsed.consentAcceptedAt) ||
    !isNonEmptyString(parsed.updatedAt)
  ) {
    return { ok: false, reason: 'malformed' };
  }

  if (!isRecord(parsed.answers)) {
    return { ok: false, reason: 'invalid-answers' };
  }

  const answers: Record<string, AnswerValue> = {};
  for (const [questionId, value] of Object.entries(parsed.answers)) {
    if (!expected.questionIds.has(questionId)) {
      return { ok: false, reason: 'invalid-answers' };
    }

    if (!ANSWER_VALUES.includes(value as AnswerValue)) {
      return { ok: false, reason: 'invalid-answers' };
    }

    answers[questionId] = value as AnswerValue;
  }

  if (!Number.isInteger(parsed.currentIndex)) {
    return { ok: false, reason: 'malformed' };
  }

  // `questionCount` is a valid position: it is the review step.
  const currentIndex = Math.min(
    Math.max(parsed.currentIndex as number, 0),
    expected.questionCount,
  );

  return {
    ok: true,
    draft: {
      schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
      shareCode: expected.shareCode,
      questionnaireFingerprint: expected.questionnaireFingerprint,
      attemptToken: parsed.attemptToken,
      answers,
      currentIndex,
      consentAcceptedAt: parsed.consentAcceptedAt,
      updatedAt: parsed.updatedAt,
    },
  };
}

/**
 * Reads a draft and drops whatever it refused.
 *
 * A rejected draft is deleted rather than left in place: it will be refused
 * again on every load, and keeping unreadable answers in the browser serves
 * nobody. Storage that throws — a browser with storage disabled — is answered
 * with `null`, because a questionnaire that cannot save progress must still be
 * a questionnaire that can be filled in.
 */
export function loadSurveyDraft(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  expected: SurveyDraftExpectation,
): SurveyDraftV1 | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }

  const result = parseSurveyDraft(raw, expected);
  if (result.ok) return result.draft;

  if (result.reason !== 'absent') {
    clearSurveyDraft(storage, key);
  }

  return null;
}

export function writeSurveyDraft(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  draft: SurveyDraftV1,
): SurveyDraftWriteResult {
  try {
    storage.setItem(key, JSON.stringify(draft));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' };
  }
}

export function clearSurveyDraft(
  storage: Pick<Storage, 'removeItem'>,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing useful remains to be done: the caller is already abandoning the
    // draft, and failing to delete it must not break the flow that asked.
  }
}

export interface SurveyDraftSnapshot {
  /** False until a browser has been asked. The server never asks. */
  checked: boolean;
  storageAvailable: boolean;
  draft: SurveyDraftV1 | null;
}

const SERVER_SNAPSHOT: SurveyDraftSnapshot = Object.freeze({
  checked: false,
  storageAvailable: true,
  draft: null,
});

/**
 * A `useSyncExternalStore` source for the draft of the attempt being filled.
 *
 * Reading `sessionStorage` while rendering on the server is impossible, and
 * seeding component state from an effect is how a save effect ends up
 * overwriting the draft it was about to read. This is the shape React offers
 * for exactly that: the server renders the empty questionnaire, the client
 * takes over with whatever the tab had stored, and the two passes never
 * disagree about which one is authoritative.
 *
 * The read happens once and is cached, because `getSnapshot` must return a
 * stable reference — a fresh object every call would re-render forever.
 */
export function createSurveyDraftStore(
  key: string,
  expected: SurveyDraftExpectation,
) {
  let snapshot: SurveyDraftSnapshot | null = null;

  return {
    /**
     * Nothing to subscribe to. `sessionStorage` is per tab, and the only writer
     * of this key is the questionnaire the respondent is filling right now, so
     * no other party can change it underneath us.
     */
    subscribe() {
      return () => {};
    },
    getSnapshot(): SurveyDraftSnapshot {
      if (!snapshot) {
        const storage = getSurveyDraftStorage();
        snapshot = {
          checked: true,
          storageAvailable: storage !== null,
          draft: storage ? loadSurveyDraft(storage, key, expected) : null,
        };
      }

      return snapshot;
    },
    getServerSnapshot(): SurveyDraftSnapshot {
      return SERVER_SNAPSHOT;
    },
  };
}

/**
 * The storage a draft lives in, or `null` when the browser will not give it.
 *
 * `sessionStorage` is not merely absent during server rendering — reading the
 * property itself throws in some privacy modes, which is why the access is
 * inside the `try`. A questionnaire that cannot save progress must still be a
 * questionnaire that can be filled in, so callers treat `null` as "warn, then
 * carry on".
 */
export function getSurveyDraftStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Safari in private mode reports the legacy numeric codes rather than the
  // modern name, and reports them on a plain DOMException.
  const code = (error as { code?: number }).code;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}
