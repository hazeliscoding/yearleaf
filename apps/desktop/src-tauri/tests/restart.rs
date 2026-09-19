//! Proves that what a user made is still there after the process dies.
//!
//! Every other test of persistence in this repository reopens a connection
//! inside the same process, and the Playwright suite runs the browser build
//! against in-memory persistence by configuration. So the sentence the whole
//! product rests on — your desk is still there tomorrow — had never actually
//! been executed. This executes it.
//!
//! Three separate operating-system processes: one writes an object through the
//! real IPC boundary and is then killed outright, and a fresh one reads it
//! back. Nothing is shared between them but the files on disk.
//!
//! What this does **not** prove: that the Angular application asks for the
//! right thing. It drives the same commands the webview invokes, with the same
//! wire shapes, but the TypeScript adapter that calls them is not in the loop.
//! And it proves survival of a dead *process*, not of a power cut: `db::open`
//! sets `synchronous=NORMAL`, which deliberately leaves the write-ahead log to
//! the operating system's cache between checkpoints. Killing a process does not
//! empty that cache; pulling the plug would.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{Manager, WebviewWindow};

use yearleaf_lib::commands::{AssetRoot, Db};

/// Selects what a spawned copy of this binary does; unset in an ordinary run.
const ROLE: &str = "YEARLEAF_RESTART_ROLE";
/// The desk directory the spawned copy works in.
const DIR: &str = "YEARLEAF_RESTART_DIR";
const DESK_ID: &str = "default";
/// Wraps the reader's answer so the parent can find it in the test harness's
/// own chatter on stdout.
const MARK: &str = "===DESK===";

/// The object under test.
///
/// Deliberately awkward: a fractional position and a negative rotation catch a
/// round trip through an integer column or a lost sign, and the payload is a
/// checklist so the nested structure has to survive being stored as opaque
/// JSON rather than only the columns beside it.
fn subject() -> Value {
  json!({
    "id": "note-restart-1",
    "x": 7100.5,
    "y": 44560.25,
    "width": 262.5,
    "height": 190.0,
    "rotation": -2.5,
    "payload": {
      "kind": "sticky",
      "color": "yellow",
      "text": "",
      "items": [
        { "label": "survive the restart", "done": true },
        { "label": "come back the same object", "done": false }
      ]
    }
  })
}

fn app_on(dir: &Path) -> tauri::App<MockRuntime> {
  let app = mock_builder()
    .invoke_handler(tauri::generate_handler![
      yearleaf_lib::commands::load_desk,
      yearleaf_lib::commands::save_object
    ])
    .build(tauri::generate_context!())
    .expect("mock app");
  let conn = yearleaf_lib::db::open(&dir.join("desk.db")).expect("open desk database");
  app.manage(Db(std::sync::Mutex::new(conn)));
  app.manage(AssetRoot(dir.join("assets")));
  app
}

/// The capability grants these commands to the `main` window by name, so
/// building the webview under any other label has every request below denied.
fn main_webview(app: &tauri::App<MockRuntime>) -> WebviewWindow<MockRuntime> {
  tauri::WebviewWindowBuilder::new(app, "main", Default::default())
    .build()
    .expect("main webview")
}

fn invoke(webview: &WebviewWindow<MockRuntime>, cmd: &str, args: Value) -> Value {
  tauri::test::get_ipc_response(
    webview,
    InvokeRequest {
      cmd: cmd.into(),
      callback: CallbackFn(0),
      error: CallbackFn(1),
      url: "http://tauri.localhost".parse().unwrap(),
      body: InvokeBody::Json(args),
      headers: Default::default(),
      invoke_key: INVOKE_KEY.to_string(),
    },
  )
  .unwrap_or_else(|error| panic!("{cmd} was refused: {error}"))
  .deserialize::<Value>()
  .expect("json response")
}

/// The body of a spawned copy of this binary.
///
/// A no-op in an ordinary run: without {@link ROLE} in the environment there is
/// nothing to do, which keeps it out of the way of `cargo test` while letting
/// the parent below re-invoke this same binary as a child process. Driving a
/// second process any other way would mean shipping an extra executable in the
/// crate purely to be crashed.
#[test]
fn restart_child() {
  let Ok(role) = std::env::var(ROLE) else {
    return;
  };
  let dir = PathBuf::from(std::env::var(DIR).expect("desk directory"));
  let app = app_on(&dir);
  let webview = main_webview(&app);

  match role.as_str() {
    "write" => {
      invoke(
        &webview,
        "save_object",
        json!({ "deskId": DESK_ID, "object": subject() }),
      );
      // Straight out, with no unwinding, no Drop, and so no clean close of the
      // connection: SQLite gets no chance to checkpoint the write-ahead log or
      // tidy up after itself. This is the whole point of the exercise — a
      // graceful shutdown would prove only that SQLite can write a file.
      std::process::abort();
    }
    "read" => {
      let desk = invoke(&webview, "load_desk", json!({ "deskId": DESK_ID }));
      println!("{MARK}{desk}{MARK}");
    }
    other => panic!("unknown role {other}"),
  }
}

