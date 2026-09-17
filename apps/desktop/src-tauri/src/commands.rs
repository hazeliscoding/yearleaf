//! The persistence IPC boundary: typed Tauri commands mirroring the
//! `DeskPersistence` contract from `@infinite-desk/persistence`.
//!
//! No SQL crosses IPC — the webview invokes these named commands with typed,
//! serde-validated payloads, and every statement below is parameterized.
//! Called at gesture-commit frequency (never per pointer move), so a single
//! mutex-guarded connection is sufficient and keeps writes strictly ordered.

use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

/// Managed state holding the one writable connection to the desk database.
pub struct Db(pub Mutex<Connection>);

/// Managed state holding the directory imported binaries are copied into.
pub struct AssetRoot(pub std::path::PathBuf);

/// Wire shape of a desk object; mirrors `DeskObject` in the domain package.
/// The payload stays opaque JSON here — the TypeScript domain validates it.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeskObjectRecord {
  pub id: String,
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
  pub rotation: f64,
  pub payload: Value,
}

/// Wire shape of a loaded desk; mirrors `DeskSnapshot` in the persistence package.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeskSnapshot {
  pub desk_id: String,
  pub name: String,
  pub objects: Vec<DeskObjectRecord>,
}

fn load_desk_impl(conn: &Connection, desk_id: &str) -> rusqlite::Result<Option<DeskSnapshot>> {
  let name: Option<String> = conn
    .query_row("SELECT name FROM desk WHERE id = ?1", [desk_id], |row| row.get(0))
    .optional()?;
  let Some(name) = name else { return Ok(None) };

  let mut stmt = conn.prepare(
    // Events are objects too, but they carry their own typed row and load
    // through load_events; returning them here would draw them twice.
    "SELECT id, x, y, width, height, rotation, payload
     FROM calendar_object WHERE desk_id = ?1 AND kind <> 'event' ORDER BY rowid",
  )?;
  let objects = stmt
    .query_map([desk_id], |row| {
      let payload: String = row.get(6)?;
      Ok(DeskObjectRecord {
        id: row.get(0)?,
        x: row.get(1)?,
        y: row.get(2)?,
        width: row.get(3)?,
        height: row.get(4)?,
        rotation: row.get(5)?,
        payload: serde_json::from_str(&payload).map_err(|e| {
          rusqlite::Error::FromSqlConversionFailure(6, rusqlite::types::Type::Text, Box::new(e))
        })?,
      })
    })?
    .collect::<rusqlite::Result<Vec<_>>>()?;

  Ok(Some(DeskSnapshot { desk_id: desk_id.to_owned(), name, objects }))
}

fn save_object_impl(
  conn: &mut Connection,
  desk_id: &str,
  object: &DeskObjectRecord,
) -> Result<(), String> {
  let kind = object
    .payload
    .get("kind")
    .and_then(Value::as_str)
    .ok_or("object payload has no 'kind' discriminator")?
    .to_owned();
  let payload = serde_json::to_string(&object.payload).map_err(|e| e.to_string())?;

  let tx = conn.transaction().map_err(|e| e.to_string())?;
  // Saving into a desk that does not exist yet creates it, matching the
  // InMemoryDeskPersistence contract (name defaults to the id until desk
  // management UI exists).
  tx.execute(
    "INSERT INTO desk (id, name) VALUES (?1, ?1) ON CONFLICT(id) DO NOTHING",
    [desk_id],
  )
  .map_err(|e| e.to_string())?;
  tx.execute(
    "INSERT INTO calendar_object (id, desk_id, kind, x, y, width, height, rotation, payload)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(id) DO UPDATE SET
       desk_id = excluded.desk_id,
       kind = excluded.kind,
       x = excluded.x,
       y = excluded.y,
       width = excluded.width,
       height = excluded.height,
       rotation = excluded.rotation,
       payload = excluded.payload,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    rusqlite::params![
      object.id, desk_id, kind, object.x, object.y, object.width, object.height,
      object.rotation, payload,
    ],
  )
  .map_err(|e| e.to_string())?;
  tx.commit().map_err(|e| e.to_string())
}

fn delete_object_impl(conn: &Connection, desk_id: &str, object_id: &str) -> rusqlite::Result<()> {
  conn.execute(
    "DELETE FROM calendar_object WHERE desk_id = ?1 AND id = ?2",
    [desk_id, object_id],
  )?;
  Ok(())
}

