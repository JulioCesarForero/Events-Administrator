from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

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
