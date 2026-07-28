# Shalomut Map

Hebrew RTL Next.js application for a school wellbeing platform.

## Local development

The project has two environments and no others: local and deployed. The local
one runs the core app and the Python AI service against a Postgres container,
wired the way the deployment is wired — see
[docs/local-environment.md](docs/local-environment.md) for the one-time setup.

```bash
npm run local
```

That one command brings up the Postgres container, applies the migrations and
starts both halves: the core app on `:3000` and the AI service on `:8000`.
`npm run dev` starts the core app alone, without the AI service or a database.

## Production build

Running:

```bash
npm run build
npm start
```

starts the full-stack Next.js application. Manager pages and API routes render
at request time and read PostgreSQL through Prisma.

## Deployment

Deploy the application to a Next.js server runtime such as Vercel and configure
`DATABASE_URL`. GitHub Pages and other static-only hosts are not supported:
they cannot execute the request-time database reads or mutation endpoints.
