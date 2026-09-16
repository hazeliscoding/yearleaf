//! Database bootstrap: connection configuration and versioned migrations.
//!
//! Implements the persistence design record (docs/design-sqlite-persistence.md):
//! forward-only migrations tracked in SQLite's `user_version` header, WAL with
//! `synchronous=NORMAL`, and a timestamped file copy before any migration of an
//! existing database.

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Schema v1 (subset): desks and their freely positioned objects, as required
/// by the `DeskPersistence` contract. Further entities (event, attachment,
/// tag, setting) land as later migrations alongside their features.
const MIGRATION_1: &str = "
CREATE TABLE desk (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE calendar_object (
  id         TEXT PRIMARY KEY,
  desk_id    TEXT NOT NULL REFERENCES desk(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  x          REAL NOT NULL,
  y          REAL NOT NULL,
  width      REAL NOT NULL,
  height     REAL NOT NULL,
  rotation   REAL NOT NULL DEFAULT 0,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_calendar_object_desk ON calendar_object(desk_id);
";

/// The schema version this binary expects; equals the migration count below.
const SCHEMA_VERSION: i32 = 1;

/// The ordered, forward-only migration list. Append; never edit a shipped step.
pub fn migrations() -> Migrations<'static> {
  Migrations::new(vec![M::up(MIGRATION_1)])
}

/// Applies the connection pragmas required by the design record.
fn configure(conn: &Connection) -> rusqlite::Result<()> {
  conn.pragma_update(None, "journal_mode", "WAL")?;
  conn.pragma_update(None, "synchronous", "NORMAL")?;
  conn.pragma_update(None, "foreign_keys", "ON")?;
  conn.busy_timeout(Duration::from_millis(5000))?;
  Ok(())
}

/// Opens (creating if absent) the desk database, configures it, and migrates
/// it to the latest schema. A database that is behind is copied to a
/// `*.pre-vN.db` sibling first; one that is ahead of this binary fails to open
/// rather than risking newer data.
pub fn open(path: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
  let mut conn = Connection::open(path)?;
  configure(&conn)?;

  let current: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
  if current > 0 && current < SCHEMA_VERSION {
    let backup = path.with_extension(format!("pre-v{SCHEMA_VERSION}.db"));
    std::fs::copy(path, backup)?;
  }

  migrations().to_latest(&mut conn)?;
  Ok(conn)
}

#[cfg(test)]
pub mod tests {
  use super::*;

  /// Opens an in-memory database migrated to the latest schema.
  pub fn open_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("open in-memory db");
    conn.pragma_update(None, "foreign_keys", "ON").expect("enable foreign keys");
    migrations().to_latest(&mut conn).expect("migrate");
    conn
  }

  #[test]
  fn migrations_are_valid() {
    migrations().validate().expect("migration list must validate");
  }

  #[test]
  fn schema_v1_creates_expected_objects() {
    let conn = open_test_db();
    let mut stmt = conn
      .prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .expect("prepare schema query");
    let names: Vec<String> = stmt
      .query_map([], |row| row.get(0))
      .expect("query schema")
      .collect::<Result<_, _>>()
      .expect("collect names");
    assert_eq!(names, vec!["calendar_object", "desk", "idx_calendar_object_desk"]);
  }
}
