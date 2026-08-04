import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  PrismaAiAnalysisRunRepository,
  PrismaAiInsightsRepository,
  PrismaOrganizationRepository,
  PrismaRoundGoalRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
} from '@/lib/repositories';
import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IOrganizationRepository,
  IRoundGoalRepository,
  IRoundRepository,
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
  orgRepo: IOrganizationRepository;
  roundGoalRepo: IRoundGoalRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
}

/** The durable wiring: one Prisma client, six repositories over it. */
export function createPersistentRepositories(
  prisma: MinimalPrismaClient,
): CoreRepositories {
  return {
    aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
    aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
    orgRepo: new PrismaOrganizationRepository(prisma),
    roundGoalRepo: new PrismaRoundGoalRepository(prisma),
    roundRepo: new PrismaRoundRepository(prisma),
    surveyRepo: new PrismaSurveyRepository(prisma),
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
    orgRepo: new InMemoryOrganizationRepository(),
    roundGoalRepo: new InMemoryRoundGoalRepository(),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository([]),
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
  if (repositories.surveyRepo) {
    ephemeralRepositories.surveyRepo = repositories.surveyRepo;
  }
}

/** Drops every installed double and returns to an empty ephemeral set. */
export function resetCoreRepositories(): void {
  Object.assign(ephemeralRepositories, createEphemeralRepositories());
}
