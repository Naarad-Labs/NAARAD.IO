#!/usr/bin/env python3
"""Fetch freely licensed photographs and encode the responsive sizes the site serves.

Photographs are found through the Openverse API, which indexes Wikimedia
Commons, Flickr and others and reports the creator and licence for each one.
Only licences that allow commercial use and modification are accepted, and a
result whose creator or licence is missing is skipped rather than guessed at.

Originals land in .cache/photos (not committed), the encoded derivatives in
Images/photos, and the credits in content/photo-sources.json.

    python3 scripts/build-photos.py            # fetch what is missing, encode all
    python3 scripts/build-photos.py --encode   # encode from cache only
    python3 scripts/build-photos.py hampi-bazaar varanasi-ghats   # only these ids
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/photos"
OUT = ROOT / "Images/photos"
MANIFEST = ROOT / "content/photo-sources.json"
API = "https://api.openverse.org/v1/images/"
UA = "NaaradSiteBuild/1.0 (https://naarad.io; static site build)"

# Licences we accept: public domain, attribution, attribution-share-alike.
# Everything else (NC, ND) is left out, so the site can be used commercially.
LICENCES = "cc0,pdm,by,by-sa"

LICENCE_NAMES = {
    "cc0": "CC0", "pdm": "Public Domain Mark", "by": "CC BY", "by-sa": "CC BY-SA",
}

# Width sets per role. Keep them to what the layouts actually request.
ROLES = {
    "hero": [800, 1200, 1600, 1920, 2400],
    "feature": [640, 960, 1280, 1600, 1920],
    "card": [320, 480, 640, 800, 1200],
    "thumb": [96, 192, 288],
    "portrait": [120, 240],
}

# id -> (search query, role, minimum width). The query is what makes the
# photograph the right one, so keep it specific.
WANTED = {
    "hampi-landscape": ("hampi panorama hills temple view karnataka", "hero", 1500),
    "hampi-virupaksha": ("virupaksha temple hampi", "feature", 1100),
    "hampi-gopuram": ("virupaksha temple gopuram hampi tower", "hero", 1500),
    "hampi-bazaar": ("hampi bazaar pillared street market", "feature", 900),
    "hampi-stone-chariot": ("stone chariot vittala temple hampi", "hero", 1500),
    "hampi-chariot-wheel": ("stone chariot wheel hampi carving", "feature", 900),
    "hampi-krishna-temple": ("krishna temple hampi", "card", 800),
    "hampi-royal-enclosure": ("mahanavami dibba hampi royal enclosure", "card", 800),
    "hampi-queens-bath": ("queens bath hampi", "card", 800),
    "hampi-elephant-stables": ("elephant stables hampi", "card", 800),
    "hampi-matanga": ("matanga hill hampi view", "card", 800),
    "hampi-achyutaraya": ("achyutaraya temple hampi", "card", 800),
    "hampi-lotus-mahal": ("lotus mahal hampi", "card", 800),
    "hampi-tungabhadra": ("tungabhadra river hampi coracle", "feature", 900),
    "hampi-sasivekalu": ("sasivekalu ganesha hampi monolith", "card", 700),
    "thanjavur-bronze": ("chola bronze sculpture nataraja", "card", 700),
    "varanasi-ghats": ("varanasi ghats ganges", "card", 900),
    "mysore-palace": ("mysore palace", "card", 900),
    "jaipur-hawa-mahal": ("hawa mahal jaipur", "card", 900),
    "auroville-matrimandir": ("matrimandir auroville", "feature", 900),
    "golconda-fort": ("golconda fort hyderabad", "card", 800),
    "gujarat-stepwell": ("rani ki vav stepwell patan", "card", 800),
    "chennai-iitm": ("iit madras campus chennai", "card", 700),
    "chennai-marina": ("marina beach chennai", "card", 800),
    "india-reader": ("woman reading book india", "card", 700),
    "india-traveller": ("hampi tourist", "feature", 800),
    "india-storyteller": ("indian musician performer", "feature", 800),
}

# id -> (Wikimedia Commons file title, role). Chosen by eye where the search
# result was hazy or off-subject; the author and licence come from Commons itself.
PINNED = {
    "thanjavur-temple": ("Brihadisvara Temple during Maha Shivaratri-WUS03611 (edit).jpg", "feature"),
}

# Stops with no relevant licensed photograph yet get an illustrated placeholder
# that says so, so nothing shows an unrelated picture. id -> (label, kind).
PLACEHOLDERS = {
    "thanjavur-palace": ("Thanjavur Palace", "palace"),
    "thanjavur-library": ("Saraswathi Mahal Library", "library"),
    "auroville-amphitheatre": ("Amphitheatre and Urn", "amphitheatre"),
    "auroville-visitor-centre": ("Auroville Visitor Centre", "pavilion"),
}

# Photographs whose uploads carry black bars (checked by eye); they are cropped
# off before encoding. Others are left whole: a dark scene is not a bar.
LETTERBOXED = {"chennai-marina", "mysore-palace"}

TAGS = re.compile(r"<[^>]*>")


def shorten(name: str, limit: int = 70) -> str:
    """Some uploaders paste a paragraph into the creator field; keep the name."""
    name = name.split(". ")[0].strip()
    if len(name) <= limit:
        return name
    cut = name[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def clean(value: str | None) -> str:
    text = TAGS.sub(" ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def fetch(url: str, timeout: int = 60) -> bytes:
    """Read a URL, backing off when the far end asks us to slow down."""
    delay = 4
    for attempt in range(5):
        request = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 503) or attempt == 4:
                raise
            wait = min(int(error.headers.get("Retry-After") or delay), 30)
            print(f"    rate limited, waiting {wait}s")
            time.sleep(wait)
            delay = min(delay * 2, 30)
    raise RuntimeError("unreachable")


def pinned(title: str) -> dict:
    """One named Commons file, with its creator and licence as Commons records them."""
    query = urllib.parse.urlencode({
        "action": "query", "format": "json", "titles": f"File:{title}", "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 1920,
    })
    page = next(iter(json.loads(fetch(f"https://commons.wikimedia.org/w/api.php?{query}"))["query"]["pages"].values()))
    info = page["imageinfo"][0]
    meta = info["extmetadata"]
    licence = clean(meta.get("LicenseShortName", {}).get("value"))
    if not re.match(r"(CC0|Public domain|CC BY(-SA)? )", licence, re.I):
        raise ValueError(f"licence '{licence}' is not one we accept")
    return {
        "url": info.get("thumburl") or info["url"], "title": shorten(clean(meta.get("ObjectName", {}).get("value")) or title),
        "author": shorten(re.sub(r"^Original:\s*", "", clean(meta.get("Artist", {}).get("value"))) or "Unknown"), "licence": licence,
        "licenceUrl": clean(meta.get("LicenseUrl", {}).get("value")), "sourcePage": info["descriptionurl"], "source": "wikimedia",
    }


def search(query: str, min_width: int) -> dict | None:
    """Best freely licensed match. If nothing meets the width we want, the
    bar is lowered once rather than leaving the layout with a hole."""
    return _search(query, min_width) or _search(query, int(min_width * 0.6))


def _search(query: str, min_width: int) -> dict | None:
    url = f"{API}?{urllib.parse.urlencode({'q': query, 'license': LICENCES, 'page_size': 12, 'mature': 'false'})}"
    payload = json.loads(fetch(url))
    time.sleep(0.6)
    for result in payload.get("results", []):
        width = result.get("width") or 0
        creator = shorten(clean(result.get("creator")))
        licence = result.get("license")
        image_url = result.get("url")
        if not (creator and licence and image_url):
            continue
        if width < min_width:
            continue
        if not str(image_url).lower().split("?")[0].endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        name = LICENCE_NAMES.get(licence, licence.upper())
        version = result.get("license_version") or ""
        return {
            "title": clean(result.get("title")) or query,
            "author": creator,
            "licence": f"{name} {version}".strip(),
            "licenceUrl": result.get("license_url") or "",
            "sourcePage": result.get("foreign_landing_url") or "",
            "source": result.get("source") or "openverse",
            "url": image_url,
            "width": width,
            "height": result.get("height") or 0,
        }
    return None


def scaled_candidates(url: str) -> list[str]:
    """Server-scaled copies to try before a full-resolution original.

    Wikimedia originals run to tens of megabytes and its thumbnailer only
    accepts a fixed set of widths (1920 and 1280 are among them). Flickr
    suffixes its sizes: _k is 2048 px wide, _b is 1024.
    """
    if "upload.wikimedia.org" in url and "/thumb/" not in url:
        head, _, name = url.rpartition("/")
        path = head.replace("/commons/", "/commons/thumb/").replace("/wikipedia/en/", "/wikipedia/en/thumb/")
        suffix = "" if name.lower().endswith((".jpg", ".jpeg")) else ".jpg"
        return [f"{path}/{name}/{width}px-{name}{suffix}" for width in (1920, 1280)] + [url]
    if "staticflickr.com" in url and re.search(r"_[a-z]\.jpg$", url):
        return [re.sub(r"_[a-z]\.jpg$", "_k.jpg", url), url]
    return [url]


def content_length(url: str) -> int:
    try:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(request, timeout=30) as response:
            return int(response.headers.get("Content-Length") or 0)
    except Exception:
        return 0


def download(url: str, target: Path) -> None:
    if target.exists() and target.stat().st_size > 0:
        return
    last_error: Exception | None = None
    for candidate in scaled_candidates(url):
        size = content_length(candidate)
        if size > 14_000_000:
            print(f"    skipping {size // 1_000_000} MB copy")
            continue
        try:
            target.write_bytes(fetch(candidate, timeout=90))
            return
        except Exception as error:
            last_error = error
    raise last_error or RuntimeError("no downloadable copy")


def trim_bars(image: Image.Image) -> Image.Image:
    """Crop the black bars an upload carries above and below, or beside, the picture.

    A row or column is a bar only while it is black through and through, and
    no more than a fifth of a side is ever taken.
    """
    lit = image.convert("L").point(lambda value: 255 if value > 10 else 0)
    width, height = image.size

    def edges(profile: Image.Image, length: int) -> tuple[int, int]:
        values = list(profile.tobytes())
        first = next((i for i, v in enumerate(values) if v > 1), 0)
        last = next((i for i, v in enumerate(reversed(values)) if v > 1), 0)
        limit = length // 5
        # Two pixels of margin: the edge of a bar is blended with the picture.
        return (min(first, limit) + 2 if first else 0, min(last, limit) + 2 if last else 0)

    top, bottom = edges(lit.resize((1, height), Image.BOX), height)
    left, right = edges(lit.resize((width, 1), Image.BOX), width)
    if not (top or bottom or left or right):
        return image
    return image.crop((left, top, width - right, height - bottom))


def placeholder(photo_id: str, label: str, kind: str) -> dict:
    """An original illustration (drawn here, so no one else's rights) on warm paper."""
    from PIL import ImageDraw, ImageFont
    k, w, h = 2, 1600, 900
    image = Image.new("RGB", (w * k, h * k), (244, 235, 220))
    d = ImageDraw.Draw(image)
    ink, clay, sand = (122, 58, 30), (196, 112, 64), (231, 214, 190)
    d.rectangle([0, 640 * k, w * k, h * k], fill=sand)
    cx = 800 * k
    if kind == "palace":      # a long arcaded facade with a central turret
        d.rectangle([260 * k, 400 * k, 1340 * k, 640 * k], fill=clay)
        d.rectangle([660 * k, 250 * k, 940 * k, 400 * k], fill=clay)
        d.polygon([(640 * k, 250 * k), (800 * k, 150 * k), (960 * k, 250 * k)], fill=ink)
        for x in range(300, 1300, 100):
            d.pieslice([x * k, 470 * k, (x + 70) * k, 540 * k], 180, 360, fill=sand)
            d.rectangle([x * k, 505 * k, (x + 70) * k, 640 * k], fill=sand)
    elif kind == "library":   # shelves of stacked palm-leaf manuscripts
        d.rectangle([380 * k, 190 * k, 1220 * k, 640 * k], fill=clay)
        for row in range(4):
            y = 215 + row * 107
            d.rectangle([410 * k, y * k, 1190 * k, (y + 88) * k], fill=sand)
            x = 420
            for n in range(26):
                d.rectangle([x * k, (y + 12) * k, (x + 20) * k, (y + 88) * k], fill=[ink, clay, (160, 90, 50)][n % 3])
                x += 30
    elif kind == "amphitheatre":   # stepped rings around a central urn
        for i in range(5):
            r = 330 - i * 55
            d.pieslice([cx - r * k, (640 - r // 2) * k, cx + r * k, (640 + r // 2) * k], 180, 360, fill=[ink, clay, (160, 90, 50), clay, ink][i])
        d.ellipse([cx - 40 * k, 470 * k, cx + 40 * k, 560 * k], fill=sand)
        d.rectangle([cx - 14 * k, 440 * k, cx + 14 * k, 480 * k], fill=sand)
    else:                     # a pavilion: roof, columns, steps
        d.polygon([(330 * k, 330 * k), (800 * k, 190 * k), (1270 * k, 330 * k)], fill=ink)
        d.rectangle([360 * k, 330 * k, 1240 * k, 365 * k], fill=clay)
        for x in range(400, 1220, 130):
            d.rectangle([x * k, 365 * k, (x + 40) * k, 620 * k], fill=clay)
        d.rectangle([340 * k, 620 * k, 1260 * k, 660 * k], fill=ink)
    image = image.resize((w, h), Image.LANCZOS)
    d = ImageDraw.Draw(image)
    font = None
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "/usr/share/fonts/dejavu/DejaVuSerif.ttf"):
        if Path(path).exists():
            font = ImageFont.truetype(path, 46)
            small = ImageFont.truetype(path, 30)
            break
    if font:
        d.text((w // 2, 745), label, fill=ink, font=font, anchor="mm")
        d.text((w // 2, 805), "Photograph coming soon", fill=clay, font=small, anchor="mm")
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = [width for width in ROLES["feature"] if width <= w]
    for width in sizes:
        resized = image.resize((width, round(h * width / w)), Image.LANCZOS)
        resized.save(OUT / f"{photo_id}-{width}.avif", quality=58, speed=6)
        resized.save(OUT / f"{photo_id}-{width}.webp", quality=80, method=5)
    return {
        "id": photo_id, "role": "card", "title": f"{label} (placeholder)", "author": "Naarad", "licence": "Original artwork",
        "licenceUrl": "", "sourcePage": "https://naarad.io", "source": "naarad", "placeholder": True,
        "widths": sizes, "aspect": round(w / h, 4),
    }


def encode(photo_id: str, role: str, source: Path) -> dict:
    image = Image.open(source)
    if image.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", image.size, (248, 243, 233))
        image = image.convert("RGBA")
        background.paste(image, mask=image.split()[-1])
        image = background
    else:
        image = image.convert("RGB")
    if photo_id in LETTERBOXED:
        image = trim_bars(image)
    native = image.width
    sizes = [width for width in ROLES[role] if width <= native] or [min(ROLES[role][0], native)]
    OUT.mkdir(parents=True, exist_ok=True)
    for width in sizes:
        height = max(1, round(image.height * width / image.width))
        resized = image.resize((width, height), Image.LANCZOS)
        if width < native:   # downscaling softens; a light unsharp mask brings the edges back
            resized = resized.filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=2))
        resized.save(OUT / f"{photo_id}-{width}.avif", quality=58, speed=6)
        resized.save(OUT / f"{photo_id}-{width}.webp", quality=80, method=5)
    return {"widths": sizes, "aspect": round(image.width / image.height, 4)}


def main() -> int:
    arguments = [value for value in sys.argv[1:] if not value.startswith("--")]
    encode_only = "--encode" in sys.argv
    selected = set(arguments) if arguments else set(WANTED) | set(PINNED)

    CACHE.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    existing = json.loads(MANIFEST.read_text())["photos"] if MANIFEST.exists() else {}

    photos: dict[str, dict] = {}
    missing: list[str] = []
    for photo_id, (query, role, min_width) in {**WANTED, **{k: (v[0], v[1], 0) for k, v in PINNED.items()}}.items():
        cached = CACHE / f"{photo_id}.jpg"
        record = existing.get(photo_id)
        if photo_id not in selected:
            if record and cached.exists():
                photos[photo_id] = record
            continue

        if not encode_only and not (cached.exists() and record):
            try:
                found = pinned(query) if photo_id in PINNED else search(query, min_width)
                if found:
                    download(found["url"], cached)
                    record = {
                        "id": photo_id, "role": role, "title": found["title"], "author": found["author"],
                        "licence": found["licence"], "licenceUrl": found["licenceUrl"],
                        "sourcePage": found["sourcePage"], "source": found["source"],
                    }
                else:
                    print(f"    no freely licensed result for '{query}'")
            except Exception as error:
                print(f"  {photo_id}: {error}")

        if not cached.exists() or not record:
            missing.append(photo_id)
            print(f"x {photo_id}")
            continue

        record["role"] = role
        try:
            record.update(encode(photo_id, role, cached))
        except Exception as error:
            print(f"x {photo_id}: cannot encode ({error})")
            missing.append(photo_id)
            continue
        photos[photo_id] = record
        print(f"+ {photo_id}: {record['author']} ({record['licence']}) {record['widths']}")

    for photo_id, (label, kind) in PLACEHOLDERS.items():
        photos[photo_id] = placeholder(photo_id, label, kind)
        print(f"~ {photo_id}: placeholder")

    MANIFEST.write_text(json.dumps({
        "note": "Photographs found through the Openverse API. Author and licence are recorded as the API reported them. "
                "Only CC0, Public Domain Mark, CC BY and CC BY-SA are used. Regenerate with scripts/build-photos.py.",
        "photos": photos,
    }, indent=2) + "\n")
    print(f"\n{len(photos)} photographs encoded into {OUT.relative_to(ROOT)}.")
    if missing:
        print(f"Missing: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
