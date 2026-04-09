#!/usr/bin/env sh
# Espera a que PostgreSQL acepte conexiones. Uso típico en entrypoint Docker.
# Variables: DB_HOST (default db), DB_PORT (default 5432), DB_USER, DB_NAME

set -e
host="${DB_HOST:-db}"
port="${DB_PORT:-5432}"
user="${DB_USER:-postgres}"
db="${DB_NAME:-postgres}"

echo "Waiting for PostgreSQL at ${host}:${port}..."
for i in $(seq 1 60); do
  if pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done
echo "Timeout waiting for PostgreSQL."
exit 1
