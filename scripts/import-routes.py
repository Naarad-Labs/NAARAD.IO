#!/usr/bin/env python3
"""Bulk-add routes to content/routes.source.json, then rebuild the runtime files.

    python3 scripts/import-routes.py --csv routes.csv
    python3 scripts/import-routes.py --gpx path/to/folder [--type nature-hike] [--max-points 400]
    python3 scripts/import-routes.py --csv a.csv --gpx tracks/ --dry-run

CSV (header row required; only name and location are required):
    name, location, sport, theme, difficulty, distance_km, duration_min, ascent_m,
    start_lat, start_lng, slug
  location   "Place, State"           sport       walk | hike | cycle (default walk)
  theme      slug such as heritage-walk   difficulty  easy | moderate | hard | blank
  Blank numbers stay null: nothing is invented, and the pages say "Not yet measured".

GPX: every *.gpx in the folder becomes a recorded track (track points, or route
points if there are none). The length is measured from the points. Long files are
thinned to --max-points so the runtime file stays small.

Everything is checked before anything is written: one bad row aborts the whole run.
A slug that already exists is skipped and reported, so re-running a batch is safe.
Editorial routes (stops, stories, elevation) are still written by hand in the source.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(os.environ.get("NAARAD_ROOT") or Path(__file__).resolve().parent.parent)
SOURCE = ROOT / "content/routes.source.json"
SPORTS = {"walk", "hike", "cycle"}
DIFFICULTIES = {"easy", "moderate", "hard"}
PALETTE = ["#7C3AED", "#0891B2", "#EA580C", "#16A34A", "#DB2777", "#B45309", "#1E3161", "#DC2626"]
ICONS = ["🚶", "🌿", "🏛️", "🌊", "🏘️", "🔦", "🌆", "🕌"]
EARTH_R_KM = 6371.0088


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def haversine_km(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_R_KM * math.asin(math.sqrt(h))


def number(raw: str, field: str, errors: list, where: str, low=None, high=None):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        errors.append(f"{where}: {field} '{raw}' is not a number")
        return None
    if (low is not None and value < low) or (high is not None and value > high):
        errors.append(f"{where}: {field} {value} is out of range")
        return None
    return value


def whole(value):
    return None if value is None else int(round(value))


def read_csv(path: Path, errors: list) -> list[dict]:
    rows = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        reader.fieldnames = [(name or "").strip().lower() for name in reader.fieldnames or []]
        for missing in ("name", "location"):
            if missing not in reader.fieldnames:
                errors.append(f"{path.name}: header has no '{missing}' column")
                return []
        for number_, row in enumerate(reader, start=2):
            where = f"{path.name} line {number_}"
            get = lambda key: (row.get(key) or "").strip()  # noqa: E731
            if not any(get(key) for key in reader.fieldnames):
                continue
            name, location = get("name"), get("location")
            if not name or not location:
                errors.append(f"{where}: name and location are both required")
                continue
            sport = get("sport").lower() or "walk"
            if sport not in SPORTS:
                errors.append(f"{where}: sport '{sport}' must be one of {sorted(SPORTS)}")
            difficulty = get("difficulty").lower() or None
            if difficulty and difficulty not in DIFFICULTIES:
                errors.append(f"{where}: difficulty '{difficulty}' must be one of {sorted(DIFFICULTIES)}")
            slug = slugify(get("slug") or name)
            if not slug:
                errors.append(f"{where}: cannot make a slug from '{name}'")
            distance = number(get("distance_km"), "distance_km", errors, where, 0)
            rows.append({
                "slug": slug, "name": name, "location_label": location, "sport": sport,
                "theme": slugify(get("theme")) or None, "difficulty": difficulty,
                "route_type": None, "surface": None,
                "distance_m": None if distance is None else int(round(distance * 1000)),
                "duration_min": whole(number(get("duration_min"), "duration_min", errors, where, 0)),
                "ascent_m": whole(number(get("ascent_m"), "ascent_m", errors, where, 0)),
                "rating_avg": None, "rating_count": 0, "cover_image_path": None,
                "start_lat": number(get("start_lat"), "start_lat", errors, where, -90, 90),
                "start_lng": number(get("start_lng"), "start_lng", errors, where, -180, 180),
                "path": None, "path_preview": None,
            })
    return rows


def read_gpx(path: Path, errors: list, track_type: str, max_points: int) -> dict | None:
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as error:
        errors.append(f"{path.name}: not valid XML ({error})")
        return None
    local = lambda element: element.tag.rsplit("}", 1)[-1]  # noqa: E731
    points = [e for e in root.iter() if local(e) == "trkpt"] or [e for e in root.iter() if local(e) == "rtept"]
    coords = []
    for point in points:
        try:
            lat, lon = float(point.attrib["lat"]), float(point.attrib["lon"])
        except (KeyError, ValueError):
            errors.append(f"{path.name}: a point has no valid lat/lon")
            return None
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            errors.append(f"{path.name}: a point is outside the world ({lat}, {lon})")
            return None
        coords.append([round(lat, 6), round(lon, 6)])
    if len(coords) < 2:
        errors.append(f"{path.name}: needs at least 2 track points, found {len(coords)}")
        return None
    names = [(e.text or "").strip() for e in root.iter() if local(e) == "name" and (e.text or "").strip()]
    name = names[0] if names else path.stem.replace("_", " ").replace("-", " ").strip().title()
    km = sum(haversine_km(a, b) for a, b in zip(coords, coords[1:]))   # measured on every point, before thinning
    if len(coords) > max_points:
        keep = {round(i * (len(coords) - 1) / (max_points - 1)) for i in range(max_points)}
        coords = [c for i, c in enumerate(coords) if i in keep]
    lats, lons = [c[0] for c in coords], [c[1] for c in coords]
    return {
        "file": path.name, "name": name, "type": track_type, "dist_km": round(km, 2),
        "center": [round((min(lats) + max(lats)) / 2, 6), round((min(lons) + max(lons)) / 2, 6)],
        "coords": coords,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", type=Path, action="append", default=[], help="a CSV of catalogue routes")
    parser.add_argument("--gpx", type=Path, action="append", default=[], help="a folder of GPX files")
    parser.add_argument("--type", default="walk", help="track type for GPX (walk, nature-hike, coastal-walk, cycle, ...)")
    parser.add_argument("--max-points", type=int, default=400)
    parser.add_argument("--dry-run", action="store_true", help="check and report, write nothing")
    parser.add_argument("--no-build", action="store_true", help="edit the source but do not rebuild")
    args = parser.parse_args()
    if not args.csv and not args.gpx:
        parser.error("give --csv and/or --gpx")
    if args.max_points < 2:
        parser.error("--max-points must be at least 2")

    source = json.loads(SOURCE.read_text())
    taken = {r["slug"] for r in source["catalogue"]} | {r["slug"] for r in source.get("routes", [])}
    taken |= {slugify(t["name"]) for t in source["tracks"]}
    errors: list[str] = []
    new_rows, new_tracks, skipped = [], [], []

    for path in args.csv:
        for row in read_csv(path, errors):
            (skipped if row["slug"] in taken else new_rows).append(row)
            taken.add(row["slug"])
    for folder in args.gpx:
        if not folder.is_dir():
            errors.append(f"{folder}: not a folder")
            continue
        for path in sorted(folder.glob("*.gpx")):
            track = read_gpx(path, errors, args.type, args.max_points)
            if track:
                (skipped if slugify(track["name"]) in taken else new_tracks).append(track)
                taken.add(slugify(track["name"]))

    if errors:
        print("Nothing written. Fix these and run again:", file=sys.stderr)
        for line in errors:
            print(f"  - {line}", file=sys.stderr)
        return 1

    next_row = 1 + max((int(r["id"].split("-")[-1]) for r in source["catalogue"] if str(r["id"]).startswith("cur-")), default=0)
    for i, row in enumerate(new_rows):
        source["catalogue"].append({"id": f"cur-{next_row + i}", **row})
    next_track = 1 + max((t["id"] for t in source["tracks"]), default=0)
    for i, track in enumerate(new_tracks):
        n = next_track + i
        source["tracks"].append({"id": n, "file": track["file"], "name": track["name"],
                                 "color": PALETTE[n % len(PALETTE)], "icon": ICONS[n % len(ICONS)],
                                 **{k: track[k] for k in ("type", "dist_km", "center", "coords")}})

    for item in skipped:
        print(f"skipped (already exists): {item.get('slug') or slugify(item['name'])}")
    print(f"{'would add' if args.dry_run else 'added'}: {len(new_rows)} catalogue rows, {len(new_tracks)} tracks")
    if args.dry_run or not (new_rows or new_tracks):
        return 0

    SOURCE.write_text(json.dumps(source, indent=2, ensure_ascii=False) + "\n")
    if args.no_build:
        return 0
    return subprocess.call([sys.executable, str(Path(__file__).with_name("build-routes.py")), "--catalogue-only"])


if __name__ == "__main__":
    raise SystemExit(main())
