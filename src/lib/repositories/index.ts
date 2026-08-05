// The catalogue of ports and adapters. Which adapter the application actually
// runs against is decided in `src/lib/composition-root.ts`, the only module
// that constructs a repository.
export * from './interfaces';
export * from './in-memory/in-memory-organization.repository';
export * from './in-memory/in-memory-ai-analysis-run.repository';
export * from './in-memory/in-memory-ai-insights.repository';
export * from './in-memory/in-memory-round-goal.repository';
export * from './in-memory/in-memory-round.repository';
export * from './in-memory/in-memory-survey.repository';
export * from './prisma/prisma-client';
export * from './prisma/prisma-organization.repository';
export * from './prisma/prisma-ai-analysis-run.repository';
export * from './prisma/prisma-ai-insights.repository';
export * from './prisma/prisma-round-goal.repository';
export * from './prisma/prisma-round.repository';
export * from './prisma/prisma-survey.repository';

// Test fixtures used to live here. They now sit in
// `__fixtures__/demo-records.ts`, because this barrel is what route handlers
// import their adapters from and a ready-made school does not belong one
// import away from production code (backlog §7). Runtime repositories start
// empty so a missing database connection cannot masquerade as real data.
