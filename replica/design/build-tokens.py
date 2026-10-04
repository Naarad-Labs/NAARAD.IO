#!/usr/bin/env python3
"""Generate discover/tokens.css from replica/design/tokens.json. Standard library only.

    python3 replica/design/build-tokens.py            # write tokens.css
    python3 replica/design/build-tokens.py --check    # exit 1 if tokens.css is stale

tokens.json is the source of truth. Edit it, rerun this, commit both.
tokens.css lives in discover/ because the site loads it.
Custom property names are prefixed by kind (--color-, --type-, --space-...) and
do not collide with the site's existing short names (--navy, --or, --bd...).
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "tokens.json")
OUT = os.path.join(HERE, "..", "..", "discover", "tokens.css")


def build(tokens):
    lines = [
        "/* GENERATED from tokens.json by build-tokens.py. Do not edit by hand. */",
        "",
        ":root {",
    ]

    for name, value in tokens["color"].items():
        lines.append("  --color-%s: %s;" % (name, value))
    lines.append("")

    for name, value in tokens["font"].items():
        lines.append("  --font-%s: %s;" % (name, value))
    lines.append("")

    for name, t in tokens["type"].items():
        family = "var(--font-%s)" % t.get("family", "sans")
        lines.append("  --type-%s: %s %spx/%spx %s;" % (name, t["weight"], t["size"], t["line"], family))
        if "tracking" in t:
            lines.append("  --type-%s-tracking: %s;" % (name, t["tracking"]))
        if "transform" in t:
            lines.append("  --type-%s-transform: %s;" % (name, t["transform"]))
    lines.append("")

    for value in tokens["space"]:
        lines.append("  --space-%d: %dpx;" % (value, value))
    lines.append("")

    for name, value in tokens["radius"].items():
        lines.append("  --radius-%s: %dpx;" % (name, value))
    lines.append("")

    for name, value in tokens["shadow"].items():
        lines.append("  --shadow-%s: %s;" % (name, value))
    lines.append("")

    for name, value in tokens["motion"].items():
        lines.append("  --motion-%s: %s;" % (name, value))
    lines.append("")

    for name, value in tokens["size"].items():
        lines.append("  --size-%s: %dpx;" % (name, value))
    lines.append("}")
    lines.append("")

    bp = tokens["breakpoint"]
    lines.append("/* Breakpoints cannot be custom properties. Use these numbers in @media:")
    lines.append("   " + ", ".join("%s %dpx" % (k, v) for k, v in bp.items()) + ". */")
    lines.append("")
    lines.append("/* Users who ask for less motion get none. Components animate through the")
    lines.append("   --motion-* durations, so this one rule covers all of them. */")
    lines.append("@media (prefers-reduced-motion: reduce) {")
    lines.append("  :root {")
    lines.append("    --motion-fast: 0ms;")
    lines.append("    --motion-base: 0ms;")
    lines.append("  }")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main():
    with open(SRC, encoding="utf-8") as fh:
        css = build(json.load(fh))
    if "--check" in sys.argv:
        try:
            with open(OUT, encoding="utf-8") as fh:
                current = fh.read()
        except FileNotFoundError:
            current = None
        if current != css:
            print("tokens.css is out of date. Run: python3 replica/design/build-tokens.py")
            return 1
        print("tokens.css is up to date")
        return 0
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(css)
    print("wrote %s" % os.path.relpath(os.path.normpath(OUT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
