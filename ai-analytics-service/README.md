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

The service does not currently use LangGraph or ChromaDB at runtime. Their
dependencies remain in the package manifest while that architecture is being
evaluated.

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
export DATA_LAYER_MCP_URL=http://localhost:3000/api/mcp
export DATA_LAYER_CALLBACK_URL=http://localhost:3000/api/rounds
export USE_MOCK_MCP=false
uvicorn src.main:app --reload --port 8000
```

`USE_MOCK_MCP=true` is an explicit local/test mode. With the default `false`,
MCP failures stop processing; the service does not invent analytics.

When shared secrets are configured, matching values must be present on both
sides:

- `MCP_SHARED_SECRET`: AI service → core MCP endpoint;
- `AI_WEBHOOK_SECRET`: core trigger → AI webhook;
- `AI_CALLBACK_SECRET`: AI callback → core persistence endpoint.

## Endpoints

- `GET /health`
- `POST /api/v1/webhook/events`
- `POST /api/v1/rounds/{round_id}/analyze`

The core application API is documented in `../public/openapi.json` and
`../docs/openapi.yaml`.

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
