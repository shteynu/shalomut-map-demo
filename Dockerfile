# Container image for the isolated AI analytics service (ai-analytics-service).
#
# The Next.js core app is not built here; it keeps deploying to Vercel. The
# build context is the repository root because the service loads the shared
# contract from ./contracts/ai-analytics-v1.json, and the image preserves that
# relative layout so no path resolution changes are needed.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    ENV=production

WORKDIR /app/ai-analytics-service

# `requirements.txt` is a generated lock, not a list of intentions: exact
# versions for the whole transitive tree, each with the hashes of every
# distribution PyPI may serve for it. `--require-hashes` is what makes it a
# lock rather than a suggestion — it refuses to install anything unhashed, so a
# dependency that quietly appears cannot ride in, and a version that appears at
# the same number with different bytes is refused rather than installed.
#
# Until 2026-08-22 this line installed four `>=` bounds and no lockfile, so
# every rebuild of this image silently accepted whatever PyPI served that day.
# Regenerate with the command at the top of the lock; `ai-analytics-service/
# README.md` says when.
COPY ai-analytics-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --require-hashes -r requirements.txt

COPY contracts /app/contracts
COPY ai-analytics-service/pyproject.toml ./pyproject.toml
COPY ai-analytics-service/data ./data
COPY ai-analytics-service/src ./src

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/health', timeout=3)"

# PORT is injected by Cloud Run and Render, so it must be expanded at runtime.
CMD ["sh", "-c", "exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