/// Wire shape of an event; mirrors `EventRecord` in the domain package.
///
/// Geometry rides along because an event is a `calendar_object` too, but it is
/// only meaningful while `placed` is true — otherwise the event draws in the
/// day cell its `date` names.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventRecord {
  pub id: String,
  pub title: String,
  pub time_label: Option<String>,
  pub color: String,
  pub variant: Option<String>,
  /// Floating calendar date, `YYYY-MM-DD`. For a series this is the anchor.
  pub date: String,
  /// `RRULE` body when this event heads a series.
  pub rrule: Option<String>,
  /// The series this row overrides, set together with `occurrence_date`.
  pub series_id: Option<String>,
  pub occurrence_date: Option<String>,
  /// Suppresses the occurrence rather than replacing it.
  #[serde(default)]
  pub deleted: bool,
  /// `true` once the user has moved the event off its day cell.
  #[serde(default)]
  pub placed: bool,
  #[serde(default)]
  pub x: f64,
  #[serde(default)]
  pub y: f64,
  pub width: f64,
  pub height: f64,
  #[serde(default)]
  pub rotation: f64,
}

fn load_events_impl(conn: &Connection, desk_id: &str) -> rusqlite::Result<Vec<EventRecord>> {
  let mut stmt = conn.prepare(
    "SELECT e.id, e.title, e.time_label, e.color, e.variant, e.series_id,
            e.occurrence_date, e.deleted, e.placed,
            o.x, o.y, o.width, o.height, o.rotation,
            r.rrule, r.dtstart
     FROM event e
     JOIN calendar_object o ON o.id = e.id
     LEFT JOIN recurrence_rule r ON r.event_id = e.id
     WHERE o.desk_id = ?1
     ORDER BY o.rowid",
  )?;
  let events = stmt
    .query_map([desk_id], |row| {
      // A series anchors on its rule's dtstart; everything else on the date
      // its object was filed under.
      let dtstart: Option<String> = row.get(15)?;
      let occurrence_date: Option<String> = row.get(6)?;
      Ok(EventRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        time_label: row.get(2)?,
        color: row.get(3)?,
        variant: row.get(4)?,
        date: dtstart
          .clone()
          .or_else(|| occurrence_date.clone())
          .unwrap_or_default(),
        rrule: row.get(14)?,
        series_id: row.get(5)?,
        occurrence_date,
        deleted: row.get::<_, i64>(7)? != 0,
        placed: row.get::<_, i64>(8)? != 0,
        x: row.get(9)?,
        y: row.get(10)?,
        width: row.get(11)?,
        height: row.get(12)?,
        rotation: row.get(13)?,
      })
    })?
    .collect();
  events
}

fn save_event_impl(conn: &mut Connection, desk_id: &str, event: &EventRecord) -> Result<(), String> {
  if event.series_id.is_some() != event.occurrence_date.is_some() {
    return Err("an override needs both a series and the date it overrides".into());
  }
  // Date the object is filed under: an override belongs to the date it
  // replaces, a plain event or series anchor to its own date.
  let filed_on = event.occurrence_date.clone().unwrap_or_else(|| event.date.clone());

  let tx = conn.transaction().map_err(|e| e.to_string())?;
  tx.execute(
    "INSERT INTO desk (id, name) VALUES (?1, ?1) ON CONFLICT(id) DO NOTHING",
    [desk_id],
  )
  .map_err(|e| e.to_string())?;
  tx.execute(
    "INSERT INTO calendar_object (id, desk_id, kind, x, y, width, height, rotation, payload)
     VALUES (?1, ?2, 'event', ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(id) DO UPDATE SET
       x = excluded.x, y = excluded.y, width = excluded.width,
       height = excluded.height, rotation = excluded.rotation,
       payload = excluded.payload,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    rusqlite::params![
      event.id,
      desk_id,
      event.x,
      event.y,
      event.width,
      event.height,
      event.rotation,
      format!("{{\"kind\":\"event\",\"date\":\"{filed_on}\"}}"),
    ],
  )
  .map_err(|e| e.to_string())?;
  tx.execute(
    "INSERT INTO event (id, title, time_label, color, variant, series_id,
                        occurrence_date, deleted, placed)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, time_label = excluded.time_label,
       color = excluded.color, variant = excluded.variant,
       series_id = excluded.series_id, occurrence_date = excluded.occurrence_date,
       deleted = excluded.deleted, placed = excluded.placed,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
    rusqlite::params![
      event.id,
      event.title,
      event.time_label,
      event.color,
      // The column defaults to 'timed', but an explicit NULL would defeat it.
      event.variant.as_deref().unwrap_or("timed"),
      event.series_id,
      event.occurrence_date,
      event.deleted as i64,
      event.placed as i64,
    ],
  )
  .map_err(|e| e.to_string())?;

  match &event.rrule {
    Some(rrule) => tx
      .execute(
        "INSERT INTO recurrence_rule (id, event_id, rrule, dtstart) VALUES (?1, ?1, ?2, ?3)
         ON CONFLICT(event_id) DO UPDATE SET rrule = excluded.rrule, dtstart = excluded.dtstart",
        rusqlite::params![event.id, rrule, event.date],
      )
      .map_err(|e| e.to_string())?,
    // Clearing a rule turns a series back into a single event.
    None => tx
      .execute("DELETE FROM recurrence_rule WHERE event_id = ?1", [&event.id])
      .map_err(|e| e.to_string())?,
  };

  tx.commit().map_err(|e| e.to_string())
}

