CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'trekker')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'blacklisted'))
);
CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON users(role) WHERE role = 'admin';
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Moderate', 'Hard')),
    duration INTEGER NOT NULL CHECK (duration > 0),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);
CREATE TABLE IF NOT EXISTS treks (
    id INTEGER PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id),
    staff_id INTEGER REFERENCES users(id),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL CHECK (end_date >= start_date),
    instructions TEXT NOT NULL,
    completed_on TEXT,
    status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Open', 'Closed', 'Started', 'Completed'))
);
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    trek_id INTEGER NOT NULL REFERENCES treks(id),
    booked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'Booked' CHECK (status IN ('Booked', 'Cancelled', 'Completed')),
    UNIQUE (user_id, trek_id)
);
CREATE INDEX IF NOT EXISTS booking_trek ON bookings(trek_id, status);
CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('Queued', 'Ready', 'Failed')),
    csv TEXT
);
CREATE TABLE IF NOT EXISTS catalogue_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    namespace TEXT NOT NULL DEFAULT (lower(hex(randomblob(8)))),
    version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO catalogue_version (id) VALUES (1);
