#!/usr/bin/env python3
"""Subset the self-hosted fonts to the characters the site actually sets, and
write them as woff2.

The full TrueType files are about 580 KB together, which is more than the rest
of the homepage put together. Latin text, punctuation and the symbols used in
the interface are a fraction of that. Indic language names shown in the
interface fall back to the reader's system fonts, which already carry those
scripts properly.

    python3 scripts/build-fonts.py
"""
from __future__ import annotations

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "app/fonts"

# Latin-1, the punctuation the pages use, and the arrows and marks in the UI.
UNICODES = ",".join([
    "U+0000-00FF", "U+0131", "U+0152-0153", "U+02BB-02BC", "U+02C6", "U+02DA", "U+02DC",
    "U+2000-206F", "U+2074", "U+20B9", "U+2122", "U+2190-2199", "U+2212", "U+2215",
    "U+2500-2503", "U+25A0-25CF", "U+2713", "U+2717", "U+2726-2729", "U+FEFF", "U+FFFD",
])

SOURCES = [
    ("DMSans.ttf", "DMSans.woff2"),
    ("PlayfairDisplay.ttf", "PlayfairDisplay.woff2"),
]


def main() -> int:
    for source_name, target_name in SOURCES:
        source = FONTS / source_name
        if not source.exists():
            print(f"x {source_name}: not found")
            continue
        target = FONTS / target_name

        options = subset.Options()
        options.flavor = "woff2"
        options.with_zopfli = True
        options.desubroutinize = False
        options.layout_features = ["kern", "liga", "clig", "calt", "ccmp", "locl", "mark", "mkmk"]
        options.name_IDs = ["*"]
        options.name_legacy = True
        options.notdef_outline = True
        options.recalc_bounds = True
        options.drop_tables += ["DSIG"]

        font = TTFont(source, fontNumber=0)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(target)
        font.close()

        before = source.stat().st_size
        after = target.stat().st_size
        print(f"+ {target_name}: {before // 1024} KB -> {after // 1024} KB ({100 - after * 100 // before}% smaller)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
