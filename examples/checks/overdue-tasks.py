#!/usr/bin/env python3
"""Fills the litter box with unchecked Markdown tasks whose due date has passed.

Usage: overdue-tasks.py CHECKLIST.md
Tasks look like `- [ ] Record launch video (due 2026-10-20)`.
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

OPEN_TASK = re.compile(r"^\s*[-*] \[ \] .*\(due (\d{4}-\d{2}-\d{2})\)")


def overdue(checklist: Path, today: date) -> int:
    count = 0
    for line in checklist.read_text(encoding="utf-8").splitlines():
        match = OPEN_TASK.match(line)
        if match and date.fromisoformat(match.group(1)) < today:
            count += 1
    return count


def main() -> None:
    count = overdue(Path(sys.argv[1]).expanduser(), date.today())
    print(json.dumps({"triggered": count > 0, "count": count}))


if __name__ == "__main__":
    main()
