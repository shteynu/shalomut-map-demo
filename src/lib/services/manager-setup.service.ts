import type {
  IOrganizationRepository,
  IRoundRepository,
} from "@/lib/repositories";
import { createCanonicalSurveyDefinition } from "@/lib/survey-definition";
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
        surveyDefinition: existingRound.surveyDefinition
          ? {
              ...existingRound.surveyDefinition,
              minimumResponses: input.round.privacyThreshold,
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
          surveyDefinition: createCanonicalSurveyDefinition(
            input.round.title,
            input.round.privacyThreshold,
          ),
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
