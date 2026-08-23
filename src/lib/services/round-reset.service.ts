import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IRoundGoalRepository,
  IRoundRepository,
  ISurveyAttemptRepository,
  ISurveyRepository,
} from "../repositories/interfaces";

/**
 * The stores a reset erases from. Named here rather than taken as the whole
 * composition-root set, because a service that asks for everything tells the
 * reader nothing about what it touches.
 */
export interface RoundResetStores {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
  roundGoalRepo: IRoundGoalRepository;
  roundRepo: IRoundRepository;
  surveyAttemptRepo: ISurveyAttemptRepository;
  surveyRepo: ISurveyRepository;
}

export interface RoundErasure {
  deletedResponseCount: number;
  deletedGoalCount: number;
}

export class RoundResetService {
  /**
   * Everything a round collected, erased.
   *
   * Five deletes and the count that describes them. They used to sit inline in
   * the reset route, one `await` after another with nothing holding them
   * together, so a crash in the middle left a round whose saved analysis
   * described responses that no longer existed. They are here so that one
   * caller can put all five inside a single transaction — which is the whole
   * point, and why this function takes its stores as an argument rather than
   * resolving them: the argument is what lets the caller hand it a set bound to
   * a transaction.
   *
   * Idempotent by construction. Every step is a delete by round id, so running
   * it twice erases the same nothing the second time, which is what makes the
   * sweep in the caller safe.
   */
  public static async eraseCollectedData(
    stores: RoundResetStores,
    roundId: string,
  ): Promise<RoundErasure> {
    // Reset is irreversible, so the number of responses about to be destroyed
    // is captured before the delete and travels to the audit trail. Read inside
    // the same transaction as the delete, so the figure describes exactly the
    // rows that went.
    const deletedResponseCount = await stores.surveyRepo.getResponseCount(roundId);

    await stores.surveyRepo.deleteByRoundId(roundId);

    // The funnel describes how those responses were arrived at, so it goes with
    // them. A reset that kept the openings would show a school twelve sessions
    // and zero answers and call it a collection problem, when what happened is
    // that a manager erased the collection.
    await stores.surveyAttemptRepo.deleteByRoundId(roundId);

    // A persisted analysis describes responses that no longer exist.
    await stores.aiInsightsRepo.deleteByRoundId(roundId);

    // So do the numbers the round published. The basis check would catch most
    // of this on its own — but a re-collection that ends at the same count with
    // the same questionnaire matches it exactly, and would republish the
    // erased round's numbers as the new round's result.
    await stores.roundRepo.clearPublishedAnalytics(roundId);

    // Pending and terminal runs describe the same deleted response snapshot.
    // Removing them also releases the stable `automatic` request key so a new
    // collection cycle can enqueue once it reaches the threshold again.
    await stores.aiAnalysisRunRepo.deleteByRoundId(roundId);

    // Goals normally outlive an analysis — that is the point of copying the
    // recommendation text into them. Reset is the exception: it does not re-run
    // the analysis, it declares that this round measured nothing, and a goal
    // chosen from an erased measurement has nothing left to track.
    const deletedGoalCount = await stores.roundGoalRepo.deleteByRoundId(roundId);

    // The questionnaire's version history is deliberately left alone. Reset
    // erases what was measured, not what was written, and it hands the round
    // back for re-editing — which is exactly when an earlier questionnaire is
    // worth being able to return to.

    return { deletedResponseCount, deletedGoalCount };
  }
}
