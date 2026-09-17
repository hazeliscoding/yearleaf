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

/// Events and their recurrence, per docs/design-recurrence.md.
///
/// A series is stored once. Its occurrences are computed for the visible
/// window and only become rows when the user touches one, so a weekly seminar
/// costs one row rather than one per week.
///
/// An `event` row is either a plain event (`series_id` and `occurrence_date`
/// both null) or a materialised occurrence overriding one date of a series
/// (both set). `deleted` marks a suppressed occurrence — RFC 5545's EXDATE
/// expressed through the same mechanism as an override, so expansion has one
/// rule to apply rather than two.
const MIGRATION_2: &str = "
CREATE TABLE event (
  id              TEXT PRIMARY KEY REFERENCES calendar_object(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  time_label      TEXT,
  all_day         INTEGER NOT NULL DEFAULT 1,
  variant         TEXT NOT NULL DEFAULT 'timed',
  color           TEXT NOT NULL DEFAULT 'blue',
  reminder_at     TEXT,
  series_id       TEXT REFERENCES event(id) ON DELETE CASCADE,
  occurrence_date TEXT,
  deleted         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- An override needs both halves of its key, a plain event neither.
  CHECK ((series_id IS NULL) = (occurrence_date IS NULL))
) STRICT;

-- One override per date, enforced by the database rather than by convention.
CREATE UNIQUE INDEX idx_event_occurrence ON event(series_id, occurrence_date)
  WHERE series_id IS NOT NULL;

CREATE TABLE recurrence_rule (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL UNIQUE REFERENCES event(id) ON DELETE CASCADE,
  rrule      TEXT NOT NULL,
  dtstart    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
";

/// Whether an event owns its position.
///
/// The design record's rule is that an occurrence derives its position from
/// its date until the user moves it. `calendar_object` always carries x/y, so
/// the event needs to say which of the two it means: while `placed` is 0 the
/// stored geometry is ignored and the event draws in its day cell.
///
/// A separate step rather than an edit to migration 2: that migration has
/// already run against working databases, and the discipline that keeps
/// upgrades predictable is worth more than a tidier history.
const MIGRATION_3: &str = "
ALTER TABLE event ADD COLUMN placed INTEGER NOT NULL DEFAULT 0;
";

/// The schema version this binary expects; equals the migration count below.
const SCHEMA_VERSION: i32 = 3;

/// The ordered, forward-only migration list. Append; never edit a shipped step.
pub fn migrations() -> Migrations<'static> {
  Migrations::new(vec![M::up(MIGRATION_1), M::up(MIGRATION_2), M::up(MIGRATION_3)])
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
  open_with(path, migrations(), SCHEMA_VERSION)
}

/// [`open`] with the migration list and target version as parameters, so
/// tests can exercise the backup and version-guard branches with a schema
/// history longer than the shipped one.
fn open_with(
  path: &Path,
  migrations: Migrations<'static>,
  target: i32,
) -> Result<Connection, Box<dyn std::error::Error>> {
  let mut conn = Connection::open(path)?;
  configure(&conn)?;

  let current: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
  if current > target {
    return Err(
      format!(
        "this desk was last saved by a newer Yearleaf (schema v{current}, this app reads v{target}); update the app to open it"
      )
      .into(),
    );
  }
  if current > 0 && current < target {
    let backup = path.with_extension(format!("pre-v{target}.db"));
    std::fs::copy(path, backup)?;
  }

  migrations.to_latest(&mut conn)?;
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

  /// Unique temp-file path for on-disk open() tests.
  fn temp_db_path(tag: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("yearleaf-db-test-{}-{tag}.db", std::process::id()))
  }

  /// The shipped history plus one hypothetical step, so a database created by
  /// this binary is genuinely *behind* and the backup branch is reachable.
  fn next_version_migrations() -> Migrations<'static> {
    Migrations::new(vec![
      M::up(MIGRATION_1),
      M::up(MIGRATION_2),
      M::up(MIGRATION_3),
      M::up("CREATE TABLE extra (id TEXT PRIMARY KEY) STRICT;"),
    ])
  }

  #[test]
  fn migrations_are_valid() {
    migrations().validate().expect("migration list must validate");
  }

  #[test]
  fn open_enables_wal_and_foreign_keys() {
    let path = temp_db_path("pragmas");
    let conn = open(&path).expect("open");
    let journal: String = conn
      .pragma_query_value(None, "journal_mode", |row| row.get(0))
      .expect("journal_mode");
    let foreign_keys: i32 = conn
      .pragma_query_value(None, "foreign_keys", |row| row.get(0))
      .expect("foreign_keys");
    assert_eq!(journal.to_lowercase(), "wal");
    assert_eq!(foreign_keys, 1);
    drop(conn);
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn open_refuses_a_database_newer_than_the_binary() {
    let path = temp_db_path("newer");
    {
      let conn = Connection::open(&path).expect("create");
      conn.pragma_update(None, "user_version", 99).expect("set version");
    }
    let error = open(&path).expect_err("must refuse a newer schema");
    assert!(error.to_string().contains("newer Yearleaf"), "unhelpful error: {error}");
    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn open_backs_up_an_older_database_before_migrating() {
    let path = temp_db_path("backup");
    open(&path).expect("create at the shipped version");

    let next = SCHEMA_VERSION + 1;
    let backup = path.with_extension(format!("pre-v{next}.db"));
    let conn = open_with(&path, next_version_migrations(), next).expect("migrate forward");
    let version: i32 = conn
      .pragma_query_value(None, "user_version", |row| row.get(0))
      .expect("user_version");
    assert_eq!(version, next);
    assert!(backup.exists(), "expected pre-migration copy at {}", backup.display());
    drop(conn);
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(&backup);
  }

  #[test]
  fn an_existing_v1_desk_upgrades_to_v2_keeping_its_objects() {
    let path = temp_db_path("upgrade");
    let _ = std::fs::remove_file(&path);
    // A desk saved by the milestone-3 build: migration 1 only.
    {
      let mut conn = Connection::open(&path).expect("create");
      Migrations::new(vec![M::up(MIGRATION_1)]).to_latest(&mut conn).expect("v1");
      conn
        .execute("INSERT INTO desk (id, name) VALUES ('default', 'Desk')", [])
        .expect("desk");
      conn
        .execute(
          "INSERT INTO calendar_object (id, desk_id, kind, x, y, width, height, payload)
           VALUES ('s1', 'default', 'sticky', 10, 20, 260, 180, '{\"kind\":\"sticky\"}')",
          [],
        )
        .expect("object");
    }

    let conn = open(&path).expect("upgrade");
    let version: i32 = conn
      .pragma_query_value(None, "user_version", |row| row.get(0))
      .expect("user_version");
    let kept: i64 = conn
      .query_row("SELECT count(*) FROM calendar_object", [], |row| row.get(0))
      .expect("count objects");
    let events: i64 = conn
      .query_row("SELECT count(*) FROM event", [], |row| row.get(0))
      .expect("event table exists");

    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(kept, 1, "the user's objects must survive the upgrade");
    assert_eq!(events, 0);
    let backup = path.with_extension(format!("pre-v{SCHEMA_VERSION}.db"));
    assert!(backup.exists(), "expected a pre-migration copy");

    drop(conn);
    let _ = std::fs::remove_file(&path);
    let _ = std::fs::remove_file(&backup);
  }

  #[test]
  fn schema_creates_expected_objects() {
    let conn = open_test_db();
    let mut stmt = conn
      .prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .expect("prepare schema query");
    let names: Vec<String> = stmt
      .query_map([], |row| row.get(0))
      .expect("query schema")
      .collect::<Result<_, _>>()
      .expect("collect names");
    assert_eq!(
      names,
      vec![
        "calendar_object",
        "desk",
        "event",
        "idx_calendar_object_desk",
        "idx_event_occurrence",
        "recurrence_rule",
      ]
    );
  }

  /// Seeds a desk, a calendar object and the event row that extends it.
  fn seed_event(conn: &Connection, id: &str, series: Option<(&str, &str)>) -> rusqlite::Result<()> {
    conn.execute("INSERT OR IGNORE INTO desk (id, name) VALUES ('d', 'd')", [])?;
    conn.execute(
      "INSERT INTO calendar_object (id, desk_id, kind, x, y, width, height, payload)
       VALUES (?1, 'd', 'event', 0, 0, 100, 20, '{\"kind\":\"event\"}')",
      [id],
    )?;
    match series {
      Some((series_id, date)) => conn.execute(
        "INSERT INTO event (id, title, series_id, occurrence_date) VALUES (?1, 'x', ?2, ?3)",
        [id, series_id, date],
      )?,
      None => conn.execute("INSERT INTO event (id, title) VALUES (?1, 'x')", [id])?,
    };
    Ok(())
  }

  #[test]
  fn an_override_needs_both_halves_of_its_key() {
    let conn = open_test_db();
    seed_event(&conn, "plain", None).expect("plain event");
    conn
      .execute(
        "INSERT INTO calendar_object (id, desk_id, kind, x, y, width, height, payload)
         VALUES ('half', 'd', 'event', 0, 0, 100, 20, '{}')",
        [],
      )
      .expect("object");
    // A series id without the date it overrides is meaningless.
    let error = conn.execute(
      "INSERT INTO event (id, title, series_id) VALUES ('half', 'x', 'plain')",
      [],
    );
    assert!(error.is_err(), "half an override key must be refused");
  }

  #[test]
  fn a_date_can_only_be_overridden_once() {
    let conn = open_test_db();
    seed_event(&conn, "series", None).expect("series");
    seed_event(&conn, "first", Some(("series", "2026-09-01"))).expect("first override");

    let error = seed_event(&conn, "second", Some(("series", "2026-09-01")));
    assert!(error.is_err(), "two overrides for one date must be refused");
  }

  #[test]
  fn deleting_a_series_takes_its_overrides_and_rule_with_it() {
    let conn = open_test_db();
    seed_event(&conn, "series", None).expect("series");
    seed_event(&conn, "override", Some(("series", "2026-09-08"))).expect("override");
    conn
      .execute(
        "INSERT INTO recurrence_rule (id, event_id, rrule, dtstart)
         VALUES ('r', 'series', 'FREQ=WEEKLY;BYDAY=TU', '2026-09-01')",
        [],
      )
      .expect("rule");

    // Deleting the object cascades to the event, which cascades onward.
    conn
      .execute("DELETE FROM calendar_object WHERE id = 'series'", [])
      .expect("delete series");

    let events: i64 = conn
      .query_row("SELECT count(*) FROM event", [], |row| row.get(0))
      .expect("count events");
    let rules: i64 = conn
      .query_row("SELECT count(*) FROM recurrence_rule", [], |row| row.get(0))
      .expect("count rules");
    assert_eq!(events, 0);
    assert_eq!(rules, 0);
  }
}
