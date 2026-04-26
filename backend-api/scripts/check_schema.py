from __future__ import annotations

import sys

from infrastructure.persistence.database import session_scope
from infrastructure.persistence.schema_guard import missing_required_columns


def main() -> int:
    with session_scope() as session:
        missing = missing_required_columns(session)
    if not missing:
        print("Schema check passed: required columns are present.")
        return 0
    print("Schema check failed. Missing columns:")
    for item in missing:
        print(f"- {item}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

