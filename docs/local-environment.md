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
docker compose up -d                      # local Postgres on 127.0.0.1:5433
npm run db:migrate:deploy                 # apply all migrations to it
cd ai-analytics-service && python3 -m venv .venv && .venv/bin/python -m pip install -e . && cd ..
npm run db:seed:local                     # one round with twelve responses
```

`.env` holds both halves' configuration; `.env.example` documents every key.
The three shared secrets are required — the local AI service enforces them
exactly like the deployed one. Generate them once:

```bash
openssl rand -hex 32
```

## Every day

```bash
npm run local
```

Starts the core on `:3000` and the AI service on `:8000`, wires them to each
other, and stops both on Ctrl-C. The banner reports which database, which
contract version and whether a provider key was found. Flags:

- `--in-memory` — empty in-process repositories, no database at all.
- `--deployed-db` — run against whatever `DATABASE_URL` says even when it is
  not local. Opt in, never implicit.

Sign in at `http://localhost:3000/login/` as `admin@shalomut.edu.il`. The
password is `MANAGER_ADMIN_PASSWORD` from `.env`, or `admin123` when that is
empty.

## What is identical, and what is not

| | local | deployed |
| --- | --- | --- |
| Database | Postgres container, `compose.yaml` | Supabase `tpfzhyalaftotljmlont` |
| Migrations | `npm run db:migrate:deploy` | same migrations, applied deliberately |
| Core runtime | `next dev`, `NODE_ENV=development` | `next build`, `NODE_ENV=production` |
| Manager sign-in | `admin123` when the password is unset | password required, else `503 UNCONFIGURED` |
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
- **`ai-analytics-service/.env` is read by nobody.** The service loads no env
  file; `npm run local` hands it its configuration from the repository-root
  `.env`. A value edited in `ai-analytics-service/.env` changes nothing, which
  is exactly the kind of silent mismatch worth deleting.
- **`db:clear` and `db:seed:local` follow `DATABASE_URL`.** The seed script
  refuses anything but a loopback host. `db:clear` does not — it prints the
  host it is about to empty, so read that line.
- **Gemini free-tier quota.** One round is roughly 33 provider calls and `429`
  arrives after a handful. A local round that ends in `deterministic_fallback`
  everywhere is usually the quota, not the code: check the AI service log for
  `status=429`.
