#!/usr/bin/env python3
"""
Fetch daily page-view counts from GoatCounter and write
static/data/visitor-heatmap.json.

Required environment variable:
  GOATCOUNTER_TOKEN  — API token from https://csgrad.goatcounter.com/user/api

No third-party packages needed (uses Python standard library only).
"""

import json
import os
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

SITE   = "csgrad"
TOKEN  = os.environ.get("GOATCOUNTER_TOKEN", "").strip()
OUTPUT = "static/data/visitor-heatmap.json"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type":  "application/json",
}


def api_get(path: str) -> dict:
    url = f"https://{SITE}.goatcounter.com/api/v0{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} {e.reason} for {url}")
        print(f"Response body: {body}")
        raise


def fetch_daily_totals(start: str, end: str) -> dict[str, int]:
    """Fetch daily visitor totals using /api/v0/stats/total."""
    data = api_get(f"/stats/total?start={start}&end={end}")

    totals: dict[str, int] = defaultdict(int)
    for stat in data.get("stats", []):
        day   = stat.get("day", "")
        count = stat.get("daily", 0)
        if day and count:
            totals[day] += count

    return dict(totals)


def fetch_daily_totals_via_hits(start: str, end: str) -> dict[str, int]:
    """Fallback: fetch via /api/v0/stats/hits (paginated)."""
    import urllib.parse

    totals: dict[str, int] = defaultdict(int)
    after = ""

    while True:
        qs = f"start={start}&end={end}&daily=true&limit=100"
        if after:
            qs += f"&after={urllib.parse.quote(after, safe='')}"

        data = api_get(f"/stats/hits?{qs}")

        for item in data.get("hits", []):
            for stat in item.get("stats", []):
                day   = stat.get("day", "")
                count = stat.get("daily", 0)
                if day and count:
                    totals[day] += count

        if not data.get("more"):
            break

        hits = data.get("hits", [])
        after = hits[-1]["path"] if hits else ""
        if not after:
            break

    return dict(totals)


def main() -> None:
    if not TOKEN:
        sys.exit("Error: GOATCOUNTER_TOKEN environment variable is not set.")

    today = datetime.now(timezone.utc).date()
    start = str(today - timedelta(days=364))
    end   = str(today)

    print(f"Fetching GoatCounter data for '{SITE}' ({start} → {end}) …")

    # Try /stats/total first, fall back to /stats/hits
    try:
        data = fetch_daily_totals(start, end)
    except Exception as e:
        print(f"stats/total failed ({e}), trying stats/hits …")
        data = fetch_daily_totals_via_hits(start, end)

    payload = {"lastUpdated": str(today), "data": data}

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(data)} days of data → {OUTPUT}")


if __name__ == "__main__":
    main()
