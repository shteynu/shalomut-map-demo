# Shalomut Map

Hebrew RTL Next.js application for a school wellbeing platform.

## Local development

```bash
npm install
npm run dev
```

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
