CREATE TABLE active (slot INTEGER PRIMARY KEY CHECK(slot=1), revision TEXT NOT NULL, snapshot TEXT NOT NULL, snapshot_hash TEXT NOT NULL, operation_id TEXT NOT NULL);
CREATE TABLE operations (operation_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('committed','aborted')), revision TEXT);
CREATE TABLE recoveries (recovery_key TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
CREATE TABLE previous (slot INTEGER PRIMARY KEY CHECK(slot=1), snapshot TEXT NOT NULL);
PRAGMA user_version=1;
