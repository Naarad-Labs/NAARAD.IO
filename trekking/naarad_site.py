"""Serve the published Naarad site and mount booking at /trekking/."""

import os
from pathlib import Path

from flask import Flask, redirect, request, send_from_directory
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from app import create_app

PUBLISHED_ROOTS = frozenset({
    "Images", "about", "app", "collections", "content", "creators",
    "discover", "explore", "internal", "journey", "routes", "stories",
})
PUBLISHED_FILES = frozenset({
    "404.html", "index.html", "manifest.json", "robots.txt", "sitemap.xml",
    "sw.js", "googlecc72b0f2c9685bc7.html",
})


def create_site(config=None, root=None):
    if os.getenv("TREKKING_HTTPS") == "1" and not os.getenv("TREKKING_SECRET_KEY"):
        raise RuntimeError("Set a stable TREKKING_SECRET_KEY for HTTPS deployments.")

    site_root = Path(root or Path(__file__).resolve().parent.parent).resolve()
    site = Flask(__name__, static_folder=None)
    booking_config = {
        "SESSION_COOKIE_NAME": "naarad_trekking_session",
        "SESSION_COOKIE_PATH": "/trekking",
        "SESSION_COOKIE_SECURE": os.getenv("TREKKING_HTTPS") == "1",
    }
    if config:
        booking_config.update(config)
    booking = create_app(booking_config)

    @site.get("/")
    def home():
        return send_from_directory(site_root, "index.html")

    @site.get("/trekking")
    def trekking_url():
        return redirect("/trekking/", code=308)

    @site.get("/<path:page>")
    def published(page):
        parts = page.rstrip("/").split("/")
        if any(part in {"", "..", "."} or part.startswith(".") for part in parts):
            return not_found(None)
        if parts[0] not in PUBLISHED_ROOTS and page not in PUBLISHED_FILES:
            return not_found(None)
        target = site_root.joinpath(*parts).resolve()
        if not target.is_relative_to(site_root):
            return not_found(None)
        if target.is_dir():
            if not page.endswith("/"):
                location = request.path + "/"
                if request.query_string:
                    location += "?" + request.query_string.decode("latin-1")
                return redirect(location, code=308)
            target = (target / "index.html").resolve()
        if not target.is_relative_to(site_root) or not target.is_file():
            return not_found(None)
        return send_from_directory(site_root, target.relative_to(site_root))

    @site.errorhandler(404)
    def not_found(_error):
        return send_from_directory(site_root, "404.html"), 404

    # DispatcherMiddleware sends the exact mount path to Flask with an empty
    # PATH_INFO. Redirect first so relative assets and API URLs resolve there.
    dispatch = DispatcherMiddleware(site, {"/trekking": booking})

    def application(environ, start_response):
        if environ["PATH_INFO"] == "/trekking":
            return site(environ, start_response)
        return dispatch(environ, start_response)

    return application
