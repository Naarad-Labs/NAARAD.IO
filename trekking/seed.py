import json
from contextlib import closing
from datetime import date, timedelta

import click

from app import ROOT, connect


def register_demo_command(app):
    @app.cli.command("seed-demo")
    def seed_demo():
        """Insert three sample routes and one unassigned practice departure."""
        with closing(connect(app.config["DATABASE"])) as db, db:
            db.execute("BEGIN IMMEDIATE")
            routes = json.loads((ROOT / "demo_routes.json").read_text())
            for route in routes:
                db.execute("""
                    INSERT INTO routes (name,location,difficulty,duration)
                    SELECT :name,:location,:difficulty,:duration
                    WHERE NOT EXISTS (SELECT 1 FROM routes WHERE name=:name AND location=:location)
                """, route)
            sample = routes[0]
            route_id = db.execute("SELECT id FROM routes WHERE name=? AND location=? AND archived=0 LIMIT 1",
                                  (sample["name"], sample["location"])).fetchone()
            if route_id and not db.execute("SELECT 1 FROM treks WHERE route_id=?", (route_id[0],)).fetchone():
                start = (date.today() + timedelta(days=1)).isoformat()
                db.execute("""
                    INSERT INTO treks (route_id,capacity,start_date,end_date,instructions)
                    VALUES (?,2,?,?,?)
                """, (route_id[0], start, start, "Demo departure. Meet at the visitor entrance."))
            db.execute("UPDATE catalogue_version SET version=version+1 WHERE id=1")
        click.echo("Demo catalogue loaded.")
