"""Serve Naarad behind the trekking session, with a public home hero."""

import os
from contextlib import closing
from pathlib import Path

from flask import Flask, redirect, request, send_from_directory, url_for
from werkzeug.middleware.dispatcher import DispatcherMiddleware

from app import connect, create_app

PUBLISHED_ROOTS = frozenset({
    "Images", "about", "app", "collections", "content", "creators",
    "discover", "explore", "internal", "journey", "routes", "stories",
})
PUBLISHED_FILES = frozenset({
    "404.html", "index.html", "manifest.json", "robots.txt", "sitemap.xml",
    "googlecc72b0f2c9685bc7.html",
})
WORKSPACES = {
    "/routes/departures/": None,
    "/journey/bookings/": "trekker",
    "/creators/guide/": "staff",
    "/admin/treks/": "admin",
}
SIGN_IN = "/trekking/sign-in/"
# Replace any worker installed by the public site without caching gated responses.
GATED_WORKER = """
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (/^naarad-(shell|pages|content)-/.test(key)) await caches.delete(key);
  }
  await self.clients.claim();
})()));
"""


def create_site(config=None, root=None):
    if os.getenv("TREKKING_HTTPS") == "1" and not os.getenv("TREKKING_SECRET_KEY"):
        raise RuntimeError("Set a stable TREKKING_SECRET_KEY for HTTPS deployments.")

    site_root = Path(root or Path(__file__).resolve().parent.parent).resolve()
    site = Flask(__name__, static_folder=None)
    booking_config = {
        "SESSION_COOKIE_NAME": "naarad_site_session",
        "SESSION_COOKIE_PATH": "/",
        "SESSION_COOKIE_SECURE": os.getenv("TREKKING_HTTPS") == "1",
    }
    if config:
        booking_config.update(config)
    booking = create_app(booking_config)
    site.config.update(booking.config)
    dispatch = DispatcherMiddleware(site, {"/trekking": booking})

    def signed_in_role():
        session = booking.session_interface.open_session(booking, request)
        if not session or not session.get("user_id"):
            return None
        with closing(connect(booking.config["DATABASE"])) as db:
            account = db.execute("SELECT role FROM users WHERE id=? AND status='active'",
                                 (session["user_id"],)).fetchone()
        return account["role"] if account else None

    def sign_in(role=None):
        target = request.full_path.removesuffix("?")
        return redirect(url_for("sign_in_page", next=target, role=role))

    @site.after_request
    def private_response(response):
        response.headers["Cache-Control"] = "private, no-store"
        response.vary.add("Cookie")
        return response

    @site.get(SIGN_IN)
    def sign_in_page():
        return workspace_page()

    def workspace_page():
        html = (Path(booking.static_folder) / "index.html").read_text()
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><base href="/trekking/">')
        html = html.replace('<body class="bg-body-tertiary">', '<body class="naarad-workspace">')
        html = html.replace('<script defer src="./static/vendor/vue.js">', '<link rel="stylesheet" href="/app/base.css"><script defer src="./static/vendor/vue.js">')
        return html

    def website_page(target, role):
        html = target.read_text()
        if role:
            controls = '<a href="/trekking/sign-in/?switch=1">Account</a>'
            if role == "admin":
                controls = '<a href="/admin/treks/">Admin</a>' + controls
            html = html.replace('</nav>', controls + '</nav>', 1)
            marker = f'<script>globalThis.__NAARAD_SITE_ROLE__ = "{role}";</script>'
            return html.replace('<script type="module" src="/app/main.js">', marker + '<script type="module" src="/app/main.js">', 1)
        hero_end = html.index("</section>", html.index('<section class="home-hero'))
        main_end = html.index("</main>", hero_end)
        html = html[:hero_end + len("</section>")] + "</div>" + html[main_end:]
        html = html.replace('<script type="module" src="/app/main.js"></script>', '', 1)
        html = html.replace('</nav>', '<a href="/trekking/sign-in/">Sign in</a></nav>', 1)
        return html.replace('</body>', """<script>
          const menu = document.querySelector('.menu-toggle');
          menu?.addEventListener('click', () => {
            const open = menu.closest('.site-header').classList.toggle('nav-open');
            menu.setAttribute('aria-expanded', String(open));
          });
        </script></body>""", 1)

    @site.get("/")
    def home():
        role = signed_in_role()
        if not role and any(request.args.get(key) for key in ("view", "route", "story")):
            return redirect(url_for("sign_in_page", next=request.full_path))
        return website_page(site_root / "index.html", role)

    @site.get("/trekking")
    @site.get("/trekking/")
    def trekking_url():
        role = signed_in_role()
        if not role:
            return redirect(SIGN_IN)
        return redirect({"admin": "/admin/treks/", "staff": "/creators/guide/"}.get(role, "/routes/departures/"))

    @site.get("/sw.js")
    def service_worker():
        return site.response_class(GATED_WORKER, mimetype="text/javascript")

    @site.get("/<path:page>")
    def published(page):
        path = "/" + page
        if path + "/" in WORKSPACES:
            return redirect(path + ("/?" + request.query_string.decode("latin-1") if request.query_string else "/"), 308)
        if path in WORKSPACES:
            role = signed_in_role()
            required = WORKSPACES[path]
            if not role:
                return sign_in(required)
            if required and role != required:
                return workspace_page(), 403
            return workspace_page()
        parts = page.rstrip("/").split("/")
        if any(part in {"", "..", "."} or part.startswith(".") for part in parts):
            return not_found(None)
        if parts[0] not in PUBLISHED_ROOTS and page not in PUBLISHED_FILES:
            return not_found(None)
        target = site_root.joinpath(*parts).resolve()
        if not target.is_relative_to(site_root):
            return not_found(None)
        if target.is_dir():
            target = (target / "index.html").resolve()
        if not target.is_relative_to(site_root) or not target.is_file():
            return not_found(None)
        public_asset = target.suffix.lower() not in {".html", ".json", ".geojson", ".gpx", ".js"} or target.name == "manifest.json"
        role = None if public_asset else signed_in_role()
        if not public_asset and not role:
            return sign_in()
        if target.suffix == ".html":
            if not page.endswith("/") and target.name == "index.html" and not page.endswith(".html"):
                return redirect(request.path + "/" + ("?" + request.query_string.decode("latin-1") if request.query_string else ""), 308)
            return website_page(target, role)
        return send_from_directory(site_root, target.relative_to(site_root))

    @site.errorhandler(404)
    def not_found(_error):
        if not signed_in_role():
            return "Page not found.", 404
        return send_from_directory(site_root, "404.html"), 404

    def application(environ, start_response):
        if environ["PATH_INFO"] in {"/trekking", "/trekking/", SIGN_IN}:
            return site(environ, start_response)
        return dispatch(environ, start_response)

    return application