fn desk_dir(tag: &str) -> PathBuf {
  let dir = std::env::temp_dir().join(format!("yearleaf-restart-{}-{tag}", std::process::id()));
  let _ = std::fs::remove_dir_all(&dir);
  std::fs::create_dir_all(&dir).expect("desk dir");
  dir
}

fn spawn(role: &str, dir: &Path) -> std::process::Output {
  Command::new(std::env::current_exe().expect("test binary"))
    .args(["restart_child", "--exact", "--nocapture", "--test-threads=1"])
    .env(ROLE, role)
    .env(DIR, dir)
    .output()
    .expect("spawn child process")
}

/// Opens a desk directory in a brand new process and returns what it loaded.
fn read_desk(dir: &Path) -> Value {
  let reader = spawn("read", dir);
  assert!(
    reader.status.success(),
    "the reader failed: {}",
    String::from_utf8_lossy(&reader.stderr)
  );
  let stdout = String::from_utf8_lossy(&reader.stdout);
  let answer = stdout
    .split(MARK)
    .nth(1)
    .unwrap_or_else(|| panic!("no desk in the reader's output:\n{stdout}"));
  serde_json::from_str(answer).expect("desk json")
}

#[test]
fn an_object_survives_a_process_that_never_shut_down() {
  let dir = desk_dir("survives");

  let writer = spawn("write", &dir);
  assert!(
    !writer.status.success(),
    "the writer was supposed to die mid-flight; a clean exit means the crash \
     never happened and this test proves nothing. status: {:?}",
    writer.status
  );

  // The commit is in the write-ahead log and has not been folded into the
  // database file, which is what makes the read below a replay rather than an
  // ordinary open. Asserting it is the difference between exercising that path
  // and assuming it.
  let wal = dir.join("desk.db-wal");
  let wal_len = std::fs::metadata(&wal).map(|meta| meta.len()).unwrap_or(0);
  assert!(
    wal_len > 0,
    "expected a hot write-ahead log at {}; without one the object had already \
     been checkpointed and replay was never tested",
    wal.display()
  );

  let desk = read_desk(&dir);

  assert_eq!(desk["deskId"], DESK_ID);
  let objects = desk["objects"].as_array().expect("objects");
  assert_eq!(objects.len(), 1, "exactly the object that was written");

  // Not a count: the same object. Geometry, rotation and the whole nested
  // payload, compared against what went in.
  assert_eq!(objects[0], subject(), "the object came back changed");
}

/// Shows the object really is being recovered from the log.
///
/// The test above infers it: nothing checkpointed, so the commit must be in the
/// write-ahead log. This demonstrates it, by taking the database file away from
/// its log and finding the object gone. Without this, "WAL replay is exercised"
/// rests on an argument about SQLite's behaviour rather than on a measurement.
#[test]
fn the_object_is_in_the_log_rather_than_the_database_file() {
  let dir = desk_dir("wal-only");
  assert!(!spawn("write", &dir).status.success(), "writer must crash");

  // With its log, the object is there — stated here rather than borrowed from
  // the test above, so this one cannot pass by nothing ever having been
  // written. Absence is only evidence once presence is established.
  assert_eq!(read_desk(&dir)["objects"][0], subject(), "written and readable");

  // The database file alone, orphaned from the log that holds the commit.
  let orphan = desk_dir("wal-orphan");
  std::fs::copy(dir.join("desk.db"), orphan.join("desk.db")).expect("copy database file");

  assert_eq!(
    read_desk(&orphan),
    Value::Null,
    "the database file already held the desk, so the log was not carrying the \
     commit and the replay path is not what the other tests exercised"
  );
}

#[test]
fn a_second_process_reads_it_without_the_first_ever_cleaning_up() {
  let dir = desk_dir("twice");
  assert!(!spawn("write", &dir).status.success(), "writer must crash");

  // Two independent readers, because a replay that works once and corrupts the
  // log would still satisfy a single read.
  for attempt in 1..=2 {
    assert_eq!(
      read_desk(&dir)["objects"][0],
      subject(),
      "reader {attempt} saw it changed"
    );
  }
}
