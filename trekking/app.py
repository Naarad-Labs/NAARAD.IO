import hashlib
import io
import json
import os
import secrets
import sqlite3
from contextlib import closing
from datetime import date
from functools import wraps
from pathlib import Path

from flask import Flask, abort, current_app, g, request, send_file, session
from kombu.exceptions import OperationalError
from redis import Redis, RedisError
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent
DIFFICULTIES = ("Easy", "Moderate", "Hard")
TREK_SELECT = """
    SELECT t.*, r.name, r.location, r.duration, r.difficulty, r.archived,
           u.name AS staff_name,
           (SELECT COUNT(*) FROM bookings b WHERE b.trek_id = t.id
            AND b.status != 'Cancelled') AS booked
    FROM treks t JOIN routes r ON r.id = t.route_id
    LEFT JOIN users u ON u.id = t.staff_id
"""
BOOKING_SELECT = """
    SELECT b.*, r.name, r.location, t.start_date, t.end_date, t.status AS trek_status
    FROM bookings b JOIN treks t ON t.id = b.trek_id JOIN routes r ON r.id = t.route_id
"""
STAFF_TRANSITIONS = {
    "Pending": {"Open", "Closed"}, "Approved": {"Open", "Closed"},
    "Open": {"Closed", "Started"}, "Closed": {"Open", "Started"},
    "Started": {"Completed"}, "Completed": set(),
}


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def rows(db, query, parameters=()):
    return [dict(row) for row in db.execute(query, parameters)]


def data():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        abort(400, "Send a JSON object.")
    return value


def field(values, name, limit=160):
    value = values.get(name)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        abort(400, f"Enter a valid {name.replace('_', ' ')}.")
    return value.strip()


def integer(values, name):
    value = values.get(name)
    if type(value) is not int or not 1 <= value <= 2_147_483_647:
        abort(400, f"{name.replace('_', ' ')} must be a positive integer.")
    return value


def choice(values, name, allowed):
    value = field(values, name)
    if value not in allowed:
        abort(400, f"Invalid {name}.")
    return value


def day(values, name):
    try:
        return date.fromisoformat(field(values, name, 10)).isoformat()
    except ValueError:
        abort(400, f"Invalid {name.replace('_', ' ')}.")


def get_record(query, parameters):
    result = g.db.execute(query, parameters).fetchone()
    if result is None:
        abort(404, "Record not found.")
    return result


def role(*allowed):
    def decorate(action):
        @wraps(action)
        def protected(*args, **kwargs):
            if g.user is None:
                abort(401, "Sign in first.")
            if g.user["role"] not in allowed:
                abort(403, "This action is unavailable for your role.")
            return action(*args, **kwargs)
        return protected
    return decorate


def create_account(values, kind):
    email = field(values, "email", 254).lower()
    if email.count("@") != 1 or any(not part or any(c.isspace() for c in part) for part in email.split("@")):
        abort(400, "Enter a valid email.")
    password = values.get("password")
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        abort(400, "Use a password of 8 to 128 characters.")
    cursor = g.db.execute(
        "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
        (field(values, "name"), email, generate_password_hash(password), kind),
    )
    return {"id": cursor.lastrowid}, 201


