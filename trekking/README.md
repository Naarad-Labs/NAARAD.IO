# Naarad Trekking Management V2

A local web application for the MAD-II trekking brief. Flask serves the API and a Vue dashboard using bundled Bootstrap. SQLite holds users, routes, departures, bookings, and exports. Redis holds expiring catalogue entries and brokers Celery jobs.

The Naarad catalogue supplied three demo route names, locations, and difficulty labels. The one-day durations and sample departure are demo values. Source: [NAARAD.IO route catalogue at the inherited revision](https://github.com/Naarad-Labs/NAARAD.IO/blob/4b568af/content/routes.source.json). Production website code and assets are outside this project folder.

## Start the app

Prerequisites are Python 3.11 or later and a local Redis server. Run these commands from this project folder.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export TREKKING_ADMIN_PASSWORD='replace-with-your-local-password'
export TREKKING_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
flask --app app seed-demo
flask --app app run
```

Open http://127.0.0.1:5000/ and sign in as `admin@localhost` with the password you set. The default database is `instance/trekking.sqlite`. Schema creation and admin setup run automatically. The password variable takes effect when the admin is first created. Save the session secret locally if you want sign-ins to survive a restart.

Start Redis, the worker, and the scheduler in separate terminals. Activate the same virtual environment and start from this folder for both Celery commands. If you set a custom database path or Redis URL, use the same settings in the web and worker terminals.

```sh
redis-server --bind 127.0.0.1
celery -A worker:celery worker --pool solo --loglevel INFO
celery -A worker:celery beat --schedule instance/beat --loglevel INFO
```

Redis defaults to databases 1 for the catalogue cache and 2 for the broker. Set `TREKKING_REDIS_URL` and `TREKKING_BROKER_URL` to override them.

Celery Beat schedules reminders each morning at 08:00 India time and the previous month's HTML report on the first day at 08:30. The default email destination is a local outbox under `instance/mail/`, where messages can be opened as `.eml` files. For delivery, set `TREKKING_SMTP_HOST`, `TREKKING_SMTP_PORT`, `TREKKING_FROM`, and, if needed, `TREKKING_SMTP_USER` and `TREKKING_SMTP_PASSWORD` in the worker environment. SMTP uses STARTTLS.

## Demo

1. As admin, create a staff account and assign it to the seeded Hampi trek. Use the dashboard search to find the route, trek, and staff.
2. As staff, open the departure. Sign out, register a trekker, and find it using the location or difficulty filters. Book a place.
3. In the staff dashboard, open the participant list, mark the departure Started, then Completed. Return to the trekker dashboard and check the booking history.
4. Click Export CSV. The worker prepares the file and the dashboard announces when it is ready. Download the file.
5. For a mail demonstration, use a separate terminal with the worker environment and run either task on demand. The reminder includes open or closed departures beginning within two days, and the monthly report covers treks completed in the previous calendar month.

```sh
celery -A worker:celery call trekking.reminders
celery -A worker:celery call trekking.monthly
```

Run the role and booking integration test with `python -m unittest discover -s tests`.

## Data and API

One route has many scheduled treks. Each trek can have one assigned staff account and many bookings. Each trekker can have one booking record per departure and many export jobs. Archived routes and cancelled bookings remain visible in historical records.

| Resource | Endpoints |
| --- | --- |
| Session and profile | `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET/PATCH /api/me` |
| Admin | `GET /api/admin`, `POST /api/staff`, `PATCH /api/users/:id` |
| Routes | `POST /api/routes`, `PATCH/DELETE /api/routes/:id` |
| Treks | `GET/POST /api/treks`, `PATCH /api/treks/:id` |
| Participants | `GET /api/treks/:id/participants`, `PATCH /api/treks/:id/participants/:booking_id` |
| Bookings | `POST /api/treks/:id/book`, `GET /api/bookings` |
| Exports | `GET/POST /api/exports`, `GET /api/exports/:id/csv` |

## Provenance

This application was implemented with Codex assistance. The inherited Naarad commits predate the MAD-II application. Describe the extent of AI assistance and prior work in the course report.

## Run the complete Naarad website with booking

Use the full Naarad checkout containing this folder. The combined application
serves the site's pre-rendered pages and existing assets at their normal URLs.
The booking dashboard, its API and its cookie are scoped to `/trekking/`.
My Journey shows a **Trek bookings** button when the booking service responds.

From this folder, with the local environment and Redis configured as above:

```sh
python -m pip install -r requirements-site.txt
gunicorn --no-control-socket --bind 127.0.0.1:8000 'naarad_site:create_site()'
```

Open http://127.0.0.1:8000/journey/ and use **Trek bookings**. The Celery worker
and Beat commands above also apply to the combined site. The standalone source
ZIP includes the booking app for the course demo and can run with Flask alone.

For a public deployment, point the HTTPS proxy for `naarad.io` at the combined
WSGI server. Keep Gunicorn on loopback or a private network, set
`TREKKING_HTTPS=1` and a stable `TREKKING_SECRET_KEY` on the web process, and
put `TREKKING_DATABASE` on a persistent writable volume shared with the worker.
Run one Beat instance and use a private Redis endpoint. Use a fresh database for
public bookings and configure SMTP before enabling real notification delivery.

GitHub Pages cannot run the WSGI application or workers. Verify the combined
site on the destination server before switching domain routing.
