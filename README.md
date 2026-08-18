# Shalomut Map

Hebrew RTL platform for running configurable school-staff wellbeing surveys and
turning privacy-safe aggregates into an eight-dimension Stone Map.

The repository contains two runtimes:

- a Next.js 16 Core application for manager/respondent flows, PostgreSQL
  persistence, privacy gating, aggregation and Dashboard rendering;
- a Python FastAPI analytics service that reads aggregates through MCP,
  generates versioned Hebrew insights and returns them through the durable
  analysis-run callback.

Current product capabilities include persisted round setup, a dynamic survey
builder, anonymous respondent links, application-level manager sessions,
database-enforced response idempotency, lifecycle-aware AI jobs, contracts
`1.0`–`6.0`, AI-assisted question suggestions and the V6 narrative Dashboard.

## Local development

The project has two environments and no others: local and deployed. The local
stack mirrors the deployed Core/AI/PostgreSQL wiring; see
[docs/local-environment.md](docs/local-environment.md) for one-time setup.

```bash
npm run local
```

This starts PostgreSQL, applies migrations, then runs Core on `:3000` and the
AI service on `:8000`. `npm run dev` starts Core alone without the AI service or
a database.

## Production build

```bash
npm run build
npm start
```

This builds and starts the Core Next.js server. PostgreSQL configuration is
required; the Python AI service runs separately.

## Verification

```bash
npm run verify
```

The canonical gate runs literals fitness, TypeScript typechecking, every
`src/**/__tests__/*.test.ts(x)` test, ESLint, the production build, PostgreSQL
integration tests and the full Python pytest suite from the project virtualenv.
`TEST_DATABASE_URL` must point at a disposable test database.

Useful narrower commands:

| Command | Purpose |
| --- | --- |
| `npm run verify:core` | TypeScript/Core tests, types, lint and build |
| `npm run verify:db` | PostgreSQL constraints and concurrency |
| `npm run verify:ai` | Full `ai-analytics-service` pytest suite |
| `npm run test:mutation:ai-contract -- --dryRunOnly` | Validate focused Stryker wiring |
| `npm run test:mutation:ai-contract` | Opt-in mutation pilot for `src/lib/ai-contract.ts` |

Mutation testing is intentionally non-blocking and is not part of `npm run
verify` or CI. Its current scope is one critical contract validator, not the
whole repository.

## Documentation

Start with [docs/README.md](docs/README.md), which separates living sources of
truth from implemented specifications, historical plans and branch task
records. Architecture lives in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md),
product milestones in [PROGRESS.md](PROGRESS.md), and current cross-task
operational state in
[docs/shalomut-tracker-handoff.md](docs/shalomut-tracker-handoff.md).

## AI-assisted development

Repository files, rather than a previous chat, carry work between agents:

1. Read [AGENTS.md](AGENTS.md).
2. Run `npm run agent:context`.
3. Read or create the matching branch task document under
   [docs/agent-tasks/](docs/agent-tasks/README.md).
4. Work in a dedicated branch/worktree; parallel agents never share one.
5. Select checks through the version-controlled project skills.
6. Before handoff, record exact Git state, actual evidence and one next step.

## Deployment

Core requires a Next.js server runtime such as Vercel and `DATABASE_URL`; it
cannot run on a static-only host. The Python service is built from the root
`Dockerfile` and requires an always-available worker or an explicit wake
mechanism for durable polling. Deployment details and current gates are in the
operational handoff.

## Licence

There is none, and that is deliberate. The repository is publicly readable and
is not open source: see [NOTICE](NOTICE) for what its visibility does and does
not grant, and for how to ask for anything beyond reading.
