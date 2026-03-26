"""
export-shops.py — Pull shop data from Supabase REST API and merge
with local panorama config to generate data/shops.json.

Usage:
    python scripts/export-shops.py

No extra packages needed — uses only the Python standard library.
"""

import json
import os
import sys
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://weztjgtyudpvxtyktpfu.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY", "sb_publishable_r92Rj1RhiVElDJNLlo4Rcw_m2gHqsga"
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(SCRIPT_DIR, "..", "data", "shops.json")

# ── Panorama / map config (managed by you, not shop owners) ──────
# Add entries here when you capture panoramas or pin a new shop.
PANO_CONFIG = {
    "capitol-theatre": {
        "lat": 42.4155, "lng": -71.1563,
        "panoFile": "sample-interior.jpg",
        "scenes": {"entrance": {"title": "Capitol Theatre — Lobby", "hfov": 120, "pitch": 0, "yaw": 0}},
    },
    "arlington-cafe": {
        "lat": 42.4148, "lng": -71.1575,
        "panoFile": "kidscloset.jpg",
        "scenes": {"entrance": {"title": "Arlington Café — Inside", "hfov": 110, "pitch": -3, "yaw": 90}},
    },
    "book-rack": {
        "lat": 42.4158, "lng": -71.1555,
        "panoFile": "book-rack/entrance.jpg",
        "scenes": {"entrance": {"title": "The Book Rack — Entrance", "hfov": 100, "pitch": 0, "yaw": 0}},
    },
    "menotomy-grill": {
        "lat": 42.4160, "lng": -71.1548,
        "panoFile": "menotomy-grill/entrance.jpg",
        "scenes": {"entrance": {"title": "Menotomy Grill — Dining Room", "hfov": 110, "pitch": -2, "yaw": 45}},
    },
}


def fetch_shops_basicinfo():
    """Fetch active rows from shops_basicinfo via Supabase REST API."""
    url = (
        f"{SUPABASE_URL}/rest/v1/shops_basicinfo"
        f"?is_active=eq.true&order=name"
    )
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"Error fetching shops_basicinfo: {e.code} {e.reason}\n{body}", file=sys.stderr)
        sys.exit(1)


def merge_row(row):
    """Merge a DB row with local panorama config."""
    pano = PANO_CONFIG.get(row["id"], {})
    return {
        "id":           row["id"],
        "name":         row["name"],
        "category":     row.get("category"),
        "lat":          pano.get("lat"),
        "lng":          pano.get("lng"),
        "description":  row.get("description"),
        # Normalize hours to an array so the frontend can accept multiple entries
        "hours":        (lambda v: ([v] if isinstance(v, str) else (v or [])))(row.get("hours")),
        # days_open is a JSON/array column listing weekdays or named days the shop is open
        "days_open":    row.get("days_open") or [],
        "website":      row.get("website"),
        "departments":  row.get("departments") or [],
        "brands":       row.get("brands") or [],
        "priceRanges":  row.get("price_ranges") or {},
        "panoFile":     pano.get("panoFile"),
        "scenes":       pano.get("scenes", {}),
    }


def main():
    rows = fetch_shops_basicinfo()

    if not rows:
        print("No active shops found in shops_basicinfo. shops.json not updated.")
        sys.exit(0)

    shops = [merge_row(r) for r in rows]

    output = {
        "town": "Arlington, MA",
        "street": "Massachusetts Avenue",
        "center": {"lat": 42.4153, "lng": -71.1569},
        "defaultHeading": 90,
        "shops": shops,
    }

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Exported {len(shops)} shop(s) -> {os.path.normpath(OUT_FILE)}")


if __name__ == "__main__":
    main()
