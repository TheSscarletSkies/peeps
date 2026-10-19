#!/usr/bin/env python3
"""Hungry when the newest dated line in a posting log is older than a limit.

Usage: days-since-last-post.py LOG_FILE MAX_DAYS
The log holds one post per line, starting with an ISO date: `2026-10-15 Episode 12`.
"""

import json
import sys
from datetime import date
from pathlib import Path


def last_post(log: Path) -> date | None:
    dates = []
    for line in log.read_text(encoding="utf-8").splitlines():
        try:
            dates.append(date.fromisoformat(line.split(maxsplit=1)[0]))
        except (IndexError, ValueError):
            continue
    return max(dates, default=None)


def main() -> None:
    log, max_days = Path(sys.argv[1]).expanduser(), int(sys.argv[2])
    latest = last_post(log)
    if latest is None:
        print(json.dumps({"triggered": True, "message": "Nothing posted yet"}))
        return
    days = (date.today() - latest).days
    print(json.dumps({"triggered": days > max_days, "count": days}))


if __name__ == "__main__":
    main()
