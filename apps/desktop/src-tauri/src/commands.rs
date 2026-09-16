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
    "SELECT id, x, y, width, height, rotation, payload
     FROM calendar_object WHERE desk_id = ?1 ORDER BY rowid",
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
