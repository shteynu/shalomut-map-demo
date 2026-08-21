# The local environment

The project has two environments and no others: **local** and **deployed**
(Vercel for the core app, Render for the AI service, Supabase for the database).
There is no staging and no preview to keep in mind.

The two are wired the same way on purpose. A local run that passes should mean
the deployed one passes, so the local half does not get a looser configuration:
the same shared secrets between the core app and the AI service, the same
provider key and models, the same contract version, and an AI service that
fails closed on the same misconfiguration the deployment fails on.

## One-time setup

```bash
npm install
cd ai-analytics-service && python3 -m venv .venv && .venv/bin/python -m pip install -e ".[dev]" && cd ..
npm run local                             # brings the database up on its own
npm run db:seed:local                     # one active round with twelve responses
```

`.env` holds both halves' configuration; `.env.example` documents every key.
The three shared secrets are required — the local AI service enforces them
exactly like the deployed one. Generate them once:

```bash
openssl rand -hex 32
```

`npm run verify` includes `verify:db`, which needs a database of its own — it
empties it between cases, so it must never share one with development data.
Create it once, in the same container:

```bash
docker exec shalomut-local-db psql -U shalomut -d postgres -c "CREATE DATABASE shalomut_test OWNER shalomut;"
```

It is chosen by `TEST_DATABASE_URL` and defaults to that container; `.env` is
never read for it, so the suite can reach neither the deployed database nor the
local development one. CI points the same variable at its own service.

## Every day

```bash
npm run local
```

Brings the whole environment up, in this order: the Docker daemon if it is down
and `colima` is installed, the Postgres container from `compose.yaml`, the
migrations, then the core on `:3000` and the AI service on `:8000`, wired to
each other. Ctrl-C stops the two services and leaves the database running — it
holds the local data between runs, and `docker compose down` is how it ends.
Every step is idempotent, so a second run skips straight to the services. The
banner reports which database, which contract version and whether a provider key
was found. Flags:

- `--in-memory` — empty in-process repositories, no database at all.
- `--deployed-db` — run against whatever `DATABASE_URL` says even when it is
  not local. Opt in, never implicit.

Sign in at `http://localhost:3000/login/` as `admin@shalomut.edu.il`. The
password is `MANAGER_ADMIN_PASSWORD` from `.env`, or `admin123` when that is
empty.

That password door exists only while this runtime has no identity provider. Set
all four `OIDC_*` variables and the login screen offers the organizational
account instead and `/api/auth/login` refuses with `PROVIDER_REQUIRED` — two
ways in never exist at once. Locally that means signing in needs a real OAuth
client whose authorized redirect URI is
`http://localhost:3000/api/auth/oidc/callback/`, so leave the four empty unless
the provider itself is what you are working on.

## What is identical, and what is not

| | local | deployed |
| --- | --- | --- |
| Database | Postgres container, `compose.yaml` | Supabase `tpfzhyalaftotljmlont` |
| Migrations | `npm run db:migrate:deploy` | same migrations, applied deliberately |
| Core runtime | `next dev`, `NODE_ENV=development` | `next build`, `NODE_ENV=production` |
| Manager sign-in | `admin123` when the password is unset | the identity provider once `OIDC_*` is set; until then the password, else `503 UNCONFIGURED` |
| AI service mode | `ENV=local` | `ENV=production` |
| Shared secrets | required, from `.env` | required, from Vercel and Render |
| Direct `/analyze` | disabled | disabled |
| Mock MCP | refused | refused |
| Webhook | `202`, round runs in the background | same |
| Provider | key and models from `.env` | key and models from Render |

`ENV=local` differs from `ENV=production` in exactly one point: the Data Layer
it talks to is on loopback. Every other rule — the three secrets, the ban on
mock MCP, the provider key checks — applies unchanged, so a local run fails on
the misconfiguration the deployment would fail on. See
`runtime_configuration_errors` in
[`ai-analytics-service/src/config.py`](../ai-analytics-service/src/config.py).

The two remaining differences are deliberate: hot reload is worth more locally
than the exact production build, and a dev password beats storing the deployed
one on the laptop. Both can be closed for a single run — set
`MANAGER_ADMIN_PASSWORD` and `SESSION_SECRET`, then `npm run build && npm start`
alongside the AI service — but nothing in the daily loop needs that.

## Things that have bitten this project before