fn delete_event_impl(conn: &Connection, desk_id: &str, event_id: &str) -> rusqlite::Result<()> {
  // The event row and any rule or overrides cascade from the object.
  conn.execute(
    "DELETE FROM calendar_object WHERE desk_id = ?1 AND id = ?2",
    [desk_id, event_id],
  )?;
  Ok(())
}

/// Loads every stored event on the desk; occurrences are expanded client-side.
#[tauri::command]
pub async fn load_events(db: State<'_, Db>, desk_id: String) -> Result<Vec<EventRecord>, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  load_events_impl(&conn, &desk_id).map_err(|e| e.to_string())
}

/// Creates or replaces one event, its object row, and its recurrence rule.
#[tauri::command]
pub async fn save_event(
  db: State<'_, Db>,
  desk_id: String,
  event: EventRecord,
) -> Result<(), String> {
  let mut conn = db.0.lock().map_err(|e| e.to_string())?;
  save_event_impl(&mut conn, &desk_id, &event)
}

/// Removes one event; a series takes its rule and overrides with it.
#[tauri::command]
pub async fn delete_event(
  db: State<'_, Db>,
  desk_id: String,
  event_id: String,
) -> Result<(), String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  delete_event_impl(&conn, &desk_id, &event_id).map_err(|e| e.to_string())
}

/// An imported binary, as the application sees it.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentRecord {
  pub id: String,
  pub file_name: String,
  /// Path relative to the desk directory, for export and future sync.
  pub relative_path: String,
  pub media_type: String,
  pub byte_size: i64,
  pub checksum: String,
  /// Absolute path, which the webview turns into an asset URL to display.
  pub path: String,
}

/// Largest file the importer accepts. A desk holds snapshots and scans, not
/// camera originals, and refusing early beats copying a hundred megabytes into
/// the desk directory before anything can look at it.
const MAX_ATTACHMENT_BYTES: usize = 32 * 1024 * 1024;

/// Reads one of the headers carrying an import's metadata beside its bytes.
fn required_header<'a>(request: &'a tauri::ipc::Request<'_>, name: &str) -> Result<&'a str, String> {
  request
    .headers()
    .get(name)
    .and_then(|value| value.to_str().ok())
    .ok_or_else(|| format!("import_attachment is missing the {name} header"))
}

/// Undoes the percent-encoding the webview applies so a file name with
/// accents or CJK characters survives a header, which may only carry ASCII.
fn decoded_file_name(raw: &str) -> Result<String, String> {
  percent_encoding::percent_decode_str(raw)
    .decode_utf8()
    .map(|name| name.into_owned())
    .map_err(|_| "attachment file name is not valid UTF-8".to_owned())
}

/// Lowercase hex SHA-256 of the given bytes.
fn checksum_of(bytes: &[u8]) -> String {
  use sha2::{Digest, Sha256};
  let mut hasher = Sha256::new();
  hasher.update(bytes);
  hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

/// Lowercase extension of a file name, or `"bin"` when it has none.
fn extension_of(file_name: &str) -> String {
  std::path::Path::new(file_name)
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| e.to_ascii_lowercase())
    .filter(|e| e.chars().all(|c| c.is_ascii_alphanumeric()) && !e.is_empty())
    .unwrap_or_else(|| "bin".to_owned())
}

