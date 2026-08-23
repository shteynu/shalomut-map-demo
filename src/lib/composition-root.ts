import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryOperationalEventRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundGoalRepository,
  InMemoryRoundRepository,
  InMemorySurveyDefinitionVersionRepository,
  InMemorySurveyRepository,
  InMemorySurveyAttemptRepository,
  PrismaAiAnalysisRunRepository,
  PrismaAiInsightsRepository,
  PrismaAuditLogRepository,
  PrismaManagerRepository,
  PrismaOperationalEventRepository,
  PrismaOrganizationRepository,
  PrismaRoundGoalRepository,
  PrismaRoundRepository,
  PrismaSurveyDefinitionVersionRepository,
  PrismaSurveyRepository,
  PrismaSurveyAttemptRepository,
} from '@/lib/repositories';
import {
  InMemoryAuditLogRepository,
  InMemoryManagerRepository,
  type IAuditLogRepository,
  type IManagerRepository,
} from '@/lib/auth/domain-contract';
import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IOperationalEventRepository,
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
import { installObservabilitySinks } from '@/lib/server/observability-sinks';

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
   * What a manager did. It was a process-local store reached through its own
   * getter until the audit table landed; it is wired here now for the reason
   * every other repository is, and so that a test can watch what an action
   * recorded without installing a global first.
   */
  auditLogRepo: IAuditLogRepository;
  /**
   * Who may sign in, and into which schools. It belongs here rather than beside
   * the session provider for the reason every other repository does: one module
   * decides which store the application is really talking to.
   */
  managerRepo: IManagerRepository;
  /**
   * Where the counters and the caught errors are kept. It is a repository like
   * the others so that the durable sink is chosen in the same place every other
   * store is, and so that an observability write in a test lands somewhere a
   * test can read.
   */
  operationalEventRepo: IOperationalEventRepository;
  orgRepo: IOrganizationRepository;
  roundGoalRepo: IRoundGoalRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
  surveyAttemptRepo: ISurveyAttemptRepository;
  surveyDefinitionVersionRepo: ISurveyDefinitionVersionRepository;
}

/** The durable wiring: one Prisma client, eleven repositories over it. */
export function createPersistentRepositories(
  prisma: MinimalPrismaClient,
): CoreRepositories {
  return {
    aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
    aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
    auditLogRepo: new PrismaAuditLogRepository(prisma),
    managerRepo: new PrismaManagerRepository(prisma),
    operationalEventRepo: new PrismaOperationalEventRepository(prisma),
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
    auditLogRepo: new InMemoryAuditLogRepository(),
    managerRepo: new InMemoryManagerRepository(),
    operationalEventRepo: new InMemoryOperationalEventRepository(),
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
  const repositories = prisma
    ? createPersistentRepositories(prisma)
    : { ...ephemeralRepositories };

  /*
   * The observability sinks are pointed at a store here rather than by each
   * entrypoint, because this is the module that knows which store there is. The
   * two modules that emit — `ai-operational-metrics.ts` and
   * `request-error-report.ts` — are below the composition edge and take no
   * repository argument on purpose: a counter is emitted from the middle of the
   * product's actual work, and threading a repository to every emit site would
   * put observability in the signature of everything it watches.
   *
   * Installing on each invocation is an assignment, not a connection, and it is
   * what keeps a test's replaced wiring from being observed by the previous
   * test's store.
   */
  installObservabilitySinks(repositories.operationalEventRepo);

  return repositories;
}

/**
 * How long one transaction may hold a connection, and how long a caller waits
 * to get one.
 *
 * The pool is bounded at two connections (`pool-options.ts`), so a transaction
 * that runs long is not just slow — it is one half of the deployment's ability
 * to answer anything. Twenty seconds is generous for the only caller there is,
 * a reset erasing one round's rows, and short enough that a stuck transaction
 * fails rather than parks a connection until the function times out.
 */
export const TRANSACTION_TIMEOUT_MS = 20_000;
export const TRANSACTION_MAX_WAIT_MS = 5_000;

/**
 * Runs `work` against a repository set whose writes all land or none do.
 *
 * This is a resolution of the wiring, like `resolveCoreRepositories`, and the
 * same rule applies: only an entrypoint may call it, and
 * `scripts/check-composition-root.mjs` enforces that for both names. What it
 * adds is that the repositories handed to `work` are built over a transaction
 * client rather than over the pool, so five deletes across five repositories
 * are one write as far as anything reading the database is concerned.
 *
 * Without a transaction client — the in-memory wiring, or a double — `work`
 * runs against the ordinary set. That is not a silent downgrade: a single
 * process mutating a `Map` has no half-applied state for a transaction to
 * protect against, and the store that does have one always brings a
 * `$transaction`.
 *
 * The observability sinks are deliberately *not* re-pointed here. A counter
 * written inside a transaction that later rolls back would vanish along with
 * the work it was recording — and the sink would be left holding a client that
 * is finished the moment the transaction commits.
 */
export async function runInTransaction<T>(
  work: (repositories: CoreRepositories) => Promise<T>,
  prisma: MinimalPrismaClient | null = getPrismaClient(),
): Promise<T> {
  if (!prisma) return work({ ...ephemeralRepositories });
  if (!prisma.$transaction) return work(createPersistentRepositories(prisma));

  return prisma.$transaction(
    (transaction) => work(createPersistentRepositories(transaction)),
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
  );
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
  if (repositories.auditLogRepo) {
    ephemeralRepositories.auditLogRepo = repositories.auditLogRepo;
  }
  if (repositories.managerRepo) {
    ephemeralRepositories.managerRepo = repositories.managerRepo;
  }
  if (repositories.operationalEventRepo) {
    ephemeralRepositories.operationalEventRepo =
      repositories.operationalEventRepo;
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