- **`.env` versus `.env.local`.** Next.js prefers `.env.local`; Prisma reads
  only `.env`. A `DATABASE_URL` in `.env.local` therefore moves the app to one
  database while migrations keep going to another, silently. Keep the database
  in `.env` and nowhere else.
- **Migrating the deployed database.** `prisma migrate` targets whatever `.env`
  says, which is now the local container. To migrate the deployed database,
  pass its URL explicitly — a real environment variable outranks the file:

  ```bash
  DIRECT_URL="postgresql://…supabase…" npx prisma migrate deploy
  ```

  The deployed credentials are kept in `.env.deployed.local` (gitignored),
  which is a copy of `.env` from before the local database existed.
- **`ai-analytics-service/.env` does not configure the service.** The service
  loads no env file at all; `npm run local` hands it its configuration from the
  repository-root `.env`. Editing `ai-analytics-service/.env` changes nothing
  about a running service — only the two standalone prompt experiments in
  `ai-analytics-service/experiments/` read it, through `load_dotenv`, and only
  when run from the service root.
- **`.env.staging.local` points at the deployed database.** It survives from
  the staging era and holds the deployed Supabase URL plus a provider key.
  Nothing loads it any more — `scripts/inspect-ai-provenance.ts` used to read
  it first, which silently aimed the inspector at the deployed data whatever
  `.env` said. Delete it once you have the provider key stored somewhere else.
- **`db:clear` and `db:seed:local` follow `DATABASE_URL`.** The seed script
  refuses anything but a loopback host. `db:clear` does not — it prints the
  host it is about to empty, so read that line.
- **The browser smoke needs the round seeded under *its* organization.**
  `scripts/seed-local.ts` reads `MANAGER_ORGANIZATION_ID` through `.env`, while
  `playwright.config.ts` starts its own server with the value it invents —
  `local-dev-organization` unless the variable is exported. If `.env` names a
  different organization, the seed writes the round into that one and the smoke
  signs into an empty one: the round screen shows no share link and the walk
  fails as though the product were broken. Seed for the smoke with the same id:

  ```bash
  MANAGER_ORGANIZATION_ID=local-dev-organization npx tsx scripts/seed-local.ts --reset
  ```

  CI never meets this, because nothing there sets the variable and both sides
  fall back to the same default.
- **Rate limiting does nothing locally, on purpose.** It keys on the client
  address, and a locally served build reports every request as loopback —
  which it treats as "no client to limit". To exercise it, send
  `x-forwarded-for: 203.0.113.1` and the eleventh sign-in inside five minutes
  answers `429`. Setting `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` moves the counters from instance memory into
  Redis; nothing else changes.
- **The seeded round is `active`, so `/answer/SHALOM-LOCAL` answers.** It used
  to be seeded `closed`, which made the respondent route serve the dead-link
  screen and left every walk of the questionnaire starting with a hand-written
  status flip — the archived task files are full of them. The twelve responses
  are unchanged, so the dashboard still unlocks.
- **The virtualenv is not optional, and `npm test` is one of the things that
  needs it.** `src/app/api/__tests__/ai-e2e.test.ts` drives the real Python
  pipeline, so a checkout without `ai-analytics-service/.venv` cannot run the
  Core suite — and therefore cannot finish `npm run verify:core`, which chains
  it. Until 2026-08-12 that test spawned a bare `python3` instead: on macOS
  that is usually the 3.9 from the Command Line Tools, which cannot import
  `typing.NotRequired`, so the missing environment arrived as three cross-
  service failures with an ImportError from inside the service. Every Node-side
  caller now resolves the interpreter through `scripts/ai-service-python.mjs`
  and names the missing virtualenv instead. Git worktrees each need their own —
  `.venv/` is ignored, so a new worktree starts without one.
- **Gemini free-tier quota.** One round is roughly 33 provider calls and `429`
  arrives after a handful. A local round that ends in `deterministic_fallback`
  everywhere is usually the quota, not the code: check the AI service log for
  `status=429`.

## Verification commands

Run the canonical all-layer gate from the repository root:

```bash
npm run verify
```

It combines Core literals/typecheck/tests/lint/build, PostgreSQL integration
tests against the disposable `TEST_DATABASE_URL`, and the full Python suite
through `ai-analytics-service/.venv/bin/python`.

The focused Stryker pilot is separate and non-blocking:

```bash
npm run test:mutation:ai-contract -- --dryRunOnly
npm run test:mutation:ai-contract
```

It mutates only `src/lib/ai-contract.ts`, is not part of `npm run verify` or CI,
and writes ignored reports under `reports/mutation/`.