fn import_attachment_impl(
  conn: &Connection,
  assets: &std::path::Path,
  desk_id: &str,
  file_name: &str,
  media_type: &str,
  bytes: &[u8],
) -> Result<AttachmentRecord, String> {
  if bytes.is_empty() {
    return Err("refusing to import an empty file".into());
  }
  if bytes.len() > MAX_ATTACHMENT_BYTES {
    return Err(format!(
      "refusing to import {} MB; the limit is {} MB",
      bytes.len() / (1024 * 1024),
      MAX_ATTACHMENT_BYTES / (1024 * 1024)
    ));
  }
  // The only importer today is the picture drop, which filters by type in the
  // webview. Checking again here keeps the rule on the trusted side of the
  // boundary, and before anything is written.
  if !media_type.starts_with("image/") {
    return Err(format!("unsupported attachment type {media_type}"));
  }
  let checksum = checksum_of(bytes);
  let stored_name = format!("{checksum}.{}", extension_of(file_name));
  let relative_path = format!("assets/{stored_name}");
  let absolute = assets.join(&stored_name);

  // The checksum is the filename, so re-importing the same picture reuses the
  // copy already on disk rather than writing it again.
  if !absolute.exists() {
    std::fs::create_dir_all(assets).map_err(|e| e.to_string())?;
    std::fs::write(&absolute, bytes).map_err(|e| e.to_string())?;
  }

  conn
    .execute(
      "INSERT OR IGNORE INTO desk (id, name) VALUES (?1, ?1)",
      [desk_id],
    )
    .map_err(|e| e.to_string())?;

  let existing: Option<String> = conn
    .query_row(
      "SELECT id FROM attachment WHERE desk_id = ?1 AND checksum = ?2",
      [desk_id, checksum.as_str()],
      |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())?;

  let id = match existing {
    Some(id) => id,
    None => {
      // Scoped to the desk, because the uniqueness it stands for is. Deriving
      // the id from the checksum alone collides the moment a second desk
      // imports the same picture, since the lookup above is per-desk.
      let id = format!("att-{desk_id}-{checksum}");
      conn
        .execute(
          "INSERT INTO attachment (id, desk_id, file_name, relative_path, media_type, byte_size, checksum)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
          rusqlite::params![
            id,
            desk_id,
            file_name,
            relative_path,
            media_type,
            bytes.len() as i64,
            checksum
          ],
        )
        .map_err(|e| e.to_string())?;
      id
    }
  };

  Ok(AttachmentRecord {
    id,
    file_name: file_name.to_owned(),
    relative_path,
    media_type: media_type.to_owned(),
    byte_size: bytes.len() as i64,
    checksum,
    path: absolute.to_string_lossy().into_owned(),
  })
}

/// Copies an imported file into the desk's asset directory and records it.
///
/// The bytes arrive as the raw request body rather than a command argument:
/// as an argument they would be serialized to a JSON array of integers, so a
/// four megabyte photo would cross the boundary as roughly twelve megabytes of
/// text and be allocated again on each side. The metadata rides along in
/// headers, whose values must be ASCII — hence the percent-encoded file name.
#[tauri::command]
pub async fn import_attachment(
  db: State<'_, Db>,
  assets: State<'_, AssetRoot>,
  request: tauri::ipc::Request<'_>,
) -> Result<AttachmentRecord, String> {
  let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
    return Err("import_attachment expects the file bytes as the request body".into());
  };
  let desk_id = required_header(&request, "desk-id")?.to_owned();
  let media_type = required_header(&request, "media-type")?.to_owned();
  let file_name = decoded_file_name(required_header(&request, "file-name")?)?;

  let conn = db.0.lock().map_err(|e| e.to_string())?;
  import_attachment_impl(&conn, &assets.0, &desk_id, &file_name, &media_type, bytes)
}

/// Every attachment on the desk, so stored image objects can find their bytes.
#[tauri::command]
pub async fn load_attachments(
  db: State<'_, Db>,
  assets: State<'_, AssetRoot>,
  desk_id: String,
) -> Result<Vec<AttachmentRecord>, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  let mut stmt = conn
    .prepare(
      "SELECT id, file_name, relative_path, media_type, byte_size, checksum
       FROM attachment WHERE desk_id = ?1 ORDER BY rowid",
    )
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map([desk_id.as_str()], |row| {
      let relative_path: String = row.get(2)?;
      let stored = relative_path.rsplit('/').next().unwrap_or_default().to_owned();
      Ok(AttachmentRecord {
        id: row.get(0)?,
        file_name: row.get(1)?,
        relative_path,
        media_type: row.get(3)?,
        byte_size: row.get(4)?,
        checksum: row.get(5)?,
        path: assets.0.join(stored).to_string_lossy().into_owned(),
      })
    })
    .map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>();
  rows.map_err(|e| e.to_string())
}

