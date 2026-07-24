# Shalomut Map

Hebrew RTL Next.js application for a school wellbeing platform.

## Local development

```bash
npm install
npm run dev
```

## Static build

This project is configured for static export. Running:

```bash
npm run build
```

generates the deployable site in `out/`.

## Free deployment options

### Cloudflare Pages

Recommended for this application because static asset hosting on the free plan is generous.

1. Push this project to GitHub.
2. In Cloudflare Pages, create a new project from that repository.
3. Use:
   - Build command: `npm run build`
   - Build output directory: `out`

If deploying from the CLI after authenticating Wrangler:

```bash
npx wrangler pages project create shalomut-map
npx wrangler pages deploy out --project-name shalomut-map
```

### GitHub Pages

This repo also includes a GitHub Actions workflow at `.github/workflows/deploy-github-pages.yml`.

After pushing to GitHub:

1. Enable Pages for the repository and set the build type to GitHub Actions.
2. Push to `main`.
3. GitHub will publish the static export automatically.
