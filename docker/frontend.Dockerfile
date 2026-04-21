# Frontend SPA image (monorepo root: build context must be repository root).
# Vite environment variables are baked at build time; pass them via --build-arg
# or through `args` in docker-compose so deployments with different origins
# (or evidence storage strategies) don't require code changes.

FROM node:20-alpine AS build

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_API_TIMEOUT_MS=20000
ARG VITE_EVIDENCE_STORAGE=signed
ARG VITE_EVIDENCE_MAX_MB=5

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TIMEOUT_MS=$VITE_API_TIMEOUT_MS \
    VITE_EVIDENCE_STORAGE=$VITE_EVIDENCE_STORAGE \
    VITE_EVIDENCE_MAX_MB=$VITE_EVIDENCE_MAX_MB

WORKDIR /app
COPY frontend/package*.json ./
# `--legacy-peer-deps` needed because openapi-typescript declares a loose peer
# on TypeScript < 6 while we intentionally track a newer compiler.
RUN npm ci --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
# Config con fallback SPA (try_files -> /index.html). Sin esto, cargar
# rutas profundas de React Router directamente (p.ej. /staff/login,
# /portal/:eventId/...) devuelve 404 porque Nginx busca ficheros físicos.
COPY frontend/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
