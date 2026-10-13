#!/usr/bin/env python3
"""Turn content/routes.source.json into the runtime route file the site loads.

For each editorial route this derives:
  * a connecting walking line through the published stop coordinates
    (interpolated, and recorded as a connecting line rather than a GPS survey),
  * the length of that line and the distance of each stop along it,
  * a real elevation profile sampled from NASA SRTM 30 m via OpenTopoData,
  * ascent and descent computed from those samples.

Nothing here invents a measurement: if elevation cannot be fetched the profile
is written as null and the interface shows its empty state.

    python3 scripts/build-routes.py
"""
from __future__ import annotations

import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content/routes.source.json"
TARGET = ROOT / "content/routes.json"
ELEVATION_API = "https://api.opentopodata.org/v1/srtm30m"
STEP_M = 40          # spacing of the interpolated line
SAMPLE_M = 90        # spacing of elevation samples
BATCH = 90           # OpenTopoData allows 100 locations per call
EARTH_R = 6371008.8


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(h))


def interpolate(a: tuple[float, float], b: tuple[float, float], step: float) -> list[tuple[float, float]]:
    span = haversine(a, b)
    count = max(1, int(span // step))
    return [(a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count) for i in range(count)]


def build_line(stops: list[dict], loop: bool) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    sequence = [(stop["lat"], stop["lng"]) for stop in stops]
    if loop and len(sequence) > 2:
        sequence = sequence + [sequence[0]]
    for start, end in zip(sequence, sequence[1:]):
        points.extend(interpolate(start, end, STEP_M))
    points.append(sequence[-1])
    return points


def cumulative(points: list[tuple[float, float]]) -> list[float]:
    out = [0.0]
    for previous, current in zip(points, points[1:]):
        out.append(out[-1] + haversine(previous, current))
    return out


def fetch_elevation(points: list[tuple[float, float]]) -> list[float] | None:
    values: list[float] = []
    for index in range(0, len(points), BATCH):
        chunk = points[index:index + BATCH]
        query = "|".join(f"{lat:.6f},{lng:.6f}" for lat, lng in chunk)
        url = f"{ELEVATION_API}?{urllib.parse.urlencode({'locations': query, 'interpolation': 'cubic'})}"
        for attempt in range(4):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": "NaaradSiteBuild/1.0 (naarad.io)"})
                with urllib.request.urlopen(request, timeout=60) as response:
                    payload = json.load(response)
                if payload.get("status") != "OK":
                    raise RuntimeError(payload.get("error", "elevation lookup failed"))
                values.extend(result["elevation"] for result in payload["results"])
                time.sleep(1.1)  # the public endpoint asks for one call per second
                break
            except Exception as error:
                if attempt == 3:
                    print(f"    elevation unavailable: {error}")
                    return None
                time.sleep(3 * (attempt + 1))
    if any(value is None for value in values):
        return None
    return values


def climb(samples: list[float]) -> tuple[int, int]:
    """Ascent and descent with a 3 m threshold, so SRTM noise is not counted."""
    ascent = descent = 0.0
    anchor = samples[0]
    for value in samples[1:]:
        delta = value - anchor
        if delta >= 3:
            ascent += delta
            anchor = value
        elif delta <= -3:
            descent += -delta
            anchor = value
    return round(ascent), round(descent)


def nearest_index(points: list[tuple[float, float]], target: tuple[float, float]) -> int:
    return min(range(len(points)), key=lambda i: haversine(points[i], target))


def main() -> int:
    source = json.loads(SOURCE.read_text())
    routes = []
    for route in source["routes"]:
        stops = route["stops"]
        points = build_line(stops, route.get("routeType") == "loop")
        distances = cumulative(points)
        total = distances[-1]
        print(f"{route['slug']}: {len(points)} line points, {total / 1000:.2f} km")

        sample_step = max(1, int(SAMPLE_M // STEP_M))
        sample_indexes = list(range(0, len(points), sample_step))
        if sample_indexes[-1] != len(points) - 1:
            sample_indexes.append(len(points) - 1)
        elevations = fetch_elevation([points[i] for i in sample_indexes])

        profile = None
        ascent = descent = None
        if elevations:
            profile = [{"d": round(distances[i]), "e": round(value, 1)}
                       for i, value in zip(sample_indexes, elevations)]
            ascent, descent = climb(elevations)
            print(f"    elevation {min(elevations):.0f}-{max(elevations):.0f} m, +{ascent} m / -{descent} m")

        stop_records = []
        for order, stop in enumerate(stops, start=1):
            index = nearest_index(points, (stop["lat"], stop["lng"]))
            stop_records.append({
                "order": order,
                "slug": f"{route['slug']}-{order:02d}",
                "name": stop["name"],
                "tagline": stop["tagline"],
                "lat": stop["lat"],
                "lng": stop["lng"],
                "photo": stop["photo"],
                "summary": stop["summary"],
                "story": stop["story"],
                "distanceM": round(distances[index]),
                "elevationM": round(elevations[sample_indexes.index(min(sample_indexes, key=lambda i: abs(i - index)))]) if elevations else None,
                "audio": None,
            })

        routes.append({
            **{key: value for key, value in route.items() if key not in ("stops",)},
            "distanceM": round(total),
            "ascentM": ascent,
            "descentM": descent,
            "stopCount": len(stops),
            "geometry": {
                "kind": "connecting-line",
                "note": "A line interpolated between the published stop coordinates. It is not a surveyed GPS track.",
                "coordinates": [[round(lng, 6), round(lat, 6)] for lat, lng in points],
            },
            "elevation": {
                "source": "NASA SRTM 30 m via OpenTopoData",
                "samples": profile,
            } if profile else None,
            "stops": stop_records,
        })

    TARGET.write_text(json.dumps({
        "note": source["note"],
        "generator": "scripts/build-routes.py",
        "routes": routes,
    }, indent=2) + "\n")
    print(f"\nWrote {TARGET.relative_to(ROOT)} with {len(routes)} routes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
