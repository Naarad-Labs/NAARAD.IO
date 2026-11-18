import os
import tempfile
import unittest

from app import create_app


class TrekkingTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.app = create_app(dict(
            TESTING=True, DATABASE=os.path.join(directory.name, "test.sqlite"),
            SECRET_KEY="test", ADMIN_PASSWORD="admin-password", REDIS_URL=None,
        ))

    def login(self, email, password):
        client = self.app.test_client()
        self.assertEqual(client.post("/api/login", json=dict(email=email, password=password)).status_code, 200)
        return client

    def test_roles_booking_limits_and_history(self):
        admin = self.login("admin@localhost", "admin-password")
        staff_info = dict(name="Guide", email="guide@example.test", password="guide-password")
        staff_id = admin.post("/api/staff", json=staff_info).json["id"]
        route = dict(name="Hampi walk", location="Hampi", difficulty="Easy", duration=1)
        route_id = admin.post("/api/routes", json=route).json["id"]
        trek = dict(route_id=route_id, staff_id=staff_id, capacity=1,
                    start_date="2099-01-01", end_date="2099-01-01", instructions="Meet at the gate.")
        trek_id = admin.post("/api/treks", json=trek).json["id"]
        path = f"/api/treks/{trek_id}"
        guide = self.login(staff_info["email"], staff_info["password"])
        other_staff = dict(name="Other guide", email="other-guide@example.test", password="other-guide-password")
        self.assertEqual(admin.post("/api/staff", json=other_staff).status_code, 201)
        other_guide = self.login(other_staff["email"], other_staff["password"])
        self.assertEqual(other_guide.patch(path, json=dict(status="Open")).status_code, 403)
        trekkers = []
        for name in ("Alex", "Sam"):
            info = dict(name=name, email=f"{name.lower()}@example.test", password="trekker-password")
            client = self.app.test_client()
            self.assertEqual(client.post("/api/register", json=info).status_code, 201)
            trekkers.append(self.login(info["email"], info["password"]))
        first, second = trekkers
        self.assertEqual(first.get("/api/admin").status_code, 403)
        self.assertEqual(first.post(path + "/book", json={}).status_code, 409)
        self.assertEqual(guide.patch(path, json=dict(status="Open")).status_code, 200)
        self.assertEqual(len(first.get("/api/treks?difficulty=Easy&location=Hampi&duration=1").json), 1)
        self.assertEqual(first.post(path + "/book", json={}).status_code, 201)
        self.assertEqual(first.post(path + "/book", json={}).status_code, 409)
        self.assertEqual(second.post(path + "/book", json={}).status_code, 409)
        self.assertEqual(len(guide.get(path + "/participants").json), 1)
        self.assertEqual(guide.patch(path, json=dict(status="Started")).status_code, 200)
        self.assertEqual(guide.patch(path, json=dict(status="Completed")).status_code, 200)
        self.assertEqual(first.get("/api/bookings").json[0]["status"], "Completed")


if __name__ == "__main__":
    unittest.main()
