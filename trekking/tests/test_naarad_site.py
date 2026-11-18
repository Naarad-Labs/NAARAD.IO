from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from urllib.parse import parse_qs, urlsplit

from werkzeug.test import Client
from werkzeug.wrappers import Response

from naarad_site import create_site


class NaaradIntegrationTest(unittest.TestCase):
    def test_public_hero_session_and_workspace_permissions(self):
        root = Path(__file__).resolve().parents[2]
        if not (root / "app" / "shell.html").exists():
            self.skipTest("Requires the full Naarad repository.")
        with TemporaryDirectory() as directory:
            app = create_site({
                "DATABASE": str(Path(directory) / "db.sqlite"),
                "SECRET_KEY": "local-test", "ADMIN_PASSWORD": "test-password",
                "REDIS_URL": None,
            }, root)
            guest = Client(app, Response)
            hero = guest.get("/")
            self.assertIn(b'class="home-hero ', hero.data)
            self.assertNotIn(b'src="/app/main.js"', hero.data)
            self.assertLess(len(hero.data), (root / "index.html").stat().st_size)
            for path in ("/routes/?q=Hampi", "/journey/", "/creators/", "/creators/guide/", "/admin/treks/", "/content/routes.json"):
                response = guest.get(path)
                self.assertEqual(response.status_code, 302, path)
                self.assertEqual(parse_qs(urlsplit(response.location).query)["next"], [path])
                self.assertIn("no-store", response.headers["Cache-Control"])
            self.assertEqual(guest.get("/trekking/api/departures").status_code, 401)
            with guest.get("/app/base.css") as css:
                self.assertEqual(css.status_code, 200)

            admin = Client(app, Response)
            login = admin.post("/trekking/api/login", json={"email": "admin@localhost", "password": "test-password"})
            self.assertEqual(login.status_code, 200)
            self.assertIn("Path=/", login.headers["Set-Cookie"])
            self.assertEqual(admin.get("/admin/treks/").status_code, 200)
            self.assertEqual(admin.get("/creators/guide/").status_code, 403)

            staff_details = {"email": "guide@example.test", "name": "Guide", "password": "test-password"}
            self.assertEqual(admin.post("/trekking/api/staff", json=staff_details).status_code, 201)
            staff = Client(app, Response)
            self.assertEqual(staff.post("/trekking/api/login", json=staff_details).status_code, 200)
            self.assertEqual(staff.get("/creators/guide/").status_code, 200)
            self.assertEqual(staff.get("/admin/treks/").status_code, 403)

            trekker_details = {"email": "trekker@example.test", "name": "Trekker", "password": "test-password"}
            self.assertEqual(guest.post("/trekking/api/register", json=trekker_details).status_code, 201)
            self.assertEqual(guest.post("/trekking/api/login", json=trekker_details).status_code, 200)
            self.assertEqual(guest.get("/routes/departures/").status_code, 200)
            self.assertEqual(guest.get("/journey/bookings/").status_code, 200)
            self.assertEqual(guest.get("/creators/guide/").status_code, 403)
            self.assertEqual(guest.get("/admin/treks/").status_code, 403)
            self.assertEqual(guest.post("/trekking/api/logout", json={}).status_code, 200)
            self.assertEqual(guest.get("/routes/").status_code, 302)