/// Loads a desk snapshot, or `null` when the desk does not exist.
#[tauri::command]
pub async fn load_desk(db: State<'_, Db>, desk_id: String) -> Result<Option<DeskSnapshot>, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  load_desk_impl(&conn, &desk_id).map_err(|e| e.to_string())
}

/// Creates or replaces the stored state of one object (one transaction = one
/// durable commit; this is the flush granularity from the design record).
#[tauri::command]
pub async fn save_object(
  db: State<'_, Db>,
  desk_id: String,
  object: DeskObjectRecord,
) -> Result<(), String> {
  let mut conn = db.0.lock().map_err(|e| e.to_string())?;
  save_object_impl(&mut conn, &desk_id, &object)
}

/// Removes one object from the desk.
#[tauri::command]
pub async fn delete_object(
  db: State<'_, Db>,
  desk_id: String,
  object_id: String,
) -> Result<(), String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  delete_object_impl(&conn, &desk_id, &object_id).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::db::tests::open_test_db;
  use serde_json::json;

  fn sticky(id: &str, x: f64) -> DeskObjectRecord {
    DeskObjectRecord {
      id: id.to_owned(),
      x,
      y: 20.0,
      width: 220.0,
      height: 220.0,
      rotation: -1.5,
      payload: json!({ "kind": "sticky", "text": "water the plants", "color": "yellow" }),
    }
  }

  #[test]
  fn load_missing_desk_returns_none() {
    let conn = open_test_db();
    assert!(load_desk_impl(&conn, "nope").expect("load").is_none());
  }

  #[test]
  fn save_then_load_roundtrips_objects_in_insertion_order() {
    let mut conn = open_test_db();
    save_object_impl(&mut conn, "desk-1", &sticky("a", 10.0)).expect("save a");
    save_object_impl(&mut conn, "desk-1", &sticky("b", 30.0)).expect("save b");

    let snapshot = load_desk_impl(&conn, "desk-1").expect("load").expect("desk exists");
    assert_eq!(snapshot.name, "desk-1");
    let ids: Vec<&str> = snapshot.objects.iter().map(|o| o.id.as_str()).collect();
    assert_eq!(ids, ["a", "b"]);
    assert_eq!(snapshot.objects[0].payload["kind"], "sticky");
  }

  #[test]
  fn save_is_an_upsert() {
    let mut conn = open_test_db();
    save_object_impl(&mut conn, "desk-1", &sticky("a", 10.0)).expect("save");
    save_object_impl(&mut conn, "desk-1", &sticky("a", 99.0)).expect("update");

    let snapshot = load_desk_impl(&conn, "desk-1").expect("load").expect("desk exists");
    assert_eq!(snapshot.objects.len(), 1);
    assert_eq!(snapshot.objects[0].x, 99.0);
  }

  #[test]
  fn save_rejects_payload_without_kind() {
    let mut conn = open_test_db();
    let mut object = sticky("a", 10.0);
    object.payload = json!({ "text": "no kind" });
    assert!(save_object_impl(&mut conn, "desk-1", &object).is_err());
  }

  fn event(id: &str, date: &str) -> EventRecord {
    EventRecord {
      id: id.to_owned(),
      title: "Seminar".to_owned(),
      time_label: Some("14:00".to_owned()),
      color: "blue".to_owned(),
      variant: None,
      date: date.to_owned(),
      rrule: None,
      series_id: None,
      occurrence_date: None,
      deleted: false,
      placed: false,
      x: 0.0,
      y: 0.0,
      width: 200.0,
      height: 24.0,
      rotation: 0.0,
    }
  }

  #[test]
  fn events_roundtrip_with_their_rule() {
    let mut conn = open_test_db();
    let mut series = event("series", "2026-09-01");
    series.rrule = Some("FREQ=WEEKLY;BYDAY=TU".to_owned());
    save_event_impl(&mut conn, "desk-1", &series).expect("save series");

    let loaded = load_events_impl(&conn, "desk-1").expect("load");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].rrule.as_deref(), Some("FREQ=WEEKLY;BYDAY=TU"));
    // A series anchors on its rule's dtstart.
    assert_eq!(loaded[0].date, "2026-09-01");
    assert!(!loaded[0].placed);
  }

  #[test]
  fn clearing_the_rule_turns_a_series_back_into_one_event() {
    let mut conn = open_test_db();
    let mut series = event("series", "2026-09-01");
    series.rrule = Some("FREQ=WEEKLY;BYDAY=TU".to_owned());
    save_event_impl(&mut conn, "desk-1", &series).expect("save series");

    series.rrule = None;
    save_event_impl(&mut conn, "desk-1", &series).expect("save without rule");

    let rules: i64 = conn
      .query_row("SELECT count(*) FROM recurrence_rule", [], |row| row.get(0))
      .expect("count rules");
    assert_eq!(rules, 0);
    assert!(load_events_impl(&conn, "desk-1").expect("load")[0].rrule.is_none());
  }

  #[test]
  fn an_override_records_the_date_it_replaces() {
    let mut conn = open_test_db();
    let mut series = event("series", "2026-09-01");
    series.rrule = Some("FREQ=WEEKLY;BYDAY=TU".to_owned());
    save_event_impl(&mut conn, "desk-1", &series).expect("save series");

    let mut moved = event("moved", "2026-09-15");
    moved.series_id = Some("series".to_owned());
    moved.occurrence_date = Some("2026-09-15".to_owned());
    moved.placed = true;
    moved.x = 900.0;
    moved.y = 400.0;
    save_event_impl(&mut conn, "desk-1", &moved).expect("save override");

    let loaded = load_events_impl(&conn, "desk-1").expect("load");
    let override_row = loaded.iter().find(|e| e.id == "moved").expect("override present");
    assert_eq!(override_row.series_id.as_deref(), Some("series"));
    assert_eq!(override_row.occurrence_date.as_deref(), Some("2026-09-15"));
    assert!(override_row.placed, "a moved occurrence owns its position");
    assert_eq!(override_row.x, 900.0);
  }

  #[test]
  fn save_rejects_half_an_override_key() {
    let mut conn = open_test_db();
    let mut half = event("half", "2026-09-15");
    half.series_id = Some("series".to_owned());
    assert!(save_event_impl(&mut conn, "desk-1", &half).is_err());
  }

  #[test]
  fn deleting_a_series_removes_its_overrides() {
    let mut conn = open_test_db();
    let mut series = event("series", "2026-09-01");
    series.rrule = Some("FREQ=WEEKLY;BYDAY=TU".to_owned());
    save_event_impl(&mut conn, "desk-1", &series).expect("save series");
    let mut moved = event("moved", "2026-09-15");
    moved.series_id = Some("series".to_owned());
    moved.occurrence_date = Some("2026-09-15".to_owned());
    save_event_impl(&mut conn, "desk-1", &moved).expect("save override");

    delete_event_impl(&conn, "desk-1", "series").expect("delete series");
    assert!(load_events_impl(&conn, "desk-1").expect("load").is_empty());
  }

  /// Fresh, empty asset directory for one import test.
  fn temp_assets(tag: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("yearleaf-assets-{}-{tag}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
  }

  #[test]
  fn importing_writes_the_bytes_and_records_them() {
    let conn = open_test_db();
    let assets = temp_assets("write");
    let record =
      import_attachment_impl(&conn, &assets, "desk-1", "moodboard.PNG", "image/png", b"pretend png")
        .expect("import");

    assert_eq!(record.byte_size, 11);
    assert_eq!(record.file_name, "moodboard.PNG");
    // Stored under its checksum, with a normalised extension.
    assert!(record.relative_path.starts_with("assets/"));
    assert!(record.relative_path.ends_with(".png"));
    assert_eq!(std::fs::read(&record.path).expect("file on disk"), b"pretend png");
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn importing_the_same_bytes_twice_reuses_one_copy() {
    let conn = open_test_db();
    let assets = temp_assets("dedupe");
    let first = import_attachment_impl(&conn, &assets, "desk-1", "a.png", "image/png", b"same bytes")
      .expect("first");
    // A different name, the same picture: one file and one row.
    let second =
      import_attachment_impl(&conn, &assets, "desk-1", "copy-of-a.png", "image/png", b"same bytes")
        .expect("second");

    assert_eq!(first.id, second.id);
    assert_eq!(first.checksum, second.checksum);
    let files = std::fs::read_dir(&assets).expect("dir").count();
    let rows: i64 = conn
      .query_row("SELECT count(*) FROM attachment", [], |row| row.get(0))
      .expect("count");
    assert_eq!(files, 1);
    assert_eq!(rows, 1);
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn importing_refuses_an_empty_file() {
    let conn = open_test_db();
    let assets = temp_assets("empty");
    assert!(import_attachment_impl(&conn, &assets, "desk-1", "x.png", "image/png", b"").is_err());
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn importing_refuses_a_file_past_the_size_ceiling() {
    let conn = open_test_db();
    let assets = temp_assets("oversize");
    let huge = vec![0u8; MAX_ATTACHMENT_BYTES + 1];
    let error = import_attachment_impl(&conn, &assets, "desk-1", "big.png", "image/png", &huge)
      .expect_err("past the ceiling");
    assert!(error.contains("the limit is 32 MB"), "{error}");
    // Nothing was copied before the refusal.
    assert!(!assets.exists() || std::fs::read_dir(&assets).expect("dir").count() == 0);
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn a_percent_encoded_file_name_survives_the_header() {
    // Header values are ASCII-only, so the webview encodes the name. Getting
    // this wrong would store a mangled name the user never typed.
    assert_eq!(decoded_file_name("caf%C3%A9%20sketch.png").expect("decoded"), "café sketch.png");
    assert_eq!(decoded_file_name("plain.png").expect("decoded"), "plain.png");
  }

  #[test]
  fn importing_refuses_a_non_image_without_writing_it() {
    let conn = open_test_db();
    let assets = temp_assets("wrong-type");
    assert!(
      import_attachment_impl(&conn, &assets, "desk-1", "notes.pdf", "application/pdf", b"%PDF")
        .is_err()
    );
    // Nothing reaches the asset directory, which the webview can read.
    assert!(!assets.exists() || std::fs::read_dir(&assets).expect("dir").count() == 0);
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn attachment_ids_are_scoped_to_their_desk() {
    let conn = open_test_db();
    let assets = temp_assets("two-desks");
    let first =
      import_attachment_impl(&conn, &assets, "desk-1", "a.png", "image/png", b"shared").expect("a");
    // The same picture on another desk is a separate row, so an id derived
    // from the checksum alone would collide on the primary key.
    let second =
      import_attachment_impl(&conn, &assets, "desk-2", "a.png", "image/png", b"shared").expect("b");

    assert_ne!(first.id, second.id);
    assert_eq!(first.checksum, second.checksum);
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn a_hostile_file_name_cannot_escape_the_asset_directory() {
    let conn = open_test_db();
    let assets = temp_assets("escape");
    let record = import_attachment_impl(
      &conn,
      &assets,
      "desk-1",
      "../../etc/passwd",
      "image/png",
      b"payload",
    )
    .expect("import");

    // The stored name comes from the checksum, never from the supplied name.
    let written = std::path::Path::new(&record.path);
    assert_eq!(written.parent(), Some(assets.as_path()));
    assert!(!record.relative_path.contains(".."));
    let _ = std::fs::remove_dir_all(&assets);
  }

  #[test]
  fn events_do_not_come_back_as_desk_objects() {
    let mut conn = open_test_db();
    save_object_impl(&mut conn, "desk-1", &sticky("a", 10.0)).expect("save sticky");
    save_event_impl(&mut conn, "desk-1", &event("e", "2026-09-01")).expect("save event");

    // Otherwise the desk would draw each event twice: once as a chip and once
    // as a generic object.
    let snapshot = load_desk_impl(&conn, "desk-1").expect("load").expect("desk");
    assert_eq!(snapshot.objects.iter().map(|o| o.id.as_str()).collect::<Vec<_>>(), ["a"]);
  }

  #[test]
  fn delete_removes_only_the_named_object() {
    let mut conn = open_test_db();
    save_object_impl(&mut conn, "desk-1", &sticky("a", 10.0)).expect("save a");
    save_object_impl(&mut conn, "desk-1", &sticky("b", 30.0)).expect("save b");
    delete_object_impl(&conn, "desk-1", "a").expect("delete");

    let snapshot = load_desk_impl(&conn, "desk-1").expect("load").expect("desk exists");
    let ids: Vec<&str> = snapshot.objects.iter().map(|o| o.id.as_str()).collect();
    assert_eq!(ids, ["b"]);
  }
}
