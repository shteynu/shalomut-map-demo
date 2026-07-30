/**
 * Repository-level failures that application code is expected to handle.
 *
 * A repository translates its store's dialect into these, so a caller never
 * branches on a Prisma error code and a store-specific detail never reaches an
 * HTTP response.
 */

/**
 * A response already exists for this round and anonymous token.
 *
 * The service checks before inserting, but two parallel requests both pass that
 * check, so the database is what actually refuses the second write. Thrown for
 * the unique index on `(round_id, anonymous_token_hash)` alone: any other
 * constraint is a defect rather than a duplicate submission, and stays an
 * unhandled error so it surfaces where it was made.
 */
export class DuplicateResponseError extends Error {
  public readonly roundId: string;

  constructor(roundId: string) {
    super(`A response for round ${roundId} with this token already exists`);
    this.name = 'DuplicateResponseError';
    this.roundId = roundId;
  }
}
