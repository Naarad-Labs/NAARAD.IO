from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from werkzeug.test import Client
from werkzeug.wrappers import Response

from naarad_site import create_site


class NaaradIntegrationTest(unittest.TestCase):
    def test_mount_serves_site_and_scopes_booking_session(self):
        root = Path(__file__).resolve().parents[2]
        if not (root / "app" / "shell.html").exists():
            self.skipTest("Requires the full Naarad repository.")
        with TemporaryDirectory() as directory:
            client = Client(create_site({
                "DATABASE": str(Path(directory) / "db.sqlite"),
                "SECRET_KEY": "local-test", "ADMIN_PASSWORD": "test-password",
                "REDIS_URL": None,
            }, root), Response)
            for path, filename in (
                ("/", "index.html"),
                ("/journey/", "journey/index.html"),
                ("/routes/", "routes/index.html"),
                ("/app/base.css", "app/base.css"),
            ):
                with client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.data, (root / filename).read_bytes())
            self.assertEqual(client.get("/trekking").location, "/trekking/")
            with client.get("/trekking/") as response:
                self.assertIn(b"./static/dashboard.js", response.data)
            self.assertEqual(client.get("/trekking/availability").json, {"trekking": True})
            login = client.post("/trekking/api/login", json={
                "email": "admin@localhost", "password": "test-password",
            })
            self.assertEqual(login.status_code, 200)
            self.assertIn("Path=/trekking", login.headers["Set-Cookie"])
            self.assertIn("naarad_trekking_session=", login.headers["Set-Cookie"])
            self.assertEqual(client.get("/trekking/api/admin").status_code, 200)
            for path in ("/api/admin", "/trekking/app.py", "/.git/config", "/trekking/instance/db.sqlite"):
                with client.get(path) as response:
                    self.assertEqual(response.status_code, 404)
