import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { RoundService } from "@/lib/services";
import {
  carryInstrumentProvenance,
  createCanonicalSurveyDefinition,
  hasSameQuestionSnapshot,
  isActivatableSurveyDefinition,
  isSameSurveyDefinition,
  parseSurveyDefinition,
} from "@/lib/survey-definition";
import { getArchivedRoundGuardResponse } from "@/lib/server/archived-round-guard";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { recordRoundAuditEvent } from "@/lib/server/manager-audit";
import {
  describeRefusedStatusWrite,
  type RefusedStatusWrite,
} from "@/lib/server/round-status-write";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { enqueueAiAnalyticsForSupersededRounds } from "@/lib/server/trigger-ai-analytics";

interface RouteParams {
  params: Promise<{ roundId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { auditLogRepo, orgRepo, roundRepo } = resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
      "read:survey-definition",
    );
    if (!authorization.ok) return authorization.response;

    const { round } = authorization;
    return NextResponse.json({
      definition:
        round.surveyDefinition ??
        createCanonicalSurveyDefinition(round.title, round.privacyThreshold),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch survey definition." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const {
      aiAnalysisRunRepo,
      auditLogRepo,
      orgRepo,
      roundRepo,
      surveyDefinitionVersionRepo,
      surveyRepo,
    } = resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
      "write:survey-definition",
    );
    if (!authorization.ok) return authorization.response;

    // The one place a questionnaire arrives from a browser, and therefore the
    // one place the size limits apply. Everywhere else this parser runs it is
    // reading a definition the product already stored, where refusing would
    // take an existing round's screens down over a row that is already there.
    const parsed = parseSurveyDefinition(await request.json(), {
      allowIncomplete: true,
      enforceWriteLimits: true,
    });

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { round } = authorization;

    // A round with answers already refuses a changed question snapshot below.
    // This refuses the rest of it — the title, the intro, the threshold — and
    // it also refuses an archived round that never reached a first answer,
    // where that rule would have let the questionnaire be rewritten.
    const archived = getArchivedRoundGuardResponse(round);
    if (archived) return archived;

    const responseCount = await surveyRepo.getResponseCount(roundId);
    const currentDefinition =
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
    // The builder rebuilds its payload from its own draft state and knows
    // nothing about provenance, so what the round was started from is read off
    // the stored definition rather than off the request. Everything below saves
    // this, not the parsed body: the write, the version history and the
    // activation gate, so no one of them can record a different questionnaire
    // from the others.
    //
    // A round that never persisted a definition falls back to the canonical
    // factory here — the same questionnaire the respondent route has been
    // serving it all along — so its first save records that, which is true.
    const nextDefinition = carryInstrumentProvenance(
      currentDefinition,
      parsed.value,
    );
    if (
      responseCount > 0 &&
      !hasSameQuestionSnapshot(currentDefinition, nextDefinition)
    ) {
      return NextResponse.json(
        {
          error:
            "Survey question IDs, text, dimensions, order, and enabled state cannot change after the first accepted response. Create a new round for a revised questionnaire.",
        },
        { status: 409 },
      );
    }

    const updated = await roundRepo.update(roundId, {
      title: nextDefinition.title,
      privacyThreshold: nextDefinition.minimumResponses,
      surveyDefinition: nextDefinition,
    });

    // The history records saves that changed something, not saves that
    // happened. A builder that autosaves an untouched form would otherwise
    // fill the list with twenty identical entries and push the version worth
    // recovering off the end of it.
    //
    // Recorded after the write and only when the write succeeded: a version the
    // round never reached is not a state anyone can go back to. A failure to
    // record is deliberately not a failure to save — the questionnaire is
    // already stored, and refusing the response would tell the manager their
    // work was lost when it was not.
    if (updated && !isSameSurveyDefinition(currentDefinition, nextDefinition)) {
      try {
        await surveyDefinitionVersionRepo.record(
          roundId,
          nextDefinition,
          updated.updatedAt ?? undefined,
        );
      } catch (error) {
        console.error('Failed to record a survey definition version', error);
      }
    }

    // A draft round goes live as soon as its questionnaire covers all eight
    // dimensions, and going live closes whichever round the school was running.
    // Closed and archived rounds are never reopened here.
    let closedRoundTitles: string[] = [];
    // Activation writes the round again, so it, and not the definition write,
    // is then the moment the round last reached the database.
    let savedRound = updated;
    // An activation that was refused is reported rather than absorbed. This
    // path had already closed the school's running round by the time it failed,
    // so answering `success: true` left the school with no live round, a
    // builder saying it had gone live, and an empty `closedRoundTitles` — the
    // one field that would have said which round stopped.
    let activationFailure: RefusedStatusWrite | null = null;
    if (
      updated &&
      updated.status === 'draft' &&
      isActivatableSurveyDefinition(nextDefinition)
    ) {
      const activation = await RoundService.activateRound(roundId, roundRepo);
      closedRoundTitles = activation.closedRounds.map((round) => round.title);
      // A round the school stopped running is a closed round, and closing is
      // what asks for the analysis (owner decision 2026-08-17). Asked here
      // rather than inside `activateRound`, which is a Core domain service and
      // is handed round repositories only. Asked before the failure is
      // reported, because those rounds were closed whether or not the round
      // that replaced them went live.
      await enqueueAiAnalyticsForSupersededRounds(
        activation.closedRounds,
        aiAnalysisRunRepo,
        surveyRepo,
      );
      if (activation.ok) {
        savedRound = activation.round;
      } else {
        activationFailure = activation.failure;
      }
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Survey definition could not be saved." },
        { status: 500 },
      );
    }

    // After the activation, so one save that also started the round is one
    // event that says both.
    await recordRoundAuditEvent(
      auditLogRepo,
      request,
      "SURVEY_DEFINITION_UPDATED",
      roundId,
      round.organizationId,
      {
        changed: !isSameSurveyDefinition(currentDefinition, nextDefinition),
        activated: savedRound?.status === 'active' && round.status === 'draft',
        closedRoundTitles,
      },
    );

    if (activationFailure) {
      const refusal = describeRefusedStatusWrite(activationFailure);
      if (activationFailure.outcome === 'write_failed') {
        console.error(
          'Starting a round from the builder failed:',
          activationFailure.reason,
        );
      }

      // The questionnaire is saved and the closed rounds are named, because
      // both are true and both are what the manager has to act on: the work is
      // not lost, and the school is not running anything.
      return NextResponse.json(
        {
          error: `The questionnaire was saved, but the round could not be started. ${refusal.error}`,
          savedAt: savedRound?.updatedAt?.toISOString(),
          definition: updated.surveyDefinition,
          closedRoundTitles,
        },
        { status: refusal.status },
      );
    }

    return NextResponse.json({
      success: true,
      // When the write completed, as the round itself records it. The builder
      // shows this rather than the moment the button was pressed, and the next
      // page load reads the same column, so the answer outlives the tab.
      savedAt: savedRound?.updatedAt?.toISOString(),
      definition: updated.surveyDefinition,
      // Named so the builder can tell the manager which round stopped running,
      // rather than leaving the school to notice on the dashboard later.
      closedRoundTitles,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save survey definition." },
      { status: 500 },
    );
  }
}
