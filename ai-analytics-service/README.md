# Shalomut AI Analytics Service

Standalone FastAPI service that turns privacy-safe round analytics into the
versioned Shalomut “Stone Map” contract.

The current implementation is deliberately small:

- it reads aggregate round data through the core app's JSON-RPC MCP endpoint;
- it enforces the privacy lock before any interpretation;
- it runs an async graph-style sequence of interpretation, intervention lookup,
  safety validation, and formatting;
- it reads interventions from the structured local
  `data/interventions_kb.json` catalog, scoped strictly by dimension;
- it posts the validated result back to the core app.

The service does not currently use LangGraph or ChromaDB at runtime, so those
heavy packages are intentionally absent from the deployment manifest.

## Contract

The source of truth is [`../contracts/ai-analytics-v1.json`](../contracts/ai-analytics-v1.json).
Both TypeScript and Python load this manifest. A successful result must contain
contract version `1.0` and exactly the eight canonical dimension IDs.

Privacy-locked rounds return a `locked_error` payload without stones. The core
app validates callback payloads again before persisting them.

## Local setup

Python 3.11 or newer is required.

```bash
cd ai-analytics-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .
```

Export the required variables in your shell. Use
[`./.env.example`](./.env.example) as the list of supported settings. For a
fully local run:

```bash
export ENV=development
export DATA_LAYER_MCP_URL=http://localhost:3000/api/mcp
export DATA_LAYER_CALLBACK_URL=http://localhost:3000/api/rounds
export USE_MOCK_MCP=false
uvicorn src.main:app --reload --port 8000
```

`ENV=development` is required for a local run without secrets. When neither
`ENV` nor `VERCEL_ENV` is set the service assumes `production` and rejects
webhooks that carry no `AI_WEBHOOK_SECRET`, so a new hosting platform cannot
silently come up with an open webhook.

`USE_MOCK_MCP=true` is an explicit local/test mode. With the default `false`,
MCP failures stop processing; the service does not invent analytics.

Matching shared secrets must be present on both sides outside development:

- `MCP_SHARED_SECRET`: AI service → core MCP endpoint;
- `AI_WEBHOOK_SECRET`: core trigger → AI webhook;
- `AI_CALLBACK_SECRET`: AI callback → core persistence endpoint.

Outside development, missing shared secrets, local Data Layer URLs, and
`USE_MOCK_MCP=true` fail closed before the analytics pipeline starts. Local
development may run without shared secrets.

### LLM provider configuration

Use one provider-specific key whenever possible:

- `GEMINI_API_KEY` selects Gemini;
- `OPENAI_API_KEY` selects OpenAI;
- `OPENROUTER_API_KEY` selects OpenRouter.

Provider selection comes from the environment variable name, not from the
secret's prefix or the model name. An explicit `LLM_PROVIDER` overrides that
inference and selects the matching provider-specific key when several are
present.

`LLM_API_KEY` is the provider-neutral escape hatch. Outside development it
must be paired with either `LLM_PROVIDER` or `LLM_BASE_URL`; otherwise startup
fails closed instead of sending an opaque credential to a guessed endpoint.
Multiple provider-specific keys without an explicit provider also fail closed.
`LLM_MODEL_FAST` and `LLM_MODEL_HEAVY` override model selection. Gemini uses
`gemini-flash-latest` and `gemini-pro-latest` as defaults; the OpenAI-compatible
defaults remain `gpt-4o-mini` and `gpt-4o`.

LLM logs record only provider, model, outcome, HTTP status and a safe request
identifier when available. Keys, prompts, responses and respondent data are
never logged by the provider adapter.

Transient HTTP `408`, `429`, and `5xx` responses use bounded exponential
backoff with jitter. `Retry-After` is honored up to the configured delay cap.
Known hard-quota errors such as `insufficient_quota` are not retried.
Transport timeouts are retried once, limiting them to two total attempts so
the pipeline retains room for its callback inside the core app's timeout.
`LLM_MAX_ATTEMPTS` includes the first request and defaults to `3`; the default
backoff is `0.5s`, capped at `2s`, with up to `0.25s` jitter. After the bounded
attempts are exhausted, the existing dimension-scoped heuristic fallback is
used and recorded as `outcome=heuristic`.

When the core app is a protected Vercel deployment, both outbound calls — MCP
and callback — are answered with a `302` to the SSO page unless
`VERCEL_PROTECTION_BYPASS` is set to the project's Protection Bypass for
Automation secret. The service then sends it as `x-vercel-protection-bypass`.
Leave it empty for unprotected targets; it is never added implicitly. The
callback target is always derived from `DATA_LAYER_CALLBACK_URL` and the
URL-encoded `roundId`. A legacy webhook `callbackUrl` may still be accepted for
compatibility, but it is ignored and cannot control callback transport.

## Endpoints

- `GET /health`
- `POST /api/v1/webhook/events`
- `POST /api/v1/rounds/{round_id}/analyze` (`ENV=development` only)

The core application API is documented in `../public/openapi.json` and
`../docs/openapi.yaml`.

## Deployment

The service is stateless: no database, no writable volume, four light runtime
dependencies, and one JSON catalog. Any container platform can host it.

The repository-root [`Dockerfile`](../Dockerfile) builds this service alone.
Its build context is the repository root, because `src/contracts.py` loads the
shared contract from `contracts/ai-analytics-v1.json`; the image preserves that
relative layout.

Google Cloud Run fits the workload best — its free tier covers this traffic,
instances scale to zero, and a request may run far longer than the pipeline
needs:

```bash
gcloud run deploy shalomut-ai-analytics --source . --region europe-west1 --min-instances 0 --allow-unauthenticated
```

Run it from the repository root. `--allow-unauthenticated` exposes the webhook
to the internet, where `AI_WEBHOOK_SECRET` is the access control, so that
secret must be set. Configure the remaining variables from
[`./.env.example`](./.env.example) and keep `USE_MOCK_MCP=false`.

[`../render.yaml`](../render.yaml) describes the same image for Render's free
plan, which needs no payment method but sleeps after 15 minutes of inactivity
and then pays a cold start of about a minute on the next webhook.

Vercel needs more than this package provides: a Python entrypoint under
`api/`, which does not exist here. The previous `[tool.vercel]` block in
`pyproject.toml` was not a Vercel convention and was removed.

The webhook executes the pipeline and the callback within the request rather
than using an in-process background task. LLM calls for all dimensions run
concurrently, so a round costs roughly one model round trip rather than one per
dimension. The core app's trigger gives up after `AI_SERVICE_TIMEOUT_MS`
(30s by default) and answers `504`; the round can then be re-triggered.

## Local container check

```bash
docker build -t shalomut-ai-analytics ..
docker run --rm -p 8000:8000 -e ENV=development shalomut-ai-analytics
```

## Verification

Run the dependency-light service checks:

```bash
python3 run_tests.py
```

The repository-level suite includes a real local boundary test:

```bash
cd ..
npm test
```

That test passes analytics from the Next.js MCP route into
`python3 -m src.pipeline_cli`, sends the resulting Stone Map through the
Next.js callback route, and reads it back from persistence. The CLI is a test
harness and does not replace the FastAPI webhook in deployment.
