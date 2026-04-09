#!/usr/bin/env sh
set -eu

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
USER="${PGUSER:-events_user}"
DB="${PGDATABASE:-events_admin}"

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

echo "Applying SQL from ${ROOT_DIR}/scripts (sorted) to ${USER}@${HOST}:${PORT}/${DB}"

find "${ROOT_DIR}/scripts" -type f -name '*.sql' | sort | while IFS= read -r f; do
  echo ">> ${f}"
  psql -v ON_ERROR_STOP=1 -h "${HOST}" -p "${PORT}" -U "${USER}" -d "${DB}" -f "${f}"
done

echo "Done."
