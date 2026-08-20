import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
  InMemorySurveyAttemptRepository,
  PrismaAiAnalysisRunRepository,
  PrismaAiInsightsRepository,
  PrismaManagerRepository,
  PrismaOrganizationRepository,
  PrismaRoundGoalRepository,
  PrismaRoundRepository,
  PrismaSurveyDefinitionVersionRepository,
  PrismaSurveyRepository,
  PrismaSurveyAttemptRepository,
} from '@/lib/repositories';
import {
  InMemoryManagerRepository,
  type IManagerRepository,
} from '@/lib/auth/domain-contract';
import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IOrganizationRepository,
  IRoundGoalRepository,
  IRoundRepository,
  ISurveyDefinitionVersionRepository,
  ISurveyAttemptRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import {
  getPrismaClient,
  type MinimalPrismaClient,
} from '@/lib/repositories/prisma/prisma-client';

/**
 * The composition root of Core.
 *
 * Every repository the application uses is constructed here and nowhere else,
 * and only an entrypoint — a route handler, a server component's context
 * loader, a script or a test — is allowed to ask for the set. Everything below
 * an entrypoint receives what it needs as an argument, which is what makes a
 * service testable without installing a global first.
 *
 * `scripts/check-composition-root.mjs` enforces both halves of that rule.
 */
export interface CoreRepositories {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
  /**
   * Who may sign in, and into which schools. It belongs here rather than beside
   * the session provider for the reason every other repository does: one module
   * decides which store the application is really talking to.
   */
  managerRepo: IManagerRepository;
  orgRepo: IOrganizationRepository;
  roundGoalRepo: IRoundGoalRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
  surveyAttemptRepo: ISurveyAttemptRepository;
  surveyDefinitionVersionRepo: ISurveyDefinitionVersionRepository;
}

/** The durable wiring: one Prisma client, nine repositories over it. */
export function createPersistentRepositories(
  prisma: MinimalPrismaClient,
): CoreRepositories {
  return {
    aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
    aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
    managerRepo: new PrismaManagerRepository(prisma),
    orgRepo: new PrismaOrganizationRepository(prisma),
    roundGoalRepo: new PrismaRoundGoalRepository(prisma),
    roundRepo: new PrismaRoundRepository(prisma),
    surveyRepo: new PrismaSurveyRepository(prisma),
    surveyAttemptRepo: new PrismaSurveyAttemptRepository(prisma),
    surveyDefinitionVersionRepo: new PrismaSurveyDefinitionVersionRepository(prisma),
  };
}

/**
 * The local wiring, used only when no database is configured. It starts empty
 * on purpose: an unreachable database must look empty rather than plausible, so
 * demo fixtures are never seeded here.
 */
export function createEphemeralRepositories(): CoreRepositories {
  // The insights repository refuses a result for a round nobody created, so it
  // needs the same round store the round repository serves.
  const roundRepo = new InMemoryRoundRepository();
  return {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(roundRepo),
    managerRepo: new InMemoryManagerRepository(),
    orgRepo: new InMemoryOrganizationRepository(),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository([]),
    surveyAttemptRepo: new InMemorySurveyAttemptRepository(),
    surveyDefinitionVersionRepo: new InMemorySurveyDefinitionVersionRepository(),
  };
}

const globalForRepositories = globalThis as typeof globalThis & {
  shalomutRepositoryState?: CoreRepositories;
};

// Next.js compiles route handlers and React Server Components into separate
// module graphs. Keeping the local fallback on globalThis lets both graphs see
// the same explicitly ephemeral development state.
const ephemeralRepositories: CoreRepositories =
  globalForRepositories.shalomutRepositoryState ??
  createEphemeralRepositories();
globalForRepositories.shalomutRepositoryState = ephemeralRepositories;

/**
 * Resolves the repositories for one entrypoint invocation. A configured
 * database always wins; the ephemeral set exists so local development runs
 * without one. The parameter is the same test seam `getPrismaClient` carries:
 * entrypoints call this with no arguments.
 */
export function resolveCoreRepositories(
  prisma: MinimalPrismaClient | null = getPrismaClient(),
): CoreRepositories {
  if (prisma) return createPersistentRepositories(prisma);

  return { ...ephemeralRepositories };
}

/**
 * Composition seam for tests and local scripts: installs doubles that the next
 * `resolveCoreRepositories()` will hand out. Route handlers are called directly
 * in tests, so there is no argument to pass them through — this is the one
 * place where the wiring can still be replaced from outside.
 */
export function overrideCoreRepositories(
  repositories: Partial<CoreRepositories>,
): void {
  if (repositories.aiAnalysisRunRepo) {
    ephemeralRepositories.aiAnalysisRunRepo = repositories.aiAnalysisRunRepo;
  }
  if (repositories.orgRepo) ephemeralRepositories.orgRepo = repositories.orgRepo;
  if (repositories.roundGoalRepo) {
    ephemeralRepositories.roundGoalRepo = repositories.roundGoalRepo;
  }
  if (repositories.roundRepo) {
    ephemeralRepositories.roundRepo = repositories.roundRepo;
    // An insights store can only answer for the rounds it can see, so a
    // replaced round store gets a matching one unless the caller brought its
    // own.
    if (!repositories.aiInsightsRepo) {
      ephemeralRepositories.aiInsightsRepo = new InMemoryAiInsightsRepository(
        repositories.roundRepo,
      );
    }
  }
  if (repositories.aiInsightsRepo) {
    ephemeralRepositories.aiInsightsRepo = repositories.aiInsightsRepo;
  }
  if (repositories.managerRepo) {
    ephemeralRepositories.managerRepo = repositories.managerRepo;
  }
  if (repositories.surveyRepo) {
    ephemeralRepositories.surveyRepo = repositories.surveyRepo;
    // The funnel counts completions out of the response store, so a replaced
    // response store gets a matching attempt store unless the caller brought
    // its own — otherwise a test's submissions and its openings would be
    // describing two different rounds.
    if (!repositories.surveyAttemptRepo) {
      ephemeralRepositories.surveyAttemptRepo =
        new InMemorySurveyAttemptRepository();
    }
  }
  if (repositories.surveyAttemptRepo) {
    ephemeralRepositories.surveyAttemptRepo = repositories.surveyAttemptRepo;
  }
  if (repositories.surveyDefinitionVersionRepo) {
    ephemeralRepositories.surveyDefinitionVersionRepo =
      repositories.surveyDefinitionVersionRepo;
  }
}

/** Drops every installed double and returns to an empty ephemeral set. */
export function resetCoreRepositories(): void {
  Object.assign(ephemeralRepositories, createEphemeralRepositories());
}
