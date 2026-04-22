# Cloud Run deployment Dockerfile.
# Build context: backend-api/ directory.
#
# Deploy:
#   gcloud run deploy events-backend --source ./backend-api --region us-central1
#
# Local test:
#   docker build -t events-backend ./backend-api
#   docker run -p 8080:8080 -e PORT=8080 -e DATABASE_URL=... events-backend

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN useradd --create-home --no-log-init --shell /usr/sbin/nologin appuser

WORKDIR /app

COPY requirements/base.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

COPY --chown=appuser:appuser . /app

USER appuser

# Cloud Run injects PORT (default 8080).
ENV PORT=8080
EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request, os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",8080)}/health/live', timeout=3)"

# Gunicorn + Uvicorn workers.  Single worker suits Cloud Run's 1-vCPU default.
# --timeout 0: Cloud Run manages request timeouts externally.
# --access-logfile -: logs to stdout for Cloud Logging.
CMD exec gunicorn app.main:app \
    --bind 0.0.0.0:${PORT} \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 1 \
    --timeout 0 \
    --access-logfile - \
    --error-logfile -
