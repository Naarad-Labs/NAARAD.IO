import csv
import html
import io
import os
import smtplib
import ssl
from contextlib import closing
from datetime import date, timedelta
from email.message import EmailMessage
from pathlib import Path

from celery import Celery
from celery.schedules import crontab

from app import BOOKING_SELECT, connect


def send_email(recipient, subject, body, message_key, html_body=None):
    message = EmailMessage()
    message["From"] = os.getenv("TREKKING_FROM", "trekking@localhost")
    message["To"] = recipient
    message["Subject"] = subject
    message["Message-ID"] = f"<{message_key}@trekking.local>"
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    host = os.getenv("TREKKING_SMTP_HOST")
    if host:
        with smtplib.SMTP(host, int(os.getenv("TREKKING_SMTP_PORT", "587")), timeout=10) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            username = os.getenv("TREKKING_SMTP_USER")
            if username:
                smtp.login(username, os.environ["TREKKING_SMTP_PASSWORD"])
            smtp.send_message(message)
    else:
        outbox = Path(os.getenv("TREKKING_OUTBOX", Path(__file__).resolve().parent / "instance" / "mail"))
        outbox.mkdir(parents=True, exist_ok=True)
        (outbox / f"{message_key}.eml").write_bytes(message.as_bytes())


def export_cell(value):
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def create_celery(config):
    database = config["DATABASE"]
    celery = Celery("trekking", broker=config["BROKER_URL"])
    celery.conf.update(
        task_ignore_result=True,
        broker_connection_timeout=2,
        timezone="Asia/Kolkata",
        beat_schedule={
            "daily-trek-reminders": {"task": "trekking.reminders", "schedule": crontab(hour=8, minute=0)},
            "monthly-trek-report": {"task": "trekking.monthly", "schedule": crontab(day_of_month=1, hour=8, minute=30)},
        },
    )

    @celery.task(name="trekking.export")
    def export(job_id):
        with closing(connect(database)) as db, db:
            job = db.execute("SELECT user_id,status FROM exports WHERE id=?", (job_id,)).fetchone()
            if not job or job["status"] != "Queued":
                return
            try:
                output = io.StringIO(newline="")
                writer = csv.writer(output)
                writer.writerow(("User ID", "Trek Name", "Location", "Booking Status", "Booked At", "Start Date", "End Date"))
                bookings = db.execute(BOOKING_SELECT + " WHERE b.user_id=? ORDER BY b.id DESC", (job["user_id"],))
                for booking in bookings:
                    writer.writerow(export_cell(booking[key]) for key in
                                    ("user_id", "name", "location", "status", "booked_at", "start_date", "end_date"))
                db.execute("UPDATE exports SET status='Ready',csv=? WHERE id=?", (output.getvalue(), job_id))
            except Exception:
                db.execute("UPDATE exports SET status='Failed' WHERE id=?", (job_id,))
                db.commit()
                raise

    @celery.task(name="trekking.reminders")
    def reminders():
        today = date.today()
        with closing(connect(database)) as db:
            upcoming = db.execute("""
                SELECT b.id,u.email,r.name,t.start_date,t.instructions FROM bookings b
                JOIN users u ON u.id=b.user_id JOIN treks t ON t.id=b.trek_id
                JOIN routes r ON r.id=t.route_id
                WHERE b.status='Booked' AND u.status='active' AND r.archived=0
                AND t.status IN ('Open','Closed') AND t.start_date BETWEEN ? AND ?
            """, (today.isoformat(), (today + timedelta(days=2)).isoformat())).fetchall()
        for trek in upcoming:
            send_email(trek["email"], "Upcoming trek reminder",
                       f'{trek["name"]} starts on {trek["start_date"]}.\n\n{trek["instructions"]}',
                       f'reminder-{today}-{trek["id"]}')
        return len(upcoming)

    @celery.task(name="trekking.monthly")
    def monthly():
        end = date.today().replace(day=1)
        start = (end - timedelta(days=1)).replace(day=1)
        with closing(connect(database)) as db:
            treks = db.execute("""
                SELECT t.id,r.name,b.user_id FROM treks t JOIN routes r ON r.id=t.route_id
                LEFT JOIN bookings b ON b.trek_id=t.id AND b.status='Completed'
                WHERE t.status='Completed' AND t.completed_on >= ? AND t.completed_on < ?
            """, (start.isoformat(), end.isoformat())).fetchall()
            admin_email = db.execute("SELECT email FROM users WHERE role='admin'").fetchone()[0]
        count = len({row["id"] for row in treks})
        participants = len({row["user_id"] for row in treks if row["user_id"] is not None})
        popularity = {}
        for trek in treks:
            name = trek["name"]
            popularity[name] = popularity.get(name, 0) + int(trek["user_id"] is not None)
        ranking = sorted(popularity.items(), key=lambda item: (-item[1], item[0]))[:5]
        popular = "".join(f"<li>{html.escape(name)} ({total})</li>" for name, total in ranking)
        summary = f"Treks conducted: {count}. Unique participants: {participants}."
        body = f"<h1>Trekking activity for {start:%B %Y}</h1><p>{summary}</p><h2>Popular treks</h2><ol>{popular}</ol>"
        send_email(admin_email, f"Trekking activity for {start:%B %Y}", summary, f"monthly-{start}", body)

    return celery
