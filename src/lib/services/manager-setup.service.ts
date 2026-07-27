import type {
  IOrganizationRepository,
  IRoundRepository,
} from "@/lib/repositories";
import { resolveAudienceLabel } from "@/lib/audience";
import {
  createCanonicalSurveyDefinition,
  createEmptyDraftSurveyDefinition,
} from "@/lib/survey-definition";
import type {
  Organization,
  RoundBackgroundContext,
  SurveyRound,
} from "@/lib/types/backend";
import { RoundService } from "./round.service";

export interface ManagerSetupInput {
  organization: {
    id?: string;
    name: string;
    city: string;
    schoolType: string;
    totalStaffCount: number;
  };
  round: {
    id?: string;
    title: string;
    privacyThreshold: number;
    startDate: Date;
    endDate?: Date;
    backgroundContext: RoundBackgroundContext;
  };
}

export interface ManagerSetupResult {
  organization: Organization;
  round: SurveyRound;
}

export class ManagerSetupService {
  public static async save(
    input: ManagerSetupInput,
    orgRepo: IOrganizationRepository,
    roundRepo: IRoundRepository,
  ): Promise<ManagerSetupResult> {
    const existingOrganization = input.organization.id
      ? await orgRepo.findById(input.organization.id)
      : null;
    const organization = existingOrganization
      ? await orgRepo.update(existingOrganization.id, {
          name: input.organization.name,
          city: input.organization.city,
          schoolType: input.organization.schoolType,
          totalStaffCount: input.organization.totalStaffCount,
        })
      : await orgRepo.create({
          id: input.organization.id ?? crypto.randomUUID(),
          name: input.organization.name,
          city: input.organization.city,
          schoolType: input.organization.schoolType,
          totalStaffCount: input.organization.totalStaffCount,
          createdAt: new Date(),
        });

    if (!organization) {
      throw new Error("Organization not found.");
    }

    let round: SurveyRound | null;

    if (input.round.id) {
      const existingRound = await roundRepo.findById(input.round.id);
      if (!existingRound || existingRound.organizationId !== organization.id) {
        throw new Error("Survey round not found for this organization.");
      }

      round = await roundRepo.update(existingRound.id, {
        title: input.round.title,
        privacyThreshold: input.round.privacyThreshold,
        startDate: input.round.startDate,
        endDate: input.round.endDate,
        backgroundContext: input.round.backgroundContext,
        // A legacy round without a stored definition is served the canonical
        // template by the respondent route, so persisting anything else here
        // would change the questionnaire under a running round.
        surveyDefinition: existingRound.surveyDefinition
          ? {
              ...existingRound.surveyDefinition,
              minimumResponses: input.round.privacyThreshold,
              // Audience is owned by this screen; the questionnaire copy just
              // mirrors it so both screens can never disagree.
              audience: resolveAudienceLabel(
                input.round.backgroundContext.audience,
              ),
            }
          : createCanonicalSurveyDefinition(
              input.round.title,
              input.round.privacyThreshold,
            ),
      });
    } else {
      round = await RoundService.createAndSaveRound(
        {
          organizationId: organization.id,
          title: input.round.title,
          privacyThreshold: input.round.privacyThreshold,
          startDate: input.round.startDate,
          endDate: input.round.endDate,
          backgroundContext: input.round.backgroundContext,
          // A new round starts as an empty draft: the manager builds the
          // questionnaire (or loads the template) before it can go live.
          surveyDefinition: {
            ...createEmptyDraftSurveyDefinition(
              input.round.title,
              input.round.privacyThreshold,
            ),
            audience: resolveAudienceLabel(
              input.round.backgroundContext.audience,
            ),
          },
        },
        roundRepo,
      );
    }

    if (!round) {
      throw new Error("Survey round could not be saved.");
    }

    return { organization, round };
  }
}
