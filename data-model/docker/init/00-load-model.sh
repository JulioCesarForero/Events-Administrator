#!/bin/sh
set -eu

echo "Applying Events Administrator data model from /scripts (sorted order)..."

find /scripts -type f -name '*.sql' | sort | while IFS= read -r f; do
  echo ">> ${f}"
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${f}"
done

echo "Data model load completed."
