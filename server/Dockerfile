# ── Stage 1: Build React frontend (web mode) ──────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app/desktop
COPY desktop/package.json desktop/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY desktop/ ./
RUN npm run build:web


# ── Stage 2: Python backend + static frontend ─────────────────────────
FROM python:3.11-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential ca-certificates git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir ".[all-server]"

# Copy backend source
COPY ragkit/ ./ragkit/
RUN python -m ragkit.setup_nltk

# Copy built frontend
COPY --from=frontend /app/desktop/dist ./static/

# Data volume
RUN mkdir -p /data
VOLUME /data

ENV RAGKIT_DATA_DIR=/data
ENV RAGKIT_MODE=server
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["python", "-m", "ragkit.desktop.main", "--mode", "server", "--port", "8080"]
