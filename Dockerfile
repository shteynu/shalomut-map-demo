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

COPY ai-analytics-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

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