def create_app(config=None):
    app = Flask(__name__, instance_path=str(ROOT / "instance"))
    app.config.update(
        DATABASE=os.getenv("TREKKING_DATABASE", str(ROOT / "instance" / "trekking.sqlite")),
        SECRET_KEY=os.getenv("TREKKING_SECRET_KEY") or secrets.token_hex(32),
        ADMIN_EMAIL=os.getenv("TREKKING_ADMIN_EMAIL", "admin@localhost").lower(),
        ADMIN_PASSWORD=os.getenv("TREKKING_ADMIN_PASSWORD"),
        REDIS_URL=os.getenv("TREKKING_REDIS_URL", "redis://127.0.0.1:6379/1"),
        BROKER_URL=os.getenv("TREKKING_BROKER_URL", "redis://127.0.0.1:6379/2"),
        SESSION_COOKIE_SAMESITE="Lax", MAX_CONTENT_LENGTH=32_768,
    )
    if config:
        app.config.update(config)
    db_path = app.config["DATABASE"]
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(db_path)) as db, db:
        db.executescript((ROOT / "schema.sql").read_text())
        if not db.execute("SELECT 1 FROM users WHERE role='admin'").fetchone():
            password = app.config["ADMIN_PASSWORD"]
            if not password or len(password) < 8:
                raise RuntimeError("Set TREKKING_ADMIN_PASSWORD to at least 8 characters before first start.")
            db.execute(
                "INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')",
                ("Administrator", app.config["ADMIN_EMAIL"], generate_password_hash(password)),
            )
    app.extensions["trek_cache"] = (
        Redis.from_url(app.config["REDIS_URL"], socket_timeout=0.25, socket_connect_timeout=0.25)
        if app.config["REDIS_URL"] else None
    )

    from seed import register_demo_command
    register_demo_command(app)

    @app.before_request
    def open_database():
        if not request.path.startswith("/api/"):
            return
        if request.method in {"POST", "PATCH", "DELETE"} and not request.is_json:
            abort(415, "Use application/json.")
        g.db = connect(db_path)
        if request.method in {"POST", "PATCH", "DELETE"} and request.path != "/api/exports":
            g.db.execute("BEGIN IMMEDIATE")
        g.user = g.db.execute(
            "SELECT id,name,email,role,status FROM users WHERE id=? AND status='active'",
            (session.get("user_id"),),
        ).fetchone()

    @app.after_request
    def finish(response):
        db = g.get("db")
        if db is not None and db.in_transaction:
            if response.status_code >= 400:
                db.rollback()
            else:
                db.commit()
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.teardown_request
    def close_database(_error):
        db = g.pop("db", None)
        if db is not None:
            db.close()

    @app.errorhandler(HTTPException)
    def http_error(exc):
        return {"error": exc.description}, exc.code

    @app.errorhandler(sqlite3.IntegrityError)
    def conflict(_error):
        return {"error": "That change conflicts with an existing record."}, 409

    @app.get("/")
    def home():
        return app.send_static_file("index.html")

    @app.get("/availability")
    def availability():
        return {"trekking": True}, 200, {"Cache-Control": "no-store"}

    @app.post("/api/register")
    def register():
        return create_account(data(), "trekker")

    @app.post("/api/login")
    def login():
        values = data()
        email = field(values, "email", 254).lower()
        password = values.get("password")
        user = g.db.execute("SELECT * FROM users WHERE email=? AND status='active'", (email,)).fetchone()
        if not isinstance(password, str) or len(password) > 128 or not user or not check_password_hash(user["password_hash"], password):
            abort(401, "Invalid email or password.")
        session.clear()
        session["user_id"] = user["id"]
        return {key: user[key] for key in ("id", "name", "email", "role")}

    @app.post("/api/logout")
    def logout():
        session.clear()
        return {}

    @app.get("/api/me")
    def identity():
        return {"user": dict(g.user) if g.user is not None else None}

    @app.patch("/api/me")
    @role("trekker")
    def profile():
        name = field(data(), "name")
        g.db.execute("UPDATE users SET name=? WHERE id=?", (name, g.user["id"]))
        return {"name": name}

    @app.get("/api/admin")
    @role("admin")
    def admin():
        term = "%" + request.args.get("q", "") + "%"
        users = rows(g.db, """
            SELECT id,name,email,role,status FROM users
            WHERE role != 'admin' AND (name LIKE ? OR email LIKE ?) ORDER BY name
        """, (term, term))
        routes = rows(g.db, "SELECT * FROM routes WHERE name LIKE ? OR location LIKE ? ORDER BY name", (term, term))
        treks = rows(g.db, TREK_SELECT + " WHERE r.name LIKE ? OR r.location LIKE ? ORDER BY t.start_date DESC", (term, term))
        bookings = rows(g.db, BOOKING_SELECT + " ORDER BY b.id DESC")
        counts = dict(g.db.execute("""
            SELECT (SELECT COUNT(*) FROM treks) AS treks,
                   (SELECT COUNT(*) FROM users WHERE role='trekker') AS users,
                   (SELECT COUNT(*) FROM users WHERE role='staff') AS staff,
                   (SELECT COUNT(*) FROM bookings) AS bookings,
                   (SELECT COUNT(*) FROM treks WHERE status='Completed') AS completed
        """).fetchone())
        staff = rows(g.db, "SELECT id,name FROM users WHERE role='staff' AND status='active' ORDER BY name")
        active_routes = rows(g.db, "SELECT id,name FROM routes WHERE archived=0 ORDER BY name")
        return dict(counts=counts, users=users, routes=routes, treks=treks, bookings=bookings, staff=staff, active_routes=active_routes)

    @app.post("/api/staff")
    @role("admin")
    def add_staff():
        return create_account(data(), "staff")

    @app.patch("/api/users/<int:user_id>")
    @role("admin")
    def user_status(user_id):
        get_record("SELECT id FROM users WHERE id=? AND role != 'admin'", (user_id,))
        status = choice(data(), "status", ("active", "inactive", "blacklisted"))
        g.db.execute("UPDATE users SET status=? WHERE id=?", (status, user_id))
        return {}

    def touch_catalogue():
        g.db.execute("UPDATE catalogue_version SET version=version+1 WHERE id=1")

    @app.post("/api/routes")
    @app.patch("/api/routes/<int:route_id>")
    @role("admin")
    def save_route(route_id=None):
        values = data()
        fields = (field(values, "name"), field(values, "location"), choice(values, "difficulty", DIFFICULTIES), integer(values, "duration"))
        if route_id is None:
            cursor = g.db.execute("INSERT INTO routes (name,location,difficulty,duration) VALUES (?,?,?,?)", fields)
            status = 201
            route_id = cursor.lastrowid
        else:
            get_record("SELECT id FROM routes WHERE id=? AND archived=0", (route_id,))
            g.db.execute("UPDATE routes SET name=?,location=?,difficulty=?,duration=? WHERE id=?", (*fields, route_id))
            status = 200
        touch_catalogue()
        return {"id": route_id}, status

    @app.delete("/api/routes/<int:route_id>")
    @role("admin")
    def archive_route(route_id):
        get_record("SELECT id FROM routes WHERE id=? AND archived=0", (route_id,))
        if g.db.execute("SELECT 1 FROM treks WHERE route_id=? AND status IN ('Open','Started')", (route_id,)).fetchone():
            abort(409, "Close or complete active departures before archiving this route.")
        g.db.execute("UPDATE routes SET archived=1 WHERE id=?", (route_id,))
        touch_catalogue()
        return {}

    def staff_id(values):
        if values.get("staff_id") is None:
            return None
        value = integer(values, "staff_id")
        get_record("SELECT id FROM users WHERE id=? AND role='staff' AND status='active'", (value,))
        return value

    @app.post("/api/treks")
    @role("admin")
    def create_trek():
        values = data()
        route_id = integer(values, "route_id")
        get_record("SELECT id FROM routes WHERE id=? AND archived=0", (route_id,))
        start, end = day(values, "start_date"), day(values, "end_date")
        if end < start or start < date.today().isoformat():
            abort(400, "Use a future or current start date and an end date on or after it.")
        cursor = g.db.execute("""
            INSERT INTO treks (route_id,staff_id,capacity,start_date,end_date,instructions)
            VALUES (?,?,?,?,?,?)
        """, (route_id, staff_id(values), integer(values, "capacity"), start, end, field(values, "instructions", 4000)))
        touch_catalogue()
        return {"id": cursor.lastrowid}, 201

    def assigned_trek(trek_id):
        trek = get_record(TREK_SELECT + " WHERE t.id=?", (trek_id,))
        if g.user["role"] == "staff" and trek["staff_id"] != g.user["id"]:
            abort(403, "This trek is assigned to another staff member.")
        return trek

    @app.patch("/api/treks/<int:trek_id>")
    @role("admin", "staff")
    def update_trek(trek_id):
        trek = assigned_trek(trek_id)
        values = data()
        status = values.get("status", trek["status"])
        if not isinstance(status, str):
            abort(400, "Invalid trek status.")
        capacity = integer(values, "capacity") if "capacity" in values else trek["capacity"]
        staff = trek["staff_id"]
        if "staff_id" in values:
            if g.user["role"] != "admin":
                abort(403, "Only an admin can assign staff.")
            staff = staff_id(values)
        allowed = STAFF_TRANSITIONS[trek["status"]]
        if g.user["role"] == "admin" and trek["status"] == "Pending":
            allowed = allowed | {"Approved"}
        if trek["status"] == "Completed" or (status != trek["status"] and status not in allowed):
            abort(409, "This trek status change is unavailable.")
        if capacity < trek["booked"]:
            abort(409, "Capacity cannot be lower than existing bookings.")
        if status == "Open" and (staff is None or trek["archived"] or trek["start_date"] < date.today().isoformat()):
            abort(409, "Opening a trek requires an assigned guide, an active route and a current or future date.")
        g.db.execute("UPDATE treks SET status=?, capacity=?, staff_id=? WHERE id=?", (status, capacity, staff, trek_id))
        if status == "Completed":
            g.db.execute("UPDATE treks SET completed_on=? WHERE id=?", (date.today().isoformat(), trek_id))
            g.db.execute("UPDATE bookings SET status='Completed' WHERE trek_id=? AND status='Booked'", (trek_id,))
        touch_catalogue()
        return {}

    @app.get("/api/treks")
    @role("admin", "staff", "trekker")
    def treks():
        if g.user["role"] == "admin":
            return rows(g.db, TREK_SELECT + " ORDER BY t.start_date")
        if g.user["role"] == "staff":
            return rows(g.db, TREK_SELECT + " WHERE t.staff_id=? ORDER BY t.start_date", (g.user["id"],))
        today = date.today().isoformat()
        catalogue = g.db.execute("SELECT namespace,version FROM catalogue_version WHERE id=1").fetchone()
        cache = current_app.extensions["trek_cache"]
        # A database-specific namespace keeps multiple local demos isolated.
        namespace = hashlib.sha256(os.fsencode(Path(db_path).resolve())).hexdigest()[:16]
        key = f"trekking:{namespace}:{catalogue['namespace']}:open:{today}:{catalogue['version']}"
        result = None
        if cache:
            try:
                encoded = cache.get(key)
                result = json.loads(encoded) if encoded else None
            except (RedisError, ValueError):
                pass
        if result is None:
            result = rows(g.db, TREK_SELECT + """
                WHERE t.status='Open' AND r.archived=0 AND t.start_date >= ? ORDER BY t.start_date
            """, (today,))
            if cache:
                try:
                    cache.setex(key, 60, json.dumps(result))
                except RedisError:
                    pass
        difficulty = request.args.get("difficulty", "")
        location = request.args.get("location", "").casefold()
        term = request.args.get("q", "").casefold()
        duration = request.args.get("duration", "")
        return [item for item in result
                if (not difficulty or item["difficulty"] == difficulty)
                and location in item["location"].casefold()
                and term in item["name"].casefold()
                and (not duration or duration == str(item["duration"]))]

    @app.get("/api/treks/<int:trek_id>/participants")
    @role("staff", "admin")
    def participants(trek_id):
        assigned_trek(trek_id)
        return rows(g.db, """
            SELECT b.id,b.status,u.name,u.email FROM bookings b
            JOIN users u ON u.id=b.user_id WHERE b.trek_id=? ORDER BY u.name
        """, (trek_id,))

    @app.patch("/api/treks/<int:trek_id>/participants/<int:booking_id>")
    @role("staff", "admin")
    def manage_participant(trek_id, booking_id):
        trek = assigned_trek(trek_id)
        if trek["status"] == "Completed":
            abort(409, "Completed treks are recorded in history.")
        booking = get_record("SELECT status FROM bookings WHERE id=? AND trek_id=?", (booking_id, trek_id))
        choice(data(), "status", ("Cancelled",))
        if booking["status"] == "Booked":
            g.db.execute("UPDATE bookings SET status='Cancelled' WHERE id=?", (booking_id,))
            touch_catalogue()
        return {}

    @app.post("/api/treks/<int:trek_id>/book")
    @role("trekker")
    def book(trek_id):
        trek = get_record(TREK_SELECT + " WHERE t.id=?", (trek_id,))
        if trek["status"] != "Open" or trek["archived"] or trek["start_date"] < date.today().isoformat():
            abort(409, "This trek is not open for booking.")
        if g.db.execute("SELECT 1 FROM bookings WHERE trek_id=? AND user_id=?", (trek_id, g.user["id"])).fetchone():
            abort(409, "You already have a booking record for this trek.")
        if trek["booked"] >= trek["capacity"]:
            abort(409, "This trek is full.")
        cursor = g.db.execute("INSERT INTO bookings (user_id,trek_id) VALUES (?,?)", (g.user["id"], trek_id))
        touch_catalogue()
        return {"id": cursor.lastrowid}, 201

    @app.get("/api/bookings")
    @role("trekker")
    def history():
        return rows(g.db, BOOKING_SELECT + " WHERE b.user_id=? ORDER BY b.id DESC", (g.user["id"],))

    @app.post("/api/exports")
    @role("trekker")
    def queue_export():
        from jobs import create_celery
        job_id = secrets.token_hex(16)
        with g.db:
            g.db.execute("INSERT INTO exports (id,user_id,status) VALUES (?,?,'Queued')", (job_id, g.user["id"]))
        try:
            create_celery(app.config).send_task("trekking.export", args=[job_id], retry=False)
        except (OperationalError, OSError, RedisError):
            with g.db:
                g.db.execute("UPDATE exports SET status='Failed' WHERE id=?", (job_id,))
            abort(503, "The export queue is unavailable. Try again when Redis is running.")
        return {"id": job_id}, 202

    @app.get("/api/exports")
    @role("trekker")
    def export_list():
        return rows(g.db, "SELECT id,status FROM exports WHERE user_id=? ORDER BY rowid DESC", (g.user["id"],))

    @app.get("/api/exports/<job_id>/csv")
    @role("trekker")
    def download(job_id):
        result = get_record("SELECT csv FROM exports WHERE id=? AND user_id=? AND status='Ready'", (job_id, g.user["id"]))
        return send_file(io.BytesIO(result["csv"].encode()), mimetype="text/csv", as_attachment=True, download_name="trekking-history.csv")

    return app
